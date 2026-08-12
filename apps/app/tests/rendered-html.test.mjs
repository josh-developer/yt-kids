import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/", headers = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html", ...headers },
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

test("server-renders the KidTube app shell in English", async () => {
  const response = await render("/en");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="en"/);
  assert.match(html, /<title>KidTube<\/title>/i);
  assert.match(html, /Switch language/);
  assert.match(html, /Search approved videos/);
  assert.match(html, /\/_thumb\/[A-Za-z0-9_-]{11}\/card/);
  assert.match(html, /(?:views|Playlist|YouTube)/);
  assert.doesNotMatch(html, /Baby Shark Dance/);
  assert.match(html, /Parent/);
  assert.doesNotMatch(html, /Codex/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("server-renders Uzbek copy without a client-side language flip", async () => {
  const response = await render("/uz");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<html lang="uz"/);
  assert.match(html, /Tilni almashtirish/);
  assert.match(html, /Tanlangan videolarni qidirish/);
  assert.match(html, /marta ko&#x27;rilgan|marta ko'rilgan/);
  assert.doesNotMatch(html, /Search approved videos/);
});

test("localizes page metadata per locale", async () => {
  const [english, uzbek] = await Promise.all([
    render("/en/settings"),
    render("/uz/settings"),
  ]);

  assert.match(await english.text(), /<title>Parent settings \| KidTube<\/title>/i);
  assert.match(
    await uzbek.text(),
    /<title>Ota-ona sozlamalari \| KidTube<\/title>/i,
  );
});

test("redirects locale-less URLs to a negotiated locale", async () => {
  const fallback = await render("/");
  assert.equal(fallback.status, 307);
  assert.match(fallback.headers.get("location") ?? "", /\/en$/);

  const negotiated = await render("/", { "accept-language": "uz-UZ,uz;q=0.9" });
  assert.equal(negotiated.status, 307);
  assert.match(negotiated.headers.get("location") ?? "", /\/uz$/);

  const remembered = await render("/", { cookie: "NEXT_LOCALE=uz" });
  assert.equal(remembered.status, 307);
  assert.match(remembered.headers.get("location") ?? "", /\/uz$/);
});

test("keeps the feature-sliced layout intact", async () => {
  const [shell, layout, page, watchPage, player, urls, css, packageJson] =
    await Promise.all([
      readFile(new URL("../app/_shell/kids-tube-app.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/[locale]/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/[locale]/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/pages/watch/ui/watch-page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../src/widgets/player/ui/safe-youtube-player.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../src/shared/api/youtube/youtube-urls.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
    ]);

  const playerCss = await readFile(
    new URL("../src/widgets/player/ui/player.module.css", import.meta.url),
    "utf8",
  );

  // The app layer only routes and composes; logic lives in the layers below.
  assert.match(page, /export async function generateMetadata/);
  assert.match(page, /<KidsTubeApp \/>/);
  assert.match(layout, /<html lang=\{locale\}>/);
  assert.match(layout, /NextIntlClientProvider/);
  assert.match(shell, /@\/pages\/home/);
  assert.match(shell, /@\/entities\/library/);
  assert.match(shell, /function goHome\(\)[\s\S]*setHomeQuery\(""\)/);
  assert.match(shell, /function openPreviousVideo\(\)[\s\S]*refreshRecommendations\(\)/);
  assert.match(watchPage, /<Recommendations[\s\S]*key=\{recommendationKey\}/);
  assert.doesNotMatch(shell, /localStorage/);

  // Player hardening must survive the split into hooks and sub-components.
  assert.match(urls, /youtube-nocookie\.com/);
  assert.match(urls, /controls:\s*"0"/);
  assert.match(
    player,
    /sandbox="allow-scripts allow-same-origin allow-presentation"/,
  );
  // The embed stays untouchable, wherever its stylesheet lives.
  assert.match(playerCss, /\.youtubeMount[\s\S]*?pointer-events:\s*none/);

  // globals.css is tokens and element defaults — nothing else.
  // Component rules belong to a `*.module.css` beside the component.
  assert.match(css, /--brand-red/);
  assert.doesNotMatch(css, /\[data-tooltip\]/);
  assert.doesNotMatch(css, /\.(player|video|topbar|settings|recommendation)/);

  assert.match(packageJson, /"name": "app"/);
  assert.match(packageJson, /"@floating-ui\/react":/);
  assert.match(packageJson, /"lucide-react":/);
  assert.match(packageJson, /"next-intl":/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview|themeColor/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("keeps every message key in sync across locales", async () => {
  const [en, uz] = await Promise.all([
    readFile(new URL("../../../packages/internationalization/messages/en.json", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/internationalization/messages/uz.json", import.meta.url), "utf8"),
  ]);

  function flatten(value, prefix = "") {
    return Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === "object" && entry !== null
        ? flatten(entry, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );
  }

  assert.deepEqual(
    flatten(JSON.parse(en)).sort(),
    flatten(JSON.parse(uz)).sort(),
  );
});
