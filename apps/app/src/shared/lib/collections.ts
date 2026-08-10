/**
 * Deterministic shuffle: the same seed always yields the same order, so the
 * server and the browser agree on the feed until the user reshuffles.
 */
export function shuffleWithSeed<Item>(items: Item[], salt: number) {
  const shuffled = [...items];
  let seed = salt || 17;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const pick = Math.floor((seed / 233280) * (index + 1));
    [shuffled[index], shuffled[pick]] = [shuffled[pick], shuffled[index]];
  }

  return shuffled;
}

export function unique<Item>(items: Item[]) {
  return Array.from(new Set(items));
}
