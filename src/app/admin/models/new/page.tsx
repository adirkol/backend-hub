"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Layers, Save, Loader2, Check, AlertCircle, Zap } from "lucide-react";

export default function NewModelPage() {
  const router = useRouter();
  
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [modelFamily, setModelFamily] = useState("");
  const [tokenCost, setTokenCost] = useState(5);
  const [maxInputImages, setMaxInputImages] = useState(4);
  const [supportsImages, setSupportsImages] = useState(true);
  const [supportsPrompt, setSupportsPrompt] = useState(true);
  const [aspectRatios, setAspectRatios] = useState("1:1, 16:9, 9:16, 4:3, 3:4");
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setMessage({ type: "error", text: "Model name is required" });
      return;
    }
    if (!displayName.trim()) {
      setMessage({ type: "error", text: "Display name is required" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim().toLowerCase().replace(/\s+/g, "-"),
          displayName: displayName.trim(),
          description: description.trim() || null,
          modelFamily: modelFamily.trim() || null,
          tokenCost,
          maxInputImages,
          supportsImages,
          supportsPrompt,
          supportedAspectRatios: aspectRatios.split(",").map(r => r.trim()).filter(Boolean),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create model");
      }

      const model = await response.json();
      setMessage({ type: "success", text: "Model created successfully!" });
      
      // Redirect to the model edit page after a short delay
      setTimeout(() => {
        router.push(`/admin/models/${model.id}`);
      }, 1000);
    } catch (error) {
      setMessage({ 
        type: "error", 
        text: error instanceof Error ? error.message : "Failed to create model" 
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div>
        <Link
          href="/admin/models"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#9ca3af",
            fontSize: "14px",
            textDecoration: "none",
            marginBottom: "16px",
          }}
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} />
          Back to Models
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.3) 100%)",
            border: "1px solid rgba(139, 92, 246, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Layers style={{ width: "28px", height: "28px", color: "#a78bfa" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
              Add New Model
            </h1>
            <p style={{ color: "#9ca3af", fontSize: "14px" }}>
              Create a new AI model configuration
            </p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: "16px 20px",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: message.type === "success" 
            ? "rgba(0, 240, 255, 0.15)" 
            : "rgba(239, 68, 68, 0.15)",
          border: `1px solid ${message.type === "success" 
            ? "rgba(0, 240, 255, 0.3)" 
            : "rgba(239, 68, 68, 0.3)"}`,
        }}>
          {message.type === "success" ? (
            <Check style={{ width: "20px", height: "20px", color: "#34d399" }} />
          ) : (
            <AlertCircle style={{ width: "20px", height: "20px", color: "#ef4444" }} />
          )}
          <span style={{ 
            color: message.type === "success" ? "#34d399" : "#ef4444",
            fontSize: "14px",
            fontWeight: "500",
          }}>
            {message.text}
          </span>
        </div>
      )}

      {/* Form */}
      <div className="glass" style={{ padding: "28px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fafafa", marginBottom: "24px" }}>
          Model Information
        </h2>

        <div style={{ display: "grid", gap: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#b8b8c8", marginBottom: "8px" }}>
                Model Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="p-image-edit"
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "rgba(9, 9, 11, 0.6)",
                  border: "1px solid rgba(63, 63, 70, 0.5)",
                  borderRadius: "10px",
                  color: "#fafafa",
                  fontSize: "15px",
                  fontFamily: "monospace",
                }}
              />
              <p style={{ fontSize: "12px", color: "#71717a", marginTop: "6px" }}>
                Unique identifier (lowercase, no spaces)
              </p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#b8b8c8", marginBottom: "8px" }}>
                Display Name *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="P-Image Edit"
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "rgba(9, 9, 11, 0.6)",
                  border: "1px solid rgba(63, 63, 70, 0.5)",
                  borderRadius: "10px",
                  color: "#fafafa",
                  fontSize: "15px",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#b8b8c8", marginBottom: "8px" }}>
                Model Family
              </label>
              <input
                type="text"
                value={modelFamily}
                onChange={(e) => setModelFamily(e.target.value)}
                placeholder="pruna, openai, google, flux..."
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "rgba(9, 9, 11, 0.6)",
                  border: "1px solid rgba(63, 63, 70, 0.5)",
                  borderRadius: "10px",
                  color: "#fafafa",
                  fontSize: "15px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#b8b8c8", marginBottom: "8px" }}>
                Default Token Cost
              </label>
              <div style={{ position: "relative" }}>
                <Zap style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "18px",
                  height: "18px",
                  color: "#facc15",
                }} />
                <input
                  type="number"
                  value={tokenCost}
                  onChange={(e) => setTokenCost(parseInt(e.target.value) || 0)}
                  min={0}
                  style={{
                    width: "100%",
                    padding: "14px 16px 14px 44px",
                    background: "rgba(9, 9, 11, 0.6)",
                    border: "1px solid rgba(63, 63, 70, 0.5)",
                    borderRadius: "10px",
                    color: "#fafafa",
                    fontSize: "15px",
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#b8b8c8", marginBottom: "8px" }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of the model's capabilities..."
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "rgba(9, 9, 11, 0.6)",
                border: "1px solid rgba(63, 63, 70, 0.5)",
                borderRadius: "10px",
                color: "#fafafa",
                fontSize: "15px",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#b8b8c8", marginBottom: "8px" }}>
                Max Input Images
              </label>
              <input
                type="number"
                value={maxInputImages}
                onChange={(e) => setMaxInputImages(parseInt(e.target.value) || 0)}
                min={0}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "rgba(9, 9, 11, 0.6)",
                  border: "1px solid rgba(63, 63, 70, 0.5)",
                  borderRadius: "10px",
                  color: "#fafafa",
                  fontSize: "15px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#b8b8c8", marginBottom: "8px" }}>
                Supported Aspect Ratios
              </label>
              <input
                type="text"
                value={aspectRatios}
                onChange={(e) => setAspectRatios(e.target.value)}
                placeholder="1:1, 16:9, 9:16, 4:3, 3:4"
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "rgba(9, 9, 11, 0.6)",
                  border: "1px solid rgba(63, 63, 70, 0.5)",
                  borderRadius: "10px",
                  color: "#fafafa",
                  fontSize: "15px",
                }}
              />
              <p style={{ fontSize: "12px", color: "#71717a", marginTop: "6px" }}>
                Comma-separated list of aspect ratios
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "32px", marginTop: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                onClick={() => setSupportsImages(!supportsImages)}
                style={{
                  width: "52px",
                  height: "28px",
                  borderRadius: "14px",
                  border: "none",
                  cursor: "pointer",
                  background: supportsImages 
                    ? "linear-gradient(135deg, #00f0ff 0%, #00b8cc 100%)"
                    : "rgba(63, 63, 70, 0.5)",
                  position: "relative",
                  transition: "background 0.2s ease",
                }}
              >
                <div style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: "3px",
                  left: supportsImages ? "27px" : "3px",
                  transition: "left 0.2s ease",
                }} />
              </button>
              <span style={{ fontSize: "14px", color: "#b8b8c8" }}>
                Supports Image Input
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                onClick={() => setSupportsPrompt(!supportsPrompt)}
                style={{
                  width: "52px",
                  height: "28px",
                  borderRadius: "14px",
                  border: "none",
                  cursor: "pointer",
                  background: supportsPrompt 
                    ? "linear-gradient(135deg, #00f0ff 0%, #00b8cc 100%)"
                    : "rgba(63, 63, 70, 0.5)",
                  position: "relative",
                  transition: "background 0.2s ease",
                }}
              >
                <div style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: "3px",
                  left: supportsPrompt ? "27px" : "3px",
                  transition: "left 0.2s ease",
                }} />
              </button>
              <span style={{ fontSize: "14px", color: "#b8b8c8" }}>
                Supports Prompt
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div style={{
        padding: "20px",
        borderRadius: "12px",
        background: "rgba(59, 130, 246, 0.1)",
        border: "1px solid rgba(59, 130, 246, 0.3)",
      }}>
        <p style={{ color: "#93c5fd", fontSize: "14px", lineHeight: "1.6" }}>
          <strong>Next Step:</strong> After creating the model, you&apos;ll be redirected to configure provider connections (Replicate, DefAPI, etc.) and set the provider model IDs.
        </p>
      </div>

      {/* Save Button */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px" }}>
        <Link
          href="/admin/models"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 28px",
            background: "rgba(39, 39, 42, 0.6)",
            color: "#b8b8c8",
            borderRadius: "12px",
            fontSize: "15px",
            fontWeight: "500",
            border: "1px solid rgba(63, 63, 70, 0.5)",
            textDecoration: "none",
          }}
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 28px",
            background: "linear-gradient(135deg, #00f0ff 0%, #00b8cc 100%)",
            color: "#09090b",
            borderRadius: "12px",
            fontSize: "15px",
            fontWeight: "600",
            border: "none",
            cursor: saving ? "wait" : "pointer",
            boxShadow: "0 4px 12px rgba(0, 240, 255, 0.3)",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <Loader2 style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} />
          ) : (
            <Save style={{ width: "18px", height: "18px" }} />
          )}
          {saving ? "Creating..." : "Create Model"}
        </button>
      </div>
    </div>
  );
}
