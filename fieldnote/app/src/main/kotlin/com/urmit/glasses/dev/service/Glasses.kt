package com.urmit.glasses.dev.service

import android.content.Context
import android.graphics.Bitmap
import com.meta.wearable.dat.camera.Camera
import com.meta.wearable.dat.camera.addCamera
import com.meta.wearable.dat.camera.removeCamera
import com.meta.wearable.dat.camera.types.PhotoData
import com.meta.wearable.dat.camera.types.StreamConfiguration
import com.meta.wearable.dat.camera.types.StreamState
import com.meta.wearable.dat.camera.types.VideoQuality
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.selectors.AutoDeviceSelector
import com.meta.wearable.dat.core.session.DeviceSession
import com.meta.wearable.dat.core.session.DeviceSessionState
import com.meta.wearable.dat.core.types.RegistrationState
import com.urmit.glasses.dev.data.Diagnostics
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull

class GlassesError(msg: String) : Exception(msg)

data class CaptureTiming(val sessionMs: Long, val cameraMs: Long, val streamMs: Long, val captureMs: Long, val totalMs: Long, val warm: Boolean = false, val attempts: Int = 1)
/** Either raw HEIC bytes from the glasses (saved as-is, no decode on the hot path) or a bitmap. */
data class Captured(val bitmap: Bitmap?, val heic: ByteArray?, val timing: CaptureTiming)

/**
 * Capture through the glasses (build brief §2.1, §4.2).
 *
 * Cold (default): no session while idle. A trigger creates a session, attaches the camera, waits for the stream to
 * deliver its first frame, captures, and tears everything down. Timeouts on every stage.
 *
 * Warm (opt-in, brief §3 Test B "warm variant"): after a capture the session and stream are kept alive for
 * [warmMs]; a trigger inside that window only calls capturePhoto. Costs glasses battery while warm, and a touchpad
 * tap during a live session may pause it instead of reaching Fieldnote as a media key, so it is off by default.
 */
class Glasses(private val ctx: Context) {
    private val diag = Diagnostics.get(ctx)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val lock = Mutex()

    val registered: Boolean get() = runCatching { Wearables.registrationState.value == RegistrationState.REGISTERED }.getOrDefault(false)
    val registrationState: StateFlow<RegistrationState>? get() = runCatching { Wearables.registrationState }.getOrNull()
    val deviceCount: Int get() = runCatching { Wearables.devices.value.size }.getOrDefault(0)
    val deviceName: String? get() = runCatching { Wearables.devices.value.firstOrNull()?.let { id -> Wearables.devicesMetadata[id]?.value?.name } }.getOrNull()

    /** Optional hook so the service can enter Held on PAUSED (brief §4.3). Receives each state transition. */
    var onSessionState: ((DeviceSessionState) -> Unit)? = null

    /** 0 = cold every time. Otherwise keep the camera live this long after a capture. */
    @Volatile var warmMs: Long = 0L

    private class Live(val session: DeviceSession, val camera: Camera, val stateJob: Job)
    private var live: Live? = null
    private var expiry: Job? = null
    val isWarm: Boolean get() = live != null

    suspend fun capture(): Captured = lock.withLock {
        val t0 = System.currentTimeMillis()
        if (!registered) throw GlassesError("Glasses not registered with Fieldnote. Open Glasses → Register.")
        expiry?.cancel()
        val reuse = live?.takeIf { it.session.state.value == DeviceSessionState.STARTED && it.camera.stream.state.value == StreamState.STREAMING }
        if (reuse == null) teardown()
        val l = reuse ?: open()
        val t1 = System.currentTimeMillis()
        try {
            val (data, attempts) = shoot(l.camera)
            val t2 = System.currentTimeMillis()
            val timing = if (reuse != null) CaptureTiming(0, 0, 0, t2 - t1, t2 - t0, warm = true, attempts = attempts)
                else CaptureTiming(openTiming[0], openTiming[1], openTiming[2], t2 - t1, t2 - t0, warm = false, attempts = attempts)
            val captured = when (data) {
                is PhotoData.Bitmap -> Captured(data.bitmap, null, timing)
                is PhotoData.HEIC -> { val buf = data.data; val bytes = ByteArray(buf.remaining()); buf.get(bytes); Captured(null, bytes, timing) }
                else -> throw GlassesError("Unknown photo format")
            }
            diag.event("capture_ok", mapOf("total_ms" to timing.totalMs, "session_ms" to timing.sessionMs, "camera_ms" to timing.cameraMs, "stream_ms" to timing.streamMs, "shot_ms" to timing.captureMs,
                "warm" to timing.warm, "attempts" to attempts, "format" to (if (data is PhotoData.HEIC) "heic" else "bitmap"), "bytes" to (captured.heic?.size ?: 0)))
            return captured
        } catch (e: Exception) {
            diag.event("capture_fail", mapOf("stage_ms" to (System.currentTimeMillis() - t0), "warm" to (reuse != null), "reason" to (e.message ?: "unknown").take(80)))
            teardown()
            throw e
        } finally {
            if (live != null) {
                if (warmMs > 0) expiry = scope.launch { delay(warmMs); lock.withLock { teardown() } }
                else teardown()
            }
        }
    }

