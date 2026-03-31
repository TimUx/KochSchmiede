"use client";

import { MonitorCheck, MonitorOff } from "lucide-react";
import { useWakeLock } from "./WakeLockContext";

export default function WakeLockToggle() {
  const { supported, active, toggle } = useWakeLock();

  return (
    <button
      className={`p-2 rounded-xl transition ${
        active
          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:opacity-80"
      } ${!supported ? "opacity-40 cursor-not-allowed" : ""}`}
      onClick={supported ? toggle : undefined}
      disabled={!supported}
      aria-label={
        !supported
          ? "Display wach halten (vom Browser nicht unterstützt)"
          : active
          ? "Display wach halten deaktivieren"
          : "Display wach halten"
      }
      aria-disabled={!supported}
      title={
        !supported
          ? "Vom Browser nicht unterstützt"
          : active
          ? "Display wach halten deaktivieren"
          : "Display wach halten"
      }
    >
      {active ? <MonitorCheck size={20} /> : <MonitorOff size={20} />}
    </button>
  );
}
