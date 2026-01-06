import { prisma } from "@/lib/db";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Zap,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Receipt,
} from "lucide-react";

async function getStatistics() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 30);

  // Get daily job counts for the last 14 days
  const dailyStats = await prisma.$queryRaw<Array<{ date: Date; count: bigint; succeeded: bigint; failed: bigint }>>`
    SELECT 
      DATE("createdAt") as date,
      COUNT(*) as count,
      SUM(CASE WHEN status = 'SUCCEEDED' THEN 1 ELSE 0 END) as succeeded,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
    FROM "GenerationJob"
    WHERE "createdAt" >= ${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)}
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `.catch(() => []);

  // Get user growth
  const userGrowth = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
    SELECT 
      DATE("createdAt") as date,
      COUNT(*) as count
    FROM "AppUser"
    WHERE "createdAt" >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `.catch(() => []);

  // Get provider usage
  const providerUsage = await prisma.providerUsageLog.groupBy({
    by: ["providerId"],
    where: { createdAt: { gte: monthStart } },
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
    where: { createdAt: { gte: monthStart } },
    _sum: { amount: true },
    _count: true,
  });

  // Get top apps by jobs
  const topApps = await prisma.generationJob.groupBy({
    by: ["appId"],
    where: { createdAt: { gte: monthStart } },
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
  const [totalJobs, jobsThisMonth, jobsThisWeek, totalTokensUsed] = await Promise.all([
    prisma.generationJob.count(),
    prisma.generationJob.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.generationJob.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.tokenLedgerEntry.aggregate({
      where: { type: "GENERATION_DEBIT", createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
  ]);

  // ===== EXPENSE CALCULATIONS =====
  
  // Get all successful provider usage logs
  const successfulLogs = await prisma.providerUsageLog.findMany({
    where: {
      success: true,
      createdAt: { gte: monthStart },
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

  // Format daily expenses for chart (last 14 days)
  const dailyExpenseChart: Array<{ date: string; amount: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];
    dailyExpenseChart.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount: dailyExpenses.get(dateKey) || 0,
    });
  }

  return {
    dailyStats: dailyStats.map((d) => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: Number(d.count),
      succeeded: Number(d.succeeded),
      failed: Number(d.failed),
    })),
    userGrowth: userGrowth.map((d) => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
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
      name: appMap.get(a.appId) || a.appId,
      jobs: a._count,
    })),
    totalJobs,
    jobsThisMonth,
    jobsThisWeek,
    tokensUsedThisMonth: Math.abs(totalTokensUsed._sum.amount || 0),
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

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="glass" style={{ padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: "14px", color: "#71717a", marginBottom: "8px" }}>{title}</p>
          <p style={{ fontSize: "32px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {change !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "12px" }}>
              {change >= 0 ? (
                <TrendingUp style={{ width: "16px", height: "16px", color: "#34d399" }} />
              ) : (
                <TrendingDown style={{ width: "16px", height: "16px", color: "#f87171" }} />
              )}
              <span style={{ fontSize: "14px", color: change >= 0 ? "#34d399" : "#f87171" }}>
                {change >= 0 ? "+" : ""}{change}%
              </span>
              <span style={{ fontSize: "14px", color: "#71717a" }}>vs last period</span>
            </div>
          )}
        </div>
        <div style={{
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Icon style={{ width: "22px", height: "22px", color: iconColor }} />
        </div>
      </div>
    </div>
  );
}

function MiniChart({ data }: { data: Array<{ value: number }> }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = Math.min(...data.map((d) => d.value));
  const range = maxValue - minValue || 1;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "80px" }}>
      {data.map((item, i) => (
        <div
          key={i}
          style={{ 
            flex: 1, 
            background: "linear-gradient(180deg, #10b981 0%, rgba(16, 185, 129, 0.4) 100%)",
            borderRadius: "4px 4px 0 0",
            height: `${Math.max(((item.value - minValue) / range) * 100, 8)}%`,
            transition: "all 0.3s ease",
          }}
          title={`${item.value}`}
        />
      ))}
    </div>
  );
}

function SimpleBarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {data.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span style={{ 
            fontSize: "13px", 
            color: "#a1a1aa", 
            width: "100px", 
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {item.label}
          </span>
          <div style={{ flex: 1, height: "28px", background: "rgba(39, 39, 42, 0.5)", borderRadius: "6px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                background: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                borderRadius: "6px",
                width: `${(item.value / maxValue) * 100}%`,
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <span style={{ fontSize: "14px", color: "#e4e4e7", fontWeight: "600", width: "70px", textAlign: "right" }}>
            {item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function ExpenseChart({ data }: { data: Array<{ date: string; amount: number }> }) {
  const maxAmount = Math.max(...data.map((d) => d.amount), 0.01);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "120px" }}>
      {data.map((item, i) => {
        const heightPercent = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              height: "100%",
            }}
          >
            <div
              style={{ 
                width: "100%",
                background: item.amount > 0 
                  ? "linear-gradient(180deg, #f87171 0%, rgba(248, 113, 113, 0.4) 100%)"
                  : "rgba(63, 63, 70, 0.3)",
                borderRadius: "4px 4px 0 0",
                height: `${Math.max(heightPercent, item.amount > 0 ? 8 : 4)}%`,
                transition: "all 0.3s ease",
                minHeight: item.amount > 0 ? "6px" : "2px",
              }}
              title={`${item.date}: $${item.amount.toFixed(4)}`}
            />
          </div>
        );
      })}
    </div>
  );
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

      {/* Expense Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
        <StatCard
          title="Total Expenses (Month)"
          value={`$${stats.expenses.thisMonth.toFixed(2)}`}
          icon={Receipt}
          iconBg="linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.3) 100%)"
          iconColor="#f87171"
        />
        <StatCard
          title="Expenses (Week)"
          value={`$${stats.expenses.thisWeek.toFixed(2)}`}
          icon={DollarSign}
          iconBg="linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.3) 100%)"
          iconColor="#fbbf24"
        />
        <StatCard
          title="Jobs This Month"
          value={stats.jobsThisMonth}
          icon={Zap}
          iconBg="linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)"
          iconColor="#34d399"
        />
        <StatCard
          title="Avg Cost per Job"
          value={stats.jobsThisMonth > 0 
            ? `$${(stats.expenses.thisMonth / stats.jobsThisMonth).toFixed(4)}` 
            : "$0.00"}
          icon={BarChart3}
          iconBg="linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)"
          iconColor="#60a5fa"
        />
      </div>

      {/* Expense Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
        {/* Expenses Over Time */}
        <div className="glass" style={{ padding: "28px" }}>
          <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
            Expenses (Last 14 Days)
          </h3>
          {stats.expenses.daily.some(d => d.amount > 0) ? (
            <>
              <ExpenseChart data={stats.expenses.daily} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                <span style={{ fontSize: "12px", color: "#71717a" }}>{stats.expenses.daily[0]?.date}</span>
                <span style={{ fontSize: "12px", color: "#71717a" }}>{stats.expenses.daily[stats.expenses.daily.length - 1]?.date}</span>
              </div>
              <p style={{ marginTop: "20px", fontSize: "14px", color: "#a1a1aa" }}>
                Total: <span style={{ color: "#f87171", fontWeight: "600" }}>${stats.expenses.thisMonth.toFixed(2)}</span>
              </p>
            </>
          ) : (
            <p style={{ color: "#71717a", textAlign: "center", padding: "40px 0" }}>No expense data available</p>
          )}
        </div>

        {/* Expenses by Provider */}
        <div className="glass" style={{ padding: "28px" }}>
          <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
            Expenses by Provider
          </h3>
          {stats.expenses.byProvider.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {stats.expenses.byProvider.map((p, i) => (
                <div key={i} style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between", 
                  padding: "16px", 
                  borderRadius: "12px", 
                  background: "rgba(39, 39, 42, 0.4)",
                  border: "1px solid rgba(63, 63, 70, 0.3)",
                }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: "500", color: "#e4e4e7" }}>{p.name}</p>
                    <p style={{ fontSize: "13px", color: "#71717a", marginTop: "4px" }}>{p.count.toLocaleString()} requests</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "16px", fontWeight: "600", color: "#f87171" }}>${p.amount.toFixed(2)}</p>
                    <p style={{ fontSize: "13px", color: "#71717a", marginTop: "4px" }}>
                      ${p.count > 0 ? (p.amount / p.count).toFixed(4) : "0.0000"}/req
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#71717a", textAlign: "center", padding: "40px 0" }}>No data available</p>
          )}
        </div>
      </div>

      {/* Expenses by Model */}
      <div className="glass" style={{ padding: "28px" }}>
        <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
          Expenses by Model
        </h3>
        {stats.expenses.byModel.length > 0 ? (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
            gap: "16px" 
          }}>
            {stats.expenses.byModel.map((m, i) => (
              <div key={i} style={{ 
                padding: "20px", 
                borderRadius: "12px", 
                background: "rgba(39, 39, 42, 0.4)",
                border: "1px solid rgba(63, 63, 70, 0.3)",
              }}>
                <p style={{ fontSize: "15px", fontWeight: "500", color: "#e4e4e7", marginBottom: "8px" }}>
                  {m.name}
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                  <span style={{ fontSize: "24px", fontWeight: "700", color: "#f87171" }}>
                    ${m.amount.toFixed(2)}
                  </span>
                  <span style={{ fontSize: "13px", color: "#71717a" }}>
                    {m.count.toLocaleString()} jobs
                  </span>
                </div>
                <p style={{ fontSize: "13px", color: "#71717a", marginTop: "8px" }}>
                  Avg: ${m.count > 0 ? (m.amount / m.count).toFixed(4) : "0.0000"}/request
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "#71717a", textAlign: "center", padding: "40px 0" }}>No expense data available</p>
        )}
      </div>

      {/* Job Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
        <StatCard
          title="Total Jobs"
          value={stats.totalJobs}
          icon={Zap}
          iconBg="linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)"
          iconColor="#34d399"
        />
        <StatCard
          title="Jobs This Week"
          value={stats.jobsThisWeek}
          icon={Clock}
          iconBg="linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.3) 100%)"
          iconColor="#fbbf24"
        />
        <StatCard
          title="Tokens Used (Month)"
          value={stats.tokensUsedThisMonth}
          icon={DollarSign}
          iconBg="linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.3) 100%)"
          iconColor="#a78bfa"
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
        {/* Jobs Over Time */}
        <div className="glass" style={{ padding: "28px" }}>
          <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
            Jobs (Last 14 Days)
          </h3>
          {stats.dailyStats.length > 0 ? (
            <>
              <MiniChart data={stats.dailyStats.map((d) => ({ value: d.count }))} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                <span style={{ fontSize: "12px", color: "#71717a" }}>{stats.dailyStats[0]?.date}</span>
                <span style={{ fontSize: "12px", color: "#71717a" }}>{stats.dailyStats[stats.dailyStats.length - 1]?.date}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "24px", marginTop: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle style={{ width: "16px", height: "16px", color: "#34d399" }} />
                  <span style={{ fontSize: "14px", color: "#a1a1aa" }}>
                    {stats.dailyStats.reduce((sum, d) => sum + d.succeeded, 0)} succeeded
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <XCircle style={{ width: "16px", height: "16px", color: "#f87171" }} />
                  <span style={{ fontSize: "14px", color: "#a1a1aa" }}>
                    {stats.dailyStats.reduce((sum, d) => sum + d.failed, 0)} failed
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p style={{ color: "#71717a", textAlign: "center", padding: "40px 0" }}>No data available</p>
          )}
        </div>

        {/* New Users */}
        <div className="glass" style={{ padding: "28px" }}>
          <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
            New Users (Last 30 Days)
          </h3>
          {stats.userGrowth.length > 0 ? (
            <>
              <MiniChart data={stats.userGrowth.map((d) => ({ value: d.count }))} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                <span style={{ fontSize: "12px", color: "#71717a" }}>{stats.userGrowth[0]?.date}</span>
                <span style={{ fontSize: "12px", color: "#71717a" }}>{stats.userGrowth[stats.userGrowth.length - 1]?.date}</span>
              </div>
              <p style={{ marginTop: "20px", fontSize: "14px", color: "#a1a1aa" }}>
                <span style={{ color: "#34d399", fontWeight: "600" }}>
                  {stats.userGrowth.reduce((sum, d) => sum + d.count, 0)}
                </span>{" "}
                new users this month
              </p>
            </>
          ) : (
            <p style={{ color: "#71717a", textAlign: "center", padding: "40px 0" }}>No data available</p>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        {/* Top Apps */}
        <div className="glass" style={{ padding: "28px" }}>
          <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
            Top Apps (This Month)
          </h3>
          {stats.topApps.length > 0 ? (
            <SimpleBarChart data={stats.topApps.map((a) => ({ label: a.name, value: a.jobs }))} />
          ) : (
            <p style={{ color: "#71717a", textAlign: "center", padding: "40px 0" }}>No data available</p>
          )}
        </div>

        {/* Provider Usage */}
        <div className="glass" style={{ padding: "28px" }}>
          <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
            Provider Usage
          </h3>
          {stats.providerUsage.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {stats.providerUsage.map((p, i) => (
                <div key={i} style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between", 
                  padding: "16px", 
                  borderRadius: "12px", 
                  background: "rgba(39, 39, 42, 0.4)",
                  border: "1px solid rgba(63, 63, 70, 0.3)",
                }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: "500", color: "#e4e4e7" }}>{p.provider}</p>
                    <p style={{ fontSize: "13px", color: "#71717a", marginTop: "4px" }}>{p.count.toLocaleString()} requests</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "14px", color: "#e4e4e7" }}>{p.avgLatency}ms</p>
                    <p style={{ fontSize: "13px", color: "#71717a", marginTop: "4px" }}>avg latency</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#71717a", textAlign: "center", padding: "40px 0" }}>No data available</p>
          )}
        </div>

        {/* Token Flow */}
        <div className="glass" style={{ padding: "28px" }}>
          <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
            Token Flow (This Month)
          </h3>
          {stats.tokenStats.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {stats.tokenStats.map((t, i) => {
                const typeLabels: Record<string, { label: string; color: string }> = {
                  GRANT: { label: "Granted", color: "#34d399" },
                  GENERATION_DEBIT: { label: "Used", color: "#f87171" },
                  GENERATION_REFUND: { label: "Refunded", color: "#fbbf24" },
                  ADMIN_ADJUSTMENT: { label: "Adjusted", color: "#60a5fa" },
                  BONUS: { label: "Bonus", color: "#a78bfa" },
                  EXPIRY: { label: "Expired", color: "#a1a1aa" },
                };
                const config = typeLabels[t.type] || { label: t.type, color: "#a1a1aa" };

                return (
                  <div key={i} style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between", 
                    padding: "12px 0",
                    borderBottom: i < stats.tokenStats.length - 1 ? "1px solid rgba(63, 63, 70, 0.3)" : "none",
                  }}>
                    <span style={{ fontSize: "14px", color: "#a1a1aa" }}>{config.label}</span>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: config.color }}>
                      {t.total.toLocaleString()} tokens
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "#71717a", textAlign: "center", padding: "40px 0" }}>No data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
