"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

interface WakeLockContextType {
  supported: boolean;
  active: boolean;
  toggle: () => Promise<void>;
}

const WakeLockContext = createContext<WakeLockContextType>({
  supported: false,
  active: false,
  toggle: async () => {},
});

export function WakeLockProvider({ children }: { children: ReactNode }) {
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

  return (
    <WakeLockContext.Provider value={{ supported, active, toggle }}>
      {children}
    </WakeLockContext.Provider>
  );
}

export function useWakeLock() {
  return useContext(WakeLockContext);
}
