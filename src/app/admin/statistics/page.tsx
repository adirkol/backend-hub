import { prisma } from "@/lib/db";
import { StatisticsClient } from "./statistics-client";

async function getStatistics() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  // Get data for last 90 days (maximum range)
  const ninetyDaysAgo = new Date(todayStart);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get all apps for filter dropdown
  const apps = await prisma.app.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Get daily job counts for the last 90 days
  const dailyStats = await prisma.$queryRaw<Array<{ date: Date; count: bigint; succeeded: bigint; failed: bigint }>>`
    SELECT 
      DATE("createdAt") as date,
      COUNT(*) as count,
      SUM(CASE WHEN status = 'SUCCEEDED' THEN 1 ELSE 0 END) as succeeded,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
    FROM "GenerationJob"
    WHERE "createdAt" >= ${ninetyDaysAgo}
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `.catch(() => []);

  // Get user growth for last 90 days
  const userGrowth = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
    SELECT 
      DATE("createdAt") as date,
      COUNT(*) as count
    FROM "AppUser"
    WHERE "createdAt" >= ${ninetyDaysAgo}
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `.catch(() => []);

  // Get provider usage
  const providerUsage = await prisma.providerUsageLog.groupBy({
    by: ["providerId"],
    where: { createdAt: { gte: ninetyDaysAgo } },
    _count: true,
    _sum: { latencyMs: true },
  });

  const providers = await prisma.aIProvider.findMany({
    select: { id: true, displayName: true },
  });

  const providerMap = new Map(providers.map((p) => [p.id, p.displayName]));

  // Get token usage
  const tokenStats = await prisma.tokenLedgerEntry.groupBy({
    by: ["type"],
    where: { createdAt: { gte: ninetyDaysAgo } },
    _sum: { amount: true },
    _count: true,
  });

  // Get top apps by jobs
  const topApps = await prisma.generationJob.groupBy({
    by: ["appId"],
    where: { createdAt: { gte: ninetyDaysAgo } },
    _count: true,
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  const appNames = await prisma.app.findMany({
    where: { id: { in: topApps.map((a) => a.appId) } },
    select: { id: true, name: true },
  });
  const appMap = new Map(appNames.map((a) => [a.id, a.name]));

  // Overall stats
  const [totalJobs, jobsThisMonth, jobsThisWeek, totalTokensUsed, totalUsers] = await Promise.all([
    prisma.generationJob.count(),
    prisma.generationJob.count({ where: { createdAt: { gte: ninetyDaysAgo } } }),
    prisma.generationJob.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.tokenLedgerEntry.aggregate({
      where: { type: "GENERATION_DEBIT", createdAt: { gte: ninetyDaysAgo } },
      _sum: { amount: true },
    }),
    prisma.appUser.count(),
  ]);

  // ===== REVENUE CALCULATIONS =====
  
  // Get all revenue events for 90 days
  const revenueEvents = await prisma.revenueCatEvent.findMany({
    where: {
      eventCategory: "REVENUE",
      createdAt: { gte: ninetyDaysAgo },
    },
    select: {
      id: true,
      eventType: true,
      productId: true,
      store: true,
      countryCode: true,
      priceUsd: true,
      netRevenueUsd: true,
      createdAt: true,
      appUser: {
        select: { externalId: true },
      },
    },
  });

  // Revenue by country
  const revenueByCountry = new Map<string, { amount: number; count: number }>();
  // Revenue by product
  const revenueByProduct = new Map<string, { amount: number; count: number }>();
  // Revenue by store
  const revenueByStore = new Map<string, { amount: number; count: number }>();
  // Daily revenue
  const dailyRevenue = new Map<string, number>();
  // Revenue by event type
  const revenueByEventType = new Map<string, { amount: number; count: number }>();
  // Total revenue
  let totalRevenue = 0;

  for (const event of revenueEvents) {
    const revenue = event.netRevenueUsd?.toNumber() || 0;
    totalRevenue += revenue;

    // By country
    const country = event.countryCode || "Unknown";
    const countryStats = revenueByCountry.get(country) || { amount: 0, count: 0 };
    countryStats.amount += revenue;
    countryStats.count += 1;
    revenueByCountry.set(country, countryStats);

    // By product
    const product = event.productId || "Unknown";
    const productStats = revenueByProduct.get(product) || { amount: 0, count: 0 };
    productStats.amount += revenue;
    productStats.count += 1;
    revenueByProduct.set(product, productStats);

    // By store
    const store = event.store || "Unknown";
    const storeStats = revenueByStore.get(store) || { amount: 0, count: 0 };
    storeStats.amount += revenue;
    storeStats.count += 1;
    revenueByStore.set(store, storeStats);

    // By event type
    const eventType = event.eventType;
    const eventTypeStats = revenueByEventType.get(eventType) || { amount: 0, count: 0 };
    eventTypeStats.amount += revenue;
    eventTypeStats.count += 1;
    revenueByEventType.set(eventType, eventTypeStats);

    // Daily
    const dateKey = event.createdAt.toISOString().split("T")[0];
    dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) || 0) + revenue);
  }

  // Format daily revenue for chart (last 90 days)
  const dailyRevenueChart: Array<{ date: string; rawDate: string; amount: number }> = [];
  for (let i = 89; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];
    dailyRevenueChart.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      rawDate: dateKey,
      amount: dailyRevenue.get(dateKey) || 0,
    });
  }

  // Get this week's revenue
  const revenueThisWeek = revenueEvents
    .filter(e => e.createdAt >= weekStart)
    .reduce((sum, e) => sum + (e.netRevenueUsd?.toNumber() || 0), 0);

  // Get top paying users (last 90 days)
  const userRevenueMap = new Map<string, number>();
  for (const event of revenueEvents) {
    const userId = event.appUser.externalId;
    const revenue = event.netRevenueUsd?.toNumber() || 0;
    userRevenueMap.set(userId, (userRevenueMap.get(userId) || 0) + revenue);
  }
  const topPayingUsers = Array.from(userRevenueMap.entries())
    .map(([userId, amount]) => ({ userId, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // ===== EXPENSE CALCULATIONS =====
  
  // Get all successful provider usage logs for 90 days
  const successfulLogs = await prisma.providerUsageLog.findMany({
    where: {
      success: true,
      createdAt: { gte: ninetyDaysAgo },
    },
    include: {
      provider: {
        select: { id: true, displayName: true },
      },
    },
  });

  // Get job to model mapping for the logs we have
  const jobIds = [...new Set(successfulLogs.map(log => log.jobId))];
  const jobs = await prisma.generationJob.findMany({
    where: { id: { in: jobIds } },
    select: {
      id: true,
      aiModelId: true,
      aiModel: {
        select: { id: true, displayName: true },
      },
    },
  });
  const jobModelMap = new Map(jobs.map(j => [j.id, { modelId: j.aiModelId, modelName: j.aiModel.displayName }]));

  // Get all model provider configs for cost lookup
  const modelProviderConfigs = await prisma.modelProviderConfig.findMany({
    select: {
      modelId: true,
      providerId: true,
      costPerRequest: true,
    },
  });

  // Create a lookup map for costs: modelId-providerId -> cost
  const costLookup = new Map<string, number>();
  for (const config of modelProviderConfigs) {
    costLookup.set(`${config.modelId}-${config.providerId}`, Number(config.costPerRequest));
  }

  // Calculate total expenses
  let totalExpenses = 0;
  const expensesByProvider = new Map<string, { name: string; amount: number; count: number }>();
  const expensesByModel = new Map<string, { name: string; amount: number; count: number }>();
  const dailyExpenses = new Map<string, number>();

  for (const log of successfulLogs) {
    const jobInfo = jobModelMap.get(log.jobId);
    const modelId = jobInfo?.modelId;
    const providerId = log.providerId;
    const cost = modelId ? (costLookup.get(`${modelId}-${providerId}`) || 0) : 0;

    totalExpenses += cost;

    // By provider
    const providerName = log.provider.displayName;
    const providerStats = expensesByProvider.get(providerId) || { name: providerName, amount: 0, count: 0 };
    providerStats.amount += cost;
    providerStats.count += 1;
    expensesByProvider.set(providerId, providerStats);

    // By model
    if (modelId && jobInfo) {
      const modelName = jobInfo.modelName;
      const modelStats = expensesByModel.get(modelId) || { name: modelName, amount: 0, count: 0 };
      modelStats.amount += cost;
      modelStats.count += 1;
      expensesByModel.set(modelId, modelStats);
    }

    // Daily expenses
    const dateKey = log.createdAt.toISOString().split("T")[0];
    dailyExpenses.set(dateKey, (dailyExpenses.get(dateKey) || 0) + cost);
  }

  // Get expenses for this week
  const expensesThisWeek = successfulLogs
    .filter(log => log.createdAt >= weekStart)
    .reduce((sum, log) => {
      const jobInfo = jobModelMap.get(log.jobId);
      const modelId = jobInfo?.modelId;
      const cost = modelId ? (costLookup.get(`${modelId}-${log.providerId}`) || 0) : 0;
      return sum + cost;
    }, 0);

  // Format daily expenses for chart (last 90 days)
  const dailyExpenseChart: Array<{ date: string; rawDate: string; amount: number }> = [];
  for (let i = 89; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];
    dailyExpenseChart.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      rawDate: dateKey,
      amount: dailyExpenses.get(dateKey) || 0,
    });
  }

  return {
    dailyStats: dailyStats.map((d) => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      rawDate: new Date(d.date).toISOString().split("T")[0],
      count: Number(d.count),
      succeeded: Number(d.succeeded),
      failed: Number(d.failed),
    })),
    userGrowth: userGrowth.map((d) => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      rawDate: new Date(d.date).toISOString().split("T")[0],
      count: Number(d.count),
    })),
    providerUsage: providerUsage.map((p) => ({
      provider: providerMap.get(p.providerId) || p.providerId,
      count: p._count,
      avgLatency: p._sum.latencyMs ? Math.round(p._sum.latencyMs / p._count) : 0,
    })),
    tokenStats: tokenStats.map((t) => ({
      type: t.type,
      total: Math.abs(t._sum.amount || 0),
      count: t._count,
    })),
    topApps: topApps.map((a) => ({
      id: a.appId,
      name: appMap.get(a.appId) || a.appId,
      jobs: a._count,
    })),
    totalJobs,
    jobsThisMonth,
    jobsThisWeek,
    tokensUsedThisMonth: Math.abs(totalTokensUsed._sum.amount || 0),
    totalUsers,
    apps,
    // Expense data
    expenses: {
      total: totalExpenses,
      thisMonth: totalExpenses,
      thisWeek: expensesThisWeek,
      byProvider: Array.from(expensesByProvider.values())
        .sort((a, b) => b.amount - a.amount),
      byModel: Array.from(expensesByModel.values())
        .sort((a, b) => b.amount - a.amount),
      daily: dailyExpenseChart,
    },
    // Revenue data
    revenue: {
      total: totalRevenue,
      thisWeek: revenueThisWeek,
      byCountry: Array.from(revenueByCountry.entries())
        .map(([code, stats]) => ({ code, ...stats }))
        .sort((a, b) => b.amount - a.amount),
      byProduct: Array.from(revenueByProduct.entries())
        .map(([product, stats]) => ({ product, ...stats }))
        .sort((a, b) => b.amount - a.amount),
      byStore: Array.from(revenueByStore.entries())
        .map(([store, stats]) => ({ store, ...stats }))
        .sort((a, b) => b.amount - a.amount),
      byEventType: Array.from(revenueByEventType.entries())
        .map(([type, stats]) => ({ type, ...stats }))
        .sort((a, b) => b.amount - a.amount),
      daily: dailyRevenueChart,
      topPayingUsers,
    },
  };
}

export default async function StatisticsPage() {
  const stats = await getStatistics();

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
          Statistics
        </h1>
        <p style={{ color: "#9ca3af", marginTop: "6px", fontSize: "15px" }}>
          Analytics and insights for your platform
        </p>
      </div>

      {/* Client-side tabs with filters */}
      <StatisticsClient data={stats} />
    </div>
  );
}
