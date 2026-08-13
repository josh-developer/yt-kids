import type { Video } from "@repo/catalog/types";

/** How many of the videos that follow this one lead the list. */
const NEXT_IN_ORDER_COUNT = 3;
/** The length of the list, as the web's `RECOMMENDED_GROUP_SIZE`. */
const LIST_SIZE = 30;

/**
 * What to watch after this video: the next few in the library, then a shuffled batch.
 *
 * Ported from the branch of the web's `recommendationGroupsFor` that runs when a video
 * has no detectable series — the next approved videos in order, filled out with a
 * deterministic shuffle of everything else. Leading with what follows is what makes
 * tapping a recommendation *advance* through the library rather than swapping back and
 * forth between two videos.
 *
 * The web also groups by series and title similarity, using a signature comparison this
 * app has not ported. Until it is, the honest thing is one list rather than a "In this
 * series" heading over videos that are not one.
 *
 * The order is a function of the video it belongs to, so it is stable while that video
 * plays, identical on both platforms, and different for the next video.
 */
export function recommendationsFor(
  video: Video,
  approvedVideos: readonly Video[],
): Video[] {
  if (approvedVideos.length < 2) {
    return [];
  }

  const currentIndex = approvedVideos.findIndex(
    (candidate) => candidate.id === video.id,
  );
  if (currentIndex < 0) {
    return [];
  }

  const nextInOrder: Video[] = [];
  for (
    let step = 1;
    step <= approvedVideos.length - 1 && nextInOrder.length < NEXT_IN_ORDER_COUNT;
    step += 1
  ) {
    // Wraps, so the end of the library leads back to the beginning rather than
    // running out of recommendations.
    nextInOrder.push(approvedVideos[(currentIndex + step) % approvedVideos.length]);
  }

  const taken = new Set([video.id, ...nextInOrder.map((next) => next.id)]);
  const rest = approvedVideos.filter((candidate) => !taken.has(candidate.id));

  return [
    ...nextInOrder,
    ...shuffleWithSeed(rest, seedFrom(video.id)).slice(
      0,
      LIST_SIZE - nextInOrder.length,
    ),
  ];
}

/** The web's `shuffleWithSeed`, so the same seed gives the same order everywhere. */
function shuffleWithSeed<Item>(items: readonly Item[], salt: number) {
  const shuffled = [...items];
  let seed = salt || 17;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const pick = Math.floor((seed / 233280) * (index + 1));
    [shuffled[index], shuffled[pick]] = [shuffled[pick], shuffled[index]];
  }

  return shuffled;
}

/** The web's `recommendationSalt`, without the per-session part. */
function seedFrom(id: string) {
  let seed = 17;

  for (let index = 0; index < id.length; index += 1) {
    seed = (seed * 31 + id.charCodeAt(index)) % 233280;
  }

  return seed;
}
