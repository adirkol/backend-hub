import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // Authenticate request
    const auth = await validateApiRequest(req, { requireUser: true });
    if (!auth.success || !auth.app || !auth.appUser) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status")?.toUpperCase();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const cursor = url.searchParams.get("cursor");

    // Build query
    const where: {
      appUserId: string;
      status?: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
      id?: { lt: string };
    } = {
      appUserId: auth.appUser.id,
    };

    // Filter by status if provided
    if (
      status &&
      ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"].includes(status)
    ) {
      where.status = status as typeof where.status;
    }

    // Cursor-based pagination
    if (cursor) {
      where.id = { lt: cursor };
    }

    const jobs = await prisma.generationJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1, // Fetch one extra to check if there's more
      include: {
        aiModel: {
          select: {
            name: true,
          },
        },
      },
    });

    // Check if there are more results
    const hasMore = jobs.length > limit;
    const results = hasMore ? jobs.slice(0, -1) : jobs;
    const nextCursor = hasMore ? results[results.length - 1]?.id : null;

    return NextResponse.json({
      jobs: results.map((job) => ({
        job_id: job.id,
        status: job.status.toLowerCase(),
        model: job.aiModel.name,
        tokens_charged: job.tokenCost,
        created_at: job.createdAt.toISOString(),
        completed_at: job.completedAt?.toISOString() ?? null,
        has_outputs: job.status === "SUCCEEDED" && job.outputs !== null,
      })),
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    console.error("List jobs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}




