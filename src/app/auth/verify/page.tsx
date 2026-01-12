import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function VerifyPage() {
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-8"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 240, 255, 0.06), transparent),
          radial-gradient(ellipse 60% 40% at 80% 100%, rgba(99, 102, 241, 0.05), transparent),
          radial-gradient(rgba(39, 39, 42, 0.3) 1px, transparent 1px),
          #09090b
        `,
        backgroundSize: '100% 100%, 100% 100%, 24px 24px, 100% 100%'
      }}
    >
      <div className="w-full" style={{ maxWidth: '440px' }}>
        <div 
          className="rounded-3xl text-center"
          style={{
            background: 'linear-gradient(145deg, rgba(24, 24, 27, 0.97) 0%, rgba(12, 12, 14, 0.99) 100%)',
            border: '1px solid rgba(63, 63, 70, 0.4)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            padding: '48px'
          }}
        >
          {/* Icon */}
          <div className="flex justify-center" style={{ marginBottom: '32px' }}>
            <div 
              className="rounded-2xl flex items-center justify-center"
              style={{
                width: '88px',
                height: '88px',
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.15) 0%, rgba(0, 240, 255, 0.05) 100%)',
                border: '1px solid rgba(0, 240, 255, 0.25)'
              }}
            >
              <Mail style={{ width: '44px', height: '44px', color: '#00f0ff' }} strokeWidth={1.5} />
            </div>
          </div>
          
          {/* Content */}
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: '#fafafa', 
            marginBottom: '16px',
            letterSpacing: '-0.02em'
          }}>
            Check your email
          </h1>
          <p style={{ fontSize: '16px', color: '#d4d4d8', marginBottom: '8px' }}>
            We sent a magic link to your email address.
          </p>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '40px' }}>
            Click the link in the email to sign in to your account.
          </p>
          
          {/* Tips */}
          <div 
            style={{
              padding: '20px',
              borderRadius: '14px',
              background: 'rgba(39, 39, 42, 0.4)',
              border: '1px solid rgba(63, 63, 70, 0.4)',
              marginBottom: '32px',
              textAlign: 'left'
            }}
          >
            <p style={{ fontSize: '14px', color: '#b8b8c8', lineHeight: '1.6' }}>
              <span style={{ color: '#e4e4e7', fontWeight: '500' }}>Didn&apos;t receive it?</span>
              {" "}Check your spam folder or try again in a few minutes.
            </p>
          </div>
          
          {/* Back link */}
          <Link 
            href="/auth/login"
            className="inline-flex items-center justify-center gap-2 transition-all"
            style={{
              height: '48px',
              padding: '0 24px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '500',
              color: '#b8b8c8',
              background: 'transparent',
              border: 'none'
            }}
          >
            <ArrowLeft style={{ width: '18px', height: '18px' }} />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
