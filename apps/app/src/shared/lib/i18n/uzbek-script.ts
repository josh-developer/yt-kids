/**
 * Catalog titles arrive in whichever script the uploader used — Uzbek Latin,
 * Uzbek Cyrillic, or (many Soyuzmultfilm-era entries) Russian Cyrillic — and
 * a parent searching "Baxodir" expects it to find "Баходир" too. Neither
 * script is authoritative, so search folds both down to one comparable Latin
 * form instead of guessing which one the user is typing in.
 */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "x",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  // Russian-only letter that turns up in non-Uzbek catalog titles; folded
  // rather than left untranslated so those titles stay searchable too.
  щ: "sh",
  ъ: "",
  ы: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  // The three Uzbek-specific Cyrillic letters, each usually written with a
  // tutuq belgisi (`'`) in Latin — the apostrophe strip below is what makes
  // "o'"/"g'" match plain "o"/"g" the same way ў/ғ do.
  ў: "o",
  қ: "q",
  ғ: "g",
  ҳ: "h",
};

/** Every apostrophe-like mark a keyboard or font might produce for `oʻ`/`gʻ`. */
const APOSTROPHE_VARIANTS = /[ʻʼ‘’`´']/gu;

/**
 * Folds a string to a script- and apostrophe-independent lowercase form, so
 * two spellings of the same word compare equal regardless of which script or
 * keyboard produced them (`"bog'cha"`, `"bogcha"`, and `"боғча"` all fold to
 * `"bogcha"`).
 */
export function foldUzbekScript(value: string): string {
  let folded = "";
  for (const character of value.toLowerCase()) {
    folded += CYRILLIC_TO_LATIN[character] ?? character;
  }
  return folded.replace(APOSTROPHE_VARIANTS, "");
}
