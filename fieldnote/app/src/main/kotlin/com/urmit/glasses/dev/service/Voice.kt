package com.urmit.glasses.dev.service

import android.content.Context
import android.content.Intent
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.Locale
import kotlin.coroutines.resume

class VoiceError(msg: String) : Exception(msg)

/** Tap-to-talk. Glasses microphone (HFP) when available, phone microphone otherwise; the route used is always reported. */
class Voice(private val ctx: Context) {
    private val am = ctx.getSystemService(AudioManager::class.java)

    private val headsetTypes = setOf(AudioDeviceInfo.TYPE_BLUETOOTH_SCO, AudioDeviceInfo.TYPE_BLE_HEADSET)
    private fun scoDevice(): AudioDeviceInfo? = am.availableCommunicationDevices.firstOrNull { it.type in headsetTypes }

    /** True when a Bluetooth headset-profile mic (the glasses) is available. */
    val glassesMicAvailable: Boolean get() = scoDevice() != null

    /** Which microphone the last listen actually used. */
    @Volatile var lastRoute: String = "none"

    /**
     * Listens for one utterance. Prefers the glasses microphone (Bluetooth headset link); if the glasses are not connected
     * as a headset, or the link does not come up in time, it listens on the phone instead of failing, so a triple-tap
     * always does something. The route used is recorded in [lastRoute] and telemetry.
     */
    suspend fun listenOnce(maxMs: Long = 8_000, glassesFirst: Boolean = true): String {
        val dev = if (glassesFirst) scoDevice() else null
        var route = "phone"
        if (dev != null && runCatching { am.setCommunicationDevice(dev) }.getOrDefault(false)) {
            // The headset link can take a couple of seconds on Android 15; poll rather than check once.
            var routed = false
            withContext(Dispatchers.IO) { repeat(15) { if (!routed) { routed = am.communicationDevice?.type in headsetTypes; if (!routed) Thread.sleep(200) } } }
            if (routed) route = "glasses" else runCatching { am.clearCommunicationDevice() }
        }
        lastRoute = route
        try {
            return withTimeoutOrNull(maxMs + 4_000) { recognise() } ?: throw VoiceError("I didn't catch that. Tap three times and try again.")
        } finally {
            if (route == "glasses") runCatching { am.clearCommunicationDevice() }
        }
    }

    private suspend fun recognise(): String = withContext(Dispatchers.Main) {
        if (!SpeechRecognizer.isRecognitionAvailable(ctx)) throw VoiceError("This phone has no speech recogniser. Install the Google app.")
        suspendCancellableCoroutine { cont ->
            val sr = SpeechRecognizer.createSpeechRecognizer(ctx)
            fun finish(r: Result<String>) { if (cont.isActive) { runCatching { sr.destroy() }; cont.resume(r.getOrElse { throw it }) } }
            sr.setRecognitionListener(object : RecognitionListener {
                override fun onResults(results: Bundle?) {
                    val s = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                    if (s.isBlank()) finishSafe(Result.failure(VoiceError("I didn't catch that. Try again."))) else finishSafe(Result.success(s))
                }
                override fun onError(error: Int) {
                    val msg = when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "I didn't catch that. Try again."
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is missing. Allow it in the app."
                        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Speech needs the internet. Check your connection."
                        SpeechRecognizer.ERROR_AUDIO -> "The microphone is busy. Try again in a second."
                        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Still listening to the last one. Try again."
                        else -> "Speech didn't work (code $error). Try again."
                    }
                    finishSafe(Result.failure(VoiceError(msg)))
                }
                private fun finishSafe(r: Result<String>) { if (cont.isActive) { runCatching { sr.destroy() }; r.fold({ cont.resume(it) }, { cont.resumeWith(Result.failure(it)) }) } }
                override fun onReadyForSpeech(p: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(v: Float) {}
                override fun onBufferReceived(b: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onPartialResults(p: Bundle?) {}
                override fun onEvent(t: Int, p: Bundle?) {}
            })
            val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false)
                .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
                .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
            sr.startListening(i)
            // Cancellation (the listen timeout) arrives off the main thread, where SpeechRecognizer throws; clean up on main.
            cont.invokeOnCancellation { android.os.Handler(android.os.Looper.getMainLooper()).post { runCatching { sr.cancel() }; runCatching { sr.destroy() } } }
        }
    }
}

