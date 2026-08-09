import { Download, Plus, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useLocaleNumbers } from "@/shared/lib/i18n/use-locale-numbers";
import { ConfirmPopover } from "@/shared/ui/confirm-popover";
import { IconButton } from "@/shared/ui/icon-button";
import { ExportLibraryButton } from "@/features/library-transfer";
import type { ExportState } from "@/features/library-transfer";

export function SettingsHeader({
  approvedCount,
  exportState,
  isImportOpen,
  isTransferImportOpen,
  onExport,
  onReset,
  onToggleImport,
  onToggleTransferImport,
}: {
  approvedCount: number;
  exportState: ExportState;
  isImportOpen: boolean;
  isTransferImportOpen: boolean;
  onExport: () => void;
  onReset: () => void;
  onToggleImport: () => void;
  onToggleTransferImport: () => void;
}) {
  const t = useTranslations("Settings");
  const numbers = useLocaleNumbers();
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  return (
    <div className="section-heading">
      <div>
        <h1>{t("title")}</h1>
        <div className="muted">
          {t("approvedCount", {
            count: approvedCount,
            value: numbers.integer(approvedCount),
          })}
        </div>
      </div>
      <div className="settings-heading-actions">
        <ExportLibraryButton state={exportState} onExport={onExport} />
        <IconButton
          label={t("importParentSettings")}
          isActive={isTransferImportOpen}
          onClick={onToggleTransferImport}
        >
          <Download size={19} />
        </IconButton>
        <IconButton label={t("addVideoLink")} onClick={onToggleImport}>
          {isImportOpen ? <X size={19} /> : <Plus size={19} />}
        </IconButton>
        <div className="settings-reset-wrap">
          <IconButton
            className="danger-icon-button"
            label={t("resetAllVideos")}
            isExpanded={isResetConfirmOpen}
            onClick={() => setIsResetConfirmOpen((open) => !open)}
          >
            <RotateCcw size={19} />
          </IconButton>
          {isResetConfirmOpen ? (
            <ConfirmPopover
              tone="danger"
              message={t("resetAllVideosConfirm")}
              confirmLabel={t("resetAllVideos")}
              cancelLabel={t("cancel")}
              onCancel={() => setIsResetConfirmOpen(false)}
              onConfirm={() => {
                onReset();
                setIsResetConfirmOpen(false);
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
