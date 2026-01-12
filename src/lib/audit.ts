import { prisma } from "@/lib/db";
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
  // System actions
  | "system.settings_updated";

export type EntityType =
  | "App"
  | "AIModel"
  | "AIProvider"
  | "AppUser"
  | "GenerationJob"
  | "ModelProviderConfig"
  | "System";

export type ActorType = "admin" | "api" | "system";

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
        metadata: input.metadata ?? null,
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
 * Query audit logs with filters.
 */
export async function getAuditLogs(options: {
  entityType?: EntityType;
  entityId?: string;
  actorId?: string;
  action?: string;
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
