import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

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
  };
  appUser?: {
    id: string;
    externalId: string;
    tokenBalance: number;
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
      appUser = await prisma.appUser.create({
        data: {
          appId: app.id,
          externalId: externalUserId,
          tokenBalance: app.defaultTokenGrant,
        },
      });

      // Log initial token grant if any
      if (app.defaultTokenGrant > 0) {
        await prisma.tokenLedgerEntry.create({
          data: {
            appUserId: appUser.id,
            amount: app.defaultTokenGrant,
            balanceAfter: app.defaultTokenGrant,
            type: "GRANT",
            description: "Welcome tokens",
            idempotencyKey: `welcome_${appUser.id}`,
          },
        });
      }
    }

    if (!appUser.isActive) {
      return { success: false, error: "User is deactivated" };
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
      },
      appUser: {
        id: appUser.id,
        externalId: appUser.externalId,
        tokenBalance: appUser.tokenBalance,
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
    },
  };
}


