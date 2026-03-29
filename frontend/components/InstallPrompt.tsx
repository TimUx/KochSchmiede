"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-zinc-900 dark:bg-zinc-800 text-white rounded-2xl p-4 shadow-xl z-50 flex items-center gap-3">
      <Download size={20} className="text-amber-400 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold text-sm">App installieren</p>
        <p className="text-xs text-zinc-400">KochSchmiede als App installieren</p>
      </div>
      <button
        onClick={install}
        className="bg-amber-500 text-white text-sm px-3 py-1.5 rounded-xl font-medium"
      >
        Install
      </button>
      <button onClick={() => setShow(false)} className="text-zinc-400 hover:text-white">
        <X size={18} />
      </button>
    </div>
  );
}
