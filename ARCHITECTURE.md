# AI Backend Hub - Production Bootstrap Guide

> **Multi-tenant AI orchestration platform for iOS apps**
> 
> This document contains everything needed to bootstrap the AI Backend Hub project.
> It was generated from the PhotoMania.ai codebase architecture (https://github.com/photomania/photomania.ai).

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Environment Variables](#environment-variables)
6. [Database Schema](#database-schema)
7. [Setup Instructions](#setup-instructions)
8. [API Specification](#api-specification)
9. [Core Components](#core-components)
10. [Admin Panel](#admin-panel)
11. [Worker System](#worker-system)
12. [Deployment](#deployment)

---

## Project Overview

AI Backend Hub is a centralized backend platform that:

- **Manages multiple iOS apps** as tenants, each with isolated user bases
- **Orchestrates AI generation requests** across multiple providers (DefAPI, Replicate, OpenAI, etc.)
- **Handles token-based billing** with atomic debit/refund operations
- **Provides admin panel** for managing apps, models, providers, and monitoring
- **Scales horizontally** with Redis-backed job queues and workers

### Key Differences from Consumer Apps

| Aspect | Consumer App (PhotoMania) | AI Backend Hub |
|--------|---------------------------|----------------|
| Users | Direct sign-up (OAuth, email) | Apps provide user IDs |
| Auth | NextAuth sessions | API keys for apps |
| Frontend | Consumer-facing UI | Admin panel only |
| Entities | Effects, Categories | Apps, Models, Providers |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              iOS Apps                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │  PhotoMania  │  │   VideoAI    │  │  ArtStudio   │                       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                       │
│         │                 │                 │                                │
│         └────────────────┼─────────────────┘                                │
│                          │ REST API + API Keys                              │
└──────────────────────────┼──────────────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         AI Backend Hub                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Next.js Application                              │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │ │
│  │  │   Admin Panel   │  │   Public API    │  │      Admin API          │  │ │
│  │  │   /admin/*      │  │   /api/v1/*     │  │    /api/admin/*         │  │ │
│  │  └─────────────────┘  └────────┬────────┘  └─────────────────────────┘  │ │
│  │                                │                                         │ │
│  │  ┌─────────────────────────────┴─────────────────────────────────────┐  │ │
│  │  │                      Core Libraries                                │  │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │ │
│  │  │  │ API Auth │  │  Tokens  │  │  Queue   │  │ Provider Orch.   │   │  │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │  │ │
│  │  └───────────────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                          │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐   │
│  │                           Worker Process                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │   │
│  │  │  BullMQ Worker → Provider Orchestrator → Store Results → Webhook │  │   │
│  │  └─────────────────────────────────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
                           │                    │
              ┌────────────┴────────┐   ┌───────┴───────┐
              ▼                     ▼   ▼               ▼
       ┌─────────────┐      ┌─────────────┐    ┌─────────────────┐
       │  PostgreSQL │      │    Redis    │    │   AI Providers  │
       │   (Railway) │      │  (Upstash)  │    │ DefAPI/Replicate│
       └─────────────┘      └─────────────┘    └─────────────────┘
```

### Request Flow

1. **iOS App** sends generation request with API key + user ID
2. **API validates** API key, finds/creates AppUser, checks token balance
3. **Tokens reserved** atomically with idempotency key
4. **Job queued** in Redis via BullMQ
5. **Worker picks up job**, tries providers in priority order
6. **On success**: Store outputs to R2, update job, call webhook
7. **On failure**: Refund tokens, update job status, call webhook

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 14 (App Router) | API + Admin Panel |
| Database | PostgreSQL | Primary data store |
| ORM | Prisma | Database access |
| Queue | BullMQ + Redis | Job queue |
| Cache | Redis (Upstash) | Rate limiting, queue |
| Storage | Cloudflare R2 | Output images |
| Auth | API Keys + NextAuth (admin) | Authentication |
| Styling | Tailwind CSS + shadcn/ui | Admin UI |
| Validation | Zod | Request validation |

---

## Project Structure

```
ai-backend-hub/
├── .cursorrules                 # Cursor AI context
├── .env.example                 # Environment template
├── .gitignore
├── README.md
├── ARCHITECTURE.md              # This file (keep for reference)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.ts
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── seed.ts                  # Seed providers/models
│   └── migrations/
├── public/
│   └── logo.svg
├── scripts/
│   ├── seed-providers.ts        # Seed AI providers
│   └── test-providers.ts        # Test provider connectivity
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout
│   │   ├── globals.css          # Global styles
│   │   ├── (auth)/              # Admin authentication
│   │   │   ├── layout.tsx
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── admin/               # Admin panel
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx         # Dashboard
│   │   │   ├── apps/            # Manage apps (tenants)
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── new/
│   │   │   │       └── page.tsx
│   │   │   ├── models/          # AI Models
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── new/
│   │   │   │       └── page.tsx
│   │   │   ├── providers/       # AI Providers
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── provider-health.tsx
│   │   │   ├── jobs/            # View jobs
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── users/           # View users across apps
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   └── statistics/      # Analytics
│   │   │       └── page.tsx
│   │   └── api/
│   │       ├── v1/              # Public API for iOS apps
│   │       │   ├── generate/
│   │       │   │   └── route.ts
│   │       │   ├── jobs/
│   │       │   │   ├── route.ts
│   │       │   │   └── [id]/
│   │       │   │       └── route.ts
│   │       │   └── users/
│   │       │       ├── route.ts
│   │       │       ├── [externalId]/
│   │       │       │   ├── route.ts
│   │       │       │   └── tokens/
│   │       │       │       └── route.ts
│   │       │       └── tokens/
│   │       │           └── batch/
│   │       │               └── route.ts
│   │       ├── admin/           # Admin API
│   │       │   ├── apps/
│   │       │   ├── models/
│   │       │   ├── providers/
│   │       │   ├── jobs/
│   │       │   ├── users/
│   │       │   └── statistics/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts
│   │       └── health/
│   │           └── route.ts
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── table.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   └── admin-nav.tsx
│   │   └── providers.tsx
│   ├── lib/
│   │   ├── db.ts                # Prisma client
│   │   ├── redis.ts             # Redis client
│   │   ├── auth.ts              # Admin authentication
│   │   ├── api-auth.ts          # API key validation
│   │   ├── tokens.ts            # Token operations
│   │   ├── queue.ts             # BullMQ queue
│   │   ├── rate-limit.ts        # Rate limiting
│   │   ├── storage.ts           # R2 storage
│   │   ├── webhook.ts           # Webhook delivery
│   │   ├── utils.ts             # Utilities
│   │   ├── validation.ts        # Zod schemas
│   │   └── providers/           # AI Provider adapters
│   │       ├── index.ts
│   │       ├── types.ts
│   │       ├── orchestrator.ts
│   │       ├── defapi.ts
│   │       └── replicate.ts
│   ├── hooks/
│   │   └── use-toast.ts
│   ├── types/
│   │   └── next-auth.d.ts
│   ├── middleware.ts            # Route protection
│   └── worker/
│       └── index.ts             # Background worker
└── docker-compose.yml           # Local dev services
```

---

## Environment Variables

Create a `.env` file with:

```bash
# ===========================================
# Database
# ===========================================
DATABASE_URL="postgresql://user:password@localhost:5432/ai_backend_hub"

# ===========================================
# Redis (Upstash or local)
# ===========================================
REDIS_URL="redis://localhost:6379"
# Or for Upstash:
# REDIS_URL="rediss://default:xxx@xxx.upstash.io:6379"

# ===========================================
# Cloudflare R2 Storage
# ===========================================
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="ai-backend-outputs"
R2_PUBLIC_URL="https://your-r2-public-url.com"

# ===========================================
# AI Providers
# ===========================================
DEFAPI_API_KEY="your-defapi-key"
REPLICATE_API_TOKEN="your-replicate-token"
OPENAI_API_KEY="your-openai-key"

# ===========================================
# Admin Authentication (NextAuth)
# ===========================================
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Google OAuth (for admin login)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# ===========================================
# Application
# ===========================================
NODE_ENV="development"
API_RATE_LIMIT_PER_MINUTE="60"

# ===========================================
# Webhooks (optional)
# ===========================================
WEBHOOK_SECRET="your-webhook-signing-secret"
```

---

## Database Schema

### Complete Prisma Schema

```prisma
// prisma/schema.prisma
// AI Backend Hub - Multi-tenant AI Orchestration Platform

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// Admin Authentication (NextAuth)
// ============================================

model AdminUser {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?
  role          AdminRole @default(ADMIN)

  accounts      Account[]
  sessions      Session[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
}

enum AdminRole {
  ADMIN
  SUPER_ADMIN
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user AdminUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user AdminUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ============================================
// Multi-App Tenant System
// ============================================

model App {
  id               String   @id @default(cuid())
  name             String   // "PhotoMania", "VideoAI", "ArtStudio"
  slug             String   @unique
  description      String?
  
  // API Authentication
  apiKey           String   @unique @default(cuid())
  apiKeyPrefix     String?  // First 8 chars for display (e.g., "pm_live_")
  
  // Configuration
  isEnabled        Boolean  @default(true)
  defaultTokenGrant Int     @default(0)  // Tokens for new users
  
  // Webhook for job completion
  webhookUrl       String?
  webhookSecret    String?  // For signing webhook payloads
  
  // Rate limits (per minute)
  rateLimitPerUser Int      @default(30)
  rateLimitPerApp  Int      @default(1000)
  
  // Relations
  users            AppUser[]
  jobs             GenerationJob[]
  usageLogs        ProviderUsageLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([apiKey])
  @@index([slug])
}

// Users are scoped per-app (no cross-app identity)
model AppUser {
  id            String   @id @default(cuid())
  appId         String
  externalId    String   // iOS app's user ID (Firebase UID, etc.)
  
  // Optional metadata from the app
  metadata      Json?    // { "name": "John", "email": "john@example.com", ... }
  
  // Token balance for this user in this app
  tokenBalance  Int      @default(0)
  
  // Status
  isActive      Boolean  @default(true)

  app           App      @relation(fields: [appId], references: [id], onDelete: Cascade)
  tokenLedger   TokenLedgerEntry[]
  jobs          GenerationJob[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([appId, externalId])  // User is unique per app
  @@index([appId])
  @@index([externalId])
}

// ============================================
// Token System
// ============================================

model TokenLedgerEntry {
  id             String          @id @default(cuid())
  appUserId      String
  amount         Int             // Positive = credit, negative = debit
  balanceAfter   Int             // Balance after this transaction
  type           TokenEntryType
  description    String?
  jobId          String?         // Reference to job if applicable
  idempotencyKey String?         @unique // Prevent double processing

  appUser AppUser @relation(fields: [appUserId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([appUserId])
  @@index([jobId])
  @@index([idempotencyKey])
  @@index([createdAt])
}

enum TokenEntryType {
  GRANT              // Tokens granted by app
  GENERATION_DEBIT   // Tokens spent on generation
  GENERATION_REFUND  // Tokens refunded on failed generation
  ADMIN_ADJUSTMENT   // Manual adjustment by admin
  BONUS              // Promotional bonus tokens
  EXPIRY             // Tokens expired
}

// ============================================
// AI Provider & Model System
// ============================================

model AIProvider {
  id          String   @id @default(cuid())
  name        String   @unique  // "defapi", "replicate", "openai"
  displayName String              // "DefAPI", "Replicate", "OpenAI"
  baseUrl     String?             // "https://api.defapi.org"
  apiKeyEnvVar String             // "DEFAPI_API_KEY"
  isEnabled   Boolean  @default(true)
  
  // Health tracking
  lastHealthCheck DateTime?
  healthStatus    ProviderHealth @default(UNKNOWN)
  
  modelConfigs ModelProviderConfig[]
  usageLogs    ProviderUsageLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum ProviderHealth {
  HEALTHY
  DEGRADED
  DOWN
  UNKNOWN
}

model AIModel {
  id          String   @id @default(cuid())
  name        String   @unique  // "gpt-image-1.5", "nano-banana"
  displayName String              // "GPT Image 1.5", "Nano Banana"
  modelFamily String?             // "openai", "google"
  description String?  @db.Text
  
  // Pricing
  tokenCost   Int      @default(1)  // Base cost per generation
  
  // Capabilities
  supportsImages    Boolean @default(true)
  supportsPrompt    Boolean @default(true)
  maxInputImages    Int     @default(1)
  supportedAspectRatios String[] @default(["1:1", "16:9", "9:16", "4:3", "3:4"])
  
  isEnabled   Boolean  @default(true)

  providerConfigs ModelProviderConfig[]
  jobs            GenerationJob[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ModelProviderConfig {
  id              String   @id @default(cuid())
  modelId         String
  providerId      String
  providerModelId String             // "google/gemini-2.0-flash-exp" for DefAPI
  priority        Int      @default(1) // Lower = higher priority (1 = first)
  costPerRequest  Decimal  @default(0) @db.Decimal(10, 6)
  isEnabled       Boolean  @default(true)
  
  // Provider-specific config
  config          Json?    // { "aspect_ratio_map": {...}, ... }

  model    AIModel    @relation(fields: [modelId], references: [id], onDelete: Cascade)
  provider AIProvider @relation(fields: [providerId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([modelId, providerId])
  @@index([modelId, priority])
}

model ProviderUsageLog {
  id              String   @id @default(cuid())
  jobId           String
  appId           String?
  providerId      String
  providerModelId String
  providerTaskId  String?  // External task ID from provider
  attemptNumber   Int      @default(1)
  success         Boolean
  costCharged     Decimal? @db.Decimal(10, 6)
  latencyMs       Int?
  errorMessage    String?  @db.Text

  provider AIProvider @relation(fields: [providerId], references: [id])
  app      App?       @relation(fields: [appId], references: [id])

  createdAt DateTime @default(now())

  @@index([providerId])
  @@index([appId])
  @@index([jobId])
  @@index([createdAt])
}

// ============================================
// Generation Jobs
// ============================================

model GenerationJob {
  id          String    @id @default(cuid())
  appId       String
  appUserId   String
  aiModelId   String
  status      JobStatus @default(QUEUED)
  
  // Input data (flexible JSON structure)
  inputPayload Json     // { prompt, images: [...], aspect_ratio, ... }
  
  // Token tracking
  tokenCost      Int
  tokensCharged  Boolean  @default(false)
  tokensRefunded Boolean  @default(false)
  
  // Provider tracking
  providerTaskId String?
  usedProvider   String?
  attemptsCount  Int      @default(0)
  
  // Output
  outputs        Json?    // [{ url, index }, ...]
  
  // Error handling
  errorMessage   String?  @db.Text
  errorCode      String?
  
  // Webhook delivery
  webhookDelivered Boolean   @default(false)
  webhookAttempts  Int       @default(0)
  
  // Priority (lower = higher priority)
  priority       Int       @default(10)
  
  // Timing
  startedAt      DateTime?
  completedAt    DateTime?

  app      App      @relation(fields: [appId], references: [id])
  appUser  AppUser  @relation(fields: [appUserId], references: [id])
  aiModel  AIModel  @relation(fields: [aiModelId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([appId, status])
  @@index([appUserId])
  @@index([aiModelId])
  @@index([status, priority])
  @@index([providerTaskId])
  @@index([createdAt])
}

enum JobStatus {
  QUEUED
  RUNNING
  SUCCEEDED
  FAILED
  CANCELLED
}

// ============================================
// Audit Log (Optional but recommended)
// ============================================

model AuditLog {
  id          String   @id @default(cuid())
  action      String   // "app.created", "model.updated", "tokens.granted"
  entityType  String   // "App", "AIModel", "AppUser"
  entityId    String
  actorType   String   // "admin", "api", "system"
  actorId     String?  // AdminUser ID or App ID
  metadata    Json?    // Additional context
  ipAddress   String?

  createdAt DateTime @default(now())

  @@index([entityType, entityId])
  @@index([actorId])
  @@index([createdAt])
}
```

---

## Setup Instructions

### 1. Create New Project

```bash
# Create project directory
mkdir ai-backend-hub && cd ai-backend-hub

# Initialize with Next.js
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Copy this file to the project root
# Save as ARCHITECTURE.md
```

### 2. Install Dependencies

```bash
# Core dependencies
npm install @prisma/client bullmq ioredis zod next-auth @auth/prisma-adapter

# AI Providers
npm install replicate

# AWS SDK for R2
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# UI Components
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-select @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-toast
npm install class-variance-authority clsx tailwind-merge lucide-react

# Dev dependencies
npm install -D prisma tsx @types/node
```

### 3. Initialize Prisma

```bash
npx prisma init

# Copy the schema from this document to prisma/schema.prisma

# Generate client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init
```

### 4. Setup shadcn/ui

```bash
npx shadcn@latest init

# Add components
npx shadcn@latest add button card input label select table badge dialog dropdown-menu toast
```

### 5. Create Core Files

See the [Core Components](#core-components) section for file contents.

### 6. Run Development

```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Start worker
npx tsx --watch src/worker/index.ts
```

---

## API Specification

### Authentication

All public API endpoints require:
- Header: `X-API-Key: <app-api-key>`
- Header: `X-User-ID: <external-user-id>` (optional for some endpoints)

### Base URL

```
Production: https://api.yourdomain.com/api/v1
Development: http://localhost:3000/api/v1
```

### Endpoints

#### Generate Image

```http
POST /api/v1/generate
```

**Headers:**
```
X-API-Key: pm_live_abc123...
X-User-ID: firebase_uid_xyz
Content-Type: application/json
```

**Request Body:**
```json
{
  "model": "gpt-image-1.5",
  "input": {
    "prompt": "A futuristic city at sunset",
    "images": [
      "https://example.com/input.jpg"
    ],
    "aspect_ratio": "16:9",
    "num_outputs": 1
  },
  "priority": 5,
  "webhook_url": "https://yourapp.com/webhook/generation",
  "idempotency_key": "req_abc123"
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "clx1234567890",
  "status": "queued",
  "model": "gpt-image-1.5",
  "tokens_charged": 5,
  "user_balance": 45,
  "estimated_wait_seconds": 30
}
```

**Error Responses:**
```json
// 401 Unauthorized
{ "error": "Invalid API key" }

// 402 Payment Required  
{ "error": "Insufficient tokens", "balance": 2, "required": 5 }

// 429 Too Many Requests
{ "error": "Rate limit exceeded", "retry_after": 45 }

// 400 Bad Request
{ "error": "Invalid input", "details": {...} }
```

---

#### Get Job Status

```http
GET /api/v1/jobs/:jobId
```

**Response (200 OK):**
```json
{
  "job_id": "clx1234567890",
  "status": "succeeded",
  "model": "gpt-image-1.5",
  "created_at": "2024-01-15T10:30:00Z",
  "started_at": "2024-01-15T10:30:05Z",
  "completed_at": "2024-01-15T10:30:35Z",
  "outputs": [
    {
      "url": "https://r2.yourdomain.com/outputs/xyz/0.png",
      "index": 0
    }
  ],
  "tokens_charged": 5,
  "provider_used": "defapi"
}
```

**Status Values:**
- `queued` - Waiting in queue
- `running` - Currently processing
- `succeeded` - Completed successfully
- `failed` - Failed (tokens refunded)
- `cancelled` - Cancelled by user/admin

---

#### List Jobs

```http
GET /api/v1/jobs?status=succeeded&limit=20&cursor=clx123
```

**Query Parameters:**
- `status` - Filter by status
- `limit` - Max results (default: 20, max: 100)
- `cursor` - Pagination cursor (job ID)

---

#### Get User

```http
GET /api/v1/users/:externalId
```

**Response:**
```json
{
  "external_id": "firebase_uid_xyz",
  "token_balance": 45,
  "total_jobs": 127,
  "successful_jobs": 120,
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

#### Grant Tokens

```http
POST /api/v1/users/:externalId/tokens
```

**Request Body:**
```json
{
  "amount": 100,
  "reason": "Monthly subscription renewal",
  "idempotency_key": "sub_renewal_jan_2024"
}
```

**Response:**
```json
{
  "external_id": "firebase_uid_xyz",
  "previous_balance": 45,
  "amount_added": 100,
  "new_balance": 145,
  "transaction_id": "txn_abc123"
}
```

---

#### Batch Token Grant

```http
POST /api/v1/users/tokens/batch
```

**Request Body:**
```json
{
  "grants": [
    { "external_id": "user_1", "amount": 50, "reason": "Promo" },
    { "external_id": "user_2", "amount": 50, "reason": "Promo" }
  ],
  "idempotency_key": "promo_batch_jan"
}
```

---

### Webhook Payload

When a job completes, we POST to your `webhook_url`:

```json
{
  "event": "job.completed",
  "job_id": "clx1234567890",
  "status": "succeeded",
  "user_id": "firebase_uid_xyz",
  "outputs": [
    { "url": "https://...", "index": 0 }
  ],
  "tokens_charged": 5,
  "completed_at": "2024-01-15T10:30:35Z"
}
```

**Headers:**
```
X-Webhook-Signature: sha256=...
X-Webhook-Timestamp: 1705315835
```

---

## Core Components

### API Authentication (`src/lib/api-auth.ts`)

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export interface ApiAuthResult {
  success: boolean;
  app?: {
    id: string;
    name: string;
    slug: string;
    webhookUrl: string | null;
    rateLimitPerUser: number;
    rateLimitPerApp: number;
  };
  appUser?: {
    id: string;
    externalId: string;
    tokenBalance: number;
  };
  error?: string;
}

/**
 * Validate API key and optionally resolve user
 */
export async function validateApiRequest(
  req: NextRequest,
  options: { requireUser?: boolean } = {}
): Promise<ApiAuthResult> {
  const apiKey = req.headers.get("X-API-Key");
  const externalUserId = req.headers.get("X-User-ID");

  if (!apiKey) {
    return { success: false, error: "Missing API key" };
  }

  // Find app by API key
  const app = await prisma.app.findUnique({
    where: { apiKey },
    select: {
      id: true,
      name: true,
      slug: true,
      isEnabled: true,
      webhookUrl: true,
      webhookSecret: true,
      rateLimitPerUser: true,
      rateLimitPerApp: true,
      defaultTokenGrant: true,
    },
  });

  if (!app) {
    return { success: false, error: "Invalid API key" };
  }

  if (!app.isEnabled) {
    return { success: false, error: "App is disabled" };
  }

  // If user ID required, find or create user
  if (options.requireUser) {
    if (!externalUserId) {
      return { success: false, error: "Missing X-User-ID header" };
    }

    // Find or create user
    let appUser = await prisma.appUser.findUnique({
      where: {
        appId_externalId: {
          appId: app.id,
          externalId: externalUserId,
        },
      },
    });

    if (!appUser) {
      // Create new user with default token grant
      appUser = await prisma.appUser.create({
        data: {
          appId: app.id,
          externalId: externalUserId,
          tokenBalance: app.defaultTokenGrant,
        },
      });

      // Log initial token grant if any
      if (app.defaultTokenGrant > 0) {
        await prisma.tokenLedgerEntry.create({
          data: {
            appUserId: appUser.id,
            amount: app.defaultTokenGrant,
            balanceAfter: app.defaultTokenGrant,
            type: "GRANT",
            description: "Welcome tokens",
            idempotencyKey: `welcome_${appUser.id}`,
          },
        });
      }
    }

    if (!appUser.isActive) {
      return { success: false, error: "User is deactivated" };
    }

    return {
      success: true,
      app: {
        id: app.id,
        name: app.name,
        slug: app.slug,
        webhookUrl: app.webhookUrl,
        rateLimitPerUser: app.rateLimitPerUser,
        rateLimitPerApp: app.rateLimitPerApp,
      },
      appUser: {
        id: appUser.id,
        externalId: appUser.externalId,
        tokenBalance: appUser.tokenBalance,
      },
    };
  }

  return {
    success: true,
    app: {
      id: app.id,
      name: app.name,
      slug: app.slug,
      webhookUrl: app.webhookUrl,
      rateLimitPerUser: app.rateLimitPerUser,
      rateLimitPerApp: app.rateLimitPerApp,
    },
  };
}
```

---

### Token Operations (`src/lib/tokens.ts`)

```typescript
import { prisma } from "@/lib/db";
import { TokenEntryType } from "@prisma/client";

export interface TokenOperationResult {
  success: boolean;
  balance: number;
  transactionId?: string;
  error?: string;
}

/**
 * Reserve tokens for a generation job (atomic, idempotent)
 */
export async function reserveTokens(
  appUserId: string,
  amount: number,
  jobId: string,
  description?: string
): Promise<TokenOperationResult> {
  const idempotencyKey = `reserve_${jobId}`;

  try {
    // Check if already processed
    const existing = await prisma.tokenLedgerEntry.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      const user = await prisma.appUser.findUnique({
        where: { id: appUserId },
      });
      return { success: true, balance: user?.tokenBalance ?? 0 };
    }

    // Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const appUser = await tx.appUser.findUnique({
        where: { id: appUserId },
      });

      if (!appUser) {
        throw new Error("User not found");
      }

      if (appUser.tokenBalance < amount) {
        throw new Error("Insufficient tokens");
      }

      const newBalance = appUser.tokenBalance - amount;

      await tx.appUser.update({
        where: { id: appUserId },
        data: { tokenBalance: newBalance },
      });

      const entry = await tx.tokenLedgerEntry.create({
        data: {
          appUserId,
          amount: -amount,
          balanceAfter: newBalance,
          type: TokenEntryType.GENERATION_DEBIT,
          description: description ?? "Generation token debit",
          jobId,
          idempotencyKey,
        },
      });

      return { balance: newBalance, transactionId: entry.id };
    });

    return { success: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, balance: 0, error: message };
  }
}

/**
 * Refund tokens for a failed generation (atomic, idempotent)
 */
export async function refundTokens(
  appUserId: string,
  amount: number,
  jobId: string,
  description?: string
): Promise<TokenOperationResult> {
  const idempotencyKey = `refund_${jobId}`;

  try {
    const existing = await prisma.tokenLedgerEntry.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      const user = await prisma.appUser.findUnique({
        where: { id: appUserId },
      });
      return { success: true, balance: user?.tokenBalance ?? 0 };
    }

    const result = await prisma.$transaction(async (tx) => {
      const appUser = await tx.appUser.findUnique({
        where: { id: appUserId },
      });

      if (!appUser) {
        throw new Error("User not found");
      }

      const newBalance = appUser.tokenBalance + amount;

      await tx.appUser.update({
        where: { id: appUserId },
        data: { tokenBalance: newBalance },
      });

      const entry = await tx.tokenLedgerEntry.create({
        data: {
          appUserId,
          amount: amount,
          balanceAfter: newBalance,
          type: TokenEntryType.GENERATION_REFUND,
          description: description ?? "Generation refund",
          jobId,
          idempotencyKey,
        },
      });

      return { balance: newBalance, transactionId: entry.id };
    });

    return { success: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, balance: 0, error: message };
  }
}

/**
 * Grant tokens to a user (from app)
 */
export async function grantTokens(
  appUserId: string,
  amount: number,
  reason: string,
  idempotencyKey?: string
): Promise<TokenOperationResult> {
  const key = idempotencyKey ?? `grant_${appUserId}_${Date.now()}`;

  try {
    const existing = await prisma.tokenLedgerEntry.findUnique({
      where: { idempotencyKey: key },
    });

    if (existing) {
      const user = await prisma.appUser.findUnique({
        where: { id: appUserId },
      });
      return { success: true, balance: user?.tokenBalance ?? 0 };
    }

    const result = await prisma.$transaction(async (tx) => {
      const appUser = await tx.appUser.findUnique({
        where: { id: appUserId },
      });

      if (!appUser) {
        throw new Error("User not found");
      }

      const newBalance = appUser.tokenBalance + amount;

      await tx.appUser.update({
        where: { id: appUserId },
        data: { tokenBalance: newBalance },
      });

      const entry = await tx.tokenLedgerEntry.create({
        data: {
          appUserId,
          amount,
          balanceAfter: newBalance,
          type: TokenEntryType.GRANT,
          description: reason,
          idempotencyKey: key,
        },
      });

      return { balance: newBalance, transactionId: entry.id };
    });

    return { success: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, balance: 0, error: message };
  }
}

/**
 * Get user's token balance
 */
export async function getTokenBalance(appUserId: string): Promise<number> {
  const user = await prisma.appUser.findUnique({
    where: { id: appUserId },
  });
  return user?.tokenBalance ?? 0;
}
```

---

### Queue System (`src/lib/queue.ts`)

```typescript
import { Queue, Job } from "bullmq";
import type Redis from "ioredis";

export interface GenerationJobData {
  jobId: string;
  appId: string;
  appUserId: string;
  aiModelId: string;
  inputPayload: {
    prompt?: string;
    images?: string[];
    aspect_ratio?: string;
    num_outputs?: number;
    [key: string]: unknown;
  };
  webhookUrl?: string;
  webhookSecret?: string;
}

export interface GenerationJobResult {
  success: boolean;
  outputs?: Array<{ url: string; index: number }>;
  error?: string;
  usedProvider?: string;
}

let _generationQueue: Queue<GenerationJobData, GenerationJobResult> | null = null;

function getRedis(): Redis {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { redis } = require("@/lib/redis");
  return redis;
}

function getQueue(): Queue<GenerationJobData, GenerationJobResult> {
  if (!_generationQueue) {
    _generationQueue = new Queue<GenerationJobData, GenerationJobResult>(
      "ai-generation",
      {
        connection: getRedis(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 3600,
          },
          removeOnFail: {
            count: 5000,
          },
        },
      }
    );
  }
  return _generationQueue;
}

export async function addGenerationJob(
  data: GenerationJobData,
  priority?: number
): Promise<Job<GenerationJobData, GenerationJobResult>> {
  return getQueue().add("process", data, {
    jobId: data.jobId,
    priority: priority ?? 10,
  });
}

export async function getQueueJobStatus(jobId: string) {
  const job = await getQueue().getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  return {
    state,
    progress: job.progress,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  };
}

export const generationQueue = {
  add: async (
    name: string,
    data: GenerationJobData,
    options?: { jobId?: string; priority?: number }
  ) => getQueue().add(name, data, options),
  getJob: async (jobId: string) => getQueue().getJob(jobId),
};
```

---

### Generate Endpoint (`src/app/api/v1/generate/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { reserveTokens } from "@/lib/tokens";
import { addGenerationJob } from "@/lib/queue";

const GenerateSchema = z.object({
  model: z.string().min(1),
  input: z.object({
    prompt: z.string().optional(),
    images: z.array(z.string().url()).optional(),
    aspect_ratio: z.string().optional().default("1:1"),
    num_outputs: z.number().int().min(1).max(4).optional().default(1),
  }).passthrough(), // Allow additional provider-specific params
  priority: z.number().int().min(1).max(100).optional(),
  webhook_url: z.string().url().optional(),
  idempotency_key: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate request
    const auth = await validateApiRequest(req, { requireUser: true });
    if (!auth.success || !auth.app || !auth.appUser) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const validation = GenerateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { model, input, priority, webhook_url, idempotency_key } = validation.data;

    // Check idempotency
    if (idempotency_key) {
      const existingJob = await prisma.generationJob.findFirst({
        where: {
          appId: auth.app.id,
          appUserId: auth.appUser.id,
          inputPayload: {
            path: ["idempotency_key"],
            equals: idempotency_key,
          },
        },
      });

      if (existingJob) {
        return NextResponse.json({
          job_id: existingJob.id,
          status: existingJob.status.toLowerCase(),
          message: "Duplicate request - returning existing job",
        });
      }
    }

    // Find AI model
    const aiModel = await prisma.aIModel.findFirst({
      where: {
        OR: [
          { name: model },
          { id: model },
        ],
        isEnabled: true,
      },
    });

    if (!aiModel) {
      return NextResponse.json(
        { error: `Model not found: ${model}` },
        { status: 404 }
      );
    }

    // Calculate token cost
    const numOutputs = input.num_outputs ?? 1;
    const tokenCost = aiModel.tokenCost * numOutputs;

    // Check balance
    if (auth.appUser.tokenBalance < tokenCost) {
      return NextResponse.json(
        {
          error: "Insufficient tokens",
          balance: auth.appUser.tokenBalance,
          required: tokenCost,
        },
        { status: 402 }
      );
    }

    // Create job record
    const job = await prisma.generationJob.create({
      data: {
        appId: auth.app.id,
        appUserId: auth.appUser.id,
        aiModelId: aiModel.id,
        inputPayload: { ...input, idempotency_key },
        tokenCost,
        priority: priority ?? 10,
        status: "QUEUED",
      },
    });

    // Reserve tokens
    const tokenResult = await reserveTokens(
      auth.appUser.id,
      tokenCost,
      job.id,
      `Generation: ${aiModel.displayName}`
    );

    if (!tokenResult.success) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: tokenResult.error,
          errorCode: "INSUFFICIENT_TOKENS",
        },
      });

      return NextResponse.json(
        { error: tokenResult.error },
        { status: 402 }
      );
    }

    // Mark tokens charged
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { tokensCharged: true },
    });

    // Add to queue
    await addGenerationJob({
      jobId: job.id,
      appId: auth.app.id,
      appUserId: auth.appUser.id,
      aiModelId: aiModel.id,
      inputPayload: input,
      webhookUrl: webhook_url ?? auth.app.webhookUrl ?? undefined,
    });

    return NextResponse.json({
      job_id: job.id,
      status: "queued",
      model: aiModel.name,
      tokens_charged: tokenCost,
      user_balance: tokenResult.balance,
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

---

## Admin Panel

The admin panel structure follows PhotoMania's pattern. Key pages:

### Admin Layout (`src/app/admin/layout.tsx`)

```typescript
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  AppWindow,
  Layers,
  Zap,
  Users,
  History,
  BarChart3,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { auth } from "@/lib/auth";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/apps", label: "Apps", icon: AppWindow },
  { href: "/admin/models", label: "AI Models", icon: Layers },
  { href: "/admin/providers", label: "Providers", icon: Zap },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/jobs", label: "Jobs", icon: History },
  { href: "/admin/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-900">
        <div className="flex h-14 items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Exit Admin
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold text-white">AI Backend Hub</h1>
          </div>
          <span className="text-sm text-zinc-500">{session.user.email}</span>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 border-r border-zinc-800 bg-zinc-900 md:block">
          <nav className="flex flex-col gap-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
```

---

## Worker System

### Worker (`src/worker/index.ts`)

```typescript
import "dotenv/config";
import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ProviderOrchestrator } from "../lib/providers/orchestrator";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const orchestrator = new ProviderOrchestrator(prisma);

interface JobData {
  jobId: string;
  appId: string;
  appUserId: string;
  aiModelId: string;
  inputPayload: Record<string, unknown>;
  webhookUrl?: string;
}

interface JobResult {
  success: boolean;
  outputs?: Array<{ url: string; index: number }>;
  error?: string;
  usedProvider?: string;
}

async function uploadToR2(buffer: Buffer, key: string): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
    })
  );
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

async function deliverWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function refundTokens(jobId: string, appUserId: string): Promise<void> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });

  if (job && job.tokensCharged && !job.tokensRefunded) {
    const idempotencyKey = `refund_${jobId}`;
    const existing = await prisma.tokenLedgerEntry.findUnique({
      where: { idempotencyKey },
    });

    if (!existing) {
      await prisma.$transaction(async (tx) => {
        const user = await tx.appUser.findUnique({ where: { id: appUserId } });
        if (user) {
          const newBalance = user.tokenBalance + job.tokenCost;
          await tx.appUser.update({
            where: { id: appUserId },
            data: { tokenBalance: newBalance },
          });
          await tx.tokenLedgerEntry.create({
            data: {
              appUserId,
              amount: job.tokenCost,
              balanceAfter: newBalance,
              type: "GENERATION_REFUND",
              description: "Automatic refund for failed generation",
              jobId,
              idempotencyKey,
            },
          });
          await tx.generationJob.update({
            where: { id: jobId },
            data: { tokensRefunded: true },
          });
        }
      });
      console.log(`[Worker] Refunded ${job.tokenCost} tokens for job ${jobId}`);
    }
  }
}

async function processJob(job: Job<JobData, JobResult>): Promise<JobResult> {
  const { jobId, appId, appUserId, aiModelId, inputPayload, webhookUrl } = job.data;

  console.log(`[Worker] Processing job ${jobId}`);

  try {
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    await job.updateProgress(10);

    // Run generation through orchestrator
    const result = await orchestrator.runGeneration({
      aiModelId,
      prompt: inputPayload.prompt as string || "",
      imageUrls: inputPayload.images as string[] || [],
      aspectRatio: inputPayload.aspect_ratio as string,
      numberOfOutputs: inputPayload.num_outputs as number || 1,
      providerParams: inputPayload,
      jobId,
      onProgress: (msg, pct) => {
        console.log(`[Worker] ${msg}`);
        if (pct) job.updateProgress(10 + pct * 0.6);
      },
    });

    await job.updateProgress(70);

    if (!result.success || !result.outputs?.length) {
      throw new Error(result.error || "Generation failed");
    }

    // Store outputs to R2
    const storedOutputs: Array<{ url: string; index: number }> = [];
    for (let i = 0; i < result.outputs.length; i++) {
      const output = result.outputs[i];
      let storedUrl: string;

      if (output.startsWith("data:image/")) {
        const base64 = output.split(",")[1];
        const buffer = Buffer.from(base64, "base64");
        const key = `outputs/${appId}/${appUserId}/${jobId}-${i}.png`;
        storedUrl = await uploadToR2(buffer, key);
      } else {
        const response = await fetch(output);
        const buffer = Buffer.from(await response.arrayBuffer());
        const key = `outputs/${appId}/${appUserId}/${jobId}-${i}.png`;
        storedUrl = await uploadToR2(buffer, key);
      }

      storedOutputs.push({ url: storedUrl, index: i });
      await job.updateProgress(70 + ((i + 1) / result.outputs.length) * 25);
    }

    // Update job
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        outputs: storedOutputs,
        usedProvider: result.usedProvider,
        attemptsCount: result.attemptsCount,
        completedAt: new Date(),
      },
    });

    // Deliver webhook
    if (webhookUrl) {
      const delivered = await deliverWebhook(webhookUrl, {
        event: "job.completed",
        job_id: jobId,
        status: "succeeded",
        outputs: storedOutputs,
      });
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { webhookDelivered: delivered, webhookAttempts: 1 },
      });
    }

    await job.updateProgress(100);
    console.log(`[Worker] Job ${jobId} completed`);

    return { success: true, outputs: storedOutputs, usedProvider: result.usedProvider };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Worker] Job ${jobId} failed:`, errorMessage);

    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage,
        completedAt: new Date(),
      },
    });

    await refundTokens(jobId, appUserId);

    // Deliver failure webhook
    if (webhookUrl) {
      await deliverWebhook(webhookUrl, {
        event: "job.failed",
        job_id: jobId,
        status: "failed",
        error: errorMessage,
      });
    }

    throw error;
  }
}

