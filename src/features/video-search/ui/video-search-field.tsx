import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import primitives from "@/shared/ui/primitives.module.css";
import styles from "./video-search-field.module.css";

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
      className={`${primitives.field} ${styles.searchWrap}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input
        className={primitives.fieldInput}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={t("searchApprovedVideos")}
        aria-label={t("searchApprovedVideos")}
      />
      <button
        className={primitives.searchButton}
        type="submit"
        aria-label={t("search")}
        data-tooltip={t("search")}
      >
        <Search size={20} />
      </button>
    </form>
  );
}
