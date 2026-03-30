import { Home, Book, PlusCircle, Download, Settings } from "lucide-react";

export const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/recipes", icon: Book, label: "Rezepte" },
  { href: "/recipes/new", icon: PlusCircle, label: "Neu" },
  { href: "/import", icon: Download, label: "Import" },
  { href: "/settings", icon: Settings, label: "Einstellungen" },
] as const;
