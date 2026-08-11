"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { isLikelyTvBrowser } from "@/shared/lib/platform";
import { formatTimestamp } from "@/shared/lib/time";
import { HOME_ROUTE, type AppRoute } from "@/shared/lib/routing/app-routes";
import { useAppRoute } from "@/shared/lib/routing/use-app-route";
import { useLibrary } from "@/entities/library";
import { useVideoLabels, type Video } from "@/entities/video";
import { WatchStack } from "@/entities/watch-history";
import { useLocaleSwitch } from "@/features/locale-switch";
import { useRecommendationsPreference } from "@/features/recommendations-toggle";
import { useTheme } from "@/features/theme-toggle";
import { prefetchVideo } from "@/shared/api/youtube";
import { HomePage } from "@/pages/home";
import { SettingsPage } from "@/pages/settings";
import { WatchLoading, WatchPage, WatchUnavailable } from "@/pages/watch";
import { TopBar, useTopbarAutoHide } from "@/widgets/top-bar";
import { WatchSheet } from "@/widgets/watch-sheet";
import styles from "./kids-tube-app.module.css";

type WatchRoute = Extract<AppRoute, { view: "watch" }>;

function randomSalt() {
  return Date.now() % 233280;
}

/**
 * Application shell: owns the cross-view state (route, library, theme, watch
 * history) and hands each view exactly what it needs. Every piece of logic
 * below this line lives in a hook or a domain class.
 */
