/**
 * OpenAI Provider Adapter
 * 
 * Implements the ProviderAdapter interface for OpenAI LLM services.
 * Supports GPT-4o-mini, GPT-4.1-mini, GPT-4.1-nano, and GPT-5-nano models.
 * 
 * All models use the Chat Completions API with vision support for image inputs.
 * GPT-5 series has additional parameters like verbosity and reasoning_effort.
 */

import OpenAI from "openai";
import {
  ProviderAdapter,
  GenerationInput,
  ProviderSubmitResult,
  ProviderPollResult,
  TokenUsage,
} from "./types";

// Model-specific configurations
// Pricing is per 1 million tokens (as of Jan 2026)
const MODEL_CONFIG: Record<string, {
  supportsVision: boolean;
  maxTokens: number;
  isGpt5: boolean;
  inputCostPer1M: number;   // USD per 1M input tokens
  outputCostPer1M: number;  // USD per 1M output tokens
}> = {
  "gpt-4o-mini": {
    supportsVision: true,
    maxTokens: 16384,
    isGpt5: false,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
  },
  "gpt-4.1-mini": {
    supportsVision: true,
    maxTokens: 32768,
    isGpt5: false,
    inputCostPer1M: 0.40,
    outputCostPer1M: 1.60,
  },
  "gpt-4.1-nano": {
    supportsVision: true,
    maxTokens: 32768,
    isGpt5: false,
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
  },
  "gpt-5-nano": {
    supportsVision: true,
    maxTokens: 128000,
    isGpt5: true,
    inputCostPer1M: 0.50,
    outputCostPer1M: 2.00,
  },
};

export class OpenAIAdapter implements ProviderAdapter {
  name = "openai";
  private client: OpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  async submitGeneration(input: GenerationInput): Promise<ProviderSubmitResult> {
    if (!this.client) {
      return {
        success: false,
        error: "OpenAI is not configured (missing OPENAI_API_KEY)",
      };
    }

    try {
      const modelId = input.providerModelId;
      const config = MODEL_CONFIG[modelId] || {
        supportsVision: true,
        maxTokens: 4096,
        isGpt5: false,
      };

      console.log(`[OpenAI] Running model: ${modelId}`);

      // Build messages with optional vision content
      const messages = this.buildMessages(input, config);

      // Build request parameters
      // Note: GPT-5 models use max_completion_tokens instead of max_tokens
      const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
        model: modelId,
        messages,
      };

      // Set token limit based on model type
      if (config.isGpt5) {
        // GPT-5 uses max_completion_tokens
        (requestParams as unknown as Record<string, unknown>).max_completion_tokens = config.maxTokens;
      } else {
        // GPT-4.x and earlier use max_tokens
        requestParams.max_tokens = config.maxTokens;
      }

      // Add GPT-5 specific parameters if applicable
      if (config.isGpt5) {
        const gpt5Params = (input.providerConfig || {}) as {
          verbosity?: "low" | "medium" | "high";
          reasoning_effort?: "minimal" | "low" | "medium" | "high";
        };

        // GPT-5 supports verbosity and reasoning_effort parameters
        if (gpt5Params.verbosity) {
          (requestParams as unknown as Record<string, unknown>).verbosity = gpt5Params.verbosity;
        }
        if (gpt5Params.reasoning_effort) {
          (requestParams as unknown as Record<string, unknown>).reasoning_effort = gpt5Params.reasoning_effort;
        }
      }

      // Make the API call
      const completion = await this.client.chat.completions.create(requestParams);

      // Extract the response
      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        return {
          success: false,
          error: "OpenAI returned no content",
        };
      }

      // Extract token usage
      const usage: TokenUsage = {
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      };

      // Calculate cost from token usage
      const costCharged = this.calculateCost(modelId, usage);

      console.log(
        `[OpenAI] Generation complete - ${responseContent.length} chars, ` +
        `tokens: ${usage.inputTokens} in / ${usage.outputTokens} out, ` +
        `cost: $${costCharged?.toFixed(6) || 'unknown'}`
      );

      return {
        success: true,
        immediateResult: {
          outputs: [responseContent],
          predictionId: completion.id,
        },
        usage,
        costCharged,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[OpenAI] Error:`, errorMessage);
      return {
        success: false,
        error: `OpenAI generation failed: ${errorMessage}`,
      };
    }
  }

  async pollResult(_taskId: string): Promise<ProviderPollResult> {
    // OpenAI Chat Completions is synchronous, polling not needed
    return {
      status: "failed",
      error: "OpenAI adapter uses synchronous API - polling not needed",
    };
  }

  /**
   * Calculate cost from token usage
   */
  private calculateCost(modelId: string, usage: TokenUsage): number | undefined {
    const config = MODEL_CONFIG[modelId];
    if (!config || !usage.inputTokens || !usage.outputTokens) {
      return undefined;
    }

    // Cost = (input_tokens / 1M) * input_cost + (output_tokens / 1M) * output_cost
    const inputCost = (usage.inputTokens / 1_000_000) * config.inputCostPer1M;
    const outputCost = (usage.outputTokens / 1_000_000) * config.outputCostPer1M;
    
    return inputCost + outputCost;
  }

  /**
   * Build chat messages with optional vision content
   */
  private buildMessages(
    input: GenerationInput,
    config: { supportsVision: boolean }
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add system message if provided in config
    const systemPrompt = input.providerConfig?.system_prompt as string | undefined;
    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    // Build user message content
    if (config.supportsVision && input.imageUrls && input.imageUrls.length > 0) {
      // Multi-modal message with text and images
      const content: OpenAI.Chat.ChatCompletionContentPart[] = [];

      // Add text prompt
      if (input.prompt) {
        content.push({
          type: "text",
          text: input.prompt,
        });
      }

      // Add images (supports URLs and base64 data URIs)
      for (const imageUrl of input.imageUrls) {
        content.push({
          type: "image_url",
          image_url: {
            url: imageUrl,
            detail: (input.providerConfig?.image_detail as "low" | "high" | "auto") || "auto",
          },
        });
      }

      messages.push({
        role: "user",
        content,
      });
    } else {
      // Text-only message
      messages.push({
        role: "user",
        content: input.prompt,
      });
    }

    return messages;
  }
}

// Export singleton instance
export const openaiAdapter = new OpenAIAdapter();
