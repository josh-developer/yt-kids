/**
 * The YouTube iframe API, as a small object we own.
 *
 * The embed is driven purely through `postMessage`, so every command is a
 * `{event: "command", func, args}` envelope. Wrapping it means callers say
 * `player.seekTo(30)` instead of hand-rolling that envelope seven times.
 */
export class PlayerController {
  constructor(
    private readonly frame: { current: HTMLIFrameElement | null },
  ) {}

  /** Opens the telemetry channel; the embed only replies after this. */
  listen(id: string) {
    this.post({ event: "listening", id });
  }

  play() {
    this.command("playVideo");
  }

  pause() {
    this.command("pauseVideo");
  }

  mute() {
    this.command("mute");
  }

  unMute() {
    this.command("unMute");
  }

  setVolume(volume: number) {
    this.command("setVolume", [volume]);
  }

  seekTo(seconds: number) {
    this.command("seekTo", [seconds, true]);
  }

  requestProgress() {
    this.command("getCurrentTime");
    this.command("getDuration");
  }

  /**
   * Captions live in a loadable module. The embed has answered to two names
   * for it across player versions, and asking for the wrong one is ignored
   * rather than an error, so both are sent.
   */
  setCaptions(areEnabled: boolean) {
    for (const name of ["captions", "cc"]) {
      this.command(areEnabled ? "loadModule" : "unloadModule", [name]);
    }
  }

  command(func: string, args: Array<boolean | number | string> = []) {
    this.post({ event: "command", func, args });
  }

  private post(message: object) {
    this.frame.current?.contentWindow?.postMessage(JSON.stringify(message), "*");
  }
}
