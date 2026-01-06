"use client";

import { useState } from "react";
import { Copy, Eye, RefreshCw, Users, Zap, Coins, Settings, User, Search } from "lucide-react";
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
  tokensCharged: number | null;
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
  rateLimitPerUser: number;
  rateLimitPerApp: number;
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

  const handleCopyApiKey = async () => {
    await navigator.clipboard.writeText(app.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Users style={{ width: "22px", height: "22px", color: "#34d399" }} />
            </div>
            <div>
              <p style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa" }}>
                {app._count.users.toLocaleString()}
              </p>
              <p style={{ fontSize: "14px", color: "#71717a" }}>Total Users</p>
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
              <p style={{ fontSize: "14px", color: "#71717a" }}>Total Jobs</p>
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
              <p style={{ fontSize: "14px", color: "#71717a" }}>Welcome Tokens</p>
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
                <span style={{ fontSize: "12px", color: "#71717a", fontWeight: "400" }}>(Keep this secret!)</span>
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
                    color: "#a1a1aa",
                    fontFamily: "monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {showApiKey ? (
                      app.apiKey
                    ) : (
                      <>
                        <span style={{ color: "#71717a" }}>{app.apiKeyPrefix || "key_"}...</span>
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
                        background: copied ? "rgba(16, 185, 129, 0.2)" : "rgba(39, 39, 42, 0.6)",
                        border: copied ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(63, 63, 70, 0.5)",
                        color: copied ? "#34d399" : "#a1a1aa",
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
                        color: showApiKey ? "#60a5fa" : "#a1a1aa",
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
                        color: "#a1a1aa",
                        cursor: "pointer",
                      }}
                      title="Regenerate Key"
                    >
                      <RefreshCw style={{ width: "18px", height: "18px" }} />
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: "13px", color: "#71717a" }}>
                  Use this key in the <code style={{ color: "#10b981" }}>X-API-Key</code> header for API requests.
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
                  <label style={{ fontSize: "12px", color: "#71717a", marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Webhook URL
                  </label>
                  <p style={{ fontSize: "14px", color: app.webhookUrl ? "#e4e4e7" : "#71717a" }}>
                    {app.webhookUrl || "Not configured"}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#71717a", marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Webhook Secret
                  </label>
                  <p style={{ fontSize: "14px", color: app.webhookSecret ? "#e4e4e7" : "#71717a" }}>
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
          {/* Search placeholder */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "480px" }}>
              <Search style={{ 
                position: "absolute", 
                left: "16px", 
                top: "50%", 
                transform: "translateY(-50%)", 
                width: "18px", 
                height: "18px", 
                color: "#71717a" 
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
                {users.map((user) => (
                  <tr 
                    key={user.id} 
                    className="table-row-hover"
                    style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.25)" }}
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
                          <User style={{ width: "18px", height: "18px", color: "#71717a" }} />
                        </div>
                        <code style={{ 
                          fontSize: "12px", 
                          color: "#a1a1aa", 
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
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#a1a1aa", fontSize: "14px" }}>
                        <Zap style={{ width: "16px", height: "16px" }} />
                        <span>{user._count.jobs}</span>
                      </div>
                    </td>
                    <td style={{ padding: "18px 20px" }}>
                      <span className={user.isActive ? "badge-success" : "badge-error"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: "13px", color: "#71717a" }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "64px 20px", textAlign: "center", color: "#71717a" }}>
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
                    <td style={{ padding: "18px 20px", fontSize: "14px", color: "#a1a1aa", fontFamily: "monospace" }}>
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
                      {job.tokensCharged !== null ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Coins style={{ width: "14px", height: "14px", color: "#facc15" }} />
                          <span style={{ color: "#fafafa", fontSize: "14px" }}>{job.tokensCharged}</span>
                        </div>
                      ) : (
                        <span style={{ color: "#71717a", fontSize: "14px" }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: "13px", color: "#71717a" }}>
                      {new Date(job.createdAt).toLocaleString()}
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
        </div>
      )}
    </div>
  );
}

