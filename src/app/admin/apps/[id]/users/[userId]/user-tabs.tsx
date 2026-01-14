"use client";

import { useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
  Globe,
  Crown,
  AlertTriangle,
  Clock,
  Pause,
  Play,
  ArrowRightLeft,
  FlaskConical,
  FileText,
  Gift,
  CheckCircle,
  Calendar,
} from "lucide-react";
import { countryCodeToFlag, getCountryName } from "@/lib/countries";

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
  expirationReason: string | null;
  isRefund: boolean | null;
  renewalNumber: number | null;
  newProductId: string | null;
  experimentId: string | null;
  experimentVariant: string | null;
  eventTimestampMs: string;
  createdAt: string;
  countryCode: string | null;
}

interface UserData {
  id: string;
  externalId: string;
  tokenBalance: number;
  isActive: boolean;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  // Subscription status
  isPremium: boolean;
  subscriptionStatus: string | null;
  subscriptionProductId: string | null;
  subscriptionStore: string | null;
  subscriptionExpiresAt: string | null;
  subscriptionStartedAt: string | null;
  lastBillingIssueAt: string | null;
  lastRefundAt: string | null;
  // Previous user IDs (from TRANSFER events)
  previousUserIds: string[] | null;
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
  allEvents: RevenueCatEvent[];
  stats: Stats;
  counts: {
    jobs: number;
    tokenLedger: number;
    revenueCatEvents: number;
  };
  effectiveBalance: EffectiveBalance;
}

type TabType = "overview" | "timeline" | "jobs" | "tokens" | "revenue";

const VALID_TABS: TabType[] = ["overview", "timeline", "jobs", "tokens", "revenue"];

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

function getEventIcon(eventType: string, isRefund?: boolean | null) {
  switch (eventType) {
    case "INITIAL_PURCHASE":
      return <CreditCard style={{ width: "16px", height: "16px" }} />;
    case "RENEWAL":
      return <RefreshCw style={{ width: "16px", height: "16px" }} />;
    case "NON_RENEWING_PURCHASE":
      return <Package style={{ width: "16px", height: "16px" }} />;
    case "CANCELLATION":
      return isRefund 
        ? <ArrowDownRight style={{ width: "16px", height: "16px" }} />
        : <XCircle style={{ width: "16px", height: "16px" }} />;
    case "EXPIRATION":
      return <Clock style={{ width: "16px", height: "16px" }} />;
    case "BILLING_ISSUE":
      return <AlertTriangle style={{ width: "16px", height: "16px" }} />;
    case "PRODUCT_CHANGE":
      return <ArrowRightLeft style={{ width: "16px", height: "16px" }} />;
    case "UNCANCELLATION":
      return <Play style={{ width: "16px", height: "16px" }} />;
    case "SUBSCRIPTION_PAUSED":
      return <Pause style={{ width: "16px", height: "16px" }} />;
    case "SUBSCRIPTION_EXTENDED":
      return <Calendar style={{ width: "16px", height: "16px" }} />;
    case "TRANSFER":
      return <ArrowRightLeft style={{ width: "16px", height: "16px" }} />;
    case "VIRTUAL_CURRENCY_TRANSACTION":
      return <Coins style={{ width: "16px", height: "16px" }} />;
    case "EXPERIMENT_ENROLLMENT":
      return <FlaskConical style={{ width: "16px", height: "16px" }} />;
    case "INVOICE_ISSUANCE":
      return <FileText style={{ width: "16px", height: "16px" }} />;
    case "TEMPORARY_ENTITLEMENT_GRANT":
      return <Gift style={{ width: "16px", height: "16px" }} />;
    default:
      return <DollarSign style={{ width: "16px", height: "16px" }} />;
  }
}

function getEventLabel(eventType: string, isRefund?: boolean | null): string {
  switch (eventType) {
    case "INITIAL_PURCHASE":
      return "Initial Purchase";
    case "RENEWAL":
      return "Renewal";
    case "NON_RENEWING_PURCHASE":
      return "One-time Purchase";
    case "CANCELLATION":
      return isRefund ? "Refund" : "Cancellation";
    case "EXPIRATION":
      return "Subscription Expired";
    case "BILLING_ISSUE":
      return "Billing Issue";
    case "PRODUCT_CHANGE":
      return "Product Change";
    case "UNCANCELLATION":
      return "Resubscribed";
    case "SUBSCRIPTION_PAUSED":
      return "Subscription Paused";
    case "SUBSCRIPTION_EXTENDED":
      return "Subscription Extended";
    case "TRANSFER":
      return "Account Transfer";
    case "VIRTUAL_CURRENCY_TRANSACTION":
      return "Token Transaction";
    case "EXPERIMENT_ENROLLMENT":
      return "Experiment Enrollment";
    case "INVOICE_ISSUANCE":
      return "Invoice Issued";
    case "TEMPORARY_ENTITLEMENT_GRANT":
      return "Temporary Access";
    case "TEST":
      return "Test Event";
    default:
      return eventType.replace(/_/g, " ");
  }
}

