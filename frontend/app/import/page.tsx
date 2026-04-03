"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import HelpButton from "@/components/HelpButton";
import {
  Globe,
  FileText,
  Camera,
  Upload,
  Loader2,
  Check,
  ArrowRight,
  Save,
  AlertCircle,
  X,
  Search,
  Image as ImageIcon,
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
  import_warning?: string;
};

type ImageSearchItem = {
  thumb_url: string;
  url: string;
  photographer: string;
  source_url: string;
  source?: string;
  source_name?: string;
  source_home?: string;
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
 *  - approximate prefixes:   "ca.", "etwa", "~", "≈"  (stripped before parsing)
 */
function parseIngredient(raw: string): { amount: string; unit: string; name: string } {
  // Strip leading approximate-quantity markers before any other parsing.
  const trimmed = raw.trim().replace(/^(?:ca\.\s*|etwa\s*|[~≈]\s*)/i, "");

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

const IMPORT_HELP = {
  title: "Import Center",
  sections: [
    {
      items: [
        "URL: Füge den Link zu einer Rezept-Webseite ein – KochSchmiede liest das Rezept automatisch aus.",
        "Datei: Lade ein PDF oder Bild (JPG, PNG, HEIC) mit einem Rezept hoch. Die KI oder OCR extrahiert die Inhalte.",
        "Kamera: Fotografiere ein Rezept direkt mit deiner Kamera.",
        "Nach dem Import kannst du das erkannte Rezept prüfen und bei Bedarf korrigieren, bevor du es speicherst.",
        "Für beste Ergebnisse bei Bildern: gutes Licht und möglichst geringe Verzerrung.",
      ],
    },
  ],
  docsLinks: [
    {
      label: "Benutzerhandbuch öffnen",
      url: "https://github.com/TimUx/KochSchmiede/blob/main/USERGUIDE.md",
    },
  ],
};

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(navigator.maxTouchPoints > 0);
  }, []);

  // ── Image search state ────────────────────────────────────────────────────
  const [imageSearchResults, setImageSearchResults] = useState<ImageSearchItem[]>([]);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [imageSearchError, setImageSearchError] = useState<string | null>(null);
  const [imageSearchDone, setImageSearchDone] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const handleApiResult = (data: ImportResult) => {
    setResult(data);
    setError(null);
    // Reset image search state for each new import
    setImageSearchResults([]);
    setImageSearchError(null);
    setImageSearchDone(false);
  };

  const handleApiError = (e: unknown) => {
    setError(e instanceof Error ? e.message : "Import fehlgeschlagen");
  };

  // ── Image search ─────────────────────────────────────────────────────────

  const searchImages = async () => {
    if (!result) return;
    const query = [result.title, ...(result.tags ?? [])].filter(Boolean).join(" ");
    if (!query) return;
    setImageSearchLoading(true);
    setImageSearchError(null);
    try {
      const items: ImageSearchItem[] = await apiFetch(
        `/api/import/search-images?query=${encodeURIComponent(query)}`
      );
      setImageSearchResults(items);
      setImageSearchDone(true);
      if (items.length === 0) {
        setImageSearchError("Keine Bilder gefunden.");
      }
    } catch (e) {
      setImageSearchError(e instanceof Error ? e.message : "Bildersuche fehlgeschlagen");
    } finally {
      setImageSearchLoading(false);
    }
  };

  const selectImage = (item: ImageSearchItem) => {
    if (!result) return;
    setResult({ ...result, image_url: item.url });
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
      if (files.length === 1) {
        formData.append("file", files[0]);
        const data = await apiFetch(`/api/import/file`, {
          method: "POST",
          body: formData,
        });
        handleApiResult(data);
      } else {
        for (let i = 0; i < files.length; i++) {
          formData.append("files", files[i]);
        }
        const data = await apiFetch(`/api/import/files`, {
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
          const data = await apiFetch(`/api/import/camera`, {
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

  return (
    <AppShell>
      <main className="w-full px-4 py-6 pb-24 lg:pb-8">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h1 className="text-2xl font-bold">Import Center</h1>
          <HelpButton content={IMPORT_HELP} />
        </div>
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
            {isMobile ? (
              /* Mobile: use native camera via <input capture> */
              <div>
                <input
                  ref={cameraFileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      importFromFiles(e.target.files);
                      // Reset so the same photo can be retaken
                      if (cameraFileRef.current) cameraFileRef.current.value = "";
                    }
                  }}
                />
                <button
                  onClick={() => cameraFileRef.current?.click()}
                  disabled={loading}
                  className="w-full flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl text-zinc-500 hover:border-amber-400 transition"
                >
                  {loading ? (
                    <Loader2 size={32} className="animate-spin text-amber-500" />
                  ) : (
                    <>
                      <Camera size={32} />
                      <span className="text-sm">Kamera öffnen & Foto aufnehmen</span>
                    </>
                  )}
                </button>
              </div>
            ) : !cameraActive ? (
              /* Desktop inactive: start getUserMedia stream */
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
              /* Desktop active: show live preview + capture button */
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

            {/* External AI warning */}
            {result.import_warning && (
              <div className="flex items-start gap-2 mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{result.import_warning}</span>
              </div>
            )}

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

            {/* ── Image section ──────────────────────────────────────────── */}
            <div className="mb-4">
              {/* Current image preview */}
              {result.image_url && (
                <div className="relative mb-2 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.image_url}
                    alt="Rezeptbild"
                    className="w-full max-h-48 object-cover rounded-xl"
                  />
                  <button
                    onClick={() => setResult({ ...result, image_url: undefined })}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition"
                    title="Bild entfernen"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Image search button */}
              <button
                onClick={searchImages}
                disabled={imageSearchLoading}
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-amber-400 hover:text-amber-600 transition disabled:opacity-50"
              >
                {imageSearchLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                {result.image_url ? "Anderes Bild suchen" : "Bild im Internet suchen"}
              </button>

              {/* Image search error */}
              {imageSearchError && (
                <p className="mt-2 text-xs text-red-500">{imageSearchError}</p>
              )}

              {/* Image search results grid */}
              {imageSearchDone && imageSearchResults.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1">
                    <ImageIcon size={12} />
                    {imageSearchResults[0]?.source_name
                      ? `Bild auswählen (Quelle: ${imageSearchResults[0].source_name})`
                      : "Bild auswählen"}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {imageSearchResults.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => selectImage(item)}
                        title={item.photographer ? `Foto: ${item.photographer}` : undefined}
                        className={`relative rounded-lg overflow-hidden aspect-video border-2 transition ${
                          result.image_url === item.url
                            ? "border-amber-500"
                            : "border-transparent hover:border-amber-300"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.thumb_url}
                          alt={`Bild ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {result.image_url === item.url && (
                          <span className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                            <Check size={20} className="text-amber-600 drop-shadow" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {imageSearchResults[0]?.source_name && (
                    <p className="mt-1 text-xs text-zinc-400">
                      Bilder von{" "}
                      {imageSearchResults[0].source_home ? (
                        <a
                          href={imageSearchResults[0].source_home}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {imageSearchResults[0].source_name}
                        </a>
                      ) : (
                        imageSearchResults[0].source_name
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
            {/* ── End image section ─────────────────────────────────────── */}

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
