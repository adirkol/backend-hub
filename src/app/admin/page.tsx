import { prisma } from "@/lib/db";
import {
  AppWindow,
  Users,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

async function getStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    totalApps,
    totalUsers,
    jobsToday,
    jobsThisWeek,
    succeededToday,
    failedToday,
    queuedJobs,
    recentJobs,
  ] = await Promise.all([
    prisma.app.count(),
    prisma.appUser.count(),
    prisma.generationJob.count({
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.generationJob.count({
      where: { createdAt: { gte: weekStart } },
    }),
    prisma.generationJob.count({
      where: { createdAt: { gte: todayStart }, status: "SUCCEEDED" },
    }),
    prisma.generationJob.count({
      where: { createdAt: { gte: todayStart }, status: "FAILED" },
    }),
    prisma.generationJob.count({
      where: { status: { in: ["QUEUED", "RUNNING"] } },
    }),
    prisma.generationJob.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        app: { select: { name: true } },
        aiModel: { select: { name: true } },
      },
    }),
  ]);

  return {
    totalApps,
    totalUsers,
    jobsToday,
    jobsThisWeek,
    succeededToday,
    failedToday,
    queuedJobs,
    recentJobs,
  };
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  href?: string;
}) {
  const content = (
    <div 
      style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'linear-gradient(145deg, rgba(24, 24, 27, 0.9) 0%, rgba(15, 15, 17, 0.95) 100%)',
        border: '1px solid rgba(63, 63, 70, 0.4)',
        height: '100%',
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '14px', fontWeight: '500', color: '#b8b8c8', marginBottom: '8px' }}>{title}</p>
          <p style={{ fontSize: '32px', fontWeight: '700', color: '#fafafa', letterSpacing: '-0.02em' }}>{value}</p>
          {subtitle && (
            <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '8px' }}>{subtitle}</p>
          )}
        </div>
        <div 
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(39, 39, 42, 0.8) 0%, rgba(24, 24, 27, 0.9) 100%)',
            border: '1px solid rgba(63, 63, 70, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon style={{ width: '22px', height: '22px', color: '#00f0ff' }} />
        </div>
      </div>
      {trend && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(63, 63, 70, 0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TrendingUp
            style={{ 
              width: '14px', 
              height: '14px',
              color: trend === "up" ? '#34d399' : trend === "down" ? '#f87171' : '#9ca3af',
              transform: trend === "down" ? 'rotate(180deg)' : 'none'
            }}
          />
          <span style={{ fontSize: '13px', color: trend === "up" ? '#34d399' : trend === "down" ? '#f87171' : '#9ca3af' }}>
            vs last week
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ display: 'block', textDecoration: 'none' }}>
        {content}
      </Link>
    );
  }

  return content;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    SUCCEEDED: { bg: 'rgba(34, 197, 94, 0.15)', color: '#86efac', border: 'rgba(34, 197, 94, 0.3)' },
    FAILED: { bg: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' },
    RUNNING: { bg: 'rgba(234, 179, 8, 0.15)', color: '#fde047', border: 'rgba(234, 179, 8, 0.3)' },
    QUEUED: { bg: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: 'rgba(59, 130, 246, 0.3)' },
    CANCELLED: { bg: 'rgba(113, 113, 122, 0.15)', color: '#b8b8c8', border: 'rgba(113, 113, 122, 0.3)' },
  };

  const style = styles[status] || styles.CANCELLED;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '500',
      background: style.bg,
      color: style.color,
      border: `1px solid ${style.border}`
    }}>
      {status.toLowerCase()}
    </span>
  );
}

