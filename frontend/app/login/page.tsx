"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect already-authenticated users away from the login page
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("ks_token")) {
      router.replace("/");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body = new URLSearchParams({ username, password });
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Login fehlgeschlagen");
      }

      const { access_token } = await res.json();
      localStorage.setItem("ks_token", access_token);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-[#1e1e2e] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-6 shadow-sm">
          <h1 className="text-xl font-bold mb-6 text-center">Anmelden</h1>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Benutzername
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Passwort
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 dark:text-white"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 text-sm transition"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {loading ? "Wird angemeldet…" : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
