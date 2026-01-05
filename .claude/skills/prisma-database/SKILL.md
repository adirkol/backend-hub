---
name: prisma-database
description: |
  Prisma ORM patterns for PostgreSQL database design and querying.
  Use when designing schemas, writing migrations, optimizing queries, or handling transactions.
---

# Prisma Database Skill

Expertise in Prisma ORM for type-safe database operations with PostgreSQL.

## Schema Design Patterns

### Model with Relations
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  
  // One-to-many relation
  effects   Effect[]
  
  // Metadata
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
}

model Effect {
  id        String   @id @default(cuid())
  name      String
  
  // Foreign key
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())

  @@index([userId])
}
```

### Enums and JSON Fields
```prisma
enum Plan {
  FREE
  STARTER
  PRO
  ENTERPRISE
}

model User {
  id       String @id @default(cuid())
  plan     Plan   @default(FREE)
  settings Json   @default("{}")
  
  // Optional JSON with type hint
  // preferences Json? @db.JsonB
}
```

### Self-Referential Relations
```prisma
model User {
  id         String  @id @default(cuid())
  
  // Referral system
  referredBy String?
  referrer   User?   @relation("Referrals", fields: [referredBy], references: [id])
  referrals  User[]  @relation("Referrals")
}
```

## Query Patterns

### Basic CRUD
```typescript
import { prisma } from '@/lib/db';

// Create
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    name: 'John',
  },
});

// Read
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// Update
const user = await prisma.user.update({
  where: { id: userId },
  data: { name: 'Jane' },
});

// Delete
await prisma.user.delete({
  where: { id: userId },
});
```

### Filtering and Pagination
```typescript
// Complex filtering
const effects = await prisma.effect.findMany({
  where: {
    AND: [
      { isActive: true },
      { category: { in: ['vintage', 'modern'] } },
      {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
    ],
  },
  orderBy: [
    { featured: 'desc' },
    { createdAt: 'desc' },
  ],
  skip: (page - 1) * pageSize,
  take: pageSize,
});

// Get total count for pagination
const [effects, total] = await prisma.$transaction([
  prisma.effect.findMany({ where, skip, take }),
  prisma.effect.count({ where }),
]);
```

### Relations and Includes
```typescript
// Include related data
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    effects: {
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    },
  },
});

// Select specific fields (more efficient)
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    credits: true,
    effects: {
      select: {
        id: true,
        name: true,
        resultUrl: true,
      },
      take: 5,
    },
  },
});
```

### Aggregations
```typescript
// Count
const count = await prisma.effect.count({
  where: { userId },
});

// Group by
const effectsByCategory = await prisma.effect.groupBy({
  by: ['category'],
  _count: { id: true },
  _avg: { credits: true },
  orderBy: { _count: { id: 'desc' } },
});

// Aggregate
const stats = await prisma.effect.aggregate({
  where: { userId },
  _count: true,
  _sum: { credits: true },
  _avg: { processingTime: true },
});
```

## Transactions

### Sequential Operations
```typescript
// Transaction ensures atomicity
const result = await prisma.$transaction(async (tx) => {
  // Deduct credits
  const user = await tx.user.update({
    where: { id: userId },
    data: { credits: { decrement: effect.credits } },
  });

  if (user.credits < 0) {
    throw new Error('Insufficient credits');
  }

  // Create effect record
  const userEffect = await tx.userEffect.create({
    data: {
      userId,
      effectId: effect.id,
      sourceUrl: imageUrl,
    },
  });

  return userEffect;
});
```

### Batch Operations
```typescript
// Batch transaction
const [deletedEffects, updatedUser] = await prisma.$transaction([
  prisma.effect.deleteMany({ where: { userId, status: 'FAILED' } }),
  prisma.user.update({ where: { id: userId }, data: { lastCleanup: new Date() } }),
]);
```

## Migrations

### Common Commands
```bash
# Create migration from schema changes
npx prisma migrate dev --name add_effects_table

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Generate client after schema changes
npx prisma generate
```

### Migration Best Practices
```prisma
// Adding a required field to existing table
// Step 1: Add as optional
model User {
  stripeCustomerId String?
}

// Step 2: Backfill data
// Step 3: Make required in next migration
model User {
  stripeCustomerId String
}
```

## Performance Optimization

### Indexing
```prisma
model Effect {
  id        String   @id @default(cuid())
  userId    String
  category  String
  status    Status
  createdAt DateTime @default(now())

  // Single column indexes
  @@index([userId])
  @@index([category])
  @@index([status])
  
  // Composite index for common queries
  @@index([userId, status, createdAt])
}
```

### Avoiding N+1 Queries
```typescript
// ❌ N+1 problem
const users = await prisma.user.findMany();
for (const user of users) {
  const effects = await prisma.effect.findMany({ where: { userId: user.id } });
}

// ✅ Single query with include
const users = await prisma.user.findMany({
  include: { effects: true },
});
```

### Query Logging
```typescript
// Enable query logging
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
  ],
});

prisma.$on('query', (e) => {
  console.log(`Query: ${e.query}`);
  console.log(`Duration: ${e.duration}ms`);
});
```

## Database Client Setup

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```






