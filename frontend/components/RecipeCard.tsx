import Link from "next/link";
import Image from "next/image";
import { Clock, Users, User } from "lucide-react";

interface Recipe {
  id: string;
  title: string;
  description?: string;
  image?: string;
  prep_time?: number;
  servings?: number;
  tags?: string[];
  owner_username?: string;
}

interface RecipeCardProps {
  recipe: Recipe;
  variant?: "grid" | "list";
}

export default function RecipeCard({ recipe, variant = "grid" }: RecipeCardProps) {
  if (variant === "list") {
    return (
      <Link href={`/recipes/${recipe.id}`} className="block">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-800 hover:shadow-md transition-shadow flex">
          <div className="shrink-0 w-24 h-24 relative">
            {recipe.image ? (
              <Image
                src={recipe.image}
                alt={recipe.title}
                fill
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <span className="text-2xl">🍳</span>
              </div>
            )}
          </div>
          <div className="p-3 flex-1 min-w-0">
            <h3 className="font-semibold text-base mb-0.5 line-clamp-1">{recipe.title}</h3>
            {recipe.description && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1 mb-1">{recipe.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              {recipe.prep_time && (
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {recipe.prep_time} Min
                </span>
              )}
              {recipe.servings && (
                <span className="flex items-center gap-1">
                  <Users size={12} /> {recipe.servings}
                </span>
              )}
              {recipe.owner_username && (
                <span className="flex items-center gap-1 ml-auto" aria-label={`Rezept von ${recipe.owner_username}`}>
                  <User size={12} aria-hidden="true" /> {recipe.owner_username}
                </span>
              )}
            </div>
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {recipe.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/recipes/${recipe.id}`} className="block">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-800 hover:shadow-md transition-shadow">
        {recipe.image ? (
          <div className="relative w-full h-40">
            <Image
              src={recipe.image}
              alt={recipe.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <span className="text-4xl">🍳</span>
          </div>
        )}
        <div className="p-4">
          <h3 className="font-semibold text-base mb-1 line-clamp-1">{recipe.title}</h3>
          {recipe.description && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-3">{recipe.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            {recipe.prep_time && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> {recipe.prep_time} Min
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1">
                <Users size={12} /> {recipe.servings}
              </span>
            )}
            {recipe.owner_username && (
              <span className="flex items-center gap-1 ml-auto" aria-label={`Rezept von ${recipe.owner_username}`}>
                <User size={12} aria-hidden="true" /> {recipe.owner_username}
              </span>
            )}
          </div>
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {recipe.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
