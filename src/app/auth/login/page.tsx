"use client";

import { useState } from "react";
import { getCsrfToken, signIn } from "next-auth/react";
import { Zap, Mail, ArrowRight, Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function AdminLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    getCsrfToken().then((token) => setCsrfToken(token || ""));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    
    if (!email || isLoading) return;
    
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/admin",
      });

      if (result?.error) {
        setError("Unable to send magic link. Make sure you're an authorized admin.");
        setIsLoading(false);
      } else {
        window.location.href = "/auth/verify";
      }
    } catch (err) {
      console.error("SignIn exception:", err);
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-8"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16, 185, 129, 0.08), transparent),
          radial-gradient(ellipse 60% 40% at 80% 100%, rgba(99, 102, 241, 0.05), transparent),
          radial-gradient(rgba(39, 39, 42, 0.3) 1px, transparent 1px),
          #09090b
        `,
        backgroundSize: '100% 100%, 100% 100%, 24px 24px, 100% 100%'
      }}
    >
      <div className="w-full" style={{ maxWidth: '440px' }}>
        {/* Card */}
        <div 
          className="rounded-3xl"
          style={{
            background: 'linear-gradient(145deg, rgba(24, 24, 27, 0.97) 0%, rgba(12, 12, 14, 0.99) 100%)',
            border: '1px solid rgba(63, 63, 70, 0.4)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            padding: '48px'
          }}
        >
          {/* Logo */}
          <div className="flex justify-center" style={{ marginBottom: '40px' }}>
            <div 
              className="rounded-2xl flex items-center justify-center"
              style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 0 40px rgba(16, 185, 129, 0.4), 0 12px 40px rgba(0, 0, 0, 0.4)'
              }}
            >
              <Zap style={{ width: '40px', height: '40px', color: '#09090b' }} strokeWidth={2.5} />
            </div>
          </div>
          
          {/* Header */}
          <div className="text-center" style={{ marginBottom: '40px' }}>
            <h1 style={{ 
              fontSize: '28px', 
              fontWeight: '700', 
              color: '#fafafa', 
              marginBottom: '12px',
              letterSpacing: '-0.02em'
            }}>
              AI Backend Hub
            </h1>
            <p style={{ fontSize: '16px', color: '#a1a1aa' }}>
              Sign in to access the admin panel
            </p>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} method="post">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <input type="hidden" name="callbackUrl" value="/admin" />
            
            <div style={{ marginBottom: '24px' }}>
              <label 
                htmlFor="email" 
                style={{ 
                  display: 'block',
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#d4d4d8',
                  marginBottom: '12px'
                }}
              >
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <div 
                  style={{ 
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                  }}
                >
                  <Mail style={{ width: '20px', height: '20px', color: '#71717a' }} />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@example.com"
                  style={{
                    width: '100%',
                    height: '56px',
                    paddingLeft: '52px',
                    paddingRight: '16px',
                    borderRadius: '14px',
                    fontSize: '16px',
                    color: '#fafafa',
                    background: 'rgba(39, 39, 42, 0.5)',
                    border: '2px solid rgba(63, 63, 70, 0.5)',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>
            
            {error && (
              <div 
                style={{
                  marginBottom: '24px',
                  padding: '16px',
                  borderRadius: '14px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  color: '#fca5a5',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)'
                }}
              >
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                height: '56px',
                borderRadius: '14px',
                fontSize: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                background: isLoading 
                  ? 'rgba(16, 185, 129, 0.4)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#09090b',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: isLoading 
                  ? 'none' 
                  : '0 4px 20px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 style={{ width: '20px', height: '20px' }} className="animate-spin" />
                  <span>Sending magic link...</span>
                </>
              ) : (
                <>
                  <span>Continue with magic link</span>
                  <ArrowRight style={{ width: '20px', height: '20px' }} />
                </>
              )}
            </button>
          </form>
          
          <p style={{ 
            marginTop: '32px', 
            textAlign: 'center', 
            fontSize: '14px', 
            color: '#71717a' 
          }}>
            We&apos;ll send you a magic link to sign in securely
          </p>
        </div>
        
        {/* Footer */}
        <p style={{ 
          marginTop: '32px', 
          textAlign: 'center', 
          fontSize: '14px', 
          color: '#52525b' 
        }}>
          Only authorized administrators can access this panel
        </p>
      </div>
    </div>
  );
}
