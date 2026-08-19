import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

async function loadPlaybackPositions() {
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
    const [{ PlaybackPositions }, { MemoryStore }] = await Promise.all([
      server.ssrLoadModule("/src/shared/lib/playback/playback-positions.ts"),
      server.ssrLoadModule("/src/shared/lib/storage/key-value-store.ts"),
    ]);

    return { MemoryStore, PlaybackPositions };
  } finally {
    await server.close();
  }
}

test("a video within 15 seconds of its end is not memorized", async () => {
  const { MemoryStore, PlaybackPositions } = await loadPlaybackPositions();
  const positions = new PlaybackPositions(new MemoryStore());

  // 623s long video, watched up to its final 13 seconds.
  positions.save("abc123", 610, 623);
  assert.equal(positions.read("abc123"), 0);
});

test("a video that finishes on the same tick as it started stays forgotten", async () => {
  const { MemoryStore, PlaybackPositions } = await loadPlaybackPositions();
  const positions = new PlaybackPositions(new MemoryStore());

  positions.save("abc123", 620, 623);
  assert.equal(positions.read("abc123"), 0);
});

test("a resumable position well before the end is still memorized", async () => {
  const { MemoryStore, PlaybackPositions } = await loadPlaybackPositions();
  const positions = new PlaybackPositions(new MemoryStore());

  positions.save("abc123", 400, 623);
  assert.equal(positions.read("abc123"), 400);
});

test("an already-memorized position is cleared once playback nears the end", async () => {
  const { MemoryStore, PlaybackPositions } = await loadPlaybackPositions();
  const positions = new PlaybackPositions(new MemoryStore());

  positions.save("abc123", 400, 623);
  assert.equal(positions.read("abc123"), 400);

  positions.save("abc123", 610, 623);
  assert.equal(positions.read("abc123"), 0);
});
