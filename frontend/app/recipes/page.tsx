"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import RecipeCard from "@/components/RecipeCard";
import HelpButton from "@/components/HelpButton";
import { Search, SlidersHorizontal, Loader2, ChefHat, LayoutGrid, List } from "lucide-react";
import Link from "next/link";

const RECIPES_HELP = {
  title: "Alle Rezepte",
  sections: [
    {
      items: [
        "Hier siehst du alle gespeicherten Rezepte – eigene und geteilte.",
        "Nutze die Suchleiste oben, um Rezepte nach Name oder Zutaten zu filtern.",
        "Mit dem Filter-Symbol kannst du Rezepte nach Kategorien (Tags) eingrenzen.",
        "Klicke auf ein Rezept, um die Details aufzurufen.",
        "Über das +-Symbol in der Navigation erstellst du ein neues Rezept.",
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

interface ApiRecipe {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  prep_time: number | null;
  servings: number | null;
  tags: string[];
  owner_username: string | null;
}

function RecipesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [allRecipes, setAllRecipes] = useState<ApiRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    const saved = localStorage.getItem("ks_view_mode");
    if (saved === "list" || saved === "grid") setViewMode(saved);
  }, []);

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
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
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
  }, [router]);

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
    <AppShell>
      <main className="w-full px-4 py-6 pb-24 lg:pb-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Alle Rezepte</h1>
          <div className="flex items-center gap-1">
            <HelpButton content={RECIPES_HELP} />
            <div className="flex rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => { setViewMode("grid"); localStorage.setItem("ks_view_mode", "grid"); }}
                className={`p-1.5 transition ${viewMode === "grid" ? "bg-amber-500 text-white" : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                aria-label="Gitteransicht"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => { setViewMode("list"); localStorage.setItem("ks_view_mode", "list"); }}
                className={`p-1.5 transition ${viewMode === "list" ? "bg-amber-500 text-white" : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                aria-label="Listenansicht"
              >
                <List size={16} />
              </button>
            </div>
            <button
              onClick={() => setShowFilter((v) => !v)}
              className={`p-2 rounded-xl border transition ${
                showFilter || activeTag
                  ? "bg-amber-500 border-amber-500 text-white"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
              }`}
              aria-label="Filter anzeigen"
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
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

        {/* Category filter strip – shown when filter is toggled on and tags exist */}
        {showFilter && allTags.length > 0 && (
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
          <div className={viewMode === "list" ? "flex flex-col gap-2" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}>
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                variant={viewMode}
                recipe={{
                  id: recipe.id,
                  title: recipe.title,
                  description: recipe.description ?? undefined,
                  image: recipe.image_url ?? undefined,
                  prep_time: recipe.prep_time ?? undefined,
                  servings: recipe.servings ?? undefined,
                  tags: recipe.tags,
                  owner_username: recipe.owner_username ?? undefined,
                }}
              />
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}

export default function RecipesPage() {
  return (
    <Suspense>
      <RecipesContent />
    </Suspense>
  );
}
