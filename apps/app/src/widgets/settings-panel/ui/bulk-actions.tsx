import { EyeOff, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useOutsidePointerDown } from "@/shared/lib/use-outside-pointer-down";
import { ConfirmPopover } from "@/shared/ui/confirm-popover";
import primitives from "@/shared/ui/primitives.module.css";
import styles from "./settings-panel.module.css";

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
  const actionsRef = useRef<HTMLDivElement>(null);
  const [openAction, setOpenAction] = useState<BulkAction | null>(null);

  useOutsidePointerDown(actionsRef, () => setOpenAction(null), openAction !== null);

  const actions = [
    {
      key: "approve" as const,
      className: primitives.approveCompactButton,
      icon: <Plus size={16} />,
      label: t("approveAll"),
      tooltip: t("approveAllVideos"),
      message: t("approveAllConfirm"),
      tone: "approve" as const,
      run: onApproveAll,
    },
    {
      key: "hide" as const,
      className: primitives.dangerCompactButton,
      icon: <EyeOff size={16} />,
      label: t("hideAll"),
      tooltip: t("hideAllVideos"),
      message: t("hideAllConfirm"),
      tone: "danger" as const,
      run: onHideAll,
    },
  ];

  return (
    <div
      className={styles.settingsBulkActions}
      ref={actionsRef}
      aria-label={t("approveAllVideos")}
    >
      {actions.map((action) => (
        <div className={styles.bulkActionWrap} key={action.key}>
          <button
            className={`${primitives.compactButton} ${action.className}`}
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
              confirmLabel={t("yes")}
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
