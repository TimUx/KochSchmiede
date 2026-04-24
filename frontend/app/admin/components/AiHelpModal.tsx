"use client";

import { ExternalLink, HelpCircle, X } from "lucide-react";

export default function AiHelpModal({
  title,
  steps,
  link,
  linkLabel,
  onClose,
}: {
  title: string;
  steps: string[];
  link: string;
  linkLabel: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <HelpCircle size={16} className="text-amber-500" />
          </div>
          <h3 className="font-semibold text-sm flex-1">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <ol className="space-y-2.5">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300 leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="px-5 pb-5">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition"
          >
            <ExternalLink size={15} />
            {linkLabel} öffnen
          </a>
        </div>
      </div>
    </div>
  );
}
