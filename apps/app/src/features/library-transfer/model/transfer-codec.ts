import { LIBRARY_VERSION } from "@/shared/config/app-config";
import { isVideoId } from "@/shared/api/youtube";
import { CUSTOM_VIDEO_ACCENT, UNKNOWN_DURATION, customVideoId } from "@/entities/video";
import type { CustomLibraryVideo, StoredLibrary, VideoCatalog } from "@/entities/library";
import {
  base64UrlDecode,
  base64UrlEncode,
  bytesToText,
  compress,
  decompress,
  textToBytes,
} from "./transfer-crypto";
import { TransferError } from "./transfer-error";

const TRANSFER_PREFIX = "KIDTUBE1";
const TRANSFER_SECRET = "kidtube-parent-library-transfer-v1";
const CODE_PATTERN = /^KIDTUBE1([GJ])\.([a-zA-Z0-9_-]+)$/;
const MIN_PACKED_BYTES = 28;
/** Bumped from 1 alongside the `hiddenIds`-based library shape. */
const TRANSFER_FORMAT_VERSION = 2;

type CompactVideoRef = number | string;

/** Short field names keep the shareable code small. */
type TransferVideo = {
  y: string;
  t: string;
  c: string;
  d: string;
  w: string;
  /** Tags, written by versions before they were dropped. Read and ignored. */
  g?: string[];
  a: string;
  /** Present and `true` only when the video is hidden; omitted otherwise. */
  h?: true;
};

type TransferPayload = {
  v: typeof TRANSFER_FORMAT_VERSION;
  h: CompactVideoRef[];
  r: CompactVideoRef[];
  c: TransferVideo[];
};

/** What the settings screen depends on; the AES implementation is swappable. */
export interface LibraryTransferCodec {
  encode(library: StoredLibrary): Promise<string>;
  decode(code: string): Promise<StoredLibrary>;
}

/**
 * Packs a library into a gzip + AES-GCM code a parent can paste onto another
 * device. The key is derived from a constant, so this is obfuscation for
 * shoulder-surfing, not secrecy against someone holding the code.
 */
export class EncryptedTransferCodec implements LibraryTransferCodec {
  constructor(private readonly catalog: VideoCatalog) {}

  async encode(library: StoredLibrary) {
    const { mode, bytes } = await compress(
      textToBytes(JSON.stringify(this.pack(library))),
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = new Uint8Array(
      await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        await this.key(),
        bytes,
      ),
    );
    const packed = new Uint8Array(iv.length + encrypted.length);
    packed.set(iv);
    packed.set(encrypted, iv.length);
    return `${TRANSFER_PREFIX}${mode}.${base64UrlEncode(packed)}`;
  }

  async decode(code: string) {
    const match = code.trim().match(CODE_PATTERN);
    if (!match) {
      throw new TransferError("invalidCode");
    }

    const packed = base64UrlDecode(match[2]);
    if (packed.length <= MIN_PACKED_BYTES) {
      throw new TransferError("codeTooShort");
    }

    const decrypted = new Uint8Array(
      await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: packed.slice(0, 12) },
        await this.key(),
        packed.slice(12),
      ),
    );
    const json = bytesToText(await decompress(match[1], decrypted));
    return this.unpack(JSON.parse(json) as TransferPayload);
  }

  private async key() {
    const digest = await window.crypto.subtle.digest(
      "SHA-256",
      textToBytes(TRANSFER_SECRET),
    );
    return window.crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
  }

  private pack(library: StoredLibrary): TransferPayload {
    return {
      v: TRANSFER_FORMAT_VERSION,
      h: library.hiddenIds.map((id) => this.catalog.compactRef(id)),
      r: library.removedIds.map((id) => this.catalog.compactRef(id)),
      c: library.customVideos.map((video) => ({
        y: video.videoId,
        t: video.title,
        c: video.channel,
        d: video.duration,
        w: video.views ?? "",
        a: video.accent,
        h: video.status === "hidden" ? true : undefined,
      })),
    };
  }

  private unpack(payload: TransferPayload): StoredLibrary {
    if (payload.v !== TRANSFER_FORMAT_VERSION) {
      throw new TransferError("unsupportedVersion");
    }

    return {
      version: LIBRARY_VERSION,
      customVideos: payload.c.map((video) => this.toVideo(video)),
      removedIds: this.expandRefs(payload.r),
      hiddenIds: this.expandRefs(payload.h),
    };
  }

  private toVideo(video: TransferVideo): CustomLibraryVideo {
    if (!isVideoId(video.y)) {
      throw new TransferError("invalidVideo");
    }

    return {
      id: customVideoId(video.y),
      videoId: video.y,
      // Empty strings stay untranslated on purpose: the UI fills in a
      // localized fallback at render time.
      title: video.t || "",
      channel: video.c || "",
      duration: video.d || UNKNOWN_DURATION,
      views: video.w || "",
      accent: video.a || CUSTOM_VIDEO_ACCENT,
      source: "custom",
      status: video.h ? "hidden" : "visible",
    };
  }

  private expandRefs(refs: CompactVideoRef[]) {
    return refs
      .map((ref) => this.catalog.expandRef(ref))
      .filter((id): id is string => Boolean(id));
  }
}
