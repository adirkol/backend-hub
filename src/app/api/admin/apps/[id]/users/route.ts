import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { auditAdminAction } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/admin/apps/:id/users
 * Delete all users for an app (for debugging/testing purposes)
 * This also deletes related data: token ledger entries, jobs, and RevenueCat events
 * Optionally deletes related audit logs if deleteAuditLogs=true
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: appId } = await params;
    
    // Parse query params
    const url = new URL(req.url);
    const deleteAuditLogs = url.searchParams.get("deleteAuditLogs") === "true";

    // Verify app exists
    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { 
        id: true, 
        name: true,
        _count: { select: { users: true, jobs: true } }
      },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Get user IDs before deletion (needed for audit log deletion)
    const userIds = await prisma.appUser.findMany({
      where: { appId },
      select: { id: true, externalId: true },
    });
    const userIdList = userIds.map(u => u.id);
    const externalIdList = userIds.map(u => u.externalId);

    // Get counts before deletion for audit log
    const userCount = app._count.users;
    const jobCount = app._count.jobs;

    // Get RevenueCat event IDs and count
    const rcEvents = await prisma.revenueCatEvent.findMany({
      where: { appId },
      select: { id: true },
    });
    const rcEventIds = rcEvents.map(e => e.id);
    const rcEventCount = rcEvents.length;

    // Get token ledger entry count
    const tokenLedgerCount = await prisma.tokenLedgerEntry.count({
      where: {
        appUser: { appId },
      },
    });

    // Delete all related data in order (respecting foreign keys)
    // Note: Due to cascading deletes on AppUser, some of these will be automatically deleted
    // But we explicitly delete them for clarity and to get accurate counts

    // 1. Delete all RevenueCat events for this app
    await prisma.revenueCatEvent.deleteMany({
      where: { appId },
    });

    // 2. Delete all token ledger entries for users in this app
    await prisma.tokenLedgerEntry.deleteMany({
      where: {
        appUser: { appId },
      },
    });

    // 3. Delete all jobs for this app (this also affects provider usage logs)
    await prisma.generationJob.deleteMany({
      where: { appId },
    });

    // 4. Delete all users for this app
    const deleteResult = await prisma.appUser.deleteMany({
      where: { appId },
    });

    // 5. Optionally delete related audit logs
    let auditLogsDeleted = 0;
    if (deleteAuditLogs && (userIdList.length > 0 || rcEventIds.length > 0)) {
      // Delete audit logs where:
      // - entityType is AppUser and entityId is one of the deleted users
      // - entityType is RevenueCatEvent and entityId is one of the deleted RC events
      // - metadata contains any of the user external IDs or user IDs
      const auditDeleteResult = await prisma.auditLog.deleteMany({
        where: {
          OR: [
            // Direct entity references
            { entityType: "AppUser", entityId: { in: userIdList } },
            { entityType: "RevenueCatEvent", entityId: { in: rcEventIds } },
            // Metadata references (for RevenueCat events that reference users)
            ...externalIdList.map(externalId => ({
              metadata: { path: ["userExternalId"], equals: externalId }
            })),
            ...externalIdList.map(externalId => ({
              metadata: { path: ["revenueCatUserId"], equals: externalId }
            })),
            ...userIdList.map(userId => ({
              metadata: { path: ["appUserId"], equals: userId }
            })),
          ],
        },
      });
      auditLogsDeleted = auditDeleteResult.count;
    }

    // Create audit log for the deletion action itself (this one is always kept)
    await auditAdminAction(
      "app.users_deleted",
      "App",
      appId,
      session.user.email,
      {
        appName: app.name,
        deletedUsers: deleteResult.count,
        deletedJobs: jobCount,
        deletedRevenueCatEvents: rcEventCount,
        deletedTokenLedgerEntries: tokenLedgerCount,
        deletedAuditLogs: auditLogsDeleted,
        auditLogsDeletedOption: deleteAuditLogs,
      }
    );

    return NextResponse.json({
      success: true,
      deleted: {
        users: deleteResult.count,
        jobs: jobCount,
        revenueCatEvents: rcEventCount,
        tokenLedgerEntries: tokenLedgerCount,
        auditLogs: auditLogsDeleted,
      },
    });
  } catch (error) {
    console.error("Error deleting app users:", error);
    return NextResponse.json(
      { error: "Failed to delete users" },
      { status: 500 }
    );
  }
}
