import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Nunito } from "next/font/google";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/shared/config/i18n/routing";
import "../globals.css";
import { PwaRegistrar } from "../_providers/pwa-registrar";

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

type LocaleParams = { params: Promise<{ locale: Locale }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    applicationName: "KidTube",
    title: t("home"),
    description: t("homeDescription"),
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
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode }> & LocaleParams) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${nunitoBrand.variable} antialiased`}
      >
        <NextIntlClientProvider>
          <PwaRegistrar />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
