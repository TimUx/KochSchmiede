"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import WakeLockToggle from "./WakeLockToggle";
import { LogIn, LogOut } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem("ks_token"));

    function onStorage(e: StorageEvent) {
      if (e.key === "ks_token") {
        setLoggedIn(!!e.newValue);
      }
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
    <nav className="lg:hidden w-full flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm sticky top-0 z-50">
      <Logo />
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <WakeLockToggle />
        <ThemeToggle />
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
    </nav>
  );
}
