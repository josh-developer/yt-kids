/**
 * The page the player runs in, and the two-way protocol with it.
 *
 * A WebView rather than a native video view, because YouTube has no native SDK that may
 * be used this way: the iframe player is the supported surface, and an app that scraped
 * stream URLs instead would break the terms and, sooner, itself. What makes it a real
 * player rather than an embed is that every YouTube affordance is off and every control
 * is ours: `controls: 0`, no keyboard, no related videos, no branding.
 *
 * The page loads the official iframe API and exposes `window.kidtube` — the commands the
 * app sends with `injectJavaScript` — and reports back through
 * `ReactNativeWebView.postMessage`. Two things fall out of that arrangement and both
 * matter: switching videos is `loadVideoById` on a page that is already warm, so a
 * recommendation starts playing without a reload, and the volume, position and state the
 * chrome draws come from the player itself rather than from what the app last asked for.
 */

/** Same value as the web's `SEEK_STEP_SECONDS`. */
export const SEEK_STEP = 15;

/** `onStateChange` codes from the iframe API. */
const STATE = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
} as const;

export type PlayerMessage =
  | { type: "ready" }
  | { type: "state"; state: number }
  | { type: "time"; position: number; duration: number }
  | { type: "error"; code: number };

export const PLAYER_STATE = STATE;

/**
 * Injected JavaScript is evaluated as an expression list; a trailing `true` keeps the
 * bridge from warning about a non-serialisable result.
 *
 * Guarded on `window.kidtube` because a command can arrive before the page has defined
 * it — the first `load` races the document — and an unguarded call logs a WebKit exception
 * for something that is simply early. The page ignores what it is not ready for.
 */
function command(body: string) {
  return `if (window.kidtube) { ${body}; } true;`;
}

export const playerCommands = {
  play: () => command("window.kidtube.play()"),
  pause: () => command("window.kidtube.pause()"),
  seekTo: (seconds: number) =>
    command(`window.kidtube.seekTo(${Math.max(0, Math.floor(seconds))})`),
  seekBy: (seconds: number) => command(`window.kidtube.seekBy(${seconds})`),
  load: (videoId: string) =>
    command(`window.kidtube.load(${JSON.stringify(videoId)})`),
  setLoop: (isLooping: boolean) =>
    command(`window.kidtube.setLoop(${isLooping ? "true" : "false"})`),
  /**
   * The page's clock, which only the visible controls have any use for. Left running
   * while they are hidden it costs four bridge messages and four React renders a second
   * for a progress bar nobody can see — which a mid-range phone pays for in heat.
   */
  watchTime: (isWatching: boolean) =>
    command(`window.kidtube.watchTime(${isWatching ? "true" : "false"})`),
  mute: () => command("window.kidtube.mute()"),
  /**
   * Also undoes the muted start below — the player's own volume stays at 100, and the
   * device's volume is what the meter shows.
   */
  unmute: () => command("window.kidtube.unmute()"),
};

export function parsePlayerMessage(raw: string): PlayerMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("type" in parsed) ||
      typeof (parsed as { type: unknown }).type !== "string"
    ) {
      return null;
    }

    return parsed as PlayerMessage;
  } catch {
    return null;
  }
}

/**
 * The page, built once per mounted player.
 *
 * `mute: 0` is deliberate and is the fix for iOS starting every video silent: the web
 * has to start muted because a browser will not autoplay with sound, but a WKWebView
 * configured with `mediaPlaybackRequiresUserAction={false}` will. `startsMuted` exists
 * only as the fallback for a platform or version that still refuses, and the app
 * unmutes as soon as playback reports itself as started.
 *
 * The 250ms clock is the page's, not the app's: a `setInterval` on the JS thread would
 * be the wrong place for it, and asking for the time over the bridge would cost a round
 * trip per tick.
 */
