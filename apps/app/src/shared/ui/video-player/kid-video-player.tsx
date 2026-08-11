import {
  Controls,
  MediaPlayer,
  MediaProvider,
  PlayButton,
  Poster,
  SeekButton,
  Time,
  TimeSlider,
  VolumeSlider,
  useMediaRemote,
  useMediaState,
  type MediaPlayerInstance,
} from "@vidstack/react";
import "@vidstack/react/player/styles/base.css";
import {
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat1,
  SkipBack,
  SkipForward,
  Unlock,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SoundPreference } from "@/shared/lib/playback/sound-preference";
import {
  DEFAULT_KID_VIDEO_PLAYER_LABELS,
  type KidVideoPlayerLabels,
} from "./kid-video-player-labels";
import {
  hardenYouTubeEmbed,
  keepEmbedDocumentAlive,
  letTheEmbedStartItself,
  preventOrphanedCommandPromises,
  tracePlayer,
} from "./youtube-provider-hardening";
import styles from "./kid-video-player.module.css";

/** One jump of the seek controls: the ±buttons, arrow keys, and double-tap. */
const SEEK_STEP_SECONDS = 15;

/** How close two taps must be to count as one double-tap. */
const DOUBLE_TAP_WINDOW_MS = 280;

/** How long the ±15 flash stays up after a double-tap. */
const SEEK_HINT_MS = 600;

/**
 * How long an embed built with sound gets to start before that counts as the
 * browser refusing. Long enough to cover the handshake and a slow first
 * segment, short enough that falling back to muted is not a visible wait.
 */
const SOUND_PROBE_MS = 1200;

/** What the hover card on a prev/next side button shows. */
export type KidVideoPlayerPreview = {
  title: string;
  thumbnailUrl: string;
  subtitle?: string;
};

/**
 * Generic kid-safe YouTube player on Vidstack's headless primitives. The
 * YouTube iframe is never interactive: a full-surface shield swallows clicks,
 * an opaque cover hides YouTube's link-out title bar, and the frame itself is
 * sandboxed without popups or top navigation. Everything a viewer can do goes
 * through the custom control bar.
 *
 * Deliberately domain-free (takes a `videoId`, not a `Video`) so it can live
 * in shared/ui; the slots let widget-layer features — gestures, up-next,
 * lock — mount inside the player without this component knowing about them.
 */
