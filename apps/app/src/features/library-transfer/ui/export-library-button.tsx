import { Check, Copy, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ExportState } from "../model/use-library-transfer";
import primitives from "@/shared/ui/primitives.module.css";
import { Tooltip } from "@/shared/ui/tooltip";

export function ExportLibraryButton({
  state,
  onExport,
}: {
  state: ExportState;
  onExport: () => void;
}) {
  const t = useTranslations("Settings");
  const statusLabel =
    state === "copied"
      ? t("exportCopied")
      : state === "copying"
        ? t("copying")
        : state === "failed"
          ? t("copyFailed")
          : "";
  const isStatusVisible = state !== "idle";

  return (
    <Tooltip
      label={statusLabel || t("exportParentSettings")}
      isOpen={isStatusVisible ? true : undefined}
      role={isStatusVisible ? "status" : "tooltip"}
    >
      <button
        className={primitives.iconButton}
        type="button"
        onClick={onExport}
        aria-label={t("exportParentSettings")}
      >
        {state === "copied" ? (
          <Check size={19} />
        ) : state === "copying" ? (
          <Copy size={19} />
        ) : (
          <Upload size={19} />
        )}
      </button>
    </Tooltip>
  );
}
