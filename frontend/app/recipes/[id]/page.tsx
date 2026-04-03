"use client";

import { useState, useEffect, use } from "react";

import AppShell from "@/components/AppShell";
import ShareDialog from "@/components/ShareDialog";
import HelpButton from "@/components/HelpButton";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Users,
  User,
  Edit,
  Heart,
  Share2,
  Printer,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";

const RECIPE_DETAIL_HELP = {
  title: "Rezept-Detailansicht",
  sections: [
    {
      items: [
        "Hier siehst du alle Details eines Rezepts: Zutaten, Zubereitungsschritte und Metadaten.",
        "Mit dem Drucker-Symbol kannst du das Rezept drucken oder als PDF speichern.",
        "Mit dem Herz-Symbol kannst du ein Rezept als Favorit markieren.",
        "Mit dem Teilen-Symbol kannst du einen Freigabe-Link erstellen.",
        "Als Ersteller des Rezepts kannst du es über das Stift-Symbol bearbeiten.",
        "Die Zutatenmengen passen sich an, wenn du die Portionszahl änderst.",
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

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Ingredient {
  id: string;
  amount: string | null;
  unit: string | null;
  name: string;
  position: number;
}

interface IngredientGroup {
  id: string;
  name: string;
  position: number;
  ingredients: Ingredient[];
}

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  source_url: string | null;
  owner_username: string | null;
  tags: string[];
  ingredients: Ingredient[];
  ingredient_groups: IngredientGroup[];
  steps: { id: string; position: number; instruction: string }[];
}

function scaleAmount(amount: string | null, ratio: number): string {
  if (!amount) return "";
  const n = parseFloat(amount);
  if (isNaN(n)) return amount;
  return (n * ratio).toFixed(2).replace(/\.?0+$/, "");
}

function formatAmount(amount: string, unit: string | null): string {
  const u = !unit || unit === "keine Einheit" ? "" : unit;
  if (!amount && !u) return "";
  if (!amount) return u;
  return u ? `${amount} ${u}` : amount;
}

export default function RecipeView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [currentServings, setCurrentServings] = useState(4);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUsername(localStorage.getItem("ks_username"));
  }, []);

  useEffect(() => {
    const fetchRecipe = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("ks_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${API}/api/recipes/${id}`, { headers });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail ?? "Rezept nicht gefunden");
        }
        const data: Recipe = await res.json();
        setRecipe(data);
        setCurrentServings(data.servings ?? 4);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    };
    fetchRecipe();
  }, [id]);

  const ratio = recipe ? currentServings / (recipe.servings ?? 4) : 1;
  const isOwner = !!recipe && !!currentUsername && recipe.owner_username === currentUsername;

  return (
    <AppShell>
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-amber-500" />
        </div>
      ) : error || !recipe ? (
        <main className="w-full px-4 py-12 pb-24 lg:pb-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle size={40} className="text-red-400" />
            <p className="text-base font-medium text-red-600 dark:text-red-400">
              {error ?? "Rezept nicht gefunden"}
            </p>
            <Link
              href="/recipes"
              className="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium"
            >
              Zur Rezeptliste
            </Link>
          </div>
        </main>
      ) : (
      <>
      <main className="w-full pb-24 lg:pb-8">
        {recipe.image_url ? (
          <div className="relative w-full h-56 print:hidden">
            <Image
              src={recipe.image_url}
              alt={recipe.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 672px"
            />
          </div>
        ) : (
          <div className="w-full h-56 bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center print:hidden">
            <span className="text-8xl">🍳</span>
          </div>
        )}

        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4 print:hidden">
            <Link
              href="/recipes"
              className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 text-sm"
            >
              <ArrowLeft size={16} /> Zurück
            </Link>
            <div className="flex gap-2">
              <HelpButton content={RECIPE_DETAIL_HELP} />
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
              {isOwner && (
                <button
                  onClick={() => setShareOpen(true)}
                  className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-amber-400 transition"
                  title="Rezept teilen"
                >
                  <Share2 size={18} />
                </button>
              )}
              {isOwner && (
                <Link href={`/recipes/${id}/edit`} className="p-2 rounded-xl bg-amber-500 text-white">
                  <Edit size={18} />
                </Link>
              )}
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-2">{recipe.title}</h1>
          {recipe.owner_username && (
            <p className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500 mb-3" aria-label={`Rezept von ${recipe.owner_username}`}>
              <User size={12} aria-hidden="true" /> von {recipe.owner_username}
            </p>
          )}
          {recipe.description && (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">{recipe.description}</p>
          )}

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

          <div className="grid grid-cols-3 gap-3 mb-6">
            {recipe.prep_time != null && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
                <Clock size={18} className="mx-auto mb-1 text-amber-500" />
                <div className="font-semibold text-sm">{recipe.prep_time} Min</div>
                <div className="text-xs text-zinc-400">Vorbereitung</div>
              </div>
            )}
            {recipe.cook_time != null && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
                <Clock size={18} className="mx-auto mb-1 text-amber-500" />
                <div className="font-semibold text-sm">{recipe.cook_time} Min</div>
                <div className="text-xs text-zinc-400">Kochzeit</div>
              </div>
            )}
            {recipe.servings != null && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
                <Users size={18} className="mx-auto mb-1 text-amber-500" />
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentServings((p) => Math.max(1, p - 1))}
                    className="p-0.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition print:hidden"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <span className="font-semibold text-sm min-w-[1.5rem]">{currentServings}</span>
                  <button
                    onClick={() => setCurrentServings((p) => p + 1)}
                    className="p-0.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition print:hidden"
                  >
                    <ChevronUp size={14} />
                  </button>
                </div>
                <div className="text-xs text-zinc-400">Portionen</div>
              </div>
            )}
          </div>

          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mb-4 text-xs text-amber-500 underline"
            >
              Originalrezept ansehen
            </a>
          )}

          {(recipe.ingredients.length > 0 || recipe.ingredient_groups.length > 0) && (
            <div className="mb-6">
              <h2 className="font-bold text-lg mb-3">Zutaten</h2>
              {recipe.ingredients.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden mb-4">
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
                        {formatAmount(scaleAmount(ing.amount, ratio), ing.unit)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {recipe.ingredient_groups.map((group) => (
                <div key={group.id} className="mb-4">
                  <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
                    {group.name}
                  </h3>
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                    {group.ingredients.map((ing, i) => (
                      <div
                        key={ing.id}
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
          )}

          {recipe.steps.length > 0 && (
            <div className="mb-6">
              <h2 className="font-bold text-lg mb-3">Zubereitung</h2>
              <div className="space-y-4">
                {recipe.steps
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((step, i) => (
                    <div key={step.id} className="flex gap-4">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold print:rounded-none print:bg-transparent print:text-zinc-800 print:border print:border-zinc-300">
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
        </div>
      </main>
      <ShareDialog
        recipeId={id}
        recipeTitle={recipe.title}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
      </>
      )}
    </AppShell>
  );
}
