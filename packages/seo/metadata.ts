import merge from "lodash.merge";
import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, type AppLocale } from "@repo/messages";

/**
 * The canonical public origin, matching the `production` route in
 * `apps/app/wrangler.jsonc`. Hardcoded rather than read from an env var on
 * purpose: this repo ships no app-level env vars, and staging is kept out of
 * search results by the worker's `X-Robots-Tag` header, so absolute URLs may
 * always point at the real site.
 */
export const PRODUCTION_ORIGIN = "https://kidtube.uz";

type MetadataGenerator = Omit<Metadata, "description" | "title"> & {
  title: string;
  description: string;
  image?: string;
  /**
   * Locale-less path of the page ("/", "/privacy", "/watch/abc"). When given,
   * the page declares a canonical URL and one hreflang alternate per locale,
   * so search engines fold `/en/...` and `/uz/...` into one page in two
   * languages instead of two competing pages.
   */
  pathname?: string;
  locale?: AppLocale;
};

const applicationName = "KidTube";

const OPEN_GRAPH_LOCALES: Record<AppLocale, string> = {
  en: "en_US",
  uz: "uz_UZ",
};

/** "/" is the locale root: `/en`, not `/en/`. */
function localePath(locale: string, pathname: string) {
  return `/${locale}${pathname === "/" ? "" : pathname}`;
}

export const createMetadata = ({
  title,
  description,
  image,
  pathname,
  locale = DEFAULT_LOCALE,
  ...properties
}: MetadataGenerator): Metadata => {
  // Unlike upstream next-forge, the title is used as-is: the message catalog
  // owns title formatting (e.g. "{page} | KidTube"), including localization.
  const defaultMetadata: Metadata = {
    title,
    description,
    applicationName,
    metadataBase: new URL(PRODUCTION_ORIGIN),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: applicationName,
    },
    formatDetection: {
      telephone: false,
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: applicationName,
      locale: OPEN_GRAPH_LOCALES[locale],
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: applicationName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
    },
    other: {
      "theme-color": "#fff9e8",
      "mobile-web-app-capable": "yes",
    },
  };

  if (pathname) {
    defaultMetadata.alternates = {
      canonical: localePath(locale, pathname),
      languages: {
        ...Object.fromEntries(
          LOCALES.map((available) => [available, localePath(available, pathname)]),
        ),
        // Language-less visits are negotiated to English by the middleware.
        "x-default": localePath(DEFAULT_LOCALE, pathname),
      },
    };
    defaultMetadata.openGraph = {
      ...defaultMetadata.openGraph,
      url: localePath(locale, pathname),
    };
  }

  const metadata: Metadata = merge(defaultMetadata, properties);

  if (image && metadata.openGraph) {
    // No width/height claim: caller images (video thumbnails) come in
    // whatever aspect the source has, unlike the fixed default card above.
    metadata.openGraph.images = [
      {
        url: image,
        alt: title,
      },
    ];
  }

  return metadata;
};
