"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

export function VideoSearchField({
  query,
  onQueryChange,
  onSubmit,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("TopBar");

  return (
    <form
      className="search-wrap"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={t("searchApprovedVideos")}
        aria-label={t("searchApprovedVideos")}
      />
      <button
        className="search-button"
        type="submit"
        aria-label={t("search")}
        data-tooltip={t("search")}
      >
        <Search size={20} />
      </button>
    </form>
  );
}
