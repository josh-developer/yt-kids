import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

async function loadUzbekScript() {
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
    return await server.ssrLoadModule("/src/shared/lib/i18n/uzbek-script.ts");
  } finally {
    await server.close();
  }
}

async function loadMatchesQuery() {
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
    return await server.ssrLoadModule("/src/entities/video/model/video-factory.ts");
  } finally {
    await server.close();
  }
}

function video(title, channel = "") {
  return { id: "v1", videoId: "v1", title, channel, duration: "1:00", accent: "#000", source: "catalog" };
}

test("a Latin query folds to the same form as its Cyrillic spelling", async () => {
  const { foldUzbekScript } = await loadUzbekScript();
  assert.equal(foldUzbekScript("Baxodir"), foldUzbekScript("Баходир"));
});

test("Uzbek-specific letters (o', g', q, h) fold consistently across scripts", async () => {
  const { foldUzbekScript } = await loadUzbekScript();
  assert.equal(foldUzbekScript("bog'cha"), foldUzbekScript("боғча"));
  assert.equal(foldUzbekScript("qorako'l"), foldUzbekScript("қорако'л"));
});

test("apostrophe variants for the tutuq belgisi all fold the same way", async () => {
  const { foldUzbekScript } = await loadUzbekScript();
  const variants = ["o'g'il", "oʻgʻil", "o‘g’il"];
  const folded = variants.map((value) => foldUzbekScript(value));
  assert.ok(folded.every((value) => value === folded[0]));
});

test("a Latin search query matches a Cyrillic-titled video", async () => {
  const { matchesQuery } = await loadMatchesQuery();
  assert.ok(matchesQuery(video("Баходир ва Согдиана"), "Baxodir"));
});

test("a Cyrillic search query matches a Latin-titled video", async () => {
  const { matchesQuery } = await loadMatchesQuery();
  assert.ok(matchesQuery(video("Baxodir va Sogdiana"), "баходир"));
});

test("an unrelated query still does not match", async () => {
  const { matchesQuery } = await loadMatchesQuery();
  assert.equal(matchesQuery(video("Баходир ва Согдиана"), "zumrad"), false);
});