export function buildPlayerHtml({
  videoId,
  origin,
  startsMuted = false,
}: {
  videoId: string;
  /**
   * The origin the embed believes it is inside, which has to be a real one: an embed with
   * nothing to report refuses to play — YouTube answers with a 150 or a 152, "this video
   * is unavailable", however embeddable the video actually is. The site's own origin is
   * the honest answer, it is the one already embedding these videos in production, and it
   * is what the WebView is told to use as its base URL.
   */
  origin: string;
  startsMuted?: boolean;
}) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <!-- The embed is checked against where it is embedded, so the referrer has to survive
         the hop to youtube.com rather than being stripped to the bare origin. -->
    <meta name="referrer" content="unsafe-url" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #080808; overflow: hidden; }
      #player { width: 100%; height: 100%; border: 0; }
      /**
       * The shield.
       *
       * A WebView takes touches in native code whatever the app puts over it, so without
       * this the embed sees every tap meant for the app's own controls — and answers with
       * its title bar, its watch-on-YouTube link and a seek from its own progress bar.
       * Swallowing them here leaves the embed with no interaction at all, which is the
       * point: playback is driven through the API, and the controls belong to the app.
       */
      #shield {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 10;
        background: transparent;
        touch-action: none;
      }
    </style>
  </head>
  <body>
    <div id="player"></div>
    <div id="shield"></div>
    <script>
      var send = function (payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      };

      var player = null;
      var isLooping = false;
      var clock = null;
      /* Whether anything is watching the clock. The app turns this off with the controls. */
      var isWatched = true;

      var sendTime = function () {
        if (!player || !player.getCurrentTime) { return; }
        send({
          type: "time",
          position: player.getCurrentTime() || 0,
          duration: player.getDuration() || 0
        });
      };

      var startClock = function () {
        if (clock || !isWatched) { return; }
        clock = setInterval(sendTime, 250);
      };

      var stopClock = function () {
        if (!clock) { return; }
        clearInterval(clock);
        clock = null;
      };

      window.kidtube = {
        play: function () { if (player) { player.playVideo(); } },
        pause: function () { if (player) { player.pauseVideo(); } },
        seekTo: function (seconds) { if (player) { player.seekTo(seconds, true); } },
        seekBy: function (seconds) {
          if (!player) { return; }
          var at = player.getCurrentTime() || 0;
          var end = player.getDuration() || 0;
          var next = at + seconds;
          if (next < 0) { next = 0; }
          if (end > 0 && next > end) { next = end; }
          player.seekTo(next, true);
          send({ type: "time", position: next, duration: end });
        },
        load: function (videoId) {
          if (!player) { return; }
          player.loadVideoById(videoId);
          player.playVideo();
        },
        setLoop: function (value) { isLooping = value; },
        watchTime: function (value) {
          isWatched = value;
          if (!value) { stopClock(); return; }
          sendTime();
          if (player && player.getPlayerState && player.getPlayerState() === ${STATE.playing}) {
            startClock();
          }
        },
        mute: function () { if (player) { player.mute(); } },
        unmute: function () {
          if (!player) { return; }
          player.unMute();
          player.setVolume(100);
        }
      };

      function onYouTubeIframeAPIReady() {
        player = new YT.Player("player", {
          videoId: ${JSON.stringify(videoId)},
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            cc_load_policy: 0,
            mute: ${startsMuted ? 1 : 0},
            origin: ${JSON.stringify(origin)},
            widget_referrer: ${JSON.stringify(origin)}
          },
          events: {
            onReady: function () {
              player.setVolume(100);
              ${startsMuted ? "" : "player.unMute();"}
              player.playVideo();
              send({ type: "ready" });
            },
            onStateChange: function (event) {
              send({ type: "state", state: event.data });
              if (event.data === ${STATE.playing}) {
                startClock();
              } else {
                stopClock();
              }
              if (event.data === ${STATE.ended} && isLooping) {
                player.seekTo(0, true);
                player.playVideo();
              }
            },
            onError: function (event) {
              send({ type: "error", code: event.data });
            }
          }
        });
      }

      var api = document.createElement("script");
      api.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(api);
    </script>
  </body>
</html>`;
}
