import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Vini POS — one platform for every restaurant workflow",
    template: "%s · Vini POS",
  },
  description:
    "Vini POS is a modular restaurant operations platform. Orders, POS, KOT, Captain, Payments and Inventory — one system, configured per organization.",
  icons: { icon: "/brand/vini-pos-logo-transparent.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f1ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c08" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="grain antialiased">{children}</body>
    </html>
  );
}
