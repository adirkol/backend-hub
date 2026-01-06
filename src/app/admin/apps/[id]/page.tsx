import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowLeft, Copy, Eye, RefreshCw, Users, Zap, Coins } from "lucide-react";
import { AppSettingsForm } from "./settings-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getApp(id: string) {
  const app = await prisma.app.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          jobs: true,
        },
      },
    },
  });

  return app;
}

export default async function AppDetailPage({ params }: PageProps) {
  const { id } = await params;
  const app = await getApp(id);

  if (!app) {
    notFound();
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div>
        <Link
          href="/admin/apps"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
            color: "#71717a",
            textDecoration: "none",
            marginBottom: "20px",
          }}
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} />
          Back to Apps
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
              {app.name}
            </h1>
            <p style={{ color: "#71717a", marginTop: "6px", fontSize: "15px", fontFamily: "monospace" }}>
              {app.slug}
            </p>
          </div>
          <span className={app.isEnabled ? "badge-success" : "badge-error"}>
            {app.isEnabled ? "Active" : "Disabled"}
          </span>
        </div>
      </div>

      {/* Stats */}
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
                <span style={{ color: "#71717a" }}>{app.apiKeyPrefix || "key_"}...</span>
                <span style={{ filter: "blur(4px)" }}>{app.apiKey.slice(-12)}</span>
              </code>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    background: "rgba(39, 39, 42, 0.6)",
                    border: "1px solid rgba(63, 63, 70, 0.5)",
                    color: "#a1a1aa",
                    cursor: "pointer",
                  }}
                  title="Copy API Key"
                >
                  <Copy style={{ width: "18px", height: "18px" }} />
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

      {/* Quick Links */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <Link
          href={`/admin/apps/${app.id}/users`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 24px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#a1a1aa",
            textDecoration: "none",
            background: "rgba(39, 39, 42, 0.5)",
            border: "1px solid rgba(63, 63, 70, 0.5)",
            transition: "all 0.15s ease",
          }}
        >
          <Users style={{ width: "18px", height: "18px" }} />
          View Users
        </Link>
        <Link
          href={`/admin/jobs?app=${app.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 24px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#a1a1aa",
            textDecoration: "none",
            background: "rgba(39, 39, 42, 0.5)",
            border: "1px solid rgba(63, 63, 70, 0.5)",
            transition: "all 0.15s ease",
          }}
        >
          <Zap style={{ width: "18px", height: "18px" }} />
          View Jobs
        </Link>
      </div>
    </div>
  );
}
