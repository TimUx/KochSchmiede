import type { Ingredient, IngredientGroup } from "@/components/IngredientGroupEditor";

type RawIngredient = { amount: string | null; unit: string | null; name: string };
type RawGroup = { name: string; ingredients: RawIngredient[] };

export function mapIngredientsFromApi(items: RawIngredient[]): Ingredient[] {
  return (items ?? []).map((i) => ({
    amount: i.amount ?? "",
    unit: i.unit ?? "",
    name: i.name,
  }));
}

export function mapIngredientGroupsFromApi(groups: RawGroup[]): IngredientGroup[] {
  return (groups ?? []).map((g) => ({
    name: g.name,
    ingredients: mapIngredientsFromApi(g.ingredients),
  }));
}

export function buildUpdatePayload(input: {
  title: string;
  description: string;
  imageUrl: string | null;
  prepTime: string;
  cookTime: string;
  servings: string;
  sourceUrl: string;
  ingredients: Ingredient[];
  ingredientGroups: IngredientGroup[];
  steps: string[];
  tags: string[];
}) {
  return {
    title: input.title,
    description: input.description || null,
    image_url: input.imageUrl,
    prep_time: input.prepTime ? parseInt(input.prepTime) : null,
    cook_time: input.cookTime ? parseInt(input.cookTime) : null,
    servings: input.servings ? parseInt(input.servings) : null,
    source_url: input.sourceUrl || null,
    ingredients: input.ingredients.map((ing, idx) => ({
      amount: ing.amount || null,
      unit: ing.unit || null,
      name: ing.name,
      position: idx,
    })),
    ingredient_groups: input.ingredientGroups.map((g, gi) => ({
      name: g.name,
      position: gi,
      ingredients: g.ingredients.map((ing, idx) => ({
        amount: ing.amount || null,
        unit: ing.unit || null,
        name: ing.name,
        position: idx,
      })),
    })),
    steps: input.steps
      .filter((s) => s.trim())
      .map((instruction, idx) => ({ position: idx, instruction })),
    tags: input.tags,
  };
}
