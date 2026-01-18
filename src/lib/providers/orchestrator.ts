/**
 * Provider Orchestrator
 * 
 * Handles multi-provider generation with automatic failover.
 * Tries providers in priority order, logs usage, and handles retries.
 * 
 * Adapted for multi-tenant AI Backend Hub.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import {
  GenerationInput,
  OrchestratorResult,
  ProviderAdapter,
  TokenUsage,
} from "./types";
import { getProviderAdapter } from "./index";
import { DefAPIAdapter } from "./defapi";

/**
 * Input for the orchestrator
 */
export interface OrchestratorInput {
  /** The AI model ID from our database */
  aiModelId: string;
  
  /** The prompt for generation */
  prompt: string;
  
  /** Input image URLs */
  imageUrls: string[];
  
  /** Aspect ratio */
  aspectRatio?: string;
  
  /** Number of outputs to generate */
  numberOfOutputs?: number;
  
  /** Additional provider parameters */
  providerParams?: Record<string, unknown>;
  
  /** Job ID for logging purposes */
  jobId: string;
  
  /** App ID for usage logging (multi-tenant) */
  appId?: string;
  
  /** Callback for progress updates */
  onProgress?: (message: string, percent?: number) => void;
}

/**
 * Provider Orchestrator Class
 * 
 * Manages multi-provider generation with automatic failover
 */
