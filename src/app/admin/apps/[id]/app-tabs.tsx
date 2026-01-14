"use client";

import { useState } from "react";
import { Copy, Eye, RefreshCw, Users, Zap, Coins, Settings, User, Search, Trash2, AlertTriangle } from "lucide-react";
import { AppSettingsForm } from "./settings-form";

interface AppUser {
  id: string;
  externalId: string;
  tokenBalance: number;
  isActive: boolean;
  createdAt: string;
  _count: { jobs: number };
}

interface Job {
  id: string;
  status: string;
  tokensCharged: boolean;
  tokenCost: number;
  createdAt: string;
  completedAt: string | null;
  appUser: { externalId: string } | null;
  aiModel: { displayName: string } | null;
}

interface AppData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  apiKey: string;
  apiKeyPrefix: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
  isEnabled: boolean;
  defaultTokenGrant: number;
  dailyTokenGrant: number;
  tokenExpirationDays: number | null;
  rateLimitPerUser: number;
  rateLimitPerApp: number;
  revenueCatAppId: string | null;
  _count: { users: number; jobs: number };
}

interface AppTabsProps {
  app: AppData;
  users: AppUser[];
  jobs: Job[];
  userCount: number;
  jobCount: number;
}

type TabType = "settings" | "users" | "jobs";

