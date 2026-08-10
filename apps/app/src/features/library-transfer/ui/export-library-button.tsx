import { Check, Copy, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ExportState } from "../model/use-library-transfer";
import primitives from "@/shared/ui/primitives.module.css";
import styles from "./export-library-button.module.css";

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
      className={`${primitives.iconButton} ${styles.tooltipButton} ${state === "idle" ? "" : styles.showTooltip}`}
      type="button"
      onClick={onExport}
      aria-label={t("exportParentSettings")}
      data-tooltip={t("exportParentSettings")}
      // This button renders its own tooltip element, so it opts out of the
      // attribute-driven one in globals.css.
      data-tooltip-mode="manual"
    >
      {state === "copied" ? (
        <Check size={19} />
      ) : state === "copying" ? (
        <Copy size={19} />
      ) : (
        <Upload size={19} />
      )}
      <span className={styles.buttonTooltip} role="status">
        {tooltip}
      </span>
    </button>
  );
}
