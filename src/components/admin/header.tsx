"use client";

import { signOut } from "next-auth/react";
import { LogOut, Search } from "lucide-react";

interface User {
  name?: string | null;
  email: string;
}

export function AdminHeader({ user }: { user: User }) {
  return (
    <header 
      style={{
        height: '72px',
        borderBottom: '1px solid rgba(60, 60, 80, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'rgba(10, 10, 14, 0.85)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 30
      }}
    >
      {/* Search */}
      <div style={{ flex: 1, maxWidth: '400px' }}>
        <div style={{ position: 'relative' }}>
          <Search 
            style={{ 
              position: 'absolute', 
              left: '14px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              width: '18px', 
              height: '18px', 
              color: '#5555a0' 
            }} 
          />
          <input
            type="text"
            placeholder="Search..."
            style={{
              width: '100%',
              height: '44px',
              paddingLeft: '44px',
              paddingRight: '16px',
              borderRadius: '10px',
              background: 'rgba(20, 20, 30, 0.6)',
              border: '1px solid rgba(60, 60, 80, 0.4)',
              fontSize: '14px',
              color: '#d4d4e8',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.5)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 240, 255, 0.1), 0 0 20px rgba(0, 240, 255, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(60, 60, 80, 0.4)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* User info */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            paddingLeft: '16px',
            borderLeft: '1px solid rgba(60, 60, 80, 0.3)'
          }}
        >
          <div 
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(170, 85, 255, 0.2) 100%)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: '700',
              color: '#00f0ff'
            }}
          >
            {(user.name || user.email)[0].toUpperCase()}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#b0b0c0',
              background: 'transparent',
              border: '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 51, 85, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 51, 85, 0.3)';
              e.currentTarget.style.color = '#ff3355';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.color = '#8888a0';
            }}
          >
            <LogOut style={{ width: '18px', height: '18px' }} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
