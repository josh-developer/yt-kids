"use client";

import { Check, Copy, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ExportState } from "../model/use-library-transfer";

export function ExportLibraryButton({
  state,
  onExport,
}: {
  state: ExportState;
  onExport: () => void;
}) {
  const t = useTranslations("Settings");
  const tooltip =
    state === "copied"
      ? t("exportCopied")
      : state === "copying"
        ? t("copying")
        : state === "failed"
          ? t("copyFailed")
          : "";

  return (
    <button
      className={`icon-button tooltip-button ${state === "idle" ? "" : "show-tooltip"}`}
      type="button"
      onClick={onExport}
      aria-label={t("exportParentSettings")}
      data-tooltip={t("exportParentSettings")}
    >
      {state === "copied" ? (
        <Check size={19} />
      ) : state === "copying" ? (
        <Copy size={19} />
      ) : (
        <Upload size={19} />
      )}
      <span className="button-tooltip" role="status">
        {tooltip}
      </span>
    </button>
  );
}
