import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowLeft, User, Coins, Zap, Search } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}

async function getAppWithUsers(appId: string, search?: string, page = 1) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const app = await prisma.app.findUnique({
    where: { id: appId },
    select: { id: true, name: true, slug: true },
  });

  if (!app) return null;

  const where = {
    appId,
    ...(search && {
      OR: [
        { externalId: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.appUser.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        _count: {
          select: { jobs: true },
        },
      },
    }),
    prisma.appUser.count({ where }),
  ]);

  return { app, users, total, page, limit };
}

export default async function AppUsersPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { q, page } = await searchParams;
  const data = await getAppWithUsers(id, q, parseInt(page || "1"));

  if (!data) {
    notFound();
  }

  const { app, users, total, page: currentPage, limit } = data;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <Link
          href={`/admin/apps/${app.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
            color: "#71717a",
            textDecoration: "none",
            marginBottom: "20px",
          }}
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} />
          Back to {app.name}
        </Link>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
          Users in {app.name}
        </h1>
        <p style={{ color: "#71717a", marginTop: "6px", fontSize: "15px" }}>
          {total.toLocaleString()} total users
        </p>
      </div>

      {/* Search */}
      <form style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: "480px" }}>
          <Search style={{ 
            position: "absolute", 
            left: "16px", 
            top: "50%", 
            transform: "translateY(-50%)", 
            width: "18px", 
            height: "18px", 
            color: "#71717a" 
          }} />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by external ID..."
            style={{
              width: "100%",
              padding: "14px 16px 14px 48px",
              borderRadius: "12px",
              background: "rgba(39, 39, 42, 0.5)",
              border: "1px solid rgba(63, 63, 70, 0.6)",
              color: "#fafafa",
              fontSize: "15px",
              outline: "none",
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: "14px 24px",
            borderRadius: "12px",
            background: "rgba(39, 39, 42, 0.8)",
            border: "1px solid rgba(63, 63, 70, 0.6)",
            color: "#e4e4e7",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </form>

      {/* Users Table */}
      <div className="glass" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.4)" }}>
              {["User", "External ID", "Balance", "Jobs", "Status", "Created"].map((header) => (
                <th 
                  key={header}
                  style={{ 
                    padding: "16px 20px", 
                    textAlign: "left", 
                    fontSize: "12px", 
                    fontWeight: "600",
                    color: "#71717a",
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
            {users.map((user) => (
              <tr 
                key={user.id} 
                className="table-row-hover"
                style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.25)" }}
              >
                <td style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "rgba(39, 39, 42, 0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <User style={{ width: "18px", height: "18px", color: "#71717a" }} />
                    </div>
                    <code style={{ 
                      fontSize: "12px", 
                      color: "#a1a1aa", 
                      background: "rgba(39, 39, 42, 0.5)", 
                      padding: "6px 10px", 
                      borderRadius: "6px",
                      fontFamily: "monospace",
                    }}>
                      {user.id.slice(0, 8)}...
                    </code>
                  </div>
                </td>
                <td style={{ 
                  padding: "18px 20px", 
                  fontSize: "14px", 
                  color: "#e4e4e7", 
                  fontFamily: "monospace" 
                }}>
                  {user.externalId}
                </td>
                <td style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Coins style={{ width: "16px", height: "16px", color: "#facc15" }} />
                    <span style={{ color: "#fafafa", fontWeight: "600", fontSize: "14px" }}>
                      {user.tokenBalance}
                    </span>
                  </div>
                </td>
                <td style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#a1a1aa", fontSize: "14px" }}>
                    <Zap style={{ width: "16px", height: "16px" }} />
                    <span>{user._count.jobs}</span>
                  </div>
                </td>
                <td style={{ padding: "18px 20px" }}>
                  <span className={user.isActive ? "badge-success" : "badge-error"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ padding: "18px 20px", fontSize: "13px", color: "#71717a" }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "64px 20px", textAlign: "center", color: "#71717a" }}>
                  {q ? `No users matching "${q}"` : "No users yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "14px", color: "#71717a" }}>
            Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, total)} of {total}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {currentPage > 1 && (
              <Link
                href={`/admin/apps/${app.id}/users?page=${currentPage - 1}${q ? `&q=${q}` : ""}`}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  color: "#a1a1aa",
                  textDecoration: "none",
                  background: "rgba(39, 39, 42, 0.5)",
                }}
              >
                Previous
              </Link>
            )}
            <span style={{ fontSize: "14px", color: "#e4e4e7" }}>
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages && (
              <Link
                href={`/admin/apps/${app.id}/users?page=${currentPage + 1}${q ? `&q=${q}` : ""}`}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  color: "#a1a1aa",
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
