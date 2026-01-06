/**
 * DefAPI Provider Adapter
 * 
 * Implements the ProviderAdapter interface for DefAPI service.
 * DefAPI is an async API that requires submitting a task and polling for results.
 * 
 * API Documentation: https://defapi.org
 * - POST /api/image/gen - Submit generation request
 * - GET /api/task/query?task_id=... - Poll for results
 */

import {
  ProviderAdapter,
  GenerationInput,
  ProviderSubmitResult,
  ProviderPollResult,
} from "./types";

const DEFAPI_BASE_URL = "https://api.defapi.org";
const DEFAPI_POLL_INTERVAL_MS = 2000; // 2 seconds between polls
const DEFAPI_MAX_POLL_ATTEMPTS = 150; // Max 5 minutes (150 * 2s)

interface DefAPIImageGenRequest {
  model: string;
  prompt: string;
  images?: string[];
  aspect_ratio?: string;
}

interface DefAPIImageGenResponse {
  code: number;
  message: string;
  data?: {
    task_id: string;
  };
  detail?: string;
}

interface DefAPITaskQueryResponse {
  code: number;
  message: string;
  data?: {
    task_id: string;
    status: "pending" | "submitted" | "in_progress" | "success" | "failed";
    result: Array<{ image?: string; text?: string }> | null;
    status_reason: {
      message: string | null;
    };
    consumed: string;
    created_at: string;
  };
}

