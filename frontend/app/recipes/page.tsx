"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import RecipeCard from "@/components/RecipeCard";
import { Search, SlidersHorizontal, Loader2, ChefHat } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface ApiRecipe {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  prep_time: number | null;
  servings: number | null;
  tags: string[];
}

function RecipesContent() {
  const searchParams = useSearchParams();
  const [allRecipes, setAllRecipes] = useState<ApiRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setSearchQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const fetchRecipes = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("ks_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API}/api/recipes/`, { headers });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail ?? "Fehler beim Laden der Rezepte");
        }
        setAllRecipes(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    };
    fetchRecipes();
  }, []);

  // Derive unique sorted tags from all recipes for the category strip
  const allTags = useMemo(
    () => Array.from(new Set(allRecipes.flatMap((r) => r.tags))).sort(),
    [allRecipes]
  );

  // Client-side filtering by active tag and search query
  const filteredRecipes = useMemo(() => {
    let result = allRecipes;
    if (activeTag) {
      result = result.filter((r) => r.tags.includes(activeTag));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [allRecipes, activeTag, searchQuery]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#1e1e2e]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Alle Rezepte</h1>
          <button className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            size={18}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rezepte suchen..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 dark:text-white"
          />
        </div>

        {/* Category filter strip – only shown when there are tags */}
        {allTags.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveTag(null)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                activeTag === null
                  ? "bg-amber-500 text-white"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-amber-300 dark:hover:border-amber-700"
              }`}
            >
              Alle
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                  activeTag === tag
                    ? "bg-amber-500 text-white"
                    : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-amber-300 dark:hover:border-amber-700"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-4">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-amber-500" />
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ChefHat size={48} className="text-zinc-300 dark:text-zinc-600 mb-4" />
            <p className="text-base font-medium text-zinc-600 dark:text-zinc-300 mb-1">
              Keine Rezepte gefunden
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-6">
              {activeTag || searchQuery.trim()
                ? "Versuche eine andere Suche oder Kategorie"
                : "Erstelle dein erstes Rezept!"}
            </p>
            {!activeTag && !searchQuery.trim() && (
              <Link
                href="/recipes/new"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition"
              >
                Neues Rezept
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={{
                  id: recipe.id,
                  title: recipe.title,
                  description: recipe.description ?? undefined,
                  image: recipe.image_url ?? undefined,
                  prep_time: recipe.prep_time ?? undefined,
                  servings: recipe.servings ?? undefined,
                  tags: recipe.tags,
                }}
              />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

export default function RecipesPage() {
  return (
    <Suspense>
      <RecipesContent />
    </Suspense>
  );
}
