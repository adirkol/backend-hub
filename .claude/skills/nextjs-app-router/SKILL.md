---
name: nextjs-app-router
description: |
  Next.js 14+ App Router patterns and best practices.
  Use when building pages, layouts, implementing data fetching, or working with Server/Client Components.
---

# Next.js App Router Skill

Expertise in Next.js 14+ App Router architecture for building modern React applications.

## File Structure Conventions

```
app/
├── (auth)/                    # Route group (no URL segment)
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx             # Shared dashboard layout
│   ├── page.tsx               # /dashboard
│   ├── effects/
│   │   ├── page.tsx           # /dashboard/effects
│   │   └── [id]/page.tsx      # /dashboard/effects/:id
│   └── settings/page.tsx
├── api/
│   ├── effects/route.ts
│   └── webhooks/stripe/route.ts
├── layout.tsx                 # Root layout
├── page.tsx                   # Home page
├── loading.tsx                # Loading UI
├── error.tsx                  # Error boundary
├── not-found.tsx              # 404 page
└── globals.css
```

## Server vs Client Components

### Server Components (Default)
```tsx
// app/effects/page.tsx
// No 'use client' directive - this is a Server Component
import { prisma } from '@/lib/db';

export default async function EffectsPage() {
  // Direct database access in component
  const effects = await prisma.effect.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="grid grid-cols-4 gap-4">
      {effects.map(effect => (
        <EffectCard key={effect.id} effect={effect} />
      ))}
    </div>
  );
}
```

### Client Components (Interactive)
```tsx
// components/effect-uploader.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function EffectUploader() {
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();

  const handleUpload = async () => {
    // Client-side interactivity
    const formData = new FormData();
    formData.append('file', file!);
    
    await fetch('/api/upload', { method: 'POST', body: formData });
    router.refresh(); // Refresh server data
  };

  return (
    <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
  );
}
```

## Data Fetching Patterns

### Parallel Data Fetching
```tsx
// Fetch data in parallel to avoid waterfalls
export default async function DashboardPage() {
  const [user, effects, stats] = await Promise.all([
    getUser(),
    getRecentEffects(),
    getUserStats(),
  ]);

  return (
    <>
      <UserHeader user={user} />
      <EffectsGrid effects={effects} />
      <StatsOverview stats={stats} />
    </>
  );
}
```

### Streaming with Suspense
```tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      
      {/* Show immediately */}
      <QuickStats />
      
      {/* Stream in when ready */}
      <Suspense fallback={<EffectsGridSkeleton />}>
        <EffectsGrid />
      </Suspense>
    </div>
  );
}

// This component can be async
async function EffectsGrid() {
  const effects = await getEffects(); // Slow query
  return <Grid effects={effects} />;
}
```

## Server Actions

```tsx
// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const EffectSchema = z.object({
  name: z.string().min(1),
  category: z.string(),
});

export async function createEffect(formData: FormData) {
  const validated = EffectSchema.parse({
    name: formData.get('name'),
    category: formData.get('category'),
  });

  await prisma.effect.create({ data: validated });
  
  revalidatePath('/effects');
  redirect('/effects');
}

// Usage in Client Component
'use client';
import { createEffect } from '@/app/actions';

export function CreateEffectForm() {
  return (
    <form action={createEffect}>
      <input name="name" />
      <button type="submit">Create</button>
    </form>
  );
}
```

## Route Handlers (API Routes)

```tsx
// app/api/effects/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');

  const effects = await prisma.effect.findMany({
    where: category ? { category } : undefined,
  });

  return NextResponse.json(effects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const effect = await prisma.effect.create({ data: body });
  
  return NextResponse.json(effect, { status: 201 });
}
```

## Metadata & SEO

```tsx
// app/effects/[id]/page.tsx
import { Metadata } from 'next';

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const effect = await getEffect(params.id);
  
  return {
    title: `${effect.name} | PhotoMania`,
    description: effect.description,
    openGraph: {
      images: [effect.previewUrl],
    },
  };
}

export default async function EffectPage({ params }: Props) {
  const effect = await getEffect(params.id);
  return <EffectDetails effect={effect} />;
}
```

## Middleware

```tsx
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');

  if (isDashboard && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
```

## Caching Strategies

```tsx
// Opt out of caching for dynamic data
export const dynamic = 'force-dynamic';

// Or revalidate periodically
export const revalidate = 60; // Revalidate every 60 seconds

// Manual revalidation
import { revalidatePath, revalidateTag } from 'next/cache';

// In a Server Action or Route Handler
revalidatePath('/effects');
revalidateTag('effects');

// Tag-based caching
const effects = await fetch('https://api.example.com/effects', {
  next: { tags: ['effects'] },
});
```






