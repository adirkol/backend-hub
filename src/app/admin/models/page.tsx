import { prisma } from "@/lib/db";
import { Layers, Plus, Zap, Image, MessageSquare, Hash, Settings } from "lucide-react";
import Link from "next/link";

async function getModels() {
  const models = await prisma.aIModel.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      providerConfigs: {
        include: {
          provider: { select: { name: true, displayName: true } },
        },
        orderBy: { priority: "asc" },
      },
      _count: {
        select: { jobs: true },
      },
    },
  });

  return models;
}

export default async function ModelsPage() {
  const models = await getModels();

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
            AI Models
          </h1>
          <p style={{ color: "#9ca3af", marginTop: "6px", fontSize: "15px" }}>
            Manage AI models and provider configurations
          </p>
        </div>
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 20px",
            background: "linear-gradient(135deg, #00f0ff 0%, #00b8cc 100%)",
            color: "#000",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "600",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0, 240, 255, 0.3)",
          }}
        >
          <Plus style={{ width: "18px", height: "18px" }} />
          Add Model
        </button>
      </div>

      {/* Models Grid */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", 
        gap: "20px" 
      }}>
        {models.map((model) => (
          <Link 
            href={`/admin/models/${model.id}`} 
            key={model.id} 
            className="glass" 
            style={{ 
              padding: "28px", 
              textDecoration: "none", 
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.3) 100%)",
                  border: "1px solid rgba(139, 92, 246, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Layers style={{ width: "22px", height: "22px", color: "#a78bfa" }} />
                </div>
                <div>
                  <h3 style={{ fontWeight: "600", color: "#fafafa", fontSize: "16px", marginBottom: "4px" }}>
                    {model.displayName}
                  </h3>
                  <p style={{ fontSize: "13px", color: "#9ca3af", fontFamily: "monospace" }}>{model.name}</p>
                </div>
              </div>
              <span className={model.isEnabled ? "badge-success" : "badge-error"}>
                {model.isEnabled ? "Active" : "Disabled"}
              </span>
            </div>

            {model.description && (
              <p style={{ 
                fontSize: "14px", 
                color: "#b8b8c8", 
                marginBottom: "20px",
                lineHeight: "1.5",
              }}>
                {model.description}
              </p>
            )}

            {/* Stats Row */}
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "24px", 
              marginBottom: "20px" 
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap style={{ width: "16px", height: "16px", color: "#facc15" }} />
                <span style={{ color: "#e4e4e7", fontSize: "14px", fontWeight: "500" }}>
                  {model.tokenCost} tokens
                </span>
              </div>
              <div style={{ color: "#9ca3af", fontSize: "14px" }}>
                {model._count.jobs.toLocaleString()} jobs
              </div>
              {model.modelFamily && (
                <span className="badge-info">{model.modelFamily}</span>
              )}
            </div>

            {/* Provider Configurations */}
            <div style={{ 
              borderTop: "1px solid rgba(63, 63, 70, 0.4)", 
              paddingTop: "20px" 
            }}>
              <p style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Providers (by priority)
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {model.providerConfigs.map((config) => (
                  <div
                    key={config.id}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "500",
                      background: config.isEnabled ? "rgba(39, 39, 42, 0.6)" : "rgba(39, 39, 42, 0.3)",
                      color: config.isEnabled ? "#e4e4e7" : "#9ca3af",
                      border: `1px solid ${config.isEnabled ? "rgba(63, 63, 70, 0.5)" : "rgba(63, 63, 70, 0.3)"}`,
                    }}
                  >
                    <span style={{ color: "#00f0ff", marginRight: "6px" }}>#{config.priority}</span>
                    {config.provider.displayName}
                  </div>
                ))}
                {model.providerConfigs.length === 0 && (
                  <span style={{ fontSize: "13px", color: "#9ca3af" }}>No providers configured</span>
                )}
              </div>
            </div>

            {/* Capabilities */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {model.supportsImages && (
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: "rgba(39, 39, 42, 0.5)",
                    color: "#b8b8c8",
                    fontSize: "13px",
                  }}>
                    <Image style={{ width: "14px", height: "14px" }} />
                    Images
                  </span>
                )}
                {model.supportsPrompt && (
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: "rgba(39, 39, 42, 0.5)",
                    color: "#b8b8c8",
                    fontSize: "13px",
                  }}>
                    <MessageSquare style={{ width: "14px", height: "14px" }} />
                    Prompt
                  </span>
                )}
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: "rgba(39, 39, 42, 0.5)",
                  color: "#b8b8c8",
                  fontSize: "13px",
                }}>
                  <Hash style={{ width: "14px", height: "14px" }} />
                  Max {model.maxInputImages} input{model.maxInputImages > 1 ? "s" : ""}
                </span>
              </div>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "#9ca3af",
                fontSize: "13px",
              }}>
                <Settings style={{ width: "14px", height: "14px" }} />
                <span>Configure</span>
              </div>
            </div>
          </Link>
        ))}

        {models.length === 0 && (
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
              <Layers style={{ width: "32px", height: "32px", color: "#9ca3af" }} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#e4e4e7", marginBottom: "10px" }}>
              No models configured
            </h3>
            <p style={{ color: "#9ca3af", maxWidth: "320px", margin: "0 auto" }}>
              Add AI models to enable generation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
