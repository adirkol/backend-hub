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
        <p style={{ color: "#71717a", marginTop: "6px", fontSize: "15px" }}>
          Analytics and insights for your platform
        </p>
      </div>

      {/* Client-side tabs with filters */}
      <StatisticsClient data={stats} />
    </div>
  );
}
