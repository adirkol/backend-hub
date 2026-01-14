"use client";

import { useState, useMemo, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
  Users,
  Activity,
  Calendar,
  Filter,
  ChevronDown,
  Globe,
  CreditCard,
} from "lucide-react";
import { countryCodeToFlag, getCountryName } from "@/lib/countries";

interface DailyStat {
  date: string;
  rawDate: string;
  count: number;
  succeeded: number;
  failed: number;
}

interface UserGrowth {
  date: string;
  rawDate: string;
  count: number;
}

interface ProviderUsage {
  provider: string;
  count: number;
  avgLatency: number;
}

interface TokenStat {
  type: string;
  total: number;
  count: number;
}

interface TopApp {
  id: string;
  name: string;
  jobs: number;
}

interface ExpenseByProvider {
  name: string;
  amount: number;
  count: number;
}

interface ExpenseByModel {
  name: string;
  amount: number;
  count: number;
}

interface DailyExpense {
  date: string;
  rawDate: string;
  amount: number;
}

interface App {
  id: string;
  name: string;
}

interface RevenueByCountry {
  code: string;
  amount: number;
  count: number;
}

interface RevenueByProduct {
  product: string;
  amount: number;
  count: number;
}

interface RevenueByStore {
  store: string;
  amount: number;
  count: number;
}

interface RevenueByEventType {
  type: string;
  amount: number;
  count: number;
}

interface DailyRevenue {
  date: string;
  rawDate: string;
  amount: number;
}

interface TopPayingUser {
  userId: string;
  amount: number;
}

interface StatisticsData {
  dailyStats: DailyStat[];
  userGrowth: UserGrowth[];
  providerUsage: ProviderUsage[];
  tokenStats: TokenStat[];
  topApps: TopApp[];
  totalJobs: number;
  jobsThisMonth: number;
  jobsThisWeek: number;
  tokensUsedThisMonth: number;
  totalUsers: number;
  expenses: {
    total: number;
    thisMonth: number;
    thisWeek: number;
    byProvider: ExpenseByProvider[];
    byModel: ExpenseByModel[];
    daily: DailyExpense[];
  };
  revenue: {
    total: number;
    thisWeek: number;
    byCountry: RevenueByCountry[];
    byProduct: RevenueByProduct[];
    byStore: RevenueByStore[];
    byEventType: RevenueByEventType[];
    daily: DailyRevenue[];
    topPayingUsers: TopPayingUser[];
  };
  apps: App[];
}

type TabType = "usage" | "revenue" | "expenses";
type RangeType = "7d" | "14d" | "30d" | "90d" | "custom";

