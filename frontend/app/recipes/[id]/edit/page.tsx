"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { use } from "react";

export default function RecipeEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [title, setTitle] = useState("Spaghetti Carbonara");
  const [description, setDescription] = useState("Klassische Carbonara mit Ei und Käse");
  const [prepTime, setPrepTime] = useState("20");
  const [servings, setServings] = useState("4");
  const [ingredients, setIngredients] = useState([
    { amount: "400g", name: "Spaghetti" },
    { amount: "200g", name: "Guanciale" },
  ]);
  const [steps, setSteps] = useState([
    "Wasser kochen und Pasta al dente kochen.",
    "Guanciale knusprig braten.",
  ]);

  const addIngredient = () => setIngredients([...ingredients, { amount: "", name: "" }]);
  const removeIngredient = (i: number) => setIngredients(ingredients.filter((_, idx) => idx !== i));
  const addStep = () => setSteps([...steps, ""]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#1e1e2e]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <Link href={`/recipes/${id}`} className="flex items-center gap-1 text-zinc-500 text-sm">
            <ArrowLeft size={16} /> Zurück
          </Link>
          <button className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-medium">
            <Save size={16} /> Speichern
          </button>
        </div>

        <h1 className="text-xl font-bold mb-6">Rezept bearbeiten</h1>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Titel</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Vorbereitung (Min)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Portionen</label>
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Zutaten</label>
              <button onClick={addIngredient} className="flex items-center gap-1 text-amber-500 text-sm">
                <Plus size={14} /> Hinzufügen
              </button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={ing.amount}
                    onChange={(e) => {
                      const updated = [...ingredients];
                      updated[i].amount = e.target.value;
                      setIngredients(updated);
                    }}
                    placeholder="Menge"
                    className="w-24 px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    value={ing.name}
                    onChange={(e) => {
                      const updated = [...ingredients];
                      updated[i].name = e.target.value;
                      setIngredients(updated);
                    }}
                    placeholder="Zutat"
                    className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button onClick={() => removeIngredient(i)} className="p-2 text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Zubereitung</label>
              <button onClick={addStep} className="flex items-center gap-1 text-amber-500 text-sm">
                <Plus size={14} /> Hinzufügen
              </button>
            </div>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-2">
                  <div className="shrink-0 w-7 h-7 mt-2 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <textarea
                    value={step}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[i] = e.target.value;
                      setSteps(updated);
                    }}
                    rows={2}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                  <button onClick={() => removeStep(i)} className="p-2 text-red-500 mt-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