/** Spoken answers and short state tones (build brief §4.7 / §5.6). */
class Speaker(ctx: Context) {
    @Volatile private var ready = false
    private lateinit var tts: TextToSpeech
    /** Callbacks by utterance id, so a new say() can't orphan the previous caller, and every outcome completes one. */
    private val pending = java.util.concurrent.ConcurrentHashMap<String, () -> Unit>()
    /** Said before the engine finished starting (the first spoken chat reply after launch); spoken once it is up. */
    @Volatile private var early: Pair<String, (() -> Unit)?>? = null
    /** Init has reported, successfully or not: after a failed init, say() completes at once instead of parking the caller. */
    @Volatile private var initDone = false
    init {
        tts = TextToSpeech(ctx) { status ->
            val waiting = synchronized(this) {
                ready = status == TextToSpeech.SUCCESS; initDone = true
                early.also { early = null }
            }
            if (ready) runCatching { tts.language = Locale("en", "IN") }
            waiting?.let { (t, d) -> if (ready) say(t, d) else d?.invoke() }
        }
    }
    private val tones = runCatching { ToneGenerator(AudioManager.STREAM_MUSIC, 80) }.getOrNull()

    init {
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String?) {}
            override fun onDone(id: String?) { finish(id) }
            @Deprecated("") override fun onError(id: String?) { finish(id) }
            override fun onError(id: String?, errorCode: Int) { finish(id) }
            // Flushed by a newer utterance or stop(): Android calls onStop, not onDone.
            override fun onStop(id: String?, interrupted: Boolean) { finish(id) }
        })
    }

    private fun finish(id: String?) { id?.let { pending.remove(it)?.invoke() } }

    enum class Tone { ARMED, CAPTURED, LISTENING, ANALYSING, FAILED, DISARMED }

    /** Each state can be told apart with eyes closed. All under 300 ms. Never throws (the generator may be released). */
    fun tone(t: Tone) {
        val g = tones ?: return
        runCatching {
            when (t) {
                Tone.ARMED -> g.startTone(ToneGenerator.TONE_PROP_ACK, 150)          // rising double
                Tone.CAPTURED -> g.startTone(ToneGenerator.TONE_PROP_BEEP, 120)      // single short
                Tone.LISTENING -> g.startTone(ToneGenerator.TONE_PROP_BEEP2, 200)    // two quick
                Tone.ANALYSING -> g.startTone(ToneGenerator.TONE_CDMA_ALERT_NETWORK_LITE, 250)
                Tone.FAILED -> g.startTone(ToneGenerator.TONE_PROP_NACK, 250)        // low buzz
                Tone.DISARMED -> g.startTone(ToneGenerator.TONE_CDMA_ABBR_ALERT, 200)
            }
        }
    }

    fun say(text: String, done: (() -> Unit)? = null) {
        val held = synchronized(this) {
            if (ready) null
            else if (initDone) done ?: {}                       // no engine: nothing will ever speak; don't make anyone wait
            else { val prev = early?.second; early = text to done; prev ?: {} }
        }
        if (held != null) { held(); return }
        val id = java.util.UUID.randomUUID().toString()
        done?.let { pending[id] = it }
        val r = runCatching { tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) }.getOrDefault(TextToSpeech.ERROR)
        // ERROR comes with no callback at all (engine died or is rebinding): complete now rather than never.
        if (r != TextToSpeech.SUCCESS) pending.remove(id)?.invoke()
    }

    fun stop() { runCatching { tts.stop() } }
    val speaking: Boolean get() = runCatching { tts.isSpeaking }.getOrDefault(false)
    fun shutdown() {
        runCatching { tts.shutdown() }; runCatching { tones?.release() }
        pending.keys.toList().forEach { finish(it) }; early?.second?.invoke(); early = null
    }
}
