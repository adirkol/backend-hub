---
name: nextauth-authentication
description: |
  NextAuth.js authentication patterns for Next.js applications.
  Use when implementing login flows, OAuth providers, magic links, or session management.
---

# NextAuth Authentication Skill

Expertise in NextAuth.js for authentication with multiple providers.

## Configuration

### NextAuth Setup
```typescript
// lib/auth.ts
import { NextAuthOptions, getServerSession } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';
import EmailProvider from 'next-auth/providers/email';
import { prisma } from '@/lib/db';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  
  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    
    // Apple Sign-In
    AppleProvider({
      clientId: process.env.APPLE_ID!,
      clientSecret: process.env.APPLE_SECRET!,
    }),
    
    // Email Magic Link
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      maxAge: 10 * 60, // 10 minutes
    }),
  ],

  pages: {
    signIn: '/login',
    verifyRequest: '/login/verify',
    error: '/login/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow all sign-ins by default
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.plan = user.plan;
      }

      // Handle session updates
      if (trigger === 'update') {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { plan: true, credits: true },
        });
        if (dbUser) {
          token.plan = dbUser.plan;
          token.credits = dbUser.credits;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.plan = token.plan as string;
      }
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      // Initialize new user with free credits
      await prisma.user.update({
        where: { id: user.id },
        data: {
          credits: 10, // Free tier credits
          referralCode: generateReferralCode(),
        },
      });
    },
  },
};

// Helper to get session in server components
export async function auth() {
  return getServerSession(authOptions);
}
```

### Type Extensions
```typescript
// types/next-auth.d.ts
import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      plan: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    plan: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    plan: string;
  }
}
```

## API Route Handler

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

## Middleware Protection

```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Redirect authenticated users away from auth pages
    if (pathname.startsWith('/login') && token) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Check for pro features
    if (pathname.startsWith('/dashboard/pro') && token?.plan === 'FREE') {
      return NextResponse.redirect(new URL('/pricing', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = req.nextUrl.pathname;

        // Public routes
        if (pathname === '/' || pathname.startsWith('/api/webhooks')) {
          return true;
        }

        // Auth routes
        if (pathname.startsWith('/login')) {
          return true;
        }

        // Protected routes require token
        if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) {
          return !!token;
        }

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*',
    '/login/:path*',
  ],
};
```

## Server Component Usage

```typescript
// app/dashboard/page.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      <p>Plan: {session.user.plan}</p>
    </div>
  );
}
```

## Client Component Usage

```typescript
// components/user-menu.tsx
'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!session) {
    return (
      <Button onClick={() => signIn()}>
        Sign In
      </Button>
    );
  }

  return (
    <div>
      <span>{session.user.email}</span>
      <Button variant="ghost" onClick={() => signOut()}>
        Sign Out
      </Button>
    </div>
  );
}
```

## Session Provider

```typescript
// app/providers.tsx
'use client';

import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}

// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## Login Page

```typescript
// app/login/page.tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await signIn('email', { email, callbackUrl });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <h1 className="text-2xl font-bold text-center">Sign In</h1>

        {error && (
          <div className="bg-red-500/10 text-red-500 p-4 rounded-lg">
            {error === 'OAuthAccountNotLinked' 
              ? 'Email already exists with different provider'
              : 'An error occurred'}
          </div>
        )}

        {/* OAuth Providers */}
        <div className="space-y-3">
          <Button
            className="w-full"
            variant="outline"
            onClick={() => signIn('google', { callbackUrl })}
          >
            Continue with Google
          </Button>
          
          <Button
            className="w-full"
            variant="outline"
            onClick={() => signIn('apple', { callbackUrl })}
          >
            Continue with Apple
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        {/* Email Magic Link */}
        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <Input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Sending link...' : 'Send Magic Link'}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

## Protected API Route

```typescript
// app/api/user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      credits: true,
    },
  });

  return NextResponse.json(user);
}
```






