import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { grantTokens, calculateExpirationDate, getEffectiveTokenBalance } from "@/lib/tokens";

interface RouteParams {
  params: Promise<{ externalId: string }>;
}

const GrantTokensSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().min(1).max(500),
  idempotency_key: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const auth = await validateApiRequest(req);
    if (!auth.success || !auth.app) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { externalId } = await params;

    // Parse and validate body
    const body = await req.json();
    const validation = GrantTokensSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, reason, idempotency_key } = validation.data;

    // Find or create user for this app
    let appUser = await prisma.appUser.findUnique({
      where: {
        appId_externalId: {
          appId: auth.app.id,
          externalId,
        },
      },
    });

    if (!appUser) {
      // Auto-create user if not exists
      appUser = await prisma.appUser.create({
        data: {
          appId: auth.app.id,
          externalId,
          tokenBalance: 0,
        },
      });
    }

    // Get previous effective balance
    const { effectiveBalance: previousBalance } = await getEffectiveTokenBalance(appUser.id);

    // Calculate expiration date based on app settings
    const expiresAt = calculateExpirationDate(auth.app.tokenExpirationDays);

    // Grant tokens with idempotency and expiration
    const result = await grantTokens(
      appUser.id,
      amount,
      reason,
      idempotency_key,
      expiresAt
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      external_id: externalId,
      previous_balance: previousBalance,
      amount_added: amount,
      new_balance: result.balance,
      transaction_id: result.transactionId,
      expires_at: expiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Grant tokens error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const auth = await validateApiRequest(req);
    if (!auth.success || !auth.app) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { externalId } = await params;
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    // Find user for this app
    const appUser = await prisma.appUser.findUnique({
      where: {
        appId_externalId: {
          appId: auth.app.id,
          externalId,
        },
      },
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
      external_id: externalId,
      current_balance: balanceInfo.effectiveBalance,
      transactions: history.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        balance_after: entry.balanceAfter,
        type: entry.type.toLowerCase(),
        description: entry.description,
        job_id: entry.jobId,
        expires_at: entry.expiresAt?.toISOString() ?? null,
        created_at: entry.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get token history error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}




