import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { ModalPanel } from "@/shared/ui/modal-panel";
import primitives from "@/shared/ui/primitives.module.css";
import styles from "./import-library-dialog.module.css";

export function ImportLibraryDialog({
  code,
  status,
  onCodeChange,
  onClose,
  onSubmit,
}: {
  code: string;
  status: string;
  onCodeChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("Settings");

  return (
    <ModalPanel
      title={t("importSettings")}
      titleId="import-settings-title"
      closeLabel={t("close")}
      submitLabel={t("importSettings")}
      submitIcon={<Upload size={18} />}
      status={status}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <textarea
        className={`${primitives.fieldInput} ${styles.transferCodeInput}`}
        autoFocus
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
        placeholder={t("pasteExportCode")}
        aria-label={t("pasteExportCode")}
      />
    </ModalPanel>
  );
}