export default async function AdminDashboard() {
  const stats = await getStats();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#fafafa', letterSpacing: '-0.02em' }}>Dashboard</h1>
          <p style={{ color: '#9ca3af', marginTop: '6px', fontSize: '15px' }}>Overview of your AI Backend Hub</p>
        </div>
        <Link 
          href="/admin/apps/new" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            background: 'linear-gradient(135deg, #00f0ff 0%, #00b8cc 100%)',
            color: '#000',
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(0, 240, 255, 0.3)'
          }}
        >
          <Zap style={{ width: '18px', height: '18px' }} />
          New App
        </Link>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <StatCard
          title="Total Apps"
          value={stats.totalApps}
          subtitle="Active tenants"
          icon={AppWindow}
          href="/admin/apps"
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          subtitle="Across all apps"
          icon={Users}
          href="/admin/users"
        />
        <StatCard
          title="Jobs Today"
          value={stats.jobsToday}
          subtitle={`${stats.succeededToday} succeeded, ${stats.failedToday} failed`}
          icon={Zap}
          trend={stats.jobsToday > 0 ? "up" : "neutral"}
          href="/admin/jobs"
        />
        <StatCard
          title="Queue"
          value={stats.queuedJobs}
          subtitle="Jobs waiting"
          icon={Clock}
        />
      </div>

      {/* Secondary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'linear-gradient(145deg, rgba(24, 24, 27, 0.9) 0%, rgba(15, 15, 17, 0.95) 100%)',
          border: '1px solid rgba(63, 63, 70, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(0, 240, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity style={{ width: '20px', height: '20px', color: '#00f0ff' }} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#e4e4e7' }}>This Week</h3>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#fafafa', letterSpacing: '-0.02em' }}>
            {stats.jobsThisWeek.toLocaleString()}
          </div>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '6px' }}>total generations</p>
        </div>

        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'linear-gradient(145deg, rgba(24, 24, 27, 0.9) 0%, rgba(15, 15, 17, 0.95) 100%)',
          border: '1px solid rgba(63, 63, 70, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(0, 240, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle style={{ width: '20px', height: '20px', color: '#00f0ff' }} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#e4e4e7' }}>Success Rate</h3>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#fafafa', letterSpacing: '-0.02em' }}>
            {stats.jobsToday > 0
              ? Math.round((stats.succeededToday / stats.jobsToday) * 100)
              : 100}%
          </div>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '6px' }}>today&apos;s jobs</p>
        </div>

        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'linear-gradient(145deg, rgba(24, 24, 27, 0.9) 0%, rgba(15, 15, 17, 0.95) 100%)',
          border: '1px solid rgba(63, 63, 70, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <XCircle style={{ width: '20px', height: '20px', color: '#f87171' }} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#e4e4e7' }}>Failed Today</h3>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#fafafa', letterSpacing: '-0.02em' }}>
            {stats.failedToday}
          </div>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '6px' }}>jobs failed</p>
        </div>
      </div>

      {/* Recent Jobs */}
      <div style={{
        borderRadius: '16px',
        background: 'linear-gradient(145deg, rgba(24, 24, 27, 0.9) 0%, rgba(15, 15, 17, 0.95) 100%)',
        border: '1px solid rgba(63, 63, 70, 0.4)',
        overflow: 'hidden'
      }}>
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: '1px solid rgba(63, 63, 70, 0.3)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#e4e4e7' }}>Recent Jobs</h3>
          <Link 
            href="/admin/jobs" 
            style={{ 
              fontSize: '14px', 
              color: '#9ca3af', 
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            View all
            <ArrowUpRight style={{ width: '14px', height: '14px' }} />
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(63, 63, 70, 0.3)' }}>
                <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job ID</th>
                <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>App</th>
                <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</th>
                <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentJobs.map((job, index) => (
                <tr 
                  key={job.id} 
                  style={{ 
                    borderBottom: index < stats.recentJobs.length - 1 ? '1px solid rgba(63, 63, 70, 0.2)' : 'none'
                  }}
                >
                  <td style={{ padding: '16px 24px' }}>
                    <code style={{ 
                      fontSize: '13px', 
                      color: '#b8b8c8', 
                      background: 'rgba(39, 39, 42, 0.5)', 
                      padding: '4px 10px', 
                      borderRadius: '6px',
                      fontFamily: 'ui-monospace, monospace'
                    }}>
                      {job.id.slice(0, 12)}...
                    </code>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: '#d4d4d8', fontWeight: '500' }}>{job.app.name}</td>
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: '#b8b8c8' }}>{job.aiModel.name}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <StatusBadge status={job.status} />
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: '#9ca3af' }}>
                    {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
              {stats.recentJobs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ color: '#9ca3af' }}>
                      <Activity style={{ width: '32px', height: '32px', margin: '0 auto 12px', opacity: 0.5 }} />
                      <p style={{ fontSize: '15px' }}>No jobs yet</p>
                      <p style={{ fontSize: '13px', marginTop: '4px' }}>Jobs will appear here when iOS apps start generating</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
