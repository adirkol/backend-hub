import { prisma } from "@/lib/db";
import { Zap, CheckCircle, XCircle, AlertTriangle, HelpCircle, ExternalLink, Key } from "lucide-react";

async function getProviders() {
  const providers = await prisma.aIProvider.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          modelConfigs: true,
          usageLogs: true,
        },
      },
    },
  });

  // Get usage stats for last 24 hours
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const usageStats = await prisma.providerUsageLog.groupBy({
    by: ["providerId", "success"],
    where: { createdAt: { gte: yesterday } },
    _count: true,
  });

  const statsMap = new Map<string, { success: number; failed: number }>();
  for (const stat of usageStats) {
    const current = statsMap.get(stat.providerId) || { success: 0, failed: 0 };
    if (stat.success) {
      current.success = stat._count;
    } else {
      current.failed = stat._count;
    }
    statsMap.set(stat.providerId, current);
  }

  return providers.map((p) => ({
    ...p,
    stats24h: statsMap.get(p.id) || { success: 0, failed: 0 },
  }));
}

function HealthBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ElementType; bg: string; color: string; border: string; label: string }> = {
    HEALTHY: { 
      icon: CheckCircle, 
      bg: "rgba(16, 185, 129, 0.15)", 
      color: "#34d399", 
      border: "rgba(16, 185, 129, 0.3)",
      label: "Healthy" 
    },
    DEGRADED: { 
      icon: AlertTriangle, 
      bg: "rgba(245, 158, 11, 0.15)", 
      color: "#fbbf24", 
      border: "rgba(245, 158, 11, 0.3)",
      label: "Degraded" 
    },
    DOWN: { 
      icon: XCircle, 
      bg: "rgba(239, 68, 68, 0.15)", 
      color: "#f87171", 
      border: "rgba(239, 68, 68, 0.3)",
      label: "Down" 
    },
    UNKNOWN: { 
      icon: HelpCircle, 
      bg: "rgba(113, 113, 122, 0.2)", 
      color: "#a1a1aa", 
      border: "rgba(113, 113, 122, 0.3)",
      label: "Unknown" 
    },
  };

  const { icon: Icon, bg, color, border, label } = config[status] || config.UNKNOWN;

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 14px",
      borderRadius: "9999px",
      fontSize: "13px",
      fontWeight: "500",
      background: bg,
      color: color,
      border: `1px solid ${border}`,
    }}>
      <Icon style={{ width: "14px", height: "14px" }} />
      {label}
    </span>
  );
}

export default async function ProvidersPage() {
  const providers = await getProviders();

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
          AI Providers
        </h1>
        <p style={{ color: "#71717a", marginTop: "6px", fontSize: "15px" }}>
          Monitor provider health and usage
        </p>
      </div>

      {/* Providers Grid */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", 
        gap: "20px" 
      }}>
        {providers.map((provider) => {
          const total24h = provider.stats24h.success + provider.stats24h.failed;
          const successRate = total24h > 0 
            ? Math.round((provider.stats24h.success / total24h) * 100) 
            : null;

          return (
            <div key={provider.id} className="glass" style={{ padding: "28px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.3) 100%)",
                    border: "1px solid rgba(251, 191, 36, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Zap style={{ width: "22px", height: "22px", color: "#fbbf24" }} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: "600", color: "#fafafa", fontSize: "16px", marginBottom: "4px" }}>
                      {provider.displayName}
                    </h3>
                    <p style={{ fontSize: "13px", color: "#71717a", fontFamily: "monospace" }}>{provider.name}</p>
                  </div>
                </div>
                <HealthBadge status={provider.healthStatus} />
              </div>

              {/* Info */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                {provider.baseUrl && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
                    <ExternalLink style={{ width: "16px", height: "16px", color: "#71717a" }} />
                    <a 
                      href={provider.baseUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: "#a1a1aa", 
                        textDecoration: "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {provider.baseUrl}
                    </a>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
                  <Key style={{ width: "16px", height: "16px", color: "#71717a" }} />
                  <span style={{ color: "#a1a1aa" }}>
                    API Key: <code style={{ color: "#10b981" }}>{provider.apiKeyEnvVar}</code>
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr 1fr", 
                gap: "1px",
                background: "rgba(63, 63, 70, 0.3)",
                borderRadius: "12px",
                overflow: "hidden",
              }}>
                <div style={{ padding: "20px", textAlign: "center", background: "rgba(24, 24, 27, 0.8)" }}>
                  <p style={{ fontSize: "24px", fontWeight: "700", color: "#fafafa" }}>{provider._count.modelConfigs}</p>
                  <p style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>Models</p>
                </div>
                <div style={{ padding: "20px", textAlign: "center", background: "rgba(24, 24, 27, 0.8)" }}>
                  <p style={{ fontSize: "24px", fontWeight: "700", color: "#fafafa" }}>{total24h}</p>
                  <p style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>Requests (24h)</p>
                </div>
                <div style={{ padding: "20px", textAlign: "center", background: "rgba(24, 24, 27, 0.8)" }}>
                  <p style={{ 
                    fontSize: "24px", 
                    fontWeight: "700", 
                    color: successRate === null 
                      ? "#71717a" 
                      : successRate >= 95 
                        ? "#34d399" 
                        : successRate >= 80 
                          ? "#fbbf24" 
                          : "#f87171"
                  }}>
                    {successRate !== null ? `${successRate}%` : "—"}
                  </p>
                  <p style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>Success Rate</p>
                </div>
              </div>

              {/* Status */}
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between", 
                marginTop: "20px" 
              }}>
                <span className={provider.isEnabled ? "badge-success" : "badge-error"}>
                  {provider.isEnabled ? "Enabled" : "Disabled"}
                </span>
                {provider.lastHealthCheck && (
                  <span style={{ fontSize: "13px", color: "#71717a" }}>
                    Last check: {new Date(provider.lastHealthCheck).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {providers.length === 0 && (
          <div className="glass" style={{ 
            gridColumn: "1 / -1", 
            padding: "64px 32px", 
            textAlign: "center" 
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "rgba(39, 39, 42, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <Zap style={{ width: "32px", height: "32px", color: "#71717a" }} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#e4e4e7", marginBottom: "10px" }}>
              No providers configured
            </h3>
            <p style={{ color: "#71717a", maxWidth: "320px", margin: "0 auto" }}>
              Add providers to enable AI generation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
