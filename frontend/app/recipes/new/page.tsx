"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, Camera, Upload } from "lucide-react";

export default function NewRecipePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [servings, setServings] = useState("4");
  const [ingredients, setIngredients] = useState([{ amount: "", name: "" }]);
  const [steps, setSteps] = useState([""]);

  const addIngredient = () => setIngredients([...ingredients, { amount: "", name: "" }]);
  const removeIngredient = (i: number) => setIngredients(ingredients.filter((_, idx) => idx !== i));
  const addStep = () => setSteps([...steps, ""]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#1e1e2e]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-1 text-zinc-500 text-sm">
            <ArrowLeft size={16} /> Zurück
          </Link>
          <button className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-medium">
            <Save size={16} /> Speichern
          </button>
        </div>

        <h1 className="text-xl font-bold mb-6">Neues Rezept</h1>

        {/* Image Upload */}
        <div className="mb-6 flex gap-3">
          <button className="flex-1 flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-amber-400 transition">
            <Upload size={24} />
            <span className="text-sm">Foto hochladen</span>
          </button>
          <button className="flex-1 flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-amber-400 transition">
            <Camera size={24} />
            <span className="text-sm">Foto aufnehmen</span>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Titel *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Spaghetti Carbonara"
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Kurze Beschreibung des Rezepts..."
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
                placeholder="20"
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Portionen</label>
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                placeholder="4"
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
                    placeholder={`Schritt ${i + 1}...`}
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
