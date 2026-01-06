import { prisma } from "@/lib/db";
import { TokenEntryType, Prisma } from "@prisma/client";

/**
 * Token Ledger System
 * 
 * Implements atomic, idempotent token operations using PostgreSQL transactions.
 * All token changes MUST go through these functions to maintain consistency.
 * 
 * Adapted for multi-tenant AppUser model (tokens stored directly on AppUser).
 */

export interface TokenOperationResult {
  success: boolean;
  balance: number;
  transactionId?: string;
  error?: string;
}

/**
 * Calculate expiration date based on app's tokenExpirationDays setting.
 * Returns null if no expiration is set.
 */
export function calculateExpirationDate(tokenExpirationDays: number | null): Date | null {
  if (tokenExpirationDays === null || tokenExpirationDays <= 0) {
    return null;
  }
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + tokenExpirationDays);
  return expiresAt;
}

/**
 * Calculate effective token balance considering expired tokens.
 * 
 * Logic:
 * - Sum all valid (non-expired) positive entries (grants)
 * - Sum all negative entries (debits) - these always count
 * - Effective balance = valid grants + debits
 * 
 * Note: This may result in a balance lower than the raw tokenBalance
 * stored on the user, as some grants may have expired.
 */
export async function getEffectiveTokenBalance(appUserId: string): Promise<{
  rawBalance: number;
  effectiveBalance: number;
  expiredTokens: number;
}> {
  const now = new Date();
  
  // Get raw balance from user
  const appUser = await prisma.appUser.findUnique({
    where: { id: appUserId },
  });
  
  if (!appUser) {
    return { rawBalance: 0, effectiveBalance: 0, expiredTokens: 0 };
  }
  
  // Sum of all valid grants (positive amounts that haven't expired)
  const validGrantsResult = await prisma.tokenLedgerEntry.aggregate({
    where: {
      appUserId,
      amount: { gt: 0 },
      OR: [
        { expiresAt: null }, // Never expires
        { expiresAt: { gt: now } }, // Not yet expired
      ],
    },
    _sum: { amount: true },
  });
  
  // Sum of all expired grants
  const expiredGrantsResult = await prisma.tokenLedgerEntry.aggregate({
    where: {
      appUserId,
      amount: { gt: 0 },
      expiresAt: { lte: now }, // Has expired
    },
    _sum: { amount: true },
  });
  
  // Sum of all debits (negative amounts - always count)
  const debitsResult = await prisma.tokenLedgerEntry.aggregate({
    where: {
      appUserId,
      amount: { lt: 0 },
    },
    _sum: { amount: true },
  });
  
  const validGrants = validGrantsResult._sum.amount ?? 0;
  const expiredGrants = expiredGrantsResult._sum.amount ?? 0;
  const debits = debitsResult._sum.amount ?? 0; // This is negative
  
  const effectiveBalance = Math.max(0, validGrants + debits);
  
  return {
    rawBalance: appUser.tokenBalance,
    effectiveBalance,
    expiredTokens: expiredGrants,
  };
}

/**
 * Reserve tokens for a generation job.
 * Uses an idempotency key to prevent double-charging.
 */
export async function reserveTokens(
  appUserId: string,
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
      const appUser = await prisma.appUser.findUnique({
        where: { id: appUserId },
      });
      return {
        success: true,
        balance: appUser?.tokenBalance ?? 0,
        transactionId: existing.id,
      };
    }

    // Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Lock and get current balance
      const appUser = await tx.appUser.findUnique({
        where: { id: appUserId },
      });

      if (!appUser) {
        throw new Error("User not found");
      }

      if (appUser.tokenBalance < amount) {
        throw new Error("Insufficient tokens");
      }

      const newBalance = appUser.tokenBalance - amount;

      // Update balance
      await tx.appUser.update({
        where: { id: appUserId },
        data: { tokenBalance: newBalance },
      });

      // Create ledger entry
      const entry = await tx.tokenLedgerEntry.create({
        data: {
          appUserId,
          amount: -amount,
          balanceAfter: newBalance,
          type: TokenEntryType.GENERATION_DEBIT,
          description: description ?? "Generation token debit",
          jobId,
          idempotencyKey,
        },
      });

      return { balance: newBalance, transactionId: entry.id };
    });

    return { success: true, ...result };
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
  appUserId: string,
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
      const appUser = await prisma.appUser.findUnique({
        where: { id: appUserId },
      });
      return {
        success: true,
        balance: appUser?.tokenBalance ?? 0,
        transactionId: existing.id,
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const appUser = await tx.appUser.findUnique({
        where: { id: appUserId },
      });

      if (!appUser) {
        throw new Error("User not found");
      }

      const newBalance = appUser.tokenBalance + amount;

      await tx.appUser.update({
        where: { id: appUserId },
        data: { tokenBalance: newBalance },
      });

      const entry = await tx.tokenLedgerEntry.create({
        data: {
          appUserId,
          amount: amount,
          balanceAfter: newBalance,
          type: TokenEntryType.GENERATION_REFUND,
          description: description ?? "Generation refund",
          jobId,
          idempotencyKey,
        },
      });

      return { balance: newBalance, transactionId: entry.id };
    });

    return { success: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, balance: 0, error: message };
  }
}

