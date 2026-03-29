import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import RecipeCard from "@/components/RecipeCard";
import { Search, SlidersHorizontal } from "lucide-react";

const mockRecipes = [
  { id: "1", title: "Spaghetti Carbonara", description: "Klassische italienische Pasta", prep_time: 20, servings: 4, tags: ["Pasta", "Italienisch"] },
  { id: "2", title: "Chicken Tikka Masala", description: "Würziges Currygericht", prep_time: 45, servings: 4, tags: ["Indisch", "Curry"] },
  { id: "3", title: "Avocado Toast", description: "Schnelles Frühstück", prep_time: 10, servings: 2, tags: ["Frühstück"] },
  { id: "4", title: "Beef Bourguignon", description: "Französischer Rindereintopf", prep_time: 180, servings: 6, tags: ["Französisch"] },
  { id: "5", title: "Caesar Salad", description: "Frischer Salat mit Croutons", prep_time: 15, servings: 2, tags: ["Salat"] },
  { id: "6", title: "Tiramisu", description: "Italienisches Dessert", prep_time: 30, servings: 8, tags: ["Dessert", "Italienisch"] },
];

const categories = ["Alle", "Pasta", "Salat", "Dessert", "Fleisch", "Vegetarisch", "Suppe"];

export default function RecipesPage() {
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

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            placeholder="Rezepte suchen..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                cat === "Alle"
                  ? "bg-amber-500 text-white"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {mockRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
