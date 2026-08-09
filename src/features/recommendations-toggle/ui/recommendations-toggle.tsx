import { useTranslations } from "next-intl";
import { Switch } from "@/shared/ui/switch";
import styles from "./recommendations-toggle.module.css";

export function RecommendationsToggle({
  isEnabled,
  onToggle,
}: {
  isEnabled: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("Watch");

  return (
    <div className={styles.recommendationsHeader}>
      <span className={styles.recommendationsTitle}>{t("recommendationsTitle")}</span>
      <Switch
        isChecked={isEnabled}
        label={t("showRecommendations")}
        onToggle={onToggle}
      />
    </div>
  );
}
