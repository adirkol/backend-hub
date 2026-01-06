"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  RefreshCw,
  Layers,
  Server,
  Search,
  Coins,
  ExternalLink,
  Smartphone,
  Bug,
  Code,
} from "lucide-react";

interface ProviderConfig {
  id: string;
  providerModelId: string;
  priority: number;
  provider: {
    id: string;
    name: string;
    displayName: string;
    baseUrl: string | null;
  };
}

interface Model {
  id: string;
  name: string;
  displayName: string;
  modelFamily: string | null;
  providerConfigs: ProviderConfig[];
}

interface TestResult {
  status: "success" | "error" | "pending" | "running";
  message: string;
  latencyMs?: number;
  response?: unknown;
  timestamp: Date;
  jobId?: string;
  taskId?: string;
  outputs?: Array<{ url: string; index: number }> | string[];
  tokensCost?: number;
  needsPolling?: boolean;
  endpoint?: string;
}

interface Props {
  models: Model[];
}

export function HealthcheckClient({ models }: Props) {
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [showProviderTests, setShowProviderTests] = useState<Record<string, boolean>>({});
  
  // Model test state
  const [modelTestResults, setModelTestResults] = useState<Record<string, TestResult>>({});
  const [modelJobIds, setModelJobIds] = useState<Record<string, string>>({});
  const [runningModelTests, setRunningModelTests] = useState<Set<string>>(new Set());
  
  // Provider test state
  const [providerTestResults, setProviderTestResults] = useState<Record<string, TestResult>>({});
  const [providerTaskIds, setProviderTaskIds] = useState<Record<string, string>>({});
  const [providerJobIds, setProviderJobIds] = useState<Record<string, string>>({});
  const [runningProviderTests, setRunningProviderTests] = useState<Set<string>>(new Set());

  const toggleModel = (modelId: string) => {
    const next = new Set(expandedModels);
    if (next.has(modelId)) {
      next.delete(modelId);
    } else {
      next.add(modelId);
    }
    setExpandedModels(next);
  };

  const toggleProvider = (configId: string) => {
    const next = new Set(expandedProviders);
    if (next.has(configId)) {
      next.delete(configId);
    } else {
      next.add(configId);
    }
    setExpandedProviders(next);
  };

  // ==========================================================================
  // MODEL TESTS - Simulates iOS Client
  // ==========================================================================

  const runModelCreateTest = async (model: Model) => {
    const testKey = `model_create_${model.id}`;
    
    setRunningModelTests((prev) => new Set(prev).add(testKey));
    setModelTestResults((prev) => ({
      ...prev,
      [testKey]: { 
        status: "pending", 
        message: "Submitting to queue...", 
        endpoint: "POST /api/v1/generate",
        timestamp: new Date() 
      },
    }));

    try {
      const response = await fetch("/api/admin/healthcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "modelCreateTest",
          modelName: model.name,
        }),
      });

      const data = await response.json();

      if (data.jobId) {
        setModelJobIds((prev) => ({ ...prev, [model.id]: data.jobId }));
      }

      // Create test succeeded if we got a job ID back
      // The job itself is now queued/running, but the CREATE API call succeeded
      setModelTestResults((prev) => ({
        ...prev,
        [testKey]: {
          status: data.success ? "success" : "error",
          message: data.success 
            ? `Job queued: ${data.jobId} (click Result Test to check status)` 
            : data.error || "Unknown error",
          latencyMs: data.latencyMs,
          response: data,
          timestamp: new Date(),
          jobId: data.jobId,
          tokensCost: data.tokensCost,
          endpoint: data.endpoint,
        },
      }));
    } catch (error) {
      setModelTestResults((prev) => ({
        ...prev,
        [testKey]: {
          status: "error",
          message: error instanceof Error ? error.message : "Network error",
          endpoint: "POST /api/v1/generate",
          timestamp: new Date(),
        },
      }));
    } finally {
      setRunningModelTests((prev) => {
        const next = new Set(prev);
        next.delete(testKey);
        return next;
      });
    }
  };

  const runModelPollTest = async (model: Model) => {
    const testKey = `model_poll_${model.id}`;
    const jobId = modelJobIds[model.id];

    if (!jobId) {
      setModelTestResults((prev) => ({
        ...prev,
        [testKey]: {
          status: "error",
          message: "No job ID. Run Create Test first.",
          endpoint: "GET /api/v1/jobs/:id",
          timestamp: new Date(),
        },
      }));
      return;
    }
    
    setRunningModelTests((prev) => new Set(prev).add(testKey));
    setModelTestResults((prev) => ({
      ...prev,
      [testKey]: { 
        status: "pending", 
        message: "Checking job status...", 
        endpoint: `GET /api/v1/jobs/${jobId}`,
        timestamp: new Date() 
      },
    }));

    try {
      const response = await fetch("/api/admin/healthcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "modelPollTest",
          jobId,
        }),
      });

      const data = await response.json();
      const isPending = data.status === "queued" || data.status === "running";

      // Determine display status:
      // - "success" = job completed successfully
      // - "running" = job still processing (show spinner)
      // - "error" = job failed
      let displayStatus: "success" | "running" | "error" = "error";
      if (data.success) {
        displayStatus = "success";
      } else if (isPending) {
        displayStatus = "running";
      }

      setModelTestResults((prev) => ({
        ...prev,
        [testKey]: {
          status: displayStatus,
          message: isPending 
            ? `Job ${data.status}... (click Result Test again to refresh)`
            : data.message || `Status: ${data.status}`,
          latencyMs: data.latencyMs,
          response: data,
          timestamp: new Date(),
          outputs: data.outputs,
          tokensCost: data.tokensCost,
          endpoint: data.endpoint,
        },
      }));
    } catch (error) {
      setModelTestResults((prev) => ({
        ...prev,
        [testKey]: {
          status: "error",
          message: error instanceof Error ? error.message : "Network error",
          endpoint: `GET /api/v1/jobs/${jobId}`,
          timestamp: new Date(),
        },
      }));
    } finally {
      setRunningModelTests((prev) => {
        const next = new Set(prev);
        next.delete(testKey);
        return next;
      });
    }
  };

  // ==========================================================================
  // PROVIDER TESTS - Direct Debugging
  // ==========================================================================

  const runProviderCreateTest = async (config: ProviderConfig, modelId: string) => {
    const testKey = `provider_create_${config.id}`;
    
    setRunningProviderTests((prev) => new Set(prev).add(testKey));
    setProviderTestResults((prev) => ({
      ...prev,
      [testKey]: { 
        status: "pending", 
        message: "Calling provider directly...", 
        timestamp: new Date() 
      },
    }));

    try {
      const response = await fetch("/api/admin/healthcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "providerCreateTest",
          providerConfigId: config.id,
          providerId: config.provider.id,
          providerName: config.provider.name,
          providerModelId: config.providerModelId,
          modelId: modelId,
        }),
      });

      const data = await response.json();

      if (data.taskId) {
        setProviderTaskIds((prev) => ({ ...prev, [config.id]: data.taskId }));
      }
      if (data.jobId) {
        setProviderJobIds((prev) => ({ ...prev, [config.id]: data.jobId }));
      }

      setProviderTestResults((prev) => ({
        ...prev,
        [testKey]: {
          status: data.success ? (data.needsPolling ? "running" : "success") : "error",
          message: data.message || data.error || "Unknown response",
          latencyMs: data.latencyMs,
          response: data,
          timestamp: new Date(),
          jobId: data.jobId,
          taskId: data.taskId,
          outputs: data.outputs,
          tokensCost: data.tokensCost,
          needsPolling: data.needsPolling,
          endpoint: data.endpoint,
        },
      }));
    } catch (error) {
      setProviderTestResults((prev) => ({
        ...prev,
        [testKey]: {
          status: "error",
          message: error instanceof Error ? error.message : "Network error",
          timestamp: new Date(),
        },
      }));
    } finally {
      setRunningProviderTests((prev) => {
        const next = new Set(prev);
        next.delete(testKey);
        return next;
      });
    }
  };

  const runProviderPollTest = async (config: ProviderConfig) => {
    const testKey = `provider_poll_${config.id}`;
    const taskId = providerTaskIds[config.id];
    const jobId = providerJobIds[config.id];

    if (!taskId) {
      setProviderTestResults((prev) => ({
        ...prev,
        [testKey]: {
          status: "error",
          message: "No task ID. Run Create Test first or enter a task ID.",
          timestamp: new Date(),
        },
      }));
      return;
    }
    
    setRunningProviderTests((prev) => new Set(prev).add(testKey));
    setProviderTestResults((prev) => ({
      ...prev,
      [testKey]: { 
        status: "pending", 
        message: "Polling provider...", 
        timestamp: new Date() 
      },
    }));

    try {
      const response = await fetch("/api/admin/healthcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "providerPollTest",
          providerName: config.provider.name,
          taskId,
          jobId,
        }),
      });

      const data = await response.json();
      const isPending = data.status === "pending" || data.status === "running";

      setProviderTestResults((prev) => ({
        ...prev,
        [testKey]: {
          status: data.success ? "success" : isPending ? "running" : "error",
          message: data.message || `Status: ${data.status}`,
          latencyMs: data.latencyMs,
          response: data,
          timestamp: new Date(),
          outputs: data.outputs,
          endpoint: data.endpoint,
        },
      }));
    } catch (error) {
      setProviderTestResults((prev) => ({
        ...prev,
        [testKey]: {
          status: "error",
          message: error instanceof Error ? error.message : "Network error",
          timestamp: new Date(),
        },
      }));
    } finally {
      setRunningProviderTests((prev) => {
        const next = new Set(prev);
        next.delete(testKey);
        return next;
      });
    }
  };

  // ==========================================================================
  // Helpers
  // ==========================================================================

  const getStatusColor = (result?: TestResult) => {
    if (!result) return "#71717a";
    switch (result.status) {
      case "success": return "#34d399";
      case "error": return "#ef4444";
      case "pending": return "#facc15";
      case "running": return "#60a5fa";
      default: return "#71717a";
    }
  };

  const getStatusBg = (result?: TestResult) => {
    if (!result) return "rgba(113, 113, 122, 0.1)";
    switch (result.status) {
      case "success": return "rgba(16, 185, 129, 0.15)";
      case "error": return "rgba(239, 68, 68, 0.15)";
      case "pending": return "rgba(250, 204, 21, 0.15)";
      case "running": return "rgba(59, 130, 246, 0.15)";
      default: return "rgba(113, 113, 122, 0.1)";
    }
  };

  const formatOutputs = (outputs: Array<{ url: string; index: number }> | string[] | undefined) => {
    if (!outputs) return [];
    return outputs.map((o) => typeof o === "string" ? o : o.url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Action Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <button
          onClick={() => setExpandedModels(new Set(models.map((m) => m.id)))}
          style={{
            padding: "12px 16px",
            background: "rgba(39, 39, 42, 0.6)",
            border: "1px solid rgba(63, 63, 70, 0.5)",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#a1a1aa",
            cursor: "pointer",
          }}
        >
          Expand All
        </button>

        <button
          onClick={() => {
            setExpandedModels(new Set());
            setExpandedProviders(new Set());
          }}
          style={{
            padding: "12px 16px",
            background: "rgba(39, 39, 42, 0.6)",
            border: "1px solid rgba(63, 63, 70, 0.5)",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#a1a1aa",
            cursor: "pointer",
          }}
        >
          Collapse All
        </button>

        <a
          href="/admin/jobs?app=_healthcheck_app"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 16px",
            background: "rgba(99, 102, 241, 0.15)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#818cf8",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          <ExternalLink style={{ width: "16px", height: "16px" }} />
          View Test Jobs
        </a>
      </div>

      {/* Info Banners */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{
          padding: "14px 18px",
          background: "rgba(16, 185, 129, 0.1)",
          border: "1px solid rgba(16, 185, 129, 0.2)",
          borderRadius: "10px",
          fontSize: "13px",
          color: "#6ee7b7",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}>
          <Smartphone style={{ width: "18px", height: "18px", flexShrink: 0 }} />
          <span>
            <strong>Model Tests</strong> simulate iOS client behavior: POST /api/v1/generate → Queue → Worker → GET /api/v1/jobs/:id
          </span>
        </div>
        <div style={{
          padding: "14px 18px",
          background: "rgba(245, 158, 11, 0.1)",
          border: "1px solid rgba(245, 158, 11, 0.2)",
          borderRadius: "10px",
          fontSize: "13px",
          color: "#fcd34d",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}>
          <Bug style={{ width: "18px", height: "18px", flexShrink: 0 }} />
          <span>
            <strong>Provider Tests</strong> call providers directly (bypassing queue) for debugging API connectivity
          </span>
        </div>
      </div>

      {/* Models List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {models.map((model) => {
          const createResult = modelTestResults[`model_create_${model.id}`];
          const pollResult = modelTestResults[`model_poll_${model.id}`];
          const isCreateRunning = runningModelTests.has(`model_create_${model.id}`);
          const isPollRunning = runningModelTests.has(`model_poll_${model.id}`);
          const currentJobId = modelJobIds[model.id] || "";

          return (
            <div 
              key={model.id} 
              className="glass"
              style={{ overflow: "hidden" }}
            >
              {/* Model Header */}
              <button
                onClick={() => toggleModel(model.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "20px 24px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  borderBottom: expandedModels.has(model.id) 
                    ? "1px solid rgba(63, 63, 70, 0.4)" 
                    : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  {expandedModels.has(model.id) ? (
                    <ChevronDown style={{ width: "20px", height: "20px", color: "#71717a" }} />
                  ) : (
                    <ChevronRight style={{ width: "20px", height: "20px", color: "#71717a" }} />
                  )}
                  <div style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.3) 100%)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Layers style={{ width: "22px", height: "22px", color: "#a78bfa" }} />
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: "600", color: "#fafafa", fontSize: "16px" }}>
                      {model.displayName}
                    </div>
                    <div style={{ fontSize: "13px", color: "#71717a", fontFamily: "monospace" }}>
                      {model.name}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {model.modelFamily && (
                    <span style={{
                      padding: "6px 12px",
                      background: "rgba(99, 102, 241, 0.15)",
                      border: "1px solid rgba(99, 102, 241, 0.3)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#818cf8",
                    }}>
                      {model.modelFamily}
                    </span>
                  )}
                  <span style={{
                    padding: "6px 12px",
                    background: "rgba(39, 39, 42, 0.6)",
                    border: "1px solid rgba(63, 63, 70, 0.4)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#a1a1aa",
                  }}>
                    {model.providerConfigs.length} provider{model.providerConfigs.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>

              {/* Model Content */}
              {expandedModels.has(model.id) && (
                <div style={{ padding: "20px 24px" }}>
                  {/* ================================================================ */}
                  {/* MODEL TESTS - Client Simulation */}
                  {/* ================================================================ */}
                  <div style={{
                    padding: "20px",
                    background: "rgba(16, 185, 129, 0.05)",
                    border: "1px solid rgba(16, 185, 129, 0.15)",
                    borderRadius: "12px",
                    marginBottom: "16px",
                  }}>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "10px", 
                      marginBottom: "16px" 
                    }}>
                      <Smartphone style={{ width: "18px", height: "18px", color: "#34d399" }} />
                      <span style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: "#34d399",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}>
                        Model Tests (Client Simulation)
                      </span>
                    </div>

                    {/* Test Buttons Row */}
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "12px", 
                      flexWrap: "wrap",
                      marginBottom: createResult || pollResult ? "16px" : 0,
                    }}>
                      {/* Create Test */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <button
                          onClick={() => runModelCreateTest(model)}
                          disabled={isCreateRunning}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "10px 16px",
                            background: isCreateRunning 
                              ? "rgba(250, 204, 21, 0.15)"
                              : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: "600",
                            color: isCreateRunning ? "#facc15" : "#09090b",
                            cursor: isCreateRunning ? "wait" : "pointer",
                          }}
                        >
                          {isCreateRunning ? (
                            <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
                          ) : (
                            <Play style={{ width: "16px", height: "16px" }} />
                          )}
                          Create Test
                        </button>
                        <code style={{ 
                          fontSize: "10px", 
                          color: "#6ee7b7", 
                          fontFamily: "monospace",
                          padding: "2px 4px",
                          background: "rgba(16, 185, 129, 0.1)",
                          borderRadius: "4px",
                        }}>
                          POST /api/v1/generate
                        </code>
                      </div>

                      {/* Result Test */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <button
                          onClick={() => runModelPollTest(model)}
                          disabled={isPollRunning || !currentJobId}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "10px 16px",
                            background: isPollRunning 
                              ? "rgba(250, 204, 21, 0.15)"
                              : "rgba(59, 130, 246, 0.15)",
                            border: `1px solid ${isPollRunning ? "rgba(250, 204, 21, 0.3)" : "rgba(59, 130, 246, 0.3)"}`,
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: "500",
                            color: isPollRunning ? "#facc15" : "#60a5fa",
                            cursor: isPollRunning || !currentJobId ? "not-allowed" : "pointer",
                            opacity: !currentJobId ? 0.5 : 1,
                          }}
                        >
                          {isPollRunning ? (
                            <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
                          ) : (
                            <Search style={{ width: "16px", height: "16px" }} />
                          )}
                          Result Test
                        </button>
                        <code style={{ 
                          fontSize: "10px", 
                          color: "#93c5fd", 
                          fontFamily: "monospace",
                          padding: "2px 4px",
                          background: "rgba(59, 130, 246, 0.1)",
                          borderRadius: "4px",
                        }}>
                          GET /api/v1/jobs/:id
                        </code>
                      </div>

                      {/* Job ID Display */}
                      {currentJobId && (
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: "6px",
                          padding: "8px 12px",
                          background: "rgba(39, 39, 42, 0.5)",
                          borderRadius: "6px",
                        }}>
                          <span style={{ fontSize: "11px", color: "#71717a" }}>Job:</span>
                          <code style={{ fontSize: "11px", color: "#a1a1aa", fontFamily: "monospace" }}>
                            {currentJobId.slice(0, 12)}...
                          </code>
                        </div>
                      )}

                      {/* Status Indicators */}
                      {createResult && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {createResult.status === "success" && <CheckCircle2 style={{ width: "16px", height: "16px", color: "#34d399" }} />}
                          {createResult.status === "error" && <XCircle style={{ width: "16px", height: "16px", color: "#ef4444" }} />}
                          {createResult.status === "running" && <Loader2 style={{ width: "16px", height: "16px", color: "#60a5fa", animation: "spin 1s linear infinite" }} />}
                          {createResult.latencyMs && (
                            <span style={{ fontSize: "11px", color: "#71717a", display: "flex", alignItems: "center", gap: "3px" }}>
                              <Clock style={{ width: "11px", height: "11px" }} />
                              {createResult.latencyMs}ms
                            </span>
                          )}
                          {createResult.tokensCost && (
                            <span style={{ fontSize: "11px", color: "#fbbf24", display: "flex", alignItems: "center", gap: "3px" }}>
                              <Coins style={{ width: "11px", height: "11px" }} />
                              {createResult.tokensCost}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Results Display */}
                    {(createResult || pollResult) && (
                      <div style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        gap: "12px",
                        padding: "14px",
                        background: "rgba(9, 9, 11, 0.4)",
                        borderRadius: "8px",
                      }}>
                        {createResult && (
                          <div>
                            <div style={{ fontSize: "11px", color: "#6ee7b7", marginBottom: "6px", fontWeight: "600" }}>
                              CREATE RESULT
                            </div>
                            <div style={{
                              padding: "10px 12px",
                              background: getStatusBg(createResult),
                              borderRadius: "6px",
                              color: getStatusColor(createResult),
                              fontSize: "13px",
                            }}>
                              {createResult.message}
                            </div>
                          </div>
                        )}
                        {pollResult && (
                          <div>
                            <div style={{ fontSize: "11px", color: "#93c5fd", marginBottom: "6px", fontWeight: "600" }}>
                              POLL RESULT
                            </div>
                            <div style={{
                              padding: "10px 12px",
                              background: getStatusBg(pollResult),
                              borderRadius: "6px",
                              color: getStatusColor(pollResult),
                              fontSize: "13px",
                            }}>
                              {pollResult.message}
                            </div>
                            {pollResult.outputs && formatOutputs(pollResult.outputs).length > 0 && (
                              <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                {formatOutputs(pollResult.outputs).map((url, i) => (
                                  <a 
                                    key={i} 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{
                                      width: "80px",
                                      height: "80px",
                                      borderRadius: "6px",
                                      overflow: "hidden",
                                      border: "1px solid rgba(63, 63, 70, 0.4)",
                                    }}
                                  >
                                    <img src={url} alt={`Output ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ================================================================ */}
                  {/* PROVIDER TESTS - Debug Section */}
                  {/* ================================================================ */}
                  <div>
                    <button
                      onClick={() => setShowProviderTests((prev) => ({ ...prev, [model.id]: !prev[model.id] }))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.2)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#fbbf24",
                        cursor: "pointer",
                        width: "100%",
                        justifyContent: "flex-start",
                      }}
                    >
                      {showProviderTests[model.id] ? (
                        <ChevronDown style={{ width: "16px", height: "16px" }} />
                      ) : (
                        <ChevronRight style={{ width: "16px", height: "16px" }} />
                      )}
                      <Bug style={{ width: "16px", height: "16px" }} />
                      Provider Tests (Debug) - {model.providerConfigs.length} provider{model.providerConfigs.length !== 1 ? "s" : ""}
                    </button>

                    {showProviderTests[model.id] && (
                      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        {model.providerConfigs.map((config) => {
                          const createResult = providerTestResults[`provider_create_${config.id}`];
                          const pollResult = providerTestResults[`provider_poll_${config.id}`];
                          const isCreateRunning = runningProviderTests.has(`provider_create_${config.id}`);
                          const isPollRunning = runningProviderTests.has(`provider_poll_${config.id}`);
                          const currentTaskId = providerTaskIds[config.id] || "";
                          const isExpanded = expandedProviders.has(config.id);

                          return (
                            <div
                              key={config.id}
                              style={{
                                padding: "14px 16px",
                                background: "rgba(39, 39, 42, 0.3)",
                                border: "1px solid rgba(63, 63, 70, 0.3)",
                                borderRadius: "10px",
                              }}
                            >
                              {/* Provider Header */}
                              <div style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                gap: "10px",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                  <div style={{
                                    width: "24px",
                                    height: "24px",
                                    borderRadius: "4px",
                                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "11px",
                                    fontWeight: "700",
                                    color: "#09090b",
                                  }}>
                                    {config.priority}
                                  </div>
                                  <Server style={{ width: "16px", height: "16px", color: "#71717a" }} />
                                  <div>
                                    <div style={{ fontWeight: "500", color: "#e4e4e7", fontSize: "13px" }}>
                                      {config.provider.displayName}
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#71717a", fontFamily: "monospace" }}>
                                      {config.providerModelId}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  {/* Create Test Button */}
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                    <button
                                      onClick={() => runProviderCreateTest(config, model.id)}
                                      disabled={isCreateRunning}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        padding: "6px 12px",
                                        background: isCreateRunning ? "rgba(250, 204, 21, 0.15)" : "rgba(245, 158, 11, 0.15)",
                                        border: `1px solid ${isCreateRunning ? "rgba(250, 204, 21, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                        fontWeight: "500",
                                        color: isCreateRunning ? "#facc15" : "#fbbf24",
                                        cursor: isCreateRunning ? "wait" : "pointer",
                                      }}
                                    >
                                      {isCreateRunning ? (
                                        <Loader2 style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite" }} />
                                      ) : (
                                        <Play style={{ width: "12px", height: "12px" }} />
                                      )}
                                      Create
                                    </button>
                                    {createResult?.endpoint && (
                                      <code style={{ fontSize: "9px", color: "#a1a1aa", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {createResult.endpoint.replace("POST ", "")}
                                      </code>
                                    )}
                                  </div>

                                  {/* Poll Test Button */}
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                    <button
                                      onClick={() => runProviderPollTest(config)}
                                      disabled={isPollRunning || !currentTaskId}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        padding: "6px 12px",
                                        background: isPollRunning ? "rgba(250, 204, 21, 0.15)" : "rgba(59, 130, 246, 0.15)",
                                        border: `1px solid ${isPollRunning ? "rgba(250, 204, 21, 0.3)" : "rgba(59, 130, 246, 0.3)"}`,
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                        fontWeight: "500",
                                        color: isPollRunning ? "#facc15" : "#60a5fa",
                                        cursor: isPollRunning || !currentTaskId ? "not-allowed" : "pointer",
                                        opacity: !currentTaskId ? 0.5 : 1,
                                      }}
                                    >
                                      {isPollRunning ? (
                                        <Loader2 style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite" }} />
                                      ) : (
                                        <Search style={{ width: "12px", height: "12px" }} />
                                      )}
                                      Poll
                                    </button>
                                    {pollResult?.endpoint && (
                                      <code style={{ fontSize: "9px", color: "#a1a1aa", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {pollResult.endpoint.replace("GET ", "")}
                                      </code>
                                    )}
                                  </div>

                                  {/* Expand */}
                                  {(createResult || pollResult) && (
                                    <button
                                      onClick={() => toggleProvider(config.id)}
                                      style={{
                                        padding: "6px",
                                        background: "rgba(39, 39, 42, 0.6)",
                                        border: "1px solid rgba(63, 63, 70, 0.4)",
                                        borderRadius: "6px",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                      }}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown style={{ width: "12px", height: "12px", color: "#71717a" }} />
                                      ) : (
                                        <ChevronRight style={{ width: "12px", height: "12px", color: "#71717a" }} />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Task ID Input */}
                              <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <Code style={{ width: "12px", height: "12px", color: "#71717a" }} />
                                <span style={{ fontSize: "11px", color: "#71717a" }}>Task ID:</span>
                                <input
                                  type="text"
                                  value={currentTaskId}
                                  onChange={(e) => setProviderTaskIds((prev) => ({ ...prev, [config.id]: e.target.value }))}
                                  placeholder="From create or enter manually..."
                                  style={{
                                    flex: 1,
                                    padding: "6px 10px",
                                    background: "rgba(9, 9, 11, 0.5)",
                                    border: "1px solid rgba(63, 63, 70, 0.4)",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                    fontFamily: "monospace",
                                    color: "#e4e4e7",
                                    outline: "none",
                                  }}
                                />
                              </div>

                              {/* Expanded Results */}
                              {isExpanded && (createResult || pollResult) && (
                                <div style={{ 
                                  marginTop: "12px", 
                                  padding: "12px",
                                  background: "rgba(9, 9, 11, 0.4)",
                                  borderRadius: "6px",
                                }}>
                                  {createResult && (
                                    <div style={{ marginBottom: pollResult ? "12px" : 0 }}>
                                      <div style={{ fontSize: "10px", color: "#fbbf24", marginBottom: "6px", fontWeight: "600" }}>
                                        CREATE RESULT
                                      </div>
                                      <div style={{
                                        padding: "8px 10px",
                                        background: getStatusBg(createResult),
                                        borderRadius: "4px",
                                        color: getStatusColor(createResult),
                                        fontSize: "12px",
                                        marginBottom: "8px",
                                      }}>
                                        {createResult.message}
                                      </div>
                                      {createResult.response && (
                                        <pre style={{
                                          padding: "10px",
                                          background: "rgba(9, 9, 11, 0.6)",
                                          borderRadius: "4px",
                                          fontSize: "10px",
                                          fontFamily: "monospace",
                                          color: "#a1a1aa",
                                          overflow: "auto",
                                          maxHeight: "150px",
                                          whiteSpace: "pre-wrap",
                                          wordBreak: "break-word",
                                        }}>
                                          {JSON.stringify(createResult.response, null, 2)}
                                        </pre>
                                      )}
                                    </div>
                                  )}
                                  {pollResult && (
                                    <div>
                                      <div style={{ fontSize: "10px", color: "#60a5fa", marginBottom: "6px", fontWeight: "600" }}>
                                        POLL RESULT
                                      </div>
                                      <div style={{
                                        padding: "8px 10px",
                                        background: getStatusBg(pollResult),
                                        borderRadius: "4px",
                                        color: getStatusColor(pollResult),
                                        fontSize: "12px",
                                        marginBottom: "8px",
                                      }}>
                                        {pollResult.message}
                                      </div>
                                      {pollResult.outputs && formatOutputs(pollResult.outputs).length > 0 && (
                                        <div style={{ marginBottom: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                          {formatOutputs(pollResult.outputs).map((url, i) => (
                                            <a 
                                              key={i} 
                                              href={url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              style={{
                                                width: "60px",
                                                height: "60px",
                                                borderRadius: "4px",
                                                overflow: "hidden",
                                                border: "1px solid rgba(63, 63, 70, 0.4)",
                                              }}
                                            >
                                              <img src={url} alt={`Output ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                      {pollResult.response && (
                                        <pre style={{
                                          padding: "10px",
                                          background: "rgba(9, 9, 11, 0.6)",
                                          borderRadius: "4px",
                                          fontSize: "10px",
                                          fontFamily: "monospace",
                                          color: "#a1a1aa",
                                          overflow: "auto",
                                          maxHeight: "150px",
                                          whiteSpace: "pre-wrap",
                                          wordBreak: "break-word",
                                        }}>
                                          {JSON.stringify(pollResult.response, null, 2)}
                                        </pre>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {model.providerConfigs.length === 0 && (
                          <div style={{
                            padding: "20px",
                            textAlign: "center",
                            color: "#71717a",
                            fontSize: "13px",
                          }}>
                            No providers configured for this model
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {models.length === 0 && (
          <div className="glass" style={{ padding: "64px 32px", textAlign: "center" }}>
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
              <Layers style={{ width: "32px", height: "32px", color: "#71717a" }} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#e4e4e7", marginBottom: "10px" }}>
              No models to test
            </h3>
            <p style={{ color: "#71717a", maxWidth: "320px", margin: "0 auto" }}>
              Configure AI models and providers first
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
