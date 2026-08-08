import { MAX_WATCH_STACK_SIZE } from "./catalog";
import type { Video, WatchStack } from "./types";

export function pushWatchStack(
  current: WatchStack,
  videoId: string,
): WatchStack {
  if (current.ids[current.index] === videoId) {
    return current;
  }

  const prefix =
    current.index >= 0 ? current.ids.slice(0, current.index + 1) : [];
  const ids = [...prefix, videoId].slice(-MAX_WATCH_STACK_SIZE);
  return { ids, index: ids.length - 1 };
}

export function findWatchStackVideo(
  stack: WatchStack,
  currentId: string,
  direction: -1 | 1,
  videosById: Map<string, Video>,
) {
  const currentIndex =
    stack.ids[stack.index] === currentId
      ? stack.index
      : stack.ids.lastIndexOf(currentId);

  if (currentIndex < 0) {
    return null;
  }

  for (
    let index = currentIndex + direction;
    index >= 0 && index < stack.ids.length;
    index += direction
  ) {
    const video = videosById.get(stack.ids[index]);
    if (video && video.id !== currentId) {
      return { index, video };
    }
  }

  return null;
}
