"use client";

import { useTranslations } from "next-intl";
import { useLocaleNumbers } from "@/shared/lib/i18n/use-locale-numbers";
import type { Video } from "./types";

/**
 * Compact view counts are bucketed here rather than through
 * `Intl.NumberFormat({notation: "compact"})` — see `useLocaleNumbers` for why
 * runtime ICU cannot be trusted for non-English locales on Workers. The unit
 * words ("K", "ming", "mln") live in the message catalog.
 */
function compactViews(count: number) {
  const round = (value: number) => Math.round(value * 10) / 10;

  if (count >= 1_000_000) {
    return { key: "viewsMillions" as const, value: round(count / 1_000_000) };
  }

  if (count >= 1_000) {
    const thousands = round(count / 1_000);
    return thousands >= 1_000
      ? { key: "viewsMillions" as const, value: round(thousands / 1_000) }
      : { key: "viewsThousands" as const, value: thousands };
  }

  return { key: "views" as const, value: Math.round(count) };
}

/**
 * Video rows carry data (a view count, a source marker), never pre-rendered
 * English. These helpers turn that data into text in the active locale.
 */
export function useVideoLabels() {
  const t = useTranslations("Video");
  const numbers = useLocaleNumbers();

  return {
    title: (video: Video) => video.title || t("untitled"),
    channel: (video: Video) => video.channel || t("parentAdded"),
    views: (video: Video) => {
      if (typeof video.viewCount === "number") {
        const { key, value } = compactViews(video.viewCount);
        return t(key, {
          value:
            key === "views" ? numbers.integer(value) : numbers.decimal(value),
        });
      }

      if (video.sourceLabel) {
        return t(video.sourceLabel);
      }

      if (video.source === "custom") {
        return t("parentAdded");
      }

      // Libraries stored before v8 keep a pre-i18n display string.
      return video.views ?? "";
    },
  };
}

export type VideoLabels = ReturnType<typeof useVideoLabels>;
