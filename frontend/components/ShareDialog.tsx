"use client";

import { useState, useEffect } from "react";
import { Share2, Copy, Check, X, Lock, Trash2, AlertCircle, Eye, EyeOff } from "lucide-react";

interface ShareInfo {
  id: string;
  recipe_id: string;
  token: string;
  has_password: boolean;
  created_at: string;
}

interface ShareDialogProps {
  recipeId: string;
  recipeTitle: string;
  open: boolean;
  onClose: () => void;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("ks_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

export default function ShareDialog({ recipeId, recipeTitle, open, onClose }: ShareDialogProps) {
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState(false);

  // Build the public share URL
  const shareUrl =
    share && typeof window !== "undefined"
      ? `${window.location.origin}/recipes/share/${share.token}`
      : null;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    apiFetch(`/api/recipes/${recipeId}/share`)
      .then((data) => setShare(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, recipeId]);

  async function createShare() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/recipes/${recipeId}/share`, {
        method: "POST",
        body: JSON.stringify({ password: password || null }),
      });
      setShare(data);
      setPassword("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function removeShare() {
    if (!confirm("Share-Link wirklich löschen?")) return;
    setLoading(true);
    try {
      await apiFetch(`/api/recipes/${recipeId}/share`, { method: "DELETE" });
      setShare(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-amber-500" />
            <span className="font-semibold text-sm">Rezept teilen</span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-1">
            „{recipeTitle}"
          </p>

          {error && (
            <div className="mb-3 flex items-center gap-2 text-red-500 text-xs bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="text-center py-6 text-zinc-400 text-sm">Lade…</div>
          )}

          {!loading && !share && (
            /* Create share form */
            <div className="space-y-3">
              <p className="text-sm">Noch kein Share-Link. Jetzt erstellen:</p>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort (optional)"
                  type={showPw ? "text" : "password"}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                onClick={createShare}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl text-sm font-medium transition"
              >
                Share-Link erstellen
              </button>
            </div>
          )}

          {!loading && share && (
            /* Existing share */
            <div className="space-y-3">
              {share.has_password && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
                  <Lock size={12} />
                  <span>Passwortgeschützt</span>
                </div>
              )}

              {/* Share URL */}
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareUrl ?? ""}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-600 dark:text-zinc-300 focus:outline-none truncate"
                />
                <button
                  onClick={copyToClipboard}
                  className={`shrink-0 px-3 rounded-xl transition ${
                    copied
                      ? "bg-green-500 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <div className="flex gap-2">
                {/* Regenerate with new password */}
                <button
                  onClick={() => setShare(null)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-zinc-200 dark:border-zinc-700 py-2.5 rounded-xl text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  <Share2 size={13} />
                  Neu erstellen
                </button>
                <button
                  onClick={removeShare}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition"
                >
                  <Trash2 size={13} />
                  Löschen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
