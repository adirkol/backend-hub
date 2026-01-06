"use client";

import { useState } from "react";
import { 
  User, 
  Zap, 
  Coins, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Package,
  RefreshCw,
  CreditCard,
  XCircle,
} from "lucide-react";

interface Job {
  id: string;
  status: string;
  tokenCost: number;
  createdAt: string;
  completedAt: string | null;
  aiModel: { displayName: string } | null;
}

interface TokenLedgerEntry {
  id: string;
  amount: number;
  balanceAfter: number;
  type: string;
  description: string | null;
  jobId: string | null;
  createdAt: string;
  expiresAt: string | null;
}

interface RevenueCatEvent {
  id: string;
  revenueCatEventId: string;
  transactionId: string | null;
  eventType: string;
  eventCategory: string;
  productId: string | null;
  store: string | null;
  environment: string;
  tokenAmount: number | null;
  tokenCurrencyCode: string | null;
  source: string | null;
  priceUsd: number | null;
  netRevenueUsd: number | null;
  cancelReason: string | null;
  renewalNumber: number | null;
  eventTimestampMs: string;
  createdAt: string;
}

interface UserData {
  id: string;
  externalId: string;
  tokenBalance: number;
  isActive: boolean;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  totalTokensGranted: number;
  totalTokensSpent: number;
  totalRevenue: number;
  totalExpenses: number;
}

interface EffectiveBalance {
  rawBalance: number;
  effectiveBalance: number;
  expiredTokens: number;
}

interface UserTabsProps {
  user: UserData;
  appId: string;
  jobs: Job[];
  tokenLedger: TokenLedgerEntry[];
  tokenEvents: RevenueCatEvent[];
  revenueEvents: RevenueCatEvent[];
  stats: Stats;
  counts: {
    jobs: number;
    tokenLedger: number;
    revenueCatEvents: number;
  };
  effectiveBalance: EffectiveBalance;
}

type TabType = "overview" | "jobs" | "tokens" | "revenue";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function formatEventTimestamp(timestampMs: string): string {
  return new Date(parseInt(timestampMs)).toLocaleString();
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "INITIAL_PURCHASE":
      return <CreditCard style={{ width: "16px", height: "16px" }} />;
    case "RENEWAL":
      return <RefreshCw style={{ width: "16px", height: "16px" }} />;
    case "NON_RENEWING_PURCHASE":
      return <Package style={{ width: "16px", height: "16px" }} />;
    case "CANCELLATION":
      return <XCircle style={{ width: "16px", height: "16px" }} />;
    default:
      return <DollarSign style={{ width: "16px", height: "16px" }} />;
  }
}

function getEventLabel(eventType: string): string {
  switch (eventType) {
    case "INITIAL_PURCHASE":
      return "Initial Purchase";
    case "RENEWAL":
      return "Renewal";
    case "NON_RENEWING_PURCHASE":
      return "One-time Purchase";
    case "CANCELLATION":
      return "Cancellation";
    case "VIRTUAL_CURRENCY_TRANSACTION":
      return "Token Transaction";
    default:
      return eventType;
  }
}

