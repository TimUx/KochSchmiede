"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface LogoSettings {
  logo_light_url?: string | null;
  logo_dark_url?: string | null;
}

export default function Logo() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [logoSettings, setLogoSettings] = useState<LogoSettings>({});

  useEffect(() => {
    setMounted(true);
    fetch(`${API}/api/settings/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setLogoSettings(data);
      })
      .catch(() => {});
  }, []);

  if (!mounted) return <div className="h-12 w-16" />;

  const isDark = resolvedTheme === "dark";
  const src = isDark
    ? (logoSettings.logo_dark_url ?? "/assets/kochschmiede_logo_dark.png")
    : (logoSettings.logo_light_url ?? "/assets/kochschmiede_logo_light.png");

  return (
    <Image
      src={src}
      alt="KochSchmiede"
      width={180}
      height={120}
      className="h-12 w-auto"
      priority
      unoptimized={src.startsWith("/api/uploads/")}
    />
  );
}
