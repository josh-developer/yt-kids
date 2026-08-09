import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./icon-button";

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
    <div className="paste-overlay" onClick={onClose} role="presentation">
      <form
        className="paste-panel"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <IconButton label={closeLabel} onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        {children}
        <div className="modal-actions">
          <span className="status-line">{status}</span>
          <button
            className="primary-button"
            type="submit"
            data-tooltip={submitLabel}
          >
            {submitIcon}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
