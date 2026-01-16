import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { TokenEntryType, RevenueCatEventType, EventCategory } from "@prisma/client";
import { calculateExpirationDate } from "@/lib/tokens";
import { auditRevenueCatEvent, AuditAction, logError } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ appId: string }>;
}

// ALL supported event types - we store everything
const ALL_EVENT_TYPES = [
  "VIRTUAL_CURRENCY_TRANSACTION",
  "INITIAL_PURCHASE",
  "RENEWAL",
  "NON_RENEWING_PURCHASE",
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "SUBSCRIPTION_PAUSED",
  "SUBSCRIPTION_EXTENDED",
  "TRANSFER",
  "INVOICE_ISSUANCE",
  "TEMPORARY_ENTITLEMENT_GRANT",
  "EXPERIMENT_ENROLLMENT",
  "TEST",
] as const;

// Event type to category mapping
const EVENT_CATEGORY_MAP: Record<string, EventCategory> = {
  VIRTUAL_CURRENCY_TRANSACTION: "TOKEN",
  INITIAL_PURCHASE: "REVENUE",
  RENEWAL: "REVENUE",
  NON_RENEWING_PURCHASE: "REVENUE",
  CANCELLATION: "STATUS",
  EXPIRATION: "STATUS",
  BILLING_ISSUE: "STATUS",
  PRODUCT_CHANGE: "STATUS",
  UNCANCELLATION: "STATUS",
  SUBSCRIPTION_PAUSED: "STATUS",
  SUBSCRIPTION_EXTENDED: "STATUS",
  TRANSFER: "OTHER",
  INVOICE_ISSUANCE: "OTHER",
  TEMPORARY_ENTITLEMENT_GRANT: "OTHER",
  EXPERIMENT_ENROLLMENT: "EXPERIMENT",
  TEST: "OTHER",
};

// Cancellation reasons that indicate a refund
const REFUND_CANCEL_REASONS = ["CUSTOMER_SUPPORT"];

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
  cancel_reason: z.string().optional(),
});

// Expiration event
const ExpirationEventSchema = PurchaseEventSchema.extend({
  expiration_reason: z.string().optional(),
});

// Product change event
const ProductChangeEventSchema = PurchaseEventSchema.extend({
  new_product_id: z.string().optional(),
});

// Transfer event
const TransferEventSchema = BaseEventSchema.extend({
  transferred_from: z.array(z.string()).optional(),
  transferred_to: z.array(z.string()).optional(),
});

