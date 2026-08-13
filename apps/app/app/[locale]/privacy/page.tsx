import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createMetadata } from "@repo/seo/metadata";
import { PrivacyPage } from "@/pages/privacy";

type LocaleParams = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return createMetadata({
    title: t("page", { page: t("privacy") }),
    description: t("privacyDescription"),
  });
}

export default async function Privacy({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PrivacyPage />;
}
