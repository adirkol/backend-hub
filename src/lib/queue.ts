import { Queue, Job } from "bullmq";
import type Redis from "ioredis";

/**
 * Queue System for AI Backend Hub
 * 
 * Handles job queueing for AI generation requests across all tenant apps.
 */

// Job data types for multi-tenant generation
export interface GenerationJobData {
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

export interface GenerationJobResult {
  success: boolean;
  outputs?: Array<{ url: string; index: number }>;
  error?: string;
  usedProvider?: string;
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
      "ai-generation",
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

// Export a getter interface for direct queue access
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

