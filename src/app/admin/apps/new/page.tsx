"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Save, Loader2, Sparkles, ExternalLink } from "lucide-react";

interface AppStoreInfo {
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  bundleId: string;
  appStoreUrl: string;
  developer: string;
  category: string;
  rating?: number;
  ratingCount?: number;
}

export default function NewAppPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appStoreUrl, setAppStoreUrl] = useState("");
  const [appStoreInfo, setAppStoreInfo] = useState<AppStoreInfo | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    defaultTokenGrant: 10,
    dailyTokenGrant: 0,
    webhookUrl: "",
    rateLimitPerUser: 30,
    rateLimitPerApp: 1000,
    iconUrl: "",
    appStoreUrl: "",
    bundleId: "",
  });

  const handleAppStoreLookup = async () => {
    if (!appStoreUrl.trim()) return;
    
    setLookupLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/admin/apps/appstore-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: appStoreUrl }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to lookup app");
      }
      
      const info: AppStoreInfo = data.app;
      setAppStoreInfo(info);
      
      // Auto-fill the form
      setForm({
        ...form,
        name: info.name,
        slug: info.slug,
        description: info.description,
        iconUrl: info.iconUrl,
        appStoreUrl: info.appStoreUrl,
        bundleId: info.bundleId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lookup app");
    } finally {
      setLookupLoading(false);
    }
  };

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
    color: "#9ca3af",
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
            color: "#9ca3af",
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
        <p style={{ color: "#9ca3af", marginTop: "8px", fontSize: "15px" }}>
          Add a new tenant application
        </p>
      </div>

      {/* Quick Add from App Store */}
      <div className="glass" style={{ 
        padding: "24px", 
        marginBottom: "12px",
        background: "linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)",
        border: "1px solid rgba(168, 85, 247, 0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <Sparkles style={{ width: "20px", height: "20px", color: "#a855f7" }} />
          <h2 style={{ fontWeight: "600", color: "#e4e4e7", fontSize: "16px" }}>
            Quick Add from App Store
          </h2>
        </div>
        <p style={{ fontSize: "13px", color: "#b8b8c8", marginBottom: "16px" }}>
          Paste an App Store URL to automatically fill in app details
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          <input
            type="url"
            value={appStoreUrl}
            onChange={(e) => setAppStoreUrl(e.target.value)}
            placeholder="https://apps.apple.com/us/app/your-app/id123456789"
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "10px",
              background: "rgba(39, 39, 42, 0.6)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              color: "#fafafa",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={handleAppStoreLookup}
            disabled={lookupLoading || !appStoreUrl.trim()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 20px",
              background: lookupLoading ? "rgba(168, 85, 247, 0.4)" : "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
              color: "#fff",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "500",
              border: "none",
              cursor: lookupLoading || !appStoreUrl.trim() ? "not-allowed" : "pointer",
              opacity: !appStoreUrl.trim() ? 0.5 : 1,
              transition: "all 0.15s ease",
            }}
          >
            {lookupLoading ? (
              <Loader2 style={{ width: "16px", height: "16px" }} className="animate-spin" />
            ) : (
              <ExternalLink style={{ width: "16px", height: "16px" }} />
            )}
            Fetch Info
          </button>
        </div>
        
        {/* App Store Preview */}
        {appStoreInfo && (
          <div style={{ 
            marginTop: "20px", 
            padding: "16px", 
            background: "rgba(39, 39, 42, 0.4)", 
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}>
            {appStoreInfo.iconUrl && (
              <Image
                src={appStoreInfo.iconUrl}
                alt={appStoreInfo.name}
                width={64}
                height={64}
                style={{ borderRadius: "14px" }}
              />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "600", color: "#fafafa", fontSize: "15px" }}>
                {appStoreInfo.name}
              </div>
              <div style={{ fontSize: "13px", color: "#b8b8c8", marginTop: "4px" }}>
                {appStoreInfo.developer} • {appStoreInfo.category}
              </div>
              {appStoreInfo.rating && (
                <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                  ⭐ {appStoreInfo.rating.toFixed(1)} ({appStoreInfo.ratingCount?.toLocaleString()} ratings)
                </div>
              )}
            </div>
            <div style={{ 
              padding: "6px 12px", 
              background: "rgba(0, 240, 255, 0.15)", 
              borderRadius: "20px",
              fontSize: "12px",
              color: "#00f0ff",
              fontWeight: "500",
            }}>
              ✓ Auto-filled
            </div>
          </div>
        )}
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
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid rgba(63, 63, 70, 0.4)" }}>
            {form.iconUrl && (
              <Image
                src={form.iconUrl}
                alt={form.name || "App icon"}
                width={48}
                height={48}
                style={{ borderRadius: "10px" }}
              />
            )}
            <h2 style={{ fontWeight: "600", color: "#e4e4e7", fontSize: "16px" }}>
              Basic Information
            </h2>
          </div>

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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={labelStyle}>Welcome Tokens</label>
                <input
                  type="number"
                  min="0"
                  value={form.defaultTokenGrant}
                  onChange={(e) => setForm({ ...form, defaultTokenGrant: parseInt(e.target.value) || 0 })}
                  style={inputStyle}
                />
                <p style={hintStyle}>One-time grant for new users</p>
              </div>

              <div>
                <label style={labelStyle}>Daily Token Grant</label>
                <input
                  type="number"
                  min="0"
                  value={form.dailyTokenGrant}
                  onChange={(e) => setForm({ ...form, dailyTokenGrant: parseInt(e.target.value) || 0 })}
                  style={inputStyle}
                />
                <p style={hintStyle}>Rolling 24h grant (0 = disabled)</p>
              </div>
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
              color: "#b8b8c8",
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
            Create App
          </button>
        </div>
      </form>
    </div>
  );
}