export function UserTabs({ 
  user, 
  appId,
  jobs, 
  tokenLedger, 
  tokenEvents,
  revenueEvents,
  stats,
  counts,
  effectiveBalance,
}: UserTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const roas = stats.totalExpenses > 0 
    ? ((stats.totalRevenue / stats.totalExpenses) * 100).toFixed(1) 
    : stats.totalRevenue > 0 ? "∞" : "0";

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "overview", label: "Overview", icon: <User style={{ width: "16px", height: "16px" }} /> },
    { id: "jobs", label: "Jobs", icon: <Zap style={{ width: "16px", height: "16px" }} />, count: counts.jobs },
    { id: "tokens", label: "Tokens", icon: <Coins style={{ width: "16px", height: "16px" }} />, count: counts.tokenLedger },
    { id: "revenue", label: "Revenue", icon: <DollarSign style={{ width: "16px", height: "16px" }} />, count: revenueEvents.length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
        <div className="glass" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.3) 100%)",
              border: "1px solid rgba(251, 191, 36, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Coins style={{ width: "20px", height: "20px", color: "#fbbf24" }} />
            </div>
            <div>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#fafafa" }}>
                {effectiveBalance.effectiveBalance.toLocaleString()}
              </p>
              <p style={{ fontSize: "13px", color: "#71717a" }}>
                Token Balance
                {effectiveBalance.expiredTokens > 0 && (
                  <span style={{ color: "#f87171", marginLeft: "6px" }}>
                    ({effectiveBalance.expiredTokens} expired)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="glass" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <DollarSign style={{ width: "20px", height: "20px", color: "#34d399" }} />
            </div>
            <div>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#fafafa" }}>
                {formatCurrency(stats.totalRevenue)}
              </p>
              <p style={{ fontSize: "13px", color: "#71717a" }}>Net Revenue</p>
            </div>
          </div>
        </div>

        <div className="glass" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.3) 100%)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <ArrowDownRight style={{ width: "20px", height: "20px", color: "#f87171" }} />
            </div>
            <div>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#fafafa" }}>
                {formatCurrency(stats.totalExpenses)}
              </p>
              <p style={{ fontSize: "13px", color: "#71717a" }}>AI Expenses</p>
            </div>
          </div>
        </div>

        <div className="glass" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.3) 100%)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <TrendingUp style={{ width: "20px", height: "20px", color: "#a78bfa" }} />
            </div>
            <div>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#fafafa" }}>
                {roas}%
              </p>
              <p style={{ fontSize: "13px", color: "#71717a" }}>ROAS</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: "flex", 
        gap: "4px", 
        borderBottom: "1px solid rgba(63, 63, 70, 0.4)",
        paddingBottom: "0",
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px 20px",
              fontSize: "14px",
              fontWeight: "500",
              color: activeTab === tab.id ? "#fafafa" : "#71717a",
              background: activeTab === tab.id ? "rgba(39, 39, 42, 0.6)" : "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #10b981" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s ease",
              marginBottom: "-1px",
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "10px",
                background: activeTab === tab.id ? "rgba(16, 185, 129, 0.2)" : "rgba(63, 63, 70, 0.5)",
                color: activeTab === tab.id ? "#34d399" : "#a1a1aa",
              }}>
                {tab.count.toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
          {/* User Details */}
          <div className="glass" style={{ padding: "28px" }}>
            <h2 style={{ 
              fontWeight: "600", 
              color: "#e4e4e7", 
              marginBottom: "20px", 
              fontSize: "16px",
            }}>
              User Information
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Internal ID
                </label>
                <p style={{ fontSize: "14px", color: "#e4e4e7", fontFamily: "monospace", marginTop: "6px" }}>
                  {user.id}
                </p>
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  External ID
                </label>
                <p style={{ fontSize: "14px", color: "#e4e4e7", fontFamily: "monospace", marginTop: "6px" }}>
                  {user.externalId}
                </p>
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Created
                </label>
                <p style={{ fontSize: "14px", color: "#e4e4e7", marginTop: "6px" }}>
                  {formatDate(user.createdAt)}
                </p>
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Last Updated
                </label>
                <p style={{ fontSize: "14px", color: "#e4e4e7", marginTop: "6px" }}>
                  {formatDate(user.updatedAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Token Summary */}
          <div className="glass" style={{ padding: "28px" }}>
            <h2 style={{ 
              fontWeight: "600", 
              color: "#e4e4e7", 
              marginBottom: "20px", 
              fontSize: "16px",
            }}>
              Token Summary
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: "#a1a1aa" }}>Total Granted</span>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#34d399", display: "flex", alignItems: "center", gap: "6px" }}>
                  <ArrowUpRight style={{ width: "16px", height: "16px" }} />
                  {stats.totalTokensGranted.toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: "#a1a1aa" }}>Total Spent</span>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#f87171", display: "flex", alignItems: "center", gap: "6px" }}>
                  <ArrowDownRight style={{ width: "16px", height: "16px" }} />
                  {stats.totalTokensSpent.toLocaleString()}
                </span>
              </div>
              <div style={{ 
                borderTop: "1px solid rgba(63, 63, 70, 0.4)", 
                paddingTop: "16px", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center" 
              }}>
                <span style={{ fontSize: "14px", color: "#e4e4e7", fontWeight: "500" }}>Current Balance</span>
                <span style={{ fontSize: "20px", fontWeight: "700", color: "#fbbf24" }}>
                  {user.tokenBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Revenue Summary */}
          <div className="glass" style={{ padding: "28px" }}>
            <h2 style={{ 
              fontWeight: "600", 
              color: "#e4e4e7", 
              marginBottom: "20px", 
              fontSize: "16px",
            }}>
              Revenue Summary
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: "#a1a1aa" }}>Net Revenue</span>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#34d399" }}>
                  {formatCurrency(stats.totalRevenue)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: "#a1a1aa" }}>AI Expenses</span>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#f87171" }}>
                  {formatCurrency(stats.totalExpenses)}
                </span>
              </div>
              <div style={{ 
                borderTop: "1px solid rgba(63, 63, 70, 0.4)", 
                paddingTop: "16px", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center" 
              }}>
                <span style={{ fontSize: "14px", color: "#e4e4e7", fontWeight: "500" }}>Net Profit</span>
                <span style={{ 
                  fontSize: "20px", 
                  fontWeight: "700", 
                  color: stats.totalRevenue - stats.totalExpenses >= 0 ? "#34d399" : "#f87171" 
                }}>
                  {formatCurrency(stats.totalRevenue - stats.totalExpenses)}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="glass" style={{ padding: "28px" }}>
            <h2 style={{ 
              fontWeight: "600", 
              color: "#e4e4e7", 
              marginBottom: "20px", 
              fontSize: "16px",
            }}>
              Recent Activity
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {(() => {
                // Combine token and revenue activities
                const tokenActivities = tokenLedger.map((entry) => ({
                  id: entry.id,
                  type: "token" as const,
                  label: entry.description || entry.type.replace(/_/g, " "),
                  date: entry.createdAt,
                  value: entry.amount,
                  valueType: "tokens" as const,
                }));
                
                const revenueActivities = revenueEvents.map((event) => ({
                  id: event.id,
                  type: "revenue" as const,
                  label: `${getEventLabel(event.eventType)}${event.productId ? ` - ${event.productId}` : ""}`,
                  date: new Date(parseInt(event.eventTimestampMs)).toISOString(),
                  value: event.netRevenueUsd,
                  valueType: "currency" as const,
                }));
                
                const allActivities = [...tokenActivities, ...revenueActivities]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 8);
                
                if (allActivities.length === 0) {
                  return (
                    <p style={{ fontSize: "14px", color: "#71717a", textAlign: "center", padding: "20px" }}>
                      No activity yet
                    </p>
                  );
                }
                
                return allActivities.map((activity) => (
                  <div 
                    key={activity.id}
                    style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      padding: "12px",
                      borderRadius: "8px",
                      background: "rgba(39, 39, 42, 0.4)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        background: activity.type === "revenue" 
                          ? "rgba(16, 185, 129, 0.15)" 
                          : "rgba(251, 191, 36, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        {activity.type === "revenue" ? (
                          <DollarSign style={{ width: "14px", height: "14px", color: "#34d399" }} />
                        ) : (
                          <Coins style={{ width: "14px", height: "14px", color: "#fbbf24" }} />
                        )}
                      </div>
                      <div>
                        <p style={{ fontSize: "13px", color: "#e4e4e7" }}>{activity.label}</p>
                        <p style={{ fontSize: "11px", color: "#71717a", marginTop: "2px" }}>
                          {formatDate(activity.date)}
                        </p>
                      </div>
                    </div>
                    {activity.valueType === "currency" && activity.value !== null ? (
                      <span style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: activity.value >= 0 ? "#34d399" : "#f87171",
                      }}>
                        {activity.value >= 0 ? "+" : ""}{formatCurrency(activity.value)}
                      </span>
                    ) : activity.valueType === "tokens" ? (
                      <span style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: (activity.value as number) > 0 ? "#34d399" : "#f87171",
                      }}>
                        {(activity.value as number) > 0 ? "+" : ""}{activity.value} tokens
                      </span>
                    ) : null}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {activeTab === "jobs" && (
        <div className="glass" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.4)" }}>
                {["Job ID", "Model", "Status", "Tokens", "Created", "Completed"].map((header) => (
                  <th 
                    key={header}
                    style={{ 
                      padding: "16px 20px", 
                      textAlign: "left", 
                      fontSize: "12px", 
                      fontWeight: "600",
                      color: "#71717a",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr 
                  key={job.id} 
                  className="table-row-hover"
                  style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.25)", cursor: "pointer" }}
                  onClick={() => window.location.href = `/admin/jobs/${job.id}`}
                >
                  <td style={{ padding: "18px 20px" }}>
                    <code style={{ 
                      fontSize: "12px", 
                      color: "#a1a1aa", 
                      background: "rgba(39, 39, 42, 0.5)", 
                      padding: "6px 10px", 
                      borderRadius: "6px",
                      fontFamily: "monospace",
                    }}>
                      {job.id.slice(0, 12)}...
                    </code>
                  </td>
                  <td style={{ padding: "18px 20px", fontSize: "14px", color: "#e4e4e7" }}>
                    {job.aiModel?.displayName || "-"}
                  </td>
                  <td style={{ padding: "18px 20px" }}>
                    <span className={
                      job.status === "SUCCEEDED" ? "badge-success" :
                      job.status === "FAILED" ? "badge-error" :
                      job.status === "RUNNING" ? "badge-warning" : "badge-default"
                    }>
                      {job.status}
                    </span>
                  </td>
                  <td style={{ padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Coins style={{ width: "14px", height: "14px", color: "#facc15" }} />
                      <span style={{ color: "#fafafa", fontSize: "14px" }}>{job.tokenCost}</span>
                    </div>
                  </td>
                  <td style={{ padding: "18px 20px", fontSize: "13px", color: "#71717a" }}>
                    {formatDate(job.createdAt)}
                  </td>
                  <td style={{ padding: "18px 20px", fontSize: "13px", color: "#71717a" }}>
                    {job.completedAt ? formatDate(job.completedAt) : "-"}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "64px 20px", textAlign: "center", color: "#71717a" }}>
                    No jobs yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "tokens" && (
        <div className="glass" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.4)" }}>
                {["Type", "Description", "Amount", "Balance After", "Date", "Expires"].map((header) => (
                  <th 
                    key={header}
                    style={{ 
                      padding: "16px 20px", 
                      textAlign: "left", 
                      fontSize: "12px", 
                      fontWeight: "600",
                      color: "#71717a",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tokenLedger.map((entry) => {
                const isExpired = entry.expiresAt && new Date(entry.expiresAt) < new Date();
                const isExpiringSoon = entry.expiresAt && !isExpired && 
                  new Date(entry.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
                
                return (
                  <tr 
                    key={entry.id} 
                    className="table-row-hover"
                    style={{ 
                      borderBottom: "1px solid rgba(63, 63, 70, 0.25)",
                      opacity: isExpired ? 0.5 : 1,
                    }}
                  >
                    <td style={{ padding: "18px 20px" }}>
                      <span style={{
                        fontSize: "12px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: entry.type.includes("REFUND") || entry.type.includes("DEBIT") 
                          ? "rgba(239, 68, 68, 0.15)" 
                          : "rgba(16, 185, 129, 0.15)",
                        color: entry.type.includes("REFUND") || entry.type.includes("DEBIT")
                          ? "#f87171"
                          : "#34d399",
                        fontWeight: "500",
                      }}>
                        {entry.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: "14px", color: "#e4e4e7" }}>
                      {entry.description || "-"}
                    </td>
                    <td style={{ padding: "18px 20px" }}>
                      <span style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: entry.amount > 0 ? "#34d399" : "#f87171",
                        textDecoration: isExpired ? "line-through" : "none",
                      }}>
                        {entry.amount > 0 ? "+" : ""}{entry.amount}
                      </span>
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: "14px", color: "#a1a1aa" }}>
                      {entry.balanceAfter}
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: "13px", color: "#71717a" }}>
                      {formatDate(entry.createdAt)}
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: "13px" }}>
                      {entry.expiresAt ? (
                        <span style={{ 
                          color: isExpired ? "#f87171" : isExpiringSoon ? "#fbbf24" : "#71717a",
                          fontWeight: isExpired || isExpiringSoon ? "500" : "400",
                        }}>
                          {isExpired ? "Expired" : formatDate(entry.expiresAt)}
                        </span>
                      ) : (
                        <span style={{ color: "#52525b" }}>Never</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {tokenLedger.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "64px 20px", textAlign: "center", color: "#71717a" }}>
                    No token history
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "revenue" && (
        <div className="glass" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.4)" }}>
                {["Event", "Transaction ID", "Product", "Store", "Price", "Net Revenue", "Date"].map((header) => (
                  <th 
                    key={header}
                    style={{ 
                      padding: "16px 20px", 
                      textAlign: "left", 
                      fontSize: "12px", 
                      fontWeight: "600",
                      color: "#71717a",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {revenueEvents.map((event) => (
                <tr 
                  key={event.id} 
                  className="table-row-hover"
                  style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.25)" }}
                >
                  <td style={{ padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: event.eventType === "CANCELLATION" 
                          ? "rgba(239, 68, 68, 0.15)" 
                          : "rgba(16, 185, 129, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: event.eventType === "CANCELLATION" ? "#f87171" : "#34d399",
                      }}>
                        {getEventIcon(event.eventType)}
                      </div>
                      <div>
                        <p style={{ fontSize: "14px", color: "#e4e4e7" }}>
                          {getEventLabel(event.eventType)}
                        </p>
                        {event.renewalNumber && event.renewalNumber > 1 && (
                          <p style={{ fontSize: "11px", color: "#71717a" }}>
                            Renewal #{event.renewalNumber}
                          </p>
                        )}
                        {event.cancelReason && (
                          <p style={{ fontSize: "11px", color: "#f87171" }}>
                            {event.cancelReason.replace(/_/g, " ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "18px 20px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {event.transactionId && (
                        <code style={{ 
                          fontSize: "11px", 
                          color: "#a1a1aa", 
                          fontFamily: "monospace",
                        }}>
                          {event.transactionId}
                        </code>
                      )}
                      <code style={{ 
                        fontSize: "10px", 
                        color: "#71717a", 
                        fontFamily: "monospace",
                      }}>
                        {event.revenueCatEventId}
                      </code>
                    </div>
                  </td>
                  <td style={{ padding: "18px 20px", fontSize: "13px", color: "#a1a1aa", fontFamily: "monospace" }}>
                    {event.productId || "-"}
                  </td>
                  <td style={{ padding: "18px 20px" }}>
                    <span style={{
                      fontSize: "12px",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      background: "rgba(39, 39, 42, 0.6)",
                      color: "#a1a1aa",
                    }}>
                      {event.store || "-"}
                    </span>
                  </td>
                  <td style={{ padding: "18px 20px", fontSize: "14px", color: "#e4e4e7" }}>
                    {event.priceUsd !== null ? formatCurrency(event.priceUsd) : "-"}
                  </td>
                  <td style={{ padding: "18px 20px" }}>
                    {event.netRevenueUsd !== null ? (
                      <span style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: event.netRevenueUsd >= 0 ? "#34d399" : "#f87171",
                      }}>
                        {event.netRevenueUsd >= 0 ? "+" : ""}{formatCurrency(event.netRevenueUsd)}
                      </span>
                    ) : "-"}
                  </td>
                  <td style={{ padding: "18px 20px", fontSize: "13px", color: "#71717a" }}>
                    {formatEventTimestamp(event.eventTimestampMs)}
                  </td>
                </tr>
              ))}
              {revenueEvents.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "64px 20px", textAlign: "center", color: "#71717a" }}>
                    No revenue events. Connect RevenueCat to track purchases and subscriptions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


