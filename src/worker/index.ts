import "dotenv/config";
import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { ProviderOrchestrator } from "../lib/providers";

/**
 * AI Backend Hub Worker
 * 
 * Processes generation jobs from the queue:
 * - Runs generation through provider orchestrator
 * - Stores outputs to R2
 * - Delivers webhooks on completion
 * - Refunds tokens on failure
 */

// Initialize clients
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// Check if R2 is configured
const isR2Configured = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME
);

// Only create R2 client if configured
const r2Client = isR2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

// Initialize provider orchestrator
const orchestrator = new ProviderOrchestrator(prisma);

// Job data types (matching queue.ts)
interface GenerationJobData {
  jobId: string;
  appId: string;
  appUserId: string;
  aiModelId: string;
  inputPayload: {
    prompt?: string;
    images?: string[];
    aspect_ratio?: string;
    num_outputs?: number;
    [key: string]: unknown;
  };
  webhookUrl?: string;
  webhookSecret?: string;
  /** If true, outputs will be uploaded to R2 for permanent storage */
  storeOutputs?: boolean;
}

interface GenerationJobResult {
  success: boolean;
  outputs?: string[];
  error?: string;
  usedProvider?: string;
}

/**
 * Upload buffer to R2 and return public URL
 */
async function uploadToR2(buffer: Buffer, key: string): Promise<string> {
  if (!r2Client) {
    throw new Error("R2 is not configured");
  }

  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
    })
  );

  const publicUrl = process.env.R2_PUBLIC_URL;
  return publicUrl ? `${publicUrl}/${key}` : key;
}

/**
 * Sign webhook payload with HMAC-SHA256
 */
function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Deliver webhook notification
 */
async function deliverWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
  secret?: string
): Promise<boolean> {
  try {
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Timestamp": timestamp.toString(),
    };

    // Sign payload if secret is provided
    if (secret) {
      const signature = signWebhookPayload(`${timestamp}.${body}`, secret);
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body,
    });

    if (response.ok) {
      console.log(`[Worker] Webhook delivered successfully to ${webhookUrl}`);
      return true;
    } else {
      console.error(`[Worker] Webhook delivery failed: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Worker] Webhook delivery error: ${message}`);
    return false;
  }
}

/**
 * Refund tokens for a failed job (idempotent)
 */
async function refundTokens(jobId: string, appUserId: string): Promise<void> {
  const dbJob = await prisma.generationJob.findUnique({
    where: { id: jobId },
  });

  if (dbJob && dbJob.tokensCharged && !dbJob.tokensRefunded) {
    const idempotencyKey = `refund_${jobId}`;

    // Check if refund already processed
    const existingRefund = await prisma.tokenLedgerEntry.findUnique({
      where: { idempotencyKey },
    });

    if (!existingRefund) {
      await prisma.$transaction(async (tx) => {
        const appUser = await tx.appUser.findUnique({
          where: { id: appUserId },
        });

        if (appUser) {
          const newBalance = appUser.tokenBalance + dbJob.tokenCost;

          await tx.appUser.update({
            where: { id: appUserId },
            data: { tokenBalance: newBalance },
          });

          await tx.tokenLedgerEntry.create({
            data: {
              appUserId,
              amount: dbJob.tokenCost,
              balanceAfter: newBalance,
              type: "GENERATION_REFUND",
              description: "Automatic refund for failed generation",
              jobId,
              idempotencyKey,
            },
          });

          await tx.generationJob.update({
            where: { id: jobId },
            data: { tokensRefunded: true },
          });
        }
      });

      console.log(`[Worker] Refunded ${dbJob.tokenCost} tokens for job ${jobId}`);
    }
  }
}

/**
 * Process and store outputs to R2 (or use original URLs if not requested/configured)
 * 
 * @param storeOutputs - If true, upload to R2. If false, use original provider URLs.
 * @returns Array of output strings (URLs for images, text for LLMs)
 */
