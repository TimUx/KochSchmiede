import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "KochSchmiede",
  description: "Self-hosted recipe management platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KochSchmiede",
  },
  icons: {
    icon: "/assets/kochschmiede_favicon_dark.png",
    apple: "/assets/kochschmiede_appicon_dark.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e1e2e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js')); }`,
          }}
        />
      </head>
      <body className="min-h-screen bg-white dark:bg-[#1e1e2e] text-gray-900 dark:text-gray-100">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