    private var openTiming = longArrayOf(0, 0, 0)

    /** Cold open: session → STARTED, camera, stream → STREAMING, first frame seen. */
    private suspend fun open(): Live {
        val t0 = System.currentTimeMillis()
        val sinceStop = t0 - lastStopAt
        if (sinceStop < STOP_GAP_MS) delay(STOP_GAP_MS - sinceStop)
        var session: DeviceSession? = null
        var lastErr = ""
        for (attempt in 0 until 3) {
            val r = Wearables.createSession(AutoDeviceSelector())
            session = r.getOrNull(); if (session != null) break
            lastErr = r.errorOrNull()?.description ?: "no eligible device"
            delay(700)
        }
        val s = session ?: throw GlassesError("No eligible glasses ($lastErr). Are they on, unfolded and connected to the Meta AI app?")
        diag.event("session_create")
        val stateJob = scope.launch { s.state.collect { st -> onSessionState?.invoke(st); if (st == DeviceSessionState.STOPPED) scope.launch { lock.withLock { if (live?.session === s) teardown() } } } }
        var camera: Camera? = null
        try {
            s.start()
            val started = withTimeoutOrNull(STAGE_MS) { s.state.first { it == DeviceSessionState.STARTED || it == DeviceSessionState.STOPPED } }
            if (started != DeviceSessionState.STARTED) throw GlassesError(if (started == null) "Glasses took too long to answer" else "Glasses ended the session (${s.errors.replayCache.firstOrNull()?.description ?: "no reason given"})")
            val t1 = System.currentTimeMillis()
            camera = s.addCamera(StreamConfiguration(VideoQuality.LOW, 15, true)).getOrNull() ?: throw GlassesError("Camera refused. Check the camera permission in the Meta AI app.")
            val t2 = System.currentTimeMillis()
            val stream = camera.stream
            stream.start().errorOrNull()?.let { throw GlassesError("Stream failed: ${it.description}") }
            val streaming = withTimeoutOrNull(STAGE_MS) { stream.state.first { it == StreamState.STREAMING || it == StreamState.STOPPED || it == StreamState.CLOSED } }
            if (streaming != StreamState.STREAMING) throw GlassesError(if (streaming == null) "Camera stream never started" else "Camera stream stopped before capture")
            // Capturing before the pipeline delivers frames failed on the device ("Failed to capture photo"); wait for the first frame.
            withTimeoutOrNull(FIRST_FRAME_MS) { stream.videoStream.first() }
            val t3 = System.currentTimeMillis()
            openTiming = longArrayOf(t1 - t0, t2 - t1, t3 - t2)
            return Live(s, camera, stateJob).also { live = it }
        } catch (e: Exception) {
            stateJob.cancel()
            runCatching { camera?.stream?.stop() }; runCatching { camera?.stop() }; runCatching { s.removeCamera() }; runCatching { s.stop() }
            lastStopAt = System.currentTimeMillis()
            diag.event("session_stop")
            throw e
        }
    }

    /** capturePhoto with one in-session retry, which is far cheaper than a full teardown. */
    private suspend fun shoot(camera: Camera): Pair<PhotoData, Int> {
        var lastErr = "unknown"
        for (attempt in 1..2) {
            val photo = withTimeoutOrNull(STAGE_MS) { camera.stream.capturePhoto() }
            val data = photo?.getOrNull()
            if (data != null) return data to attempt
            lastErr = if (photo == null) "capture timed out" else (photo.errorOrNull()?.description ?: "unknown")
            diag.event("shot_retry", mapOf("attempt" to attempt, "reason" to lastErr.take(80)))
            delay(600)
        }
        throw GlassesError("Capture failed: $lastErr")
    }

    /** Release everything on the glasses. Safe to call twice. */
    private fun teardown() {
        val l = live ?: return
        live = null
        l.stateJob.cancel()
        runCatching { l.camera.stream.stop() }; runCatching { l.camera.stop() }
        runCatching { l.session.removeCamera() }; runCatching { l.session.stop() }
        lastStopAt = System.currentTimeMillis()
        diag.event("session_stop")
    }

    /** Called on disarm so nothing stays live on the glasses. */
    fun release() { expiry?.cancel(); scope.launch { lock.withLock { teardown() } } }

    companion object { const val STAGE_MS = 12_000L; const val FIRST_FRAME_MS = 4_000L; const val STOP_GAP_MS = 1_500L; @Volatile var lastStopAt = 0L }
}
