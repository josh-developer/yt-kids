import { isYouTubeProvider } from "@vidstack/react";

/**
 * Debug tap on the embed conversation. Everything the player says to the
 * YouTube frame, and anything the component wants to mark alongside it, lands
 * here in order with a timestamp — which is how the poster bug was pinned to
 * `seekTo` going out ahead of `playVideo`.
 *
 * Read it from the console as `document.documentElement.dataset.trace`, or
 * watch the `[player]` lines go by. The DOM copy exists because it survives
 * being read from an extension or another JS world, where page globals do not.
 */
export function tracePlayer(entry: string) {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  const stamp = `${entry}@${Math.round(performance.now())}`;
  console.log("[player]", stamp);
  document.documentElement.dataset.trace =
    `${document.documentElement.dataset.trace ?? ""}|${stamp}`;
}

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

  // Every command the player sends, ours and vidstack's own, goes past the
  // trace on its way out — the order they leave in is what most embed puzzles
  // turn out to be about.
  const rawPostMessage = provider.postMessage.bind(provider);
  provider.postMessage = (message) => {
    tracePlayer(`out:${JSON.stringify(message)}`);
    return rawPostMessage(message);
  };

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
 * Lets the embed start itself, rather than waiting to be told to.
 *
 * Vidstack builds every YouTube URL with `autoplay=0` and then sends
 * `playVideo` once the frame is ready. On a desktop browser the two are
 * equivalent; on iOS they are not. A command arrives by postMessage with no
 * user activation behind it, so WebKit refuses it — and keeps refusing it,
 * which is why pressing play by hand did not help either. What WebKit does
 * honour is a document that was created during a tap and starts on its own,
 * and that is `autoplay=1` in the URL.
 *
 * `buildParams` is protected, hence the cast. It runs once per document, while
 * the provider is still being set up, so this has to be in place by
 * `provider-change` — which is where the rest of the embed hardening happens.
 */
export function letTheEmbedStartItself(
  provider: unknown,
  shouldAutoplay: boolean,
) {
  if (!isYouTubeProvider(provider) || !shouldAutoplay) {
    return;
  }

  const embed = provider as unknown as {
    buildParams: () => Record<string, unknown>;
  };
  const buildParams = embed.buildParams.bind(embed);
  embed.buildParams = () => ({ ...buildParams(), autoplay: 1 });
}

/**
 * Keeps one embed document alive for the whole session, changing videos with a
 * command instead of a new URL.
 *
 * This is what makes sound survive past the first video. WebKit grants audible
 * playback to a *document*, and a tap on our page does not carry into a
 * cross-origin child — so a freshly navigated iframe has never been tapped, no
 * matter what the viewer did a moment earlier. Vidstack re-navigates the frame
 * on every source change (`loadSource` moves its `videoId` signal, an effect
 * rebuilds the URL, and the iframe loads a new document), which is why an iPad
 * asked for a tap on every single video: each one was a new document asking
 * for permission from scratch.
 *
 * So only the first source is allowed to navigate. Every one after it becomes
 * `loadVideoById`, which swaps the video inside the document that is already
 * playing — and already allowed to make noise. That also starts the new video
 * on its own, which is the other half of what the viewer asked for.
 *
 * The provider stays coherent because everything it knows about the media
 * comes from the embed's own reports: duration, title, progress and player
 * state all arrive by message and describe whatever video is loaded now. The
 * one thing it will not do is re-navigate, which is the point.
 *
 * A rebuild is still the only way to change how audio *starts*, since `mute`
 * is fixed in the URL — that is a deliberate new document, and remounting the
 * player is what asks for one.
 */
export function keepEmbedDocumentAlive(provider: unknown) {
  if (!isYouTubeProvider(provider)) {
    return;
  }

  const loadSource = provider.loadSource.bind(provider);

  provider.loadSource = async (source) => {
    // Whether there is a document to swap into, asked of the iframe itself
    // rather than counted — nothing here depends on knowing whether
    // `provider-change` reaches us before or after the first source does.
    if (!provider.iframe.getAttribute("src")) {
      return loadSource(source);
    }

    // `youtube/<id>`, the shape the player builds its `src` prop in.
    const videoId = String(source.src ?? "").replace(/^youtube\//, "");
    if (!videoId) {
      return;
    }

    tracePlayer(`swap:${videoId}`);
    provider.postMessage({
      event: "command",
      func: "loadVideoById",
      args: [videoId],
    });
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
