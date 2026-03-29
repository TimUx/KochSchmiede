"use client";

import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";
import { User, Bell, Database, Lock, Info, ChevronRight, Globe, Palette, Download, ShieldCheck } from "lucide-react";

const settingsSections = [
  {
    title: "Darstellung",
    items: [
      { icon: Palette, label: "Theme", description: "Hell / Dunkel", action: "toggle" as const },
      { icon: Globe, label: "Sprache", description: "Deutsch / English", action: "arrow" as const },
    ],
  },
  {
    title: "Konto",
    items: [
      { icon: User, label: "Profil", description: "Name und Avatar", action: "arrow" as const },
      { icon: Lock, label: "Sicherheit", description: "Passwort ändern", action: "arrow" as const },
      { icon: Bell, label: "Benachrichtigungen", description: "Push-Mitteilungen", action: "arrow" as const },
    ],
  },
  {
    title: "Daten",
    items: [
      { icon: Database, label: "Backup", description: "Rezepte sichern", action: "arrow" as const },
      { icon: Download, label: "Export", description: "Als JSON exportieren", action: "arrow" as const },
    ],
  },
  {
    title: "Info",
    items: [
      { icon: Info, label: "Über KochSchmiede", description: "Version 1.0.0", action: "arrow" as const },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#1e1e2e]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <h1 className="text-2xl font-bold mb-6">Einstellungen</h1>

        {/* Admin panel link */}
        <Link
          href="/admin"
          className="flex items-center gap-3 w-full bg-amber-500 hover:bg-amber-600 text-white rounded-2xl px-4 py-3.5 mb-6 transition"
        >
          <ShieldCheck size={20} />
          <div className="flex-1">
            <div className="font-semibold text-sm">Admin-Bereich</div>
            <div className="text-xs text-amber-100">Sichtbarkeit, Registrierung, Benutzer</div>
          </div>
          <ChevronRight size={16} className="text-amber-200" />
        </Link>

        <div className="space-y-6">
          {settingsSections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2 px-1">
                {section.title}
              </h2>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                {section.items.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className={`flex items-center gap-4 px-4 py-3.5 ${
                        i !== section.items.length - 1
                          ? "border-b border-zinc-100 dark:border-zinc-800"
                          : ""
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        <Icon size={18} className="text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.label}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {item.description}
                        </div>
                      </div>
                      {item.action === "toggle" ? (
                        <ThemeToggle />
                      ) : (
                        <ChevronRight size={16} className="text-zinc-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
