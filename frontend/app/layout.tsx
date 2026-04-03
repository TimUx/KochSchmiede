import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

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
    icon: "/assets/kochschmiede_icon_192.png",
    apple: "/assets/kochschmiede_icon_192.png",
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
      </head>
      <body className="min-h-screen bg-white dark:bg-[#1e1e2e] text-gray-900 dark:text-gray-100">
        <Providers>
          <ServiceWorkerRegistration />
          {children}
        </Providers>
      </body>
    </html>
  );
}