const worker = new Worker<JobData, JobResult>("ai-generation", processJob, {
  connection: redis,
  concurrency: 5,
  limiter: { max: 20, duration: 1000 },
});

worker.on("completed", (job) => console.log(`✓ Job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`✗ Job ${job?.id} failed:`, err.message));

const shutdown = async () => {
  console.log("Shutting down...");
  await worker.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("🚀 AI Backend Hub worker started");
```

---

## Deployment

### Railway (Recommended)

1. **Create Railway project** with PostgreSQL and Redis add-ons
2. **Connect GitHub repo** for automatic deploys
3. **Add environment variables** in Railway dashboard
4. **Deploy web service** (Next.js app)
5. **Deploy worker service** separately:
   - Build command: `npm run build`
   - Start command: `node -r tsx/register src/worker/index.ts`

### Dockerfile (Optional)

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Package.json

```json
{
  "name": "ai-backend-hub",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "worker": "tsx --watch src/worker/index.ts",
    "worker:prod": "node -r tsx/register src/worker/index.ts",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@auth/prisma-adapter": "^2.0.0",
    "@aws-sdk/client-s3": "^3.500.0",
    "@aws-sdk/s3-request-presigner": "^3.500.0",
    "@prisma/client": "^5.10.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-toast": "^1.1.5",
    "bullmq": "^5.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "ioredis": "^5.3.2",
    "lucide-react": "^0.330.0",
    "next": "14.1.0",
    "next-auth": "^4.24.5",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "replicate": "^0.25.0",
    "tailwind-merge": "^2.2.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "autoprefixer": "^10.4.17",
    "eslint": "^8.56.0",
    "eslint-config-next": "14.1.0",
    "postcss": "^8.4.35",
    "prisma": "^5.10.0",
    "tailwindcss": "^3.4.1",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

---

## Quick Reference

### Files to Copy from PhotoMania.ai

These files can be copied with minimal modifications:

| Source File | Target File | Changes Needed |
|-------------|-------------|----------------|
| `src/lib/providers/orchestrator.ts` | Same | Minor: Remove effect-specific logic |
| `src/lib/providers/defapi.ts` | Same | None |
| `src/lib/providers/replicate.ts` | Same | None |
| `src/lib/providers/types.ts` | Same | None |
| `src/lib/providers/index.ts` | Same | None |
| `src/lib/redis.ts` | Same | None |
| `src/lib/storage.ts` | Same | None |
| `src/lib/rate-limit.ts` | Same | None |
| `src/components/ui/*` | Same | None |

---

## Next Steps

1. ✅ Create new repo
2. ✅ Copy this file as `ARCHITECTURE.md`
3. ⬜ Run `npx create-next-app@latest`
4. ⬜ Install dependencies
5. ⬜ Set up Prisma with schema
6. ⬜ Copy provider files from PhotoMania
7. ⬜ Implement API endpoints
8. ⬜ Build admin panel
9. ⬜ Deploy to Railway

---

*Generated from PhotoMania.ai architecture - January 2026*

