// Named rather than default: the package exports both, and the default trips
// `import/no-named-as-default`.
import { IntlMessageFormat } from "intl-messageformat";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as Localization from "expo-localization";
import {
  DEFAULT_LOCALE,
  isAppLocale,
  MESSAGES,
  otherLocale,
  type AppLocale,
} from "./messages";
import { STORAGE_KEYS } from "../../config/app-config";
import { readPreference, writePreference } from "../storage/preferences";

/**
 * The active locale, and a `useTranslations` shaped like the web's.
 *
 * `intl-messageformat` does the formatting — it is the engine `next-intl` uses, so
 * the same catalog entry produces the same string on both platforms. That matters
 * more than it sounds: `LocaleSwitcher.name` is
 * `{locale, select, en {English} uz {O'zbekcha} other {{locale}}}`, and hand-rolling
 * a subset of ICU to read that is how the two drift apart.
 *
 * Formatters are cached per locale and message id. Constructing one parses the
 * pattern, and a card that renders a view count would otherwise re-parse on every
 * frame of a scroll.
 */
type LocaleValue = {
  locale: AppLocale;
  nextLocale: AppLocale;
  isReady: boolean;
  switchLocale: () => void;
};

const LocaleContext = createContext<LocaleValue | null>(null);

/** Only ever holds patterns from the bundled catalogs, so it cannot grow unbounded. */
const formatters = new Map<string, IntlMessageFormat>();

/**
 * The one place the catalogs' literal types are widened.
 *
 * `namespace` and `key` arrive as plain strings from call sites, so a wrong key is
 * caught at runtime by the `undefined` branch below rather than by the compiler. The
 * web gets that checking from `next-intl`'s `AppConfig` augmentation; there is no
 * equivalent here yet, which is why the miss is warned about loudly in development.
 */
function lookup(locale: AppLocale, namespace: string, key: string) {
  // Via `unknown` because a catalog nests — `Library.errors` is itself an object —
  // so it is not directly assignable to a namespace-of-strings record.
  const catalog = MESSAGES[locale] as unknown as Record<
    string,
    Record<string, string> | undefined
  >;

  return catalog[namespace]?.[key];
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(DEFAULT_LOCALE);
  // Rendering before the stored choice is read would show one language and then
  // swap to another, so the first paint waits.
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await readPreference(STORAGE_KEYS.locale);
      if (cancelled) {
        return;
      }

      if (isAppLocale(stored)) {
        setLocale(stored);
      } else {
        // No choice made yet: follow the device, as a fresh browser would follow
        // `Accept-Language`. `getLocales()` is ordered by preference.
        const preferred = Localization.getLocales()
          .map((entry) => entry.languageCode)
          .find((code) => isAppLocale(code ?? null));
        setLocale(isAppLocale(preferred ?? null) ? (preferred as AppLocale) : DEFAULT_LOCALE);
      }

      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const switchLocale = useCallback(() => {
    setLocale((current) => {
      const next = otherLocale(current);
      void writePreference(STORAGE_KEYS.locale, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ locale, nextLocale: otherLocale(locale), isReady, switchLocale }),
    [isReady, locale, switchLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error("useLocale must be used inside a LocaleProvider");
  }

  return value;
}

/**
 * `useTranslations("TopBar")` returns `t("goHome")`, matching the web's call shape
 * so a component can be read against its counterpart there.
 */
export function useTranslations(namespace: string) {
  const { locale } = useLocale();

  return useCallback(
    (key: string, values?: Record<string, string | number>) => {
      const pattern = lookup(locale, namespace, key);
      if (pattern === undefined) {
        // Loud in development, harmless in production: a missing key should be
        // obvious while building and never a blank space in a child's app.
        if (__DEV__) {
          console.warn(`Missing message: ${locale}.${namespace}.${key}`);
        }

        return key;
      }

      if (!values) {
        // Nothing to interpolate; skip the parser entirely. Most strings are this.
        return pattern.includes("{") ? formatWith(locale, namespace, key, pattern, {}) : pattern;
      }

      return formatWith(locale, namespace, key, pattern, values);
    },
    [locale, namespace],
  );
}

function formatWith(
  locale: AppLocale,
  namespace: string,
  key: string,
  pattern: string,
  values: Record<string, string | number>,
) {
  const id = `${locale}.${namespace}.${key}`;

  // A pattern that cannot be formatted must not take the screen down with it. ICU
  // leans on `Intl` — plurals need `Intl.PluralRules`, which Hermes lacks and
  // `intl-polyfill.ts` supplies — and the failure mode is a throw during render. The
  // polyfill is the fix; this is the floor under it, so a gap costs a clumsy string
  // rather than a red box in a child's app.
  try {
    let formatter = formatters.get(id);
    if (!formatter) {
      formatter = new IntlMessageFormat(pattern, locale);
      formatters.set(id, formatter);
    }

    return String(formatter.format(values));
  } catch (error) {
    if (__DEV__) {
      console.warn(`Could not format message ${id}`, error);
    }

    return interpolateSimply(pattern, values);
  }
}

/**
 * Last resort: substitute the plain `{name}` placeholders and leave the rest.
 *
 * Not an ICU implementation and not meant to be one. A plural whose formatter threw
 * comes out with its branches still in it, which is ugly and legible — the point is
 * only that something renders.
 */
function interpolateSimply(
  pattern: string,
  values: Record<string, string | number>,
) {
  return pattern.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}