async function processAndStoreOutputs(
  outputs: string[],
  appId: string,
  appUserId: string,
  jobId: string,
  job: Job,
  storeOutputs: boolean = false
): Promise<string[]> {
  const storedOutputs: string[] = [];

  // Use original URLs if:
  // 1. Client didn't request storage (storeOutputs = false), OR
  // 2. R2 is not configured
  if (!storeOutputs || !isR2Configured) {
    if (storeOutputs && !isR2Configured) {
      console.log(`[Worker] R2 not configured - falling back to original provider URLs`);
    } else {
      console.log(`[Worker] Using original provider URLs (store_outputs=false)`);
    }
    for (const output of outputs) {
      // Include URLs, base64 images, and text responses (for LLMs)
      storedOutputs.push(output);
    }
    await job.updateProgress(95);
    return storedOutputs;
  }

  // R2 is configured AND client requested storage - download and upload to R2
  console.log(`[Worker] Uploading outputs to R2 storage`);
  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i];
    console.log(`[Worker] Processing output ${i + 1}/${outputs.length}`);

    try {
      let storedUrl: string;

      if (output.startsWith("data:image/")) {
        // Handle base64 encoded images
        const base64Data = output.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");
        const key = `outputs/${appId}/${appUserId}/${jobId}-${i}.png`;
        storedUrl = await uploadToR2(buffer, key);
      } else if (output.startsWith("http")) {
        // Download from URL and upload to R2
        const response = await fetch(output);
        const buffer = Buffer.from(await response.arrayBuffer());
        const key = `outputs/${appId}/${appUserId}/${jobId}-${i}.png`;
        storedUrl = await uploadToR2(buffer, key);
      } else {
        // Text output (from LLMs) - store as-is
        storedOutputs.push(output);
        continue;
      }

      storedOutputs.push(storedUrl);
      await job.updateProgress(70 + ((i + 1) / outputs.length) * 25);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Worker] Failed to process output ${i}: ${message}`);
    }
  }

  return storedOutputs;
}

/**
 * Main job processor
 */
async function processGenerationJob(
  job: Job<GenerationJobData, GenerationJobResult>
): Promise<GenerationJobResult> {
  const {
    jobId,
    appId,
    appUserId,
    aiModelId,
    inputPayload,
    webhookUrl,
    webhookSecret,
    storeOutputs,
  } = job.data;

  console.log(`[Worker] Processing job ${jobId}`);
  console.log(`[Worker] App: ${appId}, User: ${appUserId}, Model: ${aiModelId}`);

  try {
    // Update job status to RUNNING
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    await job.updateProgress(10);

    // Extract inputs from payload
    const prompt = inputPayload.prompt || "";
    const imageUrls = inputPayload.images || [];
    const aspectRatio = inputPayload.aspect_ratio || "1:1";
    const numberOfOutputs = inputPayload.num_outputs || 1;

    // Remove known keys to get additional provider params
    const { prompt: _, images: __, aspect_ratio: ___, num_outputs: ____, ...providerParams } = inputPayload;

    console.log(`[Worker] Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`);
    console.log(`[Worker] Images: ${imageUrls.length}, Aspect: ${aspectRatio}, Outputs: ${numberOfOutputs}`);

    await job.updateProgress(20);

    // Run generation through orchestrator
    const result = await orchestrator.runGeneration({
      aiModelId,
      prompt,
      imageUrls,
      aspectRatio,
      numberOfOutputs,
      providerParams,
      jobId,
      appId,
      onProgress: (message, percent) => {
        console.log(`[Worker] ${message}`);
        if (percent) job.updateProgress(20 + percent * 0.5);
      },
    });

    await job.updateProgress(70);

    if (!result.success || !result.outputs || result.outputs.length === 0) {
      throw new Error(result.error || "Generation failed with no outputs");
    }

    console.log(`[Worker] Generation succeeded with ${result.outputs.length} outputs via ${result.usedProvider}`);

    // Process outputs (upload to R2 if requested, otherwise use provider URLs)
    const storedOutputs = await processAndStoreOutputs(
      result.outputs,
      appId,
      appUserId,
      jobId,
      job,
      storeOutputs ?? false
    );

    if (storedOutputs.length === 0) {
      throw new Error("Failed to store any outputs");
    }

    // Update job to SUCCEEDED
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        outputs: storedOutputs,
        usedProvider: result.usedProvider,
        attemptsCount: result.attemptsCount,
        completedAt: new Date(),
      },
    });

    // Deliver success webhook
    if (webhookUrl) {
      const appUser = await prisma.appUser.findUnique({
        where: { id: appUserId },
        select: { externalId: true },
      });

      const delivered = await deliverWebhook(
        webhookUrl,
        {
          event: "job.completed",
          job_id: jobId,
          status: "succeeded",
          user_id: appUser?.externalId,
          outputs: storedOutputs,
          tokens_charged: (await prisma.generationJob.findUnique({ where: { id: jobId } }))?.tokenCost,
          provider_used: result.usedProvider,
          completed_at: new Date().toISOString(),
        },
        webhookSecret
      );

      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          webhookDelivered: delivered,
          webhookAttempts: 1,
        },
      });
    }

    await job.updateProgress(100);
    console.log(`[Worker] Job ${jobId} completed with ${storedOutputs.length} outputs`);

    return {
      success: true,
      outputs: storedOutputs,
      usedProvider: result.usedProvider,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Worker] Job ${jobId} failed:`, errorMessage);

    // Update job to FAILED
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage,
        errorCode: "GENERATION_FAILED",
        completedAt: new Date(),
      },
    });

    // Refund tokens
    await refundTokens(jobId, appUserId);

    // Deliver failure webhook
    if (webhookUrl) {
      const appUser = await prisma.appUser.findUnique({
        where: { id: appUserId },
        select: { externalId: true },
      });

      const delivered = await deliverWebhook(
        webhookUrl,
        {
          event: "job.failed",
          job_id: jobId,
          status: "failed",
          user_id: appUser?.externalId,
          error: errorMessage,
          tokens_refunded: true,
          completed_at: new Date().toISOString(),
        },
        webhookSecret
      );

      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          webhookDelivered: delivered,
          webhookAttempts: 1,
        },
      });
    }

    throw error;
  }
}

// Create worker
const worker = new Worker<GenerationJobData, GenerationJobResult>(
  "ai-generation",
  processGenerationJob,
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 20,
      duration: 1000,
    },
  }
);

// Event handlers
worker.on("completed", (job, result) => {
  console.log(
    `✓ Job ${job.id} completed: ${result.outputs?.length ?? 0} outputs` +
      (result.usedProvider ? ` via ${result.usedProvider}` : "")
  );
});

worker.on("failed", (job, error) => {
  console.error(`✗ Job ${job?.id} failed:`, error.message);
});

worker.on("progress", (job, progress) => {
  if (typeof progress === "number") {
    console.log(`↻ Job ${job.id} progress: ${progress}%`);
  }
});

worker.on("error", (error) => {
  console.error("[Worker] Error:", error.message);
});

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down worker...");
  await worker.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("🚀 AI Backend Hub worker started");
console.log(`   Queue: ai-generation`);
console.log(`   Concurrency: 5`);
console.log(`   R2 Storage: ${isR2Configured ? `✓ ${process.env.R2_BUCKET_NAME}` : "✗ Not configured (using original URLs)"}`);

