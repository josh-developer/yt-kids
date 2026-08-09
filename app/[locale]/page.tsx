import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { KidsTubeApp } from "../_shell/kids-tube-app";

type LocaleParams = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: t("home"),
    description: t("homeDescription"),
  };
}

export default async function Home({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <KidsTubeApp />;
}
