"use client";

import {
  Check,
  Copy,
  Download,
  EyeOff,
  Languages,
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
type Language = "en" | "uz";
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

type WatchStack = {
  ids: string[];
  index: number;
};

type YouTubeMetadata = {
  title?: string;
  channel?: string;
  duration?: string;
  durationSeconds?: number;
};

const STORAGE_KEY = "kidtube-library-v1";
const THEME_STORAGE_KEY = "kidtube-theme-v1";
const LANGUAGE_STORAGE_KEY = "kidtube-language-v1";
const TRANSFER_PREFIX = "KIDTUBE1";
const TRANSFER_SECRET = "kidtube-parent-library-transfer-v1";
const LIBRARY_VERSION = 6;
const CATALOG: Video[] = CURATED_UZBEK_OLD_CARTOONS;
const MAX_WATCH_STACK_SIZE = 200;
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
const COPY = {
  en: {
    addVideo: "Add video",
    addVideoLink: "Add video link",
    addVideosFromSettings: "Add videos from Parent settings.",
    approved: "Approved",
    approvedCount: (count: number) => `${count} approved videos`,
    approvedVideo: "Approved video",
    approvedVideos: "Approved videos",
    approveAll: "Approve all",
    approveAllConfirm: "Approve every video in the library?",
    approveAllVideos: "Approve all videos",
    back15: "Go back 15 seconds",
    cancel: "Cancel",
    checkingApprovedLibrary: "Checking the parent-approved library.",
    checkingVideoDetails: "Checking video details...",
    close: "Close",
    copyFailed: "Copy failed",
    copying: "Copying...",
    exportCopied: "Export copied",
    exportParentSettings: "Export parent settings",
    exitFullScreen: "Exit full screen",
    forward15: "Go forward 15 seconds",
    fullScreen: "Full screen",
    goHome: "Go home",
    hiddenVideos: "Hidden videos",
    hide: "Hide",
    hideAll: "Hide all",
    hideAllConfirm: "Hide every approved video from home?",
    hideAllVideos: "Hide all videos",
    home: "Home",
    importComplete: "Import complete.",
    importFailed: "Could not import this code.",
    importParentSettings: "Import parent settings",
    importSettings: "Import settings",
    importedVideoTitle: "Imported YouTube video",
    language: "Language",
    loadingVideo: "Loading video",
    nextVideo: "Next approved video",
    noApprovedVideos: "No approved videos yet",
    noVideosFound: (tab: "approved" | "hidden") => `No ${tab} videos found.`,
    mute: "Mute",
    openSettings: "Open settings",
    parentAdded: "Parent added",
    parentSettings: "Parent settings",
    pause: "Pause",
    pasteExportCode: "Paste KidTube export code",
    pasteImportCodeError: "Paste a valid KidTube export code.",
    pasteYoutubeLink: "Paste YouTube share link",
    pasteYoutubeLinkError: "Paste a valid YouTube link or video ID.",
    playRecommendedVideo: "Play recommended video",
    playVideo: "Play video",
    previousVideo: "Previous approved video",
    readingImportCode: "Reading import code...",
    removeCompletely: "Remove completely",
    removeCompletelyLabel: (title: string) => `Remove ${title} completely`,
    repeatOneDisabled: "Repeat one disabled",
    repeatOneEnabled: "Repeat one enabled",
    search: "Search",
    searchApprovedVideos: "Search approved videos",
    searchPageTitle: (query: string) => `${query} - Search | KidTube`,
    searchVideos: "Search videos",
    show: "Show",
    showApprovedVideos: "Show approved videos",
    showHiddenVideos: "Show hidden videos",
    shuffleHome: "Shuffle home",
    switchLanguage: "Switch language",
    transferCodeShort: "Transfer code is too short.",
    transferInvalidVideo: "Transfer code contains an invalid video.",
    transferReadUnsupported: "This browser cannot read compressed transfer codes.",
    transferUnsupported: "Unsupported transfer code version.",
    unmute: "Unmute",
    useDarkMode: "Use dark mode",
    useLightMode: "Use light mode",
    videoControls: "Video controls",
    videoPlayerHelp:
      "Video player. Use left and right to seek, up and down for volume, and enter to play or pause.",
    videoSurface: (title: string) => `${title} video surface`,
    videoUnavailable: "Video unavailable",
    videoUnavailableMessage: "This video is hidden, removed, or not in this library.",
    volume: (value: number) => `Volume ${value}%`,
    volumeDown: "Volume down",
    volumeUp: "Volume up",
  },
  uz: {
    addVideo: "Video qo'shish",
    addVideoLink: "Video havolasini qo'shish",
    addVideosFromSettings: "Ota-ona sozlamalari orqali video qo'shing.",
    approved: "Tasdiqlangan",
    approvedCount: (count: number) => `${count} ta tasdiqlangan video`,
    approvedVideo: "Tasdiqlangan video",
    approvedVideos: "Tasdiqlangan videolar",
    approveAll: "Barchasini tasdiqlash",
    approveAllConfirm: "Kutubxonadagi hamma videolar tasdiqlansinmi?",
    approveAllVideos: "Hamma videolarni tasdiqlash",
    back15: "15 soniya orqaga",
    cancel: "Bekor qilish",
    checkingApprovedLibrary: "Ota-ona tasdiqlagan kutubxona tekshirilmoqda.",
    checkingVideoDetails: "Video ma'lumotlari tekshirilmoqda...",
    close: "Yopish",
    copyFailed: "Nusxalash amalga oshmadi",
    copying: "Nusxalanmoqda...",
    exportCopied: "Export nusxalandi",
    exportParentSettings: "Ota-ona sozlamalarini eksport qilish",
    exitFullScreen: "Full screendan chiqish",
    forward15: "15 soniya oldinga",
    fullScreen: "To'liq ekran",
    goHome: "Bosh sahifaga",
    hiddenVideos: "Yashirilgan videolar",
    hide: "Yashirish",
    hideAll: "Barchasini yashirish",
    hideAllConfirm: "Tasdiqlangan hamma videolar bosh sahifadan yashirilsinmi?",
    hideAllVideos: "Hamma videolarni yashirish",
    home: "Bosh sahifa",
    importComplete: "Import tugadi.",
    importFailed: "Bu kodni import qilib bo'lmadi.",
    importParentSettings: "Ota-ona sozlamalarini import qilish",
    importSettings: "Sozlamalarni import qilish",
    importedVideoTitle: "Import qilingan YouTube videosi",
    language: "Til",
    loadingVideo: "Video yuklanmoqda",
    nextVideo: "Keyingi tasdiqlangan video",
    noApprovedVideos: "Hali tasdiqlangan video yo'q",
    noVideosFound: (tab: "approved" | "hidden") =>
      tab === "approved"
        ? "Tasdiqlangan videolar topilmadi."
        : "Yashirilgan videolar topilmadi.",
    mute: "Ovozni o'chirish",
    openSettings: "Sozlamalarni ochish",
    parentAdded: "Ota-ona qo'shgan",
    parentSettings: "Ota-ona sozlamalari",
    pause: "Pauza",
    pasteExportCode: "KidTube export kodini kiriting",
    pasteImportCodeError: "To'g'ri KidTube export kodini kiriting.",
    pasteYoutubeLink: "YouTube share havolasini kiriting",
    pasteYoutubeLinkError: "To'g'ri YouTube havolasi yoki video ID kiriting.",
    playRecommendedVideo: "Tavsiya qilingan videoni ko'rish",
    playVideo: "Videoni ko'rish",
    previousVideo: "Oldingi tasdiqlangan video",
    readingImportCode: "Import kodi o'qilmoqda...",
    removeCompletely: "Butunlay o'chirish",
    removeCompletelyLabel: (title: string) => `${title} butunlay o'chirilsin`,
    repeatOneDisabled: "Bitta videoni takrorlash o'chirilgan",
    repeatOneEnabled: "Bitta videoni takrorlash yoqilgan",
    search: "Qidirish",
    searchApprovedVideos: "Tasdiqlangan videolarni qidirish",
    searchPageTitle: (query: string) => `${query} - Qidiruv | KidTube`,
    searchVideos: "Videolarni qidirish",
    show: "Ko'rsatish",
    showApprovedVideos: "Tasdiqlangan videolarni ko'rsatish",
    showHiddenVideos: "Yashirilgan videolarni ko'rsatish",
    shuffleHome: "Bosh sahifani aralashtirish",
    switchLanguage: "Tilni almashtirish",
    transferCodeShort: "Transfer kodi juda qisqa.",
    transferInvalidVideo: "Transfer kodida noto'g'ri video bor.",
    transferReadUnsupported: "Bu brauzer siqilgan transfer kodlarini o'qiy olmaydi.",
    transferUnsupported: "Transfer kodi versiyasi qo'llab-quvvatlanmaydi.",
    unmute: "Ovozni yoqish",
    useDarkMode: "Dark mode",
    useLightMode: "Light mode",
    videoControls: "Video boshqaruvlari",
    videoPlayerHelp:
      "Video player. Chap/o'ng bilan oldinga-orqaga, yuqori/past bilan ovoz, Enter bilan play/pause.",
    videoSurface: (title: string) => `${title} video oynasi`,
    videoUnavailable: "Video mavjud emas",
    videoUnavailableMessage: "Bu video yashirilgan, o'chirilgan yoki kutubxonada yo'q.",
    volume: (value: number) => `Ovoz ${value}%`,
    volumeDown: "Ovozni pasaytirish",
    volumeUp: "Ovozni ko'tarish",
  },
} as const;

type CopyText = typeof COPY.en;

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

function watchStackForRoute(route: AppRoute): WatchStack {
  return route.view === "watch"
    ? { ids: [route.videoId], index: 0 }
    : { ids: [], index: -1 };
}

function isLikelyTvBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /appletv|aquos|aftb|aftm|afts|aftt|bravia|crkey|dtv|googletv|hbbtv|netcast|roku|smart-tv|smarttv|tizen|tv safari|viera|web0s|webos/i.test(
    navigator.userAgent,
  );
}

function preferredDeviceTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function preferredLanguage(): Language {
  if (typeof navigator === "undefined") {
    return "en";
  }

  return navigator.language.toLowerCase().startsWith("uz") ? "uz" : "en";
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

function pushWatchStack(current: WatchStack, videoId: string): WatchStack {
  if (current.ids[current.index] === videoId) {
    return current;
  }

  const prefix =
    current.index >= 0 ? current.ids.slice(0, current.index + 1) : [];
  const ids = [...prefix, videoId].slice(-MAX_WATCH_STACK_SIZE);
  return { ids, index: ids.length - 1 };
}

function findWatchStackVideo(
  stack: WatchStack,
  currentId: string,
  direction: -1 | 1,
  videosById: Map<string, Video>,
) {
  const currentIndex =
    stack.ids[stack.index] === currentId
      ? stack.index
      : stack.ids.lastIndexOf(currentId);

  if (currentIndex < 0) {
    return null;
  }

  for (
    let index = currentIndex + direction;
    index >= 0 && index < stack.ids.length;
    index += direction
  ) {
    const video = videosById.get(stack.ids[index]);
    if (video && video.id !== currentId) {
      return { index, video };
    }
  }

  return null;
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
  const didLoadStoredLibrary = useRef(false);
  const exportTooltipTimer = useRef<number | null>(null);
  const view = route.view;
  const copy = COPY[language];

  const { customVideos, removedIds, selectedIds } = library;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedLibrary = readStoredLibrary();
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
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
      setIsTvBrowser(isLikelyTvBrowser());
      setHasLoadedStoredLibrary(true);
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
  const currentVideoIndex = currentVideo
    ? selectedVideos.findIndex((video) => video.id === currentVideo.id)
    : -1;
  const previousStackEntry = currentVideo
    ? findWatchStackVideo(watchStack, currentVideo.id, -1, selectedVideoById)
    : null;
  const nextStackEntry = currentVideo
    ? findWatchStackVideo(watchStack, currentVideo.id, 1, selectedVideoById)
    : null;
  const fallbackNextVideo =
    selectedVideos.length > 1 && currentVideoIndex >= 0
      ? selectedVideos[(currentVideoIndex + 1) % selectedVideos.length]
      : null;
  const previousVideo = previousStackEntry?.video ?? null;
  const nextVideo = nextStackEntry?.video ?? fallbackNextVideo;

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
    if (nextStackEntry) {
      const { index, video } = nextStackEntry;
      setWatchStack((current) =>
        current.ids[index] === video.id
          ? { ...current, index }
          : { ...current, index: current.ids.lastIndexOf(video.id) },
      );
      navigateTo({ view: "watch", videoId: video.id });
      return;
    }

    if (fallbackNextVideo) {
      openVideo(fallbackNextVideo);
    }
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

  return (
    <main className={`app-shell theme-${theme} ${isTvBrowser ? "tv-mode" : ""}`}>
      <header className="topbar">
        <button
          className="brand"
          type="button"
          onClick={() => navigateTo(HOME_ROUTE)}
          aria-label={copy.goHome}
          data-tooltip={copy.home}
        >
          <span className="brand-mark">
            <Play size={18} fill="currentColor" />
          </span>
          <span className="brand-name" aria-label="KidTube">
            <span className="brand-kid" aria-hidden="true">
              <span className="brand-letter brand-letter-k">K</span>
              <span className="brand-letter brand-letter-i">i</span>
              <span className="brand-letter brand-letter-d">d</span>
            </span>
            <span className="brand-tube">Tube</span>
          </span>
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
              placeholder={copy.searchApprovedVideos}
              aria-label={copy.searchApprovedVideos}
            />
            <button
              className="search-button"
              type="submit"
              aria-label={copy.search}
              data-tooltip={copy.search}
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
            aria-label={copy.shuffleHome}
            data-tooltip={copy.shuffleHome}
          >
            <RotateCcw size={19} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? copy.useLightMode : copy.useDarkMode}
            data-tooltip={theme === "dark" ? copy.useLightMode : copy.useDarkMode}
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className={`icon-button ${view === "settings" ? "active" : ""}`}
            type="button"
            onClick={() => navigateTo({ view: "settings" })}
            aria-label={copy.parentSettings}
            data-tooltip={copy.parentSettings}
          >
            <Plus size={19} />
          </button>
          <button
            className="language-button"
            type="button"
            onClick={toggleLanguage}
            aria-label={copy.switchLanguage}
            data-tooltip={copy.switchLanguage}
          >
            <Languages size={18} />
            <span>{language === "en" ? "UZ" : "EN"}</span>
          </button>
        </div>
      </header>

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
              video={currentVideo}
              onDurationResolved={updateCustomVideoDuration}
              onNextVideo={openNextVideo}
              onOpenVideo={openVideo}
              onPreviousVideo={openPreviousVideo}
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

function HomeView({
  copy,
  videos,
  onOpenVideo,
  onSettings,
}: {
  copy: CopyText;
  videos: Video[];
  onOpenVideo: (video: Video) => void;
  onSettings: () => void;
}) {
  if (videos.length === 0) {
    return (
      <div className="empty-state">
        <div>
          <h2>{copy.noApprovedVideos}</h2>
          <p className="muted">{copy.addVideosFromSettings}</p>
          <button
            className="primary-button"
            type="button"
            onClick={onSettings}
            data-tooltip={copy.openSettings}
          >
            <Plus size={18} />
            {copy.openSettings}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-grid">
      {videos.map((video) => (
        <VideoCard
          copy={copy}
          key={video.id}
          video={video}
          onOpen={onOpenVideo}
        />
      ))}
    </div>
  );
}

function LoadingVideoView({ copy }: { copy: CopyText }) {
  return (
    <div className="empty-state">
      <div>
        <h2>{copy.loadingVideo}</h2>
        <p className="muted">{copy.checkingApprovedLibrary}</p>
      </div>
    </div>
  );
}

function UnavailableVideoView({
  copy,
  onHome,
  onSettings,
}: {
  copy: CopyText;
  onHome: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="empty-state">
      <div>
        <h2>{copy.videoUnavailable}</h2>
        <p className="muted">{copy.videoUnavailableMessage}</p>
        <div className="empty-actions">
          <button
            className="primary-button"
            type="button"
            onClick={onHome}
            data-tooltip={copy.goHome}
          >
            {copy.home}
          </button>
          <button
            className="pill-button"
            type="button"
            onClick={onSettings}
            data-tooltip={copy.openSettings}
          >
            <Plus size={18} />
            {copy.parentSettings}
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoCard({
  copy,
  video,
  onOpen,
}: {
  copy: CopyText;
  video: Video;
  onOpen: (video: Video) => void;
}) {
  return (
    <button
      className="video-card"
      type="button"
      onClick={() => onOpen(video)}
      data-tooltip={copy.playVideo}
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
  copy,
  isTvBrowser,
  nextVideo,
  previousVideo,
  recommendations,
  video,
  onDurationResolved,
  onNextVideo,
  onOpenVideo,
  onPreviousVideo,
}: {
  copy: CopyText;
  isTvBrowser: boolean;
  nextVideo: Video | null;
  previousVideo: Video | null;
  recommendations: Video[];
  video: Video;
  onDurationResolved: (video: Video, seconds: number) => void;
  onNextVideo: () => void;
  onOpenVideo: (video: Video) => void;
  onPreviousVideo: () => void;
}) {
  return (
    <div className="watch-layout">
      <article>
        <SafeYouTubePlayer
          copy={copy}
          isTvBrowser={isTvBrowser}
          nextVideo={nextVideo}
          previousVideo={previousVideo}
          video={video}
          onDurationResolved={onDurationResolved}
          onNextVideo={onNextVideo}
          onPreviousVideo={onPreviousVideo}
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
            data-tooltip={copy.approvedVideo}
          >
            <ShieldCheck size={18} />
            {copy.approved}
          </button>
        </div>
      </article>

      <aside className="recommendations" aria-label={copy.playRecommendedVideo}>
        {recommendations.map((item) => (
          <button
            className="recommendation-card"
            key={item.id}
            type="button"
            onClick={() => onOpenVideo(item)}
            data-tooltip={copy.playRecommendedVideo}
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
  copy,
  isTvBrowser,
  nextVideo,
  previousVideo,
  video,
  onDurationResolved,
  onNextVideo,
  onPreviousVideo,
}: {
  copy: CopyText;
  isTvBrowser: boolean;
  nextVideo: Video | null;
  previousVideo: Video | null;
  video: Video;
  onDurationResolved: (video: Video, seconds: number) => void;
  onNextVideo: () => void;
  onPreviousVideo: () => void;
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
  const [durationSeconds, setDurationSeconds] = useState(0);
  const playTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const progressTimerRef = useRef<ReturnType<typeof window.setInterval> | null>(
    null,
  );
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const handleVideoEndedRef = useRef<() => void>(() => {});
  const isRestartingRepeatRef = useRef(false);
  const repeatOneRef = useRef(false);
  const videoRef = useRef(video);
  const nextVideoRef = useRef(nextVideo);
  const onDurationResolvedRef = useRef(onDurationResolved);
  const onNextVideoRef = useRef(onNextVideo);
  const publishedDurationRef = useRef(0);
  const seekRelativeRef = useRef<(seconds: number) => void>(() => {});

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
        onNextVideoRef.current();
      }
    };
  });

  useEffect(() => {
    repeatOneRef.current = isRepeatOne;
  }, [isRepeatOne]);

  useEffect(() => {
    videoRef.current = video;
  }, [video]);

  useEffect(() => {
    currentTimeRef.current = 0;
    durationRef.current = 0;
    publishedDurationRef.current = 0;
    isRestartingRepeatRef.current = false;
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }

    const frame = window.requestAnimationFrame(() => {
      setCurrentTime(0);
      setDurationSeconds(0);
      setShouldAutoplay(true);
      setIsPlaying(true);
      setControlsVisible(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [video.id]);

  useEffect(() => {
    let isCancelled = false;

    async function loadVideoDuration() {
      const metadata = await fetchYouTubeMetadata(
        `https://www.youtube.com/watch?v=${video.videoId}`,
      );
      const seconds = metadata.durationSeconds ?? 0;
      if (isCancelled || seconds <= 0) {
        return;
      }

      durationRef.current = seconds;
      publishedDurationRef.current = seconds;
      setDurationSeconds(seconds);
      onDurationResolvedRef.current(videoRef.current, seconds);
    }

    void loadVideoDuration();

    return () => {
      isCancelled = true;
    };
  }, [video.id, video.videoId]);

  useEffect(() => {
    nextVideoRef.current = nextVideo;
    onDurationResolvedRef.current = onDurationResolved;
    onNextVideoRef.current = onNextVideo;
  }, [nextVideo, onDurationResolved, onNextVideo]);

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
        if (Math.abs(info.duration - publishedDurationRef.current) >= 1) {
          publishedDurationRef.current = info.duration;
          onDurationResolvedRef.current(videoRef.current, info.duration);
        }
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

  seekRelativeRef.current = seekRelative;

  useEffect(() => {
    function handleWindowKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof HTMLElement &&
          target.closest("input, textarea, select, [contenteditable='true']"))
      ) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "MediaRewind") {
        event.preventDefault();
        seekRelativeRef.current(-15);
        return;
      }

      if (event.key === "ArrowRight" || event.key === "MediaFastForward") {
        event.preventDefault();
        seekRelativeRef.current(15);
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, []);

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

    if (!isTvBrowser) {
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
          ? copy.videoPlayerHelp
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
          sendPlayerCommand("getDuration");
          sendPlayerCommand("getCurrentTime");
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
        title={copy.videoSurface(video.title)}
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
          aria-label={isPlaying ? copy.pause : copy.playVideo}
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
          {durationSeconds > 0 ? formatTimestamp(durationSeconds) : "--:--"}
        </span>
      </div>
      <div className="safe-player-controls" aria-label={copy.videoControls}>
        <button
          className="player-control-button seek-button"
          onClick={() => seekRelative(-15)}
          type="button"
          aria-label={copy.back15}
        >
          -15
        </button>
        <button
          className="player-control-button"
          disabled={!previousVideo}
          onClick={onPreviousVideo}
          type="button"
          aria-label={copy.previousVideo}
        >
          <SkipBack size={16} fill="currentColor" />
        </button>
        <button
          className="player-control-button primary"
          onClick={playPause}
          type="button"
          aria-label={isPlaying ? copy.pause : copy.playVideo}
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
          onClick={onNextVideo}
          type="button"
          aria-label={copy.nextVideo}
        >
          <SkipForward size={16} fill="currentColor" />
        </button>
        <button
          className="player-control-button seek-button"
          onClick={() => seekRelative(15)}
          type="button"
          aria-label={copy.forward15}
        >
          +15
        </button>
        <span className="control-divider" />
        <button
          className="player-control-button"
          onClick={toggleMute}
          type="button"
          aria-label={isMuted ? copy.unmute : copy.mute}
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
          aria-label={copy.volumeDown}
        >
          -
        </button>
        <span className="volume-meter" aria-label={copy.volume(volume)}>
          <span style={{ width: `${volume}%` }} />
        </span>
        <button
          className="player-control-button volume-step"
          onClick={() => setVolume(volume + 10)}
          type="button"
          aria-label={copy.volumeUp}
        >
          +
        </button>
        <button
          className={`player-control-button repeat-button ${isRepeatOne ? "active" : ""}`}
          onClick={toggleRepeatOne}
          type="button"
          aria-label={
            isRepeatOne ? copy.repeatOneEnabled : copy.repeatOneDisabled
          }
          aria-pressed={isRepeatOne}
        >
          <Repeat1 size={18} />
        </button>
        <button
          className="player-control-button fullscreen-button"
          onClick={toggleFullscreen}
          type="button"
          aria-label={isFullscreen ? copy.exitFullScreen : copy.fullScreen}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
}

function SettingsView({
  approvedCount,
  copy,
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
  copy: CopyText;
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
  const exportTooltipLabel =
    exportTooltip === "copied"
      ? copy.exportCopied
      : exportTooltip === "copying"
        ? copy.copying
        : exportTooltip === "failed"
          ? copy.copyFailed
          : "";

  return (
    <div className="settings-layout">
      <section>
        <div className="section-heading">
          <div>
            <h1>{copy.parentSettings}</h1>
            <div className="muted">{copy.approvedCount(approvedCount)}</div>
          </div>
          <div className="settings-heading-actions">
            <button
              className={`icon-button tooltip-button ${exportTooltip ? "show-tooltip" : ""}`}
              type="button"
              onClick={onExportLibrary}
              aria-label={copy.exportParentSettings}
              data-tooltip={copy.exportParentSettings}
            >
              {exportTooltip === "copied" ? (
                <Check size={19} />
              ) : exportTooltip === "copying" ? (
                <Copy size={19} />
              ) : (
                <Upload size={19} />
              )}
              <span className="button-tooltip" role="status">
                {exportTooltipLabel}
              </span>
            </button>
            <button
              className={`icon-button ${isTransferImportOpen ? "active" : ""}`}
              type="button"
              onClick={onOpenTransferImport}
              aria-label={copy.importParentSettings}
              data-tooltip={copy.importParentSettings}
            >
              <Download size={19} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={onOpenImport}
              aria-label={copy.addVideoLink}
              data-tooltip={copy.addVideoLink}
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
              placeholder={copy.searchVideos}
              aria-label={copy.searchVideos}
            />
          </div>
        </div>

        <div className="settings-tabs" role="tablist" aria-label={copy.searchVideos}>
          <button
            className={`settings-tab ${settingsTab === "approved" ? "active" : ""}`}
            type="button"
            onClick={() => setSettingsTab("approved")}
            role="tab"
            aria-selected={settingsTab === "approved"}
            data-tooltip={copy.showApprovedVideos}
          >
            {copy.approvedVideos}
            <span>{approvedResults.length}</span>
          </button>
          <button
            className={`settings-tab ${settingsTab === "hidden" ? "active" : ""}`}
            type="button"
            onClick={() => setSettingsTab("hidden")}
            role="tab"
            aria-selected={settingsTab === "hidden"}
            data-tooltip={copy.showHiddenVideos}
          >
            {copy.hiddenVideos}
            <span>{hiddenResults.length}</span>
          </button>
        </div>

        <div className="settings-bulk-actions" aria-label={copy.approveAllVideos}>
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
              data-tooltip={copy.approveAllVideos}
            >
              <Plus size={16} />
              {copy.approveAll}
            </button>
            {confirmAction === "approve" ? (
              <BulkConfirmPopover
                tone="approve"
                message={copy.approveAllConfirm}
                confirmLabel={copy.approveAll}
                cancelLabel={copy.cancel}
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
              data-tooltip={copy.hideAllVideos}
            >
              <EyeOff size={16} />
              {copy.hideAll}
            </button>
            {confirmAction === "hide" ? (
              <BulkConfirmPopover
                tone="danger"
                message={copy.hideAllConfirm}
                confirmLabel={copy.hideAll}
                cancelLabel={copy.cancel}
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
                <h2 id="add-video-title">{copy.addVideoLink}</h2>
                <button
                  className="icon-button"
                  type="button"
                  onClick={onOpenImport}
                  aria-label={copy.close}
                  data-tooltip={copy.close}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="paste-row">
                <input
                  autoFocus
                  value={pasteUrl}
                  onChange={(event) => onPasteUrlChange(event.target.value)}
                  placeholder={copy.pasteYoutubeLink}
                  aria-label={copy.pasteYoutubeLink}
                />
              </div>
              <div className="modal-actions">
                <span className="status-line">{pasteError}</span>
                <button
                  className="primary-button"
                  type="submit"
                  data-tooltip={copy.addVideo}
                >
                  <Plus size={18} />
                  {copy.addVideo}
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
                <h2 id="import-settings-title">{copy.importSettings}</h2>
                <button
                  className="icon-button"
                  type="button"
                  onClick={onOpenTransferImport}
                  aria-label={copy.close}
                  data-tooltip={copy.close}
                >
                  <X size={18} />
                </button>
              </div>
              <textarea
                className="transfer-code-input"
                autoFocus
                value={transferCode}
                onChange={(event) => onTransferCodeChange(event.target.value)}
                placeholder={copy.pasteExportCode}
                aria-label={copy.pasteExportCode}
              />
              <div className="modal-actions">
                <span className="status-line">{transferStatus}</span>
                <button
                  className="primary-button"
                  type="submit"
                  data-tooltip={copy.importSettings}
                >
                  <Upload size={18} />
                  {copy.importSettings}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="library-results">
          {visibleResults.length === 0 ? (
            <div className="settings-empty muted">
              {copy.noVideosFound(settingsTab)}
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
                      aria-label={`${copy.hide} ${video.title}`}
                      data-tooltip={copy.hide}
                    >
                      <EyeOff size={18} />
                    </button>
                  ) : (
                    <button
                      className="icon-button show-icon"
                      type="button"
                      onClick={() => onApprove(video)}
                      aria-label={`${copy.show} ${video.title}`}
                      data-tooltip={copy.show}
                    >
                      <Plus size={18} />
                    </button>
                  )}
                  <button
                    className="icon-button remove-icon"
                    type="button"
                    onClick={() => onRemoveCompletely(video)}
                    aria-label={copy.removeCompletelyLabel(video.title)}
                    data-tooltip={copy.removeCompletely}
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
  cancelLabel,
  confirmLabel,
  message,
  tone,
  onCancel,
  onConfirm,
}: {
  cancelLabel: string;
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
          data-tooltip={cancelLabel}
        >
          {cancelLabel}
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
