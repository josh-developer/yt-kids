import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the KidTube app shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>KidTube<\/title>/i);
  assert.match(html, /KidTube/);
  assert.match(html, /Switch language/);
  assert.match(html, /Search approved videos/);
  assert.match(html, /Uch/);
  assert.doesNotMatch(html, /Baby Shark Dance/);
  assert.match(html, /Parent/);
  assert.doesNotMatch(html, /Codex/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("uses the finished app files instead of the starter preview", async () => {
  const [page, layout, app, youtube, player, css, packageJson] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/kids-tube-app.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/youtube.ts", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../app/components/player/safe-youtube-player.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
    ]);

  assert.match(page, /export const metadata:\s*Metadata/);
  assert.match(page, /<KidsTubeApp \/>/);
  assert.match(layout, /title:\s*"KidTube"/);
  assert.match(app, /localStorage/);
  assert.match(youtube, /youtube-nocookie\.com/);
  assert.match(youtube, /controls:\s*"0"/);
  assert.match(player, /sandbox="allow-scripts allow-same-origin allow-presentation"/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(app, /extractYouTubeId/);
  assert.match(app, /fetchYouTubeMetadata/);
  assert.match(packageJson, /"name": "yt-kids"/);
  assert.match(packageJson, /"lucide-react":/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview|themeColor|\bViewport\b/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
