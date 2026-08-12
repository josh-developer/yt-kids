import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./icon-button";
import primitives from "./primitives.module.css";
import { Tooltip } from "./tooltip";
import styles from "./modal-panel.module.css";

/**
 * The paste-a-link and paste-a-code dialogs are the same panel with a
 * different body, so the overlay, heading, status line and submit row live
 * here once.
 */
export function ModalPanel({
  title,
  titleId,
  closeLabel,
  submitLabel,
  submitIcon,
  status,
  children,
  onClose,
  onSubmit,
}: {
  title: string;
  titleId: string;
  closeLabel: string;
  submitLabel: string;
  submitIcon: ReactNode;
  status: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className={styles.pasteOverlay} onClick={onClose} role="presentation">
      <form
        className={styles.pastePanel}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.modalHeading}>
          <h2 id={titleId}>{title}</h2>
          <IconButton label={closeLabel} onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        {children}
        <div className={styles.modalActions}>
          <span className={styles.statusLine}>{status}</span>
          <Tooltip label={submitLabel}>
            <button className={primitives.primaryButton} type="submit">
              {submitIcon}
              {submitLabel}
            </button>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
