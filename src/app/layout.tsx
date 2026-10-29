import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "./broker.css";
import "./phuket.css";
import { SettingsProvider } from "@/components/context";
import { Header, Footer } from "@/components/header";
export const metadata: Metadata = {
  title: {
    default: "PhuketLens · Find your place in Phuket.",
    template: "%s · PhuketLens",
  },
  description:
    "Explore homes and property across Phuket by zone on a map. Buy direct from owners or through agents.",
  robots:
    process.env.NEXT_PUBLIC_DATA_MODE === "live"
      ? { index: true, follow: true }
      : { index: false, follow: false },
  ...(process.env.NEXT_PUBLIC_SITE_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) }
    : {}),
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SettingsProvider>
          <Header />
          {children}
          <Footer />
        </SettingsProvider>
      </body>
    </html>
  );
}
