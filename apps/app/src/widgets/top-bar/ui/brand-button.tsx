import { useTranslations } from "next-intl";
import styles from "./top-bar.module.css";

export function BrandButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("TopBar");

  return (
    <button
      className={styles.brand}
      type="button"
      onClick={onClick}
      aria-label={t("goHome")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.brandMark}
        src="/brand-mascot-header.png"
        alt=""
        aria-hidden="true"
      />
      <span className={styles.brandName} aria-label="KidTube">
        <span className={styles.brandKid} aria-hidden="true">
          <span className={`${styles.brandLetter} ${styles.brandLetterK}`}>K</span>
          <span className={`${styles.brandLetter} ${styles.brandLetterI}`}>i</span>
          <span className={`${styles.brandLetter} ${styles.brandLetterD}`}>d</span>
        </span>
        <span className={styles.brandTube}>Tube</span>
      </span>
    </button>
  );
}
