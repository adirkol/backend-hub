import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { refundTokens, getEffectiveTokenBalance } from "@/lib/tokens";

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

/**
 * Cancel a job
 * 
 * Only the user who created the job can cancel it.
 * Only jobs in QUEUED status can be cancelled.
 * Tokens are refunded upon successful cancellation.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request - require user
    const auth = await validateApiRequest(req, { requireUser: true });
    if (!auth.success || !auth.app || !auth.appUser) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: jobId } = await params;

    // Find job
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      include: {
        appUser: {
          select: {
            id: true,
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

    // Verify job belongs to this user (only owner can cancel)
    if (job.appUser.id !== auth.appUser.id) {
      return NextResponse.json(
        { error: "You can only cancel your own jobs" },
        { status: 403 }
      );
    }

    // Only allow cancellation of QUEUED jobs
    if (job.status !== "QUEUED") {
      const statusMessages: Record<string, string> = {
        RUNNING: "Job is already running and cannot be cancelled",
        SUCCEEDED: "Job has already completed successfully",
        FAILED: "Job has already failed",
        CANCELLED: "Job has already been cancelled",
      };
      return NextResponse.json(
        { 
          error: statusMessages[job.status] || "Job cannot be cancelled",
          current_status: job.status.toLowerCase(),
        },
        { status: 409 } // Conflict
      );
    }

    // Update job status to CANCELLED
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });

    // Refund tokens if they were charged
    let tokensRefunded = 0;
    if (job.tokensCharged && !job.tokensRefunded) {
      const refundResult = await refundTokens(
        job.appUserId,
        job.tokenCost,
        jobId,
        "Job cancelled by user"
      );

      if (refundResult.success) {
        tokensRefunded = job.tokenCost;
        
        // Mark job as refunded
        await prisma.generationJob.update({
          where: { id: jobId },
          data: { tokensRefunded: true },
        });
      }
    }

    // Get updated balance
    const { effectiveBalance } = await getEffectiveTokenBalance(auth.appUser.id);

    return NextResponse.json({
      job_id: jobId,
      status: "cancelled",
      tokens_refunded: tokensRefunded,
      user_balance: effectiveBalance,
      cancelled_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cancel job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
