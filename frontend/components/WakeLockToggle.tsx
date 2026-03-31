"use client";

import { useEffect, useRef, useState } from "react";
import { MonitorCheck, MonitorOff } from "lucide-react";

export default function WakeLockToggle() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setSupported("wakeLock" in navigator);
  }, []);

  // Re-acquire wake lock when the page becomes visible again (e.g. after tab switch)
  useEffect(() => {
    if (!active) return;

    async function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        try {
          const sentinel = await navigator.wakeLock.request("screen");
          sentinel.addEventListener("release", () => setActive(false), { once: true });
          wakeLockRef.current = sentinel;
        } catch {
          setActive(false);
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [active]);

  async function toggle() {
    if (active) {
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      setActive(false);
      await sentinel?.release();
    } else {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        sentinel.addEventListener("release", () => setActive(false), { once: true });
        wakeLockRef.current = sentinel;
        setActive(true);
      } catch {
        // Wake lock request failed – silently ignore (e.g. low battery policy)
      }
    }
  }

  if (!supported) return null;

  return (
    <button
      className={`p-2 rounded-xl transition ${
        active
          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:opacity-80"
      }`}
      onClick={toggle}
      aria-label={active ? "Display wach halten deaktivieren" : "Display wach halten"}
      title={active ? "Display wach halten deaktivieren" : "Display wach halten"}
    >
      {active ? <MonitorCheck size={20} /> : <MonitorOff size={20} />}
    </button>
  );
}
