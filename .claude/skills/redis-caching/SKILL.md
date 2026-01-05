---
name: redis-caching
description: |
  Redis caching patterns for performance optimization.
  Use when implementing caching strategies, session storage, or rate limiting.
---

# Redis Caching Skill

Expertise in Redis for caching, session management, and rate limiting.

## Client Setup

```typescript
// lib/redis.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
});

export { redis };
```

## Caching Patterns

### Basic Get/Set
```typescript
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 3600
): Promise<T> {
  const cached = await redis.get(key);
  
  if (cached) {
    return JSON.parse(cached) as T;
  }

  const data = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(data));
  
  return data;
}

// Usage
const effects = await getCached(
  'effects:active',
  () => prisma.effect.findMany({ where: { isActive: true } }),
  300 // 5 minutes
);
```

### Cache Invalidation
```typescript
// Invalidate single key
await redis.del('effects:active');

// Invalidate by pattern
const keys = await redis.keys('user:*:effects');
if (keys.length > 0) {
  await redis.del(...keys);
}

// Tag-based invalidation
async function invalidateByTag(tag: string) {
  const keys = await redis.smembers(`tag:${tag}`);
  if (keys.length > 0) {
    await redis.del(...keys);
    await redis.del(`tag:${tag}`);
  }
}
```

### Cache-Aside with Stale-While-Revalidate
```typescript
export async function getSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 3600,
  staleTTL = 300
): Promise<T> {
  const cached = await redis.get(key);
  const staleKey = `${key}:stale`;
  
  if (cached) {
    return JSON.parse(cached) as T;
  }

  // Check for stale data
  const stale = await redis.get(staleKey);
  
  if (stale) {
    // Return stale data and refresh in background
    refreshCache(key, staleKey, fetcher, ttl, staleTTL);
    return JSON.parse(stale) as T;
  }

  // No cache, fetch fresh
  const data = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(data));
  await redis.setex(staleKey, ttl + staleTTL, JSON.stringify(data));
  
  return data;
}

async function refreshCache<T>(
  key: string,
  staleKey: string,
  fetcher: () => Promise<T>,
  ttl: number,
  staleTTL: number
) {
  const data = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(data));
  await redis.setex(staleKey, ttl + staleTTL, JSON.stringify(data));
}
```

## Rate Limiting

### Sliding Window
```typescript
export async function rateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  // Remove old entries and count current
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, `${now}`);
  pipeline.zcard(key);
  pipeline.expire(key, windowSeconds);
  
  const results = await pipeline.exec();
  const count = results?.[2]?.[1] as number;

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    reset: Math.ceil((now + windowSeconds * 1000) / 1000),
  };
}

// Middleware usage
export async function rateLimitMiddleware(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'anonymous';
  const { allowed, remaining, reset } = await rateLimit(ip, 100, 60);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    );
  }

  return null; // Continue
}
```

### Token Bucket
```typescript
export async function tokenBucket(
  identifier: string,
  maxTokens: number,
  refillRate: number, // tokens per second
  tokensRequired = 1
): Promise<boolean> {
  const key = `bucket:${identifier}`;
  const now = Date.now();

  const script = `
    local tokens = tonumber(redis.call('hget', KEYS[1], 'tokens') or ARGV[1])
    local lastRefill = tonumber(redis.call('hget', KEYS[1], 'lastRefill') or ARGV[4])
    local elapsed = (tonumber(ARGV[4]) - lastRefill) / 1000
    local refill = elapsed * tonumber(ARGV[2])
    tokens = math.min(tonumber(ARGV[1]), tokens + refill)
    
    if tokens >= tonumber(ARGV[3]) then
      tokens = tokens - tonumber(ARGV[3])
      redis.call('hmset', KEYS[1], 'tokens', tokens, 'lastRefill', ARGV[4])
      redis.call('expire', KEYS[1], 3600)
      return 1
    end
    return 0
  `;

  const result = await redis.eval(
    script,
    1,
    key,
    maxTokens,
    refillRate,
    tokensRequired,
    now
  );

  return result === 1;
}
```

## Session Storage

```typescript
interface Session {
  userId: string;
  email: string;
  plan: string;
  expiresAt: number;
}

export async function setSession(sessionId: string, data: Session, ttl = 86400) {
  await redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const data = await redis.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
}

export async function deleteSession(sessionId: string) {
  await redis.del(`session:${sessionId}`);
}
```

## Pub/Sub for Real-time Updates

```typescript
// Publisher
export async function publishEffectComplete(userEffectId: string, resultUrl: string) {
  await redis.publish('effect:complete', JSON.stringify({
    userEffectId,
    resultUrl,
    timestamp: Date.now(),
  }));
}

// Subscriber (in separate process)
const subscriber = new Redis(process.env.REDIS_URL!);

subscriber.subscribe('effect:complete');

subscriber.on('message', (channel, message) => {
  if (channel === 'effect:complete') {
    const data = JSON.parse(message);
    // Notify connected clients via WebSocket
    notifyClient(data.userEffectId, data.resultUrl);
  }
});
```






