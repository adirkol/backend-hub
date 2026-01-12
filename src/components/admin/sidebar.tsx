"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  AppWindow,
  Layers,
  Server,
  Activity,
  Users,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Zap,
  HeartPulse,
  BookOpen,
  Shield,
} from "lucide-react";

interface User {
  name?: string | null;
  email: string;
}

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/apps", label: "Apps", icon: AppWindow },
  { href: "/admin/models", label: "AI Models", icon: Layers },
  { href: "/admin/providers", label: "Providers", icon: Server },
  { href: "/admin/healthcheck", label: "Healthcheck", icon: HeartPulse },
  { href: "/admin/jobs", label: "Jobs", icon: Activity },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: Shield },
  { href: "/admin/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/admin/docs", label: "Documentation", icon: BookOpen },
];

export function AdminSidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <aside 
      style={{
        width: collapsed ? '72px' : '260px',
        height: '100vh',
        flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(12, 12, 18, 0.98) 0%, rgba(8, 8, 12, 0.99) 100%)',
        borderRight: '1px solid rgba(60, 60, 80, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        zIndex: 40,
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Logo */}
      <div 
        style={{
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid rgba(60, 60, 80, 0.25)',
          padding: collapsed ? '0 16px' : '0 20px',
          justifyContent: collapsed ? 'center' : 'flex-start'
        }}
      >
        <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '14px', textDecoration: 'none' }}>
          <div 
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #00f0ff 0%, #00b8cc 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 16px rgba(0, 240, 255, 0.4), 0 0 20px rgba(0, 240, 255, 0.2)'
            }}
          >
            <Zap style={{ width: '22px', height: '22px', color: '#000' }} />
          </div>
          {!collapsed && (
            <span style={{ 
              fontSize: '18px', 
              fontWeight: '700', 
              color: '#fafafa', 
              letterSpacing: '-0.01em'
            }}>
              AI Hub
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: collapsed ? '12px' : '12px 16px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: active ? '600' : '500',
                    textDecoration: 'none',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    color: active ? '#00f0ff' : '#b0b0c0',
                    background: active 
                      ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.12) 0%, rgba(0, 240, 255, 0.04) 100%)'
                      : 'transparent',
                    border: active ? '1px solid rgba(0, 240, 255, 0.25)' : '1px solid transparent',
                    boxShadow: active ? '0 0 20px rgba(0, 240, 255, 0.1)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon style={{ 
                    width: '20px', 
                    height: '20px', 
                    flexShrink: 0,
                    color: active ? '#00f0ff' : '#b0b0c0',
                    filter: active ? 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.5))' : 'none'
                  }} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div style={{ borderTop: '1px solid rgba(60, 60, 80, 0.25)', padding: '16px 12px' }}>
        {!collapsed && (
          <div style={{ padding: '8px 12px', marginBottom: '8px' }}>
            <p style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#e0e0e8', 
              marginBottom: '2px', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap' 
            }}>
              {user.name || "Admin"}
            </p>
            <p style={{ 
              fontSize: '12px', 
              color: '#9090a8', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap' 
            }}>
              {user.email}
            </p>
          </div>
        )}
        
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '10px',
            fontSize: '14px',
            color: '#6868a0',
            background: 'transparent',
            border: '1px solid transparent',
            cursor: 'pointer',
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 240, 255, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.2)';
            e.currentTarget.style.color = '#00f0ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.color = '#9090a8';
          }}
        >
          {collapsed ? (
            <ChevronRight style={{ width: '18px', height: '18px' }} />
          ) : (
            <>
              <ChevronLeft style={{ width: '18px', height: '18px' }} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
