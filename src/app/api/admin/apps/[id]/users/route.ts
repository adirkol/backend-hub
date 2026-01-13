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
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: appId } = await params;

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

    // Get counts before deletion for audit log
    const userCount = app._count.users;
    const jobCount = app._count.jobs;

    // Get RevenueCat event count
    const rcEventCount = await prisma.revenueCatEvent.count({
      where: { appId },
    });

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

    // Audit log
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
      }
    );

    return NextResponse.json({
      success: true,
      deleted: {
        users: deleteResult.count,
        jobs: jobCount,
        revenueCatEvents: rcEventCount,
        tokenLedgerEntries: tokenLedgerCount,
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
