"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { clearAuthSession } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkSiteAccess = () =>
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
          setReady(true);
        });

    const token = localStorage.getItem("ks_token");
    if (!token) {
      checkSiteAccess();
      return;
    }

    fetch(`${API}/api/auth/me`, { headers: { Authorization: "Bearer " + token } })
      .then((res) => {
        if (res.status === 401) {
          clearAuthSession();
          return checkSiteAccess();
        }
        setReady(true);
      })
      .catch(() => {
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
