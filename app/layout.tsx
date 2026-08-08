import type { Metadata } from "next";
import { Geist, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { PwaRegistrar } from "./pwa-registrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const nunitoBrand = Nunito({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["900"],
});

export const metadata: Metadata = {
  applicationName: "KidTube",
  title: "KidTube",
  description: "A parent-curated YouTube-style video room for kids.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KidTube",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  other: {
    "theme-color": "#fff9e8",
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${nunitoBrand.variable} antialiased`}
      >
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
