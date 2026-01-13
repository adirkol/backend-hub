import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { TokenEntryType, RevenueCatEventType, EventCategory } from "@prisma/client";
import { calculateExpirationDate } from "@/lib/tokens";
import { auditRevenueCatEvent, AuditAction } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ appId: string }>;
}

// Supported event types
const SUPPORTED_EVENT_TYPES = [
  "VIRTUAL_CURRENCY_TRANSACTION",
  "INITIAL_PURCHASE",
  "RENEWAL",
  "NON_RENEWING_PURCHASE",
  "CANCELLATION",
] as const;

// Event type to category mapping
const EVENT_CATEGORY_MAP: Record<string, EventCategory> = {
  VIRTUAL_CURRENCY_TRANSACTION: "TOKEN",
  INITIAL_PURCHASE: "REVENUE",
  RENEWAL: "REVENUE",
  NON_RENEWING_PURCHASE: "REVENUE",
  CANCELLATION: "REVENUE",
};

// Schema for virtual currency adjustment
const AdjustmentSchema = z.object({
  amount: z.number(),
  currency: z.object({
    code: z.string(),
    description: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
  }),
});

// Base event schema (common fields)
const BaseEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  app_id: z.string(),
  app_user_id: z.string(),
  event_timestamp_ms: z.number(),
  product_id: z.string().nullable().optional(),
  store: z.string().nullable().optional(),
  environment: z.string().optional().default("PRODUCTION"),
});

// Virtual currency transaction event
const VirtualCurrencyEventSchema = BaseEventSchema.extend({
  type: z.literal("VIRTUAL_CURRENCY_TRANSACTION"),
  adjustments: z.array(AdjustmentSchema).optional().default([]),
  source: z.string().optional(),
  virtual_currency_transaction_id: z.string().optional(),
  transaction_id: z.string().optional(),
});

// Purchase/subscription event (INITIAL_PURCHASE, RENEWAL, NON_RENEWING_PURCHASE)
const PurchaseEventSchema = BaseEventSchema.extend({
  price: z.number().optional(),
  price_in_purchased_currency: z.number().optional(),
  currency: z.string().optional(),
  tax_percentage: z.number().optional(),
  commission_percentage: z.number().optional(),
  transaction_id: z.string().optional(),
  original_transaction_id: z.string().optional(),
  purchased_at_ms: z.number().optional(),
  expiration_at_ms: z.number().nullable().optional(),
  renewal_number: z.number().nullable().optional(),
  is_trial_conversion: z.boolean().nullable().optional(),
  offer_code: z.string().nullable().optional(),
  country_code: z.string().optional(),
});

// Cancellation event
const CancellationEventSchema = PurchaseEventSchema.extend({
  type: z.literal("CANCELLATION"),
  cancel_reason: z.string().optional(),
});

// Main webhook payload schema
const WebhookPayloadSchema = z.object({
  api_version: z.string(),
  event: z.record(z.string(), z.unknown()),
});

/**
 * Calculate net revenue from price after tax and commission
 */
function calculateNetRevenue(
  price: number,
  taxPercentage: number | null | undefined,
  commissionPercentage: number | null | undefined
): number {
  const tax = taxPercentage ?? 0;
  const commission = commissionPercentage ?? 0;
  return price - (price * (tax + commission));
}

