# PhotoMania.ai Agent & Skill Registry

This document provides an overview of the specialized agents and skills configured for the PhotoMania.ai project.

## Agents

Agents are specialized AI assistants with domain expertise for different aspects of the project.

### Core Development

| Agent | Path | Description |
|-------|------|-------------|
| **Coder** | `agents/core/coder.md` | Implementation specialist for clean, efficient code |
| **Reviewer** | `agents/core/reviewer.md` | Code review and quality assurance specialist |
| **Tester** | `agents/core/tester.md` | Testing and QA expert for comprehensive test coverage |

### Product & Strategy

| Agent | Path | Description |
|-------|------|-------------|
| **Product Strategist** | `agents/marketing/strategy/product-strategist.md` | Market analysis, roadmaps, and go-to-market |
| **Revenue Optimizer** | `agents/marketing/revenue/revenue-optimizer.md` | Pricing, monetization, and conversion optimization |
| **Growth Engineer** | `agents/marketing/growth/growth-engineer.md` | Growth hacking, A/B testing, and viral mechanics |

### Technical Specializations

| Agent | Path | Description |
|-------|------|-------------|
| **Code Analyzer** | `agents/analysis/code-review/analyze-code-quality.md` | Code quality analysis and technical debt assessment |
| **Backend Developer** | `agents/development/backend/dev-backend-api.md` | API development, database design, and backend architecture |
| **UI Designer** | `agents/ui/design/ui-designer.md` | Interface design, design systems, and accessibility |

## Skills

Skills provide deep expertise in specific technical domains.

### Framework & Libraries

| Skill | Path | Description |
|-------|------|-------------|
| **Next.js App Router** | `skills/nextjs-app-router/SKILL.md` | App Router patterns, Server Components, data fetching |
| **Tailwind + shadcn/ui** | `skills/tailwind-shadcn/SKILL.md` | Styling, components, and design system patterns |
| **React Hook Form + Zod** | `skills/react-hook-form-zod/SKILL.md` | Form handling and validation patterns |

### Backend & Data

| Skill | Path | Description |
|-------|------|-------------|
| **Prisma Database** | `skills/prisma-database/SKILL.md` | Schema design, queries, migrations, and optimization |
| **BullMQ Workers** | `skills/bullmq-workers/SKILL.md` | Background jobs, queues, and worker processes |
| **Redis Caching** | `skills/redis-caching/SKILL.md` | Caching strategies, rate limiting, sessions |

### Infrastructure & Services

| Skill | Path | Description |
|-------|------|-------------|
| **Stripe Integration** | `skills/stripe-integration/SKILL.md` | Subscriptions, webhooks, and payment processing |
| **NextAuth Authentication** | `skills/nextauth-authentication/SKILL.md` | OAuth, magic links, and session management |
| **Cloudflare R2 Storage** | `skills/cloudflare-r2-storage/SKILL.md` | File uploads, signed URLs, and storage patterns |
| **Sentry Monitoring** | `skills/sentry-monitoring/SKILL.md` | Error tracking and performance monitoring |

## Usage

### Activating an Agent

Reference an agent when you need specialized expertise:

```
@product-strategist Help me define pricing tiers for PhotoMania
@coder Implement the effect processing pipeline
@reviewer Review this PR for security issues
```

### Using Skills

Skills are automatically activated based on context. Each skill has an activation description in its frontmatter that determines when it should be used.

## Tech Stack Reference

| Category | Technologies |
|----------|-------------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Forms | React Hook Form, Zod |
| Auth | NextAuth, Email magic link, Google OAuth, Apple Sign-In |
| Database | PostgreSQL (Railway), Prisma ORM |
| Queue | Redis (Railway), BullMQ, Node.js worker process |
| Storage | Cloudflare R2 (S3 compatible), Signed URLs |
| Payments | Stripe Subscriptions, Webhooks |
| Monitoring | Sentry |

## Project Structure

```
.claude/
├── AGENTS.md                    # This file
├── agents/
│   ├── core/
│   │   ├── coder.md
│   │   ├── reviewer.md
│   │   └── tester.md
│   ├── marketing/
│   │   ├── strategy/
│   │   │   └── product-strategist.md
│   │   ├── revenue/
│   │   │   └── revenue-optimizer.md
│   │   └── growth/
│   │       └── growth-engineer.md
│   ├── analysis/
│   │   └── code-review/
│   │       └── analyze-code-quality.md
│   ├── development/
│   │   └── backend/
│   │       └── dev-backend-api.md
│   └── ui/
│       └── design/
│           └── ui-designer.md
└── skills/
    ├── nextjs-app-router/
    │   └── SKILL.md
    ├── prisma-database/
    │   └── SKILL.md
    ├── bullmq-workers/
    │   └── SKILL.md
    ├── stripe-integration/
    │   └── SKILL.md
    ├── nextauth-authentication/
    │   └── SKILL.md
    ├── react-hook-form-zod/
    │   └── SKILL.md
    ├── tailwind-shadcn/
    │   └── SKILL.md
    ├── cloudflare-r2-storage/
    │   └── SKILL.md
    ├── redis-caching/
    │   └── SKILL.md
    └── sentry-monitoring/
        └── SKILL.md
```






