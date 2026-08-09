import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { ModalPanel } from "@/shared/ui/modal-panel";

export function ImportVideoDialog({
  url,
  status,
  onUrlChange,
  onClose,
  onSubmit,
}: {
  url: string;
  status: string;
  onUrlChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("Settings");

  return (
    <ModalPanel
      title={t("addVideoLink")}
      titleId="add-video-title"
      closeLabel={t("close")}
      submitLabel={t("addVideo")}
      submitIcon={<Plus size={18} />}
      status={status}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="paste-row">
        <input
          autoFocus
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder={t("pasteYoutubeLink")}
          aria-label={t("pasteYoutubeLink")}
        />
      </div>
    </ModalPanel>
  );
}
