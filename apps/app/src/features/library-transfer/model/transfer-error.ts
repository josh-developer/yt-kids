export type TransferErrorCode =
  | "invalidCode"
  | "codeTooShort"
  | "decompressUnsupported"
  | "unsupportedVersion"
  | "invalidVideo";

/**
 * Transfer failures carry a stable code instead of an English sentence, so the
 * UI can translate them instead of string-matching on `error.message`.
 */
export class TransferError extends Error {
  readonly code: TransferErrorCode;

  constructor(code: TransferErrorCode) {
    super(code);
    this.name = "TransferError";
    this.code = code;
  }
}