const VALID_TABS: TabType[] = ["usage", "revenue", "expenses"];

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
          <p style={{ fontSize: "14px", color: "#9ca3af", marginBottom: "8px" }}>{title}</p>
          <p style={{ fontSize: "32px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {change !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "12px" }}>
              {change >= 0 ? (
                <TrendingUp style={{ width: "16px", height: "16px", color: "#00f0ff" }} />
              ) : (
                <TrendingDown style={{ width: "16px", height: "16px", color: "#f87171" }} />
              )}
              <span style={{ fontSize: "14px", color: change >= 0 ? "#34d399" : "#f87171" }}>
                {change >= 0 ? "+" : ""}{change}%
              </span>
              <span style={{ fontSize: "14px", color: "#9ca3af" }}>vs last period</span>
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

function MiniChart({ data, color = "#00f0ff" }: { data: Array<{ value: number }>; color?: string }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = Math.min(...data.map((d) => d.value));
  const range = maxValue - minValue || 1;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "100px" }}>
      {data.map((item, i) => (
        <div
          key={i}
          style={{ 
            flex: 1, 
            background: `linear-gradient(180deg, ${color} 0%, ${color}66 100%)`,
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
            color: "#b8b8c8", 
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
                background: "linear-gradient(90deg, #00f0ff 0%, #66f7ff 100%)",
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

export function StatisticsClient({ data }: { data: StatisticsData }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabsAnchorRef = useRef<HTMLDivElement>(null);
  
  // Get tab from URL or default to "usage"
  const tabParam = searchParams.get("tab");
  const activeTab: TabType = VALID_TABS.includes(tabParam as TabType) ? (tabParam as TabType) : "usage";
  
  const setActiveTab = (tab: TabType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // Scroll so tabs are at top of viewport (where they stick)
    tabsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  
  const [dateRange, setDateRange] = useState<RangeType>("30d");
  const [selectedApp, setSelectedApp] = useState<string>("all");
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [showAppDropdown, setShowAppDropdown] = useState(false);

  // Filter data based on date range
  const filteredData = useMemo(() => {
    const now = new Date();
    let daysBack = 30;
    
    switch (dateRange) {
      case "7d": daysBack = 7; break;
      case "14d": daysBack = 14; break;
      case "30d": daysBack = 30; break;
      case "90d": daysBack = 90; break;
      default: daysBack = 30;
    }
    
    const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    return {
      dailyStats: data.dailyStats.filter(d => d.rawDate >= cutoffStr),
      userGrowth: data.userGrowth.filter(d => d.rawDate >= cutoffStr),
      expenseDaily: data.expenses.daily.filter(d => d.rawDate >= cutoffStr),
      revenueDaily: data.revenue.daily.filter(d => d.rawDate >= cutoffStr),
    };
  }, [data, dateRange]);

  // Calculate totals for filtered data
  const filteredTotals = useMemo(() => {
    const totalJobs = filteredData.dailyStats.reduce((sum, d) => sum + d.count, 0);
    const succeededJobs = filteredData.dailyStats.reduce((sum, d) => sum + d.succeeded, 0);
    const failedJobs = filteredData.dailyStats.reduce((sum, d) => sum + d.failed, 0);
    const newUsers = filteredData.userGrowth.reduce((sum, d) => sum + d.count, 0);
    const totalExpenses = filteredData.expenseDaily.reduce((sum, d) => sum + d.amount, 0);
    const totalRevenue = filteredData.revenueDaily.reduce((sum, d) => sum + d.amount, 0);
    
    return {
      totalJobs,
      succeededJobs,
      failedJobs,
      newUsers,
      totalExpenses,
      totalRevenue,
      avgCostPerJob: totalJobs > 0 ? totalExpenses / totalJobs : 0,
      netProfit: totalRevenue - totalExpenses,
    };
  }, [filteredData]);

  const tabs = [
    { id: "usage" as const, label: "Usage", icon: <Activity style={{ width: "16px", height: "16px" }} /> },
    { id: "revenue" as const, label: "Revenue", icon: <CreditCard style={{ width: "16px", height: "16px" }} /> },
    { id: "expenses" as const, label: "Expenses", icon: <Receipt style={{ width: "16px", height: "16px" }} /> },
  ];

  const rangeOptions = [
    { id: "7d" as const, label: "Last 7 days" },
    { id: "14d" as const, label: "Last 14 days" },
    { id: "30d" as const, label: "Last 30 days" },
    { id: "90d" as const, label: "Last 90 days" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Filters Row */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        {/* Date Range Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => { setShowRangeDropdown(!showRangeDropdown); setShowAppDropdown(false); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(39, 39, 42, 0.6)",
              border: "1px solid rgba(63, 63, 70, 0.5)",
              color: "#e4e4e7",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            <Calendar style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
            {rangeOptions.find(r => r.id === dateRange)?.label}
            <ChevronDown style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
          </button>
          {showRangeDropdown && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "8px",
              padding: "8px",
              borderRadius: "12px",
              background: "rgba(24, 24, 27, 0.98)",
              border: "1px solid rgba(63, 63, 70, 0.5)",
              minWidth: "180px",
              zIndex: 50,
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
            }}>
              {rangeOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => { setDateRange(option.id); setShowRangeDropdown(false); }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: dateRange === option.id ? "rgba(0, 240, 255, 0.15)" : "transparent",
                    border: "none",
                    color: dateRange === option.id ? "#00f0ff" : "#b8b8c8",
                    fontSize: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* App Filter Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => { setShowAppDropdown(!showAppDropdown); setShowRangeDropdown(false); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(39, 39, 42, 0.6)",
              border: "1px solid rgba(63, 63, 70, 0.5)",
              color: "#e4e4e7",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            <Filter style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
            {selectedApp === "all" ? "All Apps" : data.apps.find(a => a.id === selectedApp)?.name || "All Apps"}
            <ChevronDown style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
          </button>
          {showAppDropdown && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "8px",
              padding: "8px",
              borderRadius: "12px",
              background: "rgba(24, 24, 27, 0.98)",
              border: "1px solid rgba(63, 63, 70, 0.5)",
              minWidth: "200px",
              maxHeight: "300px",
              overflowY: "auto",
              zIndex: 50,
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
            }}>
              <button
                onClick={() => { setSelectedApp("all"); setShowAppDropdown(false); }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: selectedApp === "all" ? "rgba(0, 240, 255, 0.15)" : "transparent",
                  border: "none",
                  color: selectedApp === "all" ? "#00f0ff" : "#b8b8c8",
                  fontSize: "14px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                All Apps
              </button>
              {data.apps.map(app => (
                <button
                  key={app.id}
                  onClick={() => { setSelectedApp(app.id); setShowAppDropdown(false); }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: selectedApp === app.id ? "rgba(0, 240, 255, 0.15)" : "transparent",
                    border: "none",
                    color: selectedApp === app.id ? "#00f0ff" : "#b8b8c8",
                    fontSize: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  {app.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs anchor for scroll targeting - offset accounts for tabs padding */}
      <div ref={tabsAnchorRef} style={{ height: 0, marginTop: "32px", marginBottom: "-32px" }} />
      
      {/* Tabs */}
      <div 
        style={{ 
          display: "flex", 
          gap: "4px", 
          borderBottom: "1px solid rgba(63, 63, 70, 0.4)",
          position: "sticky",
          top: "0",
          background: "linear-gradient(180deg, rgba(9, 9, 11, 0.98) 0%, rgba(9, 9, 11, 0.95) 100%)",
          zIndex: 40,
          marginLeft: "-24px",
          marginRight: "-24px",
          paddingLeft: "24px",
          paddingRight: "24px",
          paddingTop: "16px",
          backdropFilter: "blur(12px)",
        }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px 24px",
              fontSize: "14px",
              fontWeight: "500",
              color: activeTab === tab.id ? "#fafafa" : "#9ca3af",
              background: activeTab === tab.id ? "rgba(39, 39, 42, 0.6)" : "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #00f0ff" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s ease",
              marginBottom: "-1px",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Usage Tab */}
      {activeTab === "usage" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
            <StatCard
              title="Total Jobs"
              value={filteredTotals.totalJobs}
              icon={Zap}
              iconBg="linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(0, 184, 204, 0.3) 100%)"
              iconColor="#00f0ff"
            />
            <StatCard
              title="Succeeded"
              value={filteredTotals.succeededJobs}
              icon={CheckCircle}
              iconBg="linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.3) 100%)"
              iconColor="#00f0ff"
            />
            <StatCard
              title="Failed"
              value={filteredTotals.failedJobs}
              icon={XCircle}
              iconBg="linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.3) 100%)"
              iconColor="#f87171"
            />
            <StatCard
              title="New Users"
              value={filteredTotals.newUsers}
              icon={Users}
              iconBg="linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)"
              iconColor="#60a5fa"
            />
          </div>

          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
            {/* Jobs Chart */}
            <div className="glass" style={{ padding: "28px" }}>
              <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
                Jobs Over Time
              </h3>
              {filteredData.dailyStats.length > 0 ? (
                <>
                  <MiniChart data={filteredData.dailyStats.map(d => ({ value: d.count }))} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>{filteredData.dailyStats[0]?.date}</span>
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>{filteredData.dailyStats[filteredData.dailyStats.length - 1]?.date}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "24px", marginTop: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <CheckCircle style={{ width: "16px", height: "16px", color: "#34d399" }} />
                      <span style={{ fontSize: "14px", color: "#b8b8c8" }}>
                        {filteredTotals.succeededJobs} succeeded
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <XCircle style={{ width: "16px", height: "16px", color: "#f87171" }} />
                      <span style={{ fontSize: "14px", color: "#b8b8c8" }}>
                        {filteredTotals.failedJobs} failed
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No data available</p>
              )}
            </div>

            {/* User Growth Chart */}
            <div className="glass" style={{ padding: "28px" }}>
              <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
                New Users
              </h3>
              {filteredData.userGrowth.length > 0 ? (
                <>
                  <MiniChart data={filteredData.userGrowth.map(d => ({ value: d.count }))} color="#60a5fa" />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>{filteredData.userGrowth[0]?.date}</span>
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>{filteredData.userGrowth[filteredData.userGrowth.length - 1]?.date}</span>
                  </div>
                  <p style={{ marginTop: "20px", fontSize: "14px", color: "#b8b8c8" }}>
                    <span style={{ color: "#60a5fa", fontWeight: "600" }}>
                      {filteredTotals.newUsers}
                    </span>{" "}
                    new users in selected period
                  </p>
                </>
              ) : (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No data available</p>
              )}
            </div>
          </div>

          {/* Bottom Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            {/* Top Apps */}
            <div className="glass" style={{ padding: "28px" }}>
              <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
                Top Apps
              </h3>
              {data.topApps.length > 0 ? (
                <SimpleBarChart data={data.topApps.map(a => ({ label: a.name, value: a.jobs }))} />
              ) : (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No data available</p>
              )}
            </div>

            {/* Provider Usage */}
            <div className="glass" style={{ padding: "28px" }}>
              <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
                Provider Usage
              </h3>
              {data.providerUsage.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {data.providerUsage.map((p, i) => (
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
                        <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "4px" }}>{p.count.toLocaleString()} requests</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "14px", color: "#e4e4e7" }}>{p.avgLatency}ms</p>
                        <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "4px" }}>avg latency</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No data available</p>
              )}
            </div>

            {/* Token Flow */}
            <div className="glass" style={{ padding: "28px" }}>
              <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
                Token Flow
              </h3>
              {data.tokenStats.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {data.tokenStats.map((t, i) => {
                    const typeLabels: Record<string, { label: string; color: string }> = {
                      GRANT: { label: "Granted", color: "#34d399" },
                      GENERATION_DEBIT: { label: "Used", color: "#f87171" },
                      GENERATION_REFUND: { label: "Refunded", color: "#fbbf24" },
                      ADMIN_ADJUSTMENT: { label: "Adjusted", color: "#60a5fa" },
                      BONUS: { label: "Bonus", color: "#a78bfa" },
                      EXPIRY: { label: "Expired", color: "#b8b8c8" },
                    };
                    const config = typeLabels[t.type] || { label: t.type, color: "#b8b8c8" };

                    return (
                      <div key={i} style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between", 
                        padding: "12px 0",
                        borderBottom: i < data.tokenStats.length - 1 ? "1px solid rgba(63, 63, 70, 0.3)" : "none",
                      }}>
                        <span style={{ fontSize: "14px", color: "#b8b8c8" }}>{config.label}</span>
                        <span style={{ fontSize: "14px", fontWeight: "600", color: config.color }}>
                          {t.total.toLocaleString()} tokens
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No data available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === "revenue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
            <StatCard
              title="Total Revenue"
              value={`$${filteredTotals.totalRevenue.toFixed(2)}`}
              icon={DollarSign}
              iconBg="linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.3) 100%)"
              iconColor="#34d399"
            />
            <StatCard
              title="Total Expenses"
              value={`$${filteredTotals.totalExpenses.toFixed(2)}`}
              icon={Receipt}
              iconBg="linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.3) 100%)"
              iconColor="#f87171"
            />
            <StatCard
              title="Net Profit"
              value={`$${filteredTotals.netProfit.toFixed(2)}`}
              icon={TrendingUp}
              iconBg={`linear-gradient(135deg, ${filteredTotals.netProfit >= 0 ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"} 0%, ${filteredTotals.netProfit >= 0 ? "rgba(22, 163, 74, 0.3)" : "rgba(220, 38, 38, 0.3)"} 100%)`}
              iconColor={filteredTotals.netProfit >= 0 ? "#34d399" : "#f87171"}
            />
            <StatCard
              title="Transactions"
              value={data.revenue.byCountry.reduce((sum, c) => sum + c.count, 0)}
              icon={CreditCard}
              iconBg="linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(0, 184, 204, 0.3) 100%)"
              iconColor="#00f0ff"
            />
          </div>

          {/* Revenue Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
            {/* Revenue Over Time */}
            <div className="glass" style={{ padding: "28px" }}>
              <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
                Revenue Over Time
              </h3>
              {filteredData.revenueDaily.length > 0 && filteredData.revenueDaily.some(d => d.amount > 0) ? (
                <>
                  <MiniChart data={filteredData.revenueDaily.map(d => ({ value: d.amount }))} color="#34d399" />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>{filteredData.revenueDaily[0]?.date}</span>
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>{filteredData.revenueDaily[filteredData.revenueDaily.length - 1]?.date}</span>
                  </div>
                  <p style={{ marginTop: "20px", fontSize: "14px", color: "#b8b8c8" }}>
                    Total: <span style={{ color: "#34d399", fontWeight: "600" }}>${filteredTotals.totalRevenue.toFixed(2)}</span>
                  </p>
                </>
              ) : (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No revenue data available</p>
              )}
            </div>

            {/* Revenue by Country */}
            <div className="glass" style={{ padding: "28px" }}>
              <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <Globe style={{ width: "18px", height: "18px", color: "#00f0ff" }} />
                Revenue by Country
              </h3>
              {data.revenue.byCountry.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "320px", overflowY: "auto" }}>
                  {data.revenue.byCountry.slice(0, 15).map((country, i) => (
                    <div key={i} style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between", 
                      padding: "12px 16px", 
                      borderRadius: "10px", 
                      background: "rgba(39, 39, 42, 0.4)",
                      border: "1px solid rgba(63, 63, 70, 0.3)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "24px" }} title={getCountryName(country.code)}>
                          {countryCodeToFlag(country.code)}
                        </span>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: "500", color: "#e4e4e7" }}>
                            {getCountryName(country.code)}
                          </p>
                          <p style={{ fontSize: "12px", color: "#9ca3af" }}>
                            {country.count} transaction{country.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "16px", fontWeight: "600", color: "#34d399" }}>
                          ${country.amount.toFixed(2)}
                        </p>
                        <p style={{ fontSize: "12px", color: "#9ca3af" }}>
                          {((country.amount / data.revenue.total) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No data available</p>
              )}
            </div>
          </div>

          {/* Bottom Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            {/* Revenue by Store */}
            <div className="glass" style={{ padding: "28px" }}>
              <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
                Revenue by Store
              </h3>
              {data.revenue.byStore.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {data.revenue.byStore.map((store, i) => (
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
                        <p style={{ fontSize: "14px", fontWeight: "500", color: "#e4e4e7" }}>
                          {store.store === "APP_STORE" ? "🍎 App Store" : 
                           store.store === "PLAY_STORE" ? "🤖 Play Store" : 
                           store.store}
                        </p>
                        <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "4px" }}>
                          {store.count} transactions
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "16px", fontWeight: "600", color: "#34d399" }}>${store.amount.toFixed(2)}</p>
                        <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "4px" }}>
                          ${store.count > 0 ? (store.amount / store.count).toFixed(2) : "0.00"} avg
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No data available</p>
              )}
            </div>

            {/* Revenue by Event Type */}
            <div className="glass" style={{ padding: "28px" }}>
              <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
                Revenue by Type
              </h3>
              {data.revenue.byEventType.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {data.revenue.byEventType.map((eventType, i) => {
                    const typeLabels: Record<string, { label: string; color: string }> = {
                      INITIAL_PURCHASE: { label: "Initial Purchase", color: "#00f0ff" },
                      RENEWAL: { label: "Renewal", color: "#34d399" },
                      NON_RENEWING_PURCHASE: { label: "One-time Purchase", color: "#fbbf24" },
                      CANCELLATION: { label: "Cancellation", color: "#f87171" },
                    };
                    const config = typeLabels[eventType.type] || { label: eventType.type, color: "#b8b8c8" };

                    return (
                      <div key={i} style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between", 
                        padding: "14px 0",
                        borderBottom: i < data.revenue.byEventType.length - 1 ? "1px solid rgba(63, 63, 70, 0.3)" : "none",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: config.color,
                          }} />
                          <span style={{ fontSize: "14px", color: "#e4e4e7" }}>{config.label}</span>
                          <span style={{ fontSize: "12px", color: "#9ca3af" }}>({eventType.count})</span>
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: "600", color: config.color }}>
                          ${eventType.amount.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No data available</p>
              )}
            </div>

            {/* Top Paying Users */}
            <div className="glass" style={{ padding: "28px" }}>
              <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
                Top Paying Users
              </h3>
              {data.revenue.topPayingUsers.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {data.revenue.topPayingUsers.slice(0, 8).map((user, i) => (
                    <div key={i} style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between", 
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: i < 3 ? "rgba(34, 197, 94, 0.1)" : "rgba(39, 39, 42, 0.3)",
                      border: i < 3 ? "1px solid rgba(34, 197, 94, 0.2)" : "1px solid transparent",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ 
                          fontSize: "12px", 
                          fontWeight: "600", 
                          color: i < 3 ? "#34d399" : "#9ca3af",
                          width: "20px",
                        }}>
                          #{i + 1}
                        </span>
                        <code style={{ 
                          fontSize: "12px", 
                          color: "#b8b8c8",
                          fontFamily: "monospace",
                          maxWidth: "140px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {user.userId}
                        </code>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: "600", color: "#34d399" }}>
                        ${user.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No data available</p>
              )}
            </div>
          </div>

          {/* Revenue by Product */}
          <div className="glass" style={{ padding: "28px" }}>
            <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
              Revenue by Product
            </h3>
            {data.revenue.byProduct.length > 0 ? (
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
                gap: "16px" 
              }}>
                {data.revenue.byProduct.slice(0, 12).map((product, i) => (
                  <div key={i} style={{ 
                    padding: "20px", 
                    borderRadius: "12px", 
                    background: "rgba(39, 39, 42, 0.4)",
                    border: "1px solid rgba(63, 63, 70, 0.3)",
                  }}>
                    <p style={{ 
                      fontSize: "13px", 
                      fontWeight: "500", 
                      color: "#e4e4e7", 
                      marginBottom: "8px",
                      fontFamily: "monospace",
                      wordBreak: "break-all",
                    }}>
                      {product.product}
                    </p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                      <span style={{ fontSize: "24px", fontWeight: "700", color: "#34d399" }}>
                        ${product.amount.toFixed(2)}
                      </span>
                      <span style={{ fontSize: "13px", color: "#9ca3af" }}>
                        {product.count} sale{product.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "8px" }}>
                      Avg: ${product.count > 0 ? (product.amount / product.count).toFixed(2) : "0.00"}/sale
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No product data available</p>
            )}
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === "expenses" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
            <StatCard
              title="Total Expenses"
              value={`$${filteredTotals.totalExpenses.toFixed(2)}`}
              icon={Receipt}
              iconBg="linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.3) 100%)"
              iconColor="#f87171"
            />
            <StatCard
              title="Total Jobs"
              value={filteredTotals.totalJobs}
              icon={Zap}
              iconBg="linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(0, 184, 204, 0.3) 100%)"
              iconColor="#00f0ff"
            />
            <StatCard
              title="Avg Cost / Job"
              value={`$${filteredTotals.avgCostPerJob.toFixed(4)}`}
              icon={BarChart3}
              iconBg="linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)"
              iconColor="#60a5fa"
            />
            <StatCard
              title="Tokens Used"
              value={data.tokensUsedThisMonth}
              icon={DollarSign}
              iconBg="linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.3) 100%)"
              iconColor="#a78bfa"
            />
          </div>

          {/* Expense Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
            {/* Expenses Over Time */}
            <div className="glass" style={{ padding: "28px" }}>
              <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
                Expenses Over Time
              </h3>
              {filteredData.expenseDaily.length > 0 && filteredData.expenseDaily.some(d => d.amount > 0) ? (
                <>
                  <MiniChart data={filteredData.expenseDaily.map(d => ({ value: d.amount }))} color="#f87171" />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>{filteredData.expenseDaily[0]?.date}</span>
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>{filteredData.expenseDaily[filteredData.expenseDaily.length - 1]?.date}</span>
                  </div>
                  <p style={{ marginTop: "20px", fontSize: "14px", color: "#b8b8c8" }}>
                    Total: <span style={{ color: "#f87171", fontWeight: "600" }}>${filteredTotals.totalExpenses.toFixed(2)}</span>
                  </p>
                </>
              ) : (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No expense data available</p>
              )}
            </div>

            {/* Expenses by Provider */}
            <div className="glass" style={{ padding: "28px" }}>
              <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
                Expenses by Provider
              </h3>
              {data.expenses.byProvider.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {data.expenses.byProvider.map((p, i) => (
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
                        <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "4px" }}>{p.count.toLocaleString()} requests</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "16px", fontWeight: "600", color: "#f87171" }}>${p.amount.toFixed(2)}</p>
                        <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "4px" }}>
                          ${p.count > 0 ? (p.amount / p.count).toFixed(4) : "0.0000"}/req
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No data available</p>
              )}
            </div>
          </div>

          {/* Expenses by Model */}
          <div className="glass" style={{ padding: "28px" }}>
            <h3 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "24px", fontSize: "16px" }}>
              Expenses by Model
            </h3>
            {data.expenses.byModel.length > 0 ? (
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
                gap: "16px" 
              }}>
                {data.expenses.byModel.map((m, i) => (
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
                      <span style={{ fontSize: "13px", color: "#9ca3af" }}>
                        {m.count.toLocaleString()} jobs
                      </span>
                    </div>
                    <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "8px" }}>
                      Avg: ${m.count > 0 ? (m.amount / m.count).toFixed(4) : "0.0000"}/request
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No expense data available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



