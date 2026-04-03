"use client";

import { useState } from "react";
import { HelpCircle, X, ExternalLink } from "lucide-react";

interface HelpSection {
  heading?: string;
  items: string[];
}

export interface HelpContent {
  title: string;
  sections: HelpSection[];
  docsLinks?: { label: string; url: string }[];
}

interface HelpButtonProps {
  content: HelpContent;
  className?: string;
}

export default function HelpButton({ content, className = "" }: HelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`p-2 rounded-xl text-zinc-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition ${className}`}
        aria-label="Hilfe anzeigen"
        title="Hilfe"
      >
        <HelpCircle size={20} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <HelpCircle size={16} className="text-amber-500" />
              </div>
              <h3 className="font-semibold text-sm flex-1">{content.title}</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
                aria-label="Schließen"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {content.sections.map((section, si) => (
                <div key={section.heading ?? si}>
                  {section.heading && (
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
                      {section.heading}
                    </p>
                  )}
                  <ul className="space-y-1.5">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300 leading-snug">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Docs links */}
            {content.docsLinks && content.docsLinks.length > 0 && (
              <div className="px-5 pb-5 space-y-2">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">Weitere Informationen:</p>
                {content.docsLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition"
                  >
                    <ExternalLink size={15} />
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
