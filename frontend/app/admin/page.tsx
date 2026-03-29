"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";
import {
  Shield,
  Users,
  Globe,
  Lock,
  UserPlus,
  Trash2,
  Crown,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  Plus,
  Scale,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SiteSettings {
  site_mode: "public" | "private";
  registration_mode: "open" | "admin_only";
  ssrf_protection: boolean;
}

interface UserRecord {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

interface UnitRecord {
  id: string;
  name: string;
  position: number;
}

// ─── API helpers (read token from localStorage) ───────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("ks_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(err.detail ?? "Request failed", res.status);
  }
  return res.status === 204 ? null : res.json();
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 ${
        checked ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-600"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [units, setUnits] = useState<UnitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "users" | "units">("settings");

  // New user form
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // New unit form
  const [newUnitName, setNewUnitName] = useState("");
  const [unitError, setUnitError] = useState<string | null>(null);
  const [addingUnit, setAddingUnit] = useState(false);

  const load = useCallback(async () => {
    if (!localStorage.getItem("ks_token")) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [s, u, un] = await Promise.all([
        apiFetch("/api/admin/settings"),
        apiFetch("/api/admin/users"),
        apiFetch("/api/admin/units"),
      ]);
      setSettings(s);
      setUsers(u);
      setUnits(un);
    } catch (e: unknown) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        // Token is invalid, expired, or user lost admin rights – clear it and go to login
        localStorage.removeItem("ks_token");
        router.replace("/login");
      } else {
        setError(e instanceof Error ? e.message : "Fehler beim Laden");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSetting(patch: Partial<SiteSettings>) {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const updated = await apiFetch("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      setSettings(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSavingSettings(false);
    }
  }

  async function createUser() {
    setUserError(null);
    if (!newUsername || !newEmail || !newPassword) {
      setUserError("Alle Felder ausfüllen");
      return;
    }
    setCreatingUser(true);
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ username: newUsername, email: newEmail, password: newPassword }),
      });
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setShowNewUser(false);
      await load();
    } catch (e: unknown) {
      setUserError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setCreatingUser(false);
    }
  }

  async function toggleAdmin(userId: string) {
    try {
      await apiFetch(`/api/admin/users/${userId}/toggle-admin`, { method: "PATCH" });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function deleteUser(userId: string, username: string) {
    if (!confirm(`Benutzer „${username}" wirklich löschen?`)) return;
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function addUnit() {
    setUnitError(null);
    const name = newUnitName.trim();
    if (!name) { setUnitError("Name darf nicht leer sein"); return; }
    setAddingUnit(true);
    try {
      await apiFetch("/api/admin/units", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewUnitName("");
      await load();
    } catch (e: unknown) {
      setUnitError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setAddingUnit(false);
    }
  }

  async function deleteUnit(unitId: string, unitName: string) {
    if (!confirm(`Einheit „${unitName}" wirklich löschen?`)) return;
    try {
      await apiFetch(`/api/admin/units/${unitId}`, { method: "DELETE" });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#1e1e2e]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/settings" className="text-zinc-500 dark:text-zinc-400">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Admin-Bereich</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Webseiteneinstellungen und Benutzerverwaltung
            </p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-2xl p-3 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["settings", "users", "units"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-amber-500 text-white"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {tab === "settings" ? "Einstellungen" : tab === "users" ? `Benutzer (${users.length})` : `Einheiten (${units.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-zinc-400">Lade…</div>
        ) : (
          <>
            {/* ── SETTINGS TAB ── */}
            {activeTab === "settings" && settings && (
              <div className="space-y-4">
                {/* Site visibility */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                      <Globe size={16} className="text-amber-500" />
                      Sichtbarkeit der Seite
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {(
                      [
                        {
                          value: "private" as const,
                          label: "Privat",
                          desc: "Nur angemeldete Benutzer oder Share-Links mit Passwort",
                          icon: Lock,
                        },
                        {
                          value: "public" as const,
                          label: "Öffentlich",
                          desc: "Alle Rezepte ohne Anmeldung sichtbar",
                          icon: Globe,
                        },
                      ] as const
                    ).map(({ value, label, desc, icon: Icon }) => (
                      <button
                        key={value}
                        disabled={savingSettings}
                        onClick={() => saveSetting({ site_mode: value })}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition text-left ${
                          settings.site_mode === value
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                        }`}
                      >
                        <Icon
                          size={18}
                          className={
                            settings.site_mode === value
                              ? "text-amber-500"
                              : "text-zinc-400"
                          }
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{label}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</div>
                        </div>
                        {settings.site_mode === value && (
                          <Check size={16} className="text-amber-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Registration mode */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                      <Users size={16} className="text-amber-500" />
                      Benutzerregistrierung
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {(
                      [
                        {
                          value: "open" as const,
                          label: "Offen",
                          desc: "Jeder kann sich selbst registrieren",
                        },
                        {
                          value: "admin_only" as const,
                          label: "Nur Admins",
                          desc: "Neue Konten nur durch Admins anlegbar",
                        },
                      ] as const
                    ).map(({ value, label, desc }) => (
                      <button
                        key={value}
                        disabled={savingSettings}
                        onClick={() => saveSetting({ registration_mode: value })}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition text-left ${
                          settings.registration_mode === value
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{label}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</div>
                        </div>
                        {settings.registration_mode === value && (
                          <Check size={16} className="text-amber-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SSRF Protection */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-4 px-4 py-4">
                    <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Shield size={18} className="text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">SSRF-Schutz (URL-Import)</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {settings.ssrf_protection
                          ? "Aktiv – private IP-Adressen werden blockiert"
                          : "Deaktiviert – Importe von lokalen Netzwerkadressen erlaubt (Heimserver)"}
                      </div>
                    </div>
                    <Toggle
                      checked={settings.ssrf_protection}
                      onChange={(v) => saveSetting({ ssrf_protection: v })}
                      disabled={savingSettings}
                    />
                  </div>
                  {!settings.ssrf_protection && (
                    <div className="mx-4 mb-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl p-3 text-xs">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <span>
                        <strong>Hinweis:</strong> Nur deaktivieren, wenn KochSchmiede auf einem
                        privaten Heimserver läuft und nicht öffentlich erreichbar ist.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── USERS TAB ── */}
            {activeTab === "users" && (
              <div>
                <button
                  onClick={() => setShowNewUser(!showNewUser)}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-2xl font-medium text-sm mb-4 transition"
                >
                  <UserPlus size={18} />
                  Neuen Benutzer anlegen
                </button>

                {/* New user form */}
                {showNewUser && (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 mb-4 space-y-3">
                    {userError && (
                      <p className="text-red-500 text-xs flex items-center gap-1">
                        <AlertCircle size={12} /> {userError}
                      </p>
                    )}
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Benutzername"
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="E-Mail"
                      type="email"
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <div className="relative">
                      <input
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Passwort"
                        type={showNewPw ? "text" : "password"}
                        className="w-full px-3 py-2.5 pr-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                      >
                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={createUser}
                        disabled={creatingUser}
                        className="flex-1 bg-amber-500 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                      >
                        {creatingUser ? "Erstelle…" : "Erstellen"}
                      </button>
                      <button
                        onClick={() => { setShowNewUser(false); setUserError(null); }}
                        className="px-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}

                {/* User list */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                  {users.length === 0 ? (
                    <div className="p-6 text-center text-zinc-400 text-sm">Keine Benutzer</div>
                  ) : (
                    users.map((user, i) => (
                      <div
                        key={user.id}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          i !== users.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 font-semibold text-sm shrink-0">
                          {user.username[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-1.5">
                            {user.username}
                            {user.is_admin && (
                              <Crown size={12} className="text-amber-500 shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            {user.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleAdmin(user.id)}
                            title={user.is_admin ? "Admin entziehen" : "Admin ernennen"}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-500 transition"
                          >
                            <Crown size={15} />
                          </button>
                          <button
                            onClick={() => deleteUser(user.id, user.username)}
                            title="Benutzer löschen"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 transition"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            {/* ── UNITS TAB ── */}
            {activeTab === "units" && (
              <div className="space-y-4">
                {/* Add unit form */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                  <h2 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <Scale size={16} className="text-amber-500" />
                    Neue Einheit hinzufügen
                  </h2>
                  {unitError && (
                    <p className="text-red-500 text-xs flex items-center gap-1 mb-2">
                      <AlertCircle size={12} /> {unitError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addUnit()}
                      placeholder="z.B. Tüte, Schuss, Zehe"
                      className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      onClick={addUnit}
                      disabled={addingUnit}
                      className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition"
                    >
                      <Plus size={16} />
                      {addingUnit ? "…" : "Hinzufügen"}
                    </button>
                  </div>
                </div>

                {/* Unit list */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                  {units.length === 0 ? (
                    <div className="p-6 text-center text-zinc-400 text-sm">Keine Einheiten vorhanden</div>
                  ) : (
                    units.map((unit, i) => (
                      <div
                        key={unit.id}
                        className={`flex items-center justify-between px-4 py-3 ${
                          i !== units.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""
                        }`}
                      >
                        <span className="text-sm font-medium">{unit.name}</span>
                        <button
                          onClick={() => deleteUnit(unit.id, unit.name)}
                          title="Einheit löschen"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
