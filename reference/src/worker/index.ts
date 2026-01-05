import "dotenv/config";
import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ProviderOrchestrator, runLegacyGeneration } from "../lib/providers";

// Initialize clients
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Initialize provider orchestrator
const orchestrator = new ProviderOrchestrator(prisma);

interface GenerationJobData {
  jobId: string;
  userId: string;
  effectId: string;
  inputImageUrl: string; // Primary image (backward compatible)
  inputImageUrls?: string[]; // All input images for multi-image effects
  maskImageUrl?: string;
  userPrompt?: string;
  aspectRatio: string;
  numberOfOutputs: number;
  inputParams?: Record<string, unknown>;
  promptFieldMap?: Record<string, string>;
  // Legacy fields (used when aiModelId is not set)
  modelId: string;
  promptTemplate?: string;
  providerParams?: Record<string, unknown>;
}

interface GenerationJobResult {
  success: boolean;
  outputUrls?: string[];
  error?: string;
  usedProvider?: string;
}

async function uploadToR2(buffer: Buffer, key: string): Promise<string> {
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
 * Build the final prompt from template and user inputs
 */
function buildFinalPrompt(
  promptTemplate: string | null | undefined,
  userPrompt: string | undefined,
  promptFieldMap?: Record<string, string>,
  inputParams?: Record<string, unknown>
): string {
  if (!promptTemplate) {
    return userPrompt || "";
  }

  let finalPrompt = promptTemplate;

  // Replace {{user_prompt}} placeholder if present
  if (userPrompt && promptTemplate.includes("{{user_prompt}}")) {
    finalPrompt = finalPrompt.replace(/\{\{user_prompt\}\}/g, userPrompt);
  } else if (userPrompt) {
    finalPrompt = `${promptTemplate} ${userPrompt}`;
  }

  // Replace field placeholders from promptFieldMap (evaluated prompt text for each field)
  if (promptFieldMap && typeof promptFieldMap === "object") {
    for (const [key, value] of Object.entries(promptFieldMap)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      finalPrompt = finalPrompt.replace(placeholder, value || "");
    }
  }

  // Fallback: Replace remaining field placeholders from inputParams (raw values)
  if (inputParams && typeof inputParams === "object") {
    for (const [key, value] of Object.entries(inputParams)) {
      if (value !== undefined && value !== null) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        finalPrompt = finalPrompt.replace(placeholder, String(value));
      }
    }
  }

  // Remove any remaining unreplaced placeholders (clean up)
  finalPrompt = finalPrompt.replace(/\{\{[^}]+\}\}/g, "").replace(/\s+/g, " ").trim();

  return finalPrompt;
}

/**
 * Process outputs: download from provider and upload to R2
 */
