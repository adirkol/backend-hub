"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Shield, Filter, RefreshCw, User, Server, Webhook, Search, X } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_type: string;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

const entityTypes = ["App", "AIModel", "AppUser", "ModelProviderConfig", "RevenueCatEvent"];
const actionTypes = [
  "app.created",
  "app.updated",
  "app.deleted",
  "app.users_deleted",
  "model.created",
  "model.updated",
  "model.deleted",
  "provider.config_updated",
  "user.tokens_adjusted",
  "user.status_changed",
  "user.deleted",
  "revenuecat.initial_purchase",
  "revenuecat.renewal",
  "revenuecat.non_renewing_purchase",
  "revenuecat.cancellation",
  "revenuecat.token_grant",
  "revenuecat.token_deduction",
  "revenuecat.user_created",
];

// Extract user identifier from audit log metadata
function getUserIdentifier(log: AuditLog): string | null {
  const metadata = log.metadata;
  
  // Check various possible user ID fields in metadata
  if (metadata) {
    // RevenueCat events - prefer external user ID
    if (metadata.userExternalId) return String(metadata.userExternalId);
    if (metadata.revenueCatUserId) return String(metadata.revenueCatUserId);
    
    // Admin actions on users
    if (metadata.userId) return String(metadata.userId);
    if (metadata.externalId) return String(metadata.externalId);
  }
  
  // If entity type is AppUser, the entity_id is the user
  if (log.entity_type === "AppUser") {
    return log.entity_id;
  }
  
  return null;
}

function ActionBadge({ action }: { action: string }) {
  const getStyle = () => {
    // RevenueCat events - special styling
    if (action.startsWith("revenuecat.")) {
      if (action.includes("purchase") || action.includes("renewal")) {
        // Revenue events - green (money coming in)
        return { bg: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "rgba(16, 185, 129, 0.3)" };
      }
      if (action.includes("cancellation")) {
        // Cancellation - red
        return { bg: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "rgba(239, 68, 68, 0.3)" };
      }
      if (action.includes("token_grant")) {
        // Token grant - cyan
        return { bg: "rgba(0, 240, 255, 0.15)", color: "#00f0ff", border: "rgba(0, 240, 255, 0.3)" };
      }
      if (action.includes("token_deduction")) {
        // Token deduction - orange
        return { bg: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.3)" };
      }
      if (action.includes("user_created")) {
        // User created via RC - purple
        return { bg: "rgba(139, 92, 246, 0.15)", color: "#a78bfa", border: "rgba(139, 92, 246, 0.3)" };
      }
      // Default RevenueCat - purple
      return { bg: "rgba(139, 92, 246, 0.15)", color: "#a78bfa", border: "rgba(139, 92, 246, 0.3)" };
    }
    
    // Standard admin actions
    if (action.includes("created")) {
      return { bg: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "rgba(16, 185, 129, 0.3)" };
    }
    if (action.includes("deleted")) {
      return { bg: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "rgba(239, 68, 68, 0.3)" };
    }
    if (action.includes("updated") || action.includes("adjusted") || action.includes("changed")) {
      return { bg: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.3)" };
    }
    return { bg: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" };
  };

  const style = getStyle();
  
  // Format action name for display
  const displayAction = action.startsWith("revenuecat.") 
    ? action.replace("revenuecat.", "RC: ").replace(/_/g, " ")
    : action;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: "500",
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {displayAction}
    </span>
  );
}

function EntityTypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    App: { bg: "rgba(139, 92, 246, 0.15)", color: "#a78bfa", border: "rgba(139, 92, 246, 0.3)" },
    AIModel: { bg: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" },
    AppUser: { bg: "rgba(236, 72, 153, 0.15)", color: "#f472b6", border: "rgba(236, 72, 153, 0.3)" },
    ModelProviderConfig: { bg: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "rgba(34, 197, 94, 0.3)" },
    RevenueCatEvent: { bg: "rgba(251, 146, 60, 0.15)", color: "#fb923c", border: "rgba(251, 146, 60, 0.3)" },
  };

  const style = colors[type] || { bg: "rgba(113, 113, 122, 0.2)", color: "#b8b8c8", border: "rgba(113, 113, 122, 0.3)" };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: "6px",
        fontSize: "11px",
        fontWeight: "500",
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {type}
    </span>
  );
}


