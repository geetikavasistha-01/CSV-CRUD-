"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);

  // Redirect to dashboard after successful signup (including Google OAuth)
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        router.push("/dashboard");
      }
    });
    return () => listener?.subscription?.unsubscribe();
  }, [router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDebug("");
    console.log("[DEBUG] Signup handler called", { email, password });
    const { error, data } = await supabase.auth.signUp({ email, password });
    console.log("[DEBUG] Supabase signup result", { error, data });
    setDebug(JSON.stringify({ error, data }, null, 2));
    setLoading(false);
    if (error) {
      setError(error.message);
      console.log("[DEBUG] Signup error", error.message);
    } else if (!data.session) {
      setError("Check your email to confirm your account before logging in.");
      console.log("[DEBUG] No session after signup");
    } else {
      console.log("[DEBUG] Signup success, redirecting");
      router.push("/dashboard");
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    });
    if (error) setError(error.message);
    setOauthLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <form
        onSubmit={handleSignup}
        className="bg-card p-8 rounded shadow-md w-full max-w-sm space-y-6 border border-border"
      >
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2 bg-white text-black border border-border py-2 rounded font-semibold shadow hover:bg-gray-100 transition disabled:opacity-60 mb-4"
          disabled={oauthLoading || loading}
        >
          <svg width="20" height="20" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.7 33.1 29.8 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c2.7 0 5.2.9 7.2 2.5l6.4-6.4C33.5 5.5 28.1 3 22 3 11.5 3 3 11.5 3 22s8.5 19 19 19c9.5 0 18-7.5 18-19 0-1.3-.1-2.7-.5-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 17 19.2 14 24 14c2.7 0 5.2.9 7.2 2.5l6.4-6.4C33.5 5.5 28.1 3 22 3c-7.2 0-13.3 4.2-16.3 10.7z"/><path fill="#FBBC05" d="M24 44c5.8 0 10.7-2.1 14.2-5.7l-6.6-5.4C29.8 36 24 36 24 36c-5.8 0-10.7-2.1-14.2-5.7l6.6-5.4C18.2 30.9 21.1 32 24 32c2.7 0 5.2-.9 7.2-2.5l6.4 6.4C33.5 42.5 28.1 44 22 44z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.7C34.7 33.1 29.8 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c2.7 0 5.2.9 7.2 2.5l6.4-6.4C33.5 5.5 28.1 3 22 3 11.5 3 3 11.5 3 22s8.5 19 19 19c9.5 0 18-7.5 18-19 0-1.3-.1-2.7-.5-4z"/></g></svg>
          {oauthLoading ? "Redirecting..." : "Continue with Google"}
        </button>
        <h1 className="text-3xl font-bold text-center">Sign Up</h1>
        <div>
          <label className="block mb-1 text-sm font-medium text-foreground">Email</label>
          <input
            type="email"
            className="w-full border border-border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-semibold placeholder-muted-foreground bg-background"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
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
            autoComplete="new-password"
          />
        </div>
        {error && <div className="text-destructive text-sm text-center">{error}</div>}
        {debug && <pre className="text-xs text-muted-foreground bg-muted p-2 rounded mt-2 overflow-x-auto">{debug}</pre>}
        <button
          type="submit"
          className="w-full bg-primary text-primary-foreground py-2 rounded font-semibold hover:bg-primary/90 transition"
          disabled={loading}
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>
        <div className="text-center text-sm">
          Already have an account? <a href="/login" className="text-primary hover:underline font-semibold">Login</a>
        </div>
      </form>
    </div>
  );
}