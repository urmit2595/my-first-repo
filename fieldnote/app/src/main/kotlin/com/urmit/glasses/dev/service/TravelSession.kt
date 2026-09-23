package com.urmit.glasses.dev.service

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.urmit.glasses.dev.MainActivity
import com.urmit.glasses.dev.R
import com.urmit.glasses.dev.data.Diagnostics
import com.urmit.glasses.dev.data.Here
import com.urmit.glasses.dev.data.Locator
import com.urmit.glasses.dev.data.OfflinePack
import com.urmit.glasses.dev.data.Prefs
import com.urmit.glasses.dev.data.Tagger
import com.urmit.glasses.dev.data.Track
import com.urmit.glasses.dev.data.TravelActions
import com.urmit.glasses.dev.data.TripRepo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * The travel side of a glasses session (travel plan phase 1): a light location track while armed, place tags on captures,
 * instant travel commands that need neither the brain nor data, and a notification that opens a card for someone else to read.
 * Location is foreground-only: the service is started from the visible app and runs as a location-typed foreground service.
 */
class TravelSession(private val ctx: Context, private val scope: CoroutineScope) {
    private val prefs = Prefs.get(ctx)
    private val lm = ctx.getSystemService(LocationManager::class.java)
    private var listener: LocationListener? = null
    private var cardJob: Job? = null

    /**
     * Card notifications always; with [withLocation], a fix every ~2 minutes or 50 m at balanced power: enough to place
     * Meta AI album photos later, cheap on battery.
     */
    @SuppressLint("MissingPermission")
    fun start(withLocation: Boolean) {
        cardJob?.cancel()
        cardJob = scope.launch { TravelActions.cardRequest.collect { k -> if (k != null) postCard(k) } }
        if (!withLocation || listener != null || !Locator.permitted(ctx) || lm == null) return
        val provider = listOfNotNull(if (Build.VERSION.SDK_INT >= 31) LocationManager.FUSED_PROVIDER else null, LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)
            .firstOrNull { runCatching { lm.isProviderEnabled(it) }.getOrDefault(false) } ?: return
        val l = LocationListener { loc -> Track.get(ctx).record(loc); scope.launch { runCatching { Here.update(ctx, loc) } } }
        runCatching { lm.requestLocationUpdates(provider, 120_000L, 50f, l, Looper.getMainLooper()) }
            .onSuccess { listener = l }.onFailure { Diagnostics.get(ctx).event("location_fail", mapOf("reason" to (it.message ?: "").take(80))) }
    }

    fun stop() {
        listener?.let { l -> runCatching { lm?.removeUpdates(l) } }; listener = null
        cardJob?.cancel(); cardJob = null
        runCatching { ctx.getSystemService(NotificationManager::class.java).cancel(CARD_NID) }
    }

    /** Tags a fresh capture with where it was taken, off the hot path so the tone and answer are not delayed. */
    fun tagCapture(key: String) {
        if (!prefs.autoTag || !Locator.permitted(ctx)) return
        val at = System.currentTimeMillis()
        scope.launch { runCatching { Tagger.tag(ctx, key, at, Locator.current(ctx, maxAgeMs = 60_000, timeoutMs = 5_000)) } }
    }

    /**
     * Travel commands answered on the phone, instantly and offline where possible. [h] is the lowercased transcript.
     * Returns what to say, or null when it is not one of these (then the brain handles it).
     */
    suspend fun handle(h: String, raw: String, takePhoto: suspend () -> String?): String? {
        fun after(vararg lead: String): String { val l = lead.firstOrNull { h.startsWith(it) } ?: return raw; return raw.drop(l.length).trim().removePrefix("that ").removePrefix(":").trim() }
        val q = h.trimEnd('.', '?', '!')
        lastKind = when {
            NOTE.any { h.startsWith(it) } -> "note"; h.startsWith("remember") -> "remember"; HOME.any { q == it || q.startsWith("$it ") } -> "home"
            q in WHERE -> "where"; h.contains("card") || q.startsWith("show the") -> "card"; h.contains("emergency") -> "emergency"; else -> "other"
        }
        return when {
            NOTE.any { h.startsWith(it) } -> TravelActions.saveNote(ctx, after(*NOTE.toTypedArray()))
            h.startsWith("remember ") || h == "remember this" -> {
                val what = after("remember")
                // "remember this", "remember where I parked", "remember I'm in locker 42 here": a photo makes it findable.
                val photo = if (Regex("\\b(this|here|where|parked|park|locker|room|bay|spot)\\b").containsMatchIn(h)) runCatching { takePhoto() }.getOrNull() else null
                TravelActions.saveNote(ctx, what, photo ?: "", "remember")
            }
            HOME.any { q == it || q.startsWith("$it ") } -> TravelActions.takeMeHome(ctx)
            // Exact phrases: "where am I supposed to meet Ravi" is a question for the brain.
            q in WHERE -> TravelActions.whereAmI(ctx)
            h.contains("driver card") || h == "show the address" || h == "show the hotel address" -> { TravelActions.cardRequest.value = "driver"; "The driver card is on your phone." }
            h.contains("allergy card") -> { TravelActions.cardRequest.value = "allergy"; "The allergy card is on your phone." }
            h.contains("emergency number") || h == "emergency" -> {
                TravelActions.cardRequest.value = "emergency"
                OfflinePack.emergency(TravelActions.countryNow(ctx))?.let { "Emergency numbers here: ${it.spoken}. They're on your phone too." } ?: "I don't have emergency numbers for this country. The emergency card is on your phone."
            }
            else -> null
        }
    }

    private fun postCard(kind: String) {
        if (MainActivity.visible) return   // the open app shows the card itself
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CARD_CH, "Cards to show", NotificationManager.IMPORTANCE_HIGH).apply { setShowBadge(false) })
        val open = PendingIntent.getActivity(ctx, kind.hashCode(), Intent(ctx, MainActivity::class.java).putExtra(MainActivity.EXTRA_CARD, kind)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val title = when (kind) { "driver" -> "Address for the driver"; "allergy" -> "Allergy card"; "phrases" -> "Quick phrases"; else -> "Emergency numbers" }
        runCatching {
            nm.notify(CARD_NID, NotificationCompat.Builder(ctx, CARD_CH).setSmallIcon(R.drawable.ic_notif).setContentTitle(title).setContentText("Tap to show it full screen")
                .setContentIntent(open).setAutoCancel(true).setCategory(NotificationCompat.CATEGORY_NAVIGATION).setPriority(NotificationCompat.PRIORITY_HIGH).build())
        }
        // Consumed: cardRequest is a StateFlow, so asking for the same card again must start from null to be seen.
        TravelActions.cardRequest.compareAndSet(kind, null)
    }

    /** What the last [handle] call was, for telemetry that never carries the wearer's words. */
    @Volatile var lastKind = ""; private set

    companion object {
        const val CARD_CH = "cards"; const val CARD_NID = 8
        private val WHERE = setOf("where am i", "where am i now", "where are we", "where are we now", "where am i right now")
        private val NOTE = listOf("note ", "note:", "take a note", "make a note", "add a note")
        // Not "take me back …": that also means "back to <chat>" or "back to the station".
        private val HOME = listOf("take me home", "take me back home", "take me back to the hotel", "back to the hotel", "take me to the hotel", "how do i get home", "how do i get back to the hotel", "way home", "go home", "home please")
    }
}
