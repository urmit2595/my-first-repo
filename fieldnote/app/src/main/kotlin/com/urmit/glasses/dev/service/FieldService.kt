package com.urmit.glasses.dev.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import com.meta.wearable.dat.core.session.DeviceSessionState
import com.urmit.glasses.dev.MainActivity
import com.urmit.glasses.dev.R
import com.urmit.glasses.dev.data.Agent
import com.urmit.glasses.dev.data.AgentHands
import com.urmit.glasses.dev.data.AnalysisQueue
import com.urmit.glasses.dev.data.AnalysisState
import com.urmit.glasses.dev.data.ChatMessage
import com.urmit.glasses.dev.data.ChatRepo
import com.urmit.glasses.dev.data.Diagnostics
import com.urmit.glasses.dev.data.Locator
import com.urmit.glasses.dev.data.Media
import com.urmit.glasses.dev.data.Prefs
import com.urmit.glasses.dev.data.Repo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/**
 * One foreground service owns everything while armed (build brief §4). Screens only observe [Bus].
 * Triggers (tap, notification button, voice command, in-app button) enter one queue; one runs at a time.
 */
class FieldService : Service(), AgentHands {
    sealed class Trigger(val label: String) {
        object Capture : Trigger("capture")
        class CaptureAndAnalyse(val lensId: String, val question: String = "") : Trigger("capture+analyse")
        object Ask : Trigger("ask")
        class AnalyseLast(val lensId: String, val question: String = "") : Trigger("analyse-last")
        object More : Trigger("more")
        /** A spoken command heard in wake-word mode; routed through the queue like every other trigger. */
        class Command(val text: String) : Trigger("command")
        object Stop : Trigger("stop")
        object Disarm : Trigger("disarm")
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val queue = Channel<Trigger>(Channel.UNLIMITED)
    private lateinit var prefs: Prefs
    private lateinit var repo: Repo
    private lateinit var media: Media
    private lateinit var glasses: Glasses
    private lateinit var voice: Voice
    private lateinit var speaker: Speaker
    private lateinit var diag: Diagnostics
    private lateinit var travel: TravelSession
    private var mediaSession: MediaSessionCompat? = null
    private var silence: MediaPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var worker: Job? = null
    private var fullAnswer = ""
    private var spokenChars = 0
    private var lastKeyEventAt = 0L
    private var testAUntil = 0L
    private var stopSpeaking = false

    override fun onBind(intent: Intent?): IBinder? = null

    /* ---------------- what the orchestrator may do while a session runs ---------------- */
    override val sessionRunning: Boolean get() = Bus.state.value != SessionState.DISARMED
    override suspend fun takePhoto(sharp: Boolean): String {
        // Restore the caller's state: a voice turn (worker, ANALYSING) goes on thinking and handle() resets it afterwards;
        // a Chat turn runs outside the worker from STANDBY, and nothing else would bring it back there.
        val before = Bus.state.value
        try {
            return capture(analyseWith = null, silentAuto = true, quick = prefs.quickPhotos && !sharp) ?: throw com.urmit.glasses.dev.data.AnalystError(Bus.lastError.value.ifBlank { "The photo didn't work" })
        } finally {
            if (Bus.state.value != SessionState.DISARMED) { Bus.state.value = if (before == SessionState.STANDBY) SessionState.STANDBY else SessionState.ANALYSING; updateNotification() }
        }
    }
    override fun endSession() { enqueue(Trigger.Disarm) }

