"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  Globe,
  FileText,
  Camera,
  Upload,
  Loader2,
  Check,
  ArrowRight,
  Pencil,
  Save,
  AlertCircle,
  Plus,
  X,
} from "lucide-react";

type ImportTab = "url" | "file" | "camera";

type IngredientGroup = {
  name: string;
  ingredients: string[];
};

type ImportResult = {
  title?: string;
  description?: string;
  image_url?: string;
  source_url?: string;
  ingredients: string[];
  ingredient_groups: IngredientGroup[];
  steps: string[];
  tags: string[];
  prep_time?: number;
  cook_time?: number;
  servings?: number;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Ordered list of units recognised when parsing raw ingredient strings.
 * Longer/more-specific entries must come before shorter ones to avoid
 * partial matches (e.g. "Zehe/n" before "Zehe", "kg" before "g").
 */
const KNOWN_UNITS = [
  "Scheibe(n)", "Scheibe/n", "Scheiben", "Scheibe",
  "Stangen", "Stange",
  "Blätter", "Blatt",
  "Flaschen", "Flasche",
  "Prisen", "Prise",
  "Tassen", "Tasse",
  "Schalen", "Schale",
  "Dosen", "Dose",
  "Zweige", "Zweig",
  "Zehe/n", "Zehen", "Zehe",
  "Bunde", "Bund",
  "Handvoll",
  "Tropfen",
  "Becher",
  "Schuss",
  "Stücke", "Stück", "Stk.",
  "Packung", "Pck.", "Pck", "Pkg.",
  "Gläser", "Glas",
  "Msp.",
  "cups", "cup",
  "tbsp", "tsp",
  "bunch",
  "EL", "TL",
  "kg", "ml", "cl", "dl",
  "oz", "lb",
  "cm",
  "g", "l",
];

/**
 * Parse a raw ingredient string like "500 g Magerquark" into its
 * constituent parts: numeric amount, unit, and ingredient name.
 *
 * Handles:
 *  - integers and decimals:  "500", "1.5", "1,5"
 *  - written fractions:      "1/2", "3/4"
 *  - Unicode fractions:      "½", "¼", "¾", "⅓", "⅔", …  (U+00BC–U+00BE, U+2150–U+215E)
 *  - mixed amounts:          "1½", "1 ½"
 *  - "n. B." / "n.B."       (nach Bedarf / to taste)
 */
function parseIngredient(raw: string): { amount: string; unit: string; name: string } {
  const trimmed = raw.trim();

  // Unicode fraction characters (¼ ½ ¾ ⅓ ⅔ ⅛ ⅜ ⅝ ⅞ …)
  const FRAC = "\u00BC-\u00BE\u2150-\u215E";

  // Amount token: integer/decimal, optional written fraction (1/2), optional
  // unicode fraction suffix (1½), standalone unicode fraction, or "n. B."
  const AMT =
    `(?:\\d+[,.]?\\d*(?:\\s*/\\s*\\d+)?(?:\\s*[${FRAC}])?` +  // 1, 1.5, 1/2, 1½
    `|[${FRAC}]` +                                              // ½ alone
    `|n\\.?\\s*[Bb]\\.)`;                                       // n. B.

  // Build a regex alternation from the known-units list, escaping special chars.
  const unitAlt = KNOWN_UNITS
    .map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  // Try: amount  unit  name
  const withUnit = new RegExp(
    `^(${AMT})\\s+(${unitAlt})\\.?\\s+(.+)$`,
    "iu",
  );
  // Try: amount  name  (no recognisable unit)
  const withAmountOnly = new RegExp(`^(${AMT})\\s+(.+)$`, "iu");

  let m = trimmed.match(withUnit);
  if (m) {
    return { amount: m[1].replace(",", ".").trim(), unit: m[2].trim(), name: m[3].trim() };
  }
  m = trimmed.match(withAmountOnly);
  if (m) {
    return { amount: m[1].replace(",", ".").trim(), unit: "", name: m[2].trim() };
  }
  return { amount: "", unit: "", name: trimmed };
}

function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("ks_token") : null;
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API}${path}`, { ...options, headers }).then(async (res) => {
    if (!res.ok) {
      const e = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(e.detail ?? "Request failed");
    }
    return res.status === 204 ? null : res.json();
  });
}

export default function ImportPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ImportTab>("url");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [handwriting, setHandwriting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const handleApiResult = (data: ImportResult) => {
    setResult(data);
    setError(null);
  };

  const handleApiError = (e: unknown) => {
    setError(e instanceof Error ? e.message : "Import fehlgeschlagen");
  };

  // ── URL Import ────────────────────────────────────────────────────────────

  const importFromUrl = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch(`/api/import/url?url=${encodeURIComponent(url)}`);
      handleApiResult(data);
    } catch (e) {
      handleApiError(e);
    } finally {
      setLoading(false);
    }
  };

  // ── File Import ───────────────────────────────────────────────────────────

  const importFromFiles = async (files: FileList) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      const hwQuery = handwriting ? "?handwriting=true" : "";
      if (files.length === 1) {
        formData.append("file", files[0]);
        const data = await apiFetch(`/api/import/file${hwQuery}`, {
          method: "POST",
          body: formData,
        });
        handleApiResult(data);
      } else {
        for (let i = 0; i < files.length; i++) {
          formData.append("files", files[i]);
        }
        const data = await apiFetch(`/api/import/files${hwQuery}`, {
          method: "POST",
          body: formData,
        });
        handleApiResult(data);
      }
    } catch (e) {
      handleApiError(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Camera ────────────────────────────────────────────────────────────────

  const startCamera = async () => {
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Kamerazugriff wird von diesem Browser nicht unterstützt. Bitte stelle sicher, dass die Seite über HTTPS aufgerufen wird.",
      );
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch (err) {
      if (err instanceof DOMException && err.name === "OverconstrainedError") {
        // Rear-camera constraint not satisfiable – fall back to any available camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (fallbackErr) {
          err = fallbackErr;
        }
      }
      if (!stream) {
        if (err instanceof DOMException) {
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            setCameraError(
              "Kamerazugriff verweigert. Bitte erlaube den Kamerazugriff in den Browser-Einstellungen.",
            );
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            setCameraError(
              "Keine Kamera gefunden. Bitte stelle sicher, dass eine Kamera angeschlossen oder verfügbar ist.",
            );
          } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
            setCameraError(
              "Kamera wird bereits von einer anderen Anwendung verwendet. Bitte schließe andere Apps und versuche es erneut.",
            );
          } else {
            setCameraError("Kamerazugriff nicht möglich. Bitte Berechtigungen prüfen.");
          }
        } else {
          setCameraError("Kamerazugriff nicht möglich. Bitte Berechtigungen prüfen.");
        }
        return;
      }
    }

    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      setCameraActive(true);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
    }
    setCameraActive(false);
  };

  const captureAndScan = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    stopCamera();

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
          const formData = new FormData();
          formData.append("file", blob, "capture.jpg");
          const hwQuery = handwriting ? "?handwriting=true" : "";
          const data = await apiFetch(`/api/import/camera${hwQuery}`, {
            method: "POST",
            body: formData,
          });
          handleApiResult(data);
        } catch (e) {
          handleApiError(e);
        } finally {
          setLoading(false);
        }
      },
      "image/jpeg",
      0.92,
    );
  };

  // ── Save Recipe ───────────────────────────────────────────────────────────

  const saveAsRecipe = async () => {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Map flat ingredients to structured format, parsing amount/unit/name
      const ingredients = result.ingredients.map((raw, idx) => {
        const { amount, unit, name } = parseIngredient(raw);
        return { amount: amount || null, unit: unit || null, name, position: idx };
      });
      // Map ingredient groups, also parsing each ingredient string
      const ingredient_groups = result.ingredient_groups.map((g, gi) => ({
        name: g.name,
        position: gi,
        ingredients: g.ingredients.map((raw, idx) => {
          const { amount, unit, name } = parseIngredient(raw);
          return { amount: amount || null, unit: unit || null, name, position: idx };
        }),
      }));
      // Map steps
      const steps = result.steps.map((instruction, idx) => ({
        position: idx,
        instruction,
      }));

      const payload = {
        title: result.title || "Importiertes Rezept",
        description: result.description ?? null,
        image_url: result.image_url ?? null,
        source_url: result.source_url ?? null,
        prep_time: result.prep_time ?? null,
        cook_time: result.cook_time ?? null,
        servings: result.servings ?? null,
        ingredients,
        ingredient_groups,
        steps,
        tags: result.tags,
      };

      const data = await apiFetch("/api/recipes/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/recipes/${data.id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "url" as const, icon: Globe, label: "Website" },
    { id: "file" as const, icon: FileText, label: "PDF/Bild" },
    { id: "camera" as const, icon: Camera, label: "Kamera" },
  ];

  // ── Handwriting toggle (shared between file & camera) ──────────────────────

  const HandwritingToggle = () => (
    <label className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 cursor-pointer select-none mb-4">
      <input
        type="checkbox"
        checked={handwriting}
        onChange={(e) => setHandwriting(e.target.checked)}
        className="w-4 h-4 accent-amber-500"
      />
      Vision KI nutzen (Handschrift, Zeitschrift, komplexe Bilder)
    </label>
  );

  return (
    <AppShell>
      <main className="w-full px-4 py-6 pb-24 lg:pb-8">
        <h1 className="text-2xl font-bold mb-2">Import Center</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
          Rezepte importieren aus verschiedenen Quellen
        </p>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id);
                setResult(null);
                setError(null);
              }}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition ${
                activeTab === id
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-500"
              }`}
            >
              <Icon size={24} />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* URL Import */}
        {activeTab === "url" && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Globe size={18} className="text-amber-500" /> Website importieren
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              URL einer Rezept-Website eingeben. Das Rezept wird automatisch extrahiert.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && importFromUrl()}
                placeholder="https://example.com/rezept"
                className="flex-1 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={importFromUrl}
                disabled={loading || !url}
                className="bg-amber-500 text-white px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
              </button>
            </div>
          </div>
        )}

        {/* File Import */}
        {activeTab === "file" && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <FileText size={18} className="text-amber-500" /> PDF / Bild importieren
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Lade ein oder mehrere PDFs bzw. Fotos eines Rezepts hoch. Mehrere Dateien werden
              als mehrseitiges Rezept zusammengeführt. OCR extrahiert den Text automatisch.
            </p>
            <HandwritingToggle />
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  importFromFiles(e.target.files);
                }
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="w-full flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl text-zinc-500 hover:border-amber-400 transition"
            >
              {loading ? (
                <Loader2 size={32} className="animate-spin text-amber-500" />
              ) : (
                <>
                  <Upload size={32} />
                  <span className="text-sm">
                    Datei(en) auswählen (PDF, JPG, PNG) – auch mehrere für mehrseitige Rezepte
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Camera Import */}
        {activeTab === "camera" && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Camera size={18} className="text-amber-500" /> Kamera Import
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Fotografiere ein Rezept direkt mit der Kamera.
            </p>
            <HandwritingToggle />
            {!cameraActive ? (
              <div>
                {cameraError && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                    {cameraError}
                  </div>
                )}
                <button
                  onClick={startCamera}
                  className="w-full flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl text-zinc-500 hover:border-amber-400 transition"
                >
                  <Camera size={32} />
                  <span className="text-sm">Kamera starten</span>
                </button>
              </div>
            ) : (
              <div>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} autoPlay playsInline className="w-full rounded-2xl mb-3" />
                <div className="flex gap-2">
                  <button
                    onClick={captureAndScan}
                    disabled={loading}
                    className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Camera size={16} />
                    )}
                    Foto aufnehmen &amp; scannen
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-4 bg-zinc-200 dark:bg-zinc-700 rounded-xl"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-4 bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-3">
              <Check size={18} className="text-green-500" />
              <h3 className="font-semibold">Rezept erkannt</h3>
            </div>

            {/* Title */}
            <p className="font-medium text-lg mb-1">{result.title || "Unbekanntes Rezept"}</p>

            {/* Meta */}
            {(result.prep_time || result.cook_time || result.servings) && (
              <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                {result.prep_time && <span>Vorbereitung: {result.prep_time} Min.</span>}
                {result.cook_time && <span>Kochen: {result.cook_time} Min.</span>}
                {result.servings && <span>Portionen: {result.servings}</span>}
              </div>
            )}

            {result.description && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">{result.description}</p>
            )}

            {/* Flat ingredients */}
            {result.ingredients.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium mb-1 text-zinc-500">
                  Zutaten ({result.ingredients.length})
                </p>
                <ul className="text-sm space-y-1">
                  {result.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      {ing}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Grouped ingredients */}
            {result.ingredient_groups.length > 0 && (
              <div className="mb-3 space-y-3">
                {result.ingredient_groups.map((group, gi) => (
                  <div key={gi}>
                    <p className="text-sm font-semibold mb-1 text-amber-600 dark:text-amber-400">
                      {group.name}
                    </p>
                    <ul className="text-sm space-y-1">
                      {group.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Steps */}
            {result.steps.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-1 text-zinc-500">
                  Schritte ({result.steps.length})
                </p>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  {result.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Tags */}
            {result.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {result.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-600 dark:text-zinc-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Save error */}
            {saveError && (
              <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                {saveError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={saveAsRecipe}
                disabled={saving}
                className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Als Rezept speichern
              </button>
              <button
                onClick={() => setResult(null)}
                className="px-4 bg-zinc-200 dark:bg-zinc-700 rounded-xl text-sm"
                title="Verwerfen"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
