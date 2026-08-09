import { useTranslations } from "next-intl";
import { Fragment } from "react";
import type { RecommendationGroup } from "@/entities/library";
import { VideoSummary, VideoThumbnail, type Video } from "@/entities/video";
import { RecommendationsToggle } from "@/features/recommendations-toggle";
import { VirtualGrid } from "@/shared/ui/virtual-grid";
import styles from "./recommendations.module.css";

const GROUP_TITLES = {
  series: "seriesTitle",
  similar: "similarTitle",
  more: "moreTitle",
} as const;

export function Recommendations({
  groups,
  isEnabled,
  onOpenVideo,
  onToggle,
}: {
  groups: RecommendationGroup[];
  isEnabled: boolean;
  onOpenVideo: (video: Video) => void;
  onToggle: () => void;
}) {
  const t = useTranslations("Watch");

  function card(video: Video) {
    return (
      <button
        className={styles.recommendationCard}
        type="button"
        onClick={() => onOpenVideo(video)}
      >
        <VideoThumbnail video={video} />
        <VideoSummary video={video} />
      </button>
    );
  }

  return (
    <aside className={styles.recommendationsPanel}>
      <RecommendationsToggle isEnabled={isEnabled} onToggle={onToggle} />

      {isEnabled
        ? groups.map((group) => (
            <section className={styles.recommendationGroup} key={group.key}>
              {/* A single group is the whole sidebar — no heading needed. */}
              {groups.length > 1 ? (
                <h2 className={styles.recommendationGroupTitle}>
                  {t(GROUP_TITLES[group.key])}
                </h2>
              ) : null}

              {/*
                Only the open-ended "everything else" group is virtualised; a
                series is short enough that mounting it whole keeps the episode
                list scrollable without measurement.
              */}
              {group.key === "more" ? (
                <VirtualGrid
                  items={group.videos}
                  className={styles.recommendations}
                  ariaLabel={t("recommendations")}
                  getKey={(video) => video.id}
                  renderItem={card}
                />
              ) : (
                <div className={styles.recommendations} aria-label={t("recommendations")}>
                  {/* Fragments keep the cards as direct grid children. */}
                  {group.videos.map((video) => (
                    <Fragment key={video.id}>{card(video)}</Fragment>
                  ))}
                </div>
              )}
            </section>
          ))
        : null}
    </aside>
  );
}
