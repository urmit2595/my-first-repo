package com.urmit.glasses.dev.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Locale
import java.util.UUID
import kotlin.coroutines.resume

/* ---------- Place: phone location, place names, voice notes pinned to a place, photo tags (travel plan §9) ---------- */

/** A reverse-geocoded place. [label] is what we show and speak: "Nishiki Market, Kyoto". */
data class PlaceName(val name: String, val area: String, val city: String, val country: String, val countryCode: String) {
    val label: String get() = listOf(name, area, city).filter { it.isNotBlank() }.distinct().take(2).joinToString(", ").ifBlank { country }
}

/**
 * Phone location only (the glasses SDK exposes no location, travel plan §2). Foreground-only permission: the session service
 * is a foreground service started from the visible app, which is what lets it read location with the phone locked.
 */
object Locator {
    fun permitted(ctx: Context) = ctx.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ctx.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun providers(lm: LocationManager) = buildList {
        if (Build.VERSION.SDK_INT >= 31) add(LocationManager.FUSED_PROVIDER)
        add(LocationManager.GPS_PROVIDER); add(LocationManager.NETWORK_PROVIDER); add(LocationManager.PASSIVE_PROVIDER)
    }.filter { runCatching { lm.isProviderEnabled(it) }.getOrDefault(false) || it == LocationManager.PASSIVE_PROVIDER }

