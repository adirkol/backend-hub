import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

/**
 * Audit Logging System
 * 
 * Records admin actions for compliance and debugging.
 * All admin mutations should be logged through this system.
 */

export type AuditAction =
  // App actions
  | "app.created"
  | "app.updated"
  | "app.deleted"
  | "app.api_key_regenerated"
  | "app.users_deleted"
  // Model actions
  | "model.created"
  | "model.updated"
  | "model.deleted"
  // Provider actions
  | "provider.created"
  | "provider.updated"
  | "provider.deleted"
  | "provider.config_updated"
  // User actions
  | "user.tokens_adjusted"
  | "user.status_changed"
  | "user.deleted"
  // Job actions
  | "job.cancelled"
  | "job.retried"
  // RevenueCat webhook events
  | "revenuecat.initial_purchase"
  | "revenuecat.renewal"
  | "revenuecat.non_renewing_purchase"
  | "revenuecat.cancellation"
  | "revenuecat.token_grant"
  | "revenuecat.token_deduction"
  | "revenuecat.user_created"
  // System actions
  | "system.settings_updated"
  | "system.backup_exported"
  | "system.backup_imported";

export type EntityType =
  | "App"
  | "AIModel"
  | "AIProvider"
  | "AppUser"
  | "GenerationJob"
  | "ModelProviderConfig"
  | "RevenueCatEvent"
  | "System";

export type ActorType = "admin" | "api" | "system" | "revenuecat";

export interface AuditLogInput {
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  actorType: ActorType;
  actorId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Create an audit log entry.
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    // Log but don't throw - audit logging should not break main operations
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Get the client IP address from a request.
 */
export function getClientIp(req: NextRequest): string | undefined {
  // Try various headers that might contain the real IP
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback - this might not be available in all environments
  return undefined;
}

/**
 * Helper to create audit log with admin session info.
 * Automatically extracts admin ID from session and IP from request.
 */
export async function auditAdminAction(
  req: NextRequest,
  action: AuditAction,
  entityType: EntityType,
  entityId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const session = await getServerSession(authOptions);
  const adminId = session?.user?.id;
  const ipAddress = getClientIp(req);

  await createAuditLog({
    action,
    entityType,
    entityId,
    actorType: "admin",
    actorId: adminId,
    metadata,
    ipAddress,
  });
}

/**
 * Helper to create audit log for API actions (from iOS apps).
 */
export async function auditApiAction(
  req: NextRequest,
  action: AuditAction,
  entityType: EntityType,
  entityId: string,
  appId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const ipAddress = getClientIp(req);

  await createAuditLog({
    action,
    entityType,
    entityId,
    actorType: "api",
    actorId: appId,
    metadata,
    ipAddress,
  });
}

/**
 * Helper to create audit log for system actions.
 */
export async function auditSystemAction(
  action: AuditAction,
  entityType: EntityType,
  entityId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await createAuditLog({
    action,
    entityType,
    entityId,
    actorType: "system",
    metadata,
  });
}

/**
 * Helper to create audit log for RevenueCat webhook events.
 * Captures comprehensive event details for monitoring and debugging.
 */
export async function auditRevenueCatEvent(
  action: AuditAction,
  entityId: string,
  metadata: {
    // Event identification
    revenueCatEventId: string;
    eventType: string;
    eventCategory: string;
    eventTimestamp: Date;
    
    // App info
    appId: string;
    appName: string;
    revenueCatAppId: string;
    
    // User info
    appUserId: string;
    userExternalId: string;
    userCreatedByWebhook?: boolean;
    
    // Transaction details
    transactionId?: string | null;
    originalTransactionId?: string | null;
    productId?: string | null;
    store?: string | null;
    environment?: string;
    
    // Token details (for virtual currency events)
    tokenAmount?: number | null;
    tokenCurrencyCode?: string | null;
    tokenSource?: string | null;
    newTokenBalance?: number;
    
    // Revenue details (for purchase events)
    priceUsd?: number | null;
    currency?: string | null;
    taxPercentage?: number | null;
    commissionPercentage?: number | null;
    netRevenueUsd?: number | null;
    
    // Subscription details
    renewalNumber?: number | null;
    isTrialConversion?: boolean | null;
    offerCode?: string | null;
    countryCode?: string | null;
    purchasedAt?: Date | null;
    expiresAt?: Date | null;
    
    // Cancellation details
    cancelReason?: string | null;
  }
): Promise<void> {
  await createAuditLog({
    action,
    entityType: "RevenueCatEvent",
    entityId,
    actorType: "revenuecat",
    actorId: metadata.revenueCatAppId,
    metadata: {
      // Clean up null values for cleaner logs
      ...Object.fromEntries(
        Object.entries(metadata).filter(([, v]) => v !== null && v !== undefined)
      ),
    },
  });
}

/**
 * Query audit logs with filters.
 */
export async function getAuditLogs(options: {
  entityType?: EntityType;
  entityId?: string;
  actorId?: string;
  action?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {};

  if (options.entityType) where.entityType = options.entityType;
  if (options.entityId) where.entityId = options.entityId;
  if (options.actorId) where.actorId = options.actorId;
  if (options.action) where.action = { contains: options.action };

  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) (where.createdAt as Record<string, Date>).gte = options.startDate;
    if (options.endDate) (where.createdAt as Record<string, Date>).lte = options.endDate;
  }

  // Search across entity_id, actor_id, and metadata (for user IDs)
  if (options.search) {
    where.OR = [
      { entityId: { contains: options.search, mode: "insensitive" } },
      { actorId: { contains: options.search, mode: "insensitive" } },
      // Search in metadata JSON - looking for user IDs, external IDs, etc.
      { metadata: { path: ["userExternalId"], string_contains: options.search } },
      { metadata: { path: ["revenueCatUserId"], string_contains: options.search } },
      { metadata: { path: ["userId"], string_contains: options.search } },
      { metadata: { path: ["externalId"], string_contains: options.search } },
      { metadata: { path: ["appUserId"], string_contains: options.search } },
      { metadata: { path: ["appName"], string_contains: options.search } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}
