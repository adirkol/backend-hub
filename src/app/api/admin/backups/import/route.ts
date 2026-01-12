import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { auditAdminAction } from "@/lib/audit";
import { Prisma } from "@prisma/client";

interface ImportOptions {
  mode: "merge" | "replace"; // merge = skip existing, replace = overwrite
  types?: string[]; // Which types to import (default: all present in backup)
  dryRun?: boolean; // Preview changes without applying
}

interface ImportResult {
  success: boolean;
  dryRun: boolean;
  results: {
    type: string;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  }[];
  totalCreated: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
}

/**
 * POST /api/admin/backups/import
 * 
 * Import data from a backup file.
 * Supports merge (skip existing) or replace (overwrite) modes.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const optionsStr = formData.get("options") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const options: ImportOptions = optionsStr 
      ? JSON.parse(optionsStr) 
      : { mode: "merge", dryRun: false };

    const content = await file.text();
    let backupData: Record<string, unknown>;

    try {
      backupData = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
    }

    // Validate backup format
    if (!backupData._meta) {
      return NextResponse.json(
        { error: "Invalid backup file: missing metadata" },
        { status: 400 }
      );
    }

    const result: ImportResult = {
      success: true,
      dryRun: options.dryRun ?? false,
      results: [],
      totalCreated: 0,
      totalUpdated: 0,
      totalSkipped: 0,
      totalErrors: 0,
    };

    const shouldImport = (type: string) => {
      if (!options.types || options.types.length === 0) return true;
      return options.types.includes(type);
    };

    // Import Providers first (dependencies for models)
    if (backupData.providers && shouldImport("providers")) {
      const importResult = await importProviders(
        backupData.providers as Prisma.AIProviderCreateInput[],
        options.mode,
        options.dryRun ?? false
      );
      result.results.push({ type: "providers", ...importResult });
      result.totalCreated += importResult.created;
      result.totalUpdated += importResult.updated;
      result.totalSkipped += importResult.skipped;
      result.totalErrors += importResult.errors.length;
    }

    // Import Apps (dependencies for users and jobs)
    if (backupData.apps && shouldImport("apps")) {
      const importResult = await importApps(
        backupData.apps as Record<string, unknown>[],
        options.mode,
        options.dryRun ?? false
      );
      result.results.push({ type: "apps", ...importResult });
      result.totalCreated += importResult.created;
      result.totalUpdated += importResult.updated;
      result.totalSkipped += importResult.skipped;
      result.totalErrors += importResult.errors.length;
    }

    // Import Models (depends on providers)
    if (backupData.models && shouldImport("models")) {
      const importResult = await importModels(
        backupData.models as Record<string, unknown>[],
        options.mode,
        options.dryRun ?? false
      );
      result.results.push({ type: "models", ...importResult });
      result.totalCreated += importResult.created;
      result.totalUpdated += importResult.updated;
      result.totalSkipped += importResult.skipped;
      result.totalErrors += importResult.errors.length;
    }

    // Import Users (depends on apps)
    if (backupData.users && shouldImport("users")) {
      const importResult = await importUsers(
        backupData.users as Record<string, unknown>[],
        options.mode,
        options.dryRun ?? false
      );
      result.results.push({ type: "users", ...importResult });
      result.totalCreated += importResult.created;
      result.totalUpdated += importResult.updated;
      result.totalSkipped += importResult.skipped;
      result.totalErrors += importResult.errors.length;
    }

    // Import Token Ledger (depends on users)
    if (backupData.tokenLedger && shouldImport("token_ledger") && !Array.isArray(backupData.tokenLedger)) {
      result.results.push({
        type: "token_ledger",
        created: 0,
        updated: 0,
        skipped: 0,
        errors: ["Token ledger import skipped - dataset warning in backup"],
      });
    } else if (backupData.tokenLedger && shouldImport("token_ledger")) {
      const importResult = await importTokenLedger(
        backupData.tokenLedger as Record<string, unknown>[],
        options.mode,
        options.dryRun ?? false
      );
      result.results.push({ type: "token_ledger", ...importResult });
      result.totalCreated += importResult.created;
      result.totalUpdated += importResult.updated;
      result.totalSkipped += importResult.skipped;
      result.totalErrors += importResult.errors.length;
    }

    // Audit log the import
    if (!options.dryRun) {
      await auditAdminAction(req, "system.settings_updated", "System", "backup", {
        action: "import",
        mode: options.mode,
        types: options.types,
        results: result.results.map(r => ({
          type: r.type,
          created: r.created,
          updated: r.updated,
          skipped: r.skipped,
          errorCount: r.errors.length,
        })),
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Import failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Helper functions for importing each type

async function importProviders(
  providers: Prisma.AIProviderCreateInput[],
  mode: "merge" | "replace",
  dryRun: boolean
) {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const provider of providers) {
    try {
      const existing = await prisma.aIProvider.findUnique({
        where: { id: provider.id as string },
      });

      if (existing) {
        if (mode === "replace" && !dryRun) {
          await prisma.aIProvider.update({
            where: { id: provider.id as string },
            data: {
              name: provider.name,
              slug: provider.slug,
              baseUrl: provider.baseUrl,
              apiKeyEnvVar: provider.apiKeyEnvVar,
              isEnabled: provider.isEnabled,
            },
          });
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        if (!dryRun) {
          await prisma.aIProvider.create({
            data: {
              id: provider.id as string,
              name: provider.name,
              slug: provider.slug,
              baseUrl: provider.baseUrl,
              apiKeyEnvVar: provider.apiKeyEnvVar,
              isEnabled: provider.isEnabled ?? true,
            },
          });
        }
        result.created++;
      }
    } catch (error) {
      result.errors.push(`Provider ${provider.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return result;
}

async function importApps(
  apps: Record<string, unknown>[],
  mode: "merge" | "replace",
  dryRun: boolean
) {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const app of apps) {
    try {
      const existing = await prisma.app.findUnique({
        where: { id: app.id as string },
      });

      if (existing) {
        if (mode === "replace" && !dryRun) {
          await prisma.app.update({
            where: { id: app.id as string },
            data: {
              name: app.name as string,
              slug: app.slug as string,
              description: app.description as string | null,
              isEnabled: app.isEnabled as boolean,
              webhookUrl: app.webhookUrl as string | null,
              webhookSecret: app.webhookSecret as string | null,
              defaultTokenGrant: app.defaultTokenGrant as number,
              tokenExpirationDays: app.tokenExpirationDays as number | null,
              rateLimitPerUser: app.rateLimitPerUser as number,
              rateLimitPerApp: app.rateLimitPerApp as number,
              revenueCatAppId: app.revenueCatAppId as string | null,
              appStoreUrl: app.appStoreUrl as string | null,
              iconUrl: app.iconUrl as string | null,
              bundleId: app.bundleId as string | null,
            },
          });
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        if (!dryRun) {
          await prisma.app.create({
            data: {
              id: app.id as string,
              name: app.name as string,
              slug: app.slug as string,
              description: app.description as string | null,
              isEnabled: app.isEnabled as boolean ?? true,
              apiKey: app.apiKey as string || `ak_${Math.random().toString(36).slice(2)}`,
              apiKeyPrefix: app.apiKeyPrefix as string || "ak_",
              webhookUrl: app.webhookUrl as string | null,
              webhookSecret: app.webhookSecret as string | null,
              defaultTokenGrant: app.defaultTokenGrant as number ?? 100,
              tokenExpirationDays: app.tokenExpirationDays as number | null,
              rateLimitPerUser: app.rateLimitPerUser as number ?? 100,
              rateLimitPerApp: app.rateLimitPerApp as number ?? 10000,
              revenueCatAppId: app.revenueCatAppId as string | null,
              appStoreUrl: app.appStoreUrl as string | null,
              iconUrl: app.iconUrl as string | null,
              bundleId: app.bundleId as string | null,
            },
          });
        }
        result.created++;
      }
    } catch (error) {
      result.errors.push(`App ${app.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return result;
}

async function importModels(
  models: Record<string, unknown>[],
  mode: "merge" | "replace",
  dryRun: boolean
) {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const model of models) {
    try {
      const existing = await prisma.aIModel.findUnique({
        where: { id: model.id as string },
      });

      if (existing) {
        if (mode === "replace" && !dryRun) {
          // Delete existing configs and recreate
          await prisma.modelProviderConfig.deleteMany({
            where: { modelId: model.id as string },
          });

          await prisma.aIModel.update({
            where: { id: model.id as string },
            data: {
              name: model.name as string,
              displayName: model.displayName as string,
              description: model.description as string | null,
              category: model.category as string,
              capabilities: model.capabilities as string[],
              isEnabled: model.isEnabled as boolean,
              tokenCost: model.tokenCost as number,
            },
          });

          // Recreate provider configs
          const configs = model.providerConfigs as Record<string, unknown>[];
          if (configs) {
            for (const config of configs) {
              await prisma.modelProviderConfig.create({
                data: {
                  modelId: model.id as string,
                  providerId: config.providerId as string,
                  providerModelId: config.providerModelId as string,
                  priority: config.priority as number ?? 1,
                  isEnabled: config.isEnabled as boolean ?? true,
                  costPerRequest: config.costPerRequest as number ?? 0,
                  config: config.config as Prisma.InputJsonValue,
                },
              });
            }
          }
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        if (!dryRun) {
          await prisma.aIModel.create({
            data: {
              id: model.id as string,
              name: model.name as string,
              displayName: model.displayName as string,
              description: model.description as string | null,
              category: model.category as string ?? "general",
              capabilities: model.capabilities as string[] ?? [],
              isEnabled: model.isEnabled as boolean ?? true,
              tokenCost: model.tokenCost as number ?? 1,
            },
          });

          // Create provider configs
          const configs = model.providerConfigs as Record<string, unknown>[];
          if (configs) {
            for (const config of configs) {
              await prisma.modelProviderConfig.create({
                data: {
                  modelId: model.id as string,
                  providerId: config.providerId as string,
                  providerModelId: config.providerModelId as string,
                  priority: config.priority as number ?? 1,
                  isEnabled: config.isEnabled as boolean ?? true,
                  costPerRequest: config.costPerRequest as number ?? 0,
                  config: config.config as Prisma.InputJsonValue,
                },
              });
            }
          }
        }
        result.created++;
      }
    } catch (error) {
      result.errors.push(`Model ${model.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return result;
}

async function importUsers(
  users: Record<string, unknown>[],
  mode: "merge" | "replace",
  dryRun: boolean
) {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const user of users) {
    try {
      const existing = await prisma.appUser.findUnique({
        where: { id: user.id as string },
      });

      if (existing) {
        if (mode === "replace" && !dryRun) {
          await prisma.appUser.update({
            where: { id: user.id as string },
            data: {
              tokenBalance: user.tokenBalance as number,
              isActive: user.isActive as boolean,
              metadata: user.metadata as Prisma.InputJsonValue,
              needsTokenSync: user.needsTokenSync as boolean,
            },
          });
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        // Check if app exists
        const appExists = await prisma.app.findUnique({
          where: { id: user.appId as string },
        });

        if (!appExists) {
          result.errors.push(`User ${user.externalId}: App ${user.appId} not found`);
          continue;
        }

        if (!dryRun) {
          await prisma.appUser.create({
            data: {
              id: user.id as string,
              appId: user.appId as string,
              externalId: user.externalId as string,
              tokenBalance: user.tokenBalance as number ?? 0,
              isActive: user.isActive as boolean ?? true,
              metadata: user.metadata as Prisma.InputJsonValue,
              needsTokenSync: user.needsTokenSync as boolean ?? false,
            },
          });
        }
        result.created++;
      }
    } catch (error) {
      result.errors.push(`User ${user.externalId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return result;
}

async function importTokenLedger(
  entries: Record<string, unknown>[],
  mode: "merge" | "replace",
  dryRun: boolean
) {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const entry of entries) {
    try {
      const existing = await prisma.tokenLedgerEntry.findUnique({
        where: { id: entry.id as string },
      });

      if (existing) {
        result.skipped++;
      } else {
        // Check if user exists
        const userExists = await prisma.appUser.findUnique({
          where: { id: entry.appUserId as string },
        });

        if (!userExists) {
          result.errors.push(`Token entry ${entry.id}: User ${entry.appUserId} not found`);
          continue;
        }

        if (!dryRun) {
          await prisma.tokenLedgerEntry.create({
            data: {
              id: entry.id as string,
              appUserId: entry.appUserId as string,
              amount: entry.amount as number,
              balanceAfter: entry.balanceAfter as number,
              type: entry.type as string,
              description: entry.description as string | null,
              idempotencyKey: entry.idempotencyKey as string | null,
              jobId: entry.jobId as string | null,
              expiresAt: entry.expiresAt ? new Date(entry.expiresAt as string) : null,
              createdAt: entry.createdAt ? new Date(entry.createdAt as string) : undefined,
            },
          });
        }
        result.created++;
      }
    } catch (error) {
      result.errors.push(`Token entry: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return result;
}
