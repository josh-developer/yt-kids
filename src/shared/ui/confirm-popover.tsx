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
    <div className="bulk-confirm-popover" role="dialog" aria-label={message}>
      <p>{message}</p>
      <div className="bulk-confirm-actions">
        <button
          className="confirm-popover-button"
          type="button"
          onClick={onCancel}
          data-tooltip={cancelLabel}
        >
          {cancelLabel}
        </button>
        <button
          className={`confirm-popover-button ${tone === "danger" ? "danger-confirm" : "approve-confirm"}`}
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