    /** Newest fix any provider already has. Free: no radio is woken. */
    @SuppressLint("MissingPermission")
    fun lastKnown(ctx: Context): Location? {
        if (!permitted(ctx)) return null
        val lm = ctx.getSystemService(LocationManager::class.java) ?: return null
        return providers(lm).mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }.maxByOrNull { it.time }
    }

    /**
     * A fix no older than [maxAgeMs]: the cached one when fresh, else one new fix within [timeoutMs], else the cached one if
     * under 15 minutes old. Older than that it is not "where you are" (it tagged photos with where you were hours ago).
     */
    @SuppressLint("MissingPermission")
    suspend fun current(ctx: Context, maxAgeMs: Long = 120_000, timeoutMs: Long = 6_000): Location? {
        if (!permitted(ctx)) return null
        val last = lastKnown(ctx)
        if (last != null && System.currentTimeMillis() - last.time < maxAgeMs) return last
        val recent = last?.takeIf { System.currentTimeMillis() - it.time < 15 * 60_000L }
        val lm = ctx.getSystemService(LocationManager::class.java) ?: return recent
        val provider = providers(lm).firstOrNull { it != LocationManager.PASSIVE_PROVIDER } ?: return recent
        val fresh = withTimeoutOrNull(timeoutMs) {
            suspendCancellableCoroutine<Location?> { cont ->
                val cancel = android.os.CancellationSignal()
                cont.invokeOnCancellation { runCatching { cancel.cancel() } }
                runCatching { lm.getCurrentLocation(provider, cancel, ctx.mainExecutor) { l -> if (cont.isActive) cont.resume(l) } }
                    .onFailure { if (cont.isActive) cont.resume(null) }
            }
        }
        return fresh ?: last?.takeIf { System.currentTimeMillis() - it.time < 15 * 60_000L }
    }

    /** Street-level place name for a point. Needs the network on most phones; null offline. */
    suspend fun reverse(ctx: Context, lat: Double, lng: Double): PlaceName? = withContext(Dispatchers.IO) {
        if (!Geocoder.isPresent()) return@withContext null
        val g = Geocoder(ctx, Locale.UK)
        val a = withTimeoutOrNull(8_000) {
            if (Build.VERSION.SDK_INT >= 33) suspendCancellableCoroutine { cont ->
                runCatching {
                    g.getFromLocation(lat, lng, 1, object : Geocoder.GeocodeListener {
                        override fun onGeocode(l: MutableList<android.location.Address>) { if (cont.isActive) cont.resume(l.firstOrNull()) }
                        override fun onError(m: String?) { if (cont.isActive) cont.resume(null) }
                    })
                }.onFailure { if (cont.isActive) cont.resume(null) }
            } else @Suppress("DEPRECATION") runCatching { g.getFromLocation(lat, lng, 1)?.firstOrNull() }.getOrNull()
        } ?: return@withContext null
        val name = a.featureName?.takeIf { f -> f.isNotBlank() && f != a.subThoroughfare && f.any { it.isLetter() } } ?: a.thoroughfare ?: ""
        PlaceName(name, a.subLocality ?: "", a.locality ?: a.subAdminArea ?: a.adminArea ?: "", a.countryName ?: "", a.countryCode ?: "")
    }

    /** Coordinates for an address (used to place a stay so "take me home" works offline later). */
    suspend fun forward(ctx: Context, address: String): Pair<Double, Double>? = withContext(Dispatchers.IO) {
        if (address.isBlank() || !Geocoder.isPresent()) return@withContext null
        val g = Geocoder(ctx, Locale.UK)
        withTimeoutOrNull(10_000) {
            if (Build.VERSION.SDK_INT >= 33) suspendCancellableCoroutine { cont ->
                runCatching {
                    g.getFromLocationName(address, 1, object : Geocoder.GeocodeListener {
                        override fun onGeocode(l: MutableList<android.location.Address>) { if (cont.isActive) cont.resume(l.firstOrNull()?.let { it.latitude to it.longitude }) }
                        override fun onError(m: String?) { if (cont.isActive) cont.resume(null) }
                    })
                }.onFailure { if (cont.isActive) cont.resume(null) }
            } else @Suppress("DEPRECATION") runCatching { g.getFromLocationName(address, 1)?.firstOrNull()?.let { it.latitude to it.longitude } }.getOrNull()
        }
    }

    fun distanceM(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Float = FloatArray(2).also { Location.distanceBetween(lat1, lng1, lat2, lng2, it) }[0]
    fun bearing(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Float = FloatArray(2).also { Location.distanceBetween(lat1, lng1, lat2, lng2, it) }[1]

    /** "north-east" for a bearing in degrees. */
    fun compass(deg: Float): String = listOf("north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west")[(((deg % 360) + 360 + 22.5f) % 360 / 45).toInt() % 8]

    /** "350 metres" / "2.4 kilometres", for speech. */
    fun distanceWords(m: Float): String = if (m < 950) "${((m / 50).toInt().coerceAtLeast(1)) * 50} metres" else "%.1f kilometres".format(Locale.UK, m / 1000)

    /** Minutes on foot: 4.5 km/h average, 3.5 slow, 5.5 fast. */
    fun walkMinutes(m: Float, pace: String): Int = (m / (when (pace.lowercase()) { "slow" -> 58f; "fast" -> 92f; else -> 75f })).toInt().coerceAtLeast(1)
}

/**
 * The last named place the phone was at, kept warm by the session's location updates and by tagging, so the brain can say
 * "near Nishiki Market" without a slow reverse-geocode on every question.
 */
object Here {
    @Volatile var place: PlaceName? = null; private set
    @Volatile var at: Long = 0; private set
    @Volatile private var lat = Double.NaN
    @Volatile private var lng = Double.NaN

    /** Names [l] if it moved more than 150 m from the last named point or the name is over 10 minutes old. Needs the network. */
    suspend fun update(ctx: Context, l: Location) {
        val moved = lat.isNaN() || Locator.distanceM(lat, lng, l.latitude, l.longitude) > 150
        if (!moved && System.currentTimeMillis() - at < 10 * 60_000L) return
        val p = Locator.reverse(ctx, l.latitude, l.longitude) ?: return
        place = p; at = System.currentTimeMillis(); lat = l.latitude; lng = l.longitude
    }

    fun set(p: PlaceName, l: Location) { place = p; at = System.currentTimeMillis(); lat = l.latitude; lng = l.longitude }

    /** "Near Nishiki Market, Kyoto (4 min ago)" or "" when nothing recent. */
    fun label(maxAgeMs: Long = 60 * 60_000L): String {
        val p = place ?: return ""
        val age = System.currentTimeMillis() - at
        if (age > maxAgeMs) return ""
        return "Near ${p.label}${if (p.country.isNotBlank() && !p.label.contains(p.country)) ", ${p.country}" else ""} (${if (age < 90_000) "just now" else "${age / 60_000} min ago"})"
    }
}

/** A light location track, recorded only while a glasses session runs, so native shutter photos can be placed later. */
class Track private constructor(ctx: Context) {
    data class Point(val t: Long, val lat: Double, val lng: Double, val acc: Float)
    private val file = File(ctx.filesDir, "track.json")
    private val lock = Any()
    private var points: List<Point> = load()

    private fun load(): List<Point> = runCatching {
        val arr = JSONArray(file.readText()); (0 until arr.length()).map { i -> arr.getJSONArray(i).let { Point(it.getLong(0), it.getDouble(1), it.getDouble(2), it.getDouble(3).toFloat()) } }
    }.getOrDefault(emptyList())

    fun record(l: Location) {
        synchronized(lock) {
            val last = points.lastOrNull()
            if (last != null && l.time - last.t < 30_000 && Locator.distanceM(last.lat, last.lng, l.latitude, l.longitude) < 25) return
            val cutoff = System.currentTimeMillis() - 30L * 86_400_000
            points = (points.filter { it.t > cutoff } + Point(l.time, l.latitude, l.longitude, l.accuracy)).takeLast(20_000)
            runCatching { val tmp = File(file.parentFile, "track.tmp"); tmp.writeText(JSONArray().apply { points.forEach { put(JSONArray().put(it.t).put(it.lat).put(it.lng).put(it.acc.toDouble())) } }.toString()); tmp.renameTo(file) }
        }
    }

    /** The recorded point closest in time to [t], if one lies within [windowMs]. */
    fun near(t: Long, windowMs: Long = 20 * 60_000L): Point? = synchronized(lock) { points.minByOrNull { kotlin.math.abs(it.t - t) }?.takeIf { kotlin.math.abs(it.t - t) <= windowMs } }

    fun clear() = synchronized(lock) { points = emptyList(); file.delete() }

    companion object {
        @Volatile private var inst: Track? = null
        fun get(ctx: Context) = inst ?: synchronized(this) { inst ?: Track(ctx.applicationContext).also { inst = it } }
    }
}

/** A voice note pinned to a place ("note: …"), or a "remember this" with a photo (where did I leave it, travel plan §4). */
data class Pin(
    val id: String = UUID.randomUUID().toString(),
    val at: Long = System.currentTimeMillis(),
    val text: String,
    val lat: Double = Double.NaN,
    val lng: Double = Double.NaN,
    val place: String = "",
    val photoKey: String = "",
    val tripId: String = "",
    val kind: String = "note"         // note | remember
) {
    val hasPoint get() = !lat.isNaN() && !lng.isNaN()
    fun toJson(): JSONObject = JSONObject().put("id", id).put("at", at).put("text", text).put("lat", if (lat.isNaN()) JSONObject.NULL else lat)
        .put("lng", if (lng.isNaN()) JSONObject.NULL else lng).put("place", place).put("photoKey", photoKey).put("tripId", tripId).put("kind", kind)
    companion object {
        fun from(o: JSONObject) = Pin(o.optString("id"), o.optLong("at"), o.optString("text"), o.optDouble("lat", Double.NaN), o.optDouble("lng", Double.NaN),
            o.optString("place"), o.optString("photoKey"), o.optString("tripId"), o.optString("kind", "note"))
    }
}

class PinRepo private constructor(ctx: Context) {
    private val file = File(ctx.filesDir, "pins.json")
    private val lock = Any()
    private val _pins = MutableStateFlow<List<Pin>>(load())
    val pins: StateFlow<List<Pin>> = _pins

    private fun load(): List<Pin> = runCatching {
        if (!file.exists()) return emptyList()
        val arr = JSONArray(file.readText()); (0 until arr.length()).map { Pin.from(arr.getJSONObject(it)) }.sortedByDescending { it.at }
    }.getOrElse { Store.quarantine(file); emptyList() }

    private fun persist(l: List<Pin>) { val tmp = File(file.parentFile, "pins.tmp"); tmp.writeText(JSONArray().apply { l.forEach { put(it.toJson()) } }.toString()); tmp.renameTo(file) }

    fun put(p: Pin) = synchronized(lock) { val l = (_pins.value.filter { it.id != p.id } + p).sortedByDescending { it.at }; persist(l); _pins.value = l }
    fun delete(id: String) = synchronized(lock) { val l = _pins.value.filter { it.id != id }; persist(l); _pins.value = l }

    /** Crude but offline: pins sharing the most words with [query], newest first on ties. */
    fun search(query: String, n: Int = 5): List<Pin> {
        val words = Search.words(query)
        if (words.isEmpty()) return _pins.value.take(n)
        return _pins.value.map { it to Search.score(words, it.text + " " + it.place) }.filter { it.second > 0 }.sortedWith(compareByDescending<Pair<Pin, Int>> { it.second }.thenByDescending { it.first.at }).take(n).map { it.first }
    }

    companion object {
        @Volatile private var inst: PinRepo? = null
        fun get(ctx: Context) = inst ?: synchronized(this) { inst ?: PinRepo(ctx.applicationContext).also { inst = it } }
    }
}

/** Word overlap scoring shared by the offline searches. */
object Search {
    private val STOP = setOf("the", "a", "an", "i", "my", "me", "where", "what", "did", "was", "is", "it", "to", "of", "in", "on", "at", "for", "and", "that", "this", "leave", "left", "put", "remember", "note", "find")
    fun words(s: String) = s.lowercase(Locale.UK).split(Regex("[^\\p{L}\\p{N}]+")).filter { it.length > 1 && it !in STOP }.toSet()
    fun score(words: Set<String>, text: String): Int { val t = words(text); return words.count { w -> t.any { it == w || (w.length > 3 && it.startsWith(w.take(4))) } } }
}

/**
 * Tags photos with where they were taken (travel plan §9, auto-tagging): Fieldnote captures use the fix taken at capture;
 * Meta AI album imports use the session's location track around their capture time. Place names need the network, so a point
 * saved offline is named on a later pass.
 */
object Tagger {
    private const val MAX_TRIES = 3
    /** Last naming attempt per photo this run: offline, catchUp ran on every refresh and used up all tries in seconds. */
    private val lastTry = java.util.concurrent.ConcurrentHashMap<String, Long>()

    /** Tags one item now. [fix] is the location at capture time when known. */
    suspend fun tag(ctx: Context, key: String, takenAt: Long, fix: Location? = null) {
        val repo = Repo.get(ctx)
        val n = repo.get(key)
        if (n.place.isNotBlank() || n.tagTries >= MAX_TRIES) return
        var lat = n.lat; var lng = n.lng
        if (lat.isNaN()) {
            val p = fix?.let { it.latitude to it.longitude }
                ?: Track.get(ctx).near(takenAt)?.let { it.lat to it.lng }
                ?: Locator.lastKnown(ctx)?.takeIf { kotlin.math.abs(it.time - takenAt) < 10 * 60_000L }?.let { it.latitude to it.longitude }
                ?: run { if (System.currentTimeMillis() - takenAt > 60 * 60_000L) repo.update(key) { it.copy(tagTries = MAX_TRIES) }; return }
            lat = p.first; lng = p.second
        }
        if (System.currentTimeMillis() - (lastTry[key] ?: 0L) < 10 * 60_000L && !n.lat.isNaN()) return
        lastTry[key] = System.currentTimeMillis()
        val name = Locator.reverse(ctx, lat, lng)
        // A failed naming only counts as a try when the phone is online; offline the point is kept and named later.
        val online = runCatching { ctx.getSystemService(android.net.ConnectivityManager::class.java).let { cm -> cm.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true } }.getOrDefault(false)
        repo.update(key) { it.copy(lat = lat, lng = lng, place = name?.label ?: "", tagTries = if (name == null && online) it.tagTries + 1 else it.tagTries) }
    }

    /** Background pass over recent items still missing a place; a few per call to stay light. */
    suspend fun catchUp(ctx: Context, items: List<MediaItem>, max: Int = 8) {
        if (!Prefs.get(ctx).autoTag || !Locator.permitted(ctx)) return
        val cutoff = System.currentTimeMillis() - 30L * 86_400_000
        items.asSequence().filter { it.takenAt > cutoff && it.note.place.isBlank() && it.note.tagTries < MAX_TRIES }.take(max).forEach { runCatching { tag(ctx, it.key, it.takenAt) } }
    }
}
