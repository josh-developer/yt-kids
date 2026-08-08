"use client";

import {
  Check,
  Copy,
  Download,
  EyeOff,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  Play,
  Plus,
  Repeat1,
  RotateCcw,
  Search,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sun,
  Trash2,
  Upload,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CURATED_UZBEK_OLD_CARTOONS } from "./curated-videos";

type Theme = "dark" | "light";
type AppRoute =
  | { view: "home"; query: string }
  | { view: "settings" }
  | { view: "watch"; videoId: string };

type Video = {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  views: string;
  tags: string[];
  accent: string;
  source: "catalog" | "custom";
};

type StoredLibrary = {
  version: number;
  selectedIds: string[];
  customVideos: Video[];
  removedIds: string[];
};

type YouTubeMetadata = {
  title?: string;
  channel?: string;
  duration?: string;
};

const STORAGE_KEY = "kidtube-library-v1";
const THEME_STORAGE_KEY = "kidtube-theme-v1";
const TRANSFER_PREFIX = "KIDTUBE1";
const TRANSFER_SECRET = "kidtube-parent-library-transfer-v1";
const LIBRARY_VERSION = 6;
const CATALOG: Video[] = CURATED_UZBEK_OLD_CARTOONS;
const CATALOG_NUMBER_BY_ID = new Map(
  CATALOG.map((video) => [
    video.id,
    Number(video.id.replace("uzbek-old-", "")),
  ] as const),
);
const CATALOG_ID_BY_NUMBER = new Map(
  CATALOG.map((video) => [
    Number(video.id.replace("uzbek-old-", "")),
    video.id,
  ] as const),
);
const DEFAULT_SELECTED_IDS = CATALOG.map((video) => video.id);
const DEFAULT_LIBRARY: StoredLibrary = {
  version: LIBRARY_VERSION,
  selectedIds: DEFAULT_SELECTED_IDS,
  customVideos: [],
  removedIds: [],
};

const HOME_ROUTE: AppRoute = { view: "home", query: "" };

function decodeRouteSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function browserRouteFromLocation(fallback: AppRoute = HOME_ROUTE): AppRoute {
  if (typeof window === "undefined") {
    return fallback;
  }

  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(window.location.search);

  if (pathname === "/settings") {
    return { view: "settings" };
  }

  const watchMatch = pathname.match(/^\/watch\/([^/]+)$/);
  if (watchMatch) {
    return { view: "watch", videoId: decodeRouteSegment(watchMatch[1]) };
  }

  return { view: "home", query: params.get("q") ?? "" };
}

function pathForRoute(route: AppRoute) {
  if (route.view === "settings") {
    return "/settings";
  }

  if (route.view === "watch") {
    return `/watch/${encodeURIComponent(route.videoId)}`;
  }

  const query = route.query.trim();
  if (!query) {
    return "/";
  }

  const params = new URLSearchParams({ q: query });
  return `/?${params.toString()}`;
}

function isLikelyTvBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /appletv|aquos|aftb|aftm|afts|aftt|bravia|crkey|dtv|googletv|hbbtv|netcast|roku|smart-tv|smarttv|tizen|tv safari|viera|web0s|webos/i.test(
    navigator.userAgent,
  );
}

function thumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function lockedEmbedUrl(videoId: string, shouldAutoplay = false) {
  const params = new URLSearchParams({
    autoplay: shouldAutoplay ? "1" : "0",
    controls: "0",
    disablekb: "1",
    enablejsapi: "1",
    fs: "0",
    iv_load_policy: "3",
    modestbranding: "1",
    playsinline: "1",
    rel: "0",
  });

  if (typeof window !== "undefined") {
    params.set("origin", window.location.origin);
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function durationToSeconds(duration: string) {
  if (duration === "--:--") {
    return 0;
  }

  const parts = duration.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return 0;
  }

  return parts.reduce((total, part) => total * 60 + part, 0);
}

function formatTimestamp(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function extractYouTubeId(input: string) {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (url.searchParams.get("v")) {
      return url.searchParams.get("v");
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) =>
      ["embed", "shorts", "live"].includes(part),
    );
    return marker >= 0 ? parts[marker + 1] ?? null : null;
  } catch {
    return null;
  }
}

function normalizeStoredLibrary(library: StoredLibrary): StoredLibrary {
  const customVideos = Array.isArray(library.customVideos)
    ? library.customVideos
    : [];
  const customVideoIds = new Set(customVideos.map((video) => video.id));
  const validIds = new Set([
    ...CATALOG.map((video) => video.id),
    ...customVideoIds,
  ]);
  const removedIds = Array.isArray(library.removedIds)
    ? library.removedIds.filter((id) => validIds.has(id))
    : [];
  const removedIdSet = new Set(removedIds);
  const storedSelectedIds = Array.isArray(library.selectedIds)
    ? library.selectedIds.filter((id) => validIds.has(id) && !removedIdSet.has(id))
    : DEFAULT_SELECTED_IDS;

  if (library.version !== LIBRARY_VERSION) {
    const selectedCustomIds = storedSelectedIds.filter((id) =>
      customVideoIds.has(id),
    );
    const migratedSelectedIds =
      library.version >= 2 && library.version <= 5
        ? Array.from(new Set([...DEFAULT_SELECTED_IDS, ...storedSelectedIds]))
        : [...DEFAULT_SELECTED_IDS, ...selectedCustomIds];

    return {
      version: LIBRARY_VERSION,
      customVideos,
      removedIds,
      selectedIds: migratedSelectedIds.filter(
        (id) => !removedIdSet.has(id),
      ),
    };
  }

  return {
    version: LIBRARY_VERSION,
    customVideos,
    removedIds,
    selectedIds: storedSelectedIds,
  };
}

