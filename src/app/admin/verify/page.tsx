import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 pattern-dots">
      {/* Background gradient */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, oklch(0.35 0.15 162 / 0.15), transparent),
            radial-gradient(ellipse 60% 40% at 80% 100%, oklch(0.30 0.10 250 / 0.1), transparent)
          `
        }}
      />
      
      <div className="w-full max-w-md relative animate-fade-in">
        <div className="card p-8 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center border border-emerald-500/30">
              <Mail className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          
          {/* Content */}
          <h1 className="text-2xl font-bold text-zinc-100 mb-3">
            Check your email
          </h1>
          <p className="text-zinc-400 mb-2">
            We sent a magic link to your email address.
          </p>
          <p className="text-zinc-500 text-sm mb-8">
            Click the link in the email to sign in to your account.
          </p>
          
          {/* Tips */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 mb-6">
            <p className="text-sm text-zinc-400">
              <span className="text-zinc-300 font-medium">Didn&apos;t receive it?</span>
              {" "}Check your spam folder or try again in a few minutes.
            </p>
          </div>
          
          {/* Back link */}
          <Link 
            href="/admin/login"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