export function KidsTubeApp({
  initialRoute = HOME_ROUTE,
}: {
  initialRoute?: AppRoute;
} = {}) {
  const libraryController = useLibrary();
  const { library, isLoaded } = libraryController;
  const { theme, toggle: toggleTheme } = useTheme();
  const recommendationsPreference = useRecommendationsPreference();
  const isTopbarHidden = useTopbarAutoHide();

  const [homeQuery, setHomeQuery] = useState(
    initialRoute.view === "home" ? initialRoute.query : "",
  );
  const [shuffleSalt, setShuffleSalt] = useState(8112);
  // Re-rolled per video so the sidebar is not the same list every time.
  const [recommendationSeed, setRecommendationSeed] = useState(8112);
  const [watchStack, setWatchStack] = useState(() =>
    initialRoute.view === "watch"
      ? WatchStack.startingAt(initialRoute.videoId)
      : WatchStack.empty(),
  );
  const [isTvBrowser, setIsTvBrowser] = useState(false);
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);

  const { route, navigate } = useAppRoute({
    initialRoute,
    locale: useLocale(),
    onExternalRoute: (next) => {
      if (next.view === "watch") {
        setRecommendationSeed(randomSalt());
        setWatchStack((stack) => stack.moveTo(next.videoId));
      }
      if (next.view === "home") {
        setHomeQuery(next.query);
      }
    },
  });

  const { nextLocale, switchLocale } = useLocaleSwitch(route);
  const labels = useVideoLabels();
  const tMetadata = useTranslations("Metadata");
  const tSettings = useTranslations("Settings");
  const tWatch = useTranslations("Watch");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsTvBrowser(isLikelyTvBrowser());
      setShuffleSalt(randomSalt());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  // The watch sheet keeps showing its last video while it slides shut, which
  // by then the route has already left "watch" — so these two are read off
  // the last route that had that shape, not off `route` directly. Setting
  // state directly in the render body (guarded so it only fires the render
  // `route` actually changes shape) keeps this a same-render derivation
  // instead of a one-frame-stale one from an effect.
  const [watchRoute, setWatchRoute] = useState<WatchRoute | null>(
    initialRoute.view === "watch" ? initialRoute : null,
  );
  if (route.view === "watch" && route !== watchRoute) {
    setWatchRoute(route);
  }

  const [backgroundView, setBackgroundView] = useState<"home" | "settings">(
    initialRoute.view === "settings" ? "settings" : "home",
  );
  if (route.view !== "watch" && route.view !== backgroundView) {
    setBackgroundView(route.view);
  }

  const currentVideo = watchRoute ? library.find(watchRoute.videoId) : null;
  const lookup = useMemo(
    () => (id: string) => library.find(id),
    [library],
  );
  const previousEntry = currentVideo
    ? watchStack.previous(currentVideo.id, lookup)
    : null;
  const recommendationGroups = currentVideo
    ? library.recommendationGroupsFor(currentVideo, recommendationSeed)
    : [];
  // The next button walks one stable ring over the whole library — seeded once
  // per session, not re-picked per video — so it plays every approved video
  // before coming back to any of them.
  const nextVideo = currentVideo
    ? library.nextAfter(currentVideo, shuffleSalt)
    : null;
  const homeVideos = library.feed(homeQuery, shuffleSalt);

  useEffect(() => {
    // The in-app router moves between views with `history.pushState`, so the
    // server-rendered metadata only covers the first paint. Keep the tab title
    // in sync from here on.
    if (route.view === "settings") {
      document.title = tMetadata("page", { page: tSettings("title") });
      return;
    }

    if (route.view === "watch") {
      document.title = tMetadata("page", {
        page: currentVideo
          ? labels.title(currentVideo)
          : tWatch("unavailableTitle"),
      });
      return;
    }

    const query = homeQuery.trim();
    document.title = query
      ? tMetadata("search", { query })
      : tMetadata("home");
  }, [currentVideo, homeQuery, labels, route.view, tMetadata, tSettings, tWatch]);

  function openVideo(video: Video) {
    prefetchVideo(video.videoId);
    setRecommendationSeed(randomSalt());
    setWatchStack((stack) => stack.push(video.id));
    navigate({ view: "watch", videoId: video.id });
  }

  function openPreviousVideo() {
    if (!previousEntry) {
      return;
    }

    setWatchStack((stack) => stack.moveToIndex(previousEntry.index));
    navigate({ view: "watch", videoId: previousEntry.video.id });
  }

  function openNextVideo() {
    if (nextVideo) {
      openVideo(nextVideo);
    }
  }

  // Rerolls the feed's shuffle on the way home, the way tapping a logo
  // refreshes a real app's front page, rather than showing back the same
  // order the viewer just left.
  function goHome() {
    setHomeQuery("");
    setShuffleSalt(randomSalt());
    blurSearchField();
    navigate(HOME_ROUTE);
  }

  return (
    <main
      className={styles.appShell}
      // The app's mode, published as attributes rather than as classes. A
      // stylesheet anywhere in the app can read `[data-theme="dark"]` or
      // `[data-tv]`; none of them has to know which class this file uses.
      data-theme={theme}
      data-view={route.view}
      data-player-fullscreen={isPlayerFullscreen ? "" : undefined}
      data-tv={isTvBrowser ? "" : undefined}
    >
      <TopBar
        homeQuery={homeQuery}
        isHidden={isTopbarHidden || isPlayerFullscreen}
        nextLocale={nextLocale}
        theme={theme}
        view={route.view}
        onHome={goHome}
        onHomeQueryChange={setHomeQuery}
        onLocaleSwitch={switchLocale}
        onSearchSubmit={() => {
          blurSearchField();
          navigate({ view: "home", query: homeQuery });
        }}
        onSettings={() => navigate({ view: "settings" })}
        onThemeToggle={toggleTheme}
      />

      <div className={styles.pageFrame}>
        <section className={styles.content}>
          {backgroundView === "settings" ? (
            <SettingsPage libraryController={libraryController} />
          ) : (
            <HomePage
              videos={homeVideos}
              onOpenVideo={openVideo}
              onSettings={() => navigate({ view: "settings" })}
            />
          )}
        </section>
      </div>

      <WatchSheet
        isDismissDisabled={isPlayerFullscreen}
        isActive={route.view === "watch"}
        onDismiss={() => navigate(HOME_ROUTE)}
      >
        {!watchRoute ? null : !isLoaded ? (
          <WatchLoading />
        ) : currentVideo ? (
          <WatchPage
            isTvBrowser={isTvBrowser}
            nextVideo={nextVideo}
            previousVideo={previousEntry?.video ?? null}
            recommendationGroups={recommendationGroups}
            showRecommendations={recommendationsPreference.isEnabled}
            video={currentVideo}
            onDurationResolved={(video, seconds) =>
              libraryController.update((current) =>
                current.withDuration(video, formatTimestamp(seconds)),
              )
            }
            onFullscreenChange={setIsPlayerFullscreen}
            onNextVideo={openNextVideo}
            onOpenVideo={openVideo}
            onPreviousVideo={openPreviousVideo}
            onToggleRecommendations={recommendationsPreference.toggle}
          />
        ) : (
          <WatchUnavailable
            onHome={() => navigate(HOME_ROUTE)}
            onSettings={() => navigate({ view: "settings" })}
          />
        )}
      </WatchSheet>
    </main>
  );
}

function blurSearchField() {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && focused.closest(".search-wrap")) {
    focused.blur();
  }
}