export function KidVideoPlayer({
  videoId,
  title,
  posterUrl,
  autoPlay = false,
  startMuted,
  startTime = 0,
  labels: labelOverrides,
  className = "",
  overlaySlot,
  controlsStartSlot,
  controlsEndSlot,
  onEnded,
  onPlayingChange,
  onTimeUpdate,
  onDurationChange,
  onError,
  onFullscreenChange,
  onNextVideo,
  onPreviousVideo,
  nextVideoPreview,
  previousVideoPreview,
}: {
  videoId: string;
  title: string;
  posterUrl?: string;
  autoPlay?: boolean;
  /**
   * Forces how the embed is built, overriding what this tab has learned about
   * whether the browser hands out sound unprompted. Left alone, videos open
   * with sound wherever that is allowed — see `SoundPreference`.
   *
   * Carried into the embed URL before load, because that is the only place it
   * counts. Every command reaches the frame by postMessage, and user
   * activation does not cross a document boundary, so `unMute` sent afterwards
   * is something WebKit drops without a word.
   */
  startMuted?: boolean;
  /** Seconds to open at; the video resumes there once it can play. */
  startTime?: number;
  labels?: Partial<KidVideoPlayerLabels>;
  className?: string;
  /** Rendered above the shield and title cover, below the controls. */
  overlaySlot?: ReactNode;
  /** Leading edge of the control bar. */
  controlsStartSlot?: ReactNode;
  /** Trailing edge of the control bar, before the fullscreen button. */
  controlsEndSlot?: ReactNode;
  onEnded?: () => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentSeconds: number) => void;
  onDurationChange?: (seconds: number) => void;
  onError?: () => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /** When provided, a big side button on the right edge skips forward. */
  onNextVideo?: () => void;
  /** When provided, a big side button on the left edge skips back. */
  onPreviousVideo?: () => void;
  /** Card shown while hovering or focusing the next-video button. */
  nextVideoPreview?: KidVideoPlayerPreview;
  /** Card shown while hovering or focusing the previous-video button. */
  previousVideoPreview?: KidVideoPlayerPreview;
}) {
  const labels = { ...DEFAULT_KID_VIDEO_PLAYER_LABELS, ...labelOverrides };
  const playerRef = useRef<MediaPlayerInstance>(null);
  const [isLocked, setIsLocked] = useState(false);
  // Vidstack publishes `data-fullscreen` on its controls element, not on the
  // player, so the surface tracks the state itself to style its own edges.
  const [isFullscreen, setIsFullscreen] = useState(false);
  // iPhone has no element Fullscreen API and the YouTube provider brings no
  // fullscreen of its own, so there the button falls back to filling the
  // viewport with CSS instead of leaving a control that does nothing.
  const [isVirtualFullscreen, setIsVirtualFullscreen] = useState(false);

  useEffect(() => {
    if (!isVirtualFullscreen) {
      return;
    }

    const { body, documentElement } = document;
    const restore = {
      body: body.style.overflow,
      root: documentElement.style.overflow,
    };
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.overflow = restore.body;
      documentElement.style.overflow = restore.root;
    };
  }, [isVirtualFullscreen]);

  const setVirtualFullscreen = (isOn: boolean) => {
    setIsVirtualFullscreen(isOn);
    onFullscreenChange?.(isOn);
  };

  useEffect(() => {
    if (!isVirtualFullscreen) {
      return;
    }

    const leaveOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsVirtualFullscreen(false);
        onFullscreenChange?.(false);
      }
    };

    window.addEventListener("keydown", leaveOnEscape);
    return () => window.removeEventListener("keydown", leaveOnEscape);
  }, [isVirtualFullscreen, onFullscreenChange]);

  // A press anywhere off the player puts the controls away. Vidstack only
  // hides them on its own idle timer or on mouse-leave, so tapping the page
  // around the video used to leave the bar sitting over the picture. Captured
  // at the document so it runs before anything on the page can stop it, and
  // keyed to `pointerdown` so the bar is gone by the time the tap completes.
  useEffect(() => {
    const hideOnOutsidePress = (event: PointerEvent) => {
      const player = playerRef.current;
      const surface = player?.el;
      const target = event.target;

      if (!player || !surface || !(target instanceof Node)) {
        return;
      }

      if (!surface.contains(target)) {
        player.controls.hide(0, event);
      }
    };

    document.addEventListener("pointerdown", hideOnOutsidePress, true);
    return () =>
      document.removeEventListener("pointerdown", hideOnOutsidePress, true);
  }, []);
  const [isRepeatOn, setIsRepeatOn] = useState(false);
  const [seekHint, setSeekHint] = useState<"back" | "forward" | null>(null);
  const isRepeatOnRef = useRef(false);
  const hasResumedRef = useRef(false);
  /**
   * The video whose picture has been seen moving, which is what actually takes
   * the poster down. Held as an id rather than a flag so the next video starts
   * behind its own poster without anything having to reset this.
   *
   * Vidstack ties its own poster to the player's `started` state, and for the
   * YouTube provider `started` is set from exactly one place: a `playing`
   * notification. The provider withholds that notification whenever it decides
   * the embed began playing without being asked — its `#invalidPlay` guard,
   * which returns before the `switch` that would notify. That guard fires when
   * the embed reports playing while the provider still reads `paused` and has
   * no `playVideo` command outstanding, which is reachable here because the
   * resume seek goes out first: vidstack notifies `can-play`, we set
   * `currentTime` from that handler, and only several awaits later does its
   * autoplay issue `playVideo`. YouTube's `seekTo` starts a *cued* video, so
   * the embed can be playing before anything asked it to. The result is a
   * video playing underneath a poster that never lifts.
   *
   * Time reports reach the player down a separate path that the guard does not
   * gate, so progress keeps arriving even while the state machine is stuck.
   * One step forward of ordinary playback — not a seek — is therefore the
   * signal that there is a picture worth showing.
   */
  const soundPreference = useMemo(() => new SoundPreference(), []);
  /**
   * Bumped to build a fresh embed. The `mute` param is read once, when the
   * provider sets the iframe's `src` (vidstack `peek`s `buildParams`, so
   * changing `muted` afterwards never re-navigates the frame), which makes a
   * remount the only way to change how a video's audio starts.
   */
  const [embedGeneration, setEmbedGeneration] = useState(0);
  const [isMuted, setIsMuted] = useState(
    () => startMuted ?? soundPreference.shouldStartMuted(),
  );
  // How the embed on screen was built, which decides whether sound can be
  // asked for with a command or has to be paid for with a rebuild.
  const bornMutedRef = useRef(isMuted);
  const probeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Where a rebuild has to pick the video back up, so changing the audio does
   * not cost the viewer their place. Tagged with the embed it was captured
   * for, so a position taken from one video can never follow them to the next.
   */
  const [soundResume, setSoundResume] = useState<{
    embedKey: string;
    atSeconds: number;
  } | null>(null);
  /**
   * The embed whose picture has been seen moving, which is what actually takes
   * the poster down. Held as an id rather than a flag so the next video — or
   * the next rebuild of this one — starts behind its own poster without
   * anything having to reset it.
   *
   * Vidstack ties its own poster to the player's `started` state, and for the
   * YouTube provider `started` is set from exactly one place: a `playing`
   * notification. The provider withholds that notification whenever it decides
   * the embed began playing without being asked — its `#invalidPlay` guard,
   * which returns before the `switch` that would notify. Time reports reach
   * the player down a separate path that the guard does not gate, so progress
   * keeps arriving even while the state machine is stuck. One step forward of
   * ordinary playback — not a seek — is therefore the signal that there is a
   * picture worth showing.
   */
  const [pictureEmbedKey, setPictureEmbedKey] = useState<string | null>(null);
  /**
   * One document per sound decision, not one per video. Remounting is what
   * asks for a new embed document, and a new document is a new audio unlock —
   * so a video change must not do it. Videos are swapped inside the surviving
   * document instead; see `keepEmbedDocumentAlive`.
   */
  const documentKey = `sound:${embedGeneration}`;
  // The poster and the resume still belong to a video, not to a document.
  const embedKey = `${videoId}:${embedGeneration}`;
  const hasPicture = pictureEmbedKey === embedKey;
  // A rebuilt embed has a place of its own to get back to, which outranks the
  // resume point the video was opened with.
  const effectiveStartTime =
    soundResume?.embedKey === embedKey ? soundResume.atSeconds : startTime;
  const lastTimeRef = useRef(-1);
  const lastTapRef = useRef({ at: 0, side: "" });
  const wereControlsUpRef = useRef(false);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A new embed — the next video, or this one rebuilt for sound — has to start
  // from a clean slate, including the resume guard, which would otherwise let
  // only the first video of a session resume. The poster needs no reset:
  // `hasPicture` names the embed it belongs to, so a new key is already a
  // poster that has not been lifted yet.
  useEffect(() => {
    hasResumedRef.current = false;
    lastTimeRef.current = -1;
  }, [embedKey]);

  useEffect(
    () => () => {
      // Both timers outlive a fast unmount — a tap right before navigating
      // away would otherwise fire into a torn-down player.
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
      if (probeTimerRef.current) {
        clearTimeout(probeTimerRef.current);
      }
    },
    [],
  );

  /**
   * Builds this video's embed again from scratch, muted or not, and picks the
   * playback back up where it stood. The `src` a live iframe already has is
   * fixed — `mute` is baked into it — so a change of heart about audio costs a
   * new frame, which is what the remount key buys.
   */
  const rebuildEmbed = (shouldBeMuted: boolean) => {
    const reachedSeconds = playerRef.current?.currentTime ?? 0;
    setSoundResume({
      embedKey: `${videoId}:${embedGeneration + 1}`,
      atSeconds:
        Number.isFinite(reachedSeconds) && reachedSeconds > 0
          ? reachedSeconds
          : effectiveStartTime,
    });
    bornMutedRef.current = shouldBeMuted;
    setIsMuted(shouldBeMuted);
    setEmbedGeneration((generation) => generation + 1);
  };

  const stopProbe = () => {
    if (probeTimerRef.current) {
      clearTimeout(probeTimerRef.current);
      probeTimerRef.current = null;
    }
  };

  /**
   * The net under an embed built with sound.
   *
   * Only a tab that has already been granted sound builds one, so this is not
   * asking whether sound is allowed — it is catching the case where the answer
   * changed. A refusal never announces itself: the frame drops `playVideo` and
   * sits at its first frame saying nothing, and because user activation does
   * not cross into it, every later press of play is refused the same way. Left
   * alone that is not a silent video but a dead one.
   *
   * So silence past the deadline is read as a refusal, the video is rebuilt
   * muted — which starts everywhere — and the tab goes back to opening muted.
   * Vidstack reports `play` as soon as the embed so much as starts buffering,
   * so a slow connection settles this long before the deadline; only a frame
   * that says nothing at all trips it.
   */
  const startSoundProbe = () => {
    // Silence only means refusal when something asked the video to play.
    // Without autoplay it means nobody has pressed play yet.
    if (!autoPlay || bornMutedRef.current || probeTimerRef.current) {
      return;
    }

    probeTimerRef.current = setTimeout(() => {
      probeTimerRef.current = null;
      tracePlayer("sound-probe:refused");
      soundPreference.save("refused");
      rebuildEmbed(true);
    }, SOUND_PROBE_MS);
  };

  const settleProbeAsGranted = () => {
    if (bornMutedRef.current) {
      return;
    }
    const wasWaiting = probeTimerRef.current !== null;
    stopProbe();
    if (wasWaiting) {
      tracePlayer("sound-probe:granted");
      soundPreference.save("granted");
    }
  };

  /**
   * The viewer asking for sound. A command is enough when the frame was born
   * unmuted and has already been allowed to make noise; when it was born muted
   * only a new frame will do, and building it from inside their tap is what
   * keeps the navigation privileged enough for WebKit to allow it.
   */
  const requestSound = () => {
    soundPreference.save("granted");
    stopProbe();

    if (bornMutedRef.current) {
      rebuildEmbed(false);
      return;
    }

    setIsMuted(false);
  };

  /** The viewer muting on purpose, which outranks opening with sound. */
  const silence = () => {
    soundPreference.save("silenced");
    stopProbe();
    setIsMuted(true);
  };

  /**
   * Puts the viewer back where they left this video, but never ahead of a play
   * request.
   *
   * The order matters more than the timing. YouTube's `seekTo` starts a *cued*
   * video, and vidstack's YouTube provider reads an embed that starts playing
   * with no `playVideo` of its own outstanding as YouTube having gone rogue:
   * it silently force-mutes, pauses the video a beat later, and skips the
   * `playing` notification that would have told the player it had started —
   * which is what used to leave the poster sitting over a playing video. The
   * seek used to go out from `can-play`, and vidstack's autoplay only sends
   * `playVideo` several awaits after that, so the resume was landing squarely
   * inside that window. With a play request already in flight the same seek is
   * unremarkable.
   *
   * Guarded by a ref because both callers can fire more than once — a stall
   * that recovers re-fires `can-play`, and every unpause fires `play` — and a
   * second seek would yank the viewer backwards.
   *
   * @param shouldRequestPlay Whether to put a play request in flight first.
   * Only the `can-play` caller needs it: arriving by `play` means one is
   * already outstanding. A video with nothing to resume asks for nothing
   * either, so autoplay stays entirely vidstack's business as before.
   */
  const resumeWhereLeftOff = (shouldRequestPlay: boolean) => {
    const player = playerRef.current;
    if (!player || effectiveStartTime <= 0 || hasResumedRef.current) {
      return;
    }
    hasResumedRef.current = true;
    if (shouldRequestPlay) {
      player.play().catch(() => {});
    }
    player.currentTime = effectiveStartTime;
  };

  const seekBy = (offsetSeconds: number) => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    const duration = player.duration;
    const target = player.currentTime + offsetSeconds;
    player.currentTime = Math.max(
      0,
      Number.isFinite(duration) && duration > 0 ? Math.min(target, duration) : target,
    );

    setSeekHint(offsetSeconds < 0 ? "back" : "forward");
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }
    hintTimerRef.current = setTimeout(() => setSeekHint(null), SEEK_HINT_MS);
  };

  /**
   * Whether the control bar was already up when the finger went down — which
   * is not a thing the tap handler can ask afterwards. While the video plays,
   * vidstack's own controls manager reveals the bar on the `touchend` of every
   * tap, from a listener on the player element; that element sits inside the
   * React root, so its listener runs before this component's handler up there,
   * let alone before the single tap's deferred action 280ms later. By then
   * `controls.showing` reads `true` for a bar that this very tap raised, and a
   * tap meant to bring the controls back paused the video instead.
   */
  const rememberControlsState = () => {
    wereControlsUpRef.current = playerRef.current?.controls.showing ?? false;
  };

  /**
   * One tap plays or pauses; two taps on the same half jump ±15 seconds.
   * The single tap has to wait out the double-tap window before it acts,
   * otherwise the first of a pair would toggle playback on the way to the
   * seek. Only touch pays that wait — a mouse has the ±15 buttons and the
   * arrow keys, so its click stays instant.
   */
  const handleSurfaceTap = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked) {
      return;
    }

    const player = playerRef.current;
    if (!player) {
      return;
    }

    const isTouch = event.pointerType !== "mouse";
    const bounds = event.currentTarget.getBoundingClientRect();
    const side =
      event.clientX - bounds.left < bounds.width / 2 ? "back" : "forward";

    const togglePlayback = () => {
      // A paused video always starts, whether the bar is up or not. Spending
      // the tap on revealing the controls instead would leave a child looking
      // at a still picture and a play button they have to find and hit a
      // second time.
      //
      // The bar is raised as well, not instead. Vidstack raises it on `play`,
      // which is enough right up until the embed does not send one: a request
      // it refuses or cannot serve is answered with silence, and a tap that
      // neither starts the video nor brings up a control leaves the viewer
      // with a still picture and nothing to press. Playback hides the bar
      // again on its own, so this costs nothing when the video does start.
      if (player.paused) {
        player.controls.show();
        player.play().catch(() => {});
        return;
      }
      if (isTouch && !wereControlsUpRef.current) {
        // Touch has no hover, so a tap on a running video is the only way the
        // bar comes back; pausing would cost the picture to get it. Showing it
        // again here is not redundant — vidstack raised it on `touchend` with
        // its idle countdown already running, and this restarts that.
        player.controls.show();
        return;
      }
      player.pause().catch(() => {});
    };

    if (!isTouch) {
      togglePlayback();
      return;
    }

    const now = event.timeStamp;
    const previous = lastTapRef.current;
    const isDoubleTap =
      previous.side === side && now - previous.at < DOUBLE_TAP_WINDOW_MS;

    if (isDoubleTap) {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapRef.current = { at: 0, side: "" };
      seekBy(side === "back" ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS);
      return;
    }

    lastTapRef.current = { at: now, side };
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      togglePlayback();
    }, DOUBLE_TAP_WINDOW_MS);
  };

  const toggleRepeat = () => {
    setIsRepeatOn((wasOn) => {
      isRepeatOnRef.current = !wasOn;
      return !wasOn;
    });
  };

  return (
    <MediaPlayer
      ref={playerRef}
      className={`${styles.playerBox} ${
        isFullscreen || isVirtualFullscreen ? styles.isFullscreen : ""
      } ${
        isVirtualFullscreen ? styles.virtualFullscreen : ""
      } ${className}`.trim()}
      key={documentKey}
      src={`youtube/${videoId}`}
      title={title}
      aria-label={labels.surface}
      // Stated up front rather than inferred once metadata lands, so the
      // surface is laid out as on-demand video from the first frame.
      viewType="video"
      streamType="on-demand"
      autoPlay={autoPlay}
      muted={isMuted}
      playsInline
      load="eager"
      keyDisabled={isLocked}
      onProviderChange={(provider) => {
        hardenYouTubeEmbed(provider);
        preventOrphanedCommandPromises(provider);
        letTheEmbedStartItself(provider, autoPlay);
        keepEmbedDocumentAlive(provider);
      }}
      onCanPlay={() => {
        tracePlayer(`can-play:resume=${effectiveStartTime}:muted=${isMuted}`);
        startSoundProbe();
        // Without autoplay there is no play request to hide the seek behind
        // and no reason to make one, so the resume waits for the viewer's own
        // press — `onPlay` picks it up there.
        if (autoPlay) {
          resumeWhereLeftOff(true);
        }
      }}
      onPlay={() => {
        // The embed accepted the play request, so whatever audio it was built
        // with is audio this browser allows.
        settleProbeAsGranted();
        resumeWhereLeftOff(false);
        onPlayingChange?.(true);
      }}
      onPause={() => onPlayingChange?.(false)}
      onEnded={() => {
        if (isRepeatOnRef.current) {
          const player = playerRef.current;
          if (player) {
            player.currentTime = 0;
            player.play().catch(() => {});
          }
          return;
        }
        onPlayingChange?.(false);
        onEnded?.();
      }}
      onTimeUpdate={({ currentTime }) => {
        // A step forward small enough to be playback rather than a jump. A
        // seek lands anywhere, including backwards, and a paused embed repeats
        // the same second — neither is a picture.
        // A video swapped into a living document reports no `can-play`, so
        // this is where its resume gets picked up. Progress means the embed is
        // already playing, which is the condition the seek needs anyway.
        resumeWhereLeftOff(false);
        const previous = lastTimeRef.current;
        lastTimeRef.current = currentTime;
        const step = currentTime - previous;
        if (previous >= 0 && step > 0 && step < 2 && !hasPicture) {
          tracePlayer(`picture-at:${currentTime.toFixed(2)}`);
          settleProbeAsGranted();
          setPictureEmbedKey(embedKey);
        }
        onTimeUpdate?.(currentTime);
      }}
      onDurationChange={(seconds) => {
        if (Number.isFinite(seconds) && seconds > 0) {
          onDurationChange?.(seconds);
        }
      }}
      onError={() => onError?.()}
      onFullscreenChange={(isNowFullscreen) => {
        setIsFullscreen(isNowFullscreen);
        onFullscreenChange?.(isNowFullscreen);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <MediaProvider />
      <Poster
        className={`${styles.poster} ${hasPicture ? styles.posterGone : ""}`.trim()}
        src={posterUrl}
        alt=""
      />
      {/*
       * Covers the embed so no click ever reaches YouTube's own surface, and
       * doubles as the tap target: anywhere on the picture starts or stops
       * playback, which is the gesture a child reaches for first. The lock
       * takes that away along with the rest of the controls. Vidstack's
       * <Gesture> would be the stock answer, but it listens on the provider
       * element underneath this layer, so it never sees the click.
       */}
      <div
        className={styles.shield}
        aria-hidden="true"
        onPointerDown={rememberControlsState}
        onPointerUp={handleSurfaceTap}
      />
      {seekHint ? (
        <div
          className={`${styles.seekHint} ${
            seekHint === "back" ? styles.seekHintBack : styles.seekHintForward
          }`}
          aria-hidden="true"
        >
          {seekHint === "back"
            ? `−${SEEK_STEP_SECONDS}`
            : `+${SEEK_STEP_SECONDS}`}
        </div>
      ) : null}
      <div className={styles.titleCover} aria-hidden="true" />
      {overlaySlot ? <div className={styles.overlay}>{overlaySlot}</div> : null}
      {isLocked ? null : (
        <PlayerControlBar
          isRepeatOn={isRepeatOn}
          labels={labels}
          onRequestSound={requestSound}
          onSilence={silence}
          controlsStartSlot={controlsStartSlot}
          controlsEndSlot={controlsEndSlot}
          onToggleRepeat={toggleRepeat}
          isVirtualFullscreen={isVirtualFullscreen}
          onToggleVirtualFullscreen={() =>
            setVirtualFullscreen(!isVirtualFullscreen)
          }
          onNextVideo={onNextVideo}
          onPreviousVideo={onPreviousVideo}
          nextVideoPreview={nextVideoPreview}
          previousVideoPreview={previousVideoPreview}
        />
      )}
      {isLocked ? null : (
        <UnmuteButton label={labels.unmute} onRequestSound={requestSound} />
      )}
      <button
        type="button"
        className={`${styles.lockButton} ${styles.tooltipStart} ${
          isLocked ? styles.lockButtonLocked : ""
        }`.trim()}
        aria-label={isLocked ? labels.unlockControls : labels.lockControls}
        aria-pressed={isLocked}
        data-tooltip={isLocked ? labels.unlockControls : labels.lockControls}
        onClick={() => setIsLocked((wasLocked) => !wasLocked)}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        {isLocked ? <Lock size={22} /> : <Unlock size={22} />}
      </button>
    </MediaPlayer>
  );
}

/**
 * Separate component so the per-frame media state subscriptions re-render the
 * control bar alone, not the whole player tree.
 */
function PlayerControlBar({
  isRepeatOn,
  labels,
  controlsStartSlot,
  controlsEndSlot,
  onToggleRepeat,
  onNextVideo,
  onPreviousVideo,
  onRequestSound,
  onSilence,
  nextVideoPreview,
  previousVideoPreview,
  isVirtualFullscreen,
  onToggleVirtualFullscreen,
}: {
  isRepeatOn: boolean;
  labels: KidVideoPlayerLabels;
  /** Asks for sound the way this embed allows — see `requestSound`. */
  onRequestSound: () => void;
  onSilence: () => void;
  controlsStartSlot?: ReactNode;
  controlsEndSlot?: ReactNode;
  onToggleRepeat: () => void;
  onNextVideo?: () => void;
  onPreviousVideo?: () => void;
  nextVideoPreview?: KidVideoPlayerPreview;
  previousVideoPreview?: KidVideoPlayerPreview;
  isVirtualFullscreen: boolean;
  onToggleVirtualFullscreen: () => void;
}) {
  const isPaused = useMediaState("paused");
  const isMuted = useMediaState("muted");
  const isNativeFullscreen = useMediaState("fullscreen");
  const canNativeFullscreen = useMediaState("canFullscreen");
  const remote = useMediaRemote();
  const isFullscreen = canNativeFullscreen
    ? isNativeFullscreen
    : isVirtualFullscreen;

  return (
    <Controls.Root className={styles.controls}>
      {onPreviousVideo ? (
        <SideNavButton
          direction="left"
          label={labels.previousVideo}
          preview={previousVideoPreview}
          onClick={onPreviousVideo}
        />
      ) : null}
      {onNextVideo ? (
        <SideNavButton
          direction="right"
          label={labels.nextVideo}
          preview={nextVideoPreview}
          onClick={onNextVideo}
        />
      ) : null}
      <PlayButton
        className={`${styles.bigPlayButton} ${
          isPaused ? "" : styles.bigPlayButtonHidden
        }`.trim()}
        aria-label={labels.play}
        tabIndex={isPaused ? 0 : -1}
      >
        <Play size={34} />
      </PlayButton>
      <Controls.Group className={styles.controlsRow}>
        <TimeSlider.Root
          className={`${styles.slider} ${styles.timeSlider}`}
          aria-label={labels.seek}
          /*
           * The player forwards ArrowLeft/ArrowRight to whichever time slider
           * it finds rather than seeking itself, so this is what sets the
           * arrow keys' jump — a default of one second, otherwise.
           */
          keyStep={SEEK_STEP_SECONDS}
          shiftKeyMultiplier={1}
        >
          <TimeSlider.Track className={styles.sliderTrack} />
          <TimeSlider.Progress className={styles.sliderBuffered} />
          <TimeSlider.TrackFill className={styles.sliderFill} />
          <TimeSlider.Thumb className={styles.sliderThumb} />
        </TimeSlider.Root>
      </Controls.Group>
      <Controls.Group className={styles.controlsRow}>
        {controlsStartSlot}
        {onPreviousVideo ? (
          <button
            type="button"
            className={`${styles.controlButton} ${styles.tooltipStart} ${styles.wideOnly}`}
            aria-label={labels.previousVideo}
            data-tooltip={labels.previousVideo}
            onClick={onPreviousVideo}
          >
            <SkipBack size={20} />
          </button>
        ) : null}
        <PlayButton
          className={styles.controlButton}
          aria-label={isPaused ? labels.play : labels.pause}
          data-tooltip={isPaused ? labels.play : labels.pause}
        >
          {isPaused ? <Play size={20} /> : <Pause size={20} />}
        </PlayButton>
        {onNextVideo ? (
          <button
            type="button"
            className={`${styles.controlButton} ${styles.wideOnly}`}
            aria-label={labels.nextVideo}
            data-tooltip={labels.nextVideo}
            onClick={onNextVideo}
          >
            <SkipForward size={20} />
          </button>
        ) : null}
        <SeekButton
          className={`${styles.controlButton} ${styles.seekStepButton} ${styles.wideOnly}`}
          seconds={-SEEK_STEP_SECONDS}
          aria-label={labels.back15}
          data-tooltip={labels.back15}
        >
          −15
        </SeekButton>
        <SeekButton
          className={`${styles.controlButton} ${styles.seekStepButton} ${styles.wideOnly}`}
          seconds={SEEK_STEP_SECONDS}
          aria-label={labels.forward15}
          data-tooltip={labels.forward15}
        >
          +15
        </SeekButton>
        {/*
         * Not vidstack's MuteButton: its unmute is a `unMute` postMessage,
         * which WebKit drops on the floor when the frame was built muted. This
         * routes through the player's own handler, which knows when sound
         * costs a rebuild instead.
         */}
        <button
          type="button"
          className={styles.controlButton}
          aria-label={isMuted ? labels.unmute : labels.mute}
          data-tooltip={isMuted ? labels.unmute : labels.mute}
          onClick={() => (isMuted ? onRequestSound() : onSilence())}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <VolumeSlider.Root
          className={`${styles.slider} ${styles.volumeSlider} ${styles.wideOnly}`}
        >
          <VolumeSlider.Track className={styles.sliderTrack} />
          <VolumeSlider.TrackFill className={styles.sliderFill} />
          <VolumeSlider.Thumb className={styles.sliderThumb} />
        </VolumeSlider.Root>
        <span className={styles.timeLabel}>
          <Time type="current" />
          {"/"}
          <Time type="duration" />
        </span>
        <span className={styles.spacer} />
        <button
          type="button"
          className={`${styles.controlButton} ${styles.wideOnly}`}
          aria-label={isRepeatOn ? labels.repeatOn : labels.repeatOff}
          aria-pressed={isRepeatOn}
          data-tooltip={isRepeatOn ? labels.repeatOn : labels.repeatOff}
          onClick={onToggleRepeat}
        >
          <Repeat1 size={20} />
        </button>
        {controlsEndSlot}
        {/*
         * Not vidstack's FullscreenButton: it can only drive the real API,
         * which iPhone does not have, so there it would render a control that
         * silently does nothing. This picks the mechanism that exists.
         */}
        <button
          type="button"
          className={`${styles.controlButton} ${styles.tooltipEnd}`}
          aria-label={
            isFullscreen ? labels.exitFullscreen : labels.enterFullscreen
          }
          aria-pressed={isFullscreen}
          data-tooltip={
            isFullscreen ? labels.exitFullscreen : labels.enterFullscreen
          }
          onClick={(event) => {
            if (canNativeFullscreen) {
              remote.toggleFullscreen("prefer-media", event.nativeEvent);
              return;
            }
            onToggleVirtualFullscreen();
          }}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </Controls.Group>
    </Controls.Root>
  );
}

/**
 * Sound, in the corner opposite the lock, wearing the play button's colour.
 * It sits outside the control layer because the bar spends most of its time
 * hidden — on a phone, nearly all of it — and turning sound on should not
 * depend on bringing the bar back first.
 *
 * One direction only: it appears while the video is silent, where it reads as
 * an offer to turn sound on — the case iOS forces by refusing to autoplay with
 * sound — and leaves the corner entirely once sound is on. Going back to
 * silence is the control bar's mute button's job, so this stays a single
 * unambiguous "I want sound" target rather than a toggle a child can flip.
 */
function UnmuteButton({
  label,
  onRequestSound,
}: {
  label: string;
  onRequestSound: () => void;
}) {
  const isMuted = useMediaState("muted");

  if (!isMuted) {
    return null;
  }

  return (
    <button
      type="button"
      className={styles.soundButton}
      aria-label={label}
      data-tooltip={label}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={onRequestSound}
    >
      <VolumeX size={26} />
    </button>
  );
}

/**
 * Edge button for previous/next. When a preview is given, hovering or
 * focusing the button reveals a thumbnail card of where it leads — the
 * tooltip is skipped then, since the card already says it.
 */
function SideNavButton({
  direction,
  label,
  preview,
  onClick,
}: {
  direction: "left" | "right";
  label: string;
  preview?: KidVideoPlayerPreview;
  onClick: () => void;
}) {
  const sideClass =
    direction === "left" ? styles.sideNavLeft : styles.sideNavRight;

  return (
    <div className={`${styles.sideNav} ${sideClass}`}>
      <button
        type="button"
        className={styles.sideButton}
        aria-label={label}
        data-tooltip={preview ? undefined : label}
        onClick={onClick}
      >
        {direction === "left" ? <SkipBack size={26} /> : <SkipForward size={26} />}
      </button>
      {preview ? (
        <div className={styles.previewCard} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.previewThumb}
            src={preview.thumbnailUrl}
            alt=""
            loading="lazy"
          />
          <div className={styles.previewTitle}>{preview.title}</div>
          {preview.subtitle ? (
            <div className={styles.previewSubtitle}>{preview.subtitle}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
