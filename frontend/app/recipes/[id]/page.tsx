"use client";

import { useState, use } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import ShareDialog from "@/components/ShareDialog";
import Link from "next/link";
import { ArrowLeft, Clock, Users, Edit, Heart, Share2, Printer, ChevronUp, ChevronDown } from "lucide-react";

// Mock data used until API is wired
const mockRecipe = {
  id: "1",
  title: "Spaghetti Carbonara",
  description:
    "Ein klassisches italienisches Nudelgericht aus Rom, zubereitet mit Eiern, Pecorino-Käse, Guanciale (oder Speck) und schwarzem Pfeffer.",
  prep_time: 20,
  cook_time: 15,
  servings: 4,
  tags: ["Pasta", "Italienisch", "Klassiker"],
  ingredients: [
    { amount: "400", unit: "g", name: "Spaghetti" },
    { amount: "200", unit: "g", name: "Guanciale oder Speck" },
    { amount: "4", unit: "keine Einheit", name: "Eier (davon 2 nur Eigelb)" },
    { amount: "100", unit: "g", name: "Pecorino Romano, gerieben" },
    { amount: "50", unit: "g", name: "Parmesan, gerieben" },
    { amount: "", unit: "nach Geschmack", name: "Schwarzer Pfeffer, frisch gemahlen" },
    { amount: "1", unit: "TL", name: "Salz" },
  ],
  ingredient_groups: [] as { name: string; ingredients: { amount: string; unit: string; name: string }[] }[],
  steps: [
    "Einen großen Topf mit Salzwasser zum Kochen bringen und Spaghetti al dente kochen.",
    "Guanciale in einer großen Pfanne bei mittlerer Hitze ohne Öl knusprig braten.",
    "In einer Schüssel Eier, Eigelbe und geriebenen Käse vermengen. Mit viel schwarzem Pfeffer würzen.",
    "Pasta vom Herd nehmen. Etwas Kochwasser aufheben.",
    "Spaghetti zum Guanciale in die Pfanne geben (Herd aus!). Ei-Käse-Masse schnell unterrühren.",
    "Mit Kochwasser nach und nach eine cremige Sauce herstellen.",
    "Sofort servieren, mit extra Käse und Pfeffer.",
  ],
};

/** Scale a numeric amount string by ratio. Returns the original string unchanged if non-numeric. */
function scaleAmount(amount: string, ratio: number): string {
  if (!amount) return amount;
  const n = parseFloat(amount);
  if (isNaN(n)) return amount;
  return (n * ratio).toFixed(2).replace(/\.?0+$/, "");
}

/** Format amount + unit for display, respecting "keine Einheit" */
function formatAmount(amount: string, unit: string): string {
  const u = unit === "keine Einheit" || unit === "" ? "" : unit;
  if (!amount && !u) return "";
  if (!amount) return u;
  return u ? `${amount} ${u}` : amount;
}

export default function RecipeView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const recipe = mockRecipe;

  const [shareOpen, setShareOpen] = useState(false);
  const [currentServings, setCurrentServings] = useState(recipe.servings);

  const ratio = currentServings / recipe.servings;

  const adjustServings = (delta: number) => {
    setCurrentServings((prev) => Math.max(1, prev + delta));
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#1e1e2e]">
      <Navbar />
      <main className="max-w-2xl mx-auto pb-24">
        {/* Header Image */}
        <div className="w-full h-56 bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center print:hidden">
          <span className="text-8xl">🍝</span>
        </div>

        <div className="px-4 py-4">
          {/* Back + Actions */}
          <div className="flex items-center justify-between mb-4 print:hidden">
            <Link
              href="/recipes"
              className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 text-sm"
            >
              <ArrowLeft size={16} /> Zurück
            </Link>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                title="Als PDF exportieren"
                className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-amber-400 transition"
              >
                <Printer size={18} />
              </button>
              <button className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-rose-500">
                <Heart size={18} />
              </button>
              <button
                onClick={() => setShareOpen(true)}
                className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-amber-400 transition"
                title="Rezept teilen"
              >
                <Share2 size={18} />
              </button>
              <Link href={`/recipes/${id}/edit`} className="p-2 rounded-xl bg-amber-500 text-white">
                <Edit size={18} />
              </Link>
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-2">{recipe.title}</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">{recipe.description}</p>

          {/* Tags */}
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

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
              <Clock size={18} className="mx-auto mb-1 text-amber-500" />
              <div className="font-semibold text-sm">{recipe.prep_time} Min</div>
              <div className="text-xs text-zinc-400">Vorbereitung</div>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
              <Clock size={18} className="mx-auto mb-1 text-amber-500" />
              <div className="font-semibold text-sm">{recipe.cook_time} Min</div>
              <div className="text-xs text-zinc-400">Kochzeit</div>
            </div>
            {/* Servings scaler */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
              <Users size={18} className="mx-auto mb-1 text-amber-500" />
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => adjustServings(-1)}
                  className="p-0.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition print:hidden"
                  aria-label="Portionen verringern"
                >
                  <ChevronDown size={14} />
                </button>
                <span className="font-semibold text-sm min-w-[1.5rem]">{currentServings}</span>
                <button
                  onClick={() => adjustServings(1)}
                  className="p-0.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition print:hidden"
                  aria-label="Portionen erhöhen"
                >
                  <ChevronUp size={14} />
                </button>
              </div>
              <div className="text-xs text-zinc-400">Portionen</div>
            </div>
          </div>

          {/* Ingredients */}
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-3">Zutaten</h2>

            {/* Ungrouped ingredients */}
            {recipe.ingredients.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden mb-4">
                {recipe.ingredients.map((ing, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-4 py-3 ${
                      i !== recipe.ingredients.length - 1
                        ? "border-b border-zinc-100 dark:border-zinc-800"
                        : ""
                    }`}
                  >
                    <span className="font-medium text-sm">{ing.name}</span>
                    <span className="text-zinc-500 dark:text-zinc-400 text-sm">
                      {formatAmount(scaleAmount(ing.amount, ratio), ing.unit)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Grouped ingredients */}
            {recipe.ingredient_groups.map((group, gi) => (
              <div key={gi} className="mb-4">
                <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
                  {group.name}
                </h3>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                  {group.ingredients.map((ing, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-4 py-3 ${
                        i !== group.ingredients.length - 1
                          ? "border-b border-zinc-100 dark:border-zinc-800"
                          : ""
                      }`}
                    >
                      <span className="font-medium text-sm">{ing.name}</span>
                      <span className="text-zinc-500 dark:text-zinc-400 text-sm">
                        {formatAmount(scaleAmount(ing.amount, ratio), ing.unit)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Steps */}
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-3">Zubereitung</h2>
            <div className="space-y-4">
              {recipe.steps.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold print:rounded-none print:bg-transparent print:text-zinc-800 print:border print:border-zinc-300">
                    {i + 1}
                  </div>
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 flex-1 text-sm border border-zinc-100 dark:border-zinc-800">
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Share dialog */}
      <ShareDialog
        recipeId={id}
        recipeTitle={recipe.title}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}

