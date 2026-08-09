import { isTrustedYouTubeMessageOrigin } from "@/shared/api/youtube";

export const PLAYER_STATE = {
  ended: 0,
  playing: 1,
} as const;

export type PlayerTelemetry = {
  currentTime?: number;
  duration?: number;
  playerState?: number;
};

type DeliveryPayload = {
  event?: string;
  info?: number | PlayerTelemetry;
};

const TELEMETRY_EVENTS = ["infoDelivery", "initialDelivery", "onStateChange"];

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

  if (!payload.event || !TELEMETRY_EVENTS.includes(payload.event)) {
    return null;
  }

  const info = payload.info;
  if (typeof info === "number") {
    return { playerState: info };
  }

  return info ?? {};
}
