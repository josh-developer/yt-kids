import { useTranslations } from "next-intl";
import type { CurationTab } from "@/features/library-curation";
import { Tooltip } from "@/shared/ui/tooltip";
import styles from "./settings-panel.module.css";

export function LibraryTabs({
  approvedCount,
  hiddenCount,
  tab,
  onTabChange,
}: {
  approvedCount: number;
  hiddenCount: number;
  tab: CurationTab;
  onTabChange: (tab: CurationTab) => void;
}) {
  const t = useTranslations("Settings");

  const tabs = [
    {
      key: "approved" as const,
      label: t("approvedVideos"),
      tooltip: t("showApprovedVideos"),
      count: approvedCount,
    },
    {
      key: "hidden" as const,
      label: t("hiddenVideos"),
      tooltip: t("showHiddenVideos"),
      count: hiddenCount,
    },
  ];

  return (
    <div className={styles.settingsTabs} role="tablist" aria-label={t("searchVideos")}>
      {tabs.map((entry) => (
        <Tooltip label={entry.tooltip} key={entry.key}>
          <button
            className={`${styles.settingsTab} ${tab === entry.key ? styles.active : ""}`}
            type="button"
            onClick={() => onTabChange(entry.key)}
            role="tab"
            aria-selected={tab === entry.key}
          >
            {entry.label}
            <span>{entry.count}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
