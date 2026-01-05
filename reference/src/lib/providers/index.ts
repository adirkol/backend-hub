/**
 * Provider Adapters Index
 * 
 * This file exports all provider adapters and provides a factory function
 * to get an adapter by name.
 */

export * from "./types";
export { DefAPIAdapter, defapiAdapter } from "./defapi";
export { ReplicateAdapter, replicateAdapter } from "./replicate";
export { ProviderOrchestrator, runLegacyGeneration } from "./orchestrator";

import { ProviderAdapter } from "./types";
import { defapiAdapter } from "./defapi";
import { replicateAdapter } from "./replicate";

/**
 * Map of provider names to their adapter instances
 */
const providerAdapters: Record<string, ProviderAdapter> = {
  defapi: defapiAdapter,
  replicate: replicateAdapter,
};

/**
 * Get a provider adapter by name
 */
export function getProviderAdapter(providerName: string): ProviderAdapter | null {
  return providerAdapters[providerName] || null;
}

/**
 * Get all available provider adapters
 */
export function getAllProviderAdapters(): ProviderAdapter[] {
  return Object.values(providerAdapters);
}

/**
 * Check if a provider is available and configured
 */
export function isProviderAvailable(providerName: string): boolean {
  const adapter = providerAdapters[providerName];
  return adapter ? adapter.isConfigured() : false;
}