    override fun onCreate() {
        super.onCreate()
        Bus.lastError.value = ""
        prefs = Prefs.get(this); repo = Repo.get(this); media = Media(this)
        glasses = Glasses(this); voice = Voice(this); speaker = Speaker(this); diag = Diagnostics.get(this); travel = TravelSession(this, scope)
        glasses.onSessionState = { s ->
            // Hold on PAUSED, never restart while paused; STOPPED mid-capture is reported by the capture itself.
            if (s == DeviceSessionState.PAUSED && Bus.state.value == SessionState.CAPTURING) Bus.state.value = SessionState.HELD
        }
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CH, "Glasses session", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        // Microphone and location types are only allowed when started from the foreground with the permission granted (a
        // START_STICKY restart is not); fall back type by type, and say when voice is missing. Location is optional.
        val base = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK or ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
        val mic = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        val loc = if (Locator.permitted(this)) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
        val used = listOf(base or mic or loc, base or mic, base or loc, base).distinct().firstOrNull { t -> runCatching { startForeground(NID, notification(), t) }.isSuccess }
        if (used == null) {
            // Android refused every type, e.g. a START_STICKY restart while the app is in the background. Don't crash: say why.
            prefs.armedPersisted = false; Bus.state.value = SessionState.DISARMED
            Bus.lastError.value = "Android didn't let the session restart in the background. Open Fieldnote and start it again."
            diag.event("fgs_refused")
            stopSelf(); return
        }
        if (used and mic == 0) Bus.lastError.value = "Started without microphone access. Open the app and start the session again for voice."
        locationAllowed = loc != 0 && used and loc != 0
        fgsTypes = used
        arm()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACT_CAPTURE -> enqueue(Trigger.Capture)
            ACT_ASK -> enqueue(Trigger.Ask)
            ACT_END -> enqueue(Trigger.Disarm)
            ACT_ANALYSE -> enqueue(Trigger.CaptureAndAnalyse(intent.getStringExtra("lens") ?: prefs.doubleTapLens))
            ACT_ANALYSE_LAST -> enqueue(Trigger.AnalyseLast(intent.getStringExtra("lens") ?: prefs.doubleTapLens, intent.getStringExtra("q") ?: ""))
            ACT_TEST_A -> { testAUntil = System.currentTimeMillis() + 60_000; Bus.mediaEvents.value = emptyList(); Bus.toast.value = "Tap test running for 60 s: tap, double-tap and triple-tap the glasses" }
            ACT_TEST_B -> scope.launch { runTestB() }
            ACT_MODE -> setMode(if (intent.getStringExtra("mode") == "wake") Mode.WAKE_WORD else Mode.TAP)
            ACT_RELOAD -> glasses.warmMs = prefs.warmSeconds * 1000L
            ACT_LOCATION -> enableLocation()
        }
        return START_STICKY
    }

    /* ---------------- arming ---------------- */

