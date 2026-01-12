import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { auditAdminAction } from "@/lib/audit";

export type ExportType = 
  | "all"
  | "apps"
  | "users"
  | "models"
  | "providers"
  | "jobs"
  | "audit_logs"
  | "revenuecat_events"
  | "token_ledger";

interface ExportOptions {
  types: ExportType[];
  includeSecrets?: boolean; // Include API keys, webhook secrets (for full restore)
}

/**
 * POST /api/admin/backups/export
 * 
 * Export data for backup purposes.
 * Returns a JSON file with the requested data.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { types = ["all"], includeSecrets = false }: ExportOptions = body;

    const exportData: Record<string, unknown> = {
      _meta: {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        exportedBy: session.user.email,
        types,
        includeSecrets,
      },
    };

    const shouldExport = (type: ExportType) => 
      types.includes("all") || types.includes(type);

    // Export Apps
    if (shouldExport("apps")) {
      const apps = await prisma.app.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          isEnabled: true,
          apiKey: includeSecrets,
          apiKeyPrefix: true,
          webhookUrl: true,
          webhookSecret: includeSecrets,
          defaultTokenGrant: true,
          tokenExpirationDays: true,
          rateLimitPerUser: true,
          rateLimitPerApp: true,
          revenueCatAppId: true,
          appStoreUrl: true,
          iconUrl: true,
          bundleId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      exportData.apps = apps;
    }

    // Export Users (AppUsers)
    if (shouldExport("users")) {
      const users = await prisma.appUser.findMany({
        select: {
          id: true,
          appId: true,
          externalId: true,
          tokenBalance: true,
          isActive: true,
          metadata: true,
          needsTokenSync: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      exportData.users = users;
    }

    // Export AI Models
    if (shouldExport("models")) {
      const models = await prisma.aIModel.findMany({
        include: {
          providerConfigs: {
            select: {
              id: true,
              providerId: true,
              providerModelId: true,
              priority: true,
              isEnabled: true,
              costPerRequest: true,
              config: true,
            },
          },
        },
      });
      exportData.models = models;
    }

    // Export Providers
    if (shouldExport("providers")) {
      const providers = await prisma.aIProvider.findMany({
        select: {
          id: true,
          name: true,
          displayName: true,
          baseUrl: true,
          apiKeyEnvVar: true,
          isEnabled: true,
          healthStatus: true,
          lastHealthCheck: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      exportData.providers = providers;
    }

    // Export Jobs (with pagination warning for large datasets)
    if (shouldExport("jobs")) {
      const jobCount = await prisma.generationJob.count();
      if (jobCount > 10000) {
        exportData.jobs = {
          _warning: `Large dataset: ${jobCount} jobs. Consider exporting in batches.`,
          count: jobCount,
        };
      } else {
        const jobs = await prisma.generationJob.findMany({
          select: {
            id: true,
            appId: true,
            appUserId: true,
            aiModelId: true,
            status: true,
            inputPayload: true,
            tokenCost: true,
            tokensCharged: true,
            tokensRefunded: true,
            providerTaskId: true,
            usedProvider: true,
            attemptsCount: true,
            outputs: true,
            errorMessage: true,
            errorCode: true,
            webhookDelivered: true,
            webhookAttempts: true,
            priority: true,
            startedAt: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10000,
        });
        exportData.jobs = jobs;
      }
    }

    // Export Audit Logs
    if (shouldExport("audit_logs")) {
      const auditCount = await prisma.auditLog.count();
      if (auditCount > 50000) {
        exportData.auditLogs = {
          _warning: `Large dataset: ${auditCount} audit logs. Consider exporting in batches.`,
          count: auditCount,
        };
      } else {
        const auditLogs = await prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 50000,
        });
        exportData.auditLogs = auditLogs;
      }
    }

    // Export RevenueCat Events
    if (shouldExport("revenuecat_events")) {
      const rcCount = await prisma.revenueCatEvent.count();
      if (rcCount > 10000) {
        exportData.revenueCatEvents = {
          _warning: `Large dataset: ${rcCount} RevenueCat events. Consider exporting in batches.`,
          count: rcCount,
        };
      } else {
        const rcEvents = await prisma.revenueCatEvent.findMany({
          orderBy: { createdAt: "desc" },
          take: 10000,
        });
        // Convert BigInt to string for JSON serialization
        exportData.revenueCatEvents = rcEvents.map(e => ({
          ...e,
          eventTimestampMs: e.eventTimestampMs?.toString(),
          purchasedAtMs: e.purchasedAtMs?.toString(),
          expirationAtMs: e.expirationAtMs?.toString(),
        }));
      }
    }

    // Export Token Ledger
    if (shouldExport("token_ledger")) {
      const ledgerCount = await prisma.tokenLedgerEntry.count();
      if (ledgerCount > 50000) {
        exportData.tokenLedger = {
          _warning: `Large dataset: ${ledgerCount} token entries. Consider exporting in batches.`,
          count: ledgerCount,
        };
      } else {
        const ledger = await prisma.tokenLedgerEntry.findMany({
          orderBy: { createdAt: "desc" },
          take: 50000,
        });
        exportData.tokenLedger = ledger;
      }
    }

    // Return as downloadable JSON
    const jsonStr = JSON.stringify(exportData, null, 2);

    // Audit log the export
    await auditAdminAction(req, "system.backup_exported", "System", "backup", {
      types,
      includeSecrets,
      dataSize: jsonStr.length,
    });
    const filename = `ai-backend-hub-backup-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(jsonStr, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Export failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
