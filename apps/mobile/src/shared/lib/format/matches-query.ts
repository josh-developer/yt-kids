import type { Video } from "@repo/catalog/types";

/**
 * Whether a video matches a search query, character for character as the web does:
 * title and channel, joined, lowercased, substring. An empty query matches
 * everything.
 *
 * Ported rather than improved. Fuzzier matching would be easy and would mean the two
 * clients disagree about what a search finds, which is worse than either behaviour.
 */
export function matchesQuery(video: Video, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return `${video.title} ${video.channel}`.toLowerCase().includes(needle);
}
