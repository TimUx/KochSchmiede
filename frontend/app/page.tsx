"use client";

import { useState, useEffect, useMemo } from "react";
import AppShell from "@/components/AppShell";
import RecipeCard from "@/components/RecipeCard";
import InstallPrompt from "@/components/InstallPrompt";
import HelpButton from "@/components/HelpButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusCircle, TrendingUp, Search, Loader2 } from "lucide-react";

const DASHBOARD_HELP = {
  title: "Dashboard – Übersicht",
  sections: [
    {
      items: [
        "Die Übersicht zeigt alle deine gespeicherten Rezepte auf einen Blick.",
        "Nutze die Suchleiste, um Rezepte nach Titel oder Zutaten zu finden.",
        "Die Statistik-Kacheln zeigen die Anzahl deiner Rezepte und Kategorien.",
        "Über die Schnellaktionen kannst du ein neues Rezept erstellen oder Rezepte importieren.",
        "Die neuesten Rezepte werden direkt auf der Startseite angezeigt.",
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
}

export default function Dashboard() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<ApiRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        const statusRes = await fetch(`${API}/api/setup/status`);
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.needs_setup) {
            router.replace("/setup");
            return;
          }
        }
      } catch {
        // if status check fails, continue to show the home page
      }

      try {
        const token = localStorage.getItem("ks_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${API}/api/recipes/`, { headers });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (res.ok) setRecipes(await res.json());
      } catch {
        // silently fail on network errors
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  const categoryCount = useMemo(
    () => new Set(recipes.flatMap((r) => r.tags)).size,
    [recipes]
  );

  const recentRecipes = recipes.slice(0, 4);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/recipes?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/recipes");
    }
  }

  return (
    <AppShell>
      <main className="w-full px-4 py-6 pb-24 lg:pb-8">
        <div className="mb-6 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold mb-1">Meine Rezepte</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Entdecke und verwalte deine Lieblingsrezepte
            </p>
          </div>
          <HelpButton content={DASHBOARD_HELP} />
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rezepte suchen..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 dark:text-white transition"
          />
        </form>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              {
                label: "Rezepte",
                value: String(recipes.length),
                color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
              },
              {
                label: "Kategorien",
                value: String(categoryCount),
                color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
              },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-2xl p-3 text-center ${stat.color}`}>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link
            href="/recipes/new"
            className="flex items-center gap-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl p-4 transition"
          >
            <PlusCircle size={22} />
            <span className="font-medium">Neues Rezept</span>
          </Link>
          <Link
            href="/import"
            className="flex items-center gap-3 bg-zinc-800 dark:bg-zinc-700 text-white rounded-2xl p-4 transition hover:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            <TrendingUp size={22} />
            <span className="font-medium">Importieren</span>
          </Link>
        </div>

        {/* Recent Recipes */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Zuletzt hinzugefügt</h2>
          <Link href="/recipes" className="text-amber-500 text-sm font-medium">
            Alle anzeigen
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin text-amber-500" />
          </div>
        ) : recentRecipes.length === 0 ? (
          <div className="text-center py-10 text-zinc-400 text-sm">
            Noch keine Rezepte vorhanden.{" "}
            <Link href="/recipes/new" className="text-amber-500 font-medium">
              Erstes Rezept anlegen
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {recentRecipes.map((recipe) => (
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

      <InstallPrompt />
    </AppShell>
  );
}
