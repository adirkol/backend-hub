"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Trash2, Copy, Check, ExternalLink } from "lucide-react";

interface App {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isEnabled: boolean;
  defaultTokenGrant: number;
  tokenExpirationDays: number | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
  rateLimitPerUser: number;
  rateLimitPerApp: number;
  revenueCatAppId: string | null;
}

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "12px",
  background: "rgba(39, 39, 42, 0.5)",
  border: "1px solid rgba(63, 63, 70, 0.6)",
  color: "#fafafa",
  fontSize: "15px",
  outline: "none",
};

const labelStyle = {
  display: "block",
  fontSize: "14px",
  fontWeight: "500" as const,
  color: "#e4e4e7",
  marginBottom: "10px",
};

export function AppSettingsForm({ app }: { app: App }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [form, setForm] = useState({
    name: app.name,
    description: app.description || "",
    isEnabled: app.isEnabled,
    defaultTokenGrant: app.defaultTokenGrant,
    tokenExpirationDays: app.tokenExpirationDays,
    webhookUrl: app.webhookUrl || "",
    webhookSecret: app.webhookSecret || "",
    rateLimitPerUser: app.rateLimitPerUser,
    rateLimitPerApp: app.rateLimitPerApp,
    revenueCatAppId: app.revenueCatAppId || "",
  });

  // Track the origin for the webhook URL (client-side only to avoid hydration mismatch)
  const [origin, setOrigin] = useState<string>("");
  
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Generate the RevenueCat webhook URL
  const revenueCatWebhookUrl = form.revenueCatAppId && origin
    ? `${origin}/api/webhooks/revenuecat/${form.revenueCatAppId}`
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/admin/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update app");
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this app? This action cannot be undone.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/apps/${app.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete app");
      }

      router.push("/admin/apps");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {error && (
        <div style={{
          padding: "16px 20px",
          borderRadius: "12px",
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          color: "#fca5a5",
          fontSize: "14px",
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: "16px 20px",
          borderRadius: "12px",
          background: "rgba(0, 240, 255, 0.1)",
          border: "1px solid rgba(0, 240, 255, 0.25)",
          color: "#00f0ff",
          fontSize: "14px",
        }}>
          Settings saved successfully!
        </div>
      )}

      <div className="glass" style={{ padding: "28px" }}>
        <h2 style={{ 
          fontWeight: "600", 
          color: "#e4e4e7", 
          paddingBottom: "20px", 
          borderBottom: "1px solid rgba(63, 63, 70, 0.4)",
          marginBottom: "24px",
          fontSize: "16px",
        }}>
          App Settings
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "24px", alignItems: "start" }}>
            <div>
              <label style={labelStyle}>App Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "14px", paddingTop: "36px" }}>
              <label style={{ fontSize: "14px", fontWeight: "500", color: "#e4e4e7" }}>Enabled</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, isEnabled: !form.isEnabled })}
                style={{
                  position: "relative",
                  width: "52px",
                  height: "28px",
                  borderRadius: "9999px",
                  background: form.isEnabled ? "#00f0ff" : "rgba(63, 63, 70, 0.8)",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "4px",
                    left: form.isEnabled ? "28px" : "4px",
                    width: "20px",
                    height: "20px",
                    borderRadius: "9999px",
                    background: "#fff",
                    transition: "left 0.2s ease",
                  }}
                />
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              style={{ ...inputStyle, resize: "none", minHeight: "80px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <label style={labelStyle}>Default Token Grant</label>
              <input
                type="number"
                min="0"
                value={form.defaultTokenGrant}
                onChange={(e) => setForm({ ...form, defaultTokenGrant: parseInt(e.target.value) || 0 })}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Token Expiration (days)</label>
              <input
                type="number"
                min="1"
                value={form.tokenExpirationDays ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm({ 
                    ...form, 
                    tokenExpirationDays: value === "" ? null : parseInt(value) || null 
                  });
                }}
                style={inputStyle}
                placeholder="Never expires"
              />
              <p style={{ 
                fontSize: "12px", 
                color: "#9ca3af", 
                marginTop: "8px",
              }}>
                Leave empty for tokens that never expire
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="glass" style={{ padding: "28px" }}>
        <h2 style={{ 
          fontWeight: "600", 
          color: "#e4e4e7", 
          paddingBottom: "20px", 
          borderBottom: "1px solid rgba(63, 63, 70, 0.4)",
          marginBottom: "24px",
          fontSize: "16px",
        }}>
          Webhook Settings
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <label style={labelStyle}>Webhook URL</label>
            <input
              type="url"
              value={form.webhookUrl}
              onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
              style={inputStyle}
              placeholder="https://yourapp.com/webhook"
            />
          </div>

          <div>
            <label style={labelStyle}>Webhook Secret</label>
            <input
              type="text"
              value={form.webhookSecret}
              onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
              style={inputStyle}
              placeholder="whsec_..."
            />
          </div>
        </div>
      </div>

      <div className="glass" style={{ padding: "28px" }}>
        <h2 style={{ 
          fontWeight: "600", 
          color: "#e4e4e7", 
          paddingBottom: "20px", 
          borderBottom: "1px solid rgba(63, 63, 70, 0.4)",
          marginBottom: "24px",
          fontSize: "16px",
        }}>
          Rate Limits
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <label style={labelStyle}>Per User (req/min)</label>
            <input
              type="number"
              min="1"
              value={form.rateLimitPerUser}
              onChange={(e) => setForm({ ...form, rateLimitPerUser: parseInt(e.target.value) || 30 })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Per App (req/min)</label>
            <input
              type="number"
              min="1"
              value={form.rateLimitPerApp}
              onChange={(e) => setForm({ ...form, rateLimitPerApp: parseInt(e.target.value) || 1000 })}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <div className="glass" style={{ padding: "28px" }}>
        <h2 style={{ 
          fontWeight: "600", 
          color: "#e4e4e7", 
          paddingBottom: "20px", 
          borderBottom: "1px solid rgba(63, 63, 70, 0.4)",
          marginBottom: "24px",
          fontSize: "16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}>
          RevenueCat Integration
          <a 
            href="https://www.revenuecat.com/docs/integrations/webhooks/overview"
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              color: "#9ca3af", 
              display: "inline-flex",
              transition: "color 0.15s ease",
            }}
            title="RevenueCat Webhook Docs"
          >
            <ExternalLink style={{ width: "16px", height: "16px" }} />
          </a>
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <label style={labelStyle}>RevenueCat App ID</label>
            <input
              type="text"
              value={form.revenueCatAppId}
              onChange={(e) => setForm({ ...form, revenueCatAppId: e.target.value })}
              style={inputStyle}
              placeholder="appe83c86b6a7"
            />
            <p style={{ 
              fontSize: "13px", 
              color: "#9ca3af", 
              marginTop: "10px",
              lineHeight: "1.5",
            }}>
              Find this in your RevenueCat dashboard under App Settings → App IDs. 
              This enables automatic token management and revenue tracking.
            </p>
          </div>

          {revenueCatWebhookUrl && (
            <div style={{
              padding: "20px",
              borderRadius: "12px",
              background: "rgba(0, 240, 255, 0.08)",
              border: "1px solid rgba(0, 240, 255, 0.2)",
            }}>
              <label style={{ 
                ...labelStyle, 
                color: "#00f0ff", 
                marginBottom: "12px",
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Webhook URL for RevenueCat
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <code style={{
                  flex: 1,
                  padding: "14px 16px",
                  borderRadius: "10px",
                  background: "rgba(39, 39, 42, 0.6)",
                  border: "1px solid rgba(63, 63, 70, 0.4)",
                  fontSize: "13px",
                  color: "#e4e4e7",
                  fontFamily: "monospace",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {revenueCatWebhookUrl}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(revenueCatWebhookUrl);
                    setWebhookCopied(true);
                    setTimeout(() => setWebhookCopied(false), 2000);
                  }}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    background: webhookCopied ? "rgba(0, 240, 255, 0.2)" : "rgba(39, 39, 42, 0.6)",
                    border: webhookCopied ? "1px solid rgba(0, 240, 255, 0.4)" : "1px solid rgba(63, 63, 70, 0.5)",
                    color: webhookCopied ? "#00f0ff" : "#b8b8c8",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title={webhookCopied ? "Copied!" : "Copy webhook URL"}
                >
                  {webhookCopied ? (
                    <Check style={{ width: "18px", height: "18px" }} />
                  ) : (
                    <Copy style={{ width: "18px", height: "18px" }} />
                  )}
                </button>
              </div>
              <p style={{ 
                fontSize: "13px", 
                color: "#9ca3af", 
                marginTop: "14px",
                lineHeight: "1.5",
              }}>
                Add this URL to RevenueCat under Project Settings → Integrations → Webhooks. 
                Enable <strong style={{ color: "#b8b8c8" }}>VIRTUAL_CURRENCY_TRANSACTION</strong> for token management 
                and purchase events for revenue tracking.
              </p>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={handleDelete}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 20px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#f87171",
            background: "transparent",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <Trash2 style={{ width: "18px", height: "18px" }} />
          Delete App
        </button>

        <button
          type="submit"
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 28px",
            background: loading ? "rgba(0, 240, 255, 0.4)" : "linear-gradient(135deg, #00f0ff 0%, #00b8cc 100%)",
            color: "#09090b",
            borderRadius: "12px",
            fontSize: "15px",
            fontWeight: "600",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : "0 4px 12px rgba(0, 240, 255, 0.3)",
            transition: "all 0.15s ease",
          }}
        >
          {loading ? (
            <Loader2 style={{ width: "18px", height: "18px" }} className="animate-spin" />
          ) : (
            <Save style={{ width: "18px", height: "18px" }} />
          )}
          Save Changes
        </button>
      </div>
    </form>
  );
}
