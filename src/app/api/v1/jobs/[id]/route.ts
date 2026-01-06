import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request (user not required for job status check)
    const auth = await validateApiRequest(req);
    if (!auth.success || !auth.app) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: jobId } = await params;

    // Find job
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      include: {
        aiModel: {
          select: {
            name: true,
            displayName: true,
          },
        },
        appUser: {
          select: {
            externalId: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Verify job belongs to this app
    if (job.appId !== auth.app.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Build response
    const response: Record<string, unknown> = {
      job_id: job.id,
      status: job.status.toLowerCase(),
      model: job.aiModel.name,
      user_id: job.appUser.externalId,
      tokens_charged: job.tokenCost,
      created_at: job.createdAt.toISOString(),
    };

    // Add timing info if available
    if (job.startedAt) {
      response.started_at = job.startedAt.toISOString();
    }
    if (job.completedAt) {
      response.completed_at = job.completedAt.toISOString();
    }

    // Add outputs for succeeded jobs
    if (job.status === "SUCCEEDED" && job.outputs) {
      response.outputs = job.outputs;
      response.provider_used = job.usedProvider;
    }

    // Add error info for failed jobs
    if (job.status === "FAILED") {
      response.error = job.errorMessage;
      response.error_code = job.errorCode;
      response.tokens_refunded = job.tokensRefunded;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



