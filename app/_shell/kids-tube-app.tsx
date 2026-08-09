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
import { useTheme } from "@/features/theme-toggle";
import { HomePage } from "@/pages/home";
import { SettingsPage } from "@/pages/settings";
import { WatchLoading, WatchPage, WatchUnavailable } from "@/pages/watch";
import { TopBar, useTopbarAutoHide } from "@/widgets/top-bar";

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
  const isTopbarHidden = useTopbarAutoHide();

  const [homeQuery, setHomeQuery] = useState(
    initialRoute.view === "home" ? initialRoute.query : "",
  );
  const [shuffleSalt, setShuffleSalt] = useState(8112);
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

  const currentVideo =
    route.view === "watch" ? library.find(route.videoId) : null;
  const lookup = useMemo(
    () => (id: string) => library.find(id),
    [library],
  );
  const previousEntry = currentVideo
    ? watchStack.previous(currentVideo.id, lookup)
    : null;
  const recommendations = currentVideo
    ? library.recommendationsFor(currentVideo, shuffleSalt)
    : [];
  const nextVideo = recommendations[0] ?? null;
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

  return (
    <main
      className={`app-shell theme-${theme} view-${route.view} ${
        isTvBrowser ? "tv-mode" : ""
      }`}
    >
      <TopBar
        homeQuery={homeQuery}
        isHidden={isTopbarHidden || isPlayerFullscreen}
        nextLocale={nextLocale}
        theme={theme}
        view={route.view}
        onHome={() => navigate(HOME_ROUTE)}
        onHomeQueryChange={setHomeQuery}
        onLocaleSwitch={switchLocale}
        onSearchSubmit={() => {
          blurSearchField();
          navigate({ view: "home", query: homeQuery });
        }}
        onSettings={() => navigate({ view: "settings" })}
        onShuffle={() => setShuffleSalt(randomSalt())}
        onThemeToggle={toggleTheme}
      />

      <div className="page-frame">
        <section className="content">
          {route.view === "settings" ? (
            <SettingsPage libraryController={libraryController} />
          ) : route.view === "watch" && !isLoaded ? (
            <WatchLoading />
          ) : route.view === "watch" && currentVideo ? (
            <WatchPage
              isTvBrowser={isTvBrowser}
              nextVideo={nextVideo}
              previousVideo={previousEntry?.video ?? null}
              recommendations={recommendations}
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
            />
          ) : route.view === "watch" ? (
            <WatchUnavailable
              onHome={() => navigate(HOME_ROUTE)}
              onSettings={() => navigate({ view: "settings" })}
            />
          ) : (
            <HomePage
              videos={homeVideos}
              onOpenVideo={openVideo}
              onSettings={() => navigate({ view: "settings" })}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function blurSearchField() {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && focused.closest(".search-wrap")) {
    focused.blur();
  }
}
