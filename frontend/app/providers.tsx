"use client";

import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";
import { WakeLockProvider } from "@/components/WakeLockContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <WakeLockProvider>{children}</WakeLockProvider>
    </ThemeProvider>
  );
}