    private fun arm() {
        prefs.armedPersisted = true
        Bus.armedSince.value = System.currentTimeMillis()
        Bus.state.value = SessionState.STANDBY
        // A wake-word loop cancelled with the last session never reset these, leaving every tap ignored in the next one.
        Bus.mode.value = Mode.TAP; Bus.wakeWordEndsAt.value = 0
        claimMediaButtons()
        wakeLock = getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "fieldnote:armed").apply { acquire() }
        glasses.warmMs = prefs.warmSeconds * 1000L
        // Nothing runs after Disarm: a tap queued behind it would reopen the glasses from a stopped service.
        worker = scope.launch { for (t in queue) { working = true; try { handle(t) } finally { working = false }; if (t is Trigger.Disarm) break } }
        Agent.get(this).hands = this
        travel.start(withLocation = locationAllowed)
        refreshChecks()
        speaker.tone(Speaker.Tone.ARMED)
        diag.event("armed", mapOf("checks_ok" to Bus.checks.value.all { it.second }, "mic" to voice.glassesMicAvailable, "registered" to glasses.registered))
        updateNotification()
    }

    private fun disarm() {
        prefs.armedPersisted = false
        Agent.get(this).hands = null
        travel.stop()
        glasses.release()
        speaker.stop()
        diag.event("disarmed", mapOf("armed_min" to ((System.currentTimeMillis() - Bus.armedSince.value) / 60000)))
        Bus.state.value = SessionState.DISARMED
        Bus.armedSince.value = 0
        Bus.mode.value = Mode.TAP; Bus.wakeWordEndsAt.value = 0
        wakeJob?.cancel()
        releaseMediaButtons()
        runCatching { wakeLock?.release() }
        speaker.tone(Speaker.Tone.DISARMED)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private var wakeJob: Job? = null

    private fun setMode(m: Mode) {
        Bus.mode.value = m
        if (m == Mode.WAKE_WORD) {
            Bus.wakeWordEndsAt.value = System.currentTimeMillis() + WAKE_WORD_MS
            wakeJob?.cancel()   // one loop only: two would run two recognisers and fight over the glasses' mic route
            wakeJob = scope.launch {
                // Wake-word mode is time-boxed. Recognition runs in listen windows rather than a true always-on engine:
                // the SDK offers no on-glasses wake word, and an always-open HFP mic costs battery and audio quality (brief §2.4).
                while (Bus.mode.value == Mode.WAKE_WORD && System.currentTimeMillis() < Bus.wakeWordEndsAt.value && Bus.state.value != SessionState.DISARMED) {
                    // Not while a command is still being handled: it would reopen the mic over the answer.
                    if (Bus.state.value == SessionState.STANDBY && !working && pendingCaptures == 0) {
                        val heard = runCatching { voice.listenOnce(6_000) }.getOrNull()?.lowercase() ?: ""
                        if (heard.contains("fieldnote") || heard.contains("field note")) {
                            val cmd = heard.substringAfter("note").trim()
                            // Through the queue, so the state returns to STANDBY afterwards and the loop listens again.
                            if (cmd.isNotBlank()) enqueue(Trigger.Command(cmd)) else enqueue(Trigger.Ask)
                        }
                    }
                    delay(500)
                }
                if (Bus.mode.value == Mode.WAKE_WORD) { Bus.mode.value = Mode.TAP; Bus.wakeWordEndsAt.value = 0; speaker.say("Wake word is off. Back to taps.") }
                updateNotification()
            }
        } else Bus.wakeWordEndsAt.value = 0
        updateNotification()
    }

    /* ---------------- media buttons (touchpad taps) ---------------- */

    private fun claimMediaButtons() {
        val ms = MediaSessionCompat(this, "Fieldnote").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() { onKey("play") }
                override fun onPause() { onKey("pause") }
                override fun onStop() { onKey("stop") }
                override fun onSkipToNext() { onKey("next") }
                override fun onSkipToPrevious() { onKey("previous") }
                override fun onMediaButtonEvent(i: Intent): Boolean {
                    val ev = i.getParcelableExtra<android.view.KeyEvent>(Intent.EXTRA_KEY_EVENT)
                    if (ev != null && ev.action == android.view.KeyEvent.ACTION_DOWN && ev.keyCode == android.view.KeyEvent.KEYCODE_HEADSETHOOK) { onKey("headsethook"); return true }
                    return super.onMediaButtonEvent(i)
                }
            })
            setPlaybackState(PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE or PlaybackStateCompat.ACTION_PLAY_PAUSE or PlaybackStateCompat.ACTION_SKIP_TO_NEXT or PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or PlaybackStateCompat.ACTION_STOP)
                .setState(PlaybackStateCompat.STATE_PLAYING, 0, 1f).build())
            isActive = true
        }
        mediaSession = ms
        // Play a looping silent clip so Android routes headset buttons here (brief §4.4). Volume 0, music stream.
        silence = runCatching {
            MediaPlayer.create(this, R.raw.silence).apply {
                setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                isLooping = true; setVolume(0f, 0f); start()
            }
        }.getOrNull()
    }

    private fun releaseMediaButtons() {
        runCatching { silence?.stop(); silence?.release() }; silence = null
        runCatching { mediaSession?.isActive = false; mediaSession?.release() }; mediaSession = null
    }

    /** play/pause/toggle/headsethook = tap; next = double-tap; previous = triple-tap (brief §6). */
    private fun onKey(name: String) {
        val now = System.currentTimeMillis()
        if (now - lastKeyEventAt < 250) return   // de-bounce duplicate key down/up deliveries
        lastKeyEventAt = now
        diag.event("media_key", mapOf("key" to name, "mode" to Bus.mode.value.name.lowercase()))
        if (now < testAUntil) { Bus.mediaEvents.value = Bus.mediaEvents.value + "${java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(now)} $name"; return }
        if (Bus.mode.value == Mode.WAKE_WORD) return
        when (name) {
            "play", "pause", "stop", "headsethook" -> enqueue(Trigger.Capture)
            "next" -> enqueue(Trigger.CaptureAndAnalyse(prefs.doubleTapLens))
            "previous" -> enqueue(Trigger.Ask)
        }
    }

    /* ---------------- triggers ---------------- */

    private fun enqueue(t: Trigger) {
        if (t is Trigger.Stop) { stopSpeaking = true; speaker.stop(); return }
        if (t is Trigger.Disarm) { queue.trySend(t); return }
        if (Bus.state.value == SessionState.DISARMED) return
        // One capture at a time and at most one waiting: extra taps while busy are dropped, not stacked (brief §4.1 says queue,
        // but stacked captures were timing out on the glasses; one pending is the useful limit).
        if ((t is Trigger.Capture || t is Trigger.CaptureAndAnalyse || t is Trigger.Ask || t is Trigger.Command) && pendingCaptures >= 1 && Bus.state.value != SessionState.STANDBY) { diag.event("trigger_dropped", mapOf("kind" to t.label)); return }
        if (t is Trigger.Capture || t is Trigger.CaptureAndAnalyse || t is Trigger.Ask || t is Trigger.Command) pendingCaptures++
        diag.event("trigger", mapOf("kind" to t.label, "state" to Bus.state.value.name.lowercase()))
        queue.trySend(t)
    }

    @Volatile private var pendingCaptures = 0
    /** True while the worker is handling a trigger (the wake-word loop stays quiet meanwhile). */
    @Volatile private var working = false
    /** Whether this run of the service may read location (typed as a location foreground service). */
    private var locationAllowed = false
    private var fgsTypes = 0

    /** Location allowed during a session: re-declare the service with the location type and start the track now. */
    private fun enableLocation() {
        if (locationAllowed || Bus.state.value == SessionState.DISARMED || !Locator.permitted(this)) return
        val t = fgsTypes or ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        if (runCatching { startForeground(NID, notification(), t) }.isSuccess) { fgsTypes = t; locationAllowed = true; travel.start(withLocation = true) }
    }

    private suspend fun handle(t: Trigger) {
        if (t is Trigger.Capture || t is Trigger.CaptureAndAnalyse || t is Trigger.Ask || t is Trigger.Command) pendingCaptures = (pendingCaptures - 1).coerceAtLeast(0)
        if (Bus.state.value == SessionState.DISARMED && t !is Trigger.Disarm) return
        when (t) {
            is Trigger.Disarm -> { disarm(); return }
            is Trigger.Capture -> capture(analyseWith = null)
            is Trigger.CaptureAndAnalyse -> capture(analyseWith = t.lensId, question = t.question)
            is Trigger.Ask -> ask()
            is Trigger.AnalyseLast -> analyseLast(t.lensId, t.question, byVoice = false)
            is Trigger.More -> more()
            is Trigger.Command -> route(t.text, byVoice = true)
            is Trigger.Stop -> {}
        }
        if (Bus.state.value != SessionState.DISARMED) Bus.state.value = SessionState.STANDBY
        updateNotification()
    }

    /**
     * [quick] grabs a frame from the live stream instead of the glasses' full photo: about 3 s against 10 s+, which is
     * what an answer is waiting on. Plain taps keep the full photo unless the caller asks otherwise, and so do the reading
     * lenses (menus, receipts, boards): a 504×896 frame is too coarse for small print.
     */
    private suspend fun capture(analyseWith: String?, question: String = "", byVoice: Boolean = false, silentAuto: Boolean = false,
                                quick: Boolean = analyseWith != null && prefs.quickPhotos && analyseWith !in com.urmit.glasses.dev.data.Lenses.READING): String? {
        if (Bus.state.value == SessionState.DISARMED) return null
        Bus.state.value = SessionState.CAPTURING; updateNotification()
        val captured = try {
            grab(quick)
        } catch (e: kotlinx.coroutines.CancellationException) { throw e
        } catch (e: Exception) {
            // One retry, then a spoken failure (brief §4.2).
            try { delay(800); grab(quick) } catch (e2: kotlinx.coroutines.CancellationException) { throw e2 } catch (e2: Exception) { fail(friendlyCapture(e2.message ?: "The photo didn't work")); return null }
        }
        val tSave = System.currentTimeMillis()
        val saved = when {
            captured.jpeg != null -> media.saveCaptureBytes(captured.jpeg, "image/jpeg", "jpg")
            captured.heic != null -> media.saveCaptureBytes(captured.heic, "image/heic", "heic")
            else -> media.saveCapture(captured.bitmap!!)
        }
        if (saved == null) { fail("The photo couldn't be saved to the phone"); return null }
        diag.event("photo_saved", mapOf("save_ms" to (System.currentTimeMillis() - tSave), "format" to (if (captured.heic != null) "heic" else if (captured.jpeg != null) "frame" else "jpeg")))
        Bus.lastCaptureKey.value = saved.first
        if (locationAllowed) travel.tagCapture(saved.first)
        Bus.captureTimings.value = (Bus.captureTimings.value + captured.timing).takeLast(20)
        repo.update(saved.first) { it.copy(state = AnalysisState.SAVED) }
        speaker.tone(Speaker.Tone.CAPTURED)
        val lens = analyseWith ?: if (prefs.autoAnalyse && !silentAuto) prefs.doubleTapLens else null
        if (lens != null) analyse(saved.first, saved.second, lens, question, byVoice)
        return saved.first
    }

    /** A frame off the live stream when [quick], otherwise the glasses' full photo. */
    private suspend fun grab(quick: Boolean) = if (quick) glasses.captureFrame() else glasses.capture()

    private suspend fun analyse(key: String, uri: android.net.Uri, lensId: String, question: String, byVoice: Boolean) {
        Bus.state.value = SessionState.ANALYSING; updateNotification()
        speaker.tone(Speaker.Tone.ANALYSING)
        val cap = prefs.dailyCapCents
        try {
            val text = AnalysisQueue.get(this).ask(key, uri, lensId, question, byVoice)
            Bus.lastAnswer.value = text
            diag.event("analysis_ok")
            speak(text)
            if (cap > 0 && prefs.spentTodayCents * 100 / cap >= 80 && prefs.spentTodayCents * 100 / cap < 100) speak("Heads up, eighty percent of today's budget used.", append = true)
        } catch (e: Exception) {
            fail(e.message ?: "Analysis failed")
        }
    }

    private suspend fun analyseLast(lensId: String, question: String, byVoice: Boolean) {
        val key = Bus.lastCaptureKey.value ?: media.list().firstOrNull()?.key
        val item = key?.let { k -> media.list().firstOrNull { it.key == k } }
        if (item == null) { fail("There's no photo to look at yet"); return }
        analyse(item.key, item.uri, lensId, question, byVoice)
    }

    private suspend fun ask() {
        Bus.state.value = SessionState.LISTENING; updateNotification()
        speaker.tone(Speaker.Tone.LISTENING)
        val heard = try { voice.listenOnce() } catch (e: Exception) { diag.event("voice_fail", mapOf("route" to voice.lastRoute, "reason" to (e.message ?: "").take(80))); fail(e.message ?: "I couldn't hear you"); return }
        diag.event("voice_command", mapOf("chars" to heard.length, "route" to voice.lastRoute))
        route(heard, byVoice = true)
    }

    /**
     * A few instant words are handled locally (stop, more, end session); everything else goes to the orchestrator, which
     * decides whether to take a photo, look through a lens, log food, answer from knowledge, or change a setting.
     */
    private suspend fun route(heardRaw: String, byVoice: Boolean) {
        val h = heardRaw.lowercase().trim()
        when {
            // Said and awaited before disarming, which otherwise cut it off mid-word.
            h.contains("end session") || h.contains("end the session") || h == "disarm" -> { speak("Ending the session."); enqueue(Trigger.Disarm) }
            h == "stop" || h.startsWith("stop ") || h == "cancel" -> { speaker.stop() }
            // Exact phrases only: "tell me more about the fort" or "does the road continue" are questions for the brain.
            h.trimEnd('.', '!', '?') in MORE -> more()
            h == "take a photo" || h == "take photo" || h == "photo" || h == "capture" -> capture(null, byVoice = true)
            else -> {
                // Travel commands that need neither the brain nor data (notes, take me home, cards) answer instantly.
                var photo: String? = null
                // silentAuto: a "remember this" photo is for finding later, not for an auto-answer.
                val instant = travel.handle(h, heardRaw.trim()) { capture(null, byVoice = true, silentAuto = true, quick = prefs.quickPhotos).also { photo = it } }
                if (instant != null) {
                    // The kind of command only, never the words (the diagnostics promise).
                    diag.event("travel_command", mapOf("kind" to travel.lastKind))
                    val chat = ChatRepo.get(this)
                    chat.add(ChatMessage("user", heardRaw.trim(), System.currentTimeMillis(), photoKey = photo ?: "", byVoice = true))
                    chat.add(ChatMessage("assistant", instant, System.currentTimeMillis(), model = "on phone"))
                    Bus.lastAnswer.value = instant
                    speak(instant)
                    return
                }
                Bus.state.value = SessionState.ANALYSING; updateNotification()
                speaker.tone(Speaker.Tone.ANALYSING)
                val out = Agent.get(this).run(heardRaw, byVoice = byVoice) { st -> Bus.toast.value = null; Bus.lastError.value = ""; updateNotification(st) }
                if (out.photoKey.isNotBlank()) Bus.lastCaptureKey.value = out.photoKey
                Bus.lastAnswer.value = out.text
                speak(out.text)
            }
        }
    }

    private fun friendlyCapture(m: String) = when {
        m.contains("not registered", true) -> "The glasses aren't linked yet. Open the Glasses tab and tap Link glasses."
        m.contains("No eligible", true) -> "I can't reach the glasses. Are they on, unfolded and connected in the Meta AI app?"
        m.contains("too long", true) -> "The glasses took too long to answer. Try once more."
        else -> m
    }

    /* ---------------- speaking ---------------- */

    private suspend fun speak(text: String, append: Boolean = false) {
        // One space between words, so nextChunk's position arithmetic holds for answers with line breaks.
        if (!append) { fullAnswer = text.replace(Regex("\\s+"), " ").trim(); spokenChars = 0 }
        val chunk = if (append) text else nextChunk()
        stopSpeaking = false
        Bus.state.value = SessionState.SPEAKING; updateNotification()
        sayAndWait(chunk)
    }

    /**
     * Waits for the utterance to finish, but never forever: if the TTS engine dies or drops the utterance without a callback,
     * the worker would otherwise hang and every later trigger, End included, would queue behind it.
     */
    private suspend fun sayAndWait(text: String) {
        withTimeoutOrNull(8_000L + text.length * 90L) { suspendCancellableCoroutine { cont -> speaker.say(text) { if (cont.isActive) cont.resume(Unit) } } }
    }

    /** About [Prefs.answerSeconds] of speech per chunk; "more" continues (brief §4.7). */
    private fun nextChunk(): String {
        val wordsPer = (prefs.answerSeconds * 2.5).toInt()
        val rest = fullAnswer.substring(spokenChars.coerceAtMost(fullAnswer.length))
        if (rest.isBlank()) return "That's all."
        val words = rest.split(Regex("\\s+"))
        val take = words.take(wordsPer).joinToString(" ")
        // Cut at the last sentence end inside the chunk when there is one.
        // A sentence end is . ! or ? followed by a space or the end, so "12.50" and "2.4 km" are never split.
        val cut = SENTENCE_END.findAll(take).lastOrNull()?.range?.first?.let { if (it > take.length / 2) it + 1 else null } ?: take.length
        val chunk = take.substring(0, cut).trim()
        spokenChars += rest.indexOf(chunk) + chunk.length
        return chunk + if (spokenChars < fullAnswer.length) " Say more to continue." else ""
    }

    private suspend fun more() { if (fullAnswer.isBlank()) fail("There's nothing more to say yet") else speak(nextChunk(), append = true) }

    private suspend fun fail(msg: String) {
        Bus.lastError.value = msg
        diag.event("failure", mapOf("state" to Bus.state.value.name.lowercase(), "reason" to msg.take(80)))
        speaker.tone(Speaker.Tone.FAILED)
        sayAndWait(msg)
    }

    /* ---------------- self-tests ---------------- */

    private suspend fun runTestB() {
        Bus.toast.value = "Photo test: 5 photos, 10 s apart${if (prefs.warmSeconds > 0) " (warm mode on)" else ""}"
        val results = mutableListOf<CaptureTiming>()
        repeat(5) { i ->
            if (i > 0) delay(10_000)
            val r = runCatching { glasses.capture() }
            r.getOrNull()?.let { c -> results += c.timing; if (c.heic != null) media.saveCaptureBytes(c.heic, "image/heic", "heic") else media.saveCapture(c.bitmap!!) }
            diag.event("test_b_capture", if (r.isSuccess) "${r.getOrNull()!!.timing.totalMs} ms" else "fail ${r.exceptionOrNull()?.message}")
        }
        val ok = results.size
        val median = results.map { it.totalMs }.sorted().let { if (it.isEmpty()) 0 else it[it.size / 2] }
        prefs.setTestResult("B", (if (ok >= 4 && median < 4000) "pass" else "fail") + ":$ok of 5 saved · median ${median} ms${if (prefs.warmSeconds > 0) " · warm" else " · cold"}")
        Bus.captureTimings.value = results
        Bus.toast.value = "Photo test done: $ok of 5 worked, typical $median ms"
    }

    /* ---------------- notification ---------------- */

    private fun refreshChecks() {
        Bus.checks.value = listOf(
            "Session running" to true,
            "Glasses taps reach Fieldnote" to (mediaSession?.isActive == true),
            "Glasses linked" to glasses.registered,
            "Microphone permission" to (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED),
            "Bluetooth permission" to (checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) == android.content.pm.PackageManager.PERMISSION_GRANTED)
        )
    }

    private fun pi(action: String) = PendingIntent.getService(this, action.hashCode(), Intent(this, FieldService::class.java).setAction(action), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    private fun notification(): Notification {
        val st = Bus.state.value
        val title = when (st) {
            SessionState.DISARMED -> "Session ended"
            SessionState.STANDBY -> "Fieldnote is ready · ${if (Bus.mode.value == Mode.WAKE_WORD) "say \"Fieldnote\"" else "tap the glasses"}"
            SessionState.WAKING -> "Waking the glasses"
            SessionState.CAPTURING -> "Taking a photo"
            SessionState.LISTENING -> "Listening…"
            SessionState.ANALYSING -> statusLine.ifBlank { "Thinking…" }
            SessionState.SPEAKING -> "Answering"
            SessionState.HELD -> "Paused by the glasses"
            SessionState.RECOVERING -> "Reconnecting"
        }
        val text = when {
            Bus.mode.value == Mode.WAKE_WORD && Bus.wakeWordEndsAt.value > 0 -> "${((Bus.wakeWordEndsAt.value - System.currentTimeMillis()) / 60000).coerceAtLeast(0)} min of wake word left"
            Bus.lastError.value.isNotBlank() -> Bus.lastError.value
            Bus.lastAnswer.value.isNotBlank() -> Bus.lastAnswer.value.take(80)
            else -> "Tap: photo · Double-tap: photo + answer · Triple-tap: ask anything"
        }
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CH).setSmallIcon(R.drawable.ic_notif).setContentTitle(title).setContentText(text)
            .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(0, "Photo", pi(ACT_CAPTURE)).addAction(0, "Ask", pi(ACT_ASK)).addAction(0, "End", pi(ACT_END))
            // No session token: on Android 13+ a token makes the shade and lock screen show the session's play/pause/skip
            // controls instead of Photo/Ask/End. Tap routing comes from the active session and the silent player, not this.
            .setStyle(androidx.media.app.NotificationCompat.MediaStyle().setShowActionsInCompactView(0, 1, 2))
            .build()
    }

    private var statusLine = ""
    private fun updateNotification(status: String = "") { statusLine = status; runCatching { getSystemService(NotificationManager::class.java).notify(NID, notification()) } }

    override fun onDestroy() {
        travel.stop()
        releaseMediaButtons()
        runCatching { if (wakeLock?.isHeld == true) wakeLock?.release() }
        speaker.shutdown()
        scope.cancel()
        if (Bus.state.value != SessionState.DISARMED) { Bus.state.value = SessionState.DISARMED; Bus.lastError.value = "Android closed the session. Start it again from the app." }
        super.onDestroy()
    }

    companion object {
        const val CH = "session"; const val NID = 7
        const val ACT_CAPTURE = "fn.capture"; const val ACT_ASK = "fn.ask"; const val ACT_END = "fn.end"
        const val ACT_ANALYSE = "fn.analyse"; const val ACT_ANALYSE_LAST = "fn.analyse_last"
        const val ACT_TEST_A = "fn.testA"; const val ACT_TEST_B = "fn.testB"; const val ACT_MODE = "fn.mode"; const val ACT_RELOAD = "fn.reload"; const val ACT_LOCATION = "fn.location"
        const val WAKE_WORD_MS = 20 * 60_000L
        private val MORE = setOf("more", "more please", "tell me more", "continue", "go on", "keep going", "carry on", "and", "what else")
        private val SENTENCE_END = Regex("[.!?](?=\\s|$)")

        fun arm(ctx: Context) { ctx.startForegroundService(Intent(ctx, FieldService::class.java)) }
        fun send(ctx: Context, action: String, extras: Map<String, String> = emptyMap()) {
            if (Bus.state.value == SessionState.DISARMED && action != ACT_END) return
            ctx.startService(Intent(ctx, FieldService::class.java).setAction(action).apply { extras.forEach { (k, v) -> putExtra(k, v) } })
        }
    }
}
