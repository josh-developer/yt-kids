import { useTranslations } from "next-intl";

/**
 * Number formatting comes from the message catalog, not `Intl.NumberFormat`.
 * The Cloudflare Workers runtime ships ICU with English locale data only: it
 * accepts `uz` and then formats it like `en`, so anything server-rendered
 * would disagree with the browser on hydration. Separators live next to the
 * translations instead, which keeps both sides byte-identical.
 */
export function useLocaleNumbers() {
  const t = useTranslations("Format");
  const groupSeparator = t("groupSeparator");
  const decimalSeparator = t("decimalSeparator");

  return {
    /** 1234 -> "1,234" (en) / "1 234" (uz) */
    integer: (value: number) =>
      String(Math.round(value)).replace(
        /\B(?=(\d{3})+(?!\d))/g,
        groupSeparator,
      ),
    /** 1.7 -> "1.7" (en) / "1,7" (uz) */
    decimal: (value: number) => String(value).replace(".", decimalSeparator),
  };
}
