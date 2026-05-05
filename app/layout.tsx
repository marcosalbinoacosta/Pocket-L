import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Caveat } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono  = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const hand  = Caveat({ subsets: ["latin"], variable: "--font-hand", display: "swap", weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "+LATINA · UINL",
  description: "Gestión de contactos en Congreso UINL"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#441855"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${mono.variable} ${hand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
