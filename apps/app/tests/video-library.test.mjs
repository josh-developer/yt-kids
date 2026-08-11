import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

async function loadLibrary() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const src = fileURLToPath(new URL("../src", import.meta.url));
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "error",
    server: { middlewareMode: true },
    resolve: { alias: { "@/": `${src}/` } },
  });

  try {
    const [{ VideoLibrary }, { VideoCatalog }] = await Promise.all([
      server.ssrLoadModule("/src/entities/library/model/video-library.ts"),
      server.ssrLoadModule("/src/entities/library/model/video-catalog.ts"),
    ]);

    return { VideoCatalog, VideoLibrary };
  } finally {
    await server.close();
  }
}

function video(number, title) {
  return {
    id: `uzbek-old-${number}`,
    videoId: `test-video-${number}`,
    title,
    channel: "Test channel",
    duration: "1:00",
    accent: "#1a73e8",
    source: "catalog",
  };
}

function ids(group) {
  return group.videos.map((entry) => entry.id);
}

test("standalone recommendations lead with the next approved videos in order", async () => {
  const { VideoCatalog, VideoLibrary } = await loadLibrary();
  const videos = [
    video(1, "Alpha comet"),
    video(2, "Bravo picnic"),
    video(3, "Charlie garden"),
    video(4, "Delta ocean"),
    video(5, "Echo lantern"),
    video(6, "Foxtrot marble"),
  ];
  const library = VideoLibrary.from(new VideoCatalog(videos), {
    version: 9,
    selectedIds: videos.map((entry) => entry.id),
    customVideos: [],
    removedIds: [],
  });

  const first = library.recommendationGroupsFor(videos[0], 123);
  assert.deepEqual(first.map((group) => group.key), ["recommended"]);
  assert.deepEqual(ids(first[0]).slice(0, 3), [
    "uzbek-old-2",
    "uzbek-old-3",
    "uzbek-old-4",
  ]);

  const selectedRecommendation = library.recommendationGroupsFor(videos[1], 123);
  assert.deepEqual(ids(selectedRecommendation[0]).slice(0, 3), [
    "uzbek-old-3",
    "uzbek-old-4",
    "uzbek-old-5",
  ]);
});

test("series recommendations keep episode order before shuffled videos", async () => {
  const { VideoCatalog, VideoLibrary } = await loadLibrary();
  const videos = [
    video(1, "Omar va Hana 1-qism"),
    video(2, "Omar va Hana 2-qism"),
    video(3, "Omar va Hana 3-qism"),
    video(4, "Omar va Hana 4-qism"),
    video(5, "Delta ocean"),
  ];
  const library = VideoLibrary.from(new VideoCatalog(videos), {
    version: 9,
    selectedIds: videos.map((entry) => entry.id),
    customVideos: [],
    removedIds: [],
  });

  const groups = library.recommendationGroupsFor(videos[1], 123);

  assert.equal(groups[0].key, "series");
  assert.deepEqual(ids(groups[0]).slice(0, 3), [
    "uzbek-old-3",
    "uzbek-old-4",
    "uzbek-old-1",
  ]);
});
