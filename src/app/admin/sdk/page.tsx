"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package,
  Upload,
  Check,
  AlertCircle,
  RefreshCw,
  GitBranch,
  Tag,
  Clock,
  User,
  ExternalLink,
  FileCode,
  History,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";

interface SDKPublish {
  id: string;
  version: string;
  releaseNotes: string | null;
  publishedBy: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCESS" | "FAILED";
  commitSha: string | null;
  tagName: string | null;
  workflowRunId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface SDKStatus {
  latestVersion: string | null;
  latestPublish: SDKPublish | null;
  publishHistory: SDKPublish[];
  sdkFiles: string[];
  hasChanges: boolean;
  changedFiles: string[];
  suggestedVersion: string;
}

export default function SDKPage() {
  const [status, setStatus] = useState<SDKStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  
  // Form state
  const [version, setVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sdk/status");
      if (!response.ok) throw new Error("Failed to fetch SDK status");
      const data = await response.json();
      setStatus(data);
      if (!version && data.suggestedVersion) {
        setVersion(data.suggestedVersion);
      }
    } catch (error) {
      console.error("Error fetching SDK status:", error);
    } finally {
      setIsLoading(false);
    }
  }, [version]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handlePublish = async () => {
    if (!version.match(/^\d+\.\d+\.\d+$/)) {
      setPublishError("Invalid version format. Use semantic versioning (e.g., 1.0.0)");
      return;
    }

    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccess(false);

    try {
      const response = await fetch("/api/admin/sdk/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, releaseNotes: releaseNotes || null }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Publish failed");
      }

      setPublishSuccess(true);
      setReleaseNotes("");
      
      // Refresh status after a short delay
      setTimeout(() => {
        fetchStatus();
        setPublishSuccess(false);
      }, 2000);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Publish failed");
    } finally {
      setIsPublishing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: SDKPublish["status"]) => {
    switch (status) {
      case "SUCCESS":
        return { bg: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "rgba(16, 185, 129, 0.3)" };
      case "FAILED":
        return { bg: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "rgba(239, 68, 68, 0.3)" };
      case "IN_PROGRESS":
        return { bg: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" };
      default:
        return { bg: "rgba(156, 163, 175, 0.15)", color: "#9ca3af", border: "rgba(156, 163, 175, 0.3)" };
    }
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <RefreshCw style={{ width: "32px", height: "32px", color: "#00f0ff" }} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%)",
              border: "1px solid rgba(168, 85, 247, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Package style={{ width: "24px", height: "24px", color: "#a78bfa" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", margin: 0 }}>iOS SDK</h1>
            <p style={{ fontSize: "15px", color: "#9ca3af", margin: "4px 0 0 0" }}>
              Publish and manage the AIHub iOS SDK
            </p>
          </div>
        </div>

        <a
          href="https://github.com/adirkol/aihub-ios-sdk"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            borderRadius: "10px",
            background: "rgba(30, 30, 40, 0.5)",
            border: "1px solid rgba(80, 80, 100, 0.3)",
            color: "#b8b8c8",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          <GitBranch style={{ width: "16px", height: "16px" }} />
          View Repository
          <ExternalLink style={{ width: "14px", height: "14px" }} />
        </a>
      </div>

      {/* Current Version Card */}
      <div className="glass" style={{ padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <Tag style={{ width: "20px", height: "20px", color: "#00f0ff" }} />
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fafafa", margin: 0 }}>Current Published Version</h2>
        </div>

        {status?.latestPublish ? (
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <div
              style={{
                padding: "16px 24px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, rgba(0, 240, 255, 0.1) 0%, rgba(0, 240, 255, 0.02) 100%)",
                border: "1px solid rgba(0, 240, 255, 0.25)",
              }}
            >
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#00f0ff", fontFamily: "monospace" }}>
                v{status.latestVersion}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "14px", color: "#9ca3af", marginBottom: "4px" }}>
                Published {formatDate(status.latestPublish.createdAt)}
              </div>
              <div style={{ fontSize: "13px", color: "#71717a" }}>
                by {status.latestPublish.publishedBy}
              </div>
              {status.latestPublish.commitSha && (
                <div style={{ fontSize: "12px", color: "#71717a", marginTop: "4px", fontFamily: "monospace" }}>
                  {status.latestPublish.commitSha.substring(0, 7)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>
            No published versions yet
          </div>
        )}
      </div>

      {/* Main Content - Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Publish Section */}
        <div className="glass" style={{ padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <Upload style={{ width: "22px", height: "22px", color: "#a78bfa" }} />
            <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#fafafa", margin: 0 }}>Publish New Version</h2>
          </div>

          {/* Changes Detection */}
          {status?.hasChanges && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "14px 16px",
                borderRadius: "10px",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                marginBottom: "20px",
              }}
            >
              <FileCode style={{ width: "18px", height: "18px", color: "#34d399", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontSize: "14px", fontWeight: "500", color: "#34d399" }}>
                  {status.changedFiles.length} file(s) changed
                </div>
                <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                  {status.changedFiles.slice(0, 3).join(", ")}
                  {status.changedFiles.length > 3 && ` +${status.changedFiles.length - 3} more`}
                </div>
              </div>
            </div>
          )}

          {!status?.hasChanges && status?.latestVersion && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 16px",
                borderRadius: "10px",
                background: "rgba(156, 163, 175, 0.08)",
                border: "1px solid rgba(156, 163, 175, 0.2)",
                marginBottom: "20px",
              }}
            >
              <Check style={{ width: "18px", height: "18px", color: "#9ca3af" }} />
              <div style={{ fontSize: "14px", color: "#9ca3af" }}>
                No changes detected since v{status.latestVersion}
              </div>
            </div>
          )}

