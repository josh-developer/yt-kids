import type { Video } from "@repo/catalog/types";

/**
 * Turns video data into the strings a card shows.
 *
 * A port of `use-video-labels.ts` from the web app, including the bucketing that
 * replaces `Intl.NumberFormat({ notation: "compact" })` — the web avoids runtime
 * ICU because it cannot be trusted for non-English locales on Workers, and
 * matching its arithmetic here is what keeps "2 mln" reading the same on both.
 *
 * Not translated yet. The web resolves these through `next-intl` against the
 * shared message catalogs, and wiring that up is its own piece of work; these are
 * the Uzbek strings the app ships with today, in one place, ready to be replaced
 * by catalog lookups rather than scattered through components.
 */
const UNITS = { thousands: "ming", millions: "mln", views: "ko'rilgan" };

function compactViews(count: number) {
  const round = (value: number) => Math.round(value * 10) / 10;

  if (count >= 1_000_000) {
    return `${round(count / 1_000_000)} ${UNITS.millions}`;
  }

  if (count >= 1_000) {
    const thousands = round(count / 1_000);
    return thousands >= 1_000
      ? `${round(thousands / 1_000)} ${UNITS.millions}`
      : `${thousands} ${UNITS.thousands}`;
  }

  return `${Math.round(count)}`;
}

export function videoTitle(video: Video) {
  return video.title || "Nomsiz video";
}

export function videoChannel(video: Video) {
  return video.channel || "Ota-ona qo'shgan";
}

export function videoViews(video: Video) {
  if (typeof video.viewCount === "number") {
    return `${compactViews(video.viewCount)} marta ${UNITS.views}`;
  }

  if (video.sourceLabel) {
    return video.sourceLabel === "playlist" ? "Pleylist" : "YouTube";
  }

  if (video.source === "custom") {
    return "Ota-ona qo'shgan";
  }

  // Libraries stored before v8 keep a pre-i18n display string.
  return video.views ?? "";
}

/** First letter of the channel, as `ChannelAvatar` does on the web. */
export function channelInitial(video: Video) {
  return videoChannel(video).slice(0, 1);
}
