import { TransferError } from "./transfer-error";

/**
 * WebCrypto and the compression streams take `BufferSource`, which excludes
 * `SharedArrayBuffer`-backed views. Pinning the buffer type keeps every helper
 * here compatible with them.
 */
export type ByteArray = Uint8Array<ArrayBuffer>;

export const COMPRESSED_MODE = "G";
export const PLAIN_MODE = "J";

export function textToBytes(text: string): ByteArray {
  return new TextEncoder().encode(text);
}

export function bytesToText(bytes: ByteArray) {
  return new TextDecoder().decode(bytes);
}

export function base64UrlEncode(bytes: ByteArray) {
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

export function base64UrlDecode(value: string): ByteArray {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function compress(bytes: ByteArray) {
  if (!("CompressionStream" in window)) {
    return { mode: PLAIN_MODE, bytes };
  }

  return { mode: COMPRESSED_MODE, bytes: await pipe("gzip", bytes, true) };
}

export async function decompress(mode: string, bytes: ByteArray) {
  if (mode !== COMPRESSED_MODE) {
    return bytes;
  }

  if (!("DecompressionStream" in window)) {
    throw new TransferError("decompressUnsupported");
  }

  return pipe("gzip", bytes, false);
}

async function pipe(
  format: CompressionFormat,
  bytes: ByteArray,
  isCompressing: boolean,
): Promise<ByteArray> {
  const stream = isCompressing
    ? new CompressionStream(format)
    : new DecompressionStream(format);
  const writer = stream.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
