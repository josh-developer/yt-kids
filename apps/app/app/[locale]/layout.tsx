import type { Metadata, Viewport } from "next";
import { Geist, Nunito } from "next/font/google";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@repo/internationalization/routing";
import { createMetadata } from "@repo/seo/metadata";
import "../globals.css";
import { PwaRegistrar } from "../_providers/pwa-registrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
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

  return createMetadata({
    title: t("home"),
    description: t("homeDescription"),
  });
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
      {/*
        No media preconnects here any more. Thumbnails are served from our own
        origin, so they reuse the connection the document already opened, and
        the embed's hosts are only wanted once a player mounts —
        `warmYouTubeOrigins` adds those, still ahead of the embed itself.
      */}
      <body
        className={`${geistSans.variable} ${nunitoBrand.variable} antialiased`}
      >
        <NextIntlClientProvider>
          <PwaRegistrar />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
