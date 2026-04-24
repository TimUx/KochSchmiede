"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Logo from "@/components/Logo";
import {
  fetchSetupStatus,
  loginForSetup,
  registerAdmin,
  saveInitialSettings,
} from "@/app/setup/api";
import { validateAdminStep } from "@/app/setup/validation";
import {
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Moon,
  Shield,
  Sun,
  User,
  Users,
} from "lucide-react";

// ─── Small helpers ────────────────────────────────────────────────────────────

function ErrorAlert({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-4">
      {msg}
    </div>
  );
}

function InputField({
  label,
  id,
  type,
  autoComplete,
  value,
  onChange,
  placeholder,
  rightSlot,
}: {
  label: string;
  id: string;
  type: string;
  autoComplete?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 dark:text-white pr-10"
        />
        {rightSlot && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);

  // Step 1 – admin account
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Step 2 – site settings
  const [siteMode, setSiteMode] = useState<"public" | "private">("private");
  const [registrationMode, setRegistrationMode] = useState<"open" | "admin_only">("open");

  // Step 3 – appearance & language
  const [language, setLanguage] = useState("de");

  // Async / error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const savedLang = localStorage.getItem("ks_language");
    if (savedLang) setLanguage(savedLang);

    // If already set up, go to login
    fetchSetupStatus()
      .then((data) => {
        if (!data.needs_setup) router.replace("/login");
      })
      .catch(() => {});
  }, [router]);

  // ── Validation ──────────────────────────────────────────────────────────────

  function next() {
    setStepError(null);
    if (step === 1) {
      const err = validateAdminStep({ username, email, password, confirmPassword });
      if (err) {
        setStepError(err);
        return;
      }
    }
    setStep((s) => s + 1);
  }

  function back() {
    setStepError(null);
    setError(null);
    setStep((s) => s - 1);
  }

  // ── Complete ────────────────────────────────────────────────────────────────

  async function complete() {
    setStepError(null);
    setError(null);
    setLoading(true);
    try {
      await registerAdmin({
        username: username.trim(),
        email: email.trim(),
        password,
      });
      const access_token = await loginForSetup(username.trim(), password);
      localStorage.setItem("ks_token", access_token);

      await saveInitialSettings(
        {
          site_mode: siteMode,
          registration_mode: registrationMode,
        },
        access_token,
      );

      // 4. Persist language preference
      localStorage.setItem("ks_language", language);

      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  }

  // ── Progress indicator (visible on steps 1-3) ───────────────────────────────

  function ProgressBar() {
    if (step === 0 || step === 4) return null;
    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((idx) => {
          const done = step > idx;
          const active = step === idx;
          return (
            <div key={idx} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${done ? "bg-amber-500 text-white" : active ? "bg-amber-500 text-white ring-4 ring-amber-200 dark:ring-amber-900" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"}`}
              >
                {done ? <Check size={14} /> : idx}
              </div>
              {idx < 3 && (
                <div
                  className={`h-0.5 w-10 transition-colors ${step > idx ? "bg-amber-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-[#1e1e2e] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-6 shadow-sm">
          <ProgressBar />

          {/* ── Step 0: Welcome ─────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield size={32} className="text-amber-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Willkommen bei KochSchmiede!</h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                Lass uns deine Installation in wenigen Schritten einrichten.
              </p>
              <div className="space-y-3 text-left mb-8">
                {[
                  { Icon: User, text: "Administrator-Konto erstellen" },
                  { Icon: Globe, text: "Sichtbarkeit und Registrierung konfigurieren" },
                  { Icon: Sun, text: "Erscheinungsbild und Sprache festlegen" },
                ].map(({ Icon, text }) => (
                  <div
                    key={text}
                    className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300"
                  >
                    <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-amber-500" />
                    </div>
                    {text}
                  </div>
                ))}
              </div>
              <button
                onClick={next}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 text-sm transition"
              >
                Einrichtung starten <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ── Step 1: Admin Account ────────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <User size={20} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Admin-Konto</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Dein Administrator-Konto
                  </p>
                </div>
              </div>

              {stepError && <ErrorAlert msg={stepError} />}

              <div className="space-y-4">
                <InputField
                  label="Benutzername"
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={setUsername}
                  placeholder="admin"
                />
                <InputField
                  label="E-Mail-Adresse"
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="admin@beispiel.de"
                />
                <InputField
                  label="Passwort"
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Mindestens 8 Zeichen"
                  rightSlot={
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPw((v) => !v)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
                <InputField
                  label="Passwort bestätigen"
                  id="confirmPassword"
                  type={showConfirmPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Passwort wiederholen"
                  rightSlot={
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirmPw((v) => !v)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={back}
                  className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  Zurück
                </button>
                <button
                  onClick={next}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 text-sm transition"
                >
                  Weiter <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Site Settings ────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <Globe size={20} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Grundeinstellungen</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Sichtbarkeit und Zugang
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Site visibility */}
                <div>
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
                    Sichtbarkeit
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["private", "public"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setSiteMode(mode)}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 py-4 px-3 text-center transition
                          ${siteMode === mode ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${siteMode === mode ? "bg-amber-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}
                        >
                          {mode === "private" ? <Lock size={16} /> : <Globe size={16} />}
                        </div>
                        <div>
                          <div
                            className={`text-sm font-semibold ${siteMode === mode ? "text-amber-600 dark:text-amber-400" : "text-zinc-700 dark:text-zinc-200"}`}
                          >
                            {mode === "private" ? "Privat" : "Öffentlich"}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {mode === "private" ? "Login erforderlich" : "Alle können lesen"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Registration mode */}
                <div>
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
                    Registrierung
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["open", "admin_only"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setRegistrationMode(mode)}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 py-4 px-3 text-center transition
                          ${registrationMode === mode ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${registrationMode === mode ? "bg-amber-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}
                        >
                          {mode === "open" ? <Users size={16} /> : <Shield size={16} />}
                        </div>
                        <div>
                          <div
                            className={`text-sm font-semibold ${registrationMode === mode ? "text-amber-600 dark:text-amber-400" : "text-zinc-700 dark:text-zinc-200"}`}
                          >
                            {mode === "open" ? "Offen" : "Nur Admin"}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {mode === "open"
                              ? "Jeder kann sich registrieren"
                              : "Admin erstellt Konten"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={back}
                  className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  Zurück
                </button>
                <button
                  onClick={next}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 text-sm transition"
                >
                  Weiter <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Appearance & Language ───────────────────────────────── */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <Sun size={20} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Erscheinungsbild</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Design und Sprache wählen
                  </p>
                </div>
              </div>

              {error && <ErrorAlert msg={error} />}

              {/* Theme */}
              <div className="mb-5">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
                  Design
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { value: "light", label: "Hell", Icon: Sun, previewBg: "bg-white" },
                      { value: "dark", label: "Dunkel", Icon: Moon, previewBg: "bg-[#1e1e2e]" },
                    ] as const
                  ).map(({ value, label, Icon, previewBg }) => {
                    const isSelected = mounted && theme === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={`relative flex flex-col rounded-xl border-2 overflow-hidden transition
                          ${isSelected ? "border-amber-500" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"}`}
                      >
                        {/* Mini preview */}
                        <div className={`${previewBg} h-14 w-full flex items-center justify-center gap-1 px-3`}>
                          <div className="flex flex-col gap-1 flex-1">
                            <div className="h-1.5 w-full max-w-[48px] rounded bg-zinc-200 dark:bg-zinc-600" />
                            <div className="h-1.5 w-2/3 max-w-[32px] rounded bg-zinc-200 dark:bg-zinc-600" />
                          </div>
                          <div className="h-5 w-10 rounded bg-amber-400 shrink-0" />
                        </div>
                        {/* Label */}
                        <div
                          className={`px-3 py-2 flex items-center justify-between ${value === "dark" ? "bg-zinc-900 border-t border-zinc-700" : "bg-white border-t border-zinc-100"}`}
                        >
                          <span
                            className={`text-sm font-medium ${value === "dark" ? "text-zinc-100" : "text-zinc-700"}`}
                          >
                            {label}
                          </span>
                          <Icon
                            size={14}
                            className={value === "dark" ? "text-zinc-400" : "text-zinc-400"}
                          />
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                            <Check size={11} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
                  Sprache
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { code: "de", label: "Deutsch", flag: "🇩🇪" },
                    { code: "en", label: "English", flag: "🇬🇧" },
                  ].map(({ code, label, flag }) => (
                    <button
                      key={code}
                      onClick={() => setLanguage(code)}
                      className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 transition
                        ${language === code ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"}`}
                    >
                      <span className="text-xl">{flag}</span>
                      <span
                        className={`text-sm font-medium ${language === code ? "text-amber-600 dark:text-amber-400" : "text-zinc-700 dark:text-zinc-200"}`}
                      >
                        {label}
                      </span>
                      {language === code && (
                        <Check size={14} className="ml-auto text-amber-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={back}
                  disabled={loading}
                  className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  Zurück
                </button>
                <button
                  onClick={complete}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Einrichten…
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Abschließen
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Done ─────────────────────────────────────────────────── */}
          {step === 4 && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Einrichtung abgeschlossen!</h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">
                KochSchmiede ist bereit. Viel Spaß beim Kochen!
              </p>
              <button
                onClick={() => router.push("/")}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 text-sm transition"
              >
                Zur App <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
