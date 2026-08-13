import { CURATED_UZBEK_OLD_CARTOONS } from "@repo/catalog";
import type { Video } from "@repo/catalog/types";
import { gcm } from "@noble/ciphers/aes.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { gunzipSync, gzipSync } from "fflate";

/**
 * The parent's library as a code they can carry between devices.
 *
 * Byte-for-byte the web's format, from `features/library-transfer` there: `KIDTUBE1`, a
 * mode letter, a dot, then base64url of a 12-byte IV followed by AES-GCM ciphertext. The
 * key is SHA-256 of a constant string, which makes this obfuscation against
 * shoulder-surfing rather than secrecy — the same choice the web made, and worth keeping
 * identical so a code written on one reads on the other.
 *
 * The primitives are libraries because Hermes has neither: no WebCrypto for AES-GCM or
 * SHA-256, no `CompressionStream` for gzip. `@noble` and `fflate` are pure JavaScript and
 * small; the alternative was a native module for something that runs twice a year.
 */
const PREFIX = "KIDTUBE1";
const SECRET = "kidtube-parent-library-transfer-v1";
const CODE_PATTERN = /^KIDTUBE1([GJ])\.([a-zA-Z0-9_-]+)$/;
const MIN_PACKED_BYTES = 28;
const FORMAT_VERSION = 1;
/** The mode letter in a code: `G` gzipped, `J` plain. This writes `G` and reads both. */
const COMPRESSED = "G";

/** `CUSTOM_VIDEO_ACCENT` and `UNKNOWN_DURATION` in the web's `video-factory.ts`. */
const CUSTOM_ACCENT = "#00a676";
const UNKNOWN_DURATION = "--:--";
const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

/** What a code carries: which catalog videos are in, and any videos added by hand. */
export type TransferLibrary = {
  selectedIds: string[];
  removedIds: string[];
  customVideos: Video[];
};

export class TransferError extends Error {
  /** Declared rather than a parameter property: the screen switches on it. */
  readonly reason: TransferErrorReason;

  constructor(reason: TransferErrorReason) {
    super(reason);
    this.name = "TransferError";
    this.reason = reason;
  }
}

export type TransferErrorReason =
  | "invalidCode"
  | "codeTooShort"
  | "unsupportedVersion"
  | "invalidVideo"
  | "decodeFailed";

type CompactRef = number | string;

type TransferVideo = {
  y: string;
  t: string;
  c: string;
  d: string;
  w: string;
  g?: string[];
  a: string;
};

type TransferPayload = {
  v: typeof FORMAT_VERSION;
  s: CompactRef[];
  r: CompactRef[];
  c: TransferVideo[];
};

export function isVideoId(value: string) {
  return VIDEO_ID_PATTERN.test(value);
}

/** `extractYouTubeId` from the web, minus the `URL` parts Hermes parses differently. */
export function extractYouTubeId(input: string) {
  const trimmed = input.trim();
  if (isVideoId(trimmed)) {
    return trimmed;
  }

  const withoutQuery = trimmed.split("#")[0];
  const [path, query = ""] = withoutQuery.split("?");

  for (const pair of query.split("&")) {
    const [key, value] = pair.split("=");
    if (key === "v" && value && isVideoId(value)) {
      return value;
    }
  }

  const parts = path.replace(/^https?:\/\//, "").split("/").filter(Boolean);
  // `youtu.be/<id>`, or the segment after `embed`, `shorts` or `live`.
  if (parts[0]?.includes("youtu.be") && parts[1] && isVideoId(parts[1])) {
    return parts[1];
  }

  const marker = parts.findIndex((part) =>
    ["embed", "shorts", "live"].includes(part),
  );
  const candidate = marker >= 0 ? parts[marker + 1] : undefined;
  return candidate && isVideoId(candidate) ? candidate : null;
}

export function customVideoId(videoId: string) {
  return `custom-${videoId}`;
}

export function createCustomVideo(videoId: string): Video {
  return {
    id: customVideoId(videoId),
    videoId,
    // Empty on purpose: the screen fills in a localized fallback, so no language is
    // frozen into storage.
    title: "",
    channel: "",
    duration: UNKNOWN_DURATION,
    accent: CUSTOM_ACCENT,
    source: "custom",
  } as Video;
}

export function encodeLibrary(library: TransferLibrary) {
  const json = JSON.stringify(pack(library));
  const bytes = gzipSync(textToBytes(json));
  const iv = randomBytes(12);
  const encrypted = gcm(key(), iv).encrypt(bytes);

  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv);
  packed.set(encrypted, iv.length);

  return `${PREFIX}${COMPRESSED}.${base64UrlEncode(packed)}`;
}

export function decodeLibrary(code: string): TransferLibrary {
  const match = code.trim().match(CODE_PATTERN);
  if (!match) {
    throw new TransferError("invalidCode");
  }

  const packed = base64UrlDecode(match[2]);
  if (packed.length <= MIN_PACKED_BYTES) {
    throw new TransferError("codeTooShort");
  }

  let json: string;
  try {
    const decrypted = gcm(key(), packed.slice(0, 12)).decrypt(packed.slice(12));
    json = bytesToText(
      match[1] === COMPRESSED ? gunzipSync(decrypted) : decrypted,
    );
  } catch {
    // A wrong code, a truncated paste and a foreign key all land here, and none of them
    // is worth telling apart for a parent.
    throw new TransferError("decodeFailed");
  }

  return unpack(JSON.parse(json) as TransferPayload);
}

