package expo.modules.systemvolume

import android.content.Context
import android.database.ContentObserver
import android.media.AudioManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.roundToInt

/**
 * Reads and writes the media stream's volume, and reports changes made elsewhere.
 *
 * The counterpart of the iOS module, and the same contract: a 0-to-1 volume, the
 * device's own. Android's WebView would honour an HTML5 `volume` assignment, so this
 * platform could have had a player-local volume — but then the same slider would mean
 * two different things on the two platforms, and the hardware keys would agree with it
 * on only one of them.
 *
 * `configureForPlayback` is a no-op here. Android has no equivalent of the ringer switch
 * silencing app audio, and the media stream is already the right one.
 */
class SystemVolumeModule : Module() {
  private var observer: ContentObserver? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val audioManager: AudioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  override fun definition() = ModuleDefinition {
    Name("SystemVolume")

    Events("onVolumeChange")

    AsyncFunction("configureForPlayback") {
      // Nothing to do; see the note above.
    }

    Function("getVolume") {
      currentVolume()
    }

    AsyncFunction("setVolume") { volume: Double ->
      val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
      val level = (volume.coerceIn(0.0, 1.0) * max).roundToInt()
      // Flag 0: no system volume UI. The player draws the slider that caused this.
      audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, level, 0)
    }

    OnStartObserving {
      val handler = Handler(Looper.getMainLooper())
      val contentObserver = object : ContentObserver(handler) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
          sendEvent("onVolumeChange", mapOf("volume" to currentVolume()))
        }
      }

      context.contentResolver.registerContentObserver(
        Settings.System.CONTENT_URI,
        true,
        contentObserver,
      )
      observer = contentObserver
    }

    OnStopObserving {
      observer?.let { context.contentResolver.unregisterContentObserver(it) }
      observer = null
    }

    OnDestroy {
      observer?.let { context.contentResolver.unregisterContentObserver(it) }
      observer = null
    }
  }

  private fun currentVolume(): Double {
    val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
    if (max <= 0) {
      return 0.0
    }

    return audioManager.getStreamVolume(AudioManager.STREAM_MUSIC).toDouble() / max
  }
}
