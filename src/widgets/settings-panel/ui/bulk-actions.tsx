"use client";

import { EyeOff, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmPopover } from "@/shared/ui/confirm-popover";

type BulkAction = "approve" | "hide";

/** Approve-all / hide-all, each behind its own confirmation popover. */
export function BulkActions({
  onApproveAll,
  onHideAll,
}: {
  onApproveAll: () => void;
  onHideAll: () => void;
}) {
  const t = useTranslations("Settings");
  const [openAction, setOpenAction] = useState<BulkAction | null>(null);

  const actions = [
    {
      key: "approve" as const,
      className: "approve-compact-button",
      icon: <Plus size={16} />,
      label: t("approveAll"),
      tooltip: t("approveAllVideos"),
      message: t("approveAllConfirm"),
      tone: "approve" as const,
      run: onApproveAll,
    },
    {
      key: "hide" as const,
      className: "danger-compact-button",
      icon: <EyeOff size={16} />,
      label: t("hideAll"),
      tooltip: t("hideAllVideos"),
      message: t("hideAllConfirm"),
      tone: "danger" as const,
      run: onHideAll,
    },
  ];

  return (
    <div className="settings-bulk-actions" aria-label={t("approveAllVideos")}>
      {actions.map((action) => (
        <div className="bulk-action-wrap" key={action.key}>
          <button
            className={`compact-button ${action.className}`}
            type="button"
            onClick={() =>
              setOpenAction((current) =>
                current === action.key ? null : action.key,
              )
            }
            aria-expanded={openAction === action.key}
            data-tooltip={action.tooltip}
          >
            {action.icon}
            {action.label}
          </button>
          {openAction === action.key ? (
            <ConfirmPopover
              tone={action.tone}
              message={action.message}
              confirmLabel={action.label}
              cancelLabel={t("cancel")}
              onCancel={() => setOpenAction(null)}
              onConfirm={() => {
                action.run();
                setOpenAction(null);
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
