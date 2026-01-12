"use client";

import { useState, useRef } from "react";
import {
  HardDrive,
  Download,
  Upload,
  Check,
  AlertCircle,
  FileJson,
  Database,
  Users,
  AppWindow,
  Layers,
  Server,
  Activity,
  Shield,
  Coins,
  RefreshCw,
  Info,
  X,
} from "lucide-react";

type ExportType =
  | "all"
  | "apps"
  | "users"
  | "models"
  | "providers"
  | "jobs"
  | "audit_logs"
  | "revenuecat_events"
  | "token_ledger";

interface ExportTypeConfig {
  id: ExportType;
  label: string;
  description: string;
  icon: React.ElementType;
}

const exportTypes: ExportTypeConfig[] = [
  { id: "apps", label: "Apps", description: "Tenant applications and settings", icon: AppWindow },
  { id: "users", label: "Users", description: "App users and token balances", icon: Users },
  { id: "models", label: "AI Models", description: "Model configurations and provider mappings", icon: Layers },
  { id: "providers", label: "Providers", description: "AI provider settings", icon: Server },
  { id: "jobs", label: "Jobs", description: "Generation job history", icon: Activity },
  { id: "audit_logs", label: "Audit Logs", description: "Admin action history", icon: Shield },
  { id: "revenuecat_events", label: "RevenueCat Events", description: "Purchase and subscription events", icon: Coins },
  { id: "token_ledger", label: "Token Ledger", description: "Token transaction history", icon: Database },
];

interface ImportResult {
  success: boolean;
  dryRun: boolean;
  results: {
    type: string;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  }[];
  totalCreated: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
}

