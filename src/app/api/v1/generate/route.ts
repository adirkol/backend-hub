import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { reserveTokens } from "@/lib/tokens";
import { addGenerationJob } from "@/lib/queue";

const GenerateSchema = z.object({
  model: z.string().min(1),
  input: z
    .object({
      prompt: z.string().optional(),
      images: z.array(z.string().url()).optional(),
      aspect_ratio: z.string().optional().default("1:1"),
      num_outputs: z.number().int().min(1).max(4).optional().default(1),
    })
    .passthrough(), // Allow additional provider-specific params
  priority: z.number().int().min(1).max(100).optional(),
  webhook_url: z.string().url().optional(),
  idempotency_key: z.string().optional(),
  // If true, outputs will be uploaded to R2 storage for permanent URLs
  // Default: false (uses original provider URLs which may expire)
  store_outputs: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate request
    const auth = await validateApiRequest(req, { requireUser: true });
    if (!auth.success || !auth.app || !auth.appUser) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Parse and validate body
    const body = await req.json();
    const validation = GenerateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { model, input, priority, webhook_url, idempotency_key, store_outputs } =
      validation.data;

    // Check idempotency
    if (idempotency_key) {
      const existingJob = await prisma.generationJob.findFirst({
        where: {
          appId: auth.app.id,
          appUserId: auth.appUser.id,
          inputPayload: {
            path: ["idempotency_key"],
            equals: idempotency_key,
          },
        },
      });

      if (existingJob) {
        return NextResponse.json({
          job_id: existingJob.id,
          status: existingJob.status.toLowerCase(),
          message: "Duplicate request - returning existing job",
        });
      }
    }

    // Find AI model
    const aiModel = await prisma.aIModel.findFirst({
      where: {
        OR: [{ name: model }, { id: model }],
        isEnabled: true,
      },
    });

    if (!aiModel) {
      return NextResponse.json(
        { error: `Model not found: ${model}` },
        { status: 404 }
      );
    }

    // Check for per-app token cost override
    const appTokenOverride = await prisma.appModelTokenConfig.findUnique({
      where: {
        appId_modelId: {
          appId: auth.app.id,
          modelId: aiModel.id,
        },
      },
    });

    // Calculate token cost (use app override if exists, otherwise default)
    const numOutputs = input.num_outputs ?? 1;
    const baseTokenCost = appTokenOverride?.tokenCost ?? aiModel.tokenCost;
    const tokenCost = baseTokenCost * numOutputs;

    // Check balance
    if (auth.appUser.tokenBalance < tokenCost) {
      return NextResponse.json(
        {
          error: "Insufficient tokens",
          balance: auth.appUser.tokenBalance,
          required: tokenCost,
        },
        { status: 402 }
      );
    }

    // Create job record
    const job = await prisma.generationJob.create({
      data: {
        appId: auth.app.id,
        appUserId: auth.appUser.id,
        aiModelId: aiModel.id,
        inputPayload: { ...input, idempotency_key },
        tokenCost,
        priority: priority ?? 10,
        status: "QUEUED",
      },
    });

    // Reserve tokens
    const tokenResult = await reserveTokens(
      auth.appUser.id,
      tokenCost,
      job.id,
      `Generation: ${aiModel.displayName}`
    );

    if (!tokenResult.success) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: tokenResult.error,
          errorCode: "INSUFFICIENT_TOKENS",
        },
      });

      return NextResponse.json({ error: tokenResult.error }, { status: 402 });
    }

    // Mark tokens charged
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { tokensCharged: true },
    });

    // Add to queue
    await addGenerationJob(
      {
        jobId: job.id,
        appId: auth.app.id,
        appUserId: auth.appUser.id,
        aiModelId: aiModel.id,
        inputPayload: input,
        webhookUrl: webhook_url ?? auth.app.webhookUrl ?? undefined,
        webhookSecret: auth.app.webhookSecret ?? undefined,
        storeOutputs: store_outputs,
      },
      priority
    );

    return NextResponse.json(
      {
        job_id: job.id,
        status: "queued",
        model: aiModel.name,
        tokens_charged: tokenCost,
        user_balance: tokenResult.balance,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

