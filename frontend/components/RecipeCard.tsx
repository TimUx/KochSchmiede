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

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
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
              sizes="(max-width: 768px) 100vw, 50vw"
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
