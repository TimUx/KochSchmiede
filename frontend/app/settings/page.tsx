"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";
import WakeLockToggle from "@/components/WakeLockToggle";
import Link from "next/link";
import {
  User,
  Lock,
  Info,
  ChevronRight,
  Globe,
  Palette,
  Download,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  X,
  MonitorCheck,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
}

const LANGUAGES = [
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("ks_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API}${path}`, { ...options, headers }).then(async (res) => {
    if (!res.ok) {
      const e = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(e.detail ?? "Request failed");
    }
    return res.status === 204 ? null : res.json();
  });
}

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [language, setLanguage] = useState("de");

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ks_language");
    if (saved) setLanguage(saved);

    const token = localStorage.getItem("ks_token");
    if (token) {
      apiFetch("/api/auth/me")
        .then((data) => setProfile(data))
        .catch(() => {});
    }
  }, []);

  function selectLanguage(code: string) {
    setLanguage(code);
    localStorage.setItem("ks_language", code);
  }

  async function handlePasswordChange() {
    setPwError(null);
    if (!currentPw || !newPw || !confirmPw) {
      setPwError("Alle Felder ausfüllen");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("Passwörter stimmen nicht überein");
      return;
    }
    if (newPw.length < 8) {
      setPwError("Neues Passwort muss mindestens 8 Zeichen haben");
      return;
    }
    setPwSaving(true);
    try {
      await apiFetch("/api/auth/me/password", {
        method: "PATCH",
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      setPwSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => {
        setPwSuccess(false);
        setShowPasswordForm(false);
      }, 2000);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setPwSaving(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const token = localStorage.getItem("ks_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/recipes/`, { headers });
      if (!res.ok) throw new Error("Fehler beim Exportieren");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kochschmiede-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Fehler beim Exportieren");
    } finally {
      setExporting(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 dark:text-white";

  return (
    <AppShell>
      <main className="w-full px-4 py-6 pb-24 lg:pb-8">
        <h1 className="text-2xl font-bold mb-6">Einstellungen</h1>

        {/* Admin panel link – only shown for admins */}
        {profile?.is_admin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 w-full bg-amber-500 hover:bg-amber-600 text-white rounded-2xl px-4 py-3.5 mb-6 transition"
          >
            <ShieldCheck size={20} />
            <div className="flex-1">
              <div className="font-semibold text-sm">Admin-Bereich</div>
              <div className="text-xs text-amber-100">Sichtbarkeit, Registrierung, Benutzer</div>
            </div>
            <ChevronRight size={16} className="text-amber-200" />
          </Link>
        )}

        <div className="space-y-6">
          {/* ── Darstellung ── */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2 px-1">
              Darstellung
            </h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              {/* Theme toggle */}
              <div className="flex items-center gap-4 px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <Palette size={18} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Theme</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">Hell / Dunkel</div>
                </div>
                <ThemeToggle />
              </div>

              {/* Wake lock */}
              <div className="flex items-center gap-4 px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <MonitorCheck size={18} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Display wach halten</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Verhindert, dass sich das Display ausschaltet
                  </div>
                </div>
                <WakeLockToggle />
              </div>

              {/* Language */}
              <div className="px-4 py-3.5">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    <Globe size={18} className="text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Sprache</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Aktuell: {LANGUAGES.find((l) => l.code === language)?.label ?? language}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pl-13">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => selectLanguage(lang.code)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition ${
                        language === lang.code
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                          : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      {lang.label}
                      {language === lang.code && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Konto ── */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2 px-1">
              Konto
            </h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              {/* Profile info */}
              <div className="flex items-center gap-4 px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <User size={18} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {profile ? profile.username : "—"}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {profile ? profile.email : "Nicht angemeldet"}
                  </div>
                </div>
                {!profile && (
                  <button
                    onClick={() => router.push("/login")}
                    className="text-xs text-amber-500 font-medium"
                  >
                    Anmelden
                  </button>
                )}
              </div>

              {/* Password change */}
              <div className="px-4 py-3.5">
                <button
                  onClick={() => {
                    if (!profile) { router.push("/login"); return; }
                    setShowPasswordForm((v) => !v);
                    setPwError(null);
                  }}
                  className="flex items-center gap-4 w-full text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    <Lock size={18} className="text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Sicherheit</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Passwort ändern</div>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`text-zinc-400 transition-transform ${showPasswordForm ? "rotate-90" : ""}`}
                  />
                </button>

                {showPasswordForm && (
                  <div className="mt-3 space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    {pwError && (
                      <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl p-2.5 text-xs">
                        <AlertCircle size={14} />
                        <span>{pwError}</span>
                        <button onClick={() => setPwError(null)} className="ml-auto">
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    {pwSuccess && (
                      <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl p-2.5 text-xs">
                        <Check size={14} /> Passwort erfolgreich geändert
                      </div>
                    )}
                    <div className="relative">
                      <input
                        type={showCurrentPw ? "text" : "password"}
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        placeholder="Aktuelles Passwort"
                        className={`${inputCls} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                      >
                        {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showNewPw ? "text" : "password"}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder="Neues Passwort (min. 8 Zeichen)"
                        className={`${inputCls} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                      >
                        {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <input
                      type="password"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="Neues Passwort bestätigen"
                      className={inputCls}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handlePasswordChange}
                        disabled={pwSaving}
                        className="flex-1 flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white py-2 rounded-xl text-sm font-medium transition"
                      >
                        {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {pwSaving ? "Speichern…" : "Ändern"}
                      </button>
                      <button
                        onClick={() => { setShowPasswordForm(false); setPwError(null); }}
                        className="px-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm text-zinc-600 dark:text-zinc-300"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Daten ── */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2 px-1">
              Daten
            </h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-4 w-full px-4 py-3.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition disabled:opacity-60"
              >
                <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <Download size={18} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Export</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Alle Rezepte als JSON herunterladen
                  </div>
                </div>
                {exporting ? (
                  <Loader2 size={16} className="animate-spin text-zinc-400" />
                ) : (
                  <ChevronRight size={16} className="text-zinc-400" />
                )}
              </button>
            </div>
          </div>

          {/* ── Info ── */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2 px-1">
              Info
            </h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-4 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <Info size={18} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Über KochSchmiede</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Version 1.0.0 · Self-hosted Rezeptverwaltung
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
