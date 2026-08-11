import type { Video } from "@repo/catalog/types";
import { useCallback, useMemo } from "react";
import { useTranslations } from "../i18n/use-translations";

/**
 * Turns video data into the strings a card shows, in the active locale.
 *
 * A port of the web's `useVideoLabels`, reading the same `Video` namespace from the
 * same catalogs — so a card says "270.8K views" or "270,8 ming marta ko'rilgan"
 * depending on the locale, exactly as the site does, rather than whatever language
 * happened to be typed into the source.
 *
 * View counts are bucketed here rather than through
 * `Intl.NumberFormat({ notation: "compact" })`, and the separators come from the
 * catalog's `Format` namespace rather than `Intl`. Both are deliberate on the web:
 * the Workers runtime ships ICU with English locale data only, so it accepts `uz`
 * and then formats it like `en`. Matching that arithmetic is what keeps the two
 * platforms byte-identical instead of merely close.
 */
export function useVideoLabels() {
  const t = useTranslations("Video");
  const format = useTranslations("Format");

  const numbers = useMemo(() => {
    const group = format("groupSeparator");
    const decimal = format("decimalSeparator");

    return {
      integer: (value: number) =>
        String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, group),
      decimal: (value: number) => String(value).replace(".", decimal),
    };
  }, [format]);

  const views = useCallback(
    (video: Video) => {
      if (typeof video.viewCount === "number") {
        const round = (value: number) => Math.round(value * 10) / 10;
        const count = video.viewCount;

        if (count >= 1_000_000) {
          return t("viewsMillions", {
            value: numbers.decimal(round(count / 1_000_000)),
          });
        }

        if (count >= 1_000) {
          const thousands = round(count / 1_000);
          return thousands >= 1_000
            ? t("viewsMillions", {
                value: numbers.decimal(round(thousands / 1_000)),
              })
            : t("viewsThousands", { value: numbers.decimal(thousands) });
        }

        return t("views", { value: numbers.integer(count) });
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
    [numbers, t],
  );

  return useMemo(
    () => ({
      title: (video: Video) => video.title || t("untitled"),
      channel: (video: Video) => video.channel || t("parentAdded"),
      views,
      /** First letter of the channel, as `ChannelAvatar` uses on the web. */
      initial: (video: Video) =>
        (video.channel || t("parentAdded")).slice(0, 1),
    }),
    [t, views],
  );
}