/**
 * Grant tokens to a user (from app or admin).
 * Uses an optional idempotency key to prevent double-granting.
 * 
 * @param expiresAt - Optional expiration date for these tokens
 */
export async function grantTokens(
  appUserId: string,
  amount: number,
  reason: string,
  idempotencyKey?: string,
  expiresAt?: Date | null
): Promise<TokenOperationResult> {
  const key = idempotencyKey ?? `grant_${appUserId}_${Date.now()}`;

  try {
    // Check if already processed
    const existing = await prisma.tokenLedgerEntry.findUnique({
      where: { idempotencyKey: key },
    });

    if (existing) {
      const appUser = await prisma.appUser.findUnique({
        where: { id: appUserId },
      });
      return {
        success: true,
        balance: appUser?.tokenBalance ?? 0,
        transactionId: existing.id,
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const appUser = await tx.appUser.findUnique({
        where: { id: appUserId },
      });

      if (!appUser) {
        throw new Error("User not found");
      }

      const newBalance = appUser.tokenBalance + amount;

      await tx.appUser.update({
        where: { id: appUserId },
        data: { tokenBalance: newBalance },
      });

      const entry = await tx.tokenLedgerEntry.create({
        data: {
          appUserId,
          amount,
          balanceAfter: newBalance,
          type: TokenEntryType.GRANT,
          description: reason,
          idempotencyKey: key,
          expiresAt: expiresAt ?? null,
        },
      });

      return { balance: newBalance, transactionId: entry.id };
    });

    return { success: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, balance: 0, error: message };
  }
}

/**
 * Admin adjustment of token balance.
 * 
 * @param expiresAt - Optional expiration date for positive adjustments
 */
export async function adminAdjustTokens(
  appUserId: string,
  amount: number,
  adminId: string,
  reason: string,
  expiresAt?: Date | null
): Promise<TokenOperationResult> {
  const idempotencyKey = `admin_${adminId}_${Date.now()}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const appUser = await tx.appUser.findUnique({
        where: { id: appUserId },
      });

      if (!appUser) {
        throw new Error("User not found");
      }

      const newBalance = appUser.tokenBalance + amount;

      if (newBalance < 0) {
        throw new Error("Cannot reduce balance below zero");
      }

      await tx.appUser.update({
        where: { id: appUserId },
        data: { tokenBalance: newBalance },
      });

      const entry = await tx.tokenLedgerEntry.create({
        data: {
          appUserId,
          amount,
          balanceAfter: newBalance,
          type: TokenEntryType.ADMIN_ADJUSTMENT,
          description: `Admin adjustment: ${reason}`,
          idempotencyKey,
          // Only set expiration for positive amounts (grants)
          expiresAt: amount > 0 ? (expiresAt ?? null) : null,
        },
      });

      return { balance: newBalance, transactionId: entry.id };
    });

    return { success: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, balance: 0, error: message };
  }
}

/**
 * Get user's current token balance.
 */
export async function getTokenBalance(appUserId: string): Promise<number> {
  const appUser = await prisma.appUser.findUnique({
    where: { id: appUserId },
  });
  return appUser?.tokenBalance ?? 0;
}

/**
 * Get user's token history.
 */
export async function getTokenHistory(appUserId: string, limit = 50) {
  return prisma.tokenLedgerEntry.findMany({
    where: { appUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Adjust tokens from RevenueCat webhook.
 * Uses an idempotency key based on the RevenueCat event ID.
 * 
 * @param expiresAt - Optional expiration date for positive adjustments
 */
export async function revenueCatAdjustTokens(
  appUserId: string,
  amount: number,
  revenueCatEventId: string,
  description: string,
  expiresAt?: Date | null
): Promise<TokenOperationResult> {
  const idempotencyKey = `rc_token_${revenueCatEventId}`;

  try {
    // Check if already processed
    const existing = await prisma.tokenLedgerEntry.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      const appUser = await prisma.appUser.findUnique({
        where: { id: appUserId },
      });
      return {
        success: true,
        balance: appUser?.tokenBalance ?? 0,
        transactionId: existing.id,
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const appUser = await tx.appUser.findUnique({
        where: { id: appUserId },
      });

      if (!appUser) {
        throw new Error("User not found");
      }

      const newBalance = Math.max(0, appUser.tokenBalance + amount);

      await tx.appUser.update({
        where: { id: appUserId },
        data: { tokenBalance: newBalance },
      });

      const entry = await tx.tokenLedgerEntry.create({
        data: {
          appUserId,
          amount,
          balanceAfter: newBalance,
          type: amount > 0 ? TokenEntryType.REVENUECAT_GRANT : TokenEntryType.REVENUECAT_REFUND,
          description,
          idempotencyKey,
          // Only set expiration for positive amounts (grants)
          expiresAt: amount > 0 ? (expiresAt ?? null) : null,
        },
      });

      return { balance: newBalance, transactionId: entry.id };
    });

    return { success: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, balance: 0, error: message };
  }
}
