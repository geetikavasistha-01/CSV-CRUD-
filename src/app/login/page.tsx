"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState("");

  // Redirect to dashboard after successful login (including Google OAuth)
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        router.push("/dashboard");
      }
    });
    return () => listener?.subscription?.unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
  };

  // Google OAuth sign-in handler
  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    setOauthError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: typeof window !== 'undefined' ? window.location.origin + '/dashboard' : undefined }
      });
      if (error) setOauthError(error.message);
    } catch (err: any) {
      setOauthError(err.message || "Google sign-in failed");
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <form
        onSubmit={handleLogin}
        className="bg-card p-8 rounded shadow-md w-full max-w-sm space-y-6 border border-border"
      >
        <h1 className="text-3xl font-bold text-center">Login</h1>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2 border border-border bg-background hover:bg-muted text-foreground rounded py-2 font-semibold transition disabled:opacity-60"
          disabled={oauthLoading || loading}
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
          {oauthLoading ? "Redirecting..." : "Continue with Google"}
        </button>
        {oauthError && <div className="text-destructive text-sm text-center">{oauthError}</div>}
        <div>
          <label className="block mb-1 text-sm font-medium text-foreground">Email</label>
          <input
            type="email"
            className="w-full border border-border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-semibold placeholder-muted-foreground bg-background"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="Enter your email"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-foreground">Password</label>
          <input
            type="password"
            className="w-full border border-border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-semibold placeholder-muted-foreground bg-background"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
          />
        </div>
        {error && <div className="text-destructive text-sm text-center">{error}</div>}
        <button
          type="submit"
          className="w-full bg-primary text-primary-foreground py-2 rounded font-semibold hover:bg-primary/90 transition"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        <div className="text-center text-sm">
          Don&apos;t have an account? <a href="/signup" className="text-primary hover:underline font-semibold">Sign up</a>
        </div>
      </form>
    </div>
  );
} 