import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { calculateExpirationDate, getEffectiveTokenBalance } from "@/lib/tokens";

export interface ApiAuthResult {
  success: boolean;
  app?: {
    id: string;
    name: string;
    slug: string;
    webhookUrl: string | null;
    webhookSecret: string | null;
    rateLimitPerUser: number;
    rateLimitPerApp: number;
    defaultTokenGrant: number;
    dailyTokenGrant: number;
    tokenExpirationDays: number | null;
  };
  appUser?: {
    id: string;
    externalId: string;
    tokenBalance: number;
    lastDailyGrantAt: Date | null;
  };
  error?: string;
}

/**
 * Validate API key and optionally resolve user
 */
export async function validateApiRequest(
  req: NextRequest,
  options: { requireUser?: boolean } = {}
): Promise<ApiAuthResult> {
  const apiKey = req.headers.get("X-API-Key");
  const externalUserId = req.headers.get("X-User-ID");

  if (!apiKey) {
    return { success: false, error: "Missing API key" };
  }

  // Find app by API key
  const app = await prisma.app.findUnique({
    where: { apiKey },
    select: {
      id: true,
      name: true,
      slug: true,
      isEnabled: true,
      webhookUrl: true,
      webhookSecret: true,
      rateLimitPerUser: true,
      rateLimitPerApp: true,
      defaultTokenGrant: true,
      dailyTokenGrant: true,
      tokenExpirationDays: true,
    },
  });

  if (!app) {
    return { success: false, error: "Invalid API key" };
  }

  if (!app.isEnabled) {
    return { success: false, error: "App is disabled" };
  }

  // If user ID required, find or create user
  if (options.requireUser) {
    if (!externalUserId) {
      return { success: false, error: "Missing X-User-ID header" };
    }

    // Find or create user
    let appUser = await prisma.appUser.findUnique({
      where: {
        appId_externalId: {
          appId: app.id,
          externalId: externalUserId,
        },
      },
    });

    if (!appUser) {
      // Create new user with default token grant
      // If default grant is given, set lastDailyGrantAt to prevent double-dipping on day 1
      const shouldSetDailyGrantTime = app.defaultTokenGrant > 0;
      
      appUser = await prisma.appUser.create({
        data: {
          appId: app.id,
          externalId: externalUserId,
          tokenBalance: app.defaultTokenGrant,
          lastDailyGrantAt: shouldSetDailyGrantTime ? new Date() : null,
        },
      });

      // Log initial token grant if any
      if (app.defaultTokenGrant > 0) {
        const expiresAt = calculateExpirationDate(app.tokenExpirationDays);
        await prisma.tokenLedgerEntry.create({
          data: {
            appUserId: appUser.id,
            amount: app.defaultTokenGrant,
            balanceAfter: app.defaultTokenGrant,
            type: "GRANT",
            description: "Welcome tokens",
            idempotencyKey: `welcome_${appUser.id}`,
            expiresAt,
          },
        });
      }
    }

    if (!appUser.isActive) {
      return { success: false, error: "User is deactivated" };
    }

    // Get effective balance (excludes expired tokens)
    const { effectiveBalance } = await getEffectiveTokenBalance(appUser.id);

    return {
      success: true,
      app: {
        id: app.id,
        name: app.name,
        slug: app.slug,
        webhookUrl: app.webhookUrl,
        webhookSecret: app.webhookSecret,
        rateLimitPerUser: app.rateLimitPerUser,
        rateLimitPerApp: app.rateLimitPerApp,
        defaultTokenGrant: app.defaultTokenGrant,
        dailyTokenGrant: app.dailyTokenGrant,
        tokenExpirationDays: app.tokenExpirationDays,
      },
      appUser: {
        id: appUser.id,
        externalId: appUser.externalId,
        tokenBalance: effectiveBalance,
        lastDailyGrantAt: appUser.lastDailyGrantAt,
      },
    };
  }

  return {
    success: true,
    app: {
      id: app.id,
      name: app.name,
      slug: app.slug,
      webhookUrl: app.webhookUrl,
      webhookSecret: app.webhookSecret,
      rateLimitPerUser: app.rateLimitPerUser,
      rateLimitPerApp: app.rateLimitPerApp,
      defaultTokenGrant: app.defaultTokenGrant,
      dailyTokenGrant: app.dailyTokenGrant,
      tokenExpirationDays: app.tokenExpirationDays,
    },
  };
}