async function processAndStoreOutputs(
  outputs: string[],
  userId: string,
  jobId: string,
  job: Job
): Promise<string[]> {
  const storedUrls: string[] = [];

  for (let i = 0; i < outputs.length; i++) {
    const outputUrl = outputs[i];
    console.log(`[Worker] Processing output ${i}: ${outputUrl}`);

    try {
      // Handle base64 encoded images
      if (outputUrl.startsWith("data:image/")) {
        const base64Data = outputUrl.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");
        const key = `outputs/${userId}/${jobId}-${i}.png`;
        const storedUrl = await uploadToR2(buffer, key);
        storedUrls.push(storedUrl);
      } else if (outputUrl.startsWith("http")) {
        // Download from URL
        const response = await fetch(outputUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        const key = `outputs/${userId}/${jobId}-${i}.png`;
        const storedUrl = await uploadToR2(buffer, key);
        storedUrls.push(storedUrl);
      } else {
        console.warn(`[Worker] Skipping invalid output URL: ${outputUrl}`);
        continue;
      }

      // Create output record
      await prisma.generationOutput.create({
        data: {
          jobId,
          imageUrl: storedUrls[storedUrls.length - 1],
          index: i,
        },
      });

      await job.updateProgress(70 + ((i + 1) / outputs.length) * 25);
    } catch (error) {
      console.error(`[Worker] Failed to process output ${i}:`, error);
    }
  }

  return storedUrls;
}

/**
 * Refund tokens for a failed job
 */
async function refundTokens(jobId: string, userId: string): Promise<void> {
  const dbJob = await prisma.generationJob.findUnique({
    where: { id: jobId },
  });

  if (dbJob && dbJob.tokensCharged && !dbJob.tokensRefunded) {
    const idempotencyKey = `refund_${jobId}`;

    const existingRefund = await prisma.tokenLedgerEntry.findUnique({
      where: { idempotencyKey },
    });

    if (!existingRefund) {
      await prisma.$transaction(async (tx) => {
        const balance = await tx.tokenBalance.findUnique({
          where: { userId },
        });

        if (balance) {
          const newBalance = balance.balance + dbJob.tokenCost;

          await tx.tokenBalance.update({
            where: { userId },
            data: { balance: newBalance },
          });

          await tx.tokenLedgerEntry.create({
            data: {
              userId,
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

async function processGenerationJob(
  job: Job<GenerationJobData, GenerationJobResult>
): Promise<GenerationJobResult> {
  const {
    jobId,
    userId,
    effectId,
    inputImageUrl,
    inputImageUrls,
    maskImageUrl,
    userPrompt,
    aspectRatio,
    numberOfOutputs,
    inputParams,
    promptFieldMap,
    modelId,
    promptTemplate,
    providerParams,
  } = job.data;

  console.log(`[Worker] Processing job ${jobId}`);
  console.log(`[Worker] Effect ID: ${effectId}`);

  try {
    // Validate inputImageUrl
    if (typeof inputImageUrl !== "string" || !inputImageUrl) {
      throw new Error(`Invalid inputImageUrl: expected string, got ${typeof inputImageUrl}`);
    }

    try {
      new URL(inputImageUrl);
    } catch {
      throw new Error(`Invalid URL format: ${inputImageUrl}`);
    }

    // Update job status to RUNNING
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    await job.updateProgress(10);

    // Fetch effect with AIModel configuration
    const effect = await prisma.effect.findUnique({
      where: { id: effectId },
      include: {
        aiModel: {
          include: {
            providerConfigs: {
              where: { isEnabled: true },
              orderBy: { priority: "asc" },
              include: { provider: true },
            },
          },
        },
      },
    });

    if (!effect) {
      throw new Error(`Effect not found: ${effectId}`);
    }

    // Build the final prompt
    const finalPrompt = buildFinalPrompt(
      effect.promptTemplate || promptTemplate,
      userPrompt,
      promptFieldMap,
      inputParams
    );

    console.log(`[Worker] Final prompt: ${finalPrompt}`);

    // Prepare image URLs - use inputImageUrls if available (multi-image), otherwise fall back to single inputImageUrl
    const imageUrls = inputImageUrls && inputImageUrls.length > 0 
      ? inputImageUrls 
      : [inputImageUrl];
    
    console.log(`[Worker] Using ${imageUrls.length} input image(s)`);
    
    if (maskImageUrl) {
      // Note: mask handling depends on the model/provider
    }

    await job.updateProgress(20);

    let result;

    // Check if effect has new aiModelId or uses legacy configuration
    if (effect.aiModelId && effect.aiModel) {
      console.log(`[Worker] Using multi-provider orchestrator with model: ${effect.aiModel.displayName}`);

      // Use the new provider orchestrator
      result = await orchestrator.runGeneration({
        aiModelId: effect.aiModelId,
        prompt: finalPrompt,
        imageUrls,
        aspectRatio,
        numberOfOutputs,
        providerParams: (effect.providerParams as Record<string, unknown>) || providerParams,
        jobId,
        onProgress: (message, percent) => {
          console.log(`[Worker] ${message}`);
          if (percent) job.updateProgress(20 + (percent * 0.5));
        },
      });
    } else {
      console.log(`[Worker] Using legacy provider: ${effect.modelProvider} / ${effect.modelId}`);

      // Use legacy generation (direct provider call, no failover)
      result = await runLegacyGeneration(prisma, {
        modelProvider: effect.modelProvider,
        modelId: effect.modelId || modelId,
        prompt: finalPrompt,
        imageUrls,
        aspectRatio,
        numberOfOutputs,
        providerParams: (effect.providerParams as Record<string, unknown>) || providerParams,
        jobId,
        onProgress: (message, percent) => {
          console.log(`[Worker] ${message}`);
          if (percent) job.updateProgress(20 + (percent * 0.5));
        },
      });
    }

    await job.updateProgress(70);

    if (!result.success || !result.outputs || result.outputs.length === 0) {
      throw new Error(result.error || "Generation failed with no outputs");
    }

    console.log(`[Worker] Generation succeeded with ${result.outputs.length} outputs via ${result.usedProvider}`);

    // Process and store outputs to R2
    const storedUrls = await processAndStoreOutputs(
      result.outputs,
      userId,
      jobId,
      job
    );

    if (storedUrls.length === 0) {
      throw new Error("Failed to store any outputs");
    }

    // Update job to SUCCEEDED
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
      },
    });

    await job.updateProgress(100);

    console.log(`[Worker] Job ${jobId} completed with ${storedUrls.length} outputs`);

    return {
      success: true,
      outputUrls: storedUrls,
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
    await refundTokens(jobId, userId);

    throw error;
  }
}

// Create worker
const worker = new Worker<GenerationJobData, GenerationJobResult>(
  "generation",
  processGenerationJob,
  {
    connection: redis,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Event handlers
worker.on("completed", (job, result) => {
  console.log(`✓ Job ${job.id} completed:`, result.success, result.usedProvider ? `via ${result.usedProvider}` : "");
});

worker.on("failed", (job, error) => {
  console.error(`✗ Job ${job?.id} failed:`, error.message);
});

worker.on("progress", (job, progress) => {
  console.log(`↻ Job ${job.id} progress: ${progress}%`);
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

console.log("🚀 PhotoMania worker started (multi-provider support enabled)");
