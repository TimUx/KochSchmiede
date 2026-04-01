"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("ks_token");
    if (token) {
      setReady(true);
      return;
    }

    // No token – check whether the site requires login
    fetch(`${API}/api/settings/public`)
      .then((res) => {
        if (!res.ok) throw new Error("settings unavailable");
        return res.json();
      })
      .then((settings) => {
        if (settings.site_mode === "private") {
          router.replace("/login");
        } else {
          setReady(true);
        }
      })
      .catch(() => {
        // If settings cannot be fetched (network error or server down), show
        // the content optimistically and let the page-level 401 handler
        // redirect to login if the backend rejects the request.
        setReady(true);
      });
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#1e1e2e]">
        <Loader2 size={32} className="animate-spin text-amber-500" />
      </div>
    );
  }

  return <>{children}</>;
}
