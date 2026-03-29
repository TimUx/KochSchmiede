import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import RecipeCard from "@/components/RecipeCard";
import InstallPrompt from "@/components/InstallPrompt";
import Link from "next/link";
import { PlusCircle, TrendingUp, Search } from "lucide-react";

const mockRecipes = [
  {
    id: "1",
    title: "Spaghetti Carbonara",
    description: "Klassische italienische Pasta mit Ei, Käse und Speck",
    prep_time: 20,
    servings: 4,
    tags: ["Pasta", "Italienisch", "Klassiker"],
  },
  {
    id: "2",
    title: "Chicken Tikka Masala",
    description: "Würziges indisches Currygericht mit zartem Hähnchen",
    prep_time: 45,
    servings: 4,
    tags: ["Indisch", "Curry", "Hähnchen"],
  },
  {
    id: "3",
    title: "Avocado Toast",
    description: "Schnelles Frühstück mit frischer Avocado",
    prep_time: 10,
    servings: 2,
    tags: ["Frühstück", "Vegetarisch"],
  },
  {
    id: "4",
    title: "Beef Bourguignon",
    description: "Traditioneller französischer Rindereintopf",
    prep_time: 180,
    servings: 6,
    tags: ["Französisch", "Fleisch", "Klassiker"],
  },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#1e1e2e]">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Hero */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Meine Rezepte</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Entdecke und verwalte deine Lieblingsrezepte</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            placeholder="Rezepte suchen..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Rezepte", value: "4", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
            { label: "Kategorien", value: "8", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
            { label: "Favoriten", value: "2", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-2xl p-3 text-center ${stat.color}`}>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs">{stat.label}</div>
            </div>
          ))}
        </div>

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
            className="flex items-center gap-3 bg-zinc-800 dark:bg-zinc-700 text-white rounded-2xl p-4 transition hover:bg-zinc-700"
          >
            <TrendingUp size={22} />
            <span className="font-medium">Importieren</span>
          </Link>
        </div>

        {/* Recent Recipes */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Zuletzt hinzugefügt</h2>
          <Link href="/recipes" className="text-amber-500 text-sm font-medium">Alle anzeigen</Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {mockRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      </main>

      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
