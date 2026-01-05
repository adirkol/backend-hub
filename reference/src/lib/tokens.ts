import { prisma } from "@/lib/db";
import { TokenEntryType } from "@prisma/client";

/**
 * Token Ledger System
 * 
 * Implements atomic, idempotent token operations using PostgreSQL transactions.
 * All token changes MUST go through these functions to maintain consistency.
 */

export interface TokenOperationResult {
  success: boolean;
  balance: number;
  error?: string;
}

/**
 * Reserve tokens for a generation job.
 * Uses an idempotency key to prevent double-charging.
 */
export async function reserveTokens(
  userId: string,
  amount: number,
  jobId: string,
  description?: string
): Promise<TokenOperationResult> {
  const idempotencyKey = `reserve_${jobId}`;

  try {
    // Check if already processed
    const existing = await prisma.tokenLedgerEntry.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      // Already processed, return current balance
      const balance = await prisma.tokenBalance.findUnique({
        where: { userId },
      });
      return {
        success: true,
        balance: balance?.balance ?? 0,
      };
    }

    // Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Lock and get current balance
      const tokenBalance = await tx.tokenBalance.findUnique({
        where: { userId },
      });

      if (!tokenBalance) {
        throw new Error("Token balance not found");
      }

      if (tokenBalance.balance < amount) {
        throw new Error("Insufficient tokens");
      }

      const newBalance = tokenBalance.balance - amount;

      // Update balance
      await tx.tokenBalance.update({
        where: { userId },
        data: { balance: newBalance },
      });

      // Create ledger entry
      await tx.tokenLedgerEntry.create({
        data: {
          userId,
          amount: -amount,
          balanceAfter: newBalance,
          type: TokenEntryType.GENERATION_DEBIT,
          description: description ?? "Generation token debit",
          jobId,
          idempotencyKey,
        },
      });

      return newBalance;
    });

    return { success: true, balance: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, balance: 0, error: message };
  }
}

/**
 * Refund tokens for a failed generation.
 * Uses an idempotency key to prevent double-refunding.
 */
export async function refundTokens(
  userId: string,
  amount: number,
  jobId: string,
  description?: string
): Promise<TokenOperationResult> {
  const idempotencyKey = `refund_${jobId}`;

  try {
    // Check if already processed
    const existing = await prisma.tokenLedgerEntry.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      const balance = await prisma.tokenBalance.findUnique({
        where: { userId },
      });
      return { success: true, balance: balance?.balance ?? 0 };
    }

    const result = await prisma.$transaction(async (tx) => {
      const tokenBalance = await tx.tokenBalance.findUnique({
        where: { userId },
      });

      if (!tokenBalance) {
        throw new Error("Token balance not found");
      }

      const newBalance = tokenBalance.balance + amount;

      await tx.tokenBalance.update({
        where: { userId },
        data: { balance: newBalance },
      });

      await tx.tokenLedgerEntry.create({
        data: {
          userId,
          amount: amount,
          balanceAfter: newBalance,
          type: TokenEntryType.GENERATION_REFUND,
          description: description ?? "Generation refund",
          jobId,
          idempotencyKey,
        },
      });

      return newBalance;
    });

    return { success: true, balance: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, balance: 0, error: message };
  }
}

/**
 * Grant subscription tokens on renewal.
 * Uses billing period end date as idempotency key.
 */
export async function grantSubscriptionTokens(
  userId: string,
  amount: number,
  periodEnd: Date
): Promise<TokenOperationResult> {
  const idempotencyKey = `subscription_${userId}_${periodEnd.toISOString()}`;

  try {
    const existing = await prisma.tokenLedgerEntry.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      const balance = await prisma.tokenBalance.findUnique({
        where: { userId },
      });
      return { success: true, balance: balance?.balance ?? 0 };
    }

    const result = await prisma.$transaction(async (tx) => {
      const tokenBalance = await tx.tokenBalance.upsert({
        where: { userId },
        create: { userId, balance: amount },
        update: { balance: { increment: amount } },
      });

      await tx.tokenLedgerEntry.create({
        data: {
          userId,
          amount,
          balanceAfter: tokenBalance.balance,
          type: TokenEntryType.SUBSCRIPTION_GRANT,
          description: "Monthly subscription token grant",
          idempotencyKey,
        },
      });

      return tokenBalance.balance;
    });

    return { success: true, balance: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, balance: 0, error: message };
  }
}

/**
 * Admin adjustment of token balance.
 */
export async function adminAdjustTokens(
  userId: string,
  amount: number,
  adminId: string,
  reason: string
): Promise<TokenOperationResult> {
  const idempotencyKey = `admin_${adminId}_${Date.now()}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const tokenBalance = await tx.tokenBalance.findUnique({
        where: { userId },
      });

      if (!tokenBalance) {
        throw new Error("Token balance not found");
      }

      const newBalance = tokenBalance.balance + amount;

      if (newBalance < 0) {
        throw new Error("Cannot reduce balance below zero");
      }

      await tx.tokenBalance.update({
        where: { userId },
        data: { balance: newBalance },
      });

      await tx.tokenLedgerEntry.create({
        data: {
          userId,
          amount,
          balanceAfter: newBalance,
          type: TokenEntryType.ADMIN_ADJUSTMENT,
          description: `Admin adjustment: ${reason}`,
          idempotencyKey,
        },
      });

      return newBalance;
    });

    return { success: true, balance: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, balance: 0, error: message };
  }
}

/**
 * Get user's current token balance.
 */
export async function getTokenBalance(userId: string): Promise<number> {
  const balance = await prisma.tokenBalance.findUnique({
    where: { userId },
  });
  return balance?.balance ?? 0;
}

/**
 * Get user's token history.
 */
export async function getTokenHistory(
  userId: string,
  limit = 50
) {
  return prisma.tokenLedgerEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

