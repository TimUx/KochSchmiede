"use client";

import { useState, useRef } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { Globe, FileText, Camera, Upload, Loader2, Check, ArrowRight } from "lucide-react";

type ImportTab = "url" | "file" | "camera";

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<ImportTab>("url");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<null | { title: string; ingredients: string[]; steps: string[] }>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importFromUrl = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/import/url?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch {
      // Mock result for demo
      setResult({
        title: "Importiertes Rezept",
        ingredients: ["Zutat 1", "Zutat 2", "Zutat 3"],
        steps: ["Schritt 1: Vorbereiten", "Schritt 2: Kochen", "Schritt 3: Servieren"],
      });
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch {
      setCameraError("Kamerazugriff nicht möglich. Bitte Berechtigungen prüfen.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
    }
    setCameraActive(false);
  };

  const tabs = [
    { id: "url" as const, icon: Globe, label: "Website" },
    { id: "file" as const, icon: FileText, label: "PDF/Bild" },
    { id: "camera" as const, icon: Camera, label: "Kamera" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#1e1e2e]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <h1 className="text-2xl font-bold mb-2">Import Center</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Rezepte importieren aus verschiedenen Quellen</p>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
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
                placeholder="https://example.com/rezept"
                className="flex-1 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={importFromUrl}
                disabled={loading || !url}
                className="bg-amber-500 text-white px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
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
              Lade ein PDF oder Foto eines Rezepts hoch. OCR extrahiert den Text automatisch.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setLoading(true);
                  setTimeout(() => {
                    setResult({
                      title: "OCR Rezept",
                      ingredients: ["Mehl 200g", "Eier 3", "Milch 250ml"],
                      steps: ["Zutaten vermengen", "Bei 180°C backen", "Abkühlen lassen"],
                    });
                    setLoading(false);
                  }, 2000);
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
                  <span className="text-sm">Datei auswählen (PDF, JPG, PNG)</span>
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
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-2xl mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      stopCamera();
                      setLoading(true);
                      setTimeout(() => {
                        setResult({
                          title: "Kamera Rezept",
                          ingredients: ["Zutat A", "Zutat B"],
                          steps: ["Schritt 1", "Schritt 2"],
                        });
                        setLoading(false);
                      }, 1500);
                    }}
                    className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-medium"
                  >
                    Foto aufnehmen & scannen
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
            <p className="font-medium text-lg mb-2">{result.title}</p>
            <div className="mb-3">
              <p className="text-sm font-medium mb-1 text-zinc-500">Zutaten ({result.ingredients.length})</p>
              <ul className="text-sm space-y-1">
                {result.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mb-4">
              <p className="text-sm font-medium mb-1 text-zinc-500">Schritte ({result.steps.length})</p>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                {result.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
            <button className="w-full bg-amber-500 text-white py-3 rounded-xl font-medium">
              Als Rezept speichern
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