/**
 * RevenueCat webhook handler
 * 
 * This endpoint receives webhooks from RevenueCat for:
 * - VIRTUAL_CURRENCY_TRANSACTION: Token grants/deductions
 * - INITIAL_PURCHASE, RENEWAL, NON_RENEWING_PURCHASE: Revenue tracking
 * - CANCELLATION: Refund tracking
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { appId } = await params;

    // Find app by RevenueCat app ID
    const app = await prisma.app.findUnique({
      where: { revenueCatAppId: appId },
      select: { id: true, name: true, defaultTokenGrant: true, tokenExpirationDays: true },
    });

    if (!app) {
      console.error(`RevenueCat webhook: App not found for RC app_id: ${appId}`);
      return NextResponse.json(
        { error: "App not found" },
        { status: 404 }
      );
    }

    // Parse and validate webhook payload
    const body = await req.json();
    const payloadValidation = WebhookPayloadSchema.safeParse(body);

    if (!payloadValidation.success) {
      console.error("RevenueCat webhook: Invalid payload", payloadValidation.error);
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const { event } = payloadValidation.data;
    const eventType = event.type as string;

    // Check if we support this event type
    if (!SUPPORTED_EVENT_TYPES.includes(eventType as typeof SUPPORTED_EVENT_TYPES[number])) {
      // Log but accept - RevenueCat expects 200 for all events
      console.log(`RevenueCat webhook: Ignoring unsupported event type: ${eventType}`);
      return NextResponse.json({ success: true, ignored: true });
    }

    // Check for duplicate event (idempotency)
    const eventId = event.id as string;
    const existingEvent = await prisma.revenueCatEvent.findUnique({
      where: { revenueCatEventId: eventId },
    });

    if (existingEvent) {
      console.log(`RevenueCat webhook: Duplicate event ${eventId}, skipping`);
      return NextResponse.json({ success: true, duplicate: true });
    }

    // Get or create user using upsert to handle race conditions
    // (multiple webhooks for same user can arrive simultaneously)
    const revenueCatUserId = event.app_user_id as string;
    
    // Check if user existed before upsert
    const existingUser = await prisma.appUser.findUnique({
      where: {
        appId_externalId: {
          appId: app.id,
          externalId: revenueCatUserId,
        },
      },
      select: { id: true },
    });
    
    // Use upsert to atomically create or get user
    // Note: Users created from RevenueCat are OLD users who already had the app
    // before AI Hub was implemented. They should NOT get welcome tokens, as they
    // already received them client-side. Instead, we flag them for token sync.
    let appUser = await prisma.appUser.upsert({
      where: {
        appId_externalId: {
          appId: app.id,
          externalId: revenueCatUserId,
        },
      },
      update: {}, // Don't update anything if user exists
      create: {
        appId: app.id,
        externalId: revenueCatUserId,
        tokenBalance: 0, // No welcome tokens - user already had them client-side
        needsTokenSync: true, // Flag for token sync when app calls POST /api/v1/users
      },
    });
    
    const userWasCreated = !existingUser;

    if (userWasCreated) {
      console.log(`RevenueCat webhook: Created user ${revenueCatUserId} with needsTokenSync=true (old user)`);
      
      // Audit log for user creation via RevenueCat
      await auditRevenueCatEvent("revenuecat.user_created", appUser.id, {
        revenueCatEventId: event.id as string,
        eventType: eventType,
        eventCategory: EVENT_CATEGORY_MAP[eventType],
        eventTimestamp: new Date(event.event_timestamp_ms as number),
        appId: app.id,
        appName: app.name,
        revenueCatAppId: appId,
        appUserId: appUser.id,
        userExternalId: revenueCatUserId,
        userCreatedByWebhook: true,
      });
    }

    // Process based on event type
    let tokenAmount: number | null = null;
    let tokenCurrencyCode: string | null = null;
    let source: string | null = null;
    let priceUsd: number | null = null;
    let taxPercentage: number | null = null;
    let commissionPercentage: number | null = null;
    let netRevenueUsd: number | null = null;
    let cancelReason: string | null = null;
    let transactionId: string | null = null;
    let originalTransactionId: string | null = null;
    let purchasedAtMs: number | null = null;
    let expirationAtMs: number | null = null;
    let renewalNumber: number | null = null;
    let isTrialConversion: boolean | null = null;
    let offerCode: string | null = null;
    let countryCode: string | null = null;

    if (eventType === "VIRTUAL_CURRENCY_TRANSACTION") {
      // Handle token transaction
      const vcEvent = VirtualCurrencyEventSchema.parse(event);
      
      transactionId = vcEvent.virtual_currency_transaction_id || vcEvent.transaction_id || null;
      source = vcEvent.source || null;

      // Process all adjustments (usually just one)
      for (const adjustment of vcEvent.adjustments) {
        tokenAmount = (tokenAmount ?? 0) + adjustment.amount;
        tokenCurrencyCode = adjustment.currency.code;
      }

      // Apply token adjustment to user
      if (tokenAmount !== null && tokenAmount !== 0 && appUser) {
        const idempotencyKey = `rc_token_${eventId}`;
        
        // Check if already processed
        const existingLedger = await prisma.tokenLedgerEntry.findUnique({
          where: { idempotencyKey },
        });

        if (!existingLedger) {
          const newBalance = appUser.tokenBalance + tokenAmount;
          const currentAppUser = appUser; // Capture for closure
          // Only set expiration for positive token grants
          const tokenExpiresAt = tokenAmount > 0 ? calculateExpirationDate(app.tokenExpirationDays) : null;
          
          await prisma.$transaction(async (tx) => {
            await tx.appUser.update({
              where: { id: currentAppUser.id },
              data: { tokenBalance: Math.max(0, newBalance) },
            });

            await tx.tokenLedgerEntry.create({
              data: {
                appUserId: currentAppUser.id,
                amount: tokenAmount!,
                balanceAfter: Math.max(0, newBalance),
                type: tokenAmount! > 0 ? TokenEntryType.REVENUECAT_GRANT : TokenEntryType.REVENUECAT_REFUND,
                description: `RevenueCat: ${source || "token adjustment"} (${vcEvent.product_id || "unknown product"})`,
                idempotencyKey,
                expiresAt: tokenExpiresAt,
              },
            });
          });

          // Update local copy of balance
          appUser = { ...appUser, tokenBalance: Math.max(0, newBalance) };
        }
      }
    } else if (eventType === "CANCELLATION") {
      // Handle cancellation/refund
      const cancelEvent = CancellationEventSchema.parse(event);
      
      transactionId = cancelEvent.transaction_id || null;
      originalTransactionId = cancelEvent.original_transaction_id || null;
      purchasedAtMs = cancelEvent.purchased_at_ms || null;
      expirationAtMs = cancelEvent.expiration_at_ms || null;
      cancelReason = cancelEvent.cancel_reason || null;
      countryCode = cancelEvent.country_code || null;

      // Track refund amount (price will be negative for refunds)
      if (cancelEvent.price !== undefined) {
        priceUsd = cancelEvent.price;
        taxPercentage = cancelEvent.tax_percentage ?? null;
        commissionPercentage = cancelEvent.commission_percentage ?? null;
        netRevenueUsd = calculateNetRevenue(
          priceUsd,
          taxPercentage ?? undefined,
          commissionPercentage ?? undefined
        );
      }
    } else {
      // Handle purchase events (INITIAL_PURCHASE, RENEWAL, NON_RENEWING_PURCHASE)
      const purchaseEvent = PurchaseEventSchema.parse(event);
      
      transactionId = purchaseEvent.transaction_id || null;
      originalTransactionId = purchaseEvent.original_transaction_id || null;
      purchasedAtMs = purchaseEvent.purchased_at_ms || null;
      expirationAtMs = purchaseEvent.expiration_at_ms || null;
      renewalNumber = purchaseEvent.renewal_number ?? null;
      isTrialConversion = purchaseEvent.is_trial_conversion ?? null;
      offerCode = purchaseEvent.offer_code || null;
      countryCode = purchaseEvent.country_code || null;

      // Calculate revenue
      if (purchaseEvent.price !== undefined) {
        priceUsd = purchaseEvent.price;
        taxPercentage = purchaseEvent.tax_percentage ?? null;
        commissionPercentage = purchaseEvent.commission_percentage ?? null;
        netRevenueUsd = calculateNetRevenue(
          priceUsd,
          taxPercentage ?? undefined,
          commissionPercentage ?? undefined
        );
      }
    }

    // Store the event
    const storedEvent = await prisma.revenueCatEvent.create({
      data: {
        appId: app.id,
        appUserId: appUser.id,
        revenueCatEventId: eventId,
        revenueCatUserId,
        transactionId,
        originalTransactionId,
        eventType: eventType as RevenueCatEventType,
        eventCategory: EVENT_CATEGORY_MAP[eventType],
        eventTimestampMs: BigInt(event.event_timestamp_ms as number),
        purchasedAtMs: purchasedAtMs ? BigInt(purchasedAtMs) : null,
        expirationAtMs: expirationAtMs ? BigInt(expirationAtMs) : null,
        productId: (event.product_id as string) || null,
        store: (event.store as string) || null,
        environment: (event.environment as string) || "PRODUCTION",
        tokenAmount,
        tokenCurrencyCode,
        source,
        priceUsd,
        taxPercentage,
        commissionPercentage,
        netRevenueUsd,
        cancelReason,
        renewalNumber,
        isTrialConversion,
        offerCode,
        countryCode,
        rawPayload: body,
        processed: true,
      },
    });

    // Determine the audit action based on event type
    let auditAction: AuditAction;
    switch (eventType) {
      case "INITIAL_PURCHASE":
        auditAction = "revenuecat.initial_purchase";
        break;
      case "RENEWAL":
        auditAction = "revenuecat.renewal";
        break;
      case "NON_RENEWING_PURCHASE":
        auditAction = "revenuecat.non_renewing_purchase";
        break;
      case "CANCELLATION":
        auditAction = "revenuecat.cancellation";
        break;
      case "VIRTUAL_CURRENCY_TRANSACTION":
        auditAction = tokenAmount && tokenAmount > 0 
          ? "revenuecat.token_grant" 
          : "revenuecat.token_deduction";
        break;
      default:
        auditAction = "revenuecat.initial_purchase"; // Fallback
    }

    // Create comprehensive audit log
    await auditRevenueCatEvent(auditAction, storedEvent.id, {
      // Event identification
      revenueCatEventId: eventId,
      eventType,
      eventCategory: EVENT_CATEGORY_MAP[eventType],
      eventTimestamp: new Date(event.event_timestamp_ms as number),
      
      // App info
      appId: app.id,
      appName: app.name,
      revenueCatAppId: appId,
      
      // User info
      appUserId: appUser.id,
      userExternalId: revenueCatUserId,
      userCreatedByWebhook: userWasCreated,
      
      // Transaction details
      transactionId,
      originalTransactionId,
      productId: (event.product_id as string) || null,
      store: (event.store as string) || null,
      environment: (event.environment as string) || "PRODUCTION",
      
      // Token details
      tokenAmount,
      tokenCurrencyCode,
      tokenSource: source,
      newTokenBalance: appUser.tokenBalance,
      
      // Revenue details
      priceUsd,
      taxPercentage,
      commissionPercentage,
      netRevenueUsd,
      
      // Subscription details
      renewalNumber,
      isTrialConversion,
      offerCode,
      countryCode,
      purchasedAt: purchasedAtMs ? new Date(purchasedAtMs) : null,
      expiresAt: expirationAtMs ? new Date(expirationAtMs) : null,
      
      // Cancellation details
      cancelReason,
    });

    console.log(`RevenueCat webhook: Processed ${eventType} for user ${revenueCatUserId} in app ${app.name}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("RevenueCat webhook error:", error);
    
    // Return 200 to prevent RevenueCat from retrying (we log the error)
    // In production, you might want to return 500 for retries
    return NextResponse.json(
      { error: "Processing error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 200 }
    );
  }
}

// Health check for the webhook endpoint
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { appId } = await params;
  
  const app = await prisma.app.findUnique({
    where: { revenueCatAppId: appId },
    select: { id: true, name: true },
  });

  if (!app) {
    return NextResponse.json(
      { error: "App not found", appId },
      { status: 404 }
    );
  }

  return NextResponse.json({
    status: "ok",
    app: app.name,
    message: "RevenueCat webhook endpoint is ready",
  });
}

