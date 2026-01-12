import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { adminAdjustTokens, calculateExpirationDate, getEffectiveTokenBalance } from "@/lib/tokens";
import { auditAdminAction } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string; userId: string }>;
}

const AdjustTokensSchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(1).max(500),
});

/**
 * POST /api/admin/apps/[id]/users/[userId]/tokens
 * 
 * Admin endpoint to adjust (add or remove) tokens for a user.
 * Requires admin authentication.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: appId, userId } = await params;

    // Verify app exists
    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { id: true, name: true, tokenExpirationDays: true },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Verify user exists and belongs to this app
    const appUser = await prisma.appUser.findFirst({
      where: { id: userId, appId },
      select: { id: true, externalId: true, tokenBalance: true },
    });

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse request body
    const body = await req.json();
    const validation = AdjustTokensSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, reason } = validation.data;

    // Get previous effective balance
    const { effectiveBalance: previousBalance } = await getEffectiveTokenBalance(appUser.id);

    // Calculate expiration date for positive adjustments
    const expiresAt = amount > 0 ? calculateExpirationDate(app.tokenExpirationDays) : null;

    // Perform the adjustment
    const result = await adminAdjustTokens(
      appUser.id,
      amount,
      session.user.id,
      reason,
      expiresAt
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Audit log
    await auditAdminAction(req, "user.tokens_adjusted", "AppUser", appUser.id, {
      appId,
      appName: app.name,
      userExternalId: appUser.externalId,
      amount,
      reason,
      previousBalance,
      newBalance: result.balance,
      expiresAt: expiresAt?.toISOString() ?? null,
    });

    return NextResponse.json({
      success: true,
      user_id: appUser.id,
      external_id: appUser.externalId,
      previous_balance: previousBalance,
      adjustment: amount,
      new_balance: result.balance,
      transaction_id: result.transactionId,
      expires_at: expiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Admin adjust tokens error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/apps/[id]/users/[userId]/tokens
 * 
 * Get token history for a user (admin view).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: appId, userId } = await params;
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);

    // Verify user exists and belongs to this app
    const appUser = await prisma.appUser.findFirst({
      where: { id: userId, appId },
      select: { id: true, externalId: true, tokenBalance: true },
    });

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get token history and effective balance
    const [history, balanceInfo] = await Promise.all([
      prisma.tokenLedgerEntry.findMany({
        where: { appUserId: appUser.id },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      getEffectiveTokenBalance(appUser.id),
    ]);

    return NextResponse.json({
      user_id: appUser.id,
      external_id: appUser.externalId,
      raw_balance: balanceInfo.rawBalance,
      effective_balance: balanceInfo.effectiveBalance,
      expired_tokens: balanceInfo.expiredTokens,
      transactions: history.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        balance_after: entry.balanceAfter,
        type: entry.type,
        description: entry.description,
        job_id: entry.jobId,
        expires_at: entry.expiresAt?.toISOString() ?? null,
        created_at: entry.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get admin token history error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