export function AppTabs({ app, users, jobs, userCount, jobCount }: AppTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("settings");
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteAuditLogs, setDeleteAuditLogs] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ users: number; jobs: number; auditLogs?: number } | null>(null);

  const handleCopyApiKey = async () => {
    await navigator.clipboard.writeText(app.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteAllUsers = async () => {
    if (deleteConfirmText !== app.slug) return;
    
    setIsDeleting(true);
    try {
      const params = new URLSearchParams();
      if (deleteAuditLogs) params.set("deleteAuditLogs", "true");
      
      const res = await fetch(`/api/admin/apps/${app.id}/users?${params.toString()}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete users");
      }
      
      const data = await res.json();
      setDeleteResult(data.deleted);
      
      // Reload page after a delay to show results
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error deleting users:", error);
      alert(error instanceof Error ? error.message : "Failed to delete users");
    } finally {
      setIsDeleting(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "settings", label: "Settings", icon: <Settings style={{ width: "16px", height: "16px" }} /> },
    { id: "users", label: "Users", icon: <Users style={{ width: "16px", height: "16px" }} />, count: userCount },
    { id: "jobs", label: "Jobs", icon: <Zap style={{ width: "16px", height: "16px" }} />, count: jobCount },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
        <div className="glass" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(0, 184, 204, 0.3) 100%)",
              border: "1px solid rgba(0, 240, 255, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Users style={{ width: "22px", height: "22px", color: "#00f0ff" }} />
            </div>
            <div>
              <p style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa" }}>
                {app._count.users.toLocaleString()}
              </p>
              <p style={{ fontSize: "14px", color: "#9ca3af" }}>Total Users</p>
            </div>
          </div>
        </div>
        <div className="glass" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Zap style={{ width: "22px", height: "22px", color: "#60a5fa" }} />
            </div>
            <div>
              <p style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa" }}>
                {app._count.jobs.toLocaleString()}
              </p>
              <p style={{ fontSize: "14px", color: "#9ca3af" }}>Total Jobs</p>
            </div>
          </div>
        </div>
        <div className="glass" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.3) 100%)",
              border: "1px solid rgba(251, 191, 36, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Coins style={{ width: "22px", height: "22px", color: "#fbbf24" }} />
            </div>
            <div>
              <p style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa" }}>
                {app.defaultTokenGrant}
              </p>
              <p style={{ fontSize: "14px", color: "#9ca3af" }}>Welcome Tokens</p>
            </div>
          </div>
        </div>
        <div className="glass" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: app.dailyTokenGrant > 0 
                ? "linear-gradient(135deg, rgba(167, 139, 250, 0.2) 0%, rgba(139, 92, 246, 0.3) 100%)"
                : "linear-gradient(135deg, rgba(82, 82, 91, 0.2) 0%, rgba(63, 63, 70, 0.3) 100%)",
              border: app.dailyTokenGrant > 0 
                ? "1px solid rgba(167, 139, 250, 0.3)"
                : "1px solid rgba(82, 82, 91, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <RefreshCw style={{ width: "22px", height: "22px", color: app.dailyTokenGrant > 0 ? "#a78bfa" : "#52525b" }} />
            </div>
            <div>
              <p style={{ fontSize: "28px", fontWeight: "700", color: app.dailyTokenGrant > 0 ? "#fafafa" : "#71717a" }}>
                {app.dailyTokenGrant > 0 ? app.dailyTokenGrant : "Off"}
              </p>
              <p style={{ fontSize: "14px", color: "#9ca3af" }}>Daily Tokens</p>
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
      {activeTab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
            {/* API Key Section */}
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
                API Key
                <span style={{ fontSize: "12px", color: "#9ca3af", fontWeight: "400" }}>(Keep this secret!)</span>
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <code style={{
                    flex: 1,
                    padding: "16px 18px",
                    borderRadius: "12px",
                    background: "rgba(39, 39, 42, 0.5)",
                    border: "1px solid rgba(63, 63, 70, 0.5)",
                    fontSize: "14px",
                    color: "#b8b8c8",
                    fontFamily: "monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {showApiKey ? (
                      app.apiKey
                    ) : (
                      <>
                        <span style={{ color: "#9ca3af" }}>{app.apiKeyPrefix || "key_"}...</span>
                        <span style={{ filter: "blur(4px)" }}>{app.apiKey.slice(-12)}</span>
                      </>
                    )}
                  </code>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={handleCopyApiKey}
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        background: copied ? "rgba(0, 240, 255, 0.2)" : "rgba(39, 39, 42, 0.6)",
                        border: copied ? "1px solid rgba(0, 240, 255, 0.4)" : "1px solid rgba(63, 63, 70, 0.5)",
                        color: copied ? "#00f0ff" : "#b8b8c8",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      title={copied ? "Copied!" : "Copy API Key"}
                    >
                      <Copy style={{ width: "18px", height: "18px" }} />
                    </button>
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        background: showApiKey ? "rgba(59, 130, 246, 0.2)" : "rgba(39, 39, 42, 0.6)",
                        border: showApiKey ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid rgba(63, 63, 70, 0.5)",
                        color: showApiKey ? "#60a5fa" : "#b8b8c8",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      title="Show/Hide"
                    >
                      <Eye style={{ width: "18px", height: "18px" }} />
                    </button>
                    <button
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        background: "rgba(39, 39, 42, 0.6)",
                        border: "1px solid rgba(63, 63, 70, 0.5)",
                        color: "#b8b8c8",
                        cursor: "pointer",
                      }}
                      title="Regenerate Key"
                    >
                      <RefreshCw style={{ width: "18px", height: "18px" }} />
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: "13px", color: "#9ca3af" }}>
                  Use this key in the <code style={{ color: "#00f0ff" }}>X-API-Key</code> header for API requests.
                </p>
              </div>
            </div>

            {/* Webhook Section */}
            <div className="glass" style={{ padding: "28px" }}>
              <h2 style={{ fontWeight: "600", color: "#e4e4e7", marginBottom: "20px", fontSize: "16px" }}>
                Webhook Configuration
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Webhook URL
                  </label>
                  <p style={{ fontSize: "14px", color: app.webhookUrl ? "#e4e4e7" : "#9ca3af" }}>
                    {app.webhookUrl || "Not configured"}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Webhook Secret
                  </label>
                  <p style={{ fontSize: "14px", color: app.webhookSecret ? "#e4e4e7" : "#9ca3af" }}>
                    {app.webhookSecret ? (
                      <span style={{ filter: "blur(4px)" }}>{app.webhookSecret}</span>
                    ) : (
                      "Not configured"
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Form */}
          <AppSettingsForm app={app} />
        </div>
      )}

      {activeTab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Search and Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "480px" }}>
              <Search style={{ 
                position: "absolute", 
                left: "16px", 
                top: "50%", 
                transform: "translateY(-50%)", 
                width: "18px", 
                height: "18px", 
                color: "#9ca3af" 
              }} />
              <input
                type="text"
                placeholder="Search users by external ID..."
                style={{
                  width: "100%",
                  padding: "14px 16px 14px 48px",
                  borderRadius: "12px",
                  background: "rgba(39, 39, 42, 0.5)",
                  border: "1px solid rgba(63, 63, 70, 0.6)",
                  color: "#fafafa",
                  fontSize: "15px",
                  outline: "none",
                }}
              />
            </div>
            
            {/* Delete All Users Button */}
            {userCount > 0 && (
              <button
                onClick={() => setShowDeleteModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 18px",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#f87171",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Trash2 style={{ width: "16px", height: "16px" }} />
                Delete All Users
              </button>
            )}
          </div>

          {/* Users Table */}
          <div className="glass" style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.4)" }}>
                  {["User", "External ID", "Balance", "Jobs", "Status", "Created"].map((header) => (
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
                {users.map((user) => (
                  <tr 
                    key={user.id} 
                    className="table-row-hover"
                    style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.25)", cursor: "pointer" }}
                    onClick={() => window.location.href = `/admin/apps/${app.id}/users/${user.id}`}
                  >
                    <td style={{ padding: "18px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "10px",
                          background: "rgba(39, 39, 42, 0.6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          <User style={{ width: "18px", height: "18px", color: "#9ca3af" }} />
                        </div>
                        <code style={{ 
                          fontSize: "12px", 
                          color: "#b8b8c8", 
                          background: "rgba(39, 39, 42, 0.5)", 
                          padding: "6px 10px", 
                          borderRadius: "6px",
                          fontFamily: "monospace",
                        }}>
                          {user.id.slice(0, 8)}...
                        </code>
                      </div>
                    </td>
                    <td style={{ 
                      padding: "18px 20px", 
                      fontSize: "14px", 
                      color: "#e4e4e7", 
                      fontFamily: "monospace" 
                    }}>
                      {user.externalId}
                    </td>
                    <td style={{ padding: "18px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Coins style={{ width: "16px", height: "16px", color: "#facc15" }} />
                        <span style={{ color: "#fafafa", fontWeight: "600", fontSize: "14px" }}>
                          {user.tokenBalance}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "18px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#b8b8c8", fontSize: "14px" }}>
                        <Zap style={{ width: "16px", height: "16px" }} />
                        <span>{user._count.jobs}</span>
                      </div>
                    </td>
                    <td style={{ padding: "18px 20px" }}>
                      <span className={user.isActive ? "badge-success" : "badge-error"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: "13px", color: "#9ca3af" }}>
                      {new Date(user.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "64px 20px", textAlign: "center", color: "#9ca3af" }}>
                      No users yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "jobs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Jobs Table */}
          <div className="glass" style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.4)" }}>
                  {["Job ID", "Model", "User", "Status", "Tokens", "Created"].map((header) => (
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
                    <td style={{ padding: "18px 20px", fontSize: "14px", color: "#b8b8c8", fontFamily: "monospace" }}>
                      {job.appUser?.externalId || "-"}
                    </td>
                    <td style={{ padding: "18px 20px" }}>
                      <span className={
                        job.status === "SUCCEEDED" ? "badge-success" :
                        job.status === "FAILED" ? "badge-error" :
                        job.status === "PROCESSING" ? "badge-warning" : "badge-default"
                      }>
                        {job.status}
                      </span>
                    </td>
                    <td style={{ padding: "18px 20px" }}>
                      {job.tokensCharged ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Coins style={{ width: "14px", height: "14px", color: "#facc15" }} />
                          <span style={{ color: "#fafafa", fontSize: "14px" }}>{job.tokenCost}</span>
                        </div>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: "14px" }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: "13px", color: "#9ca3af" }}>
                      {new Date(job.createdAt).toLocaleString()}
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
        </div>
      )}

      {/* Delete All Users Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => {
            if (!isDeleting) {
              setShowDeleteModal(false);
              setDeleteConfirmText("");
              setDeleteAuditLogs(false);
            }
          }}
        >
          <div
            className="glass"
            style={{
              padding: "32px",
              maxWidth: "480px",
              width: "90%",
              borderRadius: "16px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {deleteResult ? (
              // Success State
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <Trash2 style={{ width: "28px", height: "28px", color: "#34d399" }} />
                </div>
                <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#fafafa", marginBottom: "12px" }}>
                  Deleted Successfully
                </h2>
                <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "8px" }}>
                  Removed {deleteResult.users} users and {deleteResult.jobs} jobs.
                </p>
                {deleteResult.auditLogs !== undefined && deleteResult.auditLogs > 0 && (
                  <p style={{ color: "#71717a", fontSize: "13px", marginBottom: "12px" }}>
                    Also deleted {deleteResult.auditLogs} audit log entries.
                  </p>
                )}
                <p style={{ color: "#71717a", fontSize: "12px" }}>
                  Refreshing page...
                </p>
              </div>
            ) : (
              // Confirmation State
              <>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "24px" }}>
                  <div style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "rgba(239, 68, 68, 0.2)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <AlertTriangle style={{ width: "24px", height: "24px", color: "#f87171" }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fafafa", marginBottom: "8px" }}>
                      Delete All Users?
                    </h2>
                    <p style={{ color: "#9ca3af", fontSize: "14px", lineHeight: "1.5" }}>
                      This will permanently delete <strong style={{ color: "#f87171" }}>{userCount} users</strong> and all their related data including:
                    </p>
                    <ul style={{ color: "#9ca3af", fontSize: "13px", marginTop: "12px", paddingLeft: "20px" }}>
                      <li>Token ledger entries</li>
                      <li>Generation jobs</li>
                      <li>RevenueCat events</li>
                    </ul>
                  </div>
                </div>

                {/* Audit Logs Option */}
                <div 
                  style={{ 
                    marginBottom: "20px",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    background: deleteAuditLogs ? "rgba(251, 191, 36, 0.1)" : "rgba(39, 39, 42, 0.4)",
                    border: deleteAuditLogs ? "1px solid rgba(251, 191, 36, 0.3)" : "1px solid rgba(63, 63, 70, 0.3)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => !isDeleting && setDeleteAuditLogs(!deleteAuditLogs)}
                >
                  <label style={{ 
                    display: "flex", 
                    alignItems: "flex-start", 
                    gap: "12px",
                    cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={deleteAuditLogs}
                      onChange={(e) => setDeleteAuditLogs(e.target.checked)}
                      disabled={isDeleting}
                      style={{
                        width: "18px",
                        height: "18px",
                        marginTop: "2px",
                        accentColor: "#fbbf24",
                        cursor: "pointer",
                      }}
                    />
                    <div>
                      <span style={{ 
                        fontSize: "14px", 
                        fontWeight: "500",
                        color: deleteAuditLogs ? "#fbbf24" : "#e4e4e7",
                      }}>
                        Also delete audit logs
                      </span>
                      <p style={{ 
                        fontSize: "12px", 
                        color: "#71717a", 
                        marginTop: "4px",
                        lineHeight: "1.4",
                      }}>
                        Remove all audit log entries related to these users and their RevenueCat events. 
                        <span style={{ color: "#f87171" }}> This cannot be undone.</span>
                      </p>
                    </div>
                  </label>
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label style={{ 
                    display: "block", 
                    fontSize: "13px", 
                    color: "#9ca3af", 
                    marginBottom: "8px" 
                  }}>
                    Type <code style={{ color: "#f87171", background: "rgba(239, 68, 68, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>{app.slug}</code> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={app.slug}
                    disabled={isDeleting}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: "10px",
                      background: "rgba(39, 39, 42, 0.6)",
                      border: deleteConfirmText === app.slug 
                        ? "1px solid rgba(239, 68, 68, 0.5)" 
                        : "1px solid rgba(63, 63, 70, 0.5)",
                      color: "#fafafa",
                      fontSize: "14px",
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteConfirmText("");
                      setDeleteAuditLogs(false);
                    }}
                    disabled={isDeleting}
                    style={{
                      flex: 1,
                      padding: "14px",
                      borderRadius: "10px",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#b8b8c8",
                      background: "rgba(39, 39, 42, 0.6)",
                      border: "1px solid rgba(63, 63, 70, 0.5)",
                      cursor: isDeleting ? "not-allowed" : "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAllUsers}
                    disabled={deleteConfirmText !== app.slug || isDeleting}
                    style={{
                      flex: 1,
                      padding: "14px",
                      borderRadius: "10px",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: deleteConfirmText === app.slug ? "#fafafa" : "#71717a",
                      background: deleteConfirmText === app.slug 
                        ? "rgba(239, 68, 68, 0.8)" 
                        : "rgba(239, 68, 68, 0.2)",
                      border: "1px solid rgba(239, 68, 68, 0.5)",
                      cursor: deleteConfirmText === app.slug && !isDeleting ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    {isDeleting ? (
                      <>
                        <RefreshCw style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 style={{ width: "16px", height: "16px" }} />
                        Delete All Users
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CSS for spin animation */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