export class DefAPIAdapter implements ProviderAdapter {
  name = "defapi";
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.DEFAPI_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async submitGeneration(input: GenerationInput): Promise<ProviderSubmitResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "DefAPI is not configured (missing DEFAPI_API_KEY)",
      };
    }

    try {
      const requestBody: DefAPIImageGenRequest = {
        model: input.providerModelId,
        prompt: input.prompt,
      };

      // Add input images if provided
      if (input.imageUrls && input.imageUrls.length > 0) {
        requestBody.images = input.imageUrls;
      }

      // Add aspect ratio if provided
      if (input.aspectRatio) {
        requestBody.aspect_ratio = this.mapAspectRatio(input.aspectRatio);
      }

      // Determine the correct endpoint based on model type
      // OpenAI GPT Image models use /api/gpt-image/gen
      // Google models use /api/image/gen
      const isGptImageModel = input.providerModelId.startsWith("openai/");
      const endpoint = isGptImageModel 
        ? `${DEFAPI_BASE_URL}/api/gpt-image/gen`
        : `${DEFAPI_BASE_URL}/api/image/gen`;

      console.log(`[DefAPI] Submitting generation request for model: ${input.providerModelId}`);
      console.log(`[DefAPI] Using endpoint: ${endpoint}`);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      const data: DefAPIImageGenResponse = await response.json();

      if (data.code !== 0 || !data.data?.task_id) {
        console.error(`[DefAPI] Submit failed:`, data);
        return {
          success: false,
          error: data.detail || data.message || "Failed to submit generation",
        };
      }

      console.log(`[DefAPI] Task created: ${data.data.task_id}`);

      return {
        success: true,
        taskId: data.data.task_id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[DefAPI] Submit error:`, errorMessage);
      return {
        success: false,
        error: `DefAPI submission failed: ${errorMessage}`,
      };
    }
  }

  async pollResult(taskId: string): Promise<ProviderPollResult> {
    if (!this.isConfigured()) {
      return {
        status: "failed",
        error: "DefAPI is not configured (missing DEFAPI_API_KEY)",
      };
    }

    try {
      const response = await fetch(
        `${DEFAPI_BASE_URL}/api/task/query?task_id=${encodeURIComponent(taskId)}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        }
      );

      const data: DefAPITaskQueryResponse = await response.json();

      if (data.code !== 0 || !data.data) {
        console.error(`[DefAPI] Poll failed:`, data);
        return {
          status: "failed",
          error: data.message || "Failed to query task status",
        };
      }

      const taskData = data.data;
      console.log(`[DefAPI] Task ${taskId} status: ${taskData.status}`);

      // Map DefAPI status to our status
      switch (taskData.status) {
        case "pending":
        case "submitted":
          return { status: "pending" };

        case "in_progress":
          return { status: "running" };

        case "success":
          if (!taskData.result || taskData.result.length === 0) {
            return {
              status: "failed",
              error: "Generation succeeded but returned no results",
            };
          }

          // Filter to only include results with actual images (not text-only responses)
          const imageOutputs = taskData.result
            .filter((r) => r.image)
            .map((r) => r.image as string);

          if (imageOutputs.length === 0) {
            // Check if we got text responses (model returned text instead of images)
            const textResponses = taskData.result
              .filter((r) => r.text)
              .map((r) => r.text);
            
            const errorMsg = textResponses.length > 0
              ? `Model returned text instead of images: ${textResponses.join("; ")}`
              : "Generation succeeded but returned no images";
            
            console.error(`[DefAPI] ${errorMsg}`);
            
            return {
              status: "failed",
              error: errorMsg,
            };
          }

          return {
            status: "succeeded",
            result: {
              outputs: imageOutputs,
            },
            costCharged: parseFloat(taskData.consumed) || undefined,
          };

        case "failed":
          return {
            status: "failed",
            error: taskData.status_reason?.message || "Generation failed",
          };

        default:
          return {
            status: "pending",
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[DefAPI] Poll error:`, errorMessage);
      return {
        status: "failed",
        error: `DefAPI poll failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Wait for a task to complete by polling
   * This is a convenience method for use in the orchestrator
   */
  async waitForResult(
    taskId: string,
    onProgress?: (status: string) => void
  ): Promise<ProviderPollResult> {
    let attempts = 0;
    let taskNotFoundRetries = 0;
    const MAX_TASK_NOT_FOUND_RETRIES = 10;

    // Initial delay to allow task to be registered in DefAPI's system
    console.log(`[DefAPI] Waiting 5 seconds before starting to poll task ${taskId}...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    while (attempts < DEFAPI_MAX_POLL_ATTEMPTS) {
      const result = await this.pollResult(taskId);

      // Handle "task not found" - retry a few times as task may not be immediately available
      if (result.status === "failed" && result.error?.includes("task not found")) {
        taskNotFoundRetries++;
        if (taskNotFoundRetries <= MAX_TASK_NOT_FOUND_RETRIES) {
          console.log(`[DefAPI] Task not found yet, retry ${taskNotFoundRetries}/${MAX_TASK_NOT_FOUND_RETRIES}...`);
          await new Promise((resolve) => setTimeout(resolve, DEFAPI_POLL_INTERVAL_MS));
          continue;
        }
        // If we've exhausted retries, return the failure
        return result;
      }

      if (result.status === "succeeded" || result.status === "failed") {
        return result;
      }

      onProgress?.(result.status);
      
      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, DEFAPI_POLL_INTERVAL_MS));
      attempts++;
    }

    return {
      status: "failed",
      error: "Timeout waiting for generation to complete",
    };
  }

  /**
   * Map aspect ratios to DefAPI supported values
   * DefAPI supports: 1:1, 16:9, 21:9, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16
   */
  private mapAspectRatio(aspectRatio: string): string {
    const validRatios = [
      "1:1",
      "16:9",
      "21:9",
      "2:3",
      "3:2",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "9:16",
    ];

    if (validRatios.includes(aspectRatio)) {
      return aspectRatio;
    }

    // Map unsupported ratios to closest supported ones
    const ratioMap: Record<string, string> = {
      "match_input_image": "1:1", // Default fallback
    };

    return ratioMap[aspectRatio] || "1:1";
  }
}

// Export singleton instance
export const defapiAdapter = new DefAPIAdapter();

