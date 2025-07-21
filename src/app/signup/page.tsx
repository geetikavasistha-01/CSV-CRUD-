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
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <form
        onSubmit={handleSignup}
        className="bg-card p-8 rounded shadow-md w-full max-w-sm space-y-6 border border-border"
      >
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