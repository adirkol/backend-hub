"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Filter, ChevronDown, ChevronRight, RefreshCw, Clock, User, Server, FileText } from "lucide-react";

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

const entityTypes = ["App", "AIModel", "AppUser", "ModelProviderConfig"];
const actionTypes = [
  "app.created",
  "app.updated",
  "app.deleted",
  "model.created",
  "model.updated",
  "model.deleted",
  "provider.config_updated",
  "user.tokens_adjusted",
  "user.status_changed",
  "user.deleted",
];

function ActionBadge({ action }: { action: string }) {
  const getStyle = () => {
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

  return (
    <span
      style={{
        padding: "5px 12px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: "500",
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {action}
    </span>
  );
}

function EntityTypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    App: { bg: "rgba(139, 92, 246, 0.15)", color: "#a78bfa", border: "rgba(139, 92, 246, 0.3)" },
    AIModel: { bg: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" },
    AppUser: { bg: "rgba(236, 72, 153, 0.15)", color: "#f472b6", border: "rgba(236, 72, 153, 0.3)" },
    ModelProviderConfig: { bg: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "rgba(34, 197, 94, 0.3)" },
  };

  const style = colors[type] || { bg: "rgba(113, 113, 122, 0.2)", color: "#b8b8c8", border: "rgba(113, 113, 122, 0.3)" };

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: "500",
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {type}
    </span>
  );
}

function MetadataViewer({ metadata, isOpen, onToggle }: { metadata: Record<string, unknown> | null; isOpen: boolean; onToggle: () => void }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return <span style={{ color: "#71717a", fontSize: "13px" }}>—</span>;
  }

  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "8px",
          fontSize: "12px",
          fontWeight: "500",
          color: "#00f0ff",
          background: "rgba(0, 240, 255, 0.08)",
          border: "1px solid rgba(0, 240, 255, 0.2)",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        {isOpen ? <ChevronDown style={{ width: "14px", height: "14px" }} /> : <ChevronRight style={{ width: "14px", height: "14px" }} />}
        View Details
      </button>
      {isOpen && (
        <div
          style={{
            marginTop: "12px",
            padding: "14px",
            borderRadius: "10px",
            background: "rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(60, 60, 80, 0.3)",
            maxWidth: "400px",
            overflow: "auto",
          }}
        >
          <pre
            style={{
              fontSize: "11px",
              color: "#b8b8c8",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              margin: 0,
            }}
          >
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
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
  }, [page, entityTypeFilter, actionFilter]);

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

      {/* Filters */}
      <div
        className="glass"
        style={{
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Filter style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
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

        {(entityTypeFilter || actionFilter) && (
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
            Clear Filters
          </button>
        )}
      </div>

      {/* Logs Table */}
      <div className="glass" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.4)" }}>
                {["Time", "Action", "Entity", "Entity ID", "Actor", "IP Address", "Metadata"].map((header) => (
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
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "64px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <RefreshCw style={{ width: "24px", height: "24px", color: "#00f0ff", animation: "spin 1s linear infinite" }} />
                      <span style={{ color: "#9ca3af" }}>Loading audit logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "64px 20px", textAlign: "center" }}>
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
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="table-row-hover"
                    style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.25)" }}
                  >
                    <td style={{ padding: "16px 20px", minWidth: "160px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Clock style={{ width: "14px", height: "14px", color: "#71717a" }} />
                          <span style={{ fontSize: "13px", color: "#00f0ff", fontWeight: "500" }}>
                            {formatTimeAgo(log.created_at)}
                          </span>
                        </div>
                        <span style={{ fontSize: "11px", color: "#71717a" }}>{formatDate(log.created_at)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <ActionBadge action={log.action} />
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <EntityTypeBadge type={log.entity_type} />
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <code
                        style={{
                          fontSize: "12px",
                          color: "#b8b8c8",
                          background: "rgba(39, 39, 42, 0.6)",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          fontFamily: "monospace",
                          border: "1px solid rgba(63, 63, 70, 0.3)",
                        }}
                      >
                        {log.entity_id.slice(0, 12)}...
                      </code>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {log.actor_type === "admin" ? (
                          <User style={{ width: "14px", height: "14px", color: "#a78bfa" }} />
                        ) : (
                          <Server style={{ width: "14px", height: "14px", color: "#9ca3af" }} />
                        )}
                        <span
                          style={{
                            fontSize: "13px",
                            color: log.actor_type === "admin" ? "#a78bfa" : "#9ca3af",
                            fontWeight: "500",
                          }}
                        >
                          {log.actor_type}
                        </span>
                      </div>
                      {log.actor_id && (
                        <code
                          style={{
                            display: "block",
                            marginTop: "4px",
                            fontSize: "11px",
                            color: "#71717a",
                            fontFamily: "monospace",
                          }}
                        >
                          {log.actor_id.slice(0, 10)}...
                        </code>
                      )}
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#9ca3af", fontFamily: "monospace" }}>
                      {log.ip_address || "—"}
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <MetadataViewer
                        metadata={log.metadata}
                        isOpen={expandedMetadata.has(log.id)}
                        onToggle={() => toggleMetadata(log.id)}
                      />
                    </td>
                  </tr>
                ))
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
