/**
 * Provider Adapter Types
 * 
 * This file defines the interfaces for the multi-provider system.
 * Each provider (DefAPI, Replicate, etc.) implements these interfaces.
 */

/**
 * Input for image generation across all providers
 */
export interface GenerationInput {
  /** Provider-specific model ID (e.g., "google/nano-banana") */
  providerModelId: string;
  
  /** The prompt for generation */
  prompt: string;
  
  /** Input image URLs */
  imageUrls: string[];
  
  /** Aspect ratio (e.g., "1:1", "16:9") */
  aspectRatio?: string;
  
  /** Number of outputs to generate */
  numberOfOutputs?: number;
  
  /** Provider-specific additional configuration */
  providerConfig?: Record<string, unknown>;
}

/**
 * Result of submitting a generation request
 */
export interface ProviderSubmitResult {
  success: boolean;
  
  /** Task/Job ID from the provider for polling */
  taskId?: string;
  
  /** If the provider returns results immediately (like Replicate SDK) */
  immediateResult?: ProviderGenerationResult;
  
  /** Error message if submission failed */
  error?: string;
}

/**
 * Result of polling for generation status
 */
export interface ProviderPollResult {
  /** Current status of the generation */
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  
  /** Generation results if succeeded */
  result?: ProviderGenerationResult;
  
  /** Error message if failed */
  error?: string;
  
  /** Cost charged by the provider (if available) */
  costCharged?: number;
}

/**
 * Successful generation result
 */
export interface ProviderGenerationResult {
  /** URLs or base64 data of generated images */
  outputs: string[];
  
  /** The prediction/task ID from the provider (Replicate: id, DefAPI: task_id) */
  predictionId?: string;
}

/**
 * Provider adapter interface
 * Each provider (DefAPI, Replicate) must implement this interface
 */
export interface ProviderAdapter {
  /** Unique name of this provider (e.g., "defapi", "replicate") */
  name: string;
  
  /**
   * Submit a generation request to this provider
   * Some providers (Replicate) return results immediately via SDK,
   * others (DefAPI) return a task ID for polling
   */
  submitGeneration(input: GenerationInput): Promise<ProviderSubmitResult>;
  
  /**
   * Poll for generation result (for async providers like DefAPI)
   * Returns status and results when available
   */
  pollResult(taskId: string): Promise<ProviderPollResult>;
  
  /**
   * Check if this provider is properly configured (API key available, etc.)
   */
  isConfigured(): boolean;
}

/**
 * Configuration for a provider from the database
 */
export interface ProviderConfig {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string | null;
  apiKeyEnvVar: string;
  isEnabled: boolean;
}

/**
 * Model provider configuration from the database
 */
export interface ModelProviderConfigData {
  id: string;
  providerModelId: string;
  priority: number;
  costPerRequest: number;
  isEnabled: boolean;
  config: Record<string, unknown> | null;
  provider: ProviderConfig;
}

/**
 * Result of running generation through the orchestrator
 */
export interface OrchestratorResult {
  success: boolean;
  outputs?: string[];
  error?: string;
  
  /** Which provider was used successfully */
  usedProvider?: string;
  
  /** Total latency in milliseconds */
  latencyMs?: number;
  
  /** Cost charged by the successful provider */
  costCharged?: number;
  
  /** Number of providers attempted before success/failure */
  attemptsCount: number;
}

