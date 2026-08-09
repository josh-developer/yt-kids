"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "./components/top-bar";
import { HomeView } from "./components/views/home-view";
import {
  LoadingVideoView,
  UnavailableVideoView,
} from "./components/views/status-views";
import { SettingsView } from "./components/views/settings-view";
import { WatchView } from "./components/views/watch-view";
import {
  CATALOG,
  DEFAULT_LIBRARY,
  LANGUAGE_STORAGE_KEY,
  LIBRARY_VERSION,
  RECOMMENDATIONS_STORAGE_KEY,
  STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "./lib/catalog";
import { COPY } from "./lib/copy";
import { readStoredLibrary, shuffleVideos } from "./lib/library";
import {
  isLikelyTvBrowser,
  preferredDeviceTheme,
  preferredLanguage,
} from "./lib/platform";
import {
  HOME_ROUTE,
  browserRouteFromLocation,
  pathForRoute,
  watchStackForRoute,
} from "./lib/routes";
import { encryptedTransferCode, libraryFromTransferCode } from "./lib/transfer";
import type {
  AppRoute,
  Language,
  StoredLibrary,
  Theme,
  Video,
  WatchStack,
} from "./lib/types";
import {
  extractYouTubeId,
  extractYouTubePlaylistId,
  fetchYouTubeMetadata,
  fetchYouTubePlaylist,
  formatTimestamp,
} from "./lib/youtube";
import { findWatchStackVideo, pushWatchStack } from "./lib/watch-stack";


export function KidsTubeApp({
  initialRoute = HOME_ROUTE,
}: {
  initialRoute?: AppRoute;
} = {}) {
  const [route, setRoute] = useState<AppRoute>(initialRoute);
  const [library, setLibrary] = useState<StoredLibrary>(DEFAULT_LIBRARY);
  const [homeQuery, setHomeQuery] = useState(() => {
    return initialRoute.view === "home" ? initialRoute.query : "";
  });
  const [libraryQuery, setLibraryQuery] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isTransferImportOpen, setIsTransferImportOpen] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [transferCode, setTransferCode] = useState("");
  const [exportTooltip, setExportTooltip] = useState("");
  const [transferStatus, setTransferStatus] = useState("");
  const [shuffleSalt, setShuffleSalt] = useState(8112);
  const [watchStack, setWatchStack] = useState<WatchStack>(() =>
    watchStackForRoute(initialRoute),
  );
  const [theme, setTheme] = useState<Theme>("light");
  const [language, setLanguage] = useState<Language>("en");
  const [hasLoadedStoredLibrary, setHasLoadedStoredLibrary] = useState(false);
  const [isTvBrowser, setIsTvBrowser] = useState(false);
  const [isTopbarHidden, setIsTopbarHidden] = useState(false);
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const didLoadStoredLibrary = useRef(false);
  const exportTooltipTimer = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  const view = route.view;
  const copy = COPY[language];

  const { customVideos, removedIds, selectedIds } = library;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedLibrary = readStoredLibrary();
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      const storedRecommendations = window.localStorage.getItem(
        RECOMMENDATIONS_STORAGE_KEY,
      );
      const currentRoute = browserRouteFromLocation(initialRoute);
      didLoadStoredLibrary.current = true;
      setLibrary(storedLibrary);
      setRoute(currentRoute);
      if (currentRoute.view === "watch") {
        setWatchStack((current) => pushWatchStack(current, currentRoute.videoId));
      }
      if (currentRoute.view === "home") {
        setHomeQuery(currentRoute.query);
      }
      if (storedTheme === "dark" || storedTheme === "light") {
        setTheme(storedTheme);
      } else {
        setTheme(preferredDeviceTheme());
      }
      if (storedLanguage === "en" || storedLanguage === "uz") {
        setLanguage(storedLanguage);
      } else {
        setLanguage(preferredLanguage());
      }
      if (storedRecommendations === "off") {
        setShowRecommendations(false);
      }
      setIsTvBrowser(isLikelyTvBrowser());
      setHasLoadedStoredLibrary(true);
      setShuffleSalt(Date.now() % 233280);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [initialRoute]);

  useEffect(() => {
    function handlePopState() {
      const nextRoute = browserRouteFromLocation(initialRoute);
      setRoute(nextRoute);
      if (nextRoute.view === "watch") {
        setWatchStack((current) => {
          const existingIndex = current.ids.lastIndexOf(nextRoute.videoId);
          return existingIndex >= 0
            ? { ...current, index: existingIndex }
            : pushWatchStack(current, nextRoute.videoId);
        });
      }
      if (nextRoute.view === "home") {
        setHomeQuery(nextRoute.query);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [initialRoute]);

  useEffect(() => {
    if (!didLoadStoredLibrary.current) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  }, [library]);

  useEffect(
    () => () => {
      if (exportTooltipTimer.current) {
        window.clearTimeout(exportTooltipTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY < 24) {
        setIsTopbarHidden(false);
      } else if (scrollDelta > 8) {
        setIsTopbarHidden(true);
      } else if (scrollDelta < -8) {
        setIsTopbarHidden(false);
      }

      lastScrollYRef.current = currentScrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const allVideos = useMemo(() => {
    const removedIdSet = new Set(removedIds);
    return [...CATALOG, ...customVideos].filter(
      (video) => !removedIdSet.has(video.id),
    );
  }, [customVideos, removedIds]);

  const selectedVideos = useMemo(
    () =>
      selectedIds
        .map((id) => allVideos.find((video) => video.id === id))
        .filter((video): video is Video => Boolean(video)),
    [allVideos, selectedIds],
  );
  const selectedVideoById = useMemo(
    () => new Map(selectedVideos.map((video) => [video.id, video] as const)),
    [selectedVideos],
  );

  const homeVideos = useMemo(() => {
    const query = homeQuery.trim().toLowerCase();
    const filtered = selectedVideos.filter((video) => {
      const searchable = `${video.title} ${video.channel}`;
      return searchable.toLowerCase().includes(query);
    });
    return shuffleVideos(filtered, shuffleSalt);
  }, [homeQuery, selectedVideos, shuffleSalt]);

  const currentVideo =
    route.view === "watch"
      ? selectedVideos.find((video) => video.id === route.videoId) ?? null
      : null;
  const previousStackEntry = currentVideo
    ? findWatchStackVideo(watchStack, currentVideo.id, -1, selectedVideoById)
    : null;
  const previousVideo = previousStackEntry?.video ?? null;

  const [recommendationSeed, setRecommendationSeed] = useState(() =>
    Math.floor(Math.random() * 233280),
  );

  useEffect(() => {
    if (currentVideo) {
      setRecommendationSeed(Math.floor(Math.random() * 233280));
    }
  }, [currentVideo?.id]);

  const recommendations = useMemo(() => {
    if (!currentVideo) {
      return [];
    }
    return shuffleVideos(
      selectedVideos.filter((video) => video.id !== currentVideo.id),
      recommendationSeed,
    );
  }, [currentVideo, selectedVideos, recommendationSeed]);

  const nextVideo = recommendations[0] ?? null;

  const libraryResults = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    if (!query) {
      return allVideos;
    }
    return allVideos.filter((video) =>
      `${video.title} ${video.channel}`.toLowerCase().includes(query),
    );
  }, [allVideos, libraryQuery]);

  useEffect(() => {
    if (view === "settings") {
      document.title = `${copy.parentSettings} | KidTube`;
      return;
    }

    if (view === "watch") {
      document.title = currentVideo
        ? `${currentVideo.title} | KidTube`
        : `${copy.videoUnavailable} | KidTube`;
      return;
    }

    const query = homeQuery.trim();
    document.title = query ? copy.searchPageTitle(query) : "KidTube";
  }, [copy, currentVideo, homeQuery, view]);

  function navigateTo(nextRoute: AppRoute, mode: "push" | "replace" = "push") {
    setRoute(nextRoute);
    if (nextRoute.view === "home") {
      setHomeQuery(nextRoute.query);
    }

    const nextPath = pathForRoute(nextRoute);
    if (
      window.location.pathname + window.location.search !== nextPath
    ) {
      window.history[mode === "replace" ? "replaceState" : "pushState"](
        null,
        "",
        nextPath,
      );
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openVideo(video: Video) {
    setWatchStack((current) => pushWatchStack(current, video.id));
    navigateTo({ view: "watch", videoId: video.id });
  }

  function openPreviousVideo() {
    if (!previousStackEntry) {
      return;
    }

    const { index, video } = previousStackEntry;
    setWatchStack((current) =>
      current.ids[index] === video.id
        ? { ...current, index }
        : { ...current, index: current.ids.lastIndexOf(video.id) },
    );
    navigateTo({ view: "watch", videoId: video.id });
  }

  function openNextVideo() {
    if (nextVideo) {
      openVideo(nextVideo);
    }
  }

  function submitHomeSearch() {
    const focusedElement = document.activeElement;
    if (
      focusedElement instanceof HTMLElement &&
      focusedElement.closest(".search-wrap")
    ) {
      focusedElement.blur();
    }
    navigateTo({ view: "home", query: homeQuery });
  }

  function approveVideo(video: Video) {
    setLibrary((current) =>
      current.selectedIds.includes(video.id)
        ? current
        : { ...current, selectedIds: [video.id, ...current.selectedIds] },
    );
  }

  function unapproveVideo(video: Video) {
    setLibrary((current) => ({
      ...current,
      selectedIds: current.selectedIds.filter((id) => id !== video.id),
    }));
  }

  function approveAllVideos() {
    setLibrary((current) => ({
      ...current,
      selectedIds: allVideos.map((video) => video.id),
    }));
  }

  function hideAllVideos() {
    setLibrary((current) => ({
      ...current,
      selectedIds: [],
    }));
  }

  function resetAllVideos() {
    setLibrary(DEFAULT_LIBRARY);
    setLibraryQuery("");
    setPasteUrl("");
    setPasteError("");
    setTransferCode("");
    setTransferStatus("");
    setIsImportOpen(false);
    setIsTransferImportOpen(false);
    setShuffleSalt(Date.now() % 233280);
  }

  function removeVideoCompletely(video: Video) {
    setLibrary((current) => {
      const selectedIds = current.selectedIds.filter((id) => id !== video.id);
      const customVideos =
        video.source === "custom"
          ? current.customVideos.filter((stored) => stored.id !== video.id)
          : current.customVideos;
      const removedIds =
        video.source === "catalog"
          ? Array.from(new Set([...current.removedIds, video.id]))
          : current.removedIds.filter((id) => id !== video.id);

      return {
        ...current,
        customVideos,
        removedIds,
        selectedIds,
      };
    });
  }

  function updateCustomVideoDuration(video: Video, seconds: number) {
    if (video.source !== "custom" || seconds <= 0) {
      return;
    }

    const duration = formatTimestamp(seconds);
    setLibrary((current) => {
      let didChange = false;
      const customVideos = current.customVideos.map((stored) => {
        if (stored.id !== video.id || stored.duration === duration) {
          return stored;
        }

        didChange = true;
        return { ...stored, duration };
      });

      return didChange ? { ...current, customVideos } : current;
    });
  }

  function selectVideoId(videoId: string) {
    setLibrary((current) =>
      current.selectedIds.includes(videoId)
        ? current
        : { ...current, selectedIds: [videoId, ...current.selectedIds] },
    );
  }

  async function addPastedVideo() {
    const playlistId = extractYouTubePlaylistId(pasteUrl);
    if (playlistId) {
      setPasteError(copy.checkingPlaylist);
      const playlist = await fetchYouTubePlaylist(pasteUrl);
      const playlistVideoIds = Array.from(
        new Set(
          (playlist.videoIds ?? []).filter((id) =>
            /^[a-zA-Z0-9_-]{11}$/.test(id),
          ),
        ),
      );

      if (playlistVideoIds.length === 0) {
        setPasteError(copy.playlistNoVideos);
        return;
      }

      const knownVideoIds = new Set(allVideos.map((video) => video.videoId));
      const newVideoIds = playlistVideoIds.filter(
        (videoId) => !knownVideoIds.has(videoId),
      );
      const importedVideos: Video[] = [];

      for (let index = 0; index < newVideoIds.length; index += 8) {
        const chunk = newVideoIds.slice(index, index + 8);
        setPasteError(
          `${copy.checkingVideoDetails} ${Math.min(
            index + chunk.length,
            newVideoIds.length,
          )}/${newVideoIds.length}`,
        );
        const videos = await Promise.all(
          chunk.map(async (videoId) => {
            const metadata = await fetchYouTubeMetadata(
              `https://www.youtube.com/watch?v=${videoId}`,
            );

            return {
              id: `custom-${videoId}`,
              videoId,
              title: metadata.title || copy.importedVideoTitle,
              channel: metadata.channel || copy.parentAdded,
              duration: metadata.duration || "--:--",
              views: copy.parentAdded,
              tags: ["custom"],
              accent: "#00a676",
              source: "custom",
            } satisfies Video;
          }),
        );
        importedVideos.push(...videos);
      }

      const playlistVideoIdSet = new Set(playlistVideoIds);
      setLibrary((current) => {
        const removedIdSet = new Set(current.removedIds);
        const currentVideos = [...CATALOG, ...current.customVideos].filter(
          (video) => !removedIdSet.has(video.id),
        );
        const currentCustomVideoIds = new Set(
          current.customVideos.map((video) => video.videoId),
        );
        const freshImportedVideos = importedVideos.filter(
          (video) => !currentCustomVideoIds.has(video.videoId),
        );
        const importedByVideoId = new Map(
          freshImportedVideos.map((video) => [video.videoId, video] as const),
        );
        const selectedFromPlaylist = playlistVideoIds
          .map(
            (videoId) =>
              currentVideos.find((video) => video.videoId === videoId)?.id ??
              importedByVideoId.get(videoId)?.id,
          )
          .filter((id): id is string => Boolean(id));

        return {
          version: LIBRARY_VERSION,
          customVideos: [...freshImportedVideos, ...current.customVideos],
          removedIds: current.removedIds,
          selectedIds: Array.from(
            new Set([
              ...selectedFromPlaylist.filter(
                (id) => !removedIdSet.has(id) && playlistVideoIdSet.size > 0,
              ),
              ...current.selectedIds,
            ]),
          ),
        };
      });

      setPasteError(copy.playlistAdded(playlistVideoIds.length));
      setPasteUrl("");
      setIsImportOpen(false);
      return;
    }

    const videoId = extractYouTubeId(pasteUrl);
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      setPasteError(copy.pasteYoutubeLinkError);
      return;
    }

    const existing = allVideos.find((video) => video.videoId === videoId);
    if (existing) {
      selectVideoId(existing.id);
      setPasteError("");
      setPasteUrl("");
      return;
    }

    setPasteError(copy.checkingVideoDetails);
    const metadata = await fetchYouTubeMetadata(
      `https://www.youtube.com/watch?v=${videoId}`,
    );

    const imported: Video = {
      id: `custom-${videoId}`,
      videoId,
      title: metadata.title || copy.importedVideoTitle,
      channel: metadata.channel || copy.parentAdded,
      duration: metadata.duration || "--:--",
      views: copy.parentAdded,
      tags: ["custom"],
      accent: "#00a676",
      source: "custom",
    };

    setLibrary((current) => ({
      version: LIBRARY_VERSION,
      customVideos: [imported, ...current.customVideos],
      removedIds: current.removedIds,
      selectedIds: [imported.id, ...current.selectedIds],
    }));
    setPasteError("");
    setPasteUrl("");
    setIsImportOpen(false);
  }

  async function exportLibrary() {
    setExportTooltip("copying");
    try {
      const code = await encryptedTransferCode(library);
      await window.navigator.clipboard.writeText(code);
      setExportTooltip("copied");
    } catch {
      setExportTooltip("failed");
    } finally {
      if (exportTooltipTimer.current) {
        window.clearTimeout(exportTooltipTimer.current);
      }
      exportTooltipTimer.current = window.setTimeout(() => {
        setExportTooltip("");
      }, 1000);
    }
  }

  async function importLibrary() {
    setTransferStatus(copy.readingImportCode);
    try {
      const imported = await libraryFromTransferCode(transferCode);
      setLibrary(imported);
      setShuffleSalt(Date.now() % 233280);
      setTransferCode("");
      setTransferStatus(copy.importComplete);
      setIsTransferImportOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const localizedMessage =
        message === "Paste a valid KidTube export code."
          ? copy.pasteImportCodeError
          : message === "Transfer code is too short."
            ? copy.transferCodeShort
            : message === "This browser cannot read compressed transfer codes."
              ? copy.transferReadUnsupported
              : message === "Unsupported transfer code version."
                ? copy.transferUnsupported
                : message === "Transfer code contains an invalid video."
                  ? copy.transferInvalidVideo
                  : copy.importFailed;
      setTransferStatus(localizedMessage);
    }
  }

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }

  function toggleLanguage() {
    setLanguage((current) => {
      const next = current === "en" ? "uz" : "en";
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      return next;
    });
  }

  function toggleRecommendations() {
    setShowRecommendations((current) => {
      const next = !current;
      window.localStorage.setItem(
        RECOMMENDATIONS_STORAGE_KEY,
        next ? "on" : "off",
      );
      return next;
    });
  }

  return (
    <main
      className={`app-shell theme-${theme} view-${view} ${
        isTvBrowser ? "tv-mode" : ""
      }`}
    >
      <TopBar
        copy={copy}
        homeQuery={homeQuery}
        isHidden={isTopbarHidden || isPlayerFullscreen}
        language={language}
        theme={theme}
        view={view}
        onHome={() => navigateTo(HOME_ROUTE)}
        onSearchSubmit={submitHomeSearch}
        onHomeQueryChange={setHomeQuery}
        onSettings={() => navigateTo({ view: "settings" })}
        onThemeToggle={toggleTheme}
        onLanguageToggle={toggleLanguage}
      />

      <div className="page-frame">
        <section className="content">
          {view === "settings" ? (
            <SettingsView
              approvedCount={selectedVideos.length}
              copy={copy}
              exportTooltip={exportTooltip}
              isImportOpen={isImportOpen}
              isTransferImportOpen={isTransferImportOpen}
              libraryQuery={libraryQuery}
              libraryResults={libraryResults}
              pasteError={pasteError}
              pasteUrl={pasteUrl}
              selectedIds={selectedIds}
              transferCode={transferCode}
              transferStatus={transferStatus}
              onAddPastedVideo={addPastedVideo}
              onApproveAll={approveAllVideos}
              onExportLibrary={exportLibrary}
              onHideAll={hideAllVideos}
              onImportLibrary={importLibrary}
              onOpenImport={() => setIsImportOpen((open) => !open)}
              onOpenTransferImport={() =>
                setIsTransferImportOpen((open) => !open)
              }
              onPasteUrlChange={setPasteUrl}
              onQueryChange={setLibraryQuery}
              onApprove={approveVideo}
              onRemoveCompletely={removeVideoCompletely}
              onResetAllVideos={resetAllVideos}
              onTransferCodeChange={setTransferCode}
              onUnapprove={unapproveVideo}
            />
          ) : view === "watch" && !hasLoadedStoredLibrary ? (
            <LoadingVideoView copy={copy} />
          ) : view === "watch" && currentVideo ? (
            <WatchView
              copy={copy}
              isTvBrowser={isTvBrowser}
              nextVideo={nextVideo}
              previousVideo={previousVideo}
              recommendations={recommendations}
              showRecommendations={showRecommendations}
              video={currentVideo}
              onDurationResolved={updateCustomVideoDuration}
              onFullscreenChange={setIsPlayerFullscreen}
              onNextVideo={openNextVideo}
              onOpenVideo={openVideo}
              onPreviousVideo={openPreviousVideo}
              onToggleRecommendations={toggleRecommendations}
            />
          ) : view === "watch" ? (
            <UnavailableVideoView
              copy={copy}
              onHome={() => navigateTo(HOME_ROUTE)}
              onSettings={() => navigateTo({ view: "settings" })}
            />
          ) : (
            <HomeView
              copy={copy}
              videos={homeVideos}
              onOpenVideo={openVideo}
              onSettings={() => navigateTo({ view: "settings" })}
            />
          )}
        </section>
      </div>
    </main>
  );
}