export default function BackupsPage() {
  // Export state
  const [selectedTypes, setSelectedTypes] = useState<ExportType[]>([]);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [isDryRun, setIsDryRun] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectAll = selectedTypes.length === 0;

  const toggleType = (type: ExportType) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const response = await fetch("/api/admin/backups/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          types: selectedTypes.length === 0 ? ["all"] : selectedTypes,
          includeSecrets,
        }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-backend-hub-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error("Export error:", error);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append(
        "options",
        JSON.stringify({
          mode: importMode,
          dryRun: isDryRun,
        })
      );

      const response = await fetch("/api/admin/backups/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import failed");
      }

      setImportResult(result);
    } catch (error) {
      console.error("Import error:", error);
      alert(error instanceof Error ? error.message : "Import failed. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  const clearImport = () => {
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
              background: "linear-gradient(135deg, rgba(0, 240, 255, 0.15) 0%, rgba(0, 240, 255, 0.05) 100%)",
              border: "1px solid rgba(0, 240, 255, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HardDrive style={{ width: "24px", height: "24px", color: "#00f0ff" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", margin: 0 }}>Backups</h1>
            <p style={{ fontSize: "15px", color: "#9ca3af", margin: "4px 0 0 0" }}>
              Export and import your data for backup and migration
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Export Section */}
        <div className="glass" style={{ padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <Download style={{ width: "22px", height: "22px", color: "#00f0ff" }} />
            <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#fafafa", margin: 0 }}>Export Data</h2>
          </div>

          {/* Data type selection */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <label style={{ fontSize: "14px", fontWeight: "500", color: "#b8b8c8" }}>Select data to export</label>
              <button
                onClick={() => setSelectedTypes([])}
                style={{
                  fontSize: "13px",
                  color: selectAll ? "#00f0ff" : "#9ca3af",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {selectAll ? "✓ All selected" : "Select all"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {exportTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectAll || selectedTypes.includes(type.id);

                return (
                  <button
                    key={type.id}
                    onClick={() => toggleType(type.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: isSelected ? "rgba(0, 240, 255, 0.08)" : "rgba(30, 30, 40, 0.5)",
                      border: isSelected ? "1px solid rgba(0, 240, 255, 0.3)" : "1px solid rgba(80, 80, 100, 0.3)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Icon
                      style={{
                        width: "18px",
                        height: "18px",
                        color: isSelected ? "#00f0ff" : "#9ca3af",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: "500", color: isSelected ? "#fafafa" : "#b8b8c8" }}>
                        {type.label}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#71717a",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {type.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Include secrets toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderRadius: "10px",
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.2)",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertCircle style={{ width: "18px", height: "18px", color: "#fbbf24" }} />
              <div>
                <div style={{ fontSize: "13px", fontWeight: "500", color: "#fbbf24" }}>Include Secrets</div>
                <div style={{ fontSize: "12px", color: "#9ca3af" }}>API keys, webhook secrets for full restore</div>
              </div>
            </div>
            <button
              onClick={() => setIncludeSecrets(!includeSecrets)}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: includeSecrets ? "#00f0ff" : "rgba(80, 80, 100, 0.5)",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "10px",
                  background: "#fff",
                  position: "absolute",
                  top: "2px",
                  left: includeSecrets ? "22px" : "2px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn-primary"
            style={{
              width: "100%",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            {isExporting ? (
              <>
                <RefreshCw style={{ width: "18px", height: "18px" }} className="animate-spin" />
                Exporting...
              </>
            ) : exportSuccess ? (
              <>
                <Check style={{ width: "18px", height: "18px" }} />
                Downloaded!
              </>
            ) : (
              <>
                <Download style={{ width: "18px", height: "18px" }} />
                Export Backup
              </>
            )}
          </button>
        </div>

        {/* Import Section */}
        <div className="glass" style={{ padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <Upload style={{ width: "22px", height: "22px", color: "#00f0ff" }} />
            <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#fafafa", margin: 0 }}>Import Data</h2>
          </div>

          {/* File selection */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#b8b8c8", display: "block", marginBottom: "10px" }}>
              Backup file
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            {importFile ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  background: "rgba(0, 240, 255, 0.08)",
                  border: "1px solid rgba(0, 240, 255, 0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <FileJson style={{ width: "20px", height: "20px", color: "#00f0ff" }} />
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "500", color: "#fafafa" }}>{importFile.name}</div>
                    <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                      {(importFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <button
                  onClick={clearImport}
                  style={{
                    padding: "6px",
                    borderRadius: "6px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#9ca3af",
                  }}
                >
                  <X style={{ width: "18px", height: "18px" }} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: "100%",
                  padding: "32px",
                  borderRadius: "12px",
                  background: "rgba(30, 30, 40, 0.5)",
                  border: "2px dashed rgba(80, 80, 100, 0.5)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  transition: "all 0.15s ease",
                }}
              >
                <FileJson style={{ width: "32px", height: "32px", color: "#71717a" }} />
                <div style={{ fontSize: "14px", color: "#9ca3af" }}>Click to select backup file</div>
                <div style={{ fontSize: "12px", color: "#71717a" }}>JSON format only</div>
              </button>
            )}
          </div>

          {/* Import mode */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#b8b8c8", display: "block", marginBottom: "10px" }}>
              Import mode
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setImportMode("merge")}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  background: importMode === "merge" ? "rgba(0, 240, 255, 0.08)" : "rgba(30, 30, 40, 0.5)",
                  border: importMode === "merge" ? "1px solid rgba(0, 240, 255, 0.3)" : "1px solid rgba(80, 80, 100, 0.3)",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: "500", color: importMode === "merge" ? "#00f0ff" : "#b8b8c8" }}>
                  Merge
                </div>
                <div style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>Skip existing records</div>
              </button>
              <button
                onClick={() => setImportMode("replace")}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  background: importMode === "replace" ? "rgba(239, 68, 68, 0.08)" : "rgba(30, 30, 40, 0.5)",
                  border: importMode === "replace" ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(80, 80, 100, 0.3)",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: "500", color: importMode === "replace" ? "#f87171" : "#b8b8c8" }}>
                  Replace
                </div>
                <div style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>Overwrite existing</div>
              </button>
            </div>
          </div>

          {/* Dry run toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderRadius: "10px",
              background: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Info style={{ width: "18px", height: "18px", color: "#60a5fa" }} />
              <div>
                <div style={{ fontSize: "13px", fontWeight: "500", color: "#60a5fa" }}>Dry Run</div>
                <div style={{ fontSize: "12px", color: "#9ca3af" }}>Preview changes without applying</div>
              </div>
            </div>
            <button
              onClick={() => setIsDryRun(!isDryRun)}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: isDryRun ? "#60a5fa" : "rgba(80, 80, 100, 0.5)",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "10px",
                  background: "#fff",
                  position: "absolute",
                  top: "2px",
                  left: isDryRun ? "22px" : "2px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={!importFile || isImporting}
            className={isDryRun ? "btn-secondary" : "btn-primary"}
            style={{
              width: "100%",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              opacity: !importFile ? 0.5 : 1,
            }}
          >
            {isImporting ? (
              <>
                <RefreshCw style={{ width: "18px", height: "18px" }} className="animate-spin" />
                {isDryRun ? "Analyzing..." : "Importing..."}
              </>
            ) : (
              <>
                <Upload style={{ width: "18px", height: "18px" }} />
                {isDryRun ? "Preview Import" : "Import Backup"}
              </>
            )}
          </button>

          {/* Import results */}
          {importResult && (
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                borderRadius: "12px",
                background: importResult.totalErrors > 0 ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                border: `1px solid ${importResult.totalErrors > 0 ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                {importResult.totalErrors > 0 ? (
                  <AlertCircle style={{ width: "20px", height: "20px", color: "#f87171" }} />
                ) : (
                  <Check style={{ width: "20px", height: "20px", color: "#34d399" }} />
                )}
                <div style={{ fontSize: "15px", fontWeight: "600", color: "#fafafa" }}>
                  {importResult.dryRun ? "Dry Run Results" : "Import Complete"}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#34d399" }}>{importResult.totalCreated}</div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>Created</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#fbbf24" }}>{importResult.totalUpdated}</div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>Updated</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#9ca3af" }}>{importResult.totalSkipped}</div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>Skipped</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#f87171" }}>{importResult.totalErrors}</div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>Errors</div>
                </div>
              </div>

              {/* Per-type results */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {importResult.results.map((r) => (
                  <div
                    key={r.type}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    <span style={{ fontSize: "13px", color: "#b8b8c8", textTransform: "capitalize" }}>{r.type}</span>
                    <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
                      <span style={{ color: "#34d399" }}>+{r.created}</span>
                      <span style={{ color: "#fbbf24" }}>~{r.updated}</span>
                      <span style={{ color: "#71717a" }}>-{r.skipped}</span>
                      {r.errors.length > 0 && <span style={{ color: "#f87171" }}>!{r.errors.length}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {importResult.dryRun && importResult.totalCreated + importResult.totalUpdated > 0 && (
                <button
                  onClick={() => {
                    setIsDryRun(false);
                    handleImport();
                  }}
                  className="btn-primary"
                  style={{
                    width: "100%",
                    height: "40px",
                    marginTop: "16px",
                    fontSize: "13px",
                  }}
                >
                  Apply Changes
                </button>
              )}
            </div>
          )}
        </div>
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
          <h3 style={{ fontSize: "15px", fontWeight: "600", color: "#fafafa", margin: "0 0 8px 0" }}>Backup Tips</h3>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "#9ca3af", lineHeight: "1.8" }}>
            <li>
              <strong style={{ color: "#b8b8c8" }}>Regular backups:</strong> Export your data regularly, especially before major changes.
            </li>
            <li>
              <strong style={{ color: "#b8b8c8" }}>Include secrets:</strong> Only enable when creating a full restore backup. Store securely!
            </li>
            <li>
              <strong style={{ color: "#b8b8c8" }}>Dry run first:</strong> Always preview imports before applying to catch potential issues.
            </li>
            <li>
              <strong style={{ color: "#b8b8c8" }}>Merge vs Replace:</strong> Use &ldquo;Merge&rdquo; for adding new data, &ldquo;Replace&rdquo; for full restore.
            </li>
            <li>
              <strong style={{ color: "#b8b8c8" }}>Large datasets:</strong> Jobs, audit logs, and token ledger may be truncated for very large exports.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
