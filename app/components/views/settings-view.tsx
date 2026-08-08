"use client";

import {
  Check,
  Copy,
  Download,
  EyeOff,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { CopyText } from "../../lib/copy";
import type { Video } from "../../lib/types";
import { BulkConfirmPopover } from "../ui/bulk-confirm-popover";
import { Thumbnail } from "../ui/thumbnail";

export function SettingsView({
  approvedCount,
  copy,
  exportTooltip,
  isImportOpen,
  isTransferImportOpen,
  libraryQuery,
  libraryResults,
  pasteError,
  pasteUrl,
  selectedIds,
  transferCode,
  transferStatus,
  onAddPastedVideo,
  onApproveAll,
  onExportLibrary,
  onHideAll,
  onImportLibrary,
  onOpenImport,
  onOpenTransferImport,
  onPasteUrlChange,
  onQueryChange,
  onApprove,
  onRemoveCompletely,
  onResetAllVideos,
  onTransferCodeChange,
  onUnapprove,
}: {
  approvedCount: number;
  copy: CopyText;
  exportTooltip: string;
  isImportOpen: boolean;
  isTransferImportOpen: boolean;
  libraryQuery: string;
  libraryResults: Video[];
  pasteError: string;
  pasteUrl: string;
  selectedIds: string[];
  transferCode: string;
  transferStatus: string;
  onAddPastedVideo: () => void;
  onApproveAll: () => void;
  onExportLibrary: () => void;
  onHideAll: () => void;
  onImportLibrary: () => void;
  onOpenImport: () => void;
  onOpenTransferImport: () => void;
  onPasteUrlChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onApprove: (video: Video) => void;
  onRemoveCompletely: (video: Video) => void;
  onResetAllVideos: () => void;
  onTransferCodeChange: (value: string) => void;
  onUnapprove: (video: Video) => void;
}) {
  const [settingsTab, setSettingsTab] = useState<"approved" | "hidden">(
    "approved",
  );
  const [confirmAction, setConfirmAction] = useState<"approve" | "hide" | null>(
    null,
  );
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const approvedIds = useMemo(() => new Set(selectedIds), [selectedIds]);
  const approvedResults = useMemo(
    () => libraryResults.filter((video) => approvedIds.has(video.id)),
    [approvedIds, libraryResults],
  );
  const hiddenResults = useMemo(
    () => libraryResults.filter((video) => !approvedIds.has(video.id)),
    [approvedIds, libraryResults],
  );
  const visibleResults =
    settingsTab === "approved" ? approvedResults : hiddenResults;
  const exportTooltipLabel =
    exportTooltip === "copied"
      ? copy.exportCopied
      : exportTooltip === "copying"
        ? copy.copying
        : exportTooltip === "failed"
          ? copy.copyFailed
          : "";

  return (
    <div className="settings-layout">
      <section>
        <div className="section-heading">
          <div>
            <h1>{copy.parentSettings}</h1>
            <div className="muted">{copy.approvedCount(approvedCount)}</div>
          </div>
          <div className="settings-heading-actions">
            <button
              className={`icon-button tooltip-button ${exportTooltip ? "show-tooltip" : ""}`}
              type="button"
              onClick={onExportLibrary}
              aria-label={copy.exportParentSettings}
              data-tooltip={copy.exportParentSettings}
            >
              {exportTooltip === "copied" ? (
                <Check size={19} />
              ) : exportTooltip === "copying" ? (
                <Copy size={19} />
              ) : (
                <Upload size={19} />
              )}
              <span className="button-tooltip" role="status">
                {exportTooltipLabel}
              </span>
            </button>
            <button
              className={`icon-button ${isTransferImportOpen ? "active" : ""}`}
              type="button"
              onClick={onOpenTransferImport}
              aria-label={copy.importParentSettings}
              data-tooltip={copy.importParentSettings}
            >
              <Download size={19} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={onOpenImport}
              aria-label={copy.addVideoLink}
              data-tooltip={copy.addVideoLink}
            >
              {isImportOpen ? <X size={19} /> : <Plus size={19} />}
            </button>
            <div className="settings-reset-wrap">
              <button
                className="icon-button danger-icon-button"
                type="button"
                onClick={() => setIsResetConfirmOpen((open) => !open)}
                aria-expanded={isResetConfirmOpen}
                aria-label={copy.resetAllVideos}
                data-tooltip={copy.resetAllVideos}
              >
                <RotateCcw size={19} />
              </button>
              {isResetConfirmOpen ? (
                <BulkConfirmPopover
                  tone="danger"
                  message={copy.resetAllVideosConfirm}
                  confirmLabel={copy.resetAllVideos}
                  cancelLabel={copy.cancel}
                  onCancel={() => setIsResetConfirmOpen(false)}
                  onConfirm={() => {
                    onResetAllVideos();
                    setIsResetConfirmOpen(false);
                    setConfirmAction(null);
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="settings-toolbar">
          <div className="settings-search">
            <input
              value={libraryQuery}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={copy.searchVideos}
              aria-label={copy.searchVideos}
            />
          </div>
        </div>

        <div className="settings-tabs" role="tablist" aria-label={copy.searchVideos}>
          <button
            className={`settings-tab ${settingsTab === "approved" ? "active" : ""}`}
            type="button"
            onClick={() => setSettingsTab("approved")}
            role="tab"
            aria-selected={settingsTab === "approved"}
            data-tooltip={copy.showApprovedVideos}
          >
            {copy.approvedVideos}
            <span>{approvedResults.length}</span>
          </button>
          <button
            className={`settings-tab ${settingsTab === "hidden" ? "active" : ""}`}
            type="button"
            onClick={() => setSettingsTab("hidden")}
            role="tab"
            aria-selected={settingsTab === "hidden"}
            data-tooltip={copy.showHiddenVideos}
          >
            {copy.hiddenVideos}
            <span>{hiddenResults.length}</span>
          </button>
        </div>

        <div className="settings-bulk-actions" aria-label={copy.approveAllVideos}>
          <div className="bulk-action-wrap">
            <button
              className="compact-button approve-compact-button"
              type="button"
              onClick={() =>
                setConfirmAction((action) =>
                  action === "approve" ? null : "approve",
                )
              }
              aria-expanded={confirmAction === "approve"}
              data-tooltip={copy.approveAllVideos}
            >
              <Plus size={16} />
              {copy.approveAll}
            </button>
            {confirmAction === "approve" ? (
              <BulkConfirmPopover
                tone="approve"
                message={copy.approveAllConfirm}
                confirmLabel={copy.approveAll}
                cancelLabel={copy.cancel}
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => {
                  onApproveAll();
                  setConfirmAction(null);
                }}
              />
            ) : null}
          </div>
          <div className="bulk-action-wrap">
            <button
              className="compact-button danger-compact-button"
              type="button"
              onClick={() =>
                setConfirmAction((action) => (action === "hide" ? null : "hide"))
              }
              aria-expanded={confirmAction === "hide"}
              data-tooltip={copy.hideAllVideos}
            >
              <EyeOff size={16} />
              {copy.hideAll}
            </button>
            {confirmAction === "hide" ? (
              <BulkConfirmPopover
                tone="danger"
                message={copy.hideAllConfirm}
                confirmLabel={copy.hideAll}
                cancelLabel={copy.cancel}
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => {
                  onHideAll();
                  setConfirmAction(null);
                }}
              />
            ) : null}
          </div>
        </div>

        {isImportOpen ? (
          <div
            className="paste-overlay"
            onClick={onOpenImport}
            role="presentation"
          >
            <form
              className="paste-panel"
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                onAddPastedVideo();
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-video-title"
            >
              <div className="modal-heading">
                <h2 id="add-video-title">{copy.addVideoLink}</h2>
                <button
                  className="icon-button"
                  type="button"
                  onClick={onOpenImport}
                  aria-label={copy.close}
                  data-tooltip={copy.close}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="paste-row">
                <input
                  autoFocus
                  value={pasteUrl}
                  onChange={(event) => onPasteUrlChange(event.target.value)}
                  placeholder={copy.pasteYoutubeLink}
                  aria-label={copy.pasteYoutubeLink}
                />
              </div>
              <div className="modal-actions">
                <span className="status-line">{pasteError}</span>
                <button
                  className="primary-button"
                  type="submit"
                  data-tooltip={copy.addVideo}
                >
                  <Plus size={18} />
                  {copy.addVideo}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {isTransferImportOpen ? (
          <div
            className="paste-overlay"
            onClick={onOpenTransferImport}
            role="presentation"
          >
            <form
              className="paste-panel"
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                onImportLibrary();
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="import-settings-title"
            >
              <div className="modal-heading">
                <h2 id="import-settings-title">{copy.importSettings}</h2>
                <button
                  className="icon-button"
                  type="button"
                  onClick={onOpenTransferImport}
                  aria-label={copy.close}
                  data-tooltip={copy.close}
                >
                  <X size={18} />
                </button>
              </div>
              <textarea
                className="transfer-code-input"
                autoFocus
                value={transferCode}
                onChange={(event) => onTransferCodeChange(event.target.value)}
                placeholder={copy.pasteExportCode}
                aria-label={copy.pasteExportCode}
              />
              <div className="modal-actions">
                <span className="status-line">{transferStatus}</span>
                <button
                  className="primary-button"
                  type="submit"
                  data-tooltip={copy.importSettings}
                >
                  <Upload size={18} />
                  {copy.importSettings}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="library-results">
          {visibleResults.length === 0 ? (
            <div className="settings-empty muted">
              {copy.noVideosFound(settingsTab)}
            </div>
          ) : null}
          {visibleResults.map((video) => {
            const approvedVideo = approvedIds.has(video.id);
            return (
              <div className="result-card" key={video.id}>
                <Thumbnail video={video} />
                <div className="result-info">
                  <span className="video-title">{video.title}</span>
                  <span className="video-subline">{video.channel}</span>
                </div>
                <div className="settings-row-actions">
                  {approvedVideo ? (
                    <button
                      className="icon-button hide-icon"
                      type="button"
                      onClick={() => onUnapprove(video)}
                      aria-label={`${copy.hide} ${video.title}`}
                      data-tooltip={copy.hide}
                    >
                      <EyeOff size={18} />
                    </button>
                  ) : (
                    <button
                      className="icon-button show-icon"
                      type="button"
                      onClick={() => onApprove(video)}
                      aria-label={`${copy.show} ${video.title}`}
                      data-tooltip={copy.show}
                    >
                      <Plus size={18} />
                    </button>
                  )}
                  <button
                    className="icon-button remove-icon"
                    type="button"
                    onClick={() => onRemoveCompletely(video)}
                    aria-label={copy.removeCompletelyLabel(video.title)}
                    data-tooltip={copy.removeCompletely}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
