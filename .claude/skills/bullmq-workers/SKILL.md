---
name: bullmq-workers
description: |
  BullMQ job queue patterns for background processing.
  Use when implementing job queues, workers, scheduled tasks, or handling long-running processes.
---

# BullMQ Workers Skill

Expertise in BullMQ for reliable background job processing with Redis.

## Queue Setup

### Basic Queue Configuration
```typescript
// lib/queue.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// Define queues
export const effectQueue = new Queue('effects', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 5000,
    },
  },
});

export const emailQueue = new Queue('emails', { connection });
export const cleanupQueue = new Queue('cleanup', { connection });
```

## Job Types Definition

```typescript
// types/jobs.ts
export interface EffectJobData {
  userEffectId: string;
  effectId: string;
  imageUrl: string;
  modelConfig: Record<string, unknown>;
  userId: string;
}

export interface EmailJobData {
  to: string;
  subject: string;
  template: 'welcome' | 'effect-complete' | 'subscription-renewed';
  data: Record<string, unknown>;
}

export type JobResult<T = unknown> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};
```

## Worker Implementation

### Effect Processing Worker
```typescript
// workers/effect-worker.ts
import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/db';
import { processWithAI } from '@/lib/ai';
import { uploadToR2 } from '@/lib/storage';
import type { EffectJobData, JobResult } from '@/types/jobs';

const connection = new Redis(process.env.REDIS_URL!);

export const effectWorker = new Worker<EffectJobData, JobResult>(
  'effects',
  async (job: Job<EffectJobData>) => {
    const { userEffectId, imageUrl, modelConfig } = job.data;

    // Update status to processing
    await prisma.userEffect.update({
      where: { id: userEffectId },
      data: { status: 'PROCESSING' },
    });

    try {
      // Report progress
      await job.updateProgress(10);

      // Download and validate image
      const imageBuffer = await downloadImage(imageUrl);
      await job.updateProgress(20);

      // Process with AI model
      const resultBuffer = await processWithAI(imageBuffer, modelConfig);
      await job.updateProgress(70);

      // Upload result to R2
      const resultUrl = await uploadToR2(resultBuffer, `effects/${userEffectId}.jpg`);
      await job.updateProgress(90);

      // Update database
      await prisma.userEffect.update({
        where: { id: userEffectId },
        data: {
          status: 'COMPLETED',
          resultUrl,
          completedAt: new Date(),
        },
      });

      await job.updateProgress(100);

      return { success: true, data: { resultUrl } };
    } catch (error) {
      // Update status to failed
      await prisma.userEffect.update({
        where: { id: userEffectId },
        data: { status: 'FAILED' },
      });

      throw error; // Re-throw for retry logic
    }
  },
  {
    connection,
    concurrency: 5, // Process 5 jobs in parallel
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second
    },
  }
);

// Event handlers
effectWorker.on('completed', (job, result) => {
  console.log(`✓ Job ${job.id} completed:`, result);
});

effectWorker.on('failed', (job, error) => {
  console.error(`✗ Job ${job?.id} failed:`, error.message);
});

effectWorker.on('progress', (job, progress) => {
  console.log(`↻ Job ${job.id} progress: ${progress}%`);
});
```

## Adding Jobs

### Basic Job Addition
```typescript
// Add a job
const job = await effectQueue.add('process-effect', {
  userEffectId: 'ue_123',
  effectId: 'vintage',
  imageUrl: 'https://...',
  modelConfig: { intensity: 0.8 },
  userId: 'user_123',
});

console.log(`Job added with ID: ${job.id}`);
```

### Job Options
```typescript
// With custom options
await effectQueue.add(
  'process-effect',
  jobData,
  {
    // Unique job ID (prevents duplicates)
    jobId: `effect-${userEffectId}`,
    
    // Priority (lower = higher priority)
    priority: isPro ? 1 : 10,
    
    // Delay execution
    delay: 5000, // 5 seconds
    
    // Override retry settings
    attempts: 5,
    backoff: {
      type: 'fixed',
      delay: 60000, // 1 minute
    },
    
    // Job timeout
    timeout: 300000, // 5 minutes
  }
);
```

### Bulk Job Addition
```typescript
// Add multiple jobs at once
await effectQueue.addBulk([
  { name: 'process-effect', data: job1Data },
  { name: 'process-effect', data: job2Data },
  { name: 'process-effect', data: job3Data },
]);
```

## Scheduled Jobs (Cron)

```typescript
// Recurring jobs with cron patterns
await cleanupQueue.add(
  'cleanup-expired',
  {},
  {
    repeat: {
      pattern: '0 0 * * *', // Daily at midnight
    },
  }
);

await cleanupQueue.add(
  'sync-stripe',
  {},
  {
    repeat: {
      pattern: '*/15 * * * *', // Every 15 minutes
    },
  }
);

// Remove scheduled job
const repeatableJobs = await cleanupQueue.getRepeatableJobs();
await cleanupQueue.removeRepeatableByKey(repeatableJobs[0].key);
```

## Job Events and Monitoring

### Queue Events
```typescript
import { QueueEvents } from 'bullmq';

const queueEvents = new QueueEvents('effects', { connection });

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed with:`, returnvalue);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed:`, failedReason);
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`Job ${jobId} progress:`, data);
});
```

### Job Status Checking
```typescript
// Get job by ID
const job = await effectQueue.getJob(jobId);

if (job) {
  const state = await job.getState(); // 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  const progress = job.progress;
  const result = job.returnvalue;
  
  console.log({ state, progress, result });
}

// Get queue metrics
const waiting = await effectQueue.getWaitingCount();
const active = await effectQueue.getActiveCount();
const completed = await effectQueue.getCompletedCount();
const failed = await effectQueue.getFailedCount();
```

## Worker Process Entry Point

```typescript
// worker.ts - Run as separate Node.js process
import 'dotenv/config';
import { effectWorker } from './workers/effect-worker';
import { emailWorker } from './workers/email-worker';
import { cleanupWorker } from './workers/cleanup-worker';

console.log('🚀 Starting workers...');

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down workers...');
  
  await Promise.all([
    effectWorker.close(),
    emailWorker.close(),
    cleanupWorker.close(),
  ]);
  
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('✓ Workers started');
```

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "worker": "tsx watch ./worker.ts",
    "worker:prod": "node ./dist/worker.js",
    "build:worker": "tsc --project tsconfig.worker.json"
  }
}
```

## Error Handling and Retries

```typescript
// Custom retry logic
const worker = new Worker('effects', async (job) => {
  try {
    return await processEffect(job.data);
  } catch (error) {
    if (error instanceof RateLimitError) {
      // Retry with delay
      throw new Error('Rate limited, will retry');
    }
    
    if (error instanceof PermanentError) {
      // Don't retry
      return { success: false, error: error.message };
    }
    
    throw error; // Retry with backoff
  }
}, {
  connection,
  settings: {
    backoffStrategy: (attemptsMade) => {
      // Custom backoff: 1s, 5s, 30s, 2min, 5min
      const delays = [1000, 5000, 30000, 120000, 300000];
      return delays[Math.min(attemptsMade - 1, delays.length - 1)];
    },
  },
});
```

## Dashboard Integration

```typescript
// For monitoring with Bull Board
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(effectQueue),
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(cleanupQueue),
  ],
  serverAdapter,
});
```