function getEventColor(eventType: string, isRefund?: boolean | null): string {
  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "SUBSCRIPTION_EXTENDED":
      return "#34d399"; // Green
    case "NON_RENEWING_PURCHASE":
    case "VIRTUAL_CURRENCY_TRANSACTION":
      return "#fbbf24"; // Yellow
    case "CANCELLATION":
      return isRefund ? "#f87171" : "#f97316"; // Red for refund, orange for cancel
    case "EXPIRATION":
      return "#9ca3af"; // Gray
    case "BILLING_ISSUE":
      return "#f87171"; // Red
    case "SUBSCRIPTION_PAUSED":
      return "#60a5fa"; // Blue
    case "PRODUCT_CHANGE":
    case "TRANSFER":
      return "#a78bfa"; // Purple
    case "EXPERIMENT_ENROLLMENT":
      return "#00f0ff"; // Cyan
    default:
      return "#9ca3af"; // Gray
  }
}

export function UserTabs({ 
  user, 
  appId,
  jobs, 
  tokenLedger, 
  tokenEvents,
  revenueEvents,
  allEvents,
  stats,
  counts,
  effectiveBalance,
}: UserTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Get tab from URL or default to "overview"
  const tabParam = searchParams.get("tab");
  const activeTab: TabType = VALID_TABS.includes(tabParam as TabType) ? (tabParam as TabType) : "overview";
  
  const setActiveTab = (tab: TabType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // Scroll to top when switching tabs
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const roas = stats.totalExpenses > 0 
    ? ((stats.totalRevenue / stats.totalExpenses) * 100).toFixed(1) 
    : stats.totalRevenue > 0 ? "∞" : "0";

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "overview", label: "Overview", icon: <User style={{ width: "16px", height: "16px" }} /> },
    { id: "timeline", label: "Timeline", icon: <Clock style={{ width: "16px", height: "16px" }} />, count: allEvents.length },
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
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>
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
              background: "linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(0, 184, 204, 0.3) 100%)",
              border: "1px solid rgba(0, 240, 255, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <DollarSign style={{ width: "20px", height: "20px", color: "#00f0ff" }} />
            </div>
            <div>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#fafafa" }}>
                {formatCurrency(stats.totalRevenue)}
              </p>
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>Net Revenue</p>
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
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>AI Expenses</p>
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
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>ROAS</p>
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
              padding: "14px 20px",
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
            {tab.count !== undefined && (
              <span style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "10px",
                background: activeTab === tab.id ? "rgba(0, 240, 255, 0.2)" : "rgba(63, 63, 70, 0.5)",
                color: activeTab === tab.id ? "#00f0ff" : "#b8b8c8",
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
                <label style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Internal ID
                </label>
                <p style={{ fontSize: "14px", color: "#e4e4e7", fontFamily: "monospace", marginTop: "6px" }}>
                  {user.id}
                </p>
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  External ID
                </label>
                <p style={{ fontSize: "14px", color: "#e4e4e7", fontFamily: "monospace", marginTop: "6px" }}>
                  {user.externalId}
                </p>
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Created
                </label>
                <p style={{ fontSize: "14px", color: "#e4e4e7", marginTop: "6px" }}>
                  {formatDate(user.createdAt)}
                </p>
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Last Updated
                </label>
                <p style={{ fontSize: "14px", color: "#e4e4e7", marginTop: "6px" }}>
                  {formatDate(user.updatedAt)}
                </p>
              </div>
              {user.previousUserIds && user.previousUserIds.length > 0 && (
                <div>
                  <label style={{ 
                    fontSize: "12px", 
                    color: "#9ca3af", 
                    textTransform: "uppercase", 
                    letterSpacing: "0.05em",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}>
                    <ArrowRightLeft style={{ width: "12px", height: "12px" }} />
                    Previous User IDs
                  </label>
                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {user.previousUserIds.map((prevId, index) => (
                      <div 
                        key={index}
                        style={{ 
                          fontSize: "13px", 
                          color: "#a78bfa", 
                          fontFamily: "monospace",
                          padding: "6px 10px",
                          background: "rgba(168, 139, 250, 0.1)",
                          borderRadius: "6px",
                          border: "1px solid rgba(168, 139, 250, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span style={{ 
                          fontSize: "10px", 
                          color: "#9ca3af",
                          background: "rgba(39, 39, 42, 0.6)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}>
                          Merged
                        </span>
                        {prevId}
                      </div>
                    ))}
                  </div>
                  <p style={{ 
                    fontSize: "11px", 
                    color: "#71717a", 
                    marginTop: "8px",
                    fontStyle: "italic",
                  }}>
                    User accounts merged via RevenueCat TRANSFER
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Subscription Status */}
          <div className="glass" style={{ padding: "28px" }}>
            <h2 style={{ 
              fontWeight: "600", 
              color: "#e4e4e7", 
              marginBottom: "20px", 
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <Crown style={{ width: "18px", height: "18px", color: user.isPremium ? "#fbbf24" : "#71717a" }} />
              Subscription Status
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: "#b8b8c8" }}>Status</span>
                <span style={{
                  fontSize: "13px",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  fontWeight: "500",
                  background: user.isPremium 
                    ? "rgba(34, 197, 94, 0.15)"
                    : user.subscriptionStatus === "BILLING_ISSUE"
                    ? "rgba(239, 68, 68, 0.15)"
                    : user.subscriptionStatus === "CANCELLED" || user.subscriptionStatus === "REFUNDED"
                    ? "rgba(249, 115, 22, 0.15)"
                    : "rgba(113, 113, 122, 0.15)",
                  color: user.isPremium
                    ? "#34d399"
                    : user.subscriptionStatus === "BILLING_ISSUE"
                    ? "#f87171"
                    : user.subscriptionStatus === "CANCELLED" || user.subscriptionStatus === "REFUNDED"
                    ? "#f97316"
                    : "#9ca3af",
                }}>
                  {user.isPremium ? "👑 Premium" : user.subscriptionStatus || "Free"}
                </span>
              </div>
              {user.subscriptionProductId && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", color: "#b8b8c8" }}>Product</span>
                  <span style={{ fontSize: "13px", color: "#e4e4e7", fontFamily: "monospace" }}>
                    {user.subscriptionProductId}
                  </span>
                </div>
              )}
              {user.subscriptionStore && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", color: "#b8b8c8" }}>Store</span>
                  <span style={{ fontSize: "13px", color: "#b8b8c8" }}>
                    {user.subscriptionStore === "APP_STORE" ? "🍎 App Store" : 
                     user.subscriptionStore === "PLAY_STORE" ? "🤖 Play Store" : 
                     user.subscriptionStore}
                  </span>
                </div>
              )}
              {user.subscriptionExpiresAt && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", color: "#b8b8c8" }}>
                    {new Date(user.subscriptionExpiresAt) > new Date() ? "Renews" : "Expired"}
                  </span>
                  <span style={{ 
                    fontSize: "13px", 
                    color: new Date(user.subscriptionExpiresAt) > new Date() ? "#e4e4e7" : "#f87171",
                  }}>
                    {formatDate(user.subscriptionExpiresAt)}
                  </span>
                </div>
              )}
              {user.lastBillingIssueAt && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "8px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                }}>
                  <AlertTriangle style={{ width: "16px", height: "16px", color: "#f87171" }} />
                  <span style={{ fontSize: "13px", color: "#f87171" }}>
                    Billing issue since {formatDate(user.lastBillingIssueAt)}
                  </span>
                </div>
              )}
              {user.lastRefundAt && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "8px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(249, 115, 22, 0.1)",
                  border: "1px solid rgba(249, 115, 22, 0.2)",
                }}>
                  <ArrowDownRight style={{ width: "16px", height: "16px", color: "#f97316" }} />
                  <span style={{ fontSize: "13px", color: "#f97316" }}>
                    Refunded on {formatDate(user.lastRefundAt)}
                  </span>
                </div>
              )}
              {!user.subscriptionStatus && !user.isPremium && (
                <p style={{ fontSize: "13px", color: "#71717a", textAlign: "center", padding: "12px 0" }}>
                  No subscription history
                </p>
              )}
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
                <span style={{ fontSize: "14px", color: "#b8b8c8" }}>Total Granted</span>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#34d399", display: "flex", alignItems: "center", gap: "6px" }}>
                  <ArrowUpRight style={{ width: "16px", height: "16px" }} />
                  {stats.totalTokensGranted.toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: "#b8b8c8" }}>Total Spent</span>
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
                <span style={{ fontSize: "14px", color: "#b8b8c8" }}>Net Revenue</span>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#34d399" }}>
                  {formatCurrency(stats.totalRevenue)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: "#b8b8c8" }}>AI Expenses</span>
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
                    <p style={{ fontSize: "14px", color: "#9ca3af", textAlign: "center", padding: "20px" }}>
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
                          ? "rgba(0, 240, 255, 0.15)" 
                          : "rgba(251, 191, 36, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        {activity.type === "revenue" ? (
                          <DollarSign style={{ width: "14px", height: "14px", color: "#00f0ff" }} />
                        ) : (
                          <Coins style={{ width: "14px", height: "14px", color: "#fbbf24" }} />
                        )}
                      </div>
                      <div>
                        <p style={{ fontSize: "13px", color: "#e4e4e7" }}>{activity.label}</p>
                        <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
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

      {/* Timeline Tab */}
      {activeTab === "timeline" && (
        <div className="glass" style={{ padding: "28px" }}>
          <h2 style={{ 
            fontWeight: "600", 
            color: "#e4e4e7", 
            marginBottom: "24px", 
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}>
            <Clock style={{ width: "18px", height: "18px", color: "#00f0ff" }} />
            Event Timeline
            <span style={{ 
              fontSize: "12px", 
              color: "#9ca3af", 
              fontWeight: "400",
              marginLeft: "auto",
            }}>
              {allEvents.length} events
            </span>
          </h2>
          
          {allEvents.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {allEvents.map((event, index) => {
                const eventColor = getEventColor(event.eventType, event.isRefund);
                const isLast = index === allEvents.length - 1;
                
                return (
                  <div key={event.id} style={{ display: "flex", gap: "16px" }}>
                    {/* Timeline line and dot */}
                    <div style={{ 
                      display: "flex", 
                      flexDirection: "column", 
                      alignItems: "center",
                      width: "24px",
                    }}>
                      <div style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: eventColor,
                        border: `2px solid ${eventColor}`,
                        flexShrink: 0,
                        marginTop: "4px",
                      }} />
                      {!isLast && (
                        <div style={{
                          width: "2px",
                          flex: 1,
                          minHeight: "40px",
                          background: "rgba(63, 63, 70, 0.5)",
                        }} />
                      )}
                    </div>
                    
                    {/* Event content */}
                    <div style={{ 
                      flex: 1, 
                      paddingBottom: isLast ? "0" : "20px",
                    }}>
                      <div style={{ 
                        display: "flex", 
                        alignItems: "flex-start", 
                        justifyContent: "space-between",
                        gap: "12px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            background: `${eventColor}20`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: eventColor,
                          }}>
                            {getEventIcon(event.eventType, event.isRefund)}
                          </div>
                          <div>
                            <p style={{ fontSize: "14px", fontWeight: "500", color: "#e4e4e7" }}>
                              {getEventLabel(event.eventType, event.isRefund)}
                            </p>
                            <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>
                              {formatEventTimestamp(event.eventTimestampMs)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Event details based on type */}
                        <div style={{ textAlign: "right" }}>
                          {event.netRevenueUsd !== null && (
                            <p style={{ 
                              fontSize: "14px", 
                              fontWeight: "600", 
                              color: event.netRevenueUsd >= 0 ? "#34d399" : "#f87171",
                            }}>
                              {event.netRevenueUsd >= 0 ? "+" : ""}{formatCurrency(event.netRevenueUsd)}
                            </p>
                          )}
                          {event.tokenAmount !== null && event.tokenAmount !== 0 && (
                            <p style={{ 
                              fontSize: "14px", 
                              fontWeight: "600", 
                              color: event.tokenAmount > 0 ? "#fbbf24" : "#f87171",
                            }}>
                              {event.tokenAmount > 0 ? "+" : ""}{event.tokenAmount} tokens
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Additional info row */}
                      <div style={{ 
                        display: "flex", 
                        flexWrap: "wrap",
                        gap: "8px", 
                        marginTop: "8px",
                        marginLeft: "42px",
                      }}>
                        {event.productId && (
                          <span style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "rgba(39, 39, 42, 0.6)",
                            color: "#b8b8c8",
                            fontFamily: "monospace",
                          }}>
                            {event.productId}
                          </span>
                        )}
                        {event.store && (
                          <span style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "rgba(39, 39, 42, 0.6)",
                            color: "#b8b8c8",
                          }}>
                            {event.store === "APP_STORE" ? "🍎 App Store" : 
                             event.store === "PLAY_STORE" ? "🤖 Play Store" : 
                             event.store}
                          </span>
                        )}
                        {event.countryCode && (
                          <span 
                            title={getCountryName(event.countryCode)}
                            style={{
                              fontSize: "11px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "rgba(39, 39, 42, 0.6)",
                              color: "#b8b8c8",
                              cursor: "help",
                            }}
                          >
                            {countryCodeToFlag(event.countryCode)} {event.countryCode}
                          </span>
                        )}
                        {event.renewalNumber && event.renewalNumber > 1 && (
                          <span style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "rgba(34, 197, 94, 0.15)",
                            color: "#34d399",
                          }}>
                            Renewal #{event.renewalNumber}
                          </span>
                        )}
                        {event.cancelReason && (
                          <span style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: event.isRefund ? "rgba(239, 68, 68, 0.15)" : "rgba(249, 115, 22, 0.15)",
                            color: event.isRefund ? "#f87171" : "#f97316",
                          }}>
                            {event.cancelReason.replace(/_/g, " ")}
                          </span>
                        )}
                        {event.expirationReason && (
                          <span style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "rgba(156, 163, 175, 0.15)",
                            color: "#9ca3af",
                          }}>
                            {event.expirationReason.replace(/_/g, " ")}
                          </span>
                        )}
                        {event.newProductId && (
                          <span style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "rgba(168, 139, 250, 0.15)",
                            color: "#a78bfa",
                          }}>
                            → {event.newProductId}
                          </span>
                        )}
                        {event.experimentId && (
                          <span style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "rgba(0, 240, 255, 0.15)",
                            color: "#00f0ff",
                          }}>
                            {event.experimentId}: {event.experimentVariant}
                          </span>
                        )}
                        {event.environment === "SANDBOX" && (
                          <span style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "rgba(251, 191, 36, 0.15)",
                            color: "#fbbf24",
                          }}>
                            SANDBOX
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>
              No RevenueCat events yet
            </p>
          )}
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
                      color: "#9ca3af",
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
                      color: "#b8b8c8", 
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
                  <td style={{ padding: "18px 20px", fontSize: "13px", color: "#9ca3af" }}>
                    {formatDate(job.createdAt)}
                  </td>
                  <td style={{ padding: "18px 20px", fontSize: "13px", color: "#9ca3af" }}>
                    {job.completedAt ? formatDate(job.completedAt) : "-"}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "64px 20px", textAlign: "center", color: "#9ca3af" }}>
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
                      color: "#9ca3af",
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
                          : "rgba(0, 240, 255, 0.15)",
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
                    <td style={{ padding: "18px 20px", fontSize: "14px", color: "#b8b8c8" }}>
                      {entry.balanceAfter}
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: "13px", color: "#9ca3af" }}>
                      {formatDate(entry.createdAt)}
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: "13px" }}>
                      {entry.expiresAt ? (
                        <span style={{ 
                          color: isExpired ? "#f87171" : isExpiringSoon ? "#fbbf24" : "#9ca3af",
                          fontWeight: isExpired || isExpiringSoon ? "500" : "400",
                        }}>
                          {isExpired ? "Expired" : formatDate(entry.expiresAt)}
                        </span>
                      ) : (
                        <span style={{ color: "#71717a" }}>Never</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {tokenLedger.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "64px 20px", textAlign: "center", color: "#9ca3af" }}>
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
                {["Event", "Country", "Product", "Store", "Price", "Net Revenue", "Date"].map((header) => (
                  <th 
                    key={header}
                    style={{ 
                      padding: "16px 20px", 
                      textAlign: "left", 
                      fontSize: "12px", 
                      fontWeight: "600",
                      color: "#9ca3af",
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
                          : "rgba(0, 240, 255, 0.15)",
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
                          <p style={{ fontSize: "11px", color: "#9ca3af" }}>
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
                    {event.countryCode ? (
                      <span 
                        title={getCountryName(event.countryCode)}
                        style={{ 
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          cursor: "help",
                        }}
                      >
                        <span style={{ fontSize: "20px" }}>
                          {countryCodeToFlag(event.countryCode)}
                        </span>
                        <span style={{ 
                          fontSize: "12px", 
                          color: "#b8b8c8",
                        }}>
                          {event.countryCode}
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: "#71717a", fontSize: "13px" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "18px 20px", fontSize: "13px", color: "#b8b8c8", fontFamily: "monospace" }}>
                    {event.productId || "-"}
                  </td>
                  <td style={{ padding: "18px 20px" }}>
                    <span style={{
                      fontSize: "12px",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      background: "rgba(39, 39, 42, 0.6)",
                      color: "#b8b8c8",
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
                  <td style={{ padding: "18px 20px", fontSize: "13px", color: "#9ca3af" }}>
                    {formatEventTimestamp(event.eventTimestampMs)}
                  </td>
                </tr>
              ))}
              {revenueEvents.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "64px 20px", textAlign: "center", color: "#9ca3af" }}>
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