export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [expandedMetadata, setExpandedMetadata] = useState<Set<string>>(new Set());
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String((page - 1) * limit));
      if (entityTypeFilter) params.set("entityType", entityTypeFilter);
      if (actionFilter) params.set("action", actionFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      
      const data: AuditLogsResponse = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [page, entityTypeFilter, actionFilter, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  const toggleMetadata = (logId: string) => {
    setExpandedMetadata((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setEntityTypeFilter("");
    setActionFilter("");
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(0, 240, 255, 0.15) 0%, rgba(0, 240, 255, 0.05) 100%)",
              border: "1px solid rgba(0, 240, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield style={{ width: "24px", height: "24px", color: "#00f0ff" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
              Audit Logs
            </h1>
            <p style={{ color: "#9ca3af", marginTop: "4px", fontSize: "15px" }}>
              {total.toLocaleString()} total events
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchLogs()}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 20px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "600",
            color: loading ? "#71717a" : "#00f0ff",
            background: "rgba(0, 240, 255, 0.08)",
            border: "1px solid rgba(0, 240, 255, 0.2)",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <RefreshCw style={{ width: "16px", height: "16px", animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Search and Filters */}
      <div
        className="glass"
        style={{
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Search */}
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "12px" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "500px" }}>
            <Search style={{ 
              position: "absolute", 
              left: "14px", 
              top: "50%", 
              transform: "translateY(-50%)", 
              width: "18px", 
              height: "18px", 
              color: "#71717a" 
            }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by user ID, external ID, app name..."
              style={{
                width: "100%",
                padding: "12px 40px 12px 44px",
                borderRadius: "10px",
                background: "rgba(39, 39, 42, 0.6)",
                border: searchQuery ? "1px solid rgba(0, 240, 255, 0.4)" : "1px solid rgba(63, 63, 70, 0.5)",
                color: "#fafafa",
                fontSize: "14px",
                outline: "none",
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X style={{ width: "16px", height: "16px", color: "#71717a" }} />
              </button>
            )}
          </div>
          <button
            type="submit"
            style={{
              padding: "12px 20px",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "500",
              color: "#00f0ff",
              background: "rgba(0, 240, 255, 0.1)",
              border: "1px solid rgba(0, 240, 255, 0.3)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Search style={{ width: "16px", height: "16px" }} />
            Search
          </button>
        </form>

        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Filter style={{ width: "16px", height: "16px", color: "#71717a" }} />
            <span style={{ fontSize: "14px", color: "#9ca3af", fontWeight: "500" }}>Filters:</span>
          </div>

          <select
            value={entityTypeFilter}
            onChange={(e) => {
              setEntityTypeFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "500",
              background: "rgba(39, 39, 42, 0.6)",
              border: "1px solid rgba(63, 63, 70, 0.5)",
              color: "#e4e4e7",
              outline: "none",
              cursor: "pointer",
              minWidth: "140px",
            }}
          >
            <option value="">All Entities</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "500",
              background: "rgba(39, 39, 42, 0.6)",
              border: "1px solid rgba(63, 63, 70, 0.5)",
              color: "#e4e4e7",
              outline: "none",
              cursor: "pointer",
              minWidth: "180px",
            }}
          >
            <option value="">All Actions</option>
            {actionTypes.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          {(entityTypeFilter || actionFilter || searchQuery) && (
            <button
              onClick={clearFilters}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "500",
                color: "#f87171",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Clear All
            </button>
          )}
        </div>
        
        {/* Active search indicator */}
        {searchQuery && (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "8px",
            padding: "8px 12px",
            background: "rgba(0, 240, 255, 0.05)",
            border: "1px solid rgba(0, 240, 255, 0.2)",
            borderRadius: "8px",
            width: "fit-content",
          }}>
            <Search style={{ width: "14px", height: "14px", color: "#00f0ff" }} />
            <span style={{ fontSize: "13px", color: "#9ca3af" }}>
              Searching for: <strong style={{ color: "#00f0ff" }}>{searchQuery}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className="glass" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.4)" }}>
                {["Time", "Action", "User", "Entity", "Actor", "IP"].map((header) => (
                  <th
                    key={header}
                    style={{
                      padding: "14px 12px",
                      textAlign: "left",
                      fontSize: "11px",
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
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "64px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <RefreshCw style={{ width: "24px", height: "24px", color: "#00f0ff", animation: "spin 1s linear infinite" }} />
                      <span style={{ color: "#9ca3af" }}>Loading audit logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "64px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <Shield style={{ width: "48px", height: "48px", color: "#3f3f46" }} />
                      <span style={{ color: "#9ca3af", fontSize: "15px" }}>No audit logs found</span>
                      {(entityTypeFilter || actionFilter) && (
                        <span style={{ color: "#71717a", fontSize: "13px" }}>Try adjusting your filters</span>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedMetadata.has(log.id);
                  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
                  const userId = getUserIdentifier(log);
                  
                  return (
                    <Fragment key={log.id}>
                      {/* Main Data Row - Clickable to expand */}
                      <tr
                        className="table-row-hover"
                        onClick={() => hasMetadata && toggleMetadata(log.id)}
                        style={{ 
                          borderBottom: isExpanded ? "none" : "1px solid rgba(63, 63, 70, 0.25)",
                          background: isExpanded ? "rgba(0, 240, 255, 0.02)" : "transparent",
                          cursor: hasMetadata ? "pointer" : "default",
                        }}
                      >
                        {/* Time */}
                        <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "12px", color: "#00f0ff", fontWeight: "500" }}>
                              {formatTimeAgo(log.created_at)}
                            </span>
                            <span style={{ fontSize: "10px", color: "#52525b" }}>
                              {formatDate(log.created_at)}
                            </span>
                          </div>
                        </td>
                        {/* Action */}
                        <td style={{ padding: "12px" }}>
                          <ActionBadge action={log.action} />
                        </td>
                        {/* User */}
                        <td style={{ padding: "12px" }}>
                          {userId ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <User style={{ width: "12px", height: "12px", color: "#71717a", flexShrink: 0 }} />
                              <code
                                style={{
                                  fontSize: "11px",
                                  color: "#9ca3af",
                                  fontFamily: "ui-monospace, monospace",
                                }}
                              >
                                {userId}
                              </code>
                            </div>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#52525b" }}>—</span>
                          )}
                        </td>
                        {/* Entity */}
                        <td style={{ padding: "12px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                            <EntityTypeBadge type={log.entity_type} />
                            <code
                              style={{
                                fontSize: "10px",
                                color: "#71717a",
                                fontFamily: "ui-monospace, monospace",
                              }}
                              title={log.entity_id}
                            >
                              {log.entity_id}
                            </code>
                          </div>
                        </td>
                        {/* Actor */}
                        <td style={{ padding: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            {log.actor_type === "admin" ? (
                              <User style={{ width: "12px", height: "12px", color: "#a78bfa", flexShrink: 0 }} />
                            ) : log.actor_type === "webhook" ? (
                              <Webhook style={{ width: "12px", height: "12px", color: "#fb923c", flexShrink: 0 }} />
                            ) : (
                              <Server style={{ width: "12px", height: "12px", color: "#9ca3af", flexShrink: 0 }} />
                            )}
                            <span
                              style={{
                                fontSize: "11px",
                                color: log.actor_type === "admin" ? "#a78bfa" : log.actor_type === "webhook" ? "#fb923c" : "#9ca3af",
                                fontWeight: "500",
                              }}
                            >
                              {log.actor_type}
                            </span>
                          </div>
                        </td>
                        {/* IP */}
                        <td style={{ padding: "12px", fontSize: "10px", color: "#52525b", fontFamily: "ui-monospace, monospace" }}>
                          {log.ip_address || "—"}
                        </td>
                      </tr>
                      
                      {/* Collapsible Detail Row */}
                      {isExpanded && hasMetadata && (
                        <tr style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.25)" }}>
                          <td
                            colSpan={6}
                            style={{
                              padding: "0 12px 16px 12px",
                              background: "linear-gradient(180deg, rgba(0, 240, 255, 0.03) 0%, rgba(0, 0, 0, 0.15) 100%)",
                            }}
                          >
                            <div
                              style={{
                                padding: "14px 16px",
                                borderRadius: "10px",
                                background: "rgba(0, 0, 0, 0.3)",
                                border: "1px solid rgba(0, 240, 255, 0.15)",
                              }}
                            >
                              <div style={{ 
                                fontSize: "10px", 
                                fontWeight: "600", 
                                color: "#52525b", 
                                textTransform: "uppercase", 
                                letterSpacing: "0.05em",
                                marginBottom: "10px",
                              }}>
                                Event Details
                              </div>
                              <pre
                                style={{
                                  fontSize: "11px",
                                  color: "#a1a1aa",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                                  margin: 0,
                                  lineHeight: "1.5",
                                }}
                              >
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "14px", color: "#9ca3af" }}>
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "500",
                color: page === 1 ? "#71717a" : "#b8b8c8",
                background: "rgba(39, 39, 42, 0.5)",
                border: "1px solid rgba(63, 63, 70, 0.3)",
                cursor: page === 1 ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: "14px", color: "#e4e4e7" }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "500",
                color: page === totalPages ? "#71717a" : "#b8b8c8",
                background: "rgba(39, 39, 42, 0.5)",
                border: "1px solid rgba(63, 63, 70, 0.3)",
                cursor: page === totalPages ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* CSS for spin animation */}
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