function pack(library: TransferLibrary): TransferPayload {
  return {
    v: FORMAT_VERSION,
    s: library.selectedIds.map(compactRef),
    r: library.removedIds.map(compactRef),
    c: library.customVideos.map((video) => ({
      y: video.videoId,
      t: video.title,
      c: video.channel,
      d: video.duration,
      w: video.views ?? "",
      a: video.accent,
    })),
  };
}

function unpack(payload: TransferPayload): TransferLibrary {
  if (payload.v !== FORMAT_VERSION) {
    throw new TransferError("unsupportedVersion");
  }

  return {
    selectedIds: expandRefs(payload.s),
    removedIds: expandRefs(payload.r),
    customVideos: payload.c.map(toVideo),
  };
}

function toVideo(video: TransferVideo): Video {
  if (!isVideoId(video.y)) {
    throw new TransferError("invalidVideo");
  }

  return {
    id: customVideoId(video.y),
    videoId: video.y,
    title: video.t || "",
    channel: video.c || "",
    duration: video.d || UNKNOWN_DURATION,
    views: video.w || "",
    accent: video.a || CUSTOM_ACCENT,
    source: "custom",
  } as Video;
}

/**
 * A catalog id is `uzbek-old-007`; the code carries the 7. Anything else — a
 * parent-added video — travels as its full id, exactly as the web's `compactRef` does.
 */
function compactRef(id: string): CompactRef {
  const number = catalogNumbers().byId.get(id);
  return number ?? id;
}

function expandRefs(refs: CompactRef[]) {
  return refs
    .map((ref) =>
      typeof ref === "number" ? (catalogNumbers().byNumber.get(ref) ?? null) : ref,
    )
    .filter((id): id is string => Boolean(id));
}

let numbers: {
  byId: Map<string, number>;
  byNumber: Map<number, string>;
} | null = null;

function catalogNumbers() {
  if (!numbers) {
    const pairs = CURATED_UZBEK_OLD_CARTOONS.map(
      (video) => [video.id, Number(video.id.replace("uzbek-old-", ""))] as const,
    );
    numbers = {
      byId: new Map(pairs),
      byNumber: new Map(pairs.map(([id, number]) => [number, id] as const)),
    };
  }

  return numbers;
}

function key() {
  return sha256(textToBytes(SECRET));
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    // Not `expo-crypto`: this is an IV for a key everyone already has, so the only
    // requirement is that two codes from one device do not share one.
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

function textToBytes(text: string) {
  const bytes = new Uint8Array(text.length * 3);
  let length = 0;

  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    if (point < 0x80) {
      bytes[length++] = point;
    } else if (point < 0x800) {
      bytes[length++] = 0xc0 | (point >> 6);
      bytes[length++] = 0x80 | (point & 0x3f);
    } else if (point < 0x10000) {
      bytes[length++] = 0xe0 | (point >> 12);
      bytes[length++] = 0x80 | ((point >> 6) & 0x3f);
      bytes[length++] = 0x80 | (point & 0x3f);
    } else {
      bytes[length++] = 0xf0 | (point >> 18);
      bytes[length++] = 0x80 | ((point >> 12) & 0x3f);
      bytes[length++] = 0x80 | ((point >> 6) & 0x3f);
      bytes[length++] = 0x80 | (point & 0x3f);
    }
  }

  return bytes.slice(0, length);
}

function bytesToText(bytes: Uint8Array) {
  let text = "";
  let index = 0;

  while (index < bytes.length) {
    const byte = bytes[index];
    if (byte < 0x80) {
      text += String.fromCodePoint(byte);
      index += 1;
    } else if (byte < 0xe0) {
      text += String.fromCodePoint(((byte & 0x1f) << 6) | (bytes[index + 1] & 0x3f));
      index += 2;
    } else if (byte < 0xf0) {
      text += String.fromCodePoint(
        ((byte & 0x0f) << 12) |
          ((bytes[index + 1] & 0x3f) << 6) |
          (bytes[index + 2] & 0x3f),
      );
      index += 3;
    } else {
      text += String.fromCodePoint(
        ((byte & 0x07) << 18) |
          ((bytes[index + 1] & 0x3f) << 12) |
          ((bytes[index + 2] & 0x3f) << 6) |
          (bytes[index + 3] & 0x3f),
      );
      index += 4;
    }
  }

  return text;
}

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64UrlEncode(bytes: Uint8Array) {
  let code = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const chunk =
      (bytes[index] << 16) |
      ((bytes[index + 1] ?? 0) << 8) |
      (bytes[index + 2] ?? 0);
    const available = bytes.length - index;

    code += BASE64_ALPHABET[(chunk >> 18) & 63];
    code += BASE64_ALPHABET[(chunk >> 12) & 63];
    if (available > 1) {
      code += BASE64_ALPHABET[(chunk >> 6) & 63];
    }

    if (available > 2) {
      code += BASE64_ALPHABET[chunk & 63];
    }
  }

  return code;
}

function base64UrlDecode(code: string) {
  const values: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const character of code) {
    const value = BASE64_ALPHABET.indexOf(character);
    if (value < 0) {
      continue;
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      values.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(values);
}
