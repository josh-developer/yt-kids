/**
 * Grouping videos by what their titles say.
 *
 * The catalog has no series field — everything the app knows about "these two
 * belong together" has to come out of strings like
 * `Oxirgi tort | 4-qism | Omar va Hana | @BOLAJON RTV`. So a title is reduced
 * to the words that identify it (dropping the boilerplate every Uzbek cartoon
 * upload carries: `multfilm`, `uzbek tilida`, `retro`, ...) and two videos are
 * related when enough of those words are shared.
 */

/** Words that say nothing about which video this is. */
const NOISE_WORDS = new Set([
  "multfilm",
  "multfilim",
  "multfilmlar",
  "multiklar",
  "multik",
  "mult",
  "soyuzmultfilm",
  "soyuzmult",
  "soyuz",
  "мультфильм",
  "мультфильмы",
  "мультик",
  "союзмультфильм",
  "film",
  "filmi",
  "kino",
  "video",
  "uzbek",
  "ozbek",
  "ozbekcha",
  "uzbekcha",
  "tilida",
  "tarjima",
  "узбек",
  "тилида",
  "узбекча",
  "ertak",
  "ertaklar",
  "сказка",
  "retro",
  "eski",
  "bolalik",
  "qadrdon",
  "eslab",
  "yil",
  "yili",
  "and",
  "the",
  "va",
  "ва",
  "и",
]);

/** Words that mark the number next to them as an episode number. */
const EPISODE_WORDS = new Set([
  "qism",
  "qismi",
  "qisim",
  "bolim",
  "bolimi",
  "seriya",
  "seriyasi",
  "serya",
  "part",
  "episode",
  "episod",
  "ep",
  "chast",
  "серия",
  "серии",
  "часть",
  "выпуск",
]);

const GLUED_EPISODE = /^(\d{1,3})(qism|qismi|seriya|serya|part|ep)$/u;
const WORD_SEPARATOR = /[^\p{L}\p{N}]+/u;

/** Above this two videos are the same series; above the lower one, related. */
const SERIES_THRESHOLD = 0.5;
const SIMILAR_THRESHOLD = 0.28;

/**
 * Next to the word `qism` a number means the episode whatever its size, so
 * long-running shows keep their order past 99. A bare number has to be read
 * more carefully: `1986` and `1000 tilak` are not episodes.
 */
const MAX_MARKED_EPISODE = 999;
const MAX_BARE_EPISODE = 99;

export type TitleSignature = Set<string>;

function normalize(title: string) {
  return title
    .toLowerCase()
    .replace(/[ʻʼ‘’`´']/gu, "")
    .replace(/ё/gu, "е");
}

function tokenize(title: string) {
  return normalize(title).split(WORD_SEPARATOR).filter(Boolean);
}

function isEpisodeNumber(value: number, limit: number) {
  return Number.isInteger(value) && value >= 1 && value <= limit;
}

/**
 * The episode this title announces, if any: `5-qism`, `qism 5`, `Ну, погоди! 5`
 * all read as 5, while `1986` and `1000 tilak` read as no episode at all.
 */
export function episodeNumberOf(title: string): number | null {
  const tokens = tokenize(title);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (EPISODE_WORDS.has(token)) {
      const before = Number(tokens[index - 1]);
      if (isEpisodeNumber(before, MAX_MARKED_EPISODE)) {
        return before;
      }

      const after = Number(tokens[index + 1]);
      if (isEpisodeNumber(after, MAX_MARKED_EPISODE)) {
        return after;
      }
    }

    const glued = token.match(GLUED_EPISODE);
    if (glued && isEpisodeNumber(Number(glued[1]), MAX_MARKED_EPISODE)) {
      return Number(glued[1]);
    }
  }

  // No marker word: a bare small number still usually means an episode.
  for (const token of tokens) {
    if (/^\d+$/.test(token) && isEpisodeNumber(Number(token), MAX_BARE_EPISODE)) {
      return Number(token);
    }
  }

  return null;
}

/** The identifying words of a title, with boilerplate and numbers removed. */
export function titleSignature(title: string): TitleSignature {
  const signature = new Set<string>();

  for (const token of tokenize(title)) {
    if (
      token.length < 2 ||
      /^\d+$/.test(token) ||
      GLUED_EPISODE.test(token) ||
      NOISE_WORDS.has(token) ||
      EPISODE_WORDS.has(token)
    ) {
      continue;
    }

    signature.add(token);
  }

  return signature;
}

/** Dice coefficient over the two signatures: 0 unrelated, 1 identical. */
export function signatureSimilarity(a: TitleSignature, b: TitleSignature) {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const word of a) {
    if (b.has(word)) {
      shared += 1;
    }
  }

  return (2 * shared) / (a.size + b.size);
}

export function isSameSeries(score: number) {
  return score >= SERIES_THRESHOLD;
}

export function isSimilar(score: number) {
  return score >= SIMILAR_THRESHOLD;
}
