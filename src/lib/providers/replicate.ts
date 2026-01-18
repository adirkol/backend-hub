/**
 * Replicate Provider Adapter
 * 
 * Implements the ProviderAdapter interface for Replicate service.
 * Replicate's SDK handles polling internally, so submitGeneration returns immediately.
 */

import Replicate from "replicate";
import {
  ProviderAdapter,
  GenerationInput,
  ProviderSubmitResult,
  ProviderPollResult,
} from "./types";

export class ReplicateAdapter implements ProviderAdapter {
  name = "replicate";
  private client: Replicate | null = null;

  constructor() {
    if (process.env.REPLICATE_API_TOKEN) {
      this.client = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
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
        error: "Replicate is not configured (missing REPLICATE_API_TOKEN)",
      };
    }

    try {
      const modelInput = this.buildModelInput(input);
      
      console.log(`[Replicate] Running model: ${input.providerModelId}`);

      // Use predictions.create to get the prediction ID, then wait for completion
      const prediction = await this.client.predictions.create({
        model: input.providerModelId as `${string}/${string}`,
        input: modelInput,
      });

      console.log(`[Replicate] Prediction created: ${prediction.id}`);

      // Wait for the prediction to complete
      const completedPrediction = await this.client.wait(prediction);

      if (completedPrediction.status === "failed" || completedPrediction.status === "canceled") {
        const errorMsg = completedPrediction.error 
          ? (typeof completedPrediction.error === 'string' 
              ? completedPrediction.error 
              : JSON.stringify(completedPrediction.error))
          : `Prediction ${completedPrediction.status}`;
        return {
          success: false,
          error: errorMsg,
        };
      }

      // Process the output
      const outputs = this.processOutput(completedPrediction.output);

      if (outputs.length === 0) {
        return {
          success: false,
          error: "Replicate returned no outputs",
        };
      }

      console.log(`[Replicate] Generation complete with ${outputs.length} outputs`);

      return {
        success: true,
        immediateResult: { 
          outputs,
          predictionId: prediction.id,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Replicate] Error:`, errorMessage);
      return {
        success: false,
        error: `Replicate generation failed: ${errorMessage}`,
      };
    }
  }

  async pollResult(_taskId: string): Promise<ProviderPollResult> {
    // Replicate SDK handles polling internally, so this should not be called
    return {
      status: "failed",
      error: "Replicate adapter uses synchronous SDK - polling not needed",
    };
  }

  /**
   * Build model input from GenerationInput
   * Handles model-specific input format differences
   */
  private buildModelInput(input: GenerationInput): Record<string, unknown> {
    const modelInput: Record<string, unknown> = {
      ...input.providerConfig,
    };

    // Add prompt
    if (input.prompt) {
      modelInput.prompt = input.prompt;
    }

    // Handle image inputs based on model
    if (input.imageUrls && input.imageUrls.length > 0) {
      // Model-specific image input handling
      if (input.providerModelId === "google/nano-banana") {
        // nano-banana uses image_input (array)
        modelInput.image_input = input.imageUrls.map(String);
        delete modelInput.image;
        delete modelInput.input_images;
        delete modelInput.images;
      } else if (input.providerModelId === "prunaai/p-image-edit") {
        // p-image-edit uses images array
        modelInput.images = input.imageUrls.map(String);
        delete modelInput.image;
        delete modelInput.input_images;
        delete modelInput.image_input;
        
        // Set turbo mode (default true, can be overridden via providerConfig)
        if (modelInput.turbo === undefined) {
          modelInput.turbo = true;
        }
        
        // Set disable_safety_checker (default false, can be toggled via providerConfig)
        if (modelInput.disable_safety_checker === undefined) {
          modelInput.disable_safety_checker = false;
        }
      } else {
        // Other models (like openai/gpt-image-1.5) use input_images
        modelInput.input_images = input.imageUrls.map(String);
        delete modelInput.image;
        delete modelInput.images;
      }
    }

    // Handle aspect ratio
    if (input.aspectRatio) {
      modelInput.aspect_ratio = this.mapAspectRatio(
        input.aspectRatio,
        input.providerModelId
      );
    }

    // Handle number of outputs
    if (input.numberOfOutputs && input.numberOfOutputs > 1) {
      // Models like nano-banana only support 1 output at a time
      const modelsSupportingBatchOutput = ["openai/gpt-image-1.5"];
      if (modelsSupportingBatchOutput.includes(input.providerModelId)) {
        modelInput.number_of_images = input.numberOfOutputs;
        modelInput.num_outputs = input.numberOfOutputs;
      }
      // For models that don't support batch, orchestrator will call multiple times
    }

    return modelInput;
  }

  /**
   * Process Replicate output to extract image URLs
   */
  private processOutput(output: unknown): string[] {
    const outputs: string[] = [];

    if (Array.isArray(output)) {
      for (const item of output) {
        const url = this.extractUrl(item);
        if (url) outputs.push(url);
      }
    } else {
      const url = this.extractUrl(output);
      if (url) outputs.push(url);
    }

    return outputs;
  }

  /**
   * Extract URL from various output formats
   */
  private extractUrl(item: unknown): string | null {
    if (typeof item === "string") {
      if (item.startsWith("http")) return item;
      return null;
    }

    // Replicate SDK returns URL objects that stringify correctly
    const urlString = String(item);
    if (urlString.startsWith("http")) return urlString;

    // Handle object with url property
    if (item && typeof item === "object" && "url" in item) {
      const url = (item as { url: unknown }).url;
      if (typeof url === "string" && url.startsWith("http")) return url;
    }

    return null;
  }

  /**
   * Map aspect ratios to model-specific valid values
   */
  private mapAspectRatio(aspectRatio: string, modelId: string): string {
    // openai/gpt-image-1.5 only accepts: "1:1", "3:2", "2:3"
    if (modelId === "openai/gpt-image-1.5") {
      const validRatios = ["1:1", "3:2", "2:3"];
      if (validRatios.includes(aspectRatio)) return aspectRatio;

      const ratioMap: Record<string, string> = {
        "4:3": "3:2",
        "3:4": "2:3",
        "16:9": "3:2",
        "9:16": "2:3",
        "match_input_image": "1:1",
      };
      return ratioMap[aspectRatio] || "1:1";
    }

    // google/nano-banana accepts many ratios
    if (modelId === "google/nano-banana") {
      const validRatios = [
        "match_input_image",
        "1:1",
        "2:3",
        "3:2",
        "3:4",
        "4:3",
        "4:5",
        "5:4",
        "9:16",
        "16:9",
        "21:9",
      ];
      if (validRatios.includes(aspectRatio)) return aspectRatio;
      return "match_input_image";
    }

    // prunaai/p-image-edit accepts: "match_input_image", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"
    if (modelId === "prunaai/p-image-edit") {
      const validRatios = [
        "match_input_image",
        "1:1",
        "16:9",
        "9:16",
        "4:3",
        "3:4",
        "3:2",
        "2:3",
      ];
      if (validRatios.includes(aspectRatio)) return aspectRatio;
      // Default to match_input_image for image editing
      return "match_input_image";
    }

    return aspectRatio;
  }
}

// Export singleton instance
export const replicateAdapter = new ReplicateAdapter();




