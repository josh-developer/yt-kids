"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { LibraryController } from "@/entities/library";
import { useLibraryCuration } from "@/features/library-curation";
import { ImportLibraryDialog, useLibraryTransfer } from "@/features/library-transfer";
import { ImportVideoDialog, useVideoImport } from "@/features/video-import";
import { BulkActions } from "./bulk-actions";
import { LibraryResults } from "./library-results";
import { LibraryTabs } from "./library-tabs";
import { SettingsHeader } from "./settings-header";

/** The parent screen: curate the library, add videos, move it between devices. */
export function SettingsPanel({
  libraryController,
}: {
  libraryController: LibraryController;
}) {
  const t = useTranslations("Settings");
  const { library, repository, replace } = libraryController;
  const curation = useLibraryCuration(libraryController);
  const videoImport = useVideoImport(libraryController);
  const transfer = useLibraryTransfer({
    repository,
    library,
    onImported: replace,
  });
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isTransferImportOpen, setIsTransferImportOpen] = useState(false);

  return (
    <div className="settings-layout">
      <section>
        <SettingsHeader
          approvedCount={library.approvedCount}
          exportState={transfer.exportState}
          isImportOpen={isImportOpen}
          isTransferImportOpen={isTransferImportOpen}
          onExport={transfer.exportLibrary}
          onReset={() => {
            curation.reset();
            videoImport.setStatus("");
            setIsImportOpen(false);
            setIsTransferImportOpen(false);
          }}
          onToggleImport={() => setIsImportOpen((open) => !open)}
          onToggleTransferImport={() =>
            setIsTransferImportOpen((open) => !open)
          }
        />

        <div className="settings-toolbar">
          <div className="settings-search">
            <input
              value={curation.query}
              onChange={(event) => curation.setQuery(event.target.value)}
              placeholder={t("searchVideos")}
              aria-label={t("searchVideos")}
            />
          </div>
        </div>

        <LibraryTabs
          approvedCount={curation.approvedResults.length}
          hiddenCount={curation.hiddenResults.length}
          tab={curation.tab}
          onTabChange={curation.setTab}
        />

        <BulkActions
          onApproveAll={curation.approveAll}
          onHideAll={curation.hideAll}
        />

        {isImportOpen ? (
          <ImportVideoDialog
            url={videoImport.url}
            status={videoImport.status}
            onUrlChange={videoImport.setUrl}
            onClose={() => setIsImportOpen(false)}
            onSubmit={async () => {
              if (await videoImport.importFromUrl()) {
                setIsImportOpen(false);
              }
            }}
          />
        ) : null}

        {isTransferImportOpen ? (
          <ImportLibraryDialog
            code={transfer.code}
            status={transfer.status}
            onCodeChange={transfer.setCode}
            onClose={() => setIsTransferImportOpen(false)}
            onSubmit={async () => {
              if (await transfer.importLibrary()) {
                setIsTransferImportOpen(false);
              }
            }}
          />
        ) : null}

        <LibraryResults
          isApproved={(video) => library.isApproved(video.id)}
          tab={curation.tab}
          videos={curation.visibleResults}
          onApprove={curation.approve}
          onHide={curation.hide}
          onRemove={curation.remove}
        />
      </section>
    </div>
  );
}