async function fetchYouTubeMetadata(url: string): Promise<YouTubeMetadata> {
  try {
    const response = await fetch(
      `/api/youtube/oembed?url=${encodeURIComponent(url)}`,
    );

    if (!response.ok) {
      return {};
    }

    return (await response.json()) as YouTubeMetadata;
  } catch {
    return {};
  }
}

function shuffleVideos(videos: Video[], salt: number) {
  const shuffled = [...videos];
  let seed = salt || 17;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const pick = Math.floor((seed / 233280) * (index + 1));
    [shuffled[index], shuffled[pick]] = [shuffled[pick], shuffled[index]];
  }
  return shuffled;
}

function readStoredLibrary(): StoredLibrary {
  if (typeof window === "undefined") {
    return DEFAULT_LIBRARY;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_LIBRARY;
  }

  try {
    const parsed = JSON.parse(raw) as StoredLibrary;
    return normalizeStoredLibrary(parsed);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return DEFAULT_LIBRARY;
  }
}

type CompactVideoRef = number | string;

type TransferVideo = {
  y: string;
  t: string;
  c: string;
  d: string;
  w: string;
  g: string[];
  a: string;
};

type TransferLibrary = {
  v: 1;
  s: CompactVideoRef[];
  r: CompactVideoRef[];
  c: TransferVideo[];
};

function textToBytes(text: string) {
  return new TextEncoder().encode(text);
}

function bytesToText(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return window
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function transferKey() {
  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    textToBytes(TRANSFER_SECRET),
  );
  return window.crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function compressTransferBytes(bytes: Uint8Array) {
  if (!("CompressionStream" in window)) {
    return { mode: "J", bytes };
  }

  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  const compressed = new Uint8Array(await new Response(stream.readable).arrayBuffer());
  return { mode: "G", bytes: compressed };
}

async function decompressTransferBytes(mode: string, bytes: Uint8Array) {
  if (mode !== "G") {
    return bytes;
  }

  if (!("DecompressionStream" in window)) {
    throw new Error("This browser cannot read compressed transfer codes.");
  }

  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

function compactVideoRef(id: string): CompactVideoRef {
  return CATALOG_NUMBER_BY_ID.get(id) ?? id;
}

function expandVideoRef(ref: CompactVideoRef) {
  if (typeof ref === "number") {
    return CATALOG_ID_BY_NUMBER.get(ref) ?? null;
  }
  return ref;
}

function compactTransferLibrary(library: StoredLibrary): TransferLibrary {
  return {
    v: 1,
    s: library.selectedIds.map(compactVideoRef),
    r: library.removedIds.map(compactVideoRef),
    c: library.customVideos.map((video) => ({
      y: video.videoId,
      t: video.title,
      c: video.channel,
      d: video.duration,
      w: video.views,
      g: video.tags,
      a: video.accent,
    })),
  };
}

function expandTransferLibrary(transfer: TransferLibrary): StoredLibrary {
  if (transfer.v !== 1) {
    throw new Error("Unsupported transfer code version.");
  }

  const customVideos = transfer.c.map((video) => {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(video.y)) {
      throw new Error("Transfer code contains an invalid video.");
    }

    return {
      id: `custom-${video.y}`,
      videoId: video.y,
      title: video.t || "Imported YouTube video",
      channel: video.c || "Parent added",
      duration: video.d || "--:--",
      views: video.w || "Added by parent",
      tags: Array.isArray(video.g) && video.g.length > 0 ? video.g : ["custom"],
      accent: video.a || "#00a676",
      source: "custom" as const,
    };
  });

  return normalizeStoredLibrary({
    version: LIBRARY_VERSION,
    customVideos,
    removedIds: transfer.r.map(expandVideoRef).filter((id): id is string =>
      Boolean(id),
    ),
    selectedIds: transfer.s.map(expandVideoRef).filter((id): id is string =>
      Boolean(id),
    ),
  });
}

async function encryptedTransferCode(library: StoredLibrary) {
  const { mode, bytes } = await compressTransferBytes(
    textToBytes(JSON.stringify(compactTransferLibrary(library))),
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await transferKey(),
      bytes,
    ),
  );
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv);
  packed.set(encrypted, iv.length);
  return `${TRANSFER_PREFIX}${mode}.${base64UrlEncode(packed)}`;
}

async function libraryFromTransferCode(code: string) {
  const match = code.trim().match(/^KIDTUBE1([GJ])\.([a-zA-Z0-9_-]+)$/);
  if (!match) {
    throw new Error("Paste a valid KidTube export code.");
  }

  const packed = base64UrlDecode(match[2]);
  if (packed.length <= 28) {
    throw new Error("Transfer code is too short.");
  }

  const iv = packed.slice(0, 12);
  const encrypted = packed.slice(12);
  const decrypted = new Uint8Array(
    await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await transferKey(),
      encrypted,
    ),
  );
  const jsonBytes = await decompressTransferBytes(match[1], decrypted);
  return expandTransferLibrary(JSON.parse(bytesToText(jsonBytes)) as TransferLibrary);
}

