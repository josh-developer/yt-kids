import { useLocale, useTranslations } from "next-intl";
import { routing } from "@repo/internationalization/routing";
import styles from "./privacy-page.module.css";

const GOOGLE_PRIVACY_URL = "https://policies.google.com/privacy";

/**
 * A plain server-rendered document, deliberately outside the client shell:
 * app stores want a public, always-readable privacy policy URL, so this page
 * must not depend on hydration, the library, or the in-app router.
 */
export function PrivacyPage() {
  const locale = useLocale();
  const t = useTranslations("Privacy");

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <h1>{t("title")}</h1>
        {/* Plain links, one per locale: the reader picks their language even
            though this page renders without the app's top bar. */}
        <nav className={styles.localeLinks}>
          {routing.locales.map((availableLocale) => (
            <a
              key={availableLocale}
              aria-current={availableLocale === locale ? "true" : undefined}
              href={`/${availableLocale}/privacy`}
              lang={availableLocale}
            >
              {availableLocale === "uz" ? "Oʻzbekcha" : "English"}
            </a>
          ))}
        </nav>
      </header>

      <p>{t("intro")}</p>

      <h2>{t("dataTitle")}</h2>
      <p>{t("dataBody")}</p>

      <h2>{t("sourceTitle")}</h2>
      <p>{t("sourceBody")}</p>
      <p>
        {t("sourcePolicyLead")}{" "}
        <a href={GOOGLE_PRIVACY_URL} rel="noreferrer" target="_blank">
          {t("sourcePolicyLinkLabel")}
        </a>
      </p>

      <h2>{t("responsibilityTitle")}</h2>
      <p>{t("responsibilityBody")}</p>

      <h2>{t("contactTitle")}</h2>
      <p>{t("contactBody")}</p>

      <a className={styles.backLink} href={`/${locale}`}>
        {t("backToApp")}
      </a>
    </article>
  );
}
