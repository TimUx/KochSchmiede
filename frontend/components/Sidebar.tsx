"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import WakeLockToggle from "./WakeLockToggle";
import { navItems } from "./navConfig";
import { LogIn, LogOut } from "lucide-react";

const sidebarLabels: Record<string, string> = {
  "/": "Home",
  "/recipes": "Rezepte",
  "/recipes/new": "Neues Rezept",
  "/import": "Import",
  "/settings": "Einstellungen",
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem("ks_token"));
    function onStorage(e: StorageEvent) {
      if (e.key === "ks_token") setLoggedIn(!!e.newValue);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function handleLogout() {
    localStorage.removeItem("ks_token");
    localStorage.removeItem("ks_username");
    setLoggedIn(false);
    router.push("/login");
  }

  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 shadow-sm z-40 print:hidden">
      {/* Logo */}
      <div className="flex items-center px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
        <Logo />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, icon: Icon }) => {
          const label = sidebarLabels[href] ?? href;
          const active =
            pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom controls */}
      <div className="px-3 py-4 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <WakeLockToggle />
            <ThemeToggle />
          </div>
          {loggedIn ? (
            <button
              onClick={handleLogout}
              title="Abmelden"
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <LogOut size={18} />
            </button>
          ) : (
            <button
              onClick={() => router.push("/login")}
              title="Anmelden"
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <LogIn size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
