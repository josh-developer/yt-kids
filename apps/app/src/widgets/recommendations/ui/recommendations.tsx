import { useTranslations } from "next-intl";
import { Fragment } from "react";
import type { RecommendationGroup } from "@/entities/library";
import { VideoSummary, VideoThumbnail, type Video } from "@/entities/video";
import { RecommendationsToggle } from "@/features/recommendations-toggle";
import { VirtualGrid } from "@/shared/ui/virtual-grid";
import styles from "./recommendations.module.css";

const GROUP_TITLES = {
  series: "seriesTitle",
  recommended: "recommendedTitle",
} as const;

/**
 * Below this a group is cheaper to mount whole than to measure. Above it —
 * a serial can run to eighty episodes — every card would be a thumbnail and
 * five nodes the viewer never scrolls to.
 */
const VIRTUALISE_ABOVE = 12;

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

              {group.videos.length > VIRTUALISE_ABOVE ? (
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
