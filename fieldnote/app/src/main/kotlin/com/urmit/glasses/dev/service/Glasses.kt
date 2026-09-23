package com.urmit.glasses.dev.service

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import com.meta.wearable.dat.camera.Camera
import com.meta.wearable.dat.camera.addCamera
import com.meta.wearable.dat.camera.removeCamera
import com.meta.wearable.dat.camera.types.PhotoData
import com.meta.wearable.dat.camera.types.StreamConfiguration
import com.meta.wearable.dat.camera.types.StreamState
import com.meta.wearable.dat.camera.types.VideoFrame
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
import java.io.ByteArrayOutputStream
import kotlin.math.abs

class GlassesError(msg: String) : Exception(msg)

data class CaptureTiming(val sessionMs: Long, val cameraMs: Long, val streamMs: Long, val captureMs: Long, val totalMs: Long, val warm: Boolean = false, val attempts: Int = 1)
/** Raw HEIC bytes from the glasses (saved as-is, no decode on the hot path), a bitmap, or a JPEG made from a stream frame. */
data class Captured(val bitmap: Bitmap?, val heic: ByteArray?, val timing: CaptureTiming, val jpeg: ByteArray? = null)

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

    /** Stream quality (3.1 streamed LOW). Quick photos are stream frames, so this also sets their resolution. */
    @Volatile var videoQuality: VideoQuality = VideoQuality.MEDIUM

    private class Live(val session: DeviceSession, val camera: Camera, val stateJob: Job)
    private var live: Live? = null
    private var expiry: Job? = null
    val isWarm: Boolean get() = live != null

    /** The frame the quick path took off the stream. The collector sets it, then throws [FrameReady] to stop collecting. */
    @Volatile private var latest: VideoFrame? = null
    private class FrameReady : Exception()

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

    /**
     * Quick photo for answers: one frame off the live stream (about 3 s cold) instead of the glasses' full photo (10 s+).
     * A cold stream skips its first two frames, which arrive before the camera has settled. If the frame is a layout we
     * can't encode, falls back to a full photo on the same session.
     */
    suspend fun captureFrame(): Captured = lock.withLock {
        val t0 = System.currentTimeMillis()
        if (!registered) throw GlassesError("Glasses not registered with Fieldnote. Open Glasses → Register.")
        expiry?.cancel()
        val reuse = live?.takeIf { it.session.state.value == DeviceSessionState.STARTED && it.camera.stream.state.value == StreamState.STREAMING }
        if (reuse == null) teardown()
        val l = reuse ?: open()
        val t1 = System.currentTimeMillis()
        try {
            latest = null
            withTimeoutOrNull(FIRST_FRAME_MS) {
                var n = 0
                l.camera.stream.videoStream.collect { f -> if (++n < (if (reuse == null) 3 else 1)) return@collect; latest = f; throw FrameReady() }
            }
        } catch (done: FrameReady) {
            // The collector has its frame.
        } catch (e: Exception) {
            diag.event("capture_fail", mapOf("stage_ms" to (System.currentTimeMillis() - t0), "warm" to (reuse != null), "reason" to "frame: ${e.message ?: "unknown"}".take(80)))
            teardown()
            throw e
        }
        // A failed stream is released even in warm mode: 3.3 left it open with no expiry until the next capture or disarm.
        val frame = latest ?: run { teardown(); throw GlassesError("No video frame arrived") }
        latest = null
        try {
            val encoded = frameToJpeg(frame)
            if (encoded == null) {
                // Not a layout we know how to encode: log what arrived and take a full photo on the session we already have.
                diag.event("frame_unusable", mapOf("w" to frame.width, "h" to frame.height, "bytes" to frame.buffer.remaining(), "compressed" to frame.isCompressed))
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
                    "warm" to timing.warm, "attempts" to attempts, "format" to (if (captured.heic != null) "heic-fallback" else "bitmap-fallback"), "bytes" to (captured.heic?.size ?: 0)))
                afterCapture()
                return captured
            }
            val (jpeg, layout) = encoded
            val t2 = System.currentTimeMillis()
            val timing = if (reuse != null) CaptureTiming(0, 0, 0, t2 - t1, t2 - t0, warm = true)
                else CaptureTiming(openTiming[0], openTiming[1], openTiming[2], t2 - t1, t2 - t0, warm = false)
            diag.event("capture_ok", mapOf("total_ms" to timing.totalMs, "session_ms" to timing.sessionMs, "camera_ms" to timing.cameraMs, "stream_ms" to timing.streamMs, "shot_ms" to timing.captureMs,
                "warm" to timing.warm, "attempts" to 1, "format" to "frame", "layout" to layout, "bytes" to jpeg.size, "w" to frame.width, "h" to frame.height))
            afterCapture()
            Captured(null, null, timing, jpeg)
        } catch (e: Exception) {
            // Encoding or the fallback photo failed after the frame arrived: report it and release the glasses (3.3 did neither).
            diag.event("capture_fail", mapOf("stage_ms" to (System.currentTimeMillis() - t0), "warm" to (reuse != null), "reason" to "frame: ${e.message ?: "unknown"}".take(80)))
            teardown()
            throw e
        }
    }

    /** After a good shot: keep the camera live for [warmMs], or release it now. */
    private fun afterCapture() {
        if (live != null) {
            if (warmMs > 0) expiry = scope.launch { delay(warmMs); lock.withLock { teardown() } }
            else teardown()
        }
    }

    /**
     * JPEG from a raw stream frame plus the chroma layout it was read as, or null if the layout isn't one we know.
     * 12 bits a pixel is YUV 4:2:0: the SDK asks its decoder for COLOR_FormatYUV420Planar (19, I420: a U plane then a V plane),
     * but decoders may hand back semi-planar NV12 instead, so the layout is measured (see [planarChroma]) and re-packed into
     * the NV21 (V,U interleaved) that YuvImage takes. 32 bits a pixel is ARGB_8888.
     */
    private fun frameToJpeg(f: VideoFrame): Pair<ByteArray, String>? {
        if (f.isCompressed || f.width <= 0 || f.height <= 0) return null
        val buf = f.buffer.duplicate().apply { rewind() }
        val size = buf.remaining()
        val w = f.width; val h = f.height
        val out = ByteArrayOutputStream()
        val px = w * h
        return when (size) {
            px * 3 / 2 -> {
                val yuv = ByteArray(size); buf.get(yuv)
                val quarter = px / 4
                val planar = planarChroma(yuv, px, w, quarter)
                val nv = ByteArray(size)
                System.arraycopy(yuv, 0, nv, 0, px)
                // I420 → NV21: V from the second plane, U from the first. NV12 → NV21: swap each U,V pair.
                if (planar) for (k in 0 until quarter) { nv[px + 2 * k] = yuv[px + quarter + k]; nv[px + 2 * k + 1] = yuv[px + k] }
                else for (k in 0 until quarter) { nv[px + 2 * k] = yuv[px + 2 * k + 1]; nv[px + 2 * k + 1] = yuv[px + 2 * k] }
                YuvImage(nv, ImageFormat.NV21, w, h, null).compressToJpeg(Rect(0, 0, w, h), 88, out)
                out.toByteArray() to if (planar) "i420" else "nv12"
            }
            px * 4 -> {
                val bmp: Bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                bmp.copyPixelsFromBuffer(buf)
                bmp.compress(Bitmap.CompressFormat.JPEG, 88, out)
                bmp.recycle()
                out.toByteArray() to "argb"
            }
            else -> null
        }
    }

    /**
     * True when the chroma is planar (I420). Compares how alike each chroma byte is with the byte one chroma row below under
     * each reading: w/2 bytes on for planar, w bytes on for interleaved. Real images are smooth vertically, so the right
     * reading has the smaller difference; unlike a left/right comparison this also works on grey scenes where U ≈ V.
     * (3.3 compared neighbours left and right and had the test the wrong way round, re-packing NV12 as if it were I420.)
     */
    private fun planarChroma(yuv: ByteArray, px: Int, w: Int, quarter: Int): Boolean {
        var asPlanar = 0L; var asInterleaved = 0L
        var i = 0
        while (i + w < quarter) {
            val c = yuv[px + i].toInt() and 0xFF
            asPlanar += abs(c - (yuv[px + i + w / 2].toInt() and 0xFF))
            asInterleaved += abs(c - (yuv[px + i + w].toInt() and 0xFF))
            i += 61   // odd stride so both U and V bytes get sampled in the interleaved case
        }
        return asPlanar <= asInterleaved
    }

    private var openTiming = longArrayOf(0, 0, 0)
    /** One selector for the process (see companion): each AutoDeviceSelector starts an SDK coroutine that never ends. */
    private val selector get() = sharedSelector

    /** Cold open: session → STARTED, camera, stream → STREAMING, first frame seen. */
    private suspend fun open(): Live {
        val t0 = System.currentTimeMillis()
        val sinceStop = t0 - lastStopAt
        if (sinceStop < STOP_GAP_MS) delay(STOP_GAP_MS - sinceStop)
        var session: DeviceSession? = null
        var lastErr = ""
        for (attempt in 0 until 3) {
            val r = Wearables.createSession(selector)
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
            // Raw frames (compressVideo = false): the quick path turns a frame into a JPEG itself and can't decode the compressed stream.
            camera = s.addCamera(StreamConfiguration(videoQuality, 15, false)).getOrNull() ?: throw GlassesError("Camera refused. Check the camera permission in the Meta AI app.")
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
            // A paused stream fails capturePhoto at once and the glasses rarely resume it by themselves (telemetry: two
            // "Can only capture photos while streaming video" 600 ms apart). Skip straight to the caller's full reopen.
            if (camera.stream.state.value != StreamState.STREAMING) throw GlassesError("Capture failed: camera stream paused")
            val photo = withTimeoutOrNull(STAGE_MS) { camera.stream.capturePhoto() }
            val data = photo?.getOrNull()
            if (data != null) return data to attempt
            val err = photo?.errorOrNull()
            lastErr = if (photo == null) "capture timed out" else (err?.description ?: "unknown")
            diag.event("shot_retry", mapOf("attempt" to attempt, "reason" to lastErr.take(80)))
            if (err is com.meta.wearable.dat.camera.types.CaptureError.NotStreaming) break
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

    companion object {
        private val sharedSelector by lazy { AutoDeviceSelector() }
        const val STAGE_MS = 12_000L; const val FIRST_FRAME_MS = 4_000L; const val STOP_GAP_MS = 1_500L; @Volatile var lastStopAt = 0L }
}
