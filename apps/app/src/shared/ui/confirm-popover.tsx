import styles from "./confirm-popover.module.css";
export type ConfirmTone = "approve" | "danger";

export function ConfirmPopover({
  align = "start",
  cancelLabel,
  confirmLabel,
  message,
  tone,
  onCancel,
  onConfirm,
}: {
  align?: "start" | "end";
  cancelLabel: string;
  confirmLabel: string;
  message: string;
  tone: ConfirmTone;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className={`${styles.bulkConfirmPopover} ${
        align === "end" ? styles.alignEnd : ""
      }`.trim()}
      role="dialog"
      aria-label={message}
    >
      <p>{message}</p>
      <div className={styles.bulkConfirmActions}>
        <button
          className={styles.confirmPopoverButton}
          type="button"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          className={`${styles.confirmPopoverButton} ${tone === "danger" ? styles.dangerConfirm : styles.approveConfirm}`}
          type="button"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
