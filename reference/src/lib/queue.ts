import { Queue, Job } from "bullmq";
import type Redis from "ioredis";

// Job data types
export interface GenerationJobData {
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
  promptFieldMap?: Record<string, string>; // Evaluated prompt text for each field
  modelId: string;
  promptTemplate?: string;
  providerParams?: Record<string, unknown>;
}

export interface GenerationJobResult {
  success: boolean;
  outputUrls?: string[];
  error?: string;
}

// Lazy initialization of the queue
let _generationQueue: Queue<GenerationJobData, GenerationJobResult> | null = null;

function getRedis(): Redis {
  // Dynamic import to avoid issues during build
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { redis } = require("@/lib/redis");
  return redis;
}

function getQueue(): Queue<GenerationJobData, GenerationJobResult> {
  if (!_generationQueue) {
    _generationQueue = new Queue<GenerationJobData, GenerationJobResult>(
      "generation",
      {
        connection: getRedis(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 3600, // 24 hours
          },
          removeOnFail: {
            count: 5000,
          },
        },
      }
    );
  }
  return _generationQueue;
}

// Export a getter instead of the queue directly
export const generationQueue = {
  add: async (
    name: string,
    data: GenerationJobData,
    options?: { jobId?: string; priority?: number }
  ) => {
    return getQueue().add(name, data, options);
  },
  getJob: async (jobId: string) => {
    return getQueue().getJob(jobId);
  },
};

/**
 * Add a generation job to the queue
 */
export async function addGenerationJob(
  data: GenerationJobData,
  priority?: number
): Promise<Job<GenerationJobData, GenerationJobResult>> {
  return getQueue().add("process", data, {
    jobId: data.jobId,
    priority: priority ?? 10,
  });
}

/**
 * Get job status from queue
 */
export async function getQueueJobStatus(jobId: string) {
  const job = await getQueue().getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;

  return {
    state,
    progress,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  };
}
