"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Clock, Users, Lock, ArrowLeft, AlertCircle, Printer } from "lucide-react";
import Logo from "@/components/Logo";

interface Ingredient {
  id: string;
  amount?: string;
  unit?: string;
  name: string;
  position: number;
}
interface Step {
  id: string;
  position: number;
  instruction: string;
}
interface Recipe {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  prep_time?: number;
  cook_time?: number;
  servings?: number;
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function SharedRecipePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRecipe(pw?: string) {
    setLoading(true);
    setError(null);
    try {
      const url = `${API}/api/recipes/share/${token}${pw ? `?password=${encodeURIComponent(pw)}` : ""}`;
      const res = await fetch(url);
      if (res.status === 401) {
        setNeedsPassword(true);
        setLoading(false);
        return;
      }
      if (res.status === 403) {
        setError("Falsches Passwort");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Fehler" }));
        setError(err.detail ?? "Share-Link ungültig oder abgelaufen");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setRecipe(data);
      setNeedsPassword(false);
    } catch {
      setError("Verbindungsfehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecipe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#1e1e2e]">
      {/* Simple header for shared view */}
      <nav className="w-full flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1e1e2e] sticky top-0 z-50 print:hidden">
        <Logo />
        <Link
          href="/"
          className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 hover:text-amber-500 transition"
        >
          <ArrowLeft size={14} /> Zur App
        </Link>
      </nav>

      <main className="w-full px-4 py-6 pb-16">
        {loading && (
          <div className="text-center py-20 text-zinc-400">Lade Rezept…</div>
        )}

        {/* Password gate */}
        {!loading && needsPassword && (
          <div className="max-w-sm mx-auto mt-12">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                <Lock size={24} className="text-amber-500" />
              </div>
              <h2 className="font-bold text-lg mb-1">Passwortgeschützt</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                Gib das Passwort ein, um dieses Rezept zu sehen.
              </p>
              {error && (
                <div className="mb-3 flex items-center gap-2 text-red-500 text-xs bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadRecipe(password)}
                placeholder="Passwort"
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
                autoFocus
              />
              <button
                onClick={() => loadRecipe(password)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-medium text-sm transition"
              >
                Rezept anzeigen
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && !needsPassword && (
          <div className="text-center py-20">
            <AlertCircle size={40} className="text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400">{error}</p>
            <Link href="/" className="mt-4 inline-block text-amber-500 text-sm font-medium">
              Zur Startseite
            </Link>
          </div>
        )}

        {/* Recipe content */}
        {recipe && (
          <div>
            {/* Print button */}
            <div className="flex justify-end mb-4 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-amber-400 transition"
              >
                <Printer size={16} />
                Als PDF / Drucken
              </button>
            </div>

            {/* Recipe header */}
            <div className="w-full h-48 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-6 print:hidden">
              <span className="text-8xl">🍳</span>
            </div>

            <h1 className="text-2xl font-bold mb-2">{recipe.title}</h1>
            {recipe.description && (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">{recipe.description}</p>
            )}

            {/* Tags */}
            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {recipe.prep_time && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
                  <Clock size={18} className="mx-auto mb-1 text-amber-500" />
                  <div className="font-semibold text-sm">{recipe.prep_time} Min</div>
                  <div className="text-xs text-zinc-400">Vorbereitung</div>
                </div>
              )}
              {recipe.cook_time && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
                  <Clock size={18} className="mx-auto mb-1 text-amber-500" />
                  <div className="font-semibold text-sm">{recipe.cook_time} Min</div>
                  <div className="text-xs text-zinc-400">Kochzeit</div>
                </div>
              )}
              {recipe.servings && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
                  <Users size={18} className="mx-auto mb-1 text-amber-500" />
                  <div className="font-semibold text-sm">{recipe.servings}</div>
                  <div className="text-xs text-zinc-400">Portionen</div>
                </div>
              )}
            </div>

            {/* Ingredients */}
            {recipe.ingredients.length > 0 && (
              <div className="mb-6">
                <h2 className="font-bold text-lg mb-3">Zutaten</h2>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                  {recipe.ingredients.map((ing, i) => (
                    <div
                      key={ing.id}
                      className={`flex items-center justify-between px-4 py-3 ${
                        i !== recipe.ingredients.length - 1
                          ? "border-b border-zinc-100 dark:border-zinc-800"
                          : ""
                      }`}
                    >
                      <span className="font-medium text-sm">{ing.name}</span>
                      <span className="text-zinc-500 dark:text-zinc-400 text-sm">
                        {[ing.amount, ing.unit].filter(Boolean).join(" ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Steps */}
            {recipe.steps.length > 0 && (
              <div className="mb-6">
                <h2 className="font-bold text-lg mb-3">Zubereitung</h2>
                <div className="space-y-4">
                  {recipe.steps.map((step, i) => (
                    <div key={step.id} className="flex gap-4">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">
                        {i + 1}
                      </div>
                      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 flex-1 text-sm border border-zinc-100 dark:border-zinc-800">
                        {step.instruction}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-center text-xs text-zinc-400 mt-8 print:hidden">
              Geteilt über{" "}
              <span className="font-semibold text-amber-500">KochSchmiede</span>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
