import Link from "next/link";
import { WifiOff, Home } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#1e1e2e] text-white flex flex-col items-center justify-center p-8 text-center">
      <WifiOff size={64} className="text-amber-500 mb-6" />
      <h1 className="text-3xl font-bold mb-2">Du bist offline</h1>
      <p className="text-zinc-400 mb-8 max-w-sm">
        Keine Internetverbindung. Gecachte Rezepte sind weiterhin verfügbar.
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-2xl font-medium"
      >
        <Home size={18} /> Zur Startseite
      </Link>
    </div>
  );
}
