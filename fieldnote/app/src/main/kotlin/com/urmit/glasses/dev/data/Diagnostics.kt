package com.urmit.glasses.dev.data

import android.content.Context
import android.os.Build
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * Operational telemetry → Supabase table `fieldnote_events` (insert-only for the app's publishable key; nothing is readable back
 * from the phone). Sent: event name, structured props (latencies, lens, model, error class, state), a random install id,
 * a random session id, timestamps, app version, Android API. Never media, answer text, questions, location or hardware ids.
 */
class Diagnostics private constructor(private val ctx: Context) {
    private val sp = ctx.getSharedPreferences("diag", Context.MODE_PRIVATE)
    private val queueFile = File(ctx.filesDir, "diag_queue.json")
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client = OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS).build()
    val sessionId: String = UUID.randomUUID().toString()
    val installId: String = sp.getString("install", null) ?: UUID.randomUUID().toString().also { sp.edit().putString("install", it).apply() }

    var endpoint: String
        get() = sp.getString("endpoint", DEFAULT_ENDPOINT) ?: DEFAULT_ENDPOINT
        set(v) = sp.edit().putString("endpoint", v.trim()).apply()
    var token: String
        get() = sp.getString("token", DEFAULT_KEY) ?: DEFAULT_KEY
        set(v) = sp.edit().putString("token", v.trim()).apply()
    var enabled: Boolean
        get() = sp.getBoolean("enabled", true)
        set(v) { sp.edit().putBoolean("enabled", v).apply(); if (!v) queueFile.delete() }
    var lastStatus: String
        get() = sp.getString("lastStatus", "Never synced") ?: ""
        private set(v) = sp.edit().putString("lastStatus", v).apply()

    private val log = ArrayDeque<String>()
    fun recent(): List<String> = synchronized(log) { log.toList() }

    fun event(name: String, detail: String = "") = event(name, if (detail.isBlank()) emptyMap() else mapOf("detail" to detail))

    fun event(name: String, props: Map<String, Any?>) {
        val line = "${java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(System.currentTimeMillis())}  $name" +
            props.entries.filter { it.value != null }.joinToString("") { "  ${it.key}=${it.value}" }
        synchronized(log) { log.addFirst(line); while (log.size > 200) log.removeLast() }
        if (!enabled) return
        val ev = JSONObject().put("event", name).put("event_id", UUID.randomUUID().toString())
            .put("session_id", sessionId).put("install_id", installId)
            .put("ts", java.time.Instant.now().toString()).put("app_version", com.urmit.glasses.dev.BuildConfig.VERSION_NAME).put("android_api", Build.VERSION.SDK_INT)
            .put("props", JSONObject(props.filterValues { it != null }))
        synchronized(this) {
            val arr = runCatching { JSONArray(queueFile.readText()) }.getOrDefault(JSONArray())
            arr.put(ev)
            val trimmed = JSONArray(); for (i in maxOf(0, arr.length() - 300) until arr.length()) trimmed.put(arr.get(i))
            queueFile.writeText(trimmed.toString())
        }
        scope.launch { flush() }
    }

    private val flushing = java.util.concurrent.atomic.AtomicBoolean(false)
    @Volatile private var again = false

    /**
     * One flush at a time, and only the events actually sent are removed. Every event launches a flush; overlapping ones
     * used to delete events queued after their snapshot, and re-send rows another flush had stored, which the unique
     * event_id turns into a 409 for the whole batch (so its new rows were dropped as "delivered"). A flush that finds one
     * running asks it to go round again and returns at once, so a slow network never parks a thread per event.
     */
    fun flush(): String {
        if (!flushing.compareAndSet(false, true)) { again = true; return "Sync in progress" }
        try { var status: String; do { again = false; status = flushOnce() } while (again && !status.startsWith("Offline") && !status.startsWith("Server error")); return status }
        finally { flushing.set(false) }
    }

    private fun flushOnce(): String {
        if (!enabled) return "Diagnostics off"
        if (endpoint.isBlank() || token.isBlank()) return "No endpoint"
        val arr = synchronized(this) { runCatching { JSONArray(queueFile.readText()) }.getOrDefault(JSONArray()) }
        if (arr.length() == 0) return "Nothing to send"
        val req = Request.Builder().url(endpoint)
            .header("apikey", token).header("Authorization", "Bearer $token").header("Prefer", "return=minimal")
            .post(arr.toString().toRequestBody("application/json".toMediaType())).build()
        val status = runCatching {
            client.newCall(req).execute().use { r ->
                when {
                    // 409 = rows already stored (a retry after a lost response): treat as delivered.
                    r.isSuccessful || r.code == 409 -> { dropSent(arr); "Synced ${java.text.SimpleDateFormat("HH:mm", java.util.Locale.US).format(System.currentTimeMillis())}" }
                    // Server-side trouble: keep the queue and try again with the next event.
                    r.code !in 400..499 -> "Server error (${r.code}); will retry"
                    // The server refuses this batch outright; resending it would fail forever, so drop it.
                    else -> { dropSent(arr); "Server refused (${r.code}); dropped that batch" }
                }
            }
        }.getOrElse { "Offline, ${arr.length()} queued" }
        lastStatus = status
        return status
    }

    /** Removes exactly the events in [sent] from the queue file; anything queued meanwhile stays for the next flush. */
    private fun dropSent(sent: JSONArray) = synchronized(this) {
        val ids = (0 until sent.length()).map { sent.getJSONObject(it).optString("event_id") }.toSet()
        val cur = runCatching { JSONArray(queueFile.readText()) }.getOrDefault(JSONArray())
        val keep = JSONArray(); for (i in 0 until cur.length()) cur.optJSONObject(i)?.let { if (it.optString("event_id") !in ids) keep.put(it) }
        if (keep.length() == 0) queueFile.delete() else queueFile.writeText(keep.toString())
    }

    companion object {
        // Supabase REST insert endpoint for the events table, and the project's publishable (anon) key. The key is designed to
        // ship in clients (row-level security limits it to inserting events), but it is injected at build time from
        // local.properties so it stays out of the public source.
        val DEFAULT_ENDPOINT: String = com.urmit.glasses.dev.BuildConfig.DIAG_ENDPOINT
        val DEFAULT_KEY: String = com.urmit.glasses.dev.BuildConfig.DIAG_KEY
        @Volatile private var inst: Diagnostics? = null
        fun get(ctx: Context) = inst ?: synchronized(this) { inst ?: Diagnostics(ctx.applicationContext).also { inst = it } }
    }
}
