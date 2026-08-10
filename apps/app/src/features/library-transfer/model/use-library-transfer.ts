import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, type LibraryRepository, type VideoLibrary } from "@/entities/library";
import { TimerBag } from "@/shared/lib/timers";
import { EncryptedTransferCodec } from "./transfer-codec";
import { TransferError } from "./transfer-error";

export type ExportState = "idle" | "copying" | "copied" | "failed";

const TOOLTIP_RESET_MS = 1000;

/**
 * Drives both directions of parent-settings transfer and turns domain errors
 * into localized status text.
 */
export function useLibraryTransfer({
  repository,
  library,
  onImported,
}: {
  repository: LibraryRepository;
  library: VideoLibrary;
  onImported: (library: VideoLibrary) => void;
}) {
  const t = useTranslations("Library");
  const codec = useMemo(() => new EncryptedTransferCodec(CATALOG), []);
  const timers = useRef(new TimerBag());
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const bag = timers.current;
    return () => bag.clearAll();
  }, []);

  async function exportLibrary() {
    setExportState("copying");
    try {
      await window.navigator.clipboard.writeText(
        await codec.encode(library.toJSON()),
      );
      setExportState("copied");
    } catch {
      setExportState("failed");
    } finally {
      timers.current.timeout(
        "tooltip",
        () => setExportState("idle"),
        TOOLTIP_RESET_MS,
      );
    }
  }

  async function importLibrary() {
    setStatus(t("readingImportCode"));
    try {
      onImported(repository.adopt(await codec.decode(code)));
      setCode("");
      setStatus(t("importComplete"));
      return true;
    } catch (error) {
      setStatus(
        error instanceof TransferError
          ? t(`errors.${error.code}`)
          : t("errors.unknown"),
      );
      return false;
    }
  }

  return {
    code,
    exportState,
    status,
    setCode,
    exportLibrary,
    importLibrary,
  };
}

export type LibraryTransferController = ReturnType<typeof useLibraryTransfer>;
