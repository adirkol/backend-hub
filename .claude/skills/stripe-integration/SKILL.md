---
name: stripe-integration
description: |
  Stripe integration patterns for subscriptions and payments.
  Use when implementing checkout, managing subscriptions, handling webhooks, or processing payments.
---

# Stripe Integration Skill

Expertise in Stripe for subscription billing, payments, and customer management.

## Setup and Configuration

### Stripe Client
```typescript
// lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

// Price IDs (from Stripe Dashboard)
export const PRICES = {
  STARTER_MONTHLY: 'price_starter_monthly',
  STARTER_YEARLY: 'price_starter_yearly',
  PRO_MONTHLY: 'price_pro_monthly',
  PRO_YEARLY: 'price_pro_yearly',
} as const;

export const PLANS = {
  [PRICES.STARTER_MONTHLY]: { name: 'Starter', credits: 100, interval: 'month' },
  [PRICES.STARTER_YEARLY]: { name: 'Starter', credits: 100, interval: 'year' },
  [PRICES.PRO_MONTHLY]: { name: 'Pro', credits: 500, interval: 'month' },
  [PRICES.PRO_YEARLY]: { name: 'Pro', credits: 500, interval: 'year' },
} as const;
```

## Customer Management

### Create or Get Customer
```typescript
export async function getOrCreateStripeCustomer(userId: string, email: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  // Save to database
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
```

## Checkout Session

### Create Checkout Session
```typescript
// lib/stripe.ts
export async function createCheckoutSession({
  userId,
  email,
  priceId,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const customerId = await getOrCreateStripeCustomer(userId, email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { userId },
    },
    allow_promotion_codes: true,
  });

  return session;
}
```

### API Route for Checkout
```typescript
// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { createCheckoutSession, PRICES } from '@/lib/stripe';

const CheckoutSchema = z.object({
  priceId: z.enum([
    PRICES.STARTER_MONTHLY,
    PRICES.STARTER_YEARLY,
    PRICES.PRO_MONTHLY,
    PRICES.PRO_YEARLY,
  ]),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { priceId } = CheckoutSchema.parse(body);

  const checkoutSession = await createCheckoutSession({
    userId: session.user.id,
    email: session.user.email!,
    priceId,
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
```

## Customer Portal

### Billing Portal Session
```typescript
export async function createBillingPortalSession(customerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`,
  });

  return session;
}

// API Route
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: 'No subscription' }, { status: 400 });
  }

  const portalSession = await createBillingPortalSession(user.stripeCustomerId);
  return NextResponse.json({ url: portalSession.url });
}
```

## Webhook Handler

### Complete Webhook Implementation
```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, PLANS } from '@/lib/stripe';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return;

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  await handleSubscriptionChange(subscription);
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0].price.id;
  const plan = PLANS[priceId as keyof typeof PLANS];

  if (!plan) {
    console.error('Unknown price ID:', priceId);
    return;
  }

  const planName = plan.name.toUpperCase() as 'STARTER' | 'PRO';

  await prisma.user.update({
    where: { stripeCustomerId: customerId },
    data: {
      plan: planName,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  await prisma.user.update({
    where: { stripeCustomerId: customerId },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
    },
  });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Refill credits on billing cycle renewal
  if (invoice.billing_reason !== 'subscription_cycle') return;

  const customerId = invoice.customer as string;
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true, stripePriceId: true },
  });

  if (!user?.stripePriceId) return;

  const plan = PLANS[user.stripePriceId as keyof typeof PLANS];
  if (!plan) return;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      credits: plan.credits,
      creditsRefilledAt: new Date(),
    },
  });

  console.log(`Refilled ${plan.credits} credits for user ${user.id}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  // Send email notification about failed payment
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (user) {
    await sendEmail({
      to: user.email,
      template: 'payment-failed',
      data: { invoiceUrl: invoice.hosted_invoice_url },
    });
  }
}
```

## Subscription Status Helpers

```typescript
// lib/subscription.ts
export async function getSubscriptionStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      credits: true,
      stripeCurrentPeriodEnd: true,
      creditsRefilledAt: true,
    },
  });

  if (!user) return null;

  const isActive = user.plan !== 'FREE';
  const daysUntilRenewal = user.stripeCurrentPeriodEnd
    ? Math.ceil((user.stripeCurrentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    plan: user.plan,
    credits: user.credits,
    isActive,
    daysUntilRenewal,
    nextRefill: user.stripeCurrentPeriodEnd,
  };
}

export async function hasEnoughCredits(userId: string, required: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  return (user?.credits ?? 0) >= required;
}

export async function deductCredits(userId: string, amount: number) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { credits: { decrement: amount } },
  });

  if (user.credits < 0) {
    // Rollback
    await prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    });
    throw new Error('Insufficient credits');
  }

  return user.credits;
}
```

## Testing Webhooks Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
```






