import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import { AppTabs } from "./app-tabs";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getAppData(id: string) {
  const app = await prisma.app.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          jobs: true,
        },
      },
    },
  });

  if (!app) return null;

  // Get recent users (first 20) with revenue data
  const users = await prisma.appUser.findMany({
    where: { appId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      _count: {
        select: { jobs: true },
      },
      revenueCatEvents: {
        where: { priceUsd: { not: null } },
        select: { priceUsd: true },
      },
    },
  });

  // Get recent jobs (first 20)
  const jobs = await prisma.generationJob.findMany({
    where: { appId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      appUser: { select: { externalId: true } },
      aiModel: { select: { displayName: true } },
    },
  });

  return { app, users, jobs };
}

export default async function AppDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getAppData(id);

  if (!data) {
    notFound();
  }

  const { app, users, jobs } = data;

  // Serialize dates for client component and calculate revenue
  const serializedUsers = users.map((u) => ({
    id: u.id,
    externalId: u.externalId,
    tokenBalance: u.tokenBalance,
    isPremium: u.isPremium,
    subscriptionStatus: u.subscriptionStatus,
    totalRevenue: u.revenueCatEvents.reduce((sum, e) => sum + Number(e.priceUsd || 0), 0),
    createdAt: u.createdAt.toISOString(),
    _count: u._count,
  }));

  const serializedJobs = jobs.map((j) => ({
    ...j,
    createdAt: j.createdAt.toISOString(),
    completedAt: j.completedAt?.toISOString() || null,
  }));

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div>
        <Link
          href="/admin/apps"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
            color: "#9ca3af",
            textDecoration: "none",
            marginBottom: "20px",
          }}
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} />
          Back to Apps
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
              {app.name}
            </h1>
            <p style={{ color: "#9ca3af", marginTop: "6px", fontSize: "15px", fontFamily: "monospace" }}>
              {app.slug}
            </p>
          </div>
          <span className={app.isEnabled ? "badge-success" : "badge-error"}>
            {app.isEnabled ? "Active" : "Disabled"}
          </span>
        </div>
      </div>

      {/* Tabs Component */}
      <AppTabs 
        app={app} 
        users={serializedUsers} 
        jobs={serializedJobs}
        userCount={app._count.users}
        jobCount={app._count.jobs}
      />
    </div>
  );
}
