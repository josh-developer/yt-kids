import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { extractYouTubePlaylistId, youTubeApi } from "@/shared/api/youtube";
import type { LibraryController } from "@/entities/library";
import { VideoImporter } from "./video-importer";

/**
 * Owns the paste box: runs the importer, folds the outcome into the library
 * and phrases progress and failures in the active locale.
 */
export function useVideoImport({ library, update }: LibraryController) {
  const t = useTranslations("Library");
  const importer = useMemo(() => new VideoImporter(youTubeApi), []);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");

  async function importFromUrl() {
    setStatus(
      extractYouTubePlaylistId(url)
        ? t("checkingPlaylist")
        : t("checkingVideoDetails"),
    );

    const outcome = await importer.import(url, library, (progress) =>
      setStatus(t("checkingVideoDetailsProgress", progress)),
    );

    switch (outcome.kind) {
      case "invalid-link":
        setStatus(t("invalidYoutubeLink"));
        return false;

      case "empty-playlist":
        setStatus(t("playlistNoVideos"));
        return false;

      case "already-in-library":
        update((current) => current.approve(outcome.video.id));
        setStatus("");
        setUrl("");
        return false;

      case "video":
        update((current) => current.addCustomVideos([outcome.video]));
        setStatus("");
        setUrl("");
        return true;

      case "playlist":
        update((current) =>
          current.addPlaylist(outcome.playlistVideoIds, outcome.videos),
        );
        setStatus(
          t("playlistAdded", { count: outcome.playlistVideoIds.length }),
        );
        setUrl("");
        return true;
    }
  }

  return { url, status, setUrl, setStatus, importFromUrl };
}

export type VideoImportController = ReturnType<typeof useVideoImport>;
