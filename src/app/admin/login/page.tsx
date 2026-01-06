"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Zap, Mail, ArrowRight, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      } else {
        // Redirect to verify page
        window.location.href = "/admin/verify";
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
        {/* Card */}
        <div className="card p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg glow-emerald">
              <Zap className="w-7 h-7 text-zinc-950" />
            </div>
          </div>
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-zinc-100 mb-2">
              AI Backend Hub
            </h1>
            <p className="text-zinc-500 text-sm">
              Sign in to access the admin panel
            </p>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="input pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={isLoading || !email}
              className="btn btn-primary w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending magic link...
                </>
              ) : (
                <>
                  Continue with magic link
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          
          <p className="mt-6 text-center text-xs text-zinc-600">
            We&apos;ll send you a magic link to sign in securely
          </p>
        </div>
        
        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-600">
          Only authorized administrators can access this panel
        </p>
      </div>
    </div>
  );
}




