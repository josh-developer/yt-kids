import AVFoundation
import ExpoModulesCore
import MediaPlayer

/**
 * Reads and writes the device's media volume, and puts the audio session into playback.
 *
 * Both halves exist because of iOS, not for symmetry with Android. WKWebView ignores an
 * HTML5 `volume` assignment — the property is read-only on iOS — so the player's volume
 * slider cannot work through the YouTube iframe API the way it does elsewhere. The
 * device volume is the only volume there is on this platform, so it is the one the
 * slider moves.
 *
 * `MPVolumeView`'s embedded `UISlider` is the long-standing way to set it: there is no
 * public setter on `AVAudioSession.outputVolume`. Adding the view to the window has the
 * side effect of suppressing the system volume HUD, which is what we want — the app
 * draws its own.
 */
public class SystemVolumeModule: Module {
  private var volumeView: MPVolumeView?
  private var observation: NSKeyValueObservation?

  public func definition() -> ModuleDefinition {
    Name("SystemVolume")

    Events("onVolumeChange")

    /**
     * `.playback` so a video keeps its sound with the ringer switch flipped to silent.
     * The default session category is silenced by that switch, which is one of the two
     * ways a video ends up mute on iOS through no fault of the player.
     */
    AsyncFunction("configureForPlayback") {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .moviePlayback, options: [])
      try session.setActive(true)
    }.runOnQueue(DispatchQueue.main)

    Function("getVolume") { () -> Double in
      Double(AVAudioSession.sharedInstance().outputVolume)
    }

    AsyncFunction("setVolume") { (volume: Double) in
      let clamped = Float(min(max(volume, 0), 1))
      guard let slider = self.systemVolumeSlider() else {
        return
      }

      slider.value = clamped
      // The assignment alone does not always reach the audio system; the action is what
      // makes it look like a real drag of the system slider.
      slider.sendActions(for: .touchUpInside)
    }.runOnQueue(DispatchQueue.main)

    OnStartObserving {
      let session = AVAudioSession.sharedInstance()
      self.observation = session.observe(\.outputVolume, options: [.new]) {
        [weak self] _, change in
        guard let volume = change.newValue else {
          return
        }

        self?.sendEvent("onVolumeChange", ["volume": Double(volume)])
      }
    }

    OnStopObserving {
      self.observation?.invalidate()
      self.observation = nil
    }

    OnDestroy {
      self.observation?.invalidate()
      self.observation = nil
      self.volumeView?.removeFromSuperview()
      self.volumeView = nil
    }
  }

  /** Off-screen and all but transparent: it is a control surface, not a visible one. */
  private func systemVolumeSlider() -> UISlider? {
    if volumeView == nil {
      let view = MPVolumeView(
        frame: CGRect(x: -2000, y: -2000, width: 120, height: 24))
      view.alpha = 0.0001
      view.isUserInteractionEnabled = false
      keyWindow()?.addSubview(view)
      volumeView = view
    }

    return volumeView?.subviews.compactMap { $0 as? UISlider }.first
  }

  private func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }
}
