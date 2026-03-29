"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Book, PlusCircle, Download, Settings, ShieldCheck } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/recipes", icon: Book, label: "Rezepte" },
  { href: "/recipes/new", icon: PlusCircle, label: "Neu" },
  { href: "/import", icon: Download, label: "Import" },
  { href: "/settings", icon: Settings, label: "Einstellungen" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#1e1e2e] border-t border-zinc-200 dark:border-zinc-800 pb-safe print:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl min-w-[3rem] transition-all ${
                active
                  ? "text-amber-500"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
