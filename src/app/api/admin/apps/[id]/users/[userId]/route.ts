import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auditAdminAction } from "@/lib/audit";
import { getEffectiveTokenBalance } from "@/lib/tokens";

interface RouteParams {
  params: Promise<{ id: string; userId: string }>;
}

const UpdateUserSchema = z.object({
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/admin/apps/[id]/users/[userId]
 * 
 * Get user details (admin view).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: appId, userId } = await params;

    // Find user
    const appUser = await prisma.appUser.findFirst({
      where: { id: userId, appId },
      include: {
        app: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { jobs: true, tokenLedger: true, revenueCatEvents: true },
        },
      },
    });

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get effective balance
    const balanceInfo = await getEffectiveTokenBalance(appUser.id);

    return NextResponse.json({
      id: appUser.id,
      external_id: appUser.externalId,
      app: appUser.app,
      raw_balance: balanceInfo.rawBalance,
      effective_balance: balanceInfo.effectiveBalance,
      expired_tokens: balanceInfo.expiredTokens,
      is_active: appUser.isActive,
      needs_token_sync: appUser.needsTokenSync,
      metadata: appUser.metadata,
      counts: appUser._count,
      created_at: appUser.createdAt.toISOString(),
      updated_at: appUser.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Get admin user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/apps/[id]/users/[userId]
 * 
 * Update user (status, metadata).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: appId, userId } = await params;

    // Find existing user
    const existingUser = await prisma.appUser.findFirst({
      where: { id: userId, appId },
      include: {
        app: { select: { name: true } },
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse request body
    const body = await req.json();
    const validation = UpdateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { isActive, metadata } = validation.data;

    // Build update data
    const updateData: Prisma.AppUserUpdateInput = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (metadata !== undefined) updateData.metadata = metadata as Prisma.InputJsonValue;

    // Update user
    const updatedUser = await prisma.appUser.update({
      where: { id: userId },
      data: updateData,
    });

    // Audit log for status change
    if (isActive !== undefined && isActive !== existingUser.isActive) {
      await auditAdminAction(req, "user.status_changed", "AppUser", userId, {
        appId,
        appName: existingUser.app.name,
        userExternalId: existingUser.externalId,
        previousStatus: existingUser.isActive ? "active" : "inactive",
        newStatus: isActive ? "active" : "inactive",
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        external_id: updatedUser.externalId,
        is_active: updatedUser.isActive,
        metadata: updatedUser.metadata,
        updated_at: updatedUser.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Update admin user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/apps/[id]/users/[userId]
 * 
 * Delete a user (soft delete by deactivating, or hard delete).
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: appId, userId } = await params;
    const url = new URL(req.url);
    const hardDelete = url.searchParams.get("hard") === "true";

    // Find existing user
    const existingUser = await prisma.appUser.findFirst({
      where: { id: userId, appId },
      include: {
        app: { select: { name: true } },
        _count: { select: { jobs: true } },
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Audit log before deletion
    await auditAdminAction(req, "user.deleted", "AppUser", userId, {
      appId,
      appName: existingUser.app.name,
      userExternalId: existingUser.externalId,
      tokenBalance: existingUser.tokenBalance,
      jobCount: existingUser._count.jobs,
      hardDelete,
    });

    if (hardDelete) {
      // Hard delete - remove user and all associated data
      await prisma.appUser.delete({ where: { id: userId } });
    } else {
      // Soft delete - just deactivate
      await prisma.appUser.update({
        where: { id: userId },
        data: { isActive: false },
      });
    }

    return NextResponse.json({
      success: true,
      deleted: hardDelete,
      deactivated: !hardDelete,
    });
  } catch (error) {
    console.error("Delete admin user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
