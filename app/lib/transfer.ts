import {
  CATALOG_ID_BY_NUMBER,
  CATALOG_NUMBER_BY_ID,
  LIBRARY_VERSION,
  TRANSFER_PREFIX,
  TRANSFER_SECRET,
} from "./catalog";
import { normalizeStoredLibrary } from "./library";
import type { StoredLibrary } from "./types";

type CompactVideoRef = number | string;

type TransferVideo = {
  y: string;
  t: string;
  c: string;
  d: string;
  w: string;
  g: string[];
  a: string;
};

type TransferLibrary = {
  v: 1;
  s: CompactVideoRef[];
  r: CompactVideoRef[];
  c: TransferVideo[];
};

function textToBytes(text: string) {
  return new TextEncoder().encode(text);
}

function bytesToText(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return window
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function transferKey() {
  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    textToBytes(TRANSFER_SECRET),
  );
  return window.crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function compressTransferBytes(bytes: Uint8Array) {
  if (!("CompressionStream" in window)) {
    return { mode: "J", bytes };
  }

  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  const compressed = new Uint8Array(await new Response(stream.readable).arrayBuffer());
  return { mode: "G", bytes: compressed };
}

async function decompressTransferBytes(mode: string, bytes: Uint8Array) {
  if (mode !== "G") {
    return bytes;
  }

  if (!("DecompressionStream" in window)) {
    throw new Error("This browser cannot read compressed transfer codes.");
  }

  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

function compactVideoRef(id: string): CompactVideoRef {
  return CATALOG_NUMBER_BY_ID.get(id) ?? id;
}

function expandVideoRef(ref: CompactVideoRef) {
  if (typeof ref === "number") {
    return CATALOG_ID_BY_NUMBER.get(ref) ?? null;
  }
  return ref;
}

function compactTransferLibrary(library: StoredLibrary): TransferLibrary {
  return {
    v: 1,
    s: library.selectedIds.map(compactVideoRef),
    r: library.removedIds.map(compactVideoRef),
    c: library.customVideos.map((video) => ({
      y: video.videoId,
      t: video.title,
      c: video.channel,
      d: video.duration,
      w: video.views,
      g: video.tags,
      a: video.accent,
    })),
  };
}

function expandTransferLibrary(transfer: TransferLibrary): StoredLibrary {
  if (transfer.v !== 1) {
    throw new Error("Unsupported transfer code version.");
  }

  const customVideos = transfer.c.map((video) => {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(video.y)) {
      throw new Error("Transfer code contains an invalid video.");
    }

    return {
      id: `custom-${video.y}`,
      videoId: video.y,
      title: video.t || "Imported YouTube video",
      channel: video.c || "Parent added",
      duration: video.d || "--:--",
      views: video.w || "Added by parent",
      tags: Array.isArray(video.g) && video.g.length > 0 ? video.g : ["custom"],
      accent: video.a || "#00a676",
      source: "custom" as const,
    };
  });

  return normalizeStoredLibrary({
    version: LIBRARY_VERSION,
    customVideos,
    removedIds: transfer.r.map(expandVideoRef).filter((id): id is string =>
      Boolean(id),
    ),
    selectedIds: transfer.s.map(expandVideoRef).filter((id): id is string =>
      Boolean(id),
    ),
  });
}

export async function encryptedTransferCode(library: StoredLibrary) {
  const { mode, bytes } = await compressTransferBytes(
    textToBytes(JSON.stringify(compactTransferLibrary(library))),
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await transferKey(),
      bytes,
    ),
  );
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv);
  packed.set(encrypted, iv.length);
  return `${TRANSFER_PREFIX}${mode}.${base64UrlEncode(packed)}`;
}

export async function libraryFromTransferCode(code: string) {
  const match = code.trim().match(/^KIDTUBE1([GJ])\.([a-zA-Z0-9_-]+)$/);
  if (!match) {
    throw new Error("Paste a valid KidTube export code.");
  }

  const packed = base64UrlDecode(match[2]);
  if (packed.length <= 28) {
    throw new Error("Transfer code is too short.");
  }

  const iv = packed.slice(0, 12);
  const encrypted = packed.slice(12);
  const decrypted = new Uint8Array(
    await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await transferKey(),
      encrypted,
    ),
  );
  const jsonBytes = await decompressTransferBytes(match[1], decrypted);
  return expandTransferLibrary(JSON.parse(bytesToText(jsonBytes)) as TransferLibrary);
}
