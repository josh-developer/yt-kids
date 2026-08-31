import { useTranslations } from "next-intl";
import { useMemo } from "react";
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
 * Video rows carry data (a view count and legacy fallback text), never
 * pre-rendered English. These helpers turn that data into text in the active
 * locale.
 */
export function useVideoLabels() {
  const t = useTranslations("Video");
  const numbers = useLocaleNumbers();

  // Stable across renders: consumers put this in effect dependency lists.
  return useMemo(
    () => ({
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

        // Libraries stored before v8 keep a pre-i18n display string.
        return video.views ?? "";
      },
      viewCount: (video: Video) => {
        if (typeof video.viewCount !== "number") {
          return "";
        }

        const { key, value } = compactViews(video.viewCount);
        const formattedValue =
          key === "views" ? numbers.integer(value) : numbers.decimal(value);

        if (key === "viewsMillions") {
          return t("viewsMillionsShort", { value: formattedValue });
        }

        if (key === "viewsThousands") {
          return t("viewsThousandsShort", { value: formattedValue });
        }

        return t("viewsShort", { value: formattedValue });
      },
    }),
    [numbers, t],
  );
}

export type VideoLabels = ReturnType<typeof useVideoLabels>;
