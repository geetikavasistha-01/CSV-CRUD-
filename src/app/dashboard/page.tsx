import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function AuthRedirector() {
  const router = useRouter();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        router.push("/dashboard");
      }
    });
    return () => listener?.unsubscribe();
  }, [router]);

  return null;
} 