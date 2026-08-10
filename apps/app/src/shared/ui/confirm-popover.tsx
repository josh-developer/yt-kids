import styles from "./confirm-popover.module.css";
export type ConfirmTone = "approve" | "danger";

export function ConfirmPopover({
  cancelLabel,
  confirmLabel,
  message,
  tone,
  onCancel,
  onConfirm,
}: {
  cancelLabel: string;
  confirmLabel: string;
  message: string;
  tone: ConfirmTone;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.bulkConfirmPopover} role="dialog" aria-label={message}>
      <p>{message}</p>
      <div className={styles.bulkConfirmActions}>
        <button
          className={styles.confirmPopoverButton}
          type="button"
          onClick={onCancel}
          data-tooltip={cancelLabel}
        >
          {cancelLabel}
        </button>
        <button
          className={`${styles.confirmPopoverButton} ${tone === "danger" ? styles.dangerConfirm : styles.approveConfirm}`}
          type="button"
          onClick={onConfirm}
          data-tooltip={confirmLabel}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
