"use client";

import { useState } from "react";
import { Globe } from "lucide-react";

const languages = [
  { code: "de", label: "DE" },
  { code: "en", label: "EN" },
];

export default function LanguageSwitcher() {
  const [current, setCurrent] = useState("de");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition hover:opacity-80 flex items-center gap-1 text-sm"
        onClick={() => setOpen(!open)}
        aria-label="Language"
      >
        <Globe size={16} />
        <span>{current.toUpperCase()}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`block w-full px-4 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 transition ${current === lang.code ? "text-amber-500 font-semibold" : ""}`}
              onClick={() => { setCurrent(lang.code); setOpen(false); }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
