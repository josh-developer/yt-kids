import { isYouTubeProvider } from "@vidstack/react";

/**
 * Locks down the embed iframe the moment Vidstack creates its YouTube
 * provider, before any `src` is assigned. Vidstack's own params already ship
 * `controls=0`, `disablekb=1`, `rel=0`, `iv_load_policy=3` on the
 * youtube-nocookie host when native controls are off; what it does not do is
 * sandbox the frame or keep it out of the tab order, so that part is ours.
 *
 * The sandbox list matches the hand-built player: scripts and same-origin so
 * the embed works at all, presentation for cast — and deliberately no
 * `allow-popups` or `allow-top-navigation`, so nothing inside the frame can
 * open YouTube proper. The pointer-events shield in the component is the
 * primary containment; this is defense-in-depth.
 */
export function hardenYouTubeEmbed(provider: unknown) {
  if (!isYouTubeProvider(provider)) {
    return;
  }
  const frame = provider.iframe;
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  frame.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-presentation",
  );
}

/**
 * Works around a bug in @vidstack/react 1.15.6's YouTube provider.
 *
 * Every command it sends to the embed opens a deferred promise, but only
 * `playVideo` and `pauseVideo` are ever settled. The promises behind `mute`,
 * `unMute`, `setVolume`, `seekTo` and `setPlaybackRate` stay pending for the
 * life of the embed, and `destroy()` rejects all of them with the string
 * "provider destroyed". Nothing holds those promises, so leaving the watch
 * page mid-playback throws one unhandled rejection per command the viewer
 * issued — and the dev overlay reports each one.
 *
 * These four setters do nothing but post their command, so we post it
 * ourselves and never open the promise. Payloads match the originals
 * exactly, including the provider's habit of omitting `args` for a falsy
 * value. `setCurrentTime` also flags `seeking` on the way through, which we
 * cannot reach from here; the provider re-derives that flag on the embed's
 * next time report, which lands within a tick.
 */
export function preventOrphanedCommandPromises(provider: unknown) {
  if (!isYouTubeProvider(provider)) {
    return;
  }

  const command = (func: string, args?: Array<boolean | number>) => {
    provider.postMessage({ event: "command", func, args });
  };

  provider.setMuted = (isMuted) => command(isMuted ? "mute" : "unMute");
  provider.setCurrentTime = (seconds) => command("seekTo", [seconds, true]);
  provider.setVolume = (volume) => {
    const scaled = volume * 100;
    command("setVolume", scaled ? [scaled] : undefined);
  };
  provider.setPlaybackRate = (rate) => {
    command("setPlaybackRate", rate ? [rate] : undefined);
  };

  // `play` and `pause` are different: their promise reports whether the embed
  // actually started, which the player reads to detect a refused autoplay, so
  // it has to keep working. Attaching an empty catch marks the promise as
  // handled without consuming the rejection — the player's own await still
  // sees it. Needed because the provider calls `this.pause()` internally and
  // drops the result, leaving a promise nobody would answer for at teardown.
  const play = provider.play.bind(provider);
  const pause = provider.pause.bind(provider);

  provider.play = () => {
    const request = play();
    request.catch(() => {});
    return request;
  };

  provider.pause = () => {
    const request = pause();
    request.catch(() => {});
    return request;
  };
}

/**
 * Vidstack's YouTube provider exposes no caption tracks, so captions are
 * toggled the same way the hand-built player does: the embed's loadable
 * captions module. The embed has answered to two module names across player
 * versions and ignores the one it doesn't know, so both are sent.
 */
export function setYouTubeCaptions(provider: unknown, areEnabled: boolean) {
  if (!isYouTubeProvider(provider)) {
    return;
  }
  for (const name of ["captions", "cc"]) {
    provider.postMessage({
      event: "command",
      func: areEnabled ? "loadModule" : "unloadModule",
      args: [name],
    });
  }
}
