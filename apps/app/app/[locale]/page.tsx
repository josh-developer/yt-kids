import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd } from "@repo/seo/json-ld";
import { PRODUCTION_ORIGIN, createMetadata } from "@repo/seo/metadata";
import { KidsTubeApp } from "../_shell/kids-tube-app";

type LocaleParams = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return createMetadata({
    title: t("home"),
    description: t("homeDescription"),
    pathname: "/",
    locale,
  });
}

export default async function Home({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return (
    <>
      {/* Structured data for the home page only: one entity, stated once. */}
      <JsonLd
        code={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "KidTube",
          url: `${PRODUCTION_ORIGIN}/${locale}`,
          description: t("homeDescription"),
          applicationCategory: "EntertainmentApplication",
          operatingSystem: "Any",
          isFamilyFriendly: true,
          inLanguage: locale,
          isAccessibleForFree: true,
        }}
      />
      <KidsTubeApp />
    </>
  );
}
