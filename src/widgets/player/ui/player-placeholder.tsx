import styles from "./player.module.css";

/**
 * The player's footprint, before there is a video to put in it.
 *
 * The watch screen is server-rendered before the library has been read out of
 * local storage, so the first paint has no video to show. Painting a small
 * notice there and the player a moment later drops the title, the channel line
 * and everything under them — a shift big enough to fail CLS on its own. This
 * reserves the exact box the player will occupy by wearing the same class, so
 * the two can never drift apart.
 */
export function PlayerPlaceholder({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className={`${styles.playerBox} ${styles.playerPlaceholder}`}>
      {children}
    </div>
  );
}
