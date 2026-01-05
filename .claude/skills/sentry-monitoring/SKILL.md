---
name: sentry-monitoring
description: |
  Sentry error tracking and performance monitoring.
  Use when implementing error tracking, performance monitoring, or debugging production issues.
---

# Sentry Monitoring Skill

Expertise in Sentry for error tracking and performance monitoring.

## Setup

### Installation
```bash
npx @sentry/wizard@latest -i nextjs
```

### Configuration
```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
});

// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
```

## Error Tracking

### Capture Exceptions
```typescript
import * as Sentry from '@sentry/nextjs';

try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      feature: 'effect-processing',
      effectId: effect.id,
    },
    extra: {
      userId: session.user.id,
      inputData: sanitizedInput,
    },
  });
  throw error;
}
```

### Custom Error Classes
```typescript
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 500,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    
    Sentry.setContext('error', { code, statusCode, ...context });
  }
}

// Usage
throw new AppError('INSUFFICIENT_CREDITS', 'Not enough credits', 402, {
  required: effect.credits,
  available: user.credits,
});
```

### User Context
```typescript
// Set user context after login
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.name,
  plan: user.plan,
});

// Clear on logout
Sentry.setUser(null);
```

## Performance Monitoring

### Custom Transactions
```typescript
const transaction = Sentry.startTransaction({
  name: 'process-effect',
  op: 'task',
});

try {
  const downloadSpan = transaction.startChild({
    op: 'http.client',
    description: 'Download source image',
  });
  await downloadImage(imageUrl);
  downloadSpan.finish();

  const processSpan = transaction.startChild({
    op: 'ai.process',
    description: 'Apply AI effect',
  });
  await processWithAI(image, config);
  processSpan.finish();

  const uploadSpan = transaction.startChild({
    op: 'http.client',
    description: 'Upload result to R2',
  });
  await uploadToR2(result);
  uploadSpan.finish();

  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('internal_error');
  throw error;
} finally {
  transaction.finish();
}
```

### Breadcrumbs
```typescript
Sentry.addBreadcrumb({
  category: 'effect',
  message: 'User selected vintage effect',
  level: 'info',
  data: { effectId: 'vintage', credits: 2 },
});
```

## API Route Error Handling

```typescript
// lib/api-handler.ts
import * as Sentry from '@sentry/nextjs';

export function withErrorHandling(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          url: req.url,
          method: req.method,
        },
      });

      if (error instanceof AppError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.statusCode }
        );
      }

      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
        { status: 500 }
      );
    }
  };
}
```

## Source Maps

```javascript
// next.config.js
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: 'photomania',
  project: 'photomania-web',
  widenClientFileUpload: true,
  hideSourceMaps: true,
});
```






