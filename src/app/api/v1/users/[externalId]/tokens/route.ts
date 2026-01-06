import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { grantTokens } from "@/lib/tokens";

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

    const previousBalance = appUser.tokenBalance;

    // Grant tokens with idempotency
    const result = await grantTokens(
      appUser.id,
      amount,
      reason,
      idempotency_key
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

    // Get token history
    const history = await prisma.tokenLedgerEntry.findMany({
      where: { appUserId: appUser.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      external_id: externalId,
      current_balance: appUser.tokenBalance,
      transactions: history.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        balance_after: entry.balanceAfter,
        type: entry.type.toLowerCase(),
        description: entry.description,
        job_id: entry.jobId,
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



