"use client";

import { Plus } from "lucide-react";
import type { CopyText } from "../../lib/copy";

export function LoadingVideoView({ copy }: { copy: CopyText }) {
  return (
    <div className="empty-state">
      <div>
        <h2>{copy.loadingVideo}</h2>
        <p className="muted">{copy.checkingApprovedLibrary}</p>
      </div>
    </div>
  );
}

export function UnavailableVideoView({
  copy,
  onHome,
  onSettings,
}: {
  copy: CopyText;
  onHome: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="empty-state">
      <div>
        <h2>{copy.videoUnavailable}</h2>
        <p className="muted">{copy.videoUnavailableMessage}</p>
        <div className="empty-actions">
          <button
            className="primary-button"
            type="button"
            onClick={onHome}
            data-tooltip={copy.goHome}
          >
            {copy.home}
          </button>
          <button
            className="pill-button"
            type="button"
            onClick={onSettings}
            data-tooltip={copy.openSettings}
          >
            <Plus size={18} />
            {copy.parentSettings}
          </button>
        </div>
      </div>
    </div>
  );
}
