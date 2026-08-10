import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createMetadata } from "@repo/seo/metadata";
import { KidsTubeApp } from "../../../_shell/kids-tube-app";

type WatchParams = { params: Promise<{ locale: Locale; videoId: string }> };

export async function generateMetadata({
  params,
}: WatchParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return createMetadata({
    title: t("page", { page: t("watch") }),
    description: t("watchDescription"),
  });
}

export default async function WatchPage({ params }: WatchParams) {
  const { locale, videoId } = await params;
  setRequestLocale(locale);

  return <KidsTubeApp initialRoute={{ view: "watch", videoId }} />;
}
