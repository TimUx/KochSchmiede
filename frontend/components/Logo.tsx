"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function Logo() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-8 w-12" />;

  const isDark = resolvedTheme === "dark";

  return (
    <Image
      src={isDark ? "/assets/kochschmiede_logo_dark.png" : "/assets/kochschmiede_logo_light.png"}
      alt="KochSchmiede"
      width={120}
      height={80}
      className="h-8 w-auto"
      priority
    />
  );
}
