import { useTranslations } from "next-intl";
import { Switch } from "@/shared/ui/switch";

export function RecommendationsToggle({
  isEnabled,
  onToggle,
}: {
  isEnabled: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("Watch");

  return (
    <div className="recommendations-header">
      <span className="recommendations-title">{t("recommendationsTitle")}</span>
      <Switch
        isChecked={isEnabled}
        label={t("showRecommendations")}
        onToggle={onToggle}
      />
    </div>
  );
}