export function KidsTubeApp({
  initialRoute = HOME_ROUTE,
}: {
  initialRoute?: AppRoute;
} = {}) {
  const [route, setRoute] = useState<AppRoute>(() =>
    browserRouteFromLocation(initialRoute),
  );
  const [library, setLibrary] = useState<StoredLibrary>(DEFAULT_LIBRARY);
  const [homeQuery, setHomeQuery] = useState(() => {
    const startingRoute = browserRouteFromLocation(initialRoute);
    return startingRoute.view === "home" ? startingRoute.query : "";
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
  const [theme, setTheme] = useState<Theme>("light");
  const [hasLoadedStoredLibrary, setHasLoadedStoredLibrary] = useState(false);
  const [isTvBrowser, setIsTvBrowser] = useState(false);
  const didLoadStoredLibrary = useRef(false);
  const exportTooltipTimer = useRef<number | null>(null);
  const view = route.view;

  const { customVideos, removedIds, selectedIds } = library;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedLibrary = readStoredLibrary();
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      const currentRoute = browserRouteFromLocation(initialRoute);
      didLoadStoredLibrary.current = true;
      setLibrary(storedLibrary);
      setRoute(currentRoute);
      if (currentRoute.view === "home") {
        setHomeQuery(currentRoute.query);
      }
      if (storedTheme === "dark" || storedTheme === "light") {
        setTheme(storedTheme);
      }
      setIsTvBrowser(isLikelyTvBrowser());
      setHasLoadedStoredLibrary(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [initialRoute]);

  useEffect(() => {
    function handlePopState() {
      const nextRoute = browserRouteFromLocation(initialRoute);
      setRoute(nextRoute);
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
  const currentVideoIndex = currentVideo
    ? selectedVideos.findIndex((video) => video.id === currentVideo.id)
    : -1;
  const previousVideo =
    selectedVideos.length > 1 && currentVideoIndex >= 0
      ? selectedVideos[
          (currentVideoIndex - 1 + selectedVideos.length) % selectedVideos.length
        ]
      : null;
  const nextVideo =
    selectedVideos.length > 1 && currentVideoIndex >= 0
      ? selectedVideos[(currentVideoIndex + 1) % selectedVideos.length]
      : null;

  const recommendations = useMemo(() => {
    if (!currentVideo) {
      return [];
    }
    return shuffleVideos(
      selectedVideos.filter((video) => video.id !== currentVideo.id),
      shuffleSalt + currentVideo.id.length,
    );
  }, [currentVideo, selectedVideos, shuffleSalt]);

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
      document.title = "Parent settings | KidTube";
      return;
    }

    if (view === "watch") {
      document.title = currentVideo
        ? `${currentVideo.title} | KidTube`
        : "Video unavailable | KidTube";
      return;
    }

    const query = homeQuery.trim();
    document.title = query ? `${query} - Search | KidTube` : "KidTube";
  }, [currentVideo, homeQuery, view]);

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
    navigateTo({ view: "watch", videoId: video.id });
  }

  function submitHomeSearch() {
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

  function selectVideoId(videoId: string) {
    setLibrary((current) =>
      current.selectedIds.includes(videoId)
        ? current
        : { ...current, selectedIds: [videoId, ...current.selectedIds] },
    );
  }

  async function addPastedVideo() {
    const videoId = extractYouTubeId(pasteUrl);
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      setPasteError("Paste a valid YouTube link or video ID.");
      return;
    }

    const existing = allVideos.find((video) => video.videoId === videoId);
    if (existing) {
      selectVideoId(existing.id);
      setPasteError("");
      setPasteUrl("");
      return;
    }

    setPasteError("Checking video details...");
    const metadata = await fetchYouTubeMetadata(
      `https://www.youtube.com/watch?v=${videoId}`,
    );

    const imported: Video = {
      id: `custom-${videoId}`,
      videoId,
      title: metadata.title || "Imported YouTube video",
      channel: metadata.channel || "Parent added",
      duration: metadata.duration || "--:--",
      views: "Added by parent",
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
    setExportTooltip("Copying...");
    try {
      const code = await encryptedTransferCode(library);
      await window.navigator.clipboard.writeText(code);
      setExportTooltip("Export copied");
    } catch {
      setExportTooltip("Copy failed");
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
    setTransferStatus("Reading import code...");
    try {
      const imported = await libraryFromTransferCode(transferCode);
      setLibrary(imported);
      setShuffleSalt(Date.now() % 233280);
      setTransferCode("");
      setTransferStatus("Import complete.");
      setIsTransferImportOpen(false);
    } catch (error) {
      setTransferStatus(
        error instanceof Error ? error.message : "Could not import this code.",
      );
    }
  }

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }

  return (
    <main className={`app-shell theme-${theme} ${isTvBrowser ? "tv-mode" : ""}`}>
      <header className="topbar">
        <button
          className="brand"
          type="button"
          onClick={() => navigateTo(HOME_ROUTE)}
          aria-label="Go home"
          data-tooltip="Home"
        >
          <span className="brand-mark">
            <Play size={18} fill="currentColor" />
          </span>
          <span className="brand-name">KidTube</span>
          <span className="brand-tag">Parent picked</span>
        </button>

        <div className="top-search-slot">
          <form
            className="search-wrap"
            onSubmit={(event) => {
              event.preventDefault();
              submitHomeSearch();
            }}
          >
            <input
              value={homeQuery}
              onChange={(event) => setHomeQuery(event.target.value)}
              placeholder="Search approved videos"
              aria-label="Search approved videos"
            />
            <button
              className="search-button"
              type="submit"
              aria-label="Search"
              data-tooltip="Search"
            >
              <Search size={20} />
            </button>
          </form>
        </div>

        <div className="top-actions">
          <button
            className="icon-button"
            type="button"
            onClick={() => setShuffleSalt(Date.now() % 233280)}
            aria-label="Shuffle home"
            data-tooltip="Shuffle home"
          >
            <RotateCcw size={19} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"}
            data-tooltip={theme === "dark" ? "Use light mode" : "Use dark mode"}
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className={`icon-button ${view === "settings" ? "active" : ""}`}
            type="button"
            onClick={() => navigateTo({ view: "settings" })}
            aria-label="Parent settings"
            data-tooltip="Parent settings"
          >
            <Plus size={19} />
          </button>
        </div>
      </header>

      <div className="page-frame">
        <section className="content">
          {view === "settings" ? (
            <SettingsView
              approvedCount={selectedVideos.length}
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
              onTransferCodeChange={setTransferCode}
              onUnapprove={unapproveVideo}
            />
          ) : view === "watch" && !hasLoadedStoredLibrary ? (
            <LoadingVideoView />
          ) : view === "watch" && currentVideo ? (
            <WatchView
              isTvBrowser={isTvBrowser}
              nextVideo={nextVideo}
              previousVideo={previousVideo}
              recommendations={recommendations}
              video={currentVideo}
              onOpenVideo={openVideo}
            />
          ) : view === "watch" ? (
            <UnavailableVideoView
              onHome={() => navigateTo(HOME_ROUTE)}
              onSettings={() => navigateTo({ view: "settings" })}
            />
          ) : (
            <HomeView
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

function HomeView({
  videos,
  onOpenVideo,
  onSettings,
}: {
  videos: Video[];
  onOpenVideo: (video: Video) => void;
  onSettings: () => void;
}) {
  if (videos.length === 0) {
    return (
      <div className="empty-state">
        <div>
          <h2>No approved videos yet</h2>
          <p className="muted">Add videos from Parent settings.</p>
          <button
            className="primary-button"
            type="button"
            onClick={onSettings}
            data-tooltip="Open settings"
          >
            <Plus size={18} />
            Open settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-grid">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} onOpen={onOpenVideo} />
      ))}
    </div>
  );
}

function LoadingVideoView() {
  return (
    <div className="empty-state">
      <div>
        <h2>Loading video</h2>
        <p className="muted">Checking the parent-approved library.</p>
      </div>
    </div>
  );
}

function UnavailableVideoView({
  onHome,
  onSettings,
}: {
  onHome: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="empty-state">
      <div>
        <h2>Video is not approved</h2>
        <p className="muted">This video is hidden, removed, or not in this library.</p>
        <div className="empty-actions">
          <button
            className="primary-button"
            type="button"
            onClick={onHome}
            data-tooltip="Go home"
          >
            Home
          </button>
          <button
            className="pill-button"
            type="button"
            onClick={onSettings}
            data-tooltip="Open settings"
          >
            <Plus size={18} />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoCard({
  video,
  onOpen,
}: {
  video: Video;
  onOpen: (video: Video) => void;
}) {
  return (
    <button
      className="video-card"
      type="button"
      onClick={() => onOpen(video)}
      data-tooltip="Play video"
    >
      <Thumbnail video={video} />
      <div className="video-meta">
        <span className="avatar" style={{ "--avatar": video.accent }}>
          {video.channel.slice(0, 1)}
        </span>
        <span>
          <span className="video-title">{video.title}</span>
          <span className="video-subline">{video.channel}</span>
          <span className="video-subline">{video.views}</span>
        </span>
      </div>
    </button>
  );
}

function WatchView({
  isTvBrowser,
  nextVideo,
  previousVideo,
  recommendations,
  video,
  onOpenVideo,
}: {
  isTvBrowser: boolean;
  nextVideo: Video | null;
  previousVideo: Video | null;
  recommendations: Video[];
  video: Video;
  onOpenVideo: (video: Video) => void;
}) {
  return (
    <div className="watch-layout">
      <article>
        <SafeYouTubePlayer
          isTvBrowser={isTvBrowser}
          nextVideo={nextVideo}
          previousVideo={previousVideo}
          video={video}
          onOpenVideo={onOpenVideo}
        />
        <h1 className="watch-title">{video.title}</h1>
        <div className="watch-bar">
          <div className="channel-line">
            <span className="avatar" style={{ "--avatar": video.accent }}>
              {video.channel.slice(0, 1)}
            </span>
            <div>
              <strong>{video.channel}</strong>
              <div className="muted">{video.views}</div>
            </div>
          </div>
          <button
            className="pill-button"
            type="button"
            data-tooltip="Approved video"
          >
            <ShieldCheck size={18} />
            Approved
          </button>
        </div>
      </article>

      <aside className="recommendations" aria-label="Recommended videos">
        {recommendations.map((item) => (
          <button
            className="recommendation-card"
            key={item.id}
            type="button"
            onClick={() => onOpenVideo(item)}
            data-tooltip="Play recommended video"
          >
            <Thumbnail video={item} />
            <span>
              <span className="video-title">{item.title}</span>
              <span className="video-subline">{item.channel}</span>
              <span className="video-subline">{item.views}</span>
            </span>
          </button>
        ))}
      </aside>
    </div>
  );
}

function SafeYouTubePlayer({
  isTvBrowser,
  nextVideo,
  previousVideo,
  video,
  onOpenVideo,
}: {
  isTvBrowser: boolean;
  nextVideo: Video | null;
  previousVideo: Video | null;
  video: Video;
  onOpenVideo: (video: Video) => void;
}) {
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRepeatOne, setIsRepeatOne] = useState(false);
  const [playerReloadKey, setPlayerReloadKey] = useState(0);
  const [shouldAutoplay, setShouldAutoplay] = useState(true);
  const [volume, setVolumeState] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(() =>
    durationToSeconds(video.duration),
  );
  const playTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const progressTimerRef = useRef<ReturnType<typeof window.setInterval> | null>(
    null,
  );
  const currentTimeRef = useRef(0);
  const durationRef = useRef(durationToSeconds(video.duration));
  const handleVideoEndedRef = useRef<() => void>(() => {});
  const isRestartingRepeatRef = useRef(false);
  const repeatOneRef = useRef(false);
  const nextVideoRef = useRef(nextVideo);
  const onOpenVideoRef = useRef(onOpenVideo);

  useEffect(() => {
    if (!isTvBrowser) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      playerBoxRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isTvBrowser]);

  useEffect(() => {
    handleVideoEndedRef.current = () => {
      if (repeatOneRef.current) {
        if (isRestartingRepeatRef.current) {
          return;
        }

        isRestartingRepeatRef.current = true;
        currentTimeRef.current = 0;
        setCurrentTime(0);
        setShouldAutoplay(true);
        setIsPlaying(true);
        setControlsVisible(true);
        setPlayerReloadKey((key) => key + 1);
        scheduleControlsHide();
        return;
      }

      if (nextVideoRef.current) {
        onOpenVideoRef.current(nextVideoRef.current);
      }
    };
  });

  useEffect(() => {
    repeatOneRef.current = isRepeatOne;
  }, [isRepeatOne]);

  useEffect(() => {
    const nextDuration = durationToSeconds(video.duration);
    currentTimeRef.current = 0;
    durationRef.current = nextDuration;
    isRestartingRepeatRef.current = false;
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }

    const frame = window.requestAnimationFrame(() => {
      setCurrentTime(0);
      setDurationSeconds(nextDuration);
      setShouldAutoplay(true);
      setIsPlaying(true);
      setControlsVisible(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [video.duration, video.id]);

  useEffect(() => {
    nextVideoRef.current = nextVideo;
    onOpenVideoRef.current = onOpenVideo;
  }, [nextVideo, onOpenVideo]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.includes("youtube.com")) {
        return;
      }

      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      let payload: {
        event?: string;
        info?:
          | number
          | {
              currentTime?: number;
              duration?: number;
              playerState?: number;
            };
      };
      try {
        payload =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (payload.event !== "infoDelivery" && payload.event !== "onStateChange") {
        return;
      }

      const info = payload.info;
      if (typeof info === "object" && typeof info.currentTime === "number") {
        currentTimeRef.current = info.currentTime;
        setCurrentTime(info.currentTime);
      }

      if (typeof info === "object" && typeof info.duration === "number" && info.duration > 0) {
        durationRef.current = info.duration;
        setDurationSeconds(info.duration);
      }

      const playerState =
        typeof info === "number"
          ? info
          : typeof info === "object"
            ? info.playerState
            : undefined;
      if (typeof playerState !== "number") {
        return;
      }

      if (playerState === 0) {
        handleVideoEndedRef.current();
        return;
      }

      if (playerState === 1) {
        setIsPlaying(true);
        setControlsVisible(true);
        scheduleControlsHide();
      } else {
        setIsPlaying(false);
        setControlsVisible(true);
        if (controlsTimerRef.current) {
          window.clearTimeout(controlsTimerRef.current);
        }
      }

    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    return () => {
      if (playTimerRef.current) {
        window.clearTimeout(playTimerRef.current);
      }
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    durationRef.current = durationSeconds;
  }, [durationSeconds]);

  useEffect(() => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (!isPlaying) {
      return;
    }

    progressTimerRef.current = window.setInterval(() => {
      sendPlayerCommand("getCurrentTime");
      sendPlayerCommand("getDuration");
      currentTimeRef.current = Math.min(
        durationRef.current || Number.MAX_SAFE_INTEGER,
        currentTimeRef.current + 0.75,
      );
      setCurrentTime(currentTimeRef.current);
      if (
        durationRef.current > 0 &&
        currentTimeRef.current >= durationRef.current - 0.25
      ) {
        handleVideoEndedRef.current();
      }
    }, 750);

    return () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === playerBoxRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function scheduleControlsHide() {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }

    controlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }

  function revealControls() {
    setControlsVisible(true);
    if (isPlaying) {
      scheduleControlsHide();
    }
  }

  function sendPlayerCommand(
    func: string,
    args: Array<boolean | number | string> = [],
  ) {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  }

  function schedulePlayCommand() {
    if (playTimerRef.current) {
      window.clearTimeout(playTimerRef.current);
    }

    playTimerRef.current = window.setTimeout(() => {
      sendPlayerCommand("setVolume", [volume]);
      if (isMuted || volume === 0) {
        sendPlayerCommand("mute");
      } else {
        sendPlayerCommand("unMute");
      }
      sendPlayerCommand("playVideo");
    }, 350);
  }

  function playPause() {
    revealControls();
    if (isPlaying) {
      sendPlayerCommand("pauseVideo");
      setIsPlaying(false);
      setControlsVisible(true);
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
    } else {
      setShouldAutoplay(true);
      setIsPlaying(true);
      schedulePlayCommand();
      scheduleControlsHide();
    }
  }

  function toggleMute() {
    revealControls();
    sendPlayerCommand(isMuted ? "unMute" : "mute");
    setIsMuted((muted) => !muted);
  }

  function setVolume(nextVolume: number) {
    revealControls();
    const clampedVolume = Math.max(0, Math.min(100, nextVolume));
    setVolumeState(clampedVolume);
    sendPlayerCommand("setVolume", [clampedVolume]);
    if (clampedVolume === 0) {
      sendPlayerCommand("mute");
      setIsMuted(true);
    } else {
      sendPlayerCommand("unMute");
      setIsMuted(false);
    }
  }

  function seekRelative(seconds: number) {
    revealControls();
    const duration = durationRef.current;
    const upperBound = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    const targetTime = Math.max(
      0,
      Math.min(upperBound, currentTimeRef.current + seconds),
    );
    currentTimeRef.current = targetTime;
    setCurrentTime(targetTime);
    sendPlayerCommand("seekTo", [targetTime, true]);
  }

  function seekFromProgress(event: MouseEvent<HTMLButtonElement>) {
    revealControls();
    if (durationRef.current <= 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width),
    );
    const targetTime = durationRef.current * ratio;
    currentTimeRef.current = targetTime;
    setCurrentTime(targetTime);
    sendPlayerCommand("seekTo", [targetTime, true]);
  }

  function seekFromDoubleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button, input")) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftSide = event.clientX - rect.left < rect.width / 2;
    seekRelative(isLeftSide ? -15 : 15);
  }

  function handlePlayerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isTvBrowser) {
      return;
    }

    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target !== event.currentTarget &&
      target.closest("button, input, textarea")
    ) {
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "MediaRewind") {
      event.preventDefault();
      seekRelative(-15);
      return;
    }

    if (event.key === "ArrowRight" || event.key === "MediaFastForward") {
      event.preventDefault();
      seekRelative(15);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setVolume(volume + 10);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setVolume(volume - 10);
      return;
    }

    if (
      event.key === " " ||
      event.key === "Enter" ||
      event.key === "MediaPlayPause" ||
      event.key === "Play" ||
      event.key === "Pause"
    ) {
      event.preventDefault();
      playPause();
    }
  }

  async function toggleFullscreen() {
    revealControls();
    if (!playerBoxRef.current) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await playerBoxRef.current.requestFullscreen();
    }
  }

  function toggleRepeatOne() {
    revealControls();
    setIsRepeatOne((current) => !current);
  }

  return (
    <div
      className={`player-box ${controlsVisible ? "" : "controls-hidden"}`}
      onClick={revealControls}
      onDoubleClick={seekFromDoubleClick}
      onKeyDown={handlePlayerKeyDown}
      onPointerMove={revealControls}
      role={isTvBrowser ? "region" : undefined}
      onSelect={(event) => event.preventDefault()}
      onSelectCapture={(event) => event.preventDefault()}
      onTouchStart={revealControls}
      tabIndex={isTvBrowser ? 0 : undefined}
      aria-label={
        isTvBrowser
          ? "Video player. Use left and right to seek, up and down for volume, and enter to play or pause."
          : undefined
      }
      ref={playerBoxRef}
    >
      <iframe
        key={`${video.id}-${playerReloadKey}`}
        aria-hidden="true"
        allow="autoplay; encrypted-media; picture-in-picture"
        className="youtube-mount"
        onLoad={() => {
          isRestartingRepeatRef.current = false;
          sendPlayerCommand("setVolume", [volume]);
          if (shouldAutoplay) {
            schedulePlayCommand();
          }
        }}
        ref={iframeRef}
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        src={lockedEmbedUrl(video.videoId, shouldAutoplay)}
        tabIndex={-1}
        title={`${video.title} video surface`}
        onContextMenu={(event) => event.preventDefault()}
      />
      <div
        className={`youtube-title-cover ${controlsVisible ? "" : "hidden"}`}
        aria-hidden="true"
      />
      <div className="seek-zones" aria-hidden="true">
        <span>-15</span>
        <span>+15</span>
      </div>
      {!isPlaying ? (
        <div className="player-poster">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={thumbnailUrl(video.videoId)} />
        </div>
      ) : null}
      {!isPlaying || controlsVisible ? (
        <button
          className="big-play-button"
          onClick={(event) => {
            event.stopPropagation();
            playPause();
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          type="button"
          aria-label={isPlaying ? `Pause ${video.title}` : `Play ${video.title}`}
        >
          {isPlaying ? (
            <Pause size={30} fill="currentColor" />
          ) : (
            <Play size={30} fill="currentColor" />
          )}
        </button>
      ) : null}
      <div className="player-progress-wrap">
        <button
          className="player-progress"
          disabled={durationSeconds <= 0}
          onClick={seekFromProgress}
          type="button"
          aria-label="Seek video"
        >
          <span
            className="player-progress-fill"
            style={{
              width:
                durationSeconds > 0
                  ? `${Math.min(100, (currentTime / durationSeconds) * 100)}%`
                  : "0%",
            }}
          />
        </button>
        <span className="player-time">
          {formatTimestamp(currentTime)} /{" "}
          {durationSeconds > 0 ? formatTimestamp(durationSeconds) : video.duration}
        </span>
      </div>
      <div className="safe-player-controls" aria-label="Video controls">
        <button
          className="player-control-button seek-button"
          onClick={() => seekRelative(-15)}
          type="button"
          aria-label="Go back 15 seconds"
        >
          -15
        </button>
        <button
          className="player-control-button"
          disabled={!previousVideo}
          onClick={() => previousVideo && onOpenVideo(previousVideo)}
          type="button"
          aria-label="Previous approved video"
        >
          <SkipBack size={16} fill="currentColor" />
        </button>
        <button
          className="player-control-button primary"
          onClick={playPause}
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>
        <button
          className="player-control-button"
          disabled={!nextVideo}
          onClick={() => nextVideo && onOpenVideo(nextVideo)}
          type="button"
          aria-label="Next approved video"
        >
          <SkipForward size={16} fill="currentColor" />
        </button>
        <button
          className="player-control-button seek-button"
          onClick={() => seekRelative(15)}
          type="button"
          aria-label="Go forward 15 seconds"
        >
          +15
        </button>
        <span className="control-divider" />
        <button
          className="player-control-button"
          onClick={toggleMute}
          type="button"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted || volume === 0 ? (
            <VolumeX size={16} />
          ) : volume < 50 ? (
            <Volume1 size={16} />
          ) : (
            <Volume2 size={16} />
          )}
        </button>
        <button
          className="player-control-button volume-step"
          onClick={() => setVolume(volume - 10)}
          type="button"
          aria-label="Volume down"
        >
          -
        </button>
        <span className="volume-meter" aria-label={`Volume ${volume}%`}>
          <span style={{ width: `${volume}%` }} />
        </span>
        <button
          className="player-control-button volume-step"
          onClick={() => setVolume(volume + 10)}
          type="button"
          aria-label="Volume up"
        >
          +
        </button>
        <button
          className={`player-control-button repeat-button ${isRepeatOne ? "active" : ""}`}
          onClick={toggleRepeatOne}
          type="button"
          aria-label={isRepeatOne ? "Repeat one enabled" : "Repeat one disabled"}
          aria-pressed={isRepeatOne}
        >
          <Repeat1 size={18} />
        </button>
        <button
          className="player-control-button fullscreen-button"
          onClick={toggleFullscreen}
          type="button"
          aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
}

function SettingsView({
  approvedCount,
  exportTooltip,
  isImportOpen,
  isTransferImportOpen,
  libraryQuery,
  libraryResults,
  pasteError,
  pasteUrl,
  selectedIds,
  transferCode,
  transferStatus,
  onAddPastedVideo,
  onApproveAll,
  onExportLibrary,
  onHideAll,
  onImportLibrary,
  onOpenImport,
  onOpenTransferImport,
  onPasteUrlChange,
  onQueryChange,
  onApprove,
  onRemoveCompletely,
  onTransferCodeChange,
  onUnapprove,
}: {
  approvedCount: number;
  exportTooltip: string;
  isImportOpen: boolean;
  isTransferImportOpen: boolean;
  libraryQuery: string;
  libraryResults: Video[];
  pasteError: string;
  pasteUrl: string;
  selectedIds: string[];
  transferCode: string;
  transferStatus: string;
  onAddPastedVideo: () => void;
  onApproveAll: () => void;
  onExportLibrary: () => void;
  onHideAll: () => void;
  onImportLibrary: () => void;
  onOpenImport: () => void;
  onOpenTransferImport: () => void;
  onPasteUrlChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onApprove: (video: Video) => void;
  onRemoveCompletely: (video: Video) => void;
  onTransferCodeChange: (value: string) => void;
  onUnapprove: (video: Video) => void;
}) {
  const [settingsTab, setSettingsTab] = useState<"approved" | "hidden">(
    "approved",
  );
  const [confirmAction, setConfirmAction] = useState<"approve" | "hide" | null>(
    null,
  );
  const approvedIds = useMemo(() => new Set(selectedIds), [selectedIds]);
  const approvedResults = useMemo(
    () => libraryResults.filter((video) => approvedIds.has(video.id)),
    [approvedIds, libraryResults],
  );
  const hiddenResults = useMemo(
    () => libraryResults.filter((video) => !approvedIds.has(video.id)),
    [approvedIds, libraryResults],
  );
  const visibleResults =
    settingsTab === "approved" ? approvedResults : hiddenResults;

  return (
    <div className="settings-layout">
      <section>
        <div className="section-heading">
          <div>
            <h1>Parent settings</h1>
            <div className="muted">{approvedCount} approved videos</div>
          </div>
          <div className="settings-heading-actions">
            <button
              className={`icon-button tooltip-button ${exportTooltip ? "show-tooltip" : ""}`}
              type="button"
              onClick={onExportLibrary}
              aria-label="Export parent settings"
              data-tooltip="Export parent settings"
            >
              {exportTooltip === "Export copied" ? (
                <Check size={19} />
              ) : exportTooltip === "Copying..." ? (
                <Copy size={19} />
              ) : (
                <Upload size={19} />
              )}
              <span className="button-tooltip" role="status">
                {exportTooltip}
              </span>
            </button>
            <button
              className={`icon-button ${isTransferImportOpen ? "active" : ""}`}
              type="button"
              onClick={onOpenTransferImport}
              aria-label="Import parent settings"
              data-tooltip="Import parent settings"
            >
              <Download size={19} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={onOpenImport}
              aria-label="Add YouTube link"
              data-tooltip="Add YouTube link"
            >
              {isImportOpen ? <X size={19} /> : <Plus size={19} />}
            </button>
          </div>
        </div>

        <div className="settings-toolbar">
          <div className="settings-search">
            <input
              value={libraryQuery}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search videos"
              aria-label="Search videos"
            />
          </div>
        </div>

        <div className="settings-tabs" role="tablist" aria-label="Video lists">
          <button
            className={`settings-tab ${settingsTab === "approved" ? "active" : ""}`}
            type="button"
            onClick={() => setSettingsTab("approved")}
            role="tab"
            aria-selected={settingsTab === "approved"}
            data-tooltip="Show approved videos"
          >
            Approved videos
            <span>{approvedResults.length}</span>
          </button>
          <button
            className={`settings-tab ${settingsTab === "hidden" ? "active" : ""}`}
            type="button"
            onClick={() => setSettingsTab("hidden")}
            role="tab"
            aria-selected={settingsTab === "hidden"}
            data-tooltip="Show hidden videos"
          >
            Hidden videos
            <span>{hiddenResults.length}</span>
          </button>
        </div>

        <div className="settings-bulk-actions" aria-label="Bulk video actions">
          <div className="bulk-action-wrap">
            <button
              className="compact-button approve-compact-button"
              type="button"
              onClick={() =>
                setConfirmAction((action) =>
                  action === "approve" ? null : "approve",
                )
              }
              aria-expanded={confirmAction === "approve"}
              data-tooltip="Approve all videos"
            >
              <Plus size={16} />
              Approve all
            </button>
            {confirmAction === "approve" ? (
              <BulkConfirmPopover
                tone="approve"
                message="Approve every video in the library?"
                confirmLabel="Approve all"
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => {
                  onApproveAll();
                  setConfirmAction(null);
                }}
              />
            ) : null}
          </div>
          <div className="bulk-action-wrap">
            <button
              className="compact-button danger-compact-button"
              type="button"
              onClick={() =>
                setConfirmAction((action) => (action === "hide" ? null : "hide"))
              }
              aria-expanded={confirmAction === "hide"}
              data-tooltip="Hide all videos"
            >
              <EyeOff size={16} />
              Hide all
            </button>
            {confirmAction === "hide" ? (
              <BulkConfirmPopover
                tone="danger"
                message="Hide every approved video from home?"
                confirmLabel="Hide all"
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => {
                  onHideAll();
                  setConfirmAction(null);
                }}
              />
            ) : null}
          </div>
        </div>

        {isImportOpen ? (
          <div
            className="paste-overlay"
            onClick={onOpenImport}
            role="presentation"
          >
            <form
              className="paste-panel"
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                onAddPastedVideo();
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-video-title"
            >
              <div className="modal-heading">
                <h2 id="add-video-title">Add video link</h2>
                <button
                  className="icon-button"
                  type="button"
                  onClick={onOpenImport}
                  aria-label="Close"
                  data-tooltip="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="paste-row">
                <input
                  autoFocus
                  value={pasteUrl}
                  onChange={(event) => onPasteUrlChange(event.target.value)}
                  placeholder="Paste YouTube share link"
                  aria-label="Paste YouTube share link"
                />
              </div>
              <div className="modal-actions">
                <span className="status-line">{pasteError}</span>
                <button
                  className="primary-button"
                  type="submit"
                  data-tooltip="Add video"
                >
                  <Plus size={18} />
                  Add video
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {isTransferImportOpen ? (
          <div
            className="paste-overlay"
            onClick={onOpenTransferImport}
            role="presentation"
          >
            <form
              className="paste-panel"
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                onImportLibrary();
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="import-settings-title"
            >
              <div className="modal-heading">
                <h2 id="import-settings-title">Import settings</h2>
                <button
                  className="icon-button"
                  type="button"
                  onClick={onOpenTransferImport}
                  aria-label="Close"
                  data-tooltip="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <textarea
                className="transfer-code-input"
                autoFocus
                value={transferCode}
                onChange={(event) => onTransferCodeChange(event.target.value)}
                placeholder="Paste KidTube export code"
                aria-label="Paste KidTube export code"
              />
              <div className="modal-actions">
                <span className="status-line">{transferStatus}</span>
                <button
                  className="primary-button"
                  type="submit"
                  data-tooltip="Import settings"
                >
                  <Upload size={18} />
                  Import
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="library-results">
          {visibleResults.length === 0 ? (
            <div className="settings-empty muted">
              No {settingsTab === "approved" ? "approved" : "hidden"} videos found.
            </div>
          ) : null}
          {visibleResults.map((video) => {
            const approvedVideo = approvedIds.has(video.id);
            return (
              <div className="result-card" key={video.id}>
                <Thumbnail video={video} />
                <div className="result-info">
                  <span className="video-title">{video.title}</span>
                  <span className="video-subline">{video.channel}</span>
                </div>
                <div className="settings-row-actions">
                  {approvedVideo ? (
                    <button
                      className="icon-button hide-icon"
                      type="button"
                      onClick={() => onUnapprove(video)}
                      aria-label={`Hide ${video.title}`}
                      data-tooltip="Hide"
                    >
                      <EyeOff size={18} />
                    </button>
                  ) : (
                    <button
                      className="icon-button show-icon"
                      type="button"
                      onClick={() => onApprove(video)}
                      aria-label={`Show ${video.title}`}
                      data-tooltip="Show"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                  <button
                    className="icon-button remove-icon"
                    type="button"
                    onClick={() => onRemoveCompletely(video)}
                    aria-label={`Remove ${video.title} completely`}
                    data-tooltip="Remove completely"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function BulkConfirmPopover({
  confirmLabel,
  message,
  tone,
  onCancel,
  onConfirm,
}: {
  confirmLabel: string;
  message: string;
  tone: "approve" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="bulk-confirm-popover" role="dialog" aria-label={message}>
      <p>{message}</p>
      <div className="bulk-confirm-actions">
        <button
          className="confirm-popover-button"
          type="button"
          onClick={onCancel}
          data-tooltip="Cancel"
        >
          Cancel
        </button>
        <button
          className={`confirm-popover-button ${tone === "danger" ? "danger-confirm" : "approve-confirm"}`}
          type="button"
          onClick={onConfirm}
          data-tooltip={confirmLabel}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

function Thumbnail({ video }: { video: Video }) {
  return (
    <span className="thumbnail">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
        src={thumbnailUrl(video.videoId)}
      />
      <span className="duration">{video.duration}</span>
    </span>
  );
}
