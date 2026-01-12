/**
 * Redis-based Sliding Window Rate Limiter
 * 
 * Implements rate limiting per user and per app using Redis sorted sets.
 * Uses a sliding window algorithm for smooth rate limiting.
 */

import { redis } from "./redis";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when the window resets
  retryAfter?: number; // Seconds until retry (only if rate limited)
}

export interface RateLimitConfig {
  /** Requests allowed per window */
  limit: number;
  /** Window size in seconds (default: 60) */
  windowSeconds?: number;
}

/**
 * Check rate limit using sliding window algorithm
 * 
 * @param key - Unique identifier (e.g., "user:123" or "app:456")
 * @param config - Rate limit configuration
 * @returns Rate limit result with remaining requests
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { limit, windowSeconds = 60 } = config;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const redisKey = `ratelimit:${key}`;

  try {
    // Use a Redis transaction for atomicity
    const pipeline = redis.pipeline();
    
    // Remove old entries outside the window
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    
    // Count current requests in window
    pipeline.zcard(redisKey);
    
    // Add current request with timestamp as score
    pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);
    
    // Set expiry on the key
    pipeline.expire(redisKey, windowSeconds + 1);

    const results = await pipeline.exec();
    
    if (!results) {
      // Redis error, allow request but log
      console.error("[RateLimit] Pipeline returned null");
      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: Math.floor((now + windowSeconds * 1000) / 1000),
      };
    }

    // Get count before adding current request
    const currentCount = (results[1][1] as number) || 0;
    const remaining = Math.max(0, limit - currentCount - 1);
    const reset = Math.floor((now + windowSeconds * 1000) / 1000);

    if (currentCount >= limit) {
      // Rate limited - remove the request we just added
      await redis.zremrangebyscore(redisKey, now, now + 1);
      
      // Calculate retry after
      const oldestRequest = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
      let retryAfter = windowSeconds;
      
      if (oldestRequest.length >= 2) {
        const oldestTimestamp = parseInt(oldestRequest[1], 10);
        retryAfter = Math.ceil((oldestTimestamp + windowSeconds * 1000 - now) / 1000);
      }

      return {
        success: false,
        limit,
        remaining: 0,
        reset,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    return {
      success: true,
      limit,
      remaining,
      reset,
    };
  } catch (error) {
    console.error("[RateLimit] Error:", error);
    // On Redis error, allow the request (fail open)
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.floor((now + windowSeconds * 1000) / 1000),
    };
  }
}

/**
 * Check rate limits for both user and app
 * Returns the more restrictive result
 */
export async function checkApiRateLimits(params: {
  appId: string;
  userId: string;
  rateLimitPerUser: number;
  rateLimitPerApp: number;
  windowSeconds?: number;
}): Promise<{
  allowed: boolean;
  userLimit: RateLimitResult;
  appLimit: RateLimitResult;
}> {
  const { appId, userId, rateLimitPerUser, rateLimitPerApp, windowSeconds = 60 } = params;

  // Check both limits in parallel
  const [userLimit, appLimit] = await Promise.all([
    checkRateLimit(`user:${appId}:${userId}`, {
      limit: rateLimitPerUser,
      windowSeconds,
    }),
    checkRateLimit(`app:${appId}`, {
      limit: rateLimitPerApp,
      windowSeconds,
    }),
  ]);

  return {
    allowed: userLimit.success && appLimit.success,
    userLimit,
    appLimit,
  };
}

/**
 * Generate rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };

  if (result.retryAfter) {
    headers["Retry-After"] = result.retryAfter.toString();
  }

  return headers;
}
