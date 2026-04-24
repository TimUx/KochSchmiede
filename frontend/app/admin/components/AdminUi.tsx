"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Check, X } from "lucide-react";

export function SectionCard({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  icon: LucideIcon;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Icon size={16} className="text-amber-500" />
          {title}
        </h2>
        {description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function InlineAlert({
  tone,
  message,
  onClose,
}: {
  tone: "error" | "success";
  message: string;
  onClose?: () => void;
}) {
  const toneClass =
    tone === "error"
      ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
      : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800";
  const Icon = tone === "error" ? AlertCircle : Check;

  return (
    <div className={`flex items-center gap-2 border rounded-xl p-2 text-xs ${toneClass}`}>
      <Icon size={12} className="shrink-0" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose}>
          <X size={12} />
        </button>
      )}
    </div>
  );
}
