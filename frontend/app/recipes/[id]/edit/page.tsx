"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";


import AppShell from "@/components/AppShell";
import IngredientGroupEditor, {
  type Ingredient,
  type IngredientGroup,
} from "@/components/IngredientGroupEditor";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, Loader2, AlertCircle, Tag, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("ks_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API}${path}`, { ...options, headers }).then(async (res) => {
    if (!res.ok) {
      const e = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(e.detail ?? "Request failed");
    }
    return res.status === 204 ? null : res.json();
  });
}

export default function RecipeEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("4");
  const [sourceUrl, setSourceUrl] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientGroups, setIngredientGroups] = useState<IngredientGroup[]>([]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    apiFetch(`/api/recipes/${id}`)
      .then((data) => {
        setTitle(data.title ?? "");
        setDescription(data.description ?? "");
        setPrepTime(data.prep_time != null ? String(data.prep_time) : "");
        setCookTime(data.cook_time != null ? String(data.cook_time) : "");
        setServings(data.servings != null ? String(data.servings) : "4");
        setSourceUrl(data.source_url ?? "");
        setIngredients(
          (data.ingredients ?? []).map(
            (i: { amount: string | null; unit: string | null; name: string }) => ({
              amount: i.amount ?? "",
              unit: i.unit ?? "",
              name: i.name,
            })
          )
        );
        setIngredientGroups(
          (data.ingredient_groups ?? []).map(
            (g: { name: string; ingredients: { amount: string | null; unit: string | null; name: string }[] }) => ({
              name: g.name,
              ingredients: g.ingredients.map(
                (i: { amount: string | null; unit: string | null; name: string }) => ({
                  amount: i.amount ?? "",
                  unit: i.unit ?? "",
                  name: i.name,
                })
              ),
            })
          )
        );
        setSteps(
          (data.steps ?? [])
            .slice()
            .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
            .map((s: { instruction: string }) => s.instruction)
        );
        setTags(data.tags ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const addStep = () => setSteps([...steps, ""]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/recipes/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          description: description || null,
          prep_time: prepTime ? parseInt(prepTime) : null,
          cook_time: cookTime ? parseInt(cookTime) : null,
          servings: servings ? parseInt(servings) : null,
          source_url: sourceUrl || null,
          ingredients: ingredients.map((ing, idx) => ({
            amount: ing.amount || null,
            unit: ing.unit || null,
            name: ing.name,
            position: idx,
          })),
          ingredient_groups: ingredientGroups.map((g, gi) => ({
            name: g.name,
            position: gi,
            ingredients: g.ingredients.map((ing, idx) => ({
              amount: ing.amount || null,
              unit: ing.unit || null,
              name: ing.name,
              position: idx,
            })),
          })),
          steps: steps
            .filter((s) => s.trim())
            .map((instruction, idx) => ({ position: idx, instruction })),
          tags,
        }),
      });
      router.push(`/recipes/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:text-white text-sm";

  return (
    <AppShell>
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-amber-500" />
        </div>
      ) : (
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-8">
        <div className="flex items-center justify-between mb-6">
          <Link href={`/recipes/${id}`} className="flex items-center gap-1 text-zinc-500 text-sm">
            <ArrowLeft size={16} /> Zurück
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>

        <h1 className="text-xl font-bold mb-6">Rezept bearbeiten</h1>

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-2xl p-3 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Titel *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Vorbereitung (Min)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Kochzeit (Min)</label>
              <input
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Portionen</label>
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quell-URL</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-1">
              <Tag size={14} /> Kategorien
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                    className="hover:text-red-500 transition"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Neue Kategorie eingeben…"
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 dark:text-white"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Zutaten</label>
            <IngredientGroupEditor
              ingredients={ingredients}
              onIngredientsChange={setIngredients}
              groups={ingredientGroups}
              onGroupsChange={setIngredientGroups}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Zubereitung</label>
              <button onClick={addStep} className="flex items-center gap-1 text-amber-500 text-sm">
                <Plus size={14} /> Schritt hinzufügen
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
                    placeholder={`Schritt ${i + 1}…`}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none dark:text-white"
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
      )}
    </AppShell>
  );
}
