export type ImportTab = "url" | "file" | "camera";

export type IngredientGroup = {
  name: string;
  ingredients: string[];
};

export type ImportResult = {
  title?: string;
  description?: string;
  image_url?: string;
  source_url?: string;
  ingredients: string[];
  ingredient_groups: IngredientGroup[];
  steps: string[];
  tags: string[];
  prep_time?: number;
  cook_time?: number;
  servings?: number;
  import_warning?: string;
};

export type ImageSearchItem = {
  thumb_url: string;
  url: string;
  photographer: string;
  source_url: string;
  source?: string;
  source_name?: string;
  source_home?: string;
};
