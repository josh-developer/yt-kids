import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CURATED_UZBEK_OLD_CARTOONS } from "@repo/catalog";
import { createMetadata } from "@repo/seo/metadata";
import { isVideoId, thumbnailUrl } from "@/shared/api/youtube";
import { KidsTubeApp } from "../../../_shell/kids-tube-app";

type WatchParams = { params: Promise<{ locale: Locale; videoId: string }> };

/**
 * The route param is a library id, not a YouTube id. The parent's library
 * lives on the device, so the server can only resolve what ships with the
 * app: catalog entries give a real title and thumbnail, and a parent-added
 * `custom-<youtubeId>` id still yields the right thumbnail for share cards.
 */
function findCatalogVideo(id: string) {
  return (
    CURATED_UZBEK_OLD_CARTOONS.find((video) => video.id === id) ?? null
  );
}

function shareThumbnail(routeId: string) {
  const catalogVideo = findCatalogVideo(routeId);
  const youtubeId =
    catalogVideo?.videoId ?? routeId.replace(/^custom-/, "");

  return isVideoId(youtubeId)
    ? thumbnailUrl(youtubeId, "poster")
    : undefined;
}

export async function generateMetadata({
  params,
}: WatchParams): Promise<Metadata> {
  const { locale, videoId } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const catalogVideo = findCatalogVideo(videoId);

  return createMetadata({
    title: t("page", { page: catalogVideo?.title ?? t("watch") }),
    description: t("watchDescription"),
    pathname: `/watch/${videoId}`,
    locale,
    image: shareThumbnail(videoId),
  });
}

export default async function WatchPage({ params }: WatchParams) {
  const { locale, videoId } = await params;
  setRequestLocale(locale);

  return (
    <>
      <link rel="dns-prefetch" href="https://www.youtube-nocookie.com" />
      <link
        rel="preconnect"
        href="https://www.youtube-nocookie.com"
        crossOrigin="anonymous"
      />
      <link rel="dns-prefetch" href="https://www.youtube.com" />
      <link
        rel="preconnect"
        href="https://www.youtube.com"
        crossOrigin="anonymous"
      />
      <KidsTubeApp initialRoute={{ view: "watch", videoId }} />
    </>
  );
}
