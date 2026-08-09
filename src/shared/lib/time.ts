/** `125` -> `"2:05"`, `3725` -> `"1:02:05"`. */
export function formatTimestamp(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

/** Inverse of {@link formatTimestamp}. Returns 0 for anything unparseable. */
export function parseDurationText(duration: string) {
  const parts = duration
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some((part) => !Number.isFinite(part) || part < 0)
  ) {
    return 0;
  }

  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
