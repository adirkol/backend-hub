import Link from "next/link";
import { prisma } from "@/lib/db";
import { RefreshCw, Filter } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    app?: string;
    page?: string;
  }>;
}

async function getJobs(filters: { status?: string; appId?: string; appSlug?: string }, page = 1) {
  const limit = 25;
  const skip = (page - 1) * limit;

  const where: {
    status?: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
    appId?: string;
    app?: { slug: string };
  } = {};

  if (filters.status && ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"].includes(filters.status)) {
    where.status = filters.status as typeof where.status;
  }
  if (filters.appId) {
    where.appId = filters.appId;
  }
  // Support filtering by app slug (e.g., ?app=healthcheck for healthcheck tests)
  if (filters.appSlug) {
    where.app = { slug: filters.appSlug };
  }

  const [jobs, total, apps] = await Promise.all([
    prisma.generationJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        app: { select: { name: true, slug: true } },
        aiModel: { select: { name: true, displayName: true } },
        appUser: { select: { externalId: true } },
      },
    }),
    prisma.generationJob.count({ where }),
    prisma.app.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return { jobs, total, page, limit, apps };
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    SUCCEEDED: { bg: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "rgba(16, 185, 129, 0.3)" },
    FAILED: { bg: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "rgba(239, 68, 68, 0.3)" },
    RUNNING: { bg: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.3)" },
    QUEUED: { bg: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" },
    CANCELLED: { bg: "rgba(113, 113, 122, 0.2)", color: "#b8b8c8", border: "rgba(113, 113, 122, 0.3)" },
  };

  const style = styles[status] || styles.CANCELLED;

  return (
    <span style={{
      padding: "5px 12px",
      borderRadius: "9999px",
      fontSize: "12px",
      fontWeight: "500",
      background: style.bg,
      color: style.color,
      border: `1px solid ${style.border}`,
    }}>
      {status.toLowerCase()}
    </span>
  );
}

export default async function JobsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  
  // Check if app param is an ID (cuid) or a slug
  const isAppId = params.app && params.app.length > 20; // cuids are ~25 chars
  
  const data = await getJobs(
    { 
      status: params.status, 
      appId: isAppId ? params.app : undefined,
      appSlug: !isAppId ? params.app : undefined,
    },
    parseInt(params.page || "1")
  );

  const { jobs, total, page, limit, apps } = data;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
            Jobs
          </h1>
          <p style={{ color: "#9ca3af", marginTop: "6px", fontSize: "15px" }}>
            {total.toLocaleString()} total jobs
          </p>
        </div>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 20px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#b8b8c8",
            background: "rgba(39, 39, 42, 0.6)",
            border: "1px solid rgba(63, 63, 70, 0.5)",
            cursor: "pointer",
          }}
        >
          <RefreshCw style={{ width: "16px", height: "16px" }} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Filter style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
          <span style={{ fontSize: "14px", color: "#9ca3af" }}>Filter:</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"].map((status) => (
            <Link
              key={status}
              href={`/admin/jobs?status=${status}${params.app ? `&app=${params.app}` : ""}`}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "500",
                textDecoration: "none",
                background: params.status === status 
                  ? "linear-gradient(135deg, #00f0ff 0%, #00b8cc 100%)" 
                  : "rgba(39, 39, 42, 0.6)",
                color: params.status === status ? "#000" : "#b8b8c8",
                transition: "all 0.15s ease",
              }}
            >
              {status.toLowerCase()}
            </Link>
          ))}
          {params.status && (
            <Link
              href={`/admin/jobs${params.app ? `?app=${params.app}` : ""}`}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "500",
                color: "#9ca3af",
                textDecoration: "none",
              }}
            >
              Clear
            </Link>
          )}
        </div>

        <select
          defaultValue={params.app || ""}
          style={{
            padding: "10px 16px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "500",
            background: "rgba(39, 39, 42, 0.6)",
            border: "1px solid rgba(63, 63, 70, 0.5)",
            color: "#e4e4e7",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">All Apps</option>
          {apps.map((app) => (
            <option key={app.id} value={app.id}>{app.name}</option>
          ))}
        </select>
      </div>

      {/* Jobs Table */}
      <div className="glass" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.4)" }}>
                {["Job ID", "App", "User", "Model", "Status", "Provider", "Tokens", "Created"].map((header) => (
                  <th 
                    key={header}
                    style={{ 
                      padding: "16px 20px", 
                      textAlign: "left", 
                      fontSize: "12px", 
                      fontWeight: "600",
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr 
                  key={job.id} 
                  className="table-row-hover"
                  style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.25)" }}
                >
                  <td style={{ padding: "16px 20px" }}>
                    <Link
                      href={`/admin/jobs/${job.id}`}
                      style={{ textDecoration: "none" }}
                    >
                      <code style={{ 
                        fontSize: "12px", 
                        color: "#60a5fa", 
                        background: "rgba(59, 130, 246, 0.1)", 
                        padding: "6px 10px", 
                        borderRadius: "6px",
                        fontFamily: "monospace",
                        cursor: "pointer",
                        border: "1px solid rgba(59, 130, 246, 0.2)",
                      }}>
                        {job.id.slice(0, 12)}...
                      </code>
                    </Link>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <Link 
                      href={`/admin/apps/${job.appId}`}
                      style={{ fontSize: "14px", color: "#e4e4e7", textDecoration: "none" }}
                    >
                      {job.app.name}
                    </Link>
                  </td>
                  <td style={{ 
                    padding: "16px 20px", 
                    fontSize: "13px", 
                    color: "#b8b8c8", 
                    fontFamily: "monospace",
                    maxWidth: "140px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {job.appUser.externalId}
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: "14px", color: "#b8b8c8" }}>
                    {job.aiModel.name}
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <StatusBadge status={job.status} />
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: "13px", color: "#9ca3af" }}>
                    {job.usedProvider || "—"}
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: "14px", color: "#b8b8c8" }}>
                    {job.tokenCost}
                    {job.tokensRefunded && (
                      <span style={{ marginLeft: "6px", fontSize: "12px", color: "#fbbf24" }}>(refunded)</span>
                    )}
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: "13px", color: "#9ca3af" }}>
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "64px 20px", textAlign: "center", color: "#9ca3af" }}>
                    No jobs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "14px", color: "#9ca3af" }}>
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {page > 1 && (
              <Link
                href={`/admin/jobs?page=${page - 1}${params.status ? `&status=${params.status}` : ""}${params.app ? `&app=${params.app}` : ""}`}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  color: "#b8b8c8",
                  textDecoration: "none",
                  background: "rgba(39, 39, 42, 0.5)",
                }}
              >
                Previous
              </Link>
            )}
            <span style={{ fontSize: "14px", color: "#e4e4e7" }}>
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/admin/jobs?page=${page + 1}${params.status ? `&status=${params.status}` : ""}${params.app ? `&app=${params.app}` : ""}`}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  color: "#b8b8c8",
                  textDecoration: "none",
                  background: "rgba(39, 39, 42, 0.5)",
                }}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
