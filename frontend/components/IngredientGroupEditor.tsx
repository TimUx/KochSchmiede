"use client";

import { Plus, Trash2 } from "lucide-react";

export const UNITS = [
  "keine Einheit",
  "g",
  "kg",
  "ml",
  "l",
  "EL",
  "TL",
  "Tasse",
  "Prise",
  "Msp.",
  "Stück",
  "Scheibe(n)",
  "Bund",
  "Packung",
  "Dose",
  "Glas",
  "cm",
  "nach Geschmack",
];

export type Ingredient = { amount: string; unit: string; name: string };
export type IngredientGroup = { name: string; ingredients: Ingredient[] };

const inputCls =
  "px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400";

function IngredientRow({
  ing,
  onChange,
  onRemove,
}: {
  ing: Ingredient;
  onChange: (updated: Ingredient) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-2 items-center">
      <input
        value={ing.amount}
        onChange={(e) => onChange({ ...ing, amount: e.target.value })}
        placeholder="Menge"
        className={`w-16 ${inputCls}`}
      />
      <select
        value={ing.unit}
        onChange={(e) => onChange({ ...ing, unit: e.target.value })}
        className={`w-32 ${inputCls}`}
      >
        <option value="" disabled>
          Einheit
        </option>
        {UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <input
        value={ing.name}
        onChange={(e) => onChange({ ...ing, name: e.target.value })}
        placeholder="Zutat"
        className={`flex-1 ${inputCls}`}
      />
      <button onClick={onRemove} className="p-2 text-red-500 shrink-0" type="button" aria-label="Zutat entfernen">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

interface Props {
  /** Ungrouped ingredients (shown above any groups) */
  ingredients: Ingredient[];
  onIngredientsChange: (v: Ingredient[]) => void;
  /** Named ingredient groups */
  groups: IngredientGroup[];
  onGroupsChange: (v: IngredientGroup[]) => void;
}

export default function IngredientGroupEditor({
  ingredients,
  onIngredientsChange,
  groups,
  onGroupsChange,
}: Props) {
  // ── helpers for ungrouped ─────────────────────────────────────────────────
  const addIngredient = () =>
    onIngredientsChange([...ingredients, { amount: "", unit: "", name: "" }]);

  const updateIngredient = (i: number, val: Ingredient) => {
    const updated = [...ingredients];
    updated[i] = val;
    onIngredientsChange(updated);
  };

  const removeIngredient = (i: number) =>
    onIngredientsChange(ingredients.filter((_, idx) => idx !== i));

  // ── helpers for groups ────────────────────────────────────────────────────
  const addGroup = () =>
    onGroupsChange([...groups, { name: "Neue Gruppe", ingredients: [{ amount: "", unit: "", name: "" }] }]);

  const removeGroup = (gi: number) =>
    onGroupsChange(groups.filter((_, idx) => idx !== gi));

  const updateGroupName = (gi: number, name: string) => {
    const updated = [...groups];
    updated[gi] = { ...updated[gi], name };
    onGroupsChange(updated);
  };

  const addGroupIngredient = (gi: number) => {
    const updated = [...groups];
    updated[gi] = {
      ...updated[gi],
      ingredients: [...updated[gi].ingredients, { amount: "", unit: "", name: "" }],
    };
    onGroupsChange(updated);
  };

  const updateGroupIngredient = (gi: number, ii: number, val: Ingredient) => {
    const updated = [...groups];
    const ings = [...updated[gi].ingredients];
    ings[ii] = val;
    updated[gi] = { ...updated[gi], ingredients: ings };
    onGroupsChange(updated);
  };

  const removeGroupIngredient = (gi: number, ii: number) => {
    const updated = [...groups];
    updated[gi] = {
      ...updated[gi],
      ingredients: updated[gi].ingredients.filter((_, idx) => idx !== ii),
    };
    onGroupsChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Ungrouped ingredients */}
      {(ingredients.length > 0 || groups.length === 0) && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">
              {groups.length === 0 ? "Zutaten" : "Allgemeine Zutaten"}
            </label>
            <button
              type="button"
              onClick={addIngredient}
              className="flex items-center gap-1 text-amber-500 text-sm"
            >
              <Plus size={14} /> Hinzufügen
            </button>
          </div>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <IngredientRow
                key={i}
                ing={ing}
                onChange={(v) => updateIngredient(i, v)}
                onRemove={() => removeIngredient(i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Named groups */}
      {groups.map((group, gi) => (
        <div
          key={gi}
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <input
              value={group.name}
              onChange={(e) => updateGroupName(gi, e.target.value)}
              placeholder="Gruppenname (z.B. Teig, Sauce, Füllung)"
              className={`flex-1 font-medium ${inputCls}`}
            />
            <button
              type="button"
              onClick={() => removeGroup(gi)}
              className="p-2 text-red-500 shrink-0"
              aria-label="Gruppe entfernen"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {group.ingredients.map((ing, ii) => (
              <IngredientRow
                key={ii}
                ing={ing}
                onChange={(v) => updateGroupIngredient(gi, ii, v)}
                onRemove={() => removeGroupIngredient(gi, ii)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => addGroupIngredient(gi)}
            className="flex items-center gap-1 text-amber-500 text-sm mt-1"
          >
            <Plus size={14} /> Zutat hinzufügen
          </button>
        </div>
      ))}

      {/* Add group button */}
      <button
        type="button"
        onClick={addGroup}
        className="flex items-center gap-1 text-amber-500 text-sm border border-dashed border-amber-400 rounded-xl px-3 py-2 w-full justify-center hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
      >
        <Plus size={14} /> Zutatengruppe hinzufügen
      </button>
    </div>
  );
}
