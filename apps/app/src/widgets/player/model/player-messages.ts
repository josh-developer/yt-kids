import { isTrustedYouTubeMessageOrigin } from "@/shared/api/youtube";

/** `onStateChange` codes from the YouTube iframe API. */
export const PLAYER_STATE = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
} as const;

export type PlayerTelemetry = {
  currentTime?: number;
  duration?: number;
  playerState?: number;
  /** `onError` code: 2 bad id, 5 HTML5 error, 100 gone, 101/150 embed denied. */
  errorCode?: number;
};

type DeliveryPayload = {
  event?: string;
  info?: number | PlayerTelemetry;
};

const TELEMETRY_EVENTS = ["infoDelivery", "initialDelivery", "onStateChange"];
const ERROR_EVENT = "onError";

/**
 * Validates and flattens a message from the embed. Returns null for anything
 * that is not telemetry from our own iframe — including look-alike messages
 * from other origins.
 */
export function readPlayerTelemetry(
  event: MessageEvent,
  frame: HTMLIFrameElement | null,
): PlayerTelemetry | null {
  if (!isTrustedYouTubeMessageOrigin(event.origin)) {
    return null;
  }

  if (event.source !== frame?.contentWindow) {
    return null;
  }

  let payload: DeliveryPayload;
  try {
    payload =
      typeof event.data === "string" ? JSON.parse(event.data) : event.data;
  } catch {
    return null;
  }

  // A blocked or geo-restricted embed (VPN, school network, region lock)
  // reports itself here instead of ever reaching a playing state.
  if (payload.event === ERROR_EVENT) {
    return { errorCode: typeof payload.info === "number" ? payload.info : 0 };
  }

  if (!payload.event || !TELEMETRY_EVENTS.includes(payload.event)) {
    return null;
  }

  const info = payload.info;
  if (typeof info === "number") {
    return { playerState: info };
  }

  return info ?? {};
}
