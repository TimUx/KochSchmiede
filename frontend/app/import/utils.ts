import { KNOWN_UNITS } from "@/app/import/constants";
import type { ImportResult } from "@/app/import/types";

export function parseIngredient(raw: string): { amount: string; unit: string; name: string } {
  const trimmed = raw.trim().replace(/^(?:ca\.\s*|etwa\s*|[~≈]\s*)/i, "");
  const FRAC = "\u00BC-\u00BE\u2150-\u215E";
  const AMT =
    `(?:\\d+[,.]?\\d*(?:\\s*/\\s*\\d+)?(?:\\s*[${FRAC}])?` +
    `|[${FRAC}]` +
    `|n\\.?\\s*[Bb]\\.)`;

  const unitAlt = KNOWN_UNITS
    .map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const withUnit = new RegExp(`^(${AMT})\\s+(${unitAlt})\\.?\\s+(.+)$`, "iu");
  const withAmountOnly = new RegExp(`^(${AMT})\\s+(.+)$`, "iu");

  let m = trimmed.match(withUnit);
  if (m) {
    return { amount: m[1].replace(",", ".").trim(), unit: m[2].trim(), name: m[3].trim() };
  }
  m = trimmed.match(withAmountOnly);
  if (m) {
    return { amount: m[1].replace(",", ".").trim(), unit: "", name: m[2].trim() };
  }
  return { amount: "", unit: "", name: trimmed };
}

export function buildRecipePayload(result: ImportResult) {
  const ingredients = result.ingredients.map((raw, idx) => {
    const { amount, unit, name } = parseIngredient(raw);
    return { amount: amount || null, unit: unit || null, name, position: idx };
  });

  const ingredient_groups = result.ingredient_groups.map((g, gi) => ({
    name: g.name,
    position: gi,
    ingredients: g.ingredients.map((raw, idx) => {
      const { amount, unit, name } = parseIngredient(raw);
      return { amount: amount || null, unit: unit || null, name, position: idx };
    }),
  }));

  const steps = result.steps.map((instruction, idx) => ({
    position: idx,
    instruction,
  }));

  return {
    title: result.title || "Importiertes Rezept",
    description: result.description ?? null,
    image_url: result.image_url ?? null,
    source_url: result.source_url ?? null,
    prep_time: result.prep_time ?? null,
    cook_time: result.cook_time ?? null,
    servings: result.servings ?? null,
    ingredients,
    ingredient_groups,
    steps,
    tags: result.tags,
  };
}