// Experiment enrollment event
const ExperimentEnrollmentEventSchema = BaseEventSchema.extend({
  experiment_id: z.string().optional(),
  experiment_variant: z.string().optional(),
  enrolled_at_ms: z.number().optional(),
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
 * Update user subscription status based on event
 */
async function updateUserSubscriptionStatus(
  userId: string,
  eventType: string,
  eventData: {
    productId?: string | null;
    store?: string | null;
    expirationAtMs?: number | null;
    purchasedAtMs?: number | null;
    cancelReason?: string | null;
    newProductId?: string | null;
  }
) {
  const updates: Record<string, unknown> = {};

  switch (eventType) {
    case "INITIAL_PURCHASE":
      updates.isPremium = true;
      updates.subscriptionStatus = "ACTIVE";
      updates.subscriptionProductId = eventData.productId;
      updates.subscriptionStore = eventData.store;
      if (eventData.expirationAtMs) {
        updates.subscriptionExpiresAt = new Date(eventData.expirationAtMs);
      }
      if (eventData.purchasedAtMs) {
        updates.subscriptionStartedAt = new Date(eventData.purchasedAtMs);
      }
      break;

    case "RENEWAL":
      updates.isPremium = true;
      updates.subscriptionStatus = "ACTIVE";
      // Also set product/store - important for users recreated from RENEWAL event
      if (eventData.productId) {
        updates.subscriptionProductId = eventData.productId;
      }
      if (eventData.store) {
        updates.subscriptionStore = eventData.store;
      }
      if (eventData.expirationAtMs) {
        updates.subscriptionExpiresAt = new Date(eventData.expirationAtMs);
      }
      // Clear any billing issue
      updates.lastBillingIssueAt = null;
      break;

    case "NON_RENEWING_PURCHASE":
      // One-time purchase, doesn't necessarily mean premium
      // but we track the product and store
      if (eventData.productId) {
        updates.subscriptionProductId = eventData.productId;
      }
      if (eventData.store) {
        updates.subscriptionStore = eventData.store;
      }
      break;

    case "CANCELLATION":
      // Check if this is a refund (CUSTOMER_SUPPORT)
      if (eventData.cancelReason && REFUND_CANCEL_REASONS.includes(eventData.cancelReason)) {
        updates.subscriptionStatus = "REFUNDED";
        updates.lastRefundAt = new Date();
        // User loses premium immediately on refund
        updates.isPremium = false;
      } else {
        // Regular cancellation - user still has access until expiration
        updates.subscriptionStatus = "CANCELLED";
        // Don't change isPremium yet - they have access until expiration
      }
      break;

    case "EXPIRATION":
      updates.isPremium = false;
      updates.subscriptionStatus = "EXPIRED";
      break;

    case "BILLING_ISSUE":
      updates.subscriptionStatus = "BILLING_ISSUE";
      updates.lastBillingIssueAt = new Date();
      break;

    case "UNCANCELLATION":
      updates.subscriptionStatus = "ACTIVE";
      // Re-enable premium if they uncancelled
      updates.isPremium = true;
      break;

    case "SUBSCRIPTION_PAUSED":
      updates.subscriptionStatus = "PAUSED";
      break;

    case "SUBSCRIPTION_EXTENDED":
      updates.isPremium = true;
      updates.subscriptionStatus = "ACTIVE";
      if (eventData.expirationAtMs) {
        updates.subscriptionExpiresAt = new Date(eventData.expirationAtMs);
      }
      break;

    case "PRODUCT_CHANGE":
      if (eventData.newProductId) {
        updates.subscriptionProductId = eventData.newProductId;
      }
      break;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.appUser.update({
      where: { id: userId },
      data: updates,
    });
  }

  return updates;
}

/**
 * RevenueCat webhook handler
 * 
 * This endpoint receives ALL webhooks from RevenueCat and stores them.
 * It also updates user subscription status and processes token adjustments.
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

    // Check if this is a known event type
    if (!ALL_EVENT_TYPES.includes(eventType as typeof ALL_EVENT_TYPES[number])) {
      // Store unknown events but don't process them
      console.log(`RevenueCat webhook: Unknown event type: ${eventType}, storing anyway`);
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
    // Handle race condition: if two webhooks arrive simultaneously, one might fail with P2002
    let appUser;
    let userWasCreated = !existingUser;
    
    try {
      appUser = await prisma.appUser.upsert({
        where: {
          appId_externalId: {
            appId: app.id,
            externalId: revenueCatUserId,
          },
        },
        update: {},
        create: {
          appId: app.id,
          externalId: revenueCatUserId,
          tokenBalance: 0,
          needsTokenSync: true,
        },
      });
    } catch (upsertError) {
      // Handle race condition - if unique constraint failed, fetch the existing user
      if (
        upsertError instanceof Error && 
        upsertError.message.includes("Unique constraint failed")
      ) {
        console.log(`RevenueCat webhook: Race condition detected for user ${revenueCatUserId}, fetching existing user`);
        
        const existingUserFetch = await prisma.appUser.findUnique({
          where: {
            appId_externalId: {
              appId: app.id,
              externalId: revenueCatUserId,
            },
          },
        });
        
        if (!existingUserFetch) {
          // This shouldn't happen, but handle it gracefully
          throw new Error(`User ${revenueCatUserId} not found after race condition`);
        }
        
        appUser = existingUserFetch;
        userWasCreated = false; // User was created by the other concurrent request
      } else {
        // Re-throw other errors
        throw upsertError;
      }
    }

    if (userWasCreated) {
      console.log(`RevenueCat webhook: Created user ${revenueCatUserId} with needsTokenSync=true`);
      
      await auditRevenueCatEvent("revenuecat.user_created", appUser.id, {
        revenueCatEventId: event.id as string,
        eventType: eventType,
        eventCategory: EVENT_CATEGORY_MAP[eventType] || "OTHER",
        eventTimestamp: new Date(event.event_timestamp_ms as number),
        appId: app.id,
        appName: app.name,
        revenueCatAppId: appId,
        appUserId: appUser.id,
        userExternalId: revenueCatUserId,
        userCreatedByWebhook: true,
      });
    }

    // Initialize event data fields
    let tokenAmount: number | null = null;
    let tokenCurrencyCode: string | null = null;
    let source: string | null = null;
    let priceUsd: number | null = null;
    let taxPercentage: number | null = null;
    let commissionPercentage: number | null = null;
    let netRevenueUsd: number | null = null;
    let cancelReason: string | null = null;
    let expirationReason: string | null = null;
    let isRefund: boolean | null = null;
    let transactionId: string | null = null;
    let originalTransactionId: string | null = null;
    let purchasedAtMs: number | null = null;
    let expirationAtMs: number | null = null;
    let renewalNumber: number | null = null;
    let isTrialConversion: boolean | null = null;
    let offerCode: string | null = null;
    let countryCode: string | null = null;
    let newProductId: string | null = null;
    let transferredFrom: string[] | null = null;
    let transferredTo: string[] | null = null;
    let experimentId: string | null = null;
    let experimentVariant: string | null = null;
    let enrolledAtMs: number | null = null;

    // Process based on event type
    if (eventType === "VIRTUAL_CURRENCY_TRANSACTION") {
      const vcEvent = VirtualCurrencyEventSchema.parse(event);
      
      transactionId = vcEvent.virtual_currency_transaction_id || vcEvent.transaction_id || null;
      source = vcEvent.source || null;

      for (const adjustment of vcEvent.adjustments) {
        tokenAmount = (tokenAmount ?? 0) + adjustment.amount;
        tokenCurrencyCode = adjustment.currency.code;
      }

      // Apply token adjustment
      if (tokenAmount !== null && tokenAmount !== 0 && appUser) {
        const idempotencyKey = `rc_token_${eventId}`;
        
        const existingLedger = await prisma.tokenLedgerEntry.findUnique({
          where: { idempotencyKey },
        });

        if (!existingLedger) {
          const newBalance = appUser.tokenBalance + tokenAmount;
          const currentAppUser = appUser;
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

          appUser = { ...appUser, tokenBalance: Math.max(0, newBalance) };
        }
      }
    } else if (eventType === "CANCELLATION") {
      const cancelEvent = CancellationEventSchema.parse(event);
      
      transactionId = cancelEvent.transaction_id || null;
      originalTransactionId = cancelEvent.original_transaction_id || null;
      purchasedAtMs = cancelEvent.purchased_at_ms || null;
      expirationAtMs = cancelEvent.expiration_at_ms || null;
      cancelReason = cancelEvent.cancel_reason || null;
      countryCode = cancelEvent.country_code || null;
      
      // Check if this is a refund
      isRefund = cancelReason ? REFUND_CANCEL_REASONS.includes(cancelReason) : false;

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

      // Update subscription status
      await updateUserSubscriptionStatus(appUser.id, eventType, {
        cancelReason,
        expirationAtMs,
      });

    } else if (eventType === "EXPIRATION") {
      const expEvent = ExpirationEventSchema.parse(event);
      
      transactionId = expEvent.transaction_id || null;
      originalTransactionId = expEvent.original_transaction_id || null;
      purchasedAtMs = expEvent.purchased_at_ms || null;
      expirationAtMs = expEvent.expiration_at_ms || null;
      expirationReason = expEvent.expiration_reason || null;
      countryCode = expEvent.country_code || null;

      await updateUserSubscriptionStatus(appUser.id, eventType, {});

    } else if (eventType === "BILLING_ISSUE") {
      const billingEvent = PurchaseEventSchema.parse(event);
      
      transactionId = billingEvent.transaction_id || null;
      originalTransactionId = billingEvent.original_transaction_id || null;
      purchasedAtMs = billingEvent.purchased_at_ms || null;
      expirationAtMs = billingEvent.expiration_at_ms || null;
      countryCode = billingEvent.country_code || null;

      await updateUserSubscriptionStatus(appUser.id, eventType, {});

    } else if (eventType === "PRODUCT_CHANGE") {
      const productEvent = ProductChangeEventSchema.parse(event);
      
      transactionId = productEvent.transaction_id || null;
      originalTransactionId = productEvent.original_transaction_id || null;
      purchasedAtMs = productEvent.purchased_at_ms || null;
      expirationAtMs = productEvent.expiration_at_ms || null;
      countryCode = productEvent.country_code || null;
      newProductId = productEvent.new_product_id || null;

      await updateUserSubscriptionStatus(appUser.id, eventType, { newProductId });

    } else if (eventType === "UNCANCELLATION") {
      const uncancelEvent = PurchaseEventSchema.parse(event);
      
      transactionId = uncancelEvent.transaction_id || null;
      originalTransactionId = uncancelEvent.original_transaction_id || null;
      purchasedAtMs = uncancelEvent.purchased_at_ms || null;
      expirationAtMs = uncancelEvent.expiration_at_ms || null;
      countryCode = uncancelEvent.country_code || null;

      await updateUserSubscriptionStatus(appUser.id, eventType, {
        expirationAtMs,
      });

    } else if (eventType === "SUBSCRIPTION_PAUSED") {
      const pausedEvent = PurchaseEventSchema.parse(event);
      
      transactionId = pausedEvent.transaction_id || null;
      originalTransactionId = pausedEvent.original_transaction_id || null;
      purchasedAtMs = pausedEvent.purchased_at_ms || null;
      expirationAtMs = pausedEvent.expiration_at_ms || null;
      countryCode = pausedEvent.country_code || null;

      await updateUserSubscriptionStatus(appUser.id, eventType, {});

    } else if (eventType === "SUBSCRIPTION_EXTENDED") {
      const extendedEvent = PurchaseEventSchema.parse(event);
      
      transactionId = extendedEvent.transaction_id || null;
      originalTransactionId = extendedEvent.original_transaction_id || null;
      purchasedAtMs = extendedEvent.purchased_at_ms || null;
      expirationAtMs = extendedEvent.expiration_at_ms || null;
      countryCode = extendedEvent.country_code || null;

      await updateUserSubscriptionStatus(appUser.id, eventType, {
        expirationAtMs,
      });

    } else if (eventType === "TRANSFER") {
      const transferEvent = TransferEventSchema.parse(event);
      
      transferredFrom = transferEvent.transferred_from || null;
      transferredTo = transferEvent.transferred_to || null;

      // Handle user merge when subscription is transferred
      // The current user (app_user_id) is receiving the transfer
      // transferred_from contains the OLD user IDs that are being merged into this one
      if (transferredFrom && transferredFrom.length > 0) {
        // Get current previousUserIds or initialize empty array
        const currentPreviousIds = (appUser as { previousUserIds?: string[] }).previousUserIds || [];
        const newPreviousIds = [...new Set([...currentPreviousIds, ...transferredFrom])];

        // Find the old users and merge their data
        let totalTokensToTransfer = 0;
        let subscriptionToTransfer: {
          isPremium: boolean;
          subscriptionStatus: string | null;
          subscriptionProductId: string | null;
          subscriptionStore: string | null;
          subscriptionExpiresAt: Date | null;
          subscriptionStartedAt: Date | null;
        } | null = null;

        for (const oldExternalId of transferredFrom) {
          const oldUser = await prisma.appUser.findUnique({
            where: {
              appId_externalId: {
                appId: app.id,
                externalId: oldExternalId,
              },
            },
          });

          if (oldUser) {
            // Transfer token balance
            totalTokensToTransfer += oldUser.tokenBalance;

            // If old user has active subscription and new user doesn't, transfer it
            if (oldUser.isPremium && !subscriptionToTransfer) {
              subscriptionToTransfer = {
                isPremium: oldUser.isPremium,
                subscriptionStatus: oldUser.subscriptionStatus,
                subscriptionProductId: oldUser.subscriptionProductId,
                subscriptionStore: oldUser.subscriptionStore,
                subscriptionExpiresAt: oldUser.subscriptionExpiresAt,
                subscriptionStartedAt: oldUser.subscriptionStartedAt,
              };
            }

            // Mark old user as inactive and zero out their balance
            await prisma.appUser.update({
              where: { id: oldUser.id },
              data: {
                isActive: false,
                tokenBalance: 0,
                isPremium: false,
                subscriptionStatus: "TRANSFERRED",
              },
            });

            // Log the merge in the old user's audit trail
            await auditRevenueCatEvent("revenuecat.transfer", oldUser.id, {
              revenueCatEventId: event.id as string,
              eventType: "TRANSFER",
              eventCategory: "OTHER",
              eventTimestamp: new Date(event.event_timestamp_ms as number),
              appId: app.id,
              appName: app.name,
              revenueCatAppId: appId,
              appUserId: oldUser.id,
              userExternalId: oldExternalId,
              transferredFrom: [oldExternalId],
              transferredTo: [revenueCatUserId],
            });
          }
        }

        // Update new user with merged data
        const updateData: Record<string, unknown> = {
          previousUserIds: newPreviousIds,
        };

        // Add token balance from old users
        if (totalTokensToTransfer > 0) {
          updateData.tokenBalance = appUser.tokenBalance + totalTokensToTransfer;

          // Create a ledger entry for the transferred tokens
          await prisma.tokenLedgerEntry.create({
            data: {
              appUserId: appUser.id,
              amount: totalTokensToTransfer,
              balanceAfter: appUser.tokenBalance + totalTokensToTransfer,
              type: TokenEntryType.REVENUECAT_GRANT,
              description: `Transferred from previous user(s): ${transferredFrom.join(", ")}`,
              idempotencyKey: `transfer_${event.id as string}`,
            },
          });
        }

        // Transfer subscription if applicable
        if (subscriptionToTransfer && !appUser.isPremium) {
          updateData.isPremium = subscriptionToTransfer.isPremium;
          updateData.subscriptionStatus = subscriptionToTransfer.subscriptionStatus;
          updateData.subscriptionProductId = subscriptionToTransfer.subscriptionProductId;
          updateData.subscriptionStore = subscriptionToTransfer.subscriptionStore;
          updateData.subscriptionExpiresAt = subscriptionToTransfer.subscriptionExpiresAt;
          updateData.subscriptionStartedAt = subscriptionToTransfer.subscriptionStartedAt;
        }

        await prisma.appUser.update({
          where: { id: appUser.id },
          data: updateData,
        });

        // Update local appUser object for correct audit log
        appUser = { 
          ...appUser, 
          tokenBalance: appUser.tokenBalance + totalTokensToTransfer,
          ...(subscriptionToTransfer && !appUser.isPremium ? subscriptionToTransfer : {}),
        };

        console.log(`RevenueCat webhook: TRANSFER - Merged ${transferredFrom.length} user(s) into ${revenueCatUserId}. Transferred ${totalTokensToTransfer} tokens.`);
      }

    } else if (eventType === "EXPERIMENT_ENROLLMENT") {
      const expEvent = ExperimentEnrollmentEventSchema.parse(event);
      
      experimentId = expEvent.experiment_id || null;
      experimentVariant = expEvent.experiment_variant || null;
      enrolledAtMs = expEvent.enrolled_at_ms || null;

    } else if (["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"].includes(eventType)) {
      const purchaseEvent = PurchaseEventSchema.parse(event);
      
      transactionId = purchaseEvent.transaction_id || null;
      originalTransactionId = purchaseEvent.original_transaction_id || null;
      purchasedAtMs = purchaseEvent.purchased_at_ms || null;
      expirationAtMs = purchaseEvent.expiration_at_ms || null;
      renewalNumber = purchaseEvent.renewal_number ?? null;
      isTrialConversion = purchaseEvent.is_trial_conversion ?? null;
      offerCode = purchaseEvent.offer_code || null;
      countryCode = purchaseEvent.country_code || null;

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

      // Update subscription status
      await updateUserSubscriptionStatus(appUser.id, eventType, {
        productId: (event.product_id as string) || null,
        store: (event.store as string) || null,
        expirationAtMs,
        purchasedAtMs,
      });
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
        eventType: (ALL_EVENT_TYPES.includes(eventType as typeof ALL_EVENT_TYPES[number]) 
          ? eventType 
          : "TEST") as RevenueCatEventType,
        eventCategory: EVENT_CATEGORY_MAP[eventType] || "OTHER",
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
        expirationReason,
        isRefund,
        renewalNumber,
        isTrialConversion,
        offerCode,
        countryCode,
        newProductId,
        transferredFrom: transferredFrom || undefined,
        transferredTo: transferredTo || undefined,
        experimentId,
        experimentVariant,
        enrolledAtMs: enrolledAtMs ? BigInt(enrolledAtMs) : null,
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
        auditAction = isRefund ? "revenuecat.refund" : "revenuecat.cancellation";
        break;
      case "VIRTUAL_CURRENCY_TRANSACTION":
        auditAction = tokenAmount && tokenAmount > 0 
          ? "revenuecat.token_grant" 
          : "revenuecat.token_deduction";
        break;
      case "EXPIRATION":
        auditAction = "revenuecat.expiration";
        break;
      case "BILLING_ISSUE":
        auditAction = "revenuecat.billing_issue";
        break;
      case "PRODUCT_CHANGE":
        auditAction = "revenuecat.product_change";
        break;
      case "UNCANCELLATION":
        auditAction = "revenuecat.uncancellation";
        break;
      case "SUBSCRIPTION_PAUSED":
        auditAction = "revenuecat.subscription_paused";
        break;
      case "SUBSCRIPTION_EXTENDED":
        auditAction = "revenuecat.subscription_extended";
        break;
      case "TRANSFER":
        auditAction = "revenuecat.transfer";
        break;
      default:
        auditAction = "revenuecat.other";
    }

    // Create comprehensive audit log
    await auditRevenueCatEvent(auditAction, storedEvent.id, {
      revenueCatEventId: eventId,
      eventType,
      eventCategory: EVENT_CATEGORY_MAP[eventType] || "OTHER",
      eventTimestamp: new Date(event.event_timestamp_ms as number),
      appId: app.id,
      appName: app.name,
      revenueCatAppId: appId,
      appUserId: appUser.id,
      userExternalId: revenueCatUserId,
      userCreatedByWebhook: userWasCreated,
      transactionId,
      originalTransactionId,
      productId: (event.product_id as string) || null,
      store: (event.store as string) || null,
      environment: (event.environment as string) || "PRODUCTION",
      tokenAmount,
      tokenCurrencyCode,
      tokenSource: source,
      newTokenBalance: appUser.tokenBalance,
      priceUsd,
      taxPercentage,
      commissionPercentage,
      netRevenueUsd,
      renewalNumber,
      isTrialConversion,
      offerCode,
      countryCode,
      purchasedAt: purchasedAtMs ? new Date(purchasedAtMs) : null,
      expiresAt: expirationAtMs ? new Date(expirationAtMs) : null,
      cancelReason,
      expirationReason,
      isRefund,
      newProductId,
      transferredFrom,
      transferredTo,
      experimentId,
      experimentVariant,
    });

    // Collect any warnings about missing/incomplete data
    const warnings: string[] = [];
    
    // Check for missing important data based on event type
    if (["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"].includes(eventType)) {
      if (!event.product_id) warnings.push("Missing product_id");
      if (!event.store) warnings.push("Missing store");
      if (!priceUsd && priceUsd !== 0) warnings.push("Missing price");
    }
    
    if (eventType === "VIRTUAL_CURRENCY_TRANSACTION") {
      if (!tokenAmount && tokenAmount !== 0) warnings.push("Missing token amount");
    }

    // Log with details
    const logMessage = `RevenueCat webhook: Processed ${eventType} for user ${revenueCatUserId} in app ${app.name}`;
    if (warnings.length > 0) {
      console.warn(`${logMessage} [WARNINGS: ${warnings.join(", ")}]`);
    } else {
      console.log(logMessage);
    }

    // Return detailed response for debugging
    return NextResponse.json({ 
      success: true,
      processed: {
        eventType,
        eventId,
        userId: revenueCatUserId,
        appUserId: appUser.id,
        userCreated: userWasCreated,
        ...(tokenAmount !== null && { tokensAdjusted: tokenAmount }),
        ...(netRevenueUsd !== null && { netRevenue: netRevenueUsd }),
      },
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("RevenueCat webhook error:", error);
    
    // Log error to Audit Logs for debugging
    try {
      const body = await req.clone().json().catch(() => ({}));
      await logError("webhook", errorMessage, {
        endpoint: `/api/webhooks/revenuecat/${(await params).appId}`,
        method: "POST",
        requestBody: body,
        responseStatus: 200, // We return 200 to prevent RevenueCat from retrying
        stack: errorStack,
        source: "revenuecat",
        eventType: (body as Record<string, unknown>)?.event 
          ? ((body as Record<string, unknown>).event as Record<string, unknown>)?.type as string 
          : undefined,
        eventId: (body as Record<string, unknown>)?.event 
          ? ((body as Record<string, unknown>).event as Record<string, unknown>)?.id as string 
          : undefined,
      });
    } catch (logErr) {
      console.error("Failed to log error to audit:", logErr);
    }
    
    return NextResponse.json(
      { error: "Processing error", details: errorMessage },
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
    supportedEvents: ALL_EVENT_TYPES,
  });
}