          {/* Version input */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#b8b8c8", display: "block", marginBottom: "8px" }}>
              Version
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "10px",
                background: "rgba(30, 30, 40, 0.6)",
                border: "1px solid rgba(80, 80, 100, 0.4)",
                color: "#fafafa",
                fontSize: "16px",
                fontFamily: "monospace",
                outline: "none",
              }}
            />
            <div style={{ fontSize: "12px", color: "#71717a", marginTop: "6px" }}>
              Use semantic versioning (major.minor.patch)
            </div>
          </div>

          {/* Release notes */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#b8b8c8", display: "block", marginBottom: "8px" }}>
              Release Notes (optional)
            </label>
            <textarea
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="What's new in this version..."
              rows={4}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "10px",
                background: "rgba(30, 30, 40, 0.6)",
                border: "1px solid rgba(80, 80, 100, 0.4)",
                color: "#fafafa",
                fontSize: "14px",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {/* Error message */}
          {publishError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 16px",
                borderRadius: "10px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                marginBottom: "20px",
              }}
            >
              <AlertCircle style={{ width: "18px", height: "18px", color: "#f87171" }} />
              <span style={{ fontSize: "14px", color: "#f87171" }}>{publishError}</span>
            </div>
          )}

          {/* Publish button */}
          <button
            onClick={handlePublish}
            disabled={isPublishing || !version}
            className="btn-primary"
            style={{
              width: "100%",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              opacity: !version ? 0.5 : 1,
            }}
          >
            {isPublishing ? (
              <>
                <RefreshCw style={{ width: "18px", height: "18px" }} className="animate-spin" />
                Publishing...
              </>
            ) : publishSuccess ? (
              <>
                <Check style={{ width: "18px", height: "18px" }} />
                Published!
              </>
            ) : (
              <>
                <Upload style={{ width: "18px", height: "18px" }} />
                Publish v{version || "x.x.x"}
              </>
            )}
          </button>
        </div>

        {/* SDK Files */}
        <div className="glass" style={{ padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <FileCode style={{ width: "20px", height: "20px", color: "#00f0ff" }} />
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fafafa", margin: 0 }}>SDK Source Files</h2>
          </div>

          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {status?.sdkFiles.map((file) => (
              <div
                key={file}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  marginBottom: "4px",
                  background: status.changedFiles.includes(file)
                    ? "rgba(16, 185, 129, 0.08)"
                    : "transparent",
                  border: status.changedFiles.includes(file)
                    ? "1px solid rgba(16, 185, 129, 0.2)"
                    : "1px solid transparent",
                }}
              >
                <FileCode
                  style={{
                    width: "16px",
                    height: "16px",
                    color: status.changedFiles.includes(file) ? "#34d399" : "#71717a",
                  }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    fontFamily: "monospace",
                    color: status.changedFiles.includes(file) ? "#34d399" : "#b8b8c8",
                  }}
                >
                  {file}
                </span>
                {status.changedFiles.includes(file) && (
                  <span style={{ fontSize: "11px", color: "#34d399", marginLeft: "auto" }}>modified</span>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: "16px", padding: "12px", background: "rgba(30, 30, 40, 0.5)", borderRadius: "8px" }}>
            <div style={{ fontSize: "12px", color: "#9ca3af" }}>
              Source: <code style={{ color: "#00f0ff" }}>packages/ios-sdk/</code>
            </div>
            <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
              Target: <code style={{ color: "#a78bfa" }}>github.com/adirkol/aihub-ios-sdk</code>
            </div>
          </div>
        </div>
      </div>

      {/* Publish History */}
      <div className="glass" style={{ padding: "28px" }}>
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "none",
            border: "none",
            cursor: "pointer",
            width: "100%",
            padding: 0,
          }}
        >
          {showHistory ? (
            <ChevronDown style={{ width: "20px", height: "20px", color: "#9ca3af" }} />
          ) : (
            <ChevronRight style={{ width: "20px", height: "20px", color: "#9ca3af" }} />
          )}
          <History style={{ width: "20px", height: "20px", color: "#00f0ff" }} />
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fafafa", margin: 0, textAlign: "left" }}>
            Publish History
          </h2>
          <span style={{ fontSize: "14px", color: "#71717a", marginLeft: "auto" }}>
            {status?.publishHistory.length || 0} publishes
          </span>
        </button>

        {showHistory && (
          <div style={{ marginTop: "20px" }}>
            {status?.publishHistory.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>
                No publish history yet
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {status?.publishHistory.map((publish) => {
                  const statusColors = getStatusColor(publish.status);
                  return (
                    <div
                      key={publish.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 18px",
                        borderRadius: "10px",
                        background: "rgba(30, 30, 40, 0.5)",
                        border: "1px solid rgba(80, 80, 100, 0.3)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            background: "rgba(0, 240, 255, 0.1)",
                            border: "1px solid rgba(0, 240, 255, 0.25)",
                          }}
                        >
                          <span style={{ fontSize: "14px", fontWeight: "600", color: "#00f0ff", fontFamily: "monospace" }}>
                            v{publish.version}
                          </span>
                        </div>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            background: statusColors.bg,
                            color: statusColors.color,
                            border: `1px solid ${statusColors.border}`,
                          }}
                        >
                          {publish.status}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <User style={{ width: "14px", height: "14px", color: "#71717a" }} />
                          <span style={{ fontSize: "13px", color: "#9ca3af" }}>{publish.publishedBy}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Clock style={{ width: "14px", height: "14px", color: "#71717a" }} />
                          <span style={{ fontSize: "13px", color: "#9ca3af" }}>{formatDate(publish.createdAt)}</span>
                        </div>
                        {publish.commitSha && (
                          <span style={{ fontSize: "12px", color: "#71717a", fontFamily: "monospace" }}>
                            {publish.commitSha.substring(0, 7)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info section */}
      <div
        className="glass"
        style={{
          padding: "20px 24px",
          display: "flex",
          alignItems: "flex-start",
          gap: "16px",
        }}
      >
        <Info style={{ width: "20px", height: "20px", color: "#60a5fa", flexShrink: 0, marginTop: "2px" }} />
        <div>
          <h3 style={{ fontSize: "15px", fontWeight: "600", color: "#fafafa", margin: "0 0 8px 0" }}>How Publishing Works</h3>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "#9ca3af", lineHeight: "1.8" }}>
            <li>
              <strong style={{ color: "#b8b8c8" }}>Source:</strong> SDK code lives in <code style={{ color: "#00f0ff" }}>packages/ios-sdk/</code> in this repo.
            </li>
            <li>
              <strong style={{ color: "#b8b8c8" }}>Publishing:</strong> Triggers a GitHub Action that copies the SDK to the distribution repo.
            </li>
            <li>
              <strong style={{ color: "#b8b8c8" }}>Distribution:</strong> iOS developers install via SPM from the private distribution repo.
            </li>
            <li>
              <strong style={{ color: "#b8b8c8" }}>Versioning:</strong> Each publish creates a git tag that SPM can reference.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
