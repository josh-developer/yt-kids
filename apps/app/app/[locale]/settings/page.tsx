import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createMetadata } from "@repo/seo/metadata";
import { KidsTubeApp } from "../../_shell/kids-tube-app";

type LocaleParams = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return createMetadata({
    title: t("page", { page: t("settings") }),
    description: t("settingsDescription"),
    pathname: "/settings",
    locale,
  });
}

export default async function SettingsPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <KidsTubeApp initialRoute={{ view: "settings" }} />;
}
