import { useState } from "react";
import type { LibraryController } from "@/entities/library";
import type { Video } from "@/entities/video";

export type CurationTab = "approved" | "hidden";

/**
 * Approve / hide / remove / reset, plus the settings screen's local view state
 * (search box, tab, which confirmation popover is open).
 */
export function useLibraryCuration({ library, update }: LibraryController) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<CurationTab>("approved");

  const results = library.search(query);
  const approvedResults = results.filter((video) =>
    library.isApproved(video.id),
  );
  const hiddenResults = results.filter((video) => !library.isApproved(video.id));

  return {
    query,
    tab,
    approvedResults,
    hiddenResults,
    visibleResults: tab === "approved" ? approvedResults : hiddenResults,
    setQuery,
    setTab,
    approve: (video: Video) => update((current) => current.approve(video.id)),
    hide: (video: Video) => update((current) => current.hide(video.id)),
    approveAll: () => update((current) => current.approveAll()),
    hideAll: () => update((current) => current.hideAll()),
    remove: (video: Video) => update((current) => current.remove(video)),
    reset: () => {
      setQuery("");
      update((current) => current.reset());
    },
  };
}

export type LibraryCurationController = ReturnType<typeof useLibraryCuration>;