export class ProviderOrchestrator {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Run generation through available providers with automatic failover
   */
  async runGeneration(input: OrchestratorInput): Promise<OrchestratorResult> {
    const startTime = Date.now();
    let attemptsCount = 0;

    // Fetch model with provider configurations ordered by priority
    const aiModel = await this.prisma.aIModel.findUnique({
      where: { id: input.aiModelId },
      include: {
        providerConfigs: {
          where: { isEnabled: true },
          orderBy: { priority: "asc" },
          include: {
            provider: true,
          },
        },
      },
    });

    if (!aiModel) {
      return {
        success: false,
        error: `AI Model not found: ${input.aiModelId}`,
        attemptsCount: 0,
      };
    }

    if (aiModel.providerConfigs.length === 0) {
      return {
        success: false,
        error: `No enabled providers configured for model: ${aiModel.displayName}`,
        attemptsCount: 0,
      };
    }

    input.onProgress?.(`Starting generation with ${aiModel.displayName}...`, 5);

    // Try each provider in priority order
    const errors: string[] = [];

    for (const providerConfig of aiModel.providerConfigs) {
      if (!providerConfig.provider.isEnabled) {
        console.log(`[Orchestrator] Skipping disabled provider: ${providerConfig.provider.name}`);
        continue;
      }

      attemptsCount++;
      const attemptStart = Date.now();

      console.log(
        `[Orchestrator] Attempt ${attemptsCount}: Trying ${providerConfig.provider.displayName} ` +
        `(priority ${providerConfig.priority})`
      );

      input.onProgress?.(
        `Trying ${providerConfig.provider.displayName}...`,
        10 + (attemptsCount - 1) * 10
      );

      const adapter = getProviderAdapter(providerConfig.provider.name);

      if (!adapter) {
        const error = `No adapter found for provider: ${providerConfig.provider.name}`;
        console.error(`[Orchestrator] ${error}`);
        errors.push(error);
        await this.logUsage({
          jobId: input.jobId,
          appId: input.appId,
          providerId: providerConfig.provider.id,
          providerModelId: providerConfig.providerModelId,
          attemptNumber: attemptsCount,
          success: false,
          errorMessage: error,
          latencyMs: Date.now() - attemptStart,
        });
        continue;
      }

      if (!adapter.isConfigured()) {
        const error = `Provider not configured: ${providerConfig.provider.name}`;
        console.error(`[Orchestrator] ${error}`);
        errors.push(error);
        await this.logUsage({
          jobId: input.jobId,
          appId: input.appId,
          providerId: providerConfig.provider.id,
          providerModelId: providerConfig.providerModelId,
          attemptNumber: attemptsCount,
          success: false,
          errorMessage: error,
          latencyMs: Date.now() - attemptStart,
        });
        continue;
      }

      // Build generation input
      const generationInput: GenerationInput = {
        providerModelId: providerConfig.providerModelId,
        prompt: input.prompt,
        imageUrls: input.imageUrls,
        aspectRatio: input.aspectRatio,
        numberOfOutputs: input.numberOfOutputs,
        providerConfig: {
          ...(providerConfig.config as Record<string, unknown> || {}),
          ...(input.providerParams || {}),
        },
      };

      try {
        const result = await this.runWithProvider(
          adapter,
          generationInput,
          input.numberOfOutputs || 1,
          (msg) => input.onProgress?.(msg)
        );

        if (result.success && result.outputs && result.outputs.length > 0) {
          const latencyMs = Date.now() - attemptStart;
          
          // Log successful usage (including token usage for LLMs)
          await this.logUsage({
            jobId: input.jobId,
            appId: input.appId,
            providerId: providerConfig.provider.id,
            providerModelId: providerConfig.providerModelId,
            providerTaskId: result.providerTaskId,
            attemptNumber: attemptsCount,
            success: true,
            costCharged: result.costCharged,
            usage: result.usage,
            latencyMs,
          });

          const tokenInfo = result.usage 
            ? `, tokens: ${result.usage.inputTokens || 0} in / ${result.usage.outputTokens || 0} out`
            : '';
          
          console.log(
            `[Orchestrator] Success with ${providerConfig.provider.displayName} ` +
            `after ${latencyMs}ms - ${result.outputs.length} outputs${tokenInfo}`
          );

          return {
            success: true,
            outputs: result.outputs,
            usedProvider: providerConfig.provider.name,
            latencyMs: Date.now() - startTime,
            costCharged: result.costCharged,
            usage: result.usage,
            attemptsCount,
          };
        } else {
          const error = result.error || "Generation returned no outputs";
          errors.push(`${providerConfig.provider.displayName}: ${error}`);
          
          await this.logUsage({
            jobId: input.jobId,
            appId: input.appId,
            providerId: providerConfig.provider.id,
            providerModelId: providerConfig.providerModelId,
            providerTaskId: result.providerTaskId,
            attemptNumber: attemptsCount,
            success: false,
            errorMessage: error,
            latencyMs: Date.now() - attemptStart,
          });

          console.log(
            `[Orchestrator] Failed with ${providerConfig.provider.displayName}: ${error}`
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push(`${providerConfig.provider.displayName}: ${errorMessage}`);
        
        await this.logUsage({
          jobId: input.jobId,
          appId: input.appId,
          providerId: providerConfig.provider.id,
          providerModelId: providerConfig.providerModelId,
          attemptNumber: attemptsCount,
          success: false,
          errorMessage,
          latencyMs: Date.now() - attemptStart,
        });

        console.error(
          `[Orchestrator] Exception with ${providerConfig.provider.displayName}:`,
          errorMessage
        );
      }
    }

    // All providers failed
    return {
      success: false,
      error: `All providers failed: ${errors.join("; ")}`,
      attemptsCount,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Run generation with a specific provider adapter
   */
  private async runWithProvider(
    adapter: ProviderAdapter,
    input: GenerationInput,
    numberOfOutputs: number,
    onProgress?: (message: string) => void
  ): Promise<{
    success: boolean;
    outputs?: string[];
    error?: string;
    costCharged?: number;
    usage?: TokenUsage;
    providerTaskId?: string;
  }> {
    // Submit generation request
    const submitResult = await adapter.submitGeneration(input);

    if (!submitResult.success) {
      return {
        success: false,
        error: submitResult.error,
      };
    }

    // If provider returned immediate result (like Replicate SDK or OpenAI)
    if (submitResult.immediateResult) {
      return {
        success: true,
        outputs: submitResult.immediateResult.outputs,
        providerTaskId: submitResult.immediateResult.predictionId,
        costCharged: submitResult.costCharged,
        usage: submitResult.usage,
      };
    }

    // For async providers (like DefAPI), poll for results
    if (!submitResult.taskId) {
      return {
        success: false,
        error: "Provider did not return task ID or immediate result",
      };
    }

    // Special handling for DefAPI - it has a waitForResult method
    if (adapter instanceof DefAPIAdapter) {
      const pollResult = await adapter.waitForResult(
        submitResult.taskId,
        (status) => onProgress?.(`Status: ${status}`)
      );

      if (pollResult.status === "succeeded" && pollResult.result) {
        // Handle multiple outputs if needed
        let outputs = pollResult.result.outputs;
        
        // If we need multiple outputs and provider only gives one at a time,
        // we need to run multiple requests
        if (numberOfOutputs > 1 && outputs.length < numberOfOutputs) {
          const additionalOutputs = await this.runMultipleRequests(
            adapter,
            input,
            numberOfOutputs - outputs.length,
            onProgress
          );
          outputs = [...outputs, ...additionalOutputs];
        }

        return {
          success: true,
          outputs,
          costCharged: pollResult.costCharged,
          providerTaskId: submitResult.taskId,
        };
      }

      return {
        success: false,
        error: pollResult.error || "Generation failed",
        providerTaskId: submitResult.taskId,
      };
    }

    // Generic polling for other async providers
    return {
      success: false,
      error: "Async polling not implemented for this provider",
      providerTaskId: submitResult.taskId,
    };
  }

  /**
   * Run multiple generation requests for providers that don't support batch output
   */
  private async runMultipleRequests(
    adapter: ProviderAdapter,
    input: GenerationInput,
    count: number,
    onProgress?: (message: string) => void
  ): Promise<string[]> {
    const outputs: string[] = [];

    for (let i = 0; i < count; i++) {
      onProgress?.(`Generating additional output ${i + 1}/${count}...`);

      const submitResult = await adapter.submitGeneration({
        ...input,
        numberOfOutputs: 1,
      });

      if (submitResult.immediateResult) {
        outputs.push(...submitResult.immediateResult.outputs);
      } else if (submitResult.taskId && adapter instanceof DefAPIAdapter) {
        const pollResult = await adapter.waitForResult(submitResult.taskId);
        if (pollResult.status === "succeeded" && pollResult.result) {
          outputs.push(...pollResult.result.outputs);
        }
      }
    }

    return outputs;
  }

  /**
   * Log provider usage to the database (multi-tenant aware)
   */
  private async logUsage(data: {
    jobId: string;
    appId?: string;
    providerId: string;
    providerModelId: string;
    providerTaskId?: string;
    attemptNumber: number;
    success: boolean;
    costCharged?: number;
    usage?: TokenUsage;
    errorMessage?: string;
    latencyMs: number;
  }): Promise<void> {
    try {
      await this.prisma.providerUsageLog.create({
        data: {
          jobId: data.jobId,
          appId: data.appId,
          providerId: data.providerId,
          providerModelId: data.providerModelId,
          providerTaskId: data.providerTaskId,
          attemptNumber: data.attemptNumber,
          success: data.success,
          costCharged: data.costCharged ? new Prisma.Decimal(data.costCharged) : null,
          inputTokens: data.usage?.inputTokens ?? null,
          outputTokens: data.usage?.outputTokens ?? null,
          totalTokens: data.usage?.totalTokens ?? null,
          errorMessage: data.errorMessage,
          latencyMs: data.latencyMs,
        },
      });
    } catch (error) {
      console.error("[Orchestrator] Failed to log usage:", error);
    }
  }
}




