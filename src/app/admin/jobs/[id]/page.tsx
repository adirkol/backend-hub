import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
  Coins,
  Image as ImageIcon,
  FileJson,
  Zap,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getJobDetails(jobId: string) {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    include: {
      app: {
        select: { id: true, name: true, slug: true },
      },
      appUser: {
        select: { id: true, externalId: true, tokenBalance: true },
      },
      aiModel: {
        select: {
          id: true,
          name: true,
          displayName: true,
          modelFamily: true,
          tokenCost: true,
        },
      },
    },
  });

  if (!job) return null;

  // Get provider usage logs for this job
  const providerLogs = await prisma.providerUsageLog.findMany({
    where: { jobId },
    orderBy: { attemptNumber: "asc" },
    include: {
      provider: {
        select: { id: true, name: true, displayName: true },
      },
    },
  });

  return { job, providerLogs };
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; border: string; icon: React.ReactNode }> = {
    SUCCEEDED: {
      bg: "rgba(16, 185, 129, 0.15)",
      color: "#34d399",
      border: "rgba(16, 185, 129, 0.3)",
      icon: <CheckCircle2 style={{ width: "16px", height: "16px" }} />,
    },
    FAILED: {
      bg: "rgba(239, 68, 68, 0.15)",
      color: "#f87171",
      border: "rgba(239, 68, 68, 0.3)",
      icon: <XCircle style={{ width: "16px", height: "16px" }} />,
    },
    RUNNING: {
      bg: "rgba(245, 158, 11, 0.15)",
      color: "#fbbf24",
      border: "rgba(245, 158, 11, 0.3)",
      icon: <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />,
    },
    QUEUED: {
      bg: "rgba(59, 130, 246, 0.15)",
      color: "#60a5fa",
      border: "rgba(59, 130, 246, 0.3)",
      icon: <Clock style={{ width: "16px", height: "16px" }} />,
    },
    CANCELLED: {
      bg: "rgba(113, 113, 122, 0.2)",
      color: "#a1a1aa",
      border: "rgba(113, 113, 122, 0.3)",
      icon: <XCircle style={{ width: "16px", height: "16px" }} />,
    },
  };

  const c = config[status] || config.CANCELLED;

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 16px",
      borderRadius: "9999px",
      fontSize: "14px",
      fontWeight: "600",
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
    }}>
      {c.icon}
      {status.toLowerCase()}
    </span>
  );
}

