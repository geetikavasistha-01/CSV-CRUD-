"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="text-lg text-gray-500">Redirecting to login...</span>
    </div>
  );
}
