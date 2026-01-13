import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuditLogs } from "@/lib/audit";

/**
 * GET /api/admin/audit-logs
 * 
 * Query audit logs with optional filters and search.
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType") || undefined;
    const entityId = url.searchParams.get("entityId") || undefined;
    const actorId = url.searchParams.get("actorId") || undefined;
    const action = url.searchParams.get("action") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const result = await getAuditLogs({
      entityType: entityType as Parameters<typeof getAuditLogs>[0]["entityType"],
      entityId,
      actorId,
      action,
      search,
      limit,
      offset,
    });

    return NextResponse.json({
      logs: result.logs.map((log) => ({
        id: log.id,
        action: log.action,
        entity_type: log.entityType,
        entity_id: log.entityId,
        actor_type: log.actorType,
        actor_id: log.actorId,
        metadata: log.metadata,
        ip_address: log.ipAddress,
        created_at: log.createdAt.toISOString(),
      })),
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
