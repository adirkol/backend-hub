"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

export default function NewAppPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    defaultTokenGrant: 10,
    webhookUrl: "",
    rateLimitPerUser: 30,
    rateLimitPerApp: 1000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create app");
      }

      const data = await res.json();
      router.push(`/admin/apps/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const inputStyle = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "12px",
    background: "rgba(39, 39, 42, 0.5)",
    border: "1px solid rgba(63, 63, 70, 0.6)",
    color: "#fafafa",
    fontSize: "15px",
    outline: "none",
    transition: "all 0.15s ease",
  };

  const labelStyle = {
    display: "block",
    fontSize: "14px",
    fontWeight: "500" as const,
    color: "#e4e4e7",
    marginBottom: "10px",
  };

  const hintStyle = {
    fontSize: "13px",
    color: "#71717a",
    marginTop: "8px",
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: "640px" }}>
      {/* Header */}
      <div style={{ marginBottom: "36px" }}>
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
            transition: "color 0.15s ease",
          }}
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} />
          Back to Apps
        </Link>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
          Create New App
        </h1>
        <p style={{ color: "#71717a", marginTop: "8px", fontSize: "15px" }}>
          Add a new tenant application
        </p>
      </div>

      {/* Form */}
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

        <div className="glass" style={{ padding: "28px" }}>
          <h2 style={{ 
            fontWeight: "600", 
            color: "#e4e4e7", 
            paddingBottom: "20px", 
            borderBottom: "1px solid rgba(63, 63, 70, 0.4)",
            marginBottom: "24px",
            fontSize: "16px",
          }}>
            Basic Information
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <label style={labelStyle}>App Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => {
                  setForm({
                    ...form,
                    name: e.target.value,
                    slug: form.slug || generateSlug(e.target.value),
                  });
                }}
                style={inputStyle}
                placeholder="PhotoMania"
              />
            </div>

            <div>
              <label style={labelStyle}>Slug *</label>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: generateSlug(e.target.value) })}
                style={inputStyle}
                placeholder="photomania"
              />
              <p style={hintStyle}>Unique identifier for this app</p>
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: "none", minHeight: "100px" }}
                placeholder="AI photo editing app for iOS"
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
            Configuration
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <label style={labelStyle}>Default Token Grant</label>
              <input
                type="number"
                min="0"
                value={form.defaultTokenGrant}
                onChange={(e) => setForm({ ...form, defaultTokenGrant: parseInt(e.target.value) || 0 })}
                style={inputStyle}
              />
              <p style={hintStyle}>Tokens granted to new users</p>
            </div>

            <div>
              <label style={labelStyle}>Webhook URL</label>
              <input
                type="url"
                value={form.webhookUrl}
                onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                style={inputStyle}
                placeholder="https://yourapp.com/webhook"
              />
              <p style={hintStyle}>Receive job completion notifications</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={labelStyle}>Rate Limit / User</label>
                <input
                  type="number"
                  min="1"
                  value={form.rateLimitPerUser}
                  onChange={(e) => setForm({ ...form, rateLimitPerUser: parseInt(e.target.value) || 30 })}
                  style={inputStyle}
                />
                <p style={hintStyle}>Requests per minute</p>
              </div>

              <div>
                <label style={labelStyle}>Rate Limit / App</label>
                <input
                  type="number"
                  min="1"
                  value={form.rateLimitPerApp}
                  onChange={(e) => setForm({ ...form, rateLimitPerApp: parseInt(e.target.value) || 1000 })}
                  style={inputStyle}
                />
                <p style={hintStyle}>Requests per minute</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "16px" }}>
          <Link
            href="/admin/apps"
            style={{
              padding: "14px 24px",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: "500",
              color: "#a1a1aa",
              textDecoration: "none",
              transition: "all 0.15s ease",
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "14px 28px",
              background: loading ? "rgba(16, 185, 129, 0.4)" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#09090b",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: "600",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 4px 12px rgba(16, 185, 129, 0.3)",
              transition: "all 0.15s ease",
            }}
          >
            {loading ? (
              <Loader2 style={{ width: "18px", height: "18px" }} className="animate-spin" />
            ) : (
              <Save style={{ width: "18px", height: "18px" }} />
            )}
            Create App
          </button>
        </div>
      </form>
    </div>
  );
}