function formatDuration(startedAt: Date | null, completedAt: Date | null): string {
  if (!startedAt) return "—";
  const end = completedAt || new Date();
  const ms = end.getTime() - startedAt.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getJobDetails(id);

  if (!data) {
    notFound();
  }

  const { job, providerLogs } = data;
  const inputPayload = job.inputPayload as Record<string, unknown>;
  const outputs = job.outputs as Array<{ url: string; index: number }> | null;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <Link
            href="/admin/jobs"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              color: "#71717a",
              textDecoration: "none",
              marginBottom: "12px",
            }}
          >
            <ArrowLeft style={{ width: "16px", height: "16px" }} />
            Back to Jobs
          </Link>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
            Job Details
          </h1>
          <code style={{
            fontSize: "14px",
            color: "#71717a",
            fontFamily: "monospace",
            marginTop: "8px",
            display: "block",
          }}>
            {job.id}
          </code>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {/* Overview Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        {/* App */}
        <div className="glass" style={{ padding: "20px" }}>
          <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            App
          </div>
          <Link
            href={`/admin/apps/${job.app.id}`}
            style={{ fontSize: "16px", fontWeight: "600", color: "#e4e4e7", textDecoration: "none" }}
          >
            {job.app.name}
          </Link>
          <div style={{ fontSize: "13px", color: "#71717a", fontFamily: "monospace" }}>{job.app.slug}</div>
        </div>

        {/* User */}
        <div className="glass" style={{ padding: "20px" }}>
          <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            User
          </div>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "#e4e4e7", fontFamily: "monospace" }}>
            {job.appUser.externalId}
          </div>
          <div style={{ fontSize: "13px", color: "#71717a" }}>Balance: {job.appUser.tokenBalance} tokens</div>
        </div>

        {/* Model */}
        <div className="glass" style={{ padding: "20px" }}>
          <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Model
          </div>
          <Link
            href={`/admin/models/${job.aiModel.id}`}
            style={{ fontSize: "16px", fontWeight: "600", color: "#e4e4e7", textDecoration: "none" }}
          >
            {job.aiModel.displayName}
          </Link>
          <div style={{ fontSize: "13px", color: "#71717a", fontFamily: "monospace" }}>{job.aiModel.name}</div>
        </div>

        {/* Tokens */}
        <div className="glass" style={{ padding: "20px" }}>
          <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Tokens
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Coins style={{ width: "18px", height: "18px", color: "#fbbf24" }} />
            <span style={{ fontSize: "20px", fontWeight: "700", color: "#fbbf24" }}>{job.tokenCost}</span>
          </div>
          <div style={{ fontSize: "13px", color: "#71717a" }}>
            {job.tokensRefunded ? (
              <span style={{ color: "#f87171" }}>Refunded</span>
            ) : job.tokensCharged ? (
              <span style={{ color: "#34d399" }}>Charged</span>
            ) : (
              "Pending"
            )}
          </div>
        </div>

        {/* Duration */}
        <div className="glass" style={{ padding: "20px" }}>
          <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Duration
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock style={{ width: "18px", height: "18px", color: "#a78bfa" }} />
            <span style={{ fontSize: "20px", fontWeight: "700", color: "#e4e4e7" }}>
              {formatDuration(job.startedAt, job.completedAt)}
            </span>
          </div>
          <div style={{ fontSize: "13px", color: "#71717a" }}>
            {job.attemptsCount} provider attempt{job.attemptsCount !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Provider Used */}
        <div className="glass" style={{ padding: "20px" }}>
          <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Provider Used
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Server style={{ width: "18px", height: "18px", color: "#60a5fa" }} />
            <span style={{ fontSize: "16px", fontWeight: "600", color: "#e4e4e7" }}>
              {job.usedProvider || "—"}
            </span>
          </div>
          {job.providerTaskId && (
            <div style={{ fontSize: "11px", color: "#71717a", fontFamily: "monospace", marginTop: "4px" }}>
              Task: {job.providerTaskId.slice(0, 16)}...
            </div>
          )}
        </div>
      </div>

      {/* Timing */}
      <div className="glass" style={{ padding: "24px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#e4e4e7", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <Clock style={{ width: "18px", height: "18px", color: "#a78bfa" }} />
          Timing
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "4px" }}>Created</div>
            <div style={{ fontSize: "14px", color: "#e4e4e7" }}>{job.createdAt.toISOString()}</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "4px" }}>Started</div>
            <div style={{ fontSize: "14px", color: "#e4e4e7" }}>{job.startedAt?.toISOString() || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "4px" }}>Completed</div>
            <div style={{ fontSize: "14px", color: "#e4e4e7" }}>{job.completedAt?.toISOString() || "—"}</div>
          </div>
        </div>
      </div>

      {/* Error (if failed) */}
      {job.status === "FAILED" && job.errorMessage && (
        <div style={{
          padding: "20px",
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <AlertTriangle style={{ width: "20px", height: "20px", color: "#f87171" }} />
            <span style={{ fontSize: "16px", fontWeight: "600", color: "#f87171" }}>Error</span>
            {job.errorCode && (
              <code style={{
                fontSize: "12px",
                padding: "4px 8px",
                background: "rgba(239, 68, 68, 0.2)",
                borderRadius: "4px",
                color: "#fca5a5",
              }}>
                {job.errorCode}
              </code>
            )}
          </div>
          <pre style={{
            fontSize: "13px",
            color: "#fca5a5",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
          }}>
            {job.errorMessage}
          </pre>
        </div>
      )}

      {/* Provider Attempts */}
      <div className="glass" style={{ padding: "24px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#e4e4e7", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <Zap style={{ width: "18px", height: "18px", color: "#fbbf24" }} />
          Provider Attempts ({providerLogs.length})
        </h2>
        
        {providerLogs.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#71717a" }}>
            No provider attempts logged yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {providerLogs.map((log, index) => (
              <div
                key={log.id}
                style={{
                  padding: "16px 20px",
                  background: log.success
                    ? "rgba(16, 185, 129, 0.08)"
                    : "rgba(239, 68, 68, 0.08)",
                  border: `1px solid ${log.success ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {/* Attempt number */}
                    <div style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      background: log.success
                        ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                        : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#fff",
                    }}>
                      {log.attemptNumber}
                    </div>
                    
                    {/* Status icon */}
                    {log.success ? (
                      <CheckCircle2 style={{ width: "18px", height: "18px", color: "#34d399" }} />
                    ) : (
                      <XCircle style={{ width: "18px", height: "18px", color: "#f87171" }} />
                    )}
                    
                    {/* Provider name */}
                    <div>
                      <div style={{ fontWeight: "600", color: "#e4e4e7", fontSize: "14px" }}>
                        {log.provider.displayName}
                      </div>
                      <div style={{ fontSize: "12px", color: "#71717a", fontFamily: "monospace" }}>
                        {log.providerModelId}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    {log.latencyMs && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#a1a1aa" }}>
                        <Clock style={{ width: "14px", height: "14px" }} />
                        {log.latencyMs}ms
                      </div>
                    )}
                    {log.costCharged && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#fbbf24" }}>
                        <Coins style={{ width: "14px", height: "14px" }} />
                        ${Number(log.costCharged).toFixed(4)}
                      </div>
                    )}
                    {log.providerTaskId && (
                      <code style={{
                        fontSize: "11px",
                        padding: "4px 8px",
                        background: "rgba(39, 39, 42, 0.6)",
                        borderRadius: "4px",
                        color: "#a1a1aa",
                      }}>
                        {log.providerTaskId.slice(0, 12)}...
                      </code>
                    )}
                  </div>
                </div>

                {/* Error message if failed */}
                {!log.success && log.errorMessage && (
                  <div style={{
                    padding: "10px 12px",
                    background: "rgba(239, 68, 68, 0.1)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "#fca5a5",
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}>
                    {log.errorMessage}
                  </div>
                )}

                {/* Timestamp */}
                <div style={{ fontSize: "11px", color: "#52525b", marginTop: "8px" }}>
                  {log.createdAt.toISOString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Payload */}
      <div className="glass" style={{ padding: "24px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#e4e4e7", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <FileJson style={{ width: "18px", height: "18px", color: "#60a5fa" }} />
          Input Payload
        </h2>
        <pre style={{
          padding: "16px",
          background: "rgba(9, 9, 11, 0.6)",
          borderRadius: "8px",
          fontSize: "13px",
          fontFamily: "monospace",
          color: "#a1a1aa",
          overflow: "auto",
          maxHeight: "400px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          margin: 0,
        }}>
          {JSON.stringify(inputPayload, null, 2)}
        </pre>
      </div>

      {/* Outputs */}
      {outputs && outputs.length > 0 && (
        <div className="glass" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#e4e4e7", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <ImageIcon style={{ width: "18px", height: "18px", color: "#34d399" }} />
            Outputs ({outputs.length})
          </h2>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {outputs.map((output, i) => (
              <a
                key={i}
                href={output.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  width: "200px",
                  borderRadius: "10px",
                  overflow: "hidden",
                  border: "1px solid rgba(63, 63, 70, 0.4)",
                  textDecoration: "none",
                }}
              >
                <div style={{ position: "relative", paddingBottom: "100%" }}>
                  <img
                    src={output.url}
                    alt={`Output ${i + 1}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
                <div style={{
                  padding: "10px 12px",
                  background: "rgba(9, 9, 11, 0.8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: "12px", color: "#a1a1aa" }}>Output {output.index + 1}</span>
                  <ExternalLink style={{ width: "14px", height: "14px", color: "#71717a" }} />
                </div>
              </a>
            ))}
          </div>

          {/* Output URLs */}
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "8px" }}>Output URLs:</div>
            <pre style={{
              padding: "12px",
              background: "rgba(9, 9, 11, 0.6)",
              borderRadius: "6px",
              fontSize: "11px",
              fontFamily: "monospace",
              color: "#a1a1aa",
              overflow: "auto",
              maxHeight: "150px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              margin: 0,
            }}>
              {JSON.stringify(outputs, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

