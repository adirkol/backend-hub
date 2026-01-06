import Link from "next/link";
import { prisma } from "@/lib/db";
import { Plus, Users, Zap, AppWindow, ArrowUpRight } from "lucide-react";

async function getApps() {
  const apps = await prisma.app.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          users: true,
          jobs: true,
        },
      },
    },
  });

  return apps;
}

export default async function AppsPage() {
  const apps = await getApps();

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
            Apps
          </h1>
          <p style={{ color: "#71717a", marginTop: "6px", fontSize: "15px" }}>
            Manage your tenant applications
          </p>
        </div>
        <Link 
          href="/admin/apps/new" 
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 20px",
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            color: "#09090b",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "600",
            textDecoration: "none",
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
            transition: "all 0.15s ease",
          }}
        >
          <Plus style={{ width: "18px", height: "18px" }} />
          New App
        </Link>
      </div>

      {/* Apps Grid */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", 
        gap: "20px" 
      }}>
        {apps.map((app) => (
          <Link
            key={app.id}
            href={`/admin/apps/${app.id}`}
            className="card"
            style={{
              padding: "24px",
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, rgba(63, 63, 70, 0.5) 0%, rgba(39, 39, 42, 0.8) 100%)",
                  border: "1px solid rgba(63, 63, 70, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <AppWindow style={{ width: "22px", height: "22px", color: "#a1a1aa" }} />
                </div>
                <div>
                  <h3 style={{ fontWeight: "600", color: "#fafafa", fontSize: "16px", marginBottom: "4px" }}>
                    {app.name}
                  </h3>
                  <p style={{ fontSize: "13px", color: "#71717a", fontFamily: "monospace" }}>{app.slug}</p>
                </div>
              </div>
              <ArrowUpRight style={{ width: "18px", height: "18px", color: "#52525b" }} />
            </div>

            {app.description && (
              <p style={{ 
                fontSize: "14px", 
                color: "#a1a1aa", 
                marginBottom: "20px",
                lineHeight: "1.5",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {app.description}
              </p>
            )}

            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "24px", 
              paddingTop: "16px", 
              borderTop: "1px solid rgba(63, 63, 70, 0.4)" 
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users style={{ width: "16px", height: "16px", color: "#71717a" }} />
                <span style={{ color: "#e4e4e7", fontWeight: "600", fontSize: "14px" }}>
                  {app._count.users.toLocaleString()}
                </span>
                <span style={{ color: "#71717a", fontSize: "14px" }}>users</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap style={{ width: "16px", height: "16px", color: "#71717a" }} />
                <span style={{ color: "#e4e4e7", fontWeight: "600", fontSize: "14px" }}>
                  {app._count.jobs.toLocaleString()}
                </span>
                <span style={{ color: "#71717a", fontSize: "14px" }}>jobs</span>
              </div>
              <span
                className={app.isEnabled ? "badge-success" : "badge-error"}
                style={{ marginLeft: "auto" }}
              >
                {app.isEnabled ? "Active" : "Disabled"}
              </span>
            </div>
          </Link>
        ))}

        {/* Create new app card */}
        <Link
          href="/admin/apps/new"
          style={{
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "200px",
            background: "transparent",
            border: "2px dashed rgba(63, 63, 70, 0.5)",
            borderRadius: "16px",
            textDecoration: "none",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "rgba(39, 39, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
          }}>
            <Plus style={{ width: "28px", height: "28px", color: "#71717a" }} />
          </div>
          <p style={{ fontWeight: "500", color: "#71717a", fontSize: "15px" }}>
            Create new app
          </p>
        </Link>

        {apps.length === 0 && (
          <div className="card" style={{ 
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
              <AppWindow style={{ width: "32px", height: "32px", color: "#71717a" }} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#e4e4e7", marginBottom: "10px" }}>
              No apps yet
            </h3>
            <p style={{ color: "#71717a", marginBottom: "28px", maxWidth: "360px", margin: "0 auto 28px", lineHeight: "1.5" }}>
              Create your first app to start accepting AI generation requests from iOS apps
            </p>
            <Link
              href="/admin/apps/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 24px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#09090b",
                borderRadius: "12px",
                fontSize: "15px",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              <Plus style={{ width: "18px", height: "18px" }} />
              Create Your First App
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
