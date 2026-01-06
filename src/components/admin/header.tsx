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
        borderBottom: '1px solid rgba(39, 39, 42, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'rgba(9, 9, 11, 0.8)',
        backdropFilter: 'blur(12px)',
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
              color: '#52525b' 
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
              background: 'rgba(39, 39, 42, 0.4)',
              border: '1px solid rgba(63, 63, 70, 0.4)',
              fontSize: '14px',
              color: '#d4d4d8',
              outline: 'none'
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
            borderLeft: '1px solid rgba(63, 63, 70, 0.4)'
          }}
        >
          <div 
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3f3f46 0%, #27272a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: '600',
              color: '#d4d4d8'
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
              fontWeight: '500',
              color: '#71717a',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
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
