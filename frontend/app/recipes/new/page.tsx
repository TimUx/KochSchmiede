"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import IngredientGroupEditor, {
  type Ingredient,
  type IngredientGroup,
} from "@/components/IngredientGroupEditor";
import HelpButton from "@/components/HelpButton";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, Loader2, AlertCircle, Tag, X, Upload } from "lucide-react";

const NEW_RECIPE_HELP = {
  title: "Neues Rezept erstellen",
  sections: [
    {
      items: [
        "Gib Titel und optional eine Beschreibung für dein Rezept ein.",
        "Füge Zutaten mit Menge, Einheit und Name hinzu. Du kannst Zutatengruppen (z.B. 'Teig', 'Füllung') anlegen.",
        "Trage die Zubereitungsschritte in der richtigen Reihenfolge ein.",
        "Ergänze optional Tags (z.B. 'vegetarisch', 'schnell'), Portionen und Zeitangaben.",
        "Klicke auf 'Speichern', um das Rezept zu sichern.",
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

export default function NewRecipePage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("4");
  const [sourceUrl, setSourceUrl] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ amount: "", unit: "", name: "" }]);
  const [ingredientGroups, setIngredientGroups] = useState<IngredientGroup[]>([]);
  const [steps, setSteps] = useState([""]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagInputFocused, setTagInputFocused] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/recipes/tags")
      .then((data: string[]) => setAllTags(data))
      .catch(() => {/* ignore – suggestions are optional */});
  }, []);

  const tagSuggestions = allTags.filter(
    (t) => t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t)
  );

  const addTag = (name?: string) => {
    const t = (name ?? tagInput).trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const addStep = () => setSteps([...steps, ""]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadImage(file: File): Promise<string> {
    const token = localStorage.getItem("ks_token");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/api/recipes/upload-image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(e.detail ?? "Bild-Upload fehlgeschlagen");
    }
    const data = await res.json();
    return data.url;
  }

  async function handleSave() {
    if (!title.trim()) { setError("Titel ist erforderlich"); return; }
    setSaving(true);
    setError(null);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }
      const data = await apiFetch("/api/recipes/", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description || null,
          image_url: imageUrl,
          prep_time: prepTime ? parseInt(prepTime) : null,
          cook_time: cookTime ? parseInt(cookTime) : null,
          servings: servings ? parseInt(servings) : null,
          source_url: sourceUrl || null,
          ingredients: ingredients
            .filter((i) => i.name.trim())
            .map((ing, idx) => ({
              amount: ing.amount || null,
              unit: ing.unit || null,
              name: ing.name,
              position: idx,
            })),
          ingredient_groups: ingredientGroups.map((g, gi) => ({
            name: g.name,
            position: gi,
            ingredients: g.ingredients
              .filter((i) => i.name.trim())
              .map((ing, idx) => ({
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
      router.push(`/recipes/${data.id}`);
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
      <main className="w-full px-4 py-6 pb-24 lg:pb-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/recipes" className="flex items-center gap-1 text-zinc-500 text-sm">
            <ArrowLeft size={16} /> Zurück
          </Link>
          <div className="flex items-center gap-1">
            <HelpButton content={NEW_RECIPE_HELP} />
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>

        <h1 className="text-xl font-bold mb-6">Neues Rezept</h1>

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-2xl p-3 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Titel *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Spaghetti Carbonara"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Kurze Beschreibung des Rezepts…"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Bild</label>
            {imagePreview && (
              <div className="relative w-full h-48 rounded-2xl overflow-hidden mb-2 bg-zinc-100 dark:bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Vorschau" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full hover:bg-black/80 transition"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <label className={`${inputCls} flex items-center gap-2 cursor-pointer`}>
              <Upload size={16} className="text-zinc-400 shrink-0" />
              <span className="text-zinc-400 text-sm">
                {imageFile ? imageFile.name : "Bild auswählen…"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Vorbereitung (Min)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                placeholder="20"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Kochzeit (Min)</label>
              <input
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                placeholder="15"
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
                placeholder="4"
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
            <div className="relative">
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  onFocus={() => setTagInputFocused(true)}
                  onBlur={() => setTagInputFocused(false)}
                  placeholder="Kategorie eingeben und Enter drücken…"
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => addTag()}
                  className="px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium"
                >
                  <Plus size={16} />
                </button>
              </div>
              {tagInputFocused && tagSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                  {tagSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 text-zinc-700 dark:text-zinc-300 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
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
    </AppShell>
  );
}
