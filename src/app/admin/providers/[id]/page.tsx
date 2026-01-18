"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft, Zap, DollarSign, Save, Loader2, CheckCircle, Package } from "lucide-react";

interface ModelConfig {
  id: string;
  providerModelId: string;
  priority: number;
  costPerRequest: number;
  inputTokenCostPer1M: number | null;
  outputTokenCostPer1M: number | null;
  model: {
    id: string;
    name: string;
    displayName: string;
  };
}

interface Provider {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string | null;
  apiKeyEnvVar: string;
  isEnabled: boolean;
  healthStatus: string;
}

export default function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedConfigs, setSavedConfigs] = useState<Set<string>>(new Set());
  const [providerId, setProviderId] = useState<string>("");

  useEffect(() => {
    params.then(p => {
      setProviderId(p.id);
      fetchProviderData(p.id);
    });
  }, [params]);

  const fetchProviderData = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/providers/${id}`);
      if (!res.ok) throw new Error("Failed to fetch provider");
      const data = await res.json();
      setProvider(data.provider);
      setModelConfigs(data.modelConfigs);
    } catch (error) {
      console.error("Error fetching provider:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateCost = (configId: string, field: 'costPerRequest' | 'inputTokenCostPer1M' | 'outputTokenCostPer1M', value: number | null) => {
    setModelConfigs(configs => 
      configs.map(c => c.id === configId ? { ...c, [field]: value } : c)
    );
    // Remove from saved set when editing
    setSavedConfigs(prev => {
      const next = new Set(prev);
      next.delete(configId);
      return next;
    });
  };

  const saveCost = async (configId: string) => {
    const config = modelConfigs.find(c => c.id === configId);
    if (!config) return;

    setSaving(configId);
    try {
      // Determine if this is token-based pricing (LLM) or per-request pricing
      const isTokenBased = config.inputTokenCostPer1M !== null || config.outputTokenCostPer1M !== null;
      
      const body = isTokenBased 
        ? { 
            inputTokenCostPer1M: config.inputTokenCostPer1M,
            outputTokenCostPer1M: config.outputTokenCostPer1M,
          }
        : { costPerRequest: config.costPerRequest };

      const res = await fetch(`/api/admin/providers/${providerId}/configs/${configId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSavedConfigs(prev => new Set(prev).add(configId));
    } catch (error) {
      console.error("Error saving cost:", error);
    } finally {
      setSaving(null);
    }
  };
  
  // Check if model uses token-based pricing
  const isTokenBasedPricing = (config: ModelConfig) => {
    return config.inputTokenCostPer1M !== null || config.outputTokenCostPer1M !== null;
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
        <Loader2 style={{ width: "32px", height: "32px", color: "#9ca3af" }} className="animate-spin" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div style={{ textAlign: "center", padding: "64px" }}>
        <p style={{ color: "#9ca3af" }}>Provider not found</p>
        <Link href="/admin/providers" style={{ color: "#fbbf24", marginTop: "16px", display: "inline-block" }}>
          Back to providers
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div>
        <Link 
          href="/admin/providers" 
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "6px", 
            color: "#9ca3af", 
            fontSize: "14px",
            textDecoration: "none",
            marginBottom: "16px",
          }}
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} />
          Back to providers
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.3) 100%)",
            border: "1px solid rgba(251, 191, 36, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Zap style={{ width: "26px", height: "26px", color: "#fbbf24" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
              {provider.displayName}
            </h1>
            <p style={{ color: "#9ca3af", marginTop: "4px", fontSize: "14px", fontFamily: "monospace" }}>
              {provider.name}
            </p>
          </div>
        </div>
      </div>

      {/* Model Configs */}
      <div className="glass" style={{ padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <DollarSign style={{ width: "20px", height: "20px", color: "#fbbf24" }} />
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fafafa" }}>
            Model Pricing
          </h2>
          <span style={{ 
            fontSize: "13px", 
            color: "#9ca3af", 
            background: "rgba(39, 39, 42, 0.5)", 
            padding: "4px 10px", 
            borderRadius: "9999px" 
          }}>
            {modelConfigs.length} models
          </span>
        </div>

        {modelConfigs.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            padding: "48px 24px",
            background: "rgba(39, 39, 42, 0.3)",
            borderRadius: "12px",
          }}>
            <Package style={{ width: "40px", height: "40px", color: "#71717a", margin: "0 auto 16px" }} />
            <p style={{ color: "#9ca3af", fontSize: "15px" }}>
              No models are configured to use this provider yet.
            </p>
            <Link 
              href="/admin/models" 
              style={{ 
                color: "#fbbf24", 
                marginTop: "12px", 
                display: "inline-block",
                fontSize: "14px",
              }}
            >
              Manage models →
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {modelConfigs.map((config) => (
              <div
                key={config.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  background: "rgba(39, 39, 42, 0.4)",
                  borderRadius: "12px",
                  border: "1px solid rgba(63, 63, 70, 0.5)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div>
                    <Link 
                      href={`/admin/models/${config.model.id}`}
                      style={{ 
                        fontWeight: "500", 
                        color: "#fafafa", 
                        fontSize: "15px",
                        textDecoration: "none",
                      }}
                    >
                      {config.model.displayName}
                    </Link>
                    <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "2px" }}>
                      <code style={{ color: "#b8b8c8" }}>{config.providerModelId}</code>
                      <span style={{ margin: "0 8px", color: "#71717a" }}>•</span>
                      Priority #{config.priority}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {isTokenBasedPricing(config) ? (
                    /* Token-based pricing (for LLMs) */
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "#9ca3af", fontSize: "12px", width: "50px" }}>Input:</span>
                        <span style={{ color: "#9ca3af", fontSize: "14px" }}>$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={config.inputTokenCostPer1M ?? 0}
                          onChange={(e) => updateCost(config.id, 'inputTokenCostPer1M', parseFloat(e.target.value) || 0)}
                          style={{
                            width: "80px",
                            padding: "6px 10px",
                            background: "rgba(24, 24, 27, 0.8)",
                            border: "1px solid rgba(63, 63, 70, 0.8)",
                            borderRadius: "6px",
                            color: "#fafafa",
                            fontSize: "13px",
                            fontFamily: "monospace",
                          }}
                        />
                        <span style={{ color: "#71717a", fontSize: "11px" }}>/1M tokens</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "#9ca3af", fontSize: "12px", width: "50px" }}>Output:</span>
                        <span style={{ color: "#9ca3af", fontSize: "14px" }}>$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={config.outputTokenCostPer1M ?? 0}
                          onChange={(e) => updateCost(config.id, 'outputTokenCostPer1M', parseFloat(e.target.value) || 0)}
                          style={{
                            width: "80px",
                            padding: "6px 10px",
                            background: "rgba(24, 24, 27, 0.8)",
                            border: "1px solid rgba(63, 63, 70, 0.8)",
                            borderRadius: "6px",
                            color: "#fafafa",
                            fontSize: "13px",
                            fontFamily: "monospace",
                          }}
                        />
                        <span style={{ color: "#71717a", fontSize: "11px" }}>/1M tokens</span>
                      </div>
                    </div>
                  ) : (
                    /* Per-request pricing (for image models) */
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ color: "#9ca3af", fontSize: "14px" }}>$</span>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={config.costPerRequest}
                        onChange={(e) => updateCost(config.id, 'costPerRequest', parseFloat(e.target.value) || 0)}
                        style={{
                          width: "100px",
                          padding: "8px 12px",
                          background: "rgba(24, 24, 27, 0.8)",
                          border: "1px solid rgba(63, 63, 70, 0.8)",
                          borderRadius: "8px",
                          color: "#fafafa",
                          fontSize: "14px",
                          fontFamily: "monospace",
                        }}
                      />
                      <span style={{ color: "#9ca3af", fontSize: "13px" }}>/req</span>
                    </div>
                  )}

                  <button
                    onClick={() => saveCost(config.id)}
                    disabled={saving === config.id}
                    style={{
                      padding: "8px 16px",
                      background: savedConfigs.has(config.id) 
                        ? "rgba(0, 240, 255, 0.15)" 
                        : "rgba(251, 191, 36, 0.15)",
                      border: savedConfigs.has(config.id)
                        ? "1px solid rgba(0, 240, 255, 0.3)"
                        : "1px solid rgba(251, 191, 36, 0.3)",
                      borderRadius: "8px",
                      color: savedConfigs.has(config.id) ? "#00f0ff" : "#fbbf24",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: saving === config.id ? "wait" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      alignSelf: isTokenBasedPricing(config) ? "flex-start" : "center",
                    }}
                  >
                    {saving === config.id ? (
                      <Loader2 style={{ width: "14px", height: "14px" }} className="animate-spin" />
                    ) : savedConfigs.has(config.id) ? (
                      <CheckCircle style={{ width: "14px", height: "14px" }} />
                    ) : (
                      <Save style={{ width: "14px", height: "14px" }} />
                    )}
                    {savedConfigs.has(config.id) ? "Saved" : "Save"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Provider Info */}
      <div className="glass" style={{ padding: "28px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fafafa", marginBottom: "20px" }}>
          Provider Settings
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <label style={{ fontSize: "13px", color: "#9ca3af", display: "block", marginBottom: "8px" }}>
              Base URL
            </label>
            <code style={{ 
              display: "block", 
              padding: "12px 16px", 
              background: "rgba(24, 24, 27, 0.8)", 
              borderRadius: "8px",
              color: "#b8b8c8",
              fontSize: "13px",
              border: "1px solid rgba(63, 63, 70, 0.5)",
            }}>
              {provider.baseUrl || "Not configured"}
            </code>
          </div>

          <div>
            <label style={{ fontSize: "13px", color: "#9ca3af", display: "block", marginBottom: "8px" }}>
              API Key Environment Variable
            </label>
            <code style={{ 
              display: "block", 
              padding: "12px 16px", 
              background: "rgba(24, 24, 27, 0.8)", 
              borderRadius: "8px",
              color: "#00f0ff",
              fontSize: "13px",
              border: "1px solid rgba(63, 63, 70, 0.5)",
            }}>
              {provider.apiKeyEnvVar}
            </code>
          </div>
        </div>

        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "12px", 
          marginTop: "20px",
          paddingTop: "20px",
          borderTop: "1px solid rgba(63, 63, 70, 0.3)",
        }}>
          <span className={provider.isEnabled ? "badge-success" : "badge-error"}>
            {provider.isEnabled ? "Enabled" : "Disabled"}
          </span>
          <span style={{ 
            padding: "6px 14px",
            borderRadius: "9999px",
            fontSize: "13px",
            fontWeight: "500",
            background: provider.healthStatus === "HEALTHY" 
              ? "rgba(0, 240, 255, 0.15)" 
              : provider.healthStatus === "DEGRADED"
                ? "rgba(245, 158, 11, 0.15)"
                : "rgba(113, 113, 122, 0.2)",
            color: provider.healthStatus === "HEALTHY" 
              ? "#00f0ff" 
              : provider.healthStatus === "DEGRADED"
                ? "#fbbf24"
                : "#b8b8c8",
            border: `1px solid ${provider.healthStatus === "HEALTHY" 
              ? "rgba(0, 240, 255, 0.3)" 
              : provider.healthStatus === "DEGRADED"
                ? "rgba(245, 158, 11, 0.3)"
                : "rgba(113, 113, 122, 0.3)"}`,
          }}>
            {provider.healthStatus}
          </span>
        </div>
      </div>
    </div>
  );
}




