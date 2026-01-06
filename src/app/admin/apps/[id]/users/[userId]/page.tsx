import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import { UserTabs } from "./user-tabs";

interface PageProps {
  params: Promise<{ id: string; userId: string }>;
}

async function getUserData(appId: string, userId: string) {
  const user = await prisma.appUser.findFirst({
    where: { 
      id: userId,
      appId: appId,
    },
    include: {
      app: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      _count: {
        select: {
          jobs: true,
          tokenLedger: true,
          revenueCatEvents: true,
        },
      },
    },
  });

  if (!user) return null;

  // Get jobs (last 50)
  const jobs = await prisma.generationJob.findMany({
    where: { appUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      aiModel: { select: { displayName: true } },
    },
  });

  // Get token ledger entries (last 100)
  const tokenLedger = await prisma.tokenLedgerEntry.findMany({
    where: { appUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Get RevenueCat token events
  const tokenEvents = await prisma.revenueCatEvent.findMany({
    where: { 
      appUserId: userId,
      eventCategory: "TOKEN",
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Get RevenueCat revenue events
  const revenueEvents = await prisma.revenueCatEvent.findMany({
    where: { 
      appUserId: userId,
      eventCategory: "REVENUE",
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Calculate aggregated stats
  const totalTokensGranted = await prisma.tokenLedgerEntry.aggregate({
    where: { 
      appUserId: userId,
      amount: { gt: 0 },
    },
    _sum: { amount: true },
  });

  const totalTokensSpent = await prisma.tokenLedgerEntry.aggregate({
    where: { 
      appUserId: userId,
      amount: { lt: 0 },
    },
    _sum: { amount: true },
  });

  const totalRevenue = await prisma.revenueCatEvent.aggregate({
    where: { 
      appUserId: userId,
      eventCategory: "REVENUE",
      netRevenueUsd: { gt: 0 },
    },
    _sum: { netRevenueUsd: true },
  });

  // Get job IDs for this user to calculate expenses
  const userJobIds = await prisma.generationJob.findMany({
    where: { appUserId: userId },
    select: { id: true },
  });

  const totalExpenses = await prisma.providerUsageLog.aggregate({
    where: {
      jobId: { in: userJobIds.map(j => j.id) },
      success: true,
    },
    _sum: { costCharged: true },
  });

  return { 
    user, 
    jobs, 
    tokenLedger,
    tokenEvents,
    revenueEvents,
    stats: {
      totalTokensGranted: totalTokensGranted._sum.amount || 0,
      totalTokensSpent: Math.abs(totalTokensSpent._sum.amount || 0),
      totalRevenue: totalRevenue._sum.netRevenueUsd?.toNumber() || 0,
      totalExpenses: totalExpenses._sum?.costCharged?.toNumber() || 0,
    },
  };
}

export default async function UserDetailPage({ params }: PageProps) {
  const { id: appId, userId } = await params;
  const data = await getUserData(appId, userId);

  if (!data) {
    notFound();
  }

  const { user, jobs, tokenLedger, tokenEvents, revenueEvents, stats } = data;

  // Serialize for client component
  const serializedJobs = jobs.map((j) => ({
    ...j,
    createdAt: j.createdAt.toISOString(),
    startedAt: j.startedAt?.toISOString() || null,
    completedAt: j.completedAt?.toISOString() || null,
    updatedAt: j.updatedAt.toISOString(),
  }));

  const serializedTokenLedger = tokenLedger.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }));

  const serializedTokenEvents = tokenEvents.map((e) => ({
    ...e,
    eventTimestampMs: e.eventTimestampMs.toString(),
    purchasedAtMs: e.purchasedAtMs?.toString() || null,
    expirationAtMs: e.expirationAtMs?.toString() || null,
    priceUsd: e.priceUsd?.toNumber() || null,
    taxPercentage: e.taxPercentage?.toNumber() || null,
    commissionPercentage: e.commissionPercentage?.toNumber() || null,
    netRevenueUsd: e.netRevenueUsd?.toNumber() || null,
    createdAt: e.createdAt.toISOString(),
  }));

  const serializedRevenueEvents = revenueEvents.map((e) => ({
    ...e,
    eventTimestampMs: e.eventTimestampMs.toString(),
    purchasedAtMs: e.purchasedAtMs?.toString() || null,
    expirationAtMs: e.expirationAtMs?.toString() || null,
    priceUsd: e.priceUsd?.toNumber() || null,
    taxPercentage: e.taxPercentage?.toNumber() || null,
    commissionPercentage: e.commissionPercentage?.toNumber() || null,
    netRevenueUsd: e.netRevenueUsd?.toNumber() || null,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div>
        <Link
          href={`/admin/apps/${appId}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
            color: "#71717a",
            textDecoration: "none",
            marginBottom: "20px",
          }}
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} />
          Back to {user.app.name}
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
              User Details
            </h1>
            <p style={{ color: "#71717a", marginTop: "6px", fontSize: "15px", fontFamily: "monospace" }}>
              {user.externalId}
            </p>
          </div>
          <span className={user.isActive ? "badge-success" : "badge-error"}>
            {user.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Tabs Component */}
      <UserTabs 
        user={{
          id: user.id,
          externalId: user.externalId,
          tokenBalance: user.tokenBalance,
          isActive: user.isActive,
          metadata: user.metadata,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        }}
        appId={appId}
        jobs={serializedJobs}
        tokenLedger={serializedTokenLedger}
        tokenEvents={serializedTokenEvents}
        revenueEvents={serializedRevenueEvents}
        stats={stats}
        counts={user._count}
      />
    </div>
  );
}

