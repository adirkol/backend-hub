import Link from "next/link";
import { prisma } from "@/lib/db";
import { User, Coins, Zap, Search, AppWindow } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    app?: string;
    page?: string;
  }>;
}

async function getUsers(filters: { search?: string; appId?: string }, page = 1) {
  const limit = 25;
  const skip = (page - 1) * limit;

  const where: {
    externalId?: { contains: string; mode: "insensitive" };
    appId?: string;
  } = {};

  if (filters.search) {
    where.externalId = { contains: filters.search, mode: "insensitive" };
  }
  if (filters.appId) {
    where.appId = filters.appId;
  }

  const [users, total, apps] = await Promise.all([
    prisma.appUser.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        app: { select: { name: true, slug: true } },
        _count: { select: { jobs: true } },
        revenueCatEvents: {
          where: { priceUsd: { not: null } },
          select: { priceUsd: true },
        },
      },
    }),
    prisma.appUser.count({ where }),
    prisma.app.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return { users, total, page, limit, apps };
}

export default async function UsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getUsers(
    { search: params.q, appId: params.app },
    parseInt(params.page || "1")
  );

  const { users, total, page, limit, apps } = data;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
          Users
        </h1>
        <p style={{ color: "#9ca3af", marginTop: "6px", fontSize: "15px" }}>
          {total.toLocaleString()} total users across all apps
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <form style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, maxWidth: "480px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search style={{ 
              position: "absolute", 
              left: "16px", 
              top: "50%", 
              transform: "translateY(-50%)", 
              width: "18px", 
              height: "18px", 
              color: "#9ca3af" 
            }} />
            <input
              type="text"
              name="q"
              defaultValue={params.q}
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

        <select
          defaultValue={params.app || ""}
          style={{
            padding: "14px 20px",
            borderRadius: "12px",
            fontSize: "14px",
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

      {/* Users Table */}
      <div className="glass" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.4)" }}>
                {["User", "App", "External ID", "Tokens", "Revenue", "Jobs", "Subscription", "Created"].map((header) => (
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
              {users.map((user) => (
                <tr 
                  key={user.id} 
                  className="table-row-hover"
                  style={{ borderBottom: "1px solid rgba(63, 63, 70, 0.25)", position: "relative", cursor: "pointer" }}
                >
                  <td style={{ padding: "18px 20px" }}>
                    <Link
                      href={`/admin/apps/${user.appId}/users/${user.id}`}
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 1,
                      }}
                    />
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
                        <User style={{ width: "18px", height: "18px", color: "#9ca3af" }} />
                      </div>
                      <code style={{ 
                        fontSize: "12px", 
                        color: "#b8b8c8", 
                        background: "rgba(39, 39, 42, 0.5)", 
                        padding: "6px 10px", 
                        borderRadius: "6px",
                        fontFamily: "monospace",
                      }}>
                        {user.id.slice(0, 8)}...
                      </code>
                    </div>
                  </td>
                  <td style={{ padding: "18px 20px" }}>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "8px", 
                      fontSize: "14px", 
                      color: "#e4e4e7", 
                    }}>
                      <AppWindow style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
                      {user.app.name}
                    </div>
                  </td>
                  <td style={{ 
                    padding: "18px 20px", 
                    fontSize: "13px", 
                    color: "#e4e4e7", 
                    fontFamily: "monospace",
                    maxWidth: "200px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
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
                    {(() => {
                      const totalRevenue = user.revenueCatEvents.reduce((sum, e) => sum + Number(e.priceUsd || 0), 0);
                      return totalRevenue > 0 ? (
                        <span style={{ color: "#10b981", fontWeight: "600", fontSize: "14px" }}>
                          ${totalRevenue.toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ color: "#52525b", fontSize: "14px" }}>-</span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#b8b8c8", fontSize: "14px" }}>
                      <Zap style={{ width: "16px", height: "16px" }} />
                      <span>{user._count.jobs}</span>
                    </div>
                  </td>
                  <td style={{ padding: "18px 20px" }}>
                    {user.isPremium ? (
                      <span className="badge-success">Premium</span>
                    ) : user.subscriptionStatus ? (
                      <span className={
                        user.subscriptionStatus === "EXPIRED" ? "badge-default" :
                        user.subscriptionStatus === "CANCELLED" ? "badge-warning" :
                        user.subscriptionStatus === "BILLING_ISSUE" ? "badge-error" :
                        user.subscriptionStatus === "REFUNDED" ? "badge-error" :
                        "badge-default"
                      }>
                        {user.subscriptionStatus.charAt(0) + user.subscriptionStatus.slice(1).toLowerCase().replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span style={{ color: "#52525b", fontSize: "13px" }}>Free</span>
                    )}
                  </td>
                  <td style={{ padding: "18px 20px", fontSize: "13px", color: "#9ca3af" }}>
                    {new Date(user.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "64px 20px", textAlign: "center", color: "#9ca3af" }}>
                    {params.q ? `No users matching "${params.q}"` : "No users yet"}
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
                href={`/admin/users?page=${page - 1}${params.q ? `&q=${params.q}` : ""}${params.app ? `&app=${params.app}` : ""}`}
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
                href={`/admin/users?page=${page + 1}${params.q ? `&q=${params.q}` : ""}${params.app ? `&app=${params.app}` : ""}`}
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
