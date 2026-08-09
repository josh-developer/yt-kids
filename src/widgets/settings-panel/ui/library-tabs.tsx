"use client";

import { useTranslations } from "next-intl";
import type { CurationTab } from "@/features/library-curation";

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
    <div className="settings-tabs" role="tablist" aria-label={t("searchVideos")}>
      {tabs.map((entry) => (
        <button
          key={entry.key}
          className={`settings-tab ${tab === entry.key ? "active" : ""}`}
          type="button"
          onClick={() => onTabChange(entry.key)}
          role="tab"
          aria-selected={tab === entry.key}
          data-tooltip={entry.tooltip}
        >
          {entry.label}
          <span>{entry.count}</span>
        </button>
      ))}
    </div>
  );
}
