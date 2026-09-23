package com.urmit.glasses.dev.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

/* ---------- Trip brain (travel plan §3): one record per trip holds bookings, places and the destination's basics ---------- */

/**
 * One booking or fixed plan: a flight, a stay, a train, a ticket, a table.
 * Times are epoch ms; [tz] is the IANA zone they were written in (the place's local time), "" when unknown.
 */
data class TripItem(
    val id: String,
    val kind: String,                  // one of KINDS
    val title: String,                 // "AI 306 Delhi → Tokyo Narita", "Hotel Gracery Shinjuku"
    val start: Long = 0,               // 0 = unknown
    val end: Long = 0,
    val place: String = "",            // venue, hotel, airport or station name
    val address: String = "",          // as written in the booking
    val addressLocal: String = "",     // in the local script, for a driver (from the booking, or filled in by the offline pack)
    val phone: String = "",
    val code: String = "",             // confirmation, PNR or booking reference
    val detail: String = "",           // seat, terminal, room, what is included
    val lat: Double = Double.NaN,
    val lng: Double = Double.NaN,
    val tz: String = ""
) {
    val hasPoint get() = !lat.isNaN() && !lng.isNaN()
    fun toJson(): JSONObject = JSONObject().put("id", id).put("kind", kind).put("title", title).put("start", start).put("end", end)
        .put("place", place).put("address", address).put("addressLocal", addressLocal).put("phone", phone).put("code", code).put("detail", detail)
        .put("lat", if (lat.isNaN()) JSONObject.NULL else lat).put("lng", if (lng.isNaN()) JSONObject.NULL else lng).put("tz", tz)
    companion object {
        val KINDS = listOf("flight", "stay", "train", "bus", "ferry", "car", "ticket", "table", "tour", "other")
        fun from(o: JSONObject) = TripItem(o.optString("id").ifBlank { UUID.randomUUID().toString() }, o.optString("kind", "other").let { if (it in KINDS) it else "other" }, o.optString("title"),
            o.optLong("start"), o.optLong("end"), o.optString("place"), o.optString("address"), o.optString("addressLocal"), o.optString("phone"), o.optString("code"), o.optString("detail"),
            o.optDouble("lat", Double.NaN), o.optDouble("lng", Double.NaN), o.optString("tz"))
    }
}

/** A trip: destination basics plus its bookings. [currency] and [languages] drive prices in rupees, translation and the offline pack. */
data class Trip(
    val id: String,
    val name: String,                   // "Japan, October"
    val destination: String = "",       // "Tokyo and Kyoto, Japan"
    val country: String = "",           // ISO 3166 alpha-2 of the main destination, "JP"
    val currency: String = "",          // ISO 4217 local currency, "JPY"
    val languages: List<String> = emptyList(), // BCP-47 codes spoken there, main first: ["ja"]
    val start: Long = 0,
    val end: Long = 0,
    val items: List<TripItem> = emptyList(),
    val createdAt: Long = System.currentTimeMillis()
) {
    val language get() = languages.firstOrNull() ?: ""
    fun toJson(): JSONObject = JSONObject().put("id", id).put("name", name).put("destination", destination).put("country", country).put("currency", currency)
        .put("languages", JSONArray(languages)).put("start", start).put("end", end).put("createdAt", createdAt)
        .put("items", JSONArray().apply { items.forEach { put(it.toJson()) } })
    companion object {
        fun from(o: JSONObject): Trip {
            val arr = o.optJSONArray("items") ?: JSONArray(); val langs = o.optJSONArray("languages") ?: JSONArray()
            return Trip(o.getString("id"), o.optString("name"), o.optString("destination"), o.optString("country"), o.optString("currency"),
                (0 until langs.length()).map { langs.getString(it) }.filter { it.isNotBlank() }, o.optLong("start"), o.optLong("end"),
                (0 until arr.length()).map { TripItem.from(arr.getJSONObject(it)) }, o.optLong("createdAt"))
        }
    }
}

class TripRepo private constructor(ctx: Context) {
    private val file = File(ctx.filesDir, "trips.json")
    private val prefs = Prefs.get(ctx)
    private val lock = Any()
    private val _trips = MutableStateFlow<List<Trip>>(load())
    val trips: StateFlow<List<Trip>> = _trips

    private fun load(): List<Trip> = runCatching {
        if (!file.exists()) return emptyList()
        val arr = JSONArray(file.readText()); (0 until arr.length()).map { Trip.from(arr.getJSONObject(it)) }
    }.getOrElse { Store.quarantine(file); emptyList() }

    private fun persist(l: List<Trip>) { val tmp = File(file.parentFile, "trips.tmp"); tmp.writeText(JSONArray().apply { l.forEach { put(it.toJson()) } }.toString()); tmp.renameTo(file) }

    fun get(id: String) = _trips.value.firstOrNull { it.id == id }

    /**
     * The trip Fieldnote acts on: the one the wearer picked, else the one under way today, else the next within 45 days,
     * else the most recently added one that hasn't ended (or has no dates yet). A trip over for more than two days is not
     * current, so its currency and places stop colouring answers at home. Null when there is none.
     */
    fun current(now: Long = System.currentTimeMillis()): Trip? {
        // A pin lasts until its trip is over: glasses-only use never visits the Trip tab to unpin it.
        _trips.value.firstOrNull { it.id == prefs.activeTripId && (it.end <= 0 || now <= it.end + DAY) }?.let { return it }
        return byDate(now)
    }

    /** The trip the dates alone would pick, ignoring any pin. */
    fun byDate(now: Long = System.currentTimeMillis()): Trip? {
        val l = _trips.value
        return l.firstOrNull { it.start > 0 && now in it.start..(it.end.coerceAtLeast(it.start) + DAY) }
            ?: l.filter { it.start > now && it.start - now < 45 * DAY }.minByOrNull { it.start }
            ?: l.filter { it.start <= 0 || it.end.coerceAtLeast(it.start) + 2 * DAY > now }.maxByOrNull { it.createdAt }
    }

    /** Where the wearer is staying: the stay covering now, else the last one begun, else the next. */
    fun currentStay(now: Long = System.currentTimeMillis()): TripItem? {
        val stays = current(now)?.items?.filter { it.kind == "stay" } ?: return null
        // On a changeover day both stays "cover" the afternoon; the one begun most recently is where you're headed.
        return stays.filter { it.start in 1..now && (it.end == 0L || now <= it.end + 6 * HOUR) }.maxByOrNull { it.start }
            ?: stays.filter { it.start in 1..now }.maxByOrNull { it.start }
            ?: stays.filter { it.start > now }.minByOrNull { it.start }
            ?: stays.firstOrNull()
    }

    fun put(t: Trip) = synchronized(lock) { val l = _trips.value.filter { it.id != t.id } + withSpan(t); persist(l); _trips.value = l }
    fun delete(id: String) = synchronized(lock) { val l = _trips.value.filter { it.id != id }; persist(l); _trips.value = l; if (prefs.activeTripId == id) prefs.activeTripId = "" }
    fun update(id: String, f: (Trip) -> Trip) = synchronized(lock) { get(id)?.let { put(f(it)) } }

    /** Adds bookings to a trip, replacing any with the same booking reference or the same kind, title and start. */
    fun addItems(tripId: String, items: List<TripItem>) = update(tripId) { t ->
        var cur = t.items
        for (n in items) {
            val same = cur.firstOrNull { o -> o.kind == n.kind && ((n.code.isNotBlank() && o.code.equals(n.code, true) && o.title.equals(n.title, true)) || (o.title.equals(n.title, true) && o.start == n.start)) }
            cur = if (same == null) cur + n else cur.map { if (it.id == same.id) merge(same, n) else it }
        }
        t.copy(items = cur)
    }

    fun updateItem(tripId: String, item: TripItem) = update(tripId) { t -> t.copy(items = t.items.map { if (it.id == item.id) item else it }) }
    fun deleteItem(tripId: String, itemId: String) = update(tripId) { t -> t.copy(items = t.items.filter { it.id != itemId }) }

    /** Newer fields win, but never blank out what an older booking email already told us. */
    private fun merge(o: TripItem, n: TripItem) = o.copy(
        title = n.title.ifBlank { o.title }, start = if (n.start > 0) n.start else o.start, end = if (n.end > 0) n.end else o.end,
        place = n.place.ifBlank { o.place }, address = n.address.ifBlank { o.address }, addressLocal = n.addressLocal.ifBlank { o.addressLocal },
        phone = n.phone.ifBlank { o.phone }, code = n.code.ifBlank { o.code }, detail = n.detail.ifBlank { o.detail },
        lat = if (n.hasPoint) n.lat else o.lat, lng = if (n.hasPoint) n.lng else o.lng, tz = n.tz.ifBlank { o.tz })

    /** Trip dates follow its bookings unless none have dates. */
    private fun withSpan(t: Trip): Trip {
        val starts = t.items.map { it.start }.filter { it > 0 }
        if (starts.isEmpty()) return t
        val ends = t.items.map { maxOf(it.start, it.end) }.filter { it > 0 }
        return t.copy(start = starts.min(), end = ends.max())
    }

    companion object {
        const val HOUR = 3_600_000L
        const val DAY = 86_400_000L
        @Volatile private var inst: TripRepo? = null
        fun get(ctx: Context) = inst ?: synchronized(this) { inst ?: TripRepo(ctx.applicationContext).also { inst = it } }
    }
}

/* ---------- Plain-language descriptions shared by the brain, the lenses and the Trip tab ---------- */

object TravelText {
    private val dayFmt get() = java.text.SimpleDateFormat("EEE d MMM", java.util.Locale.UK)

    /** "Sat 3 Oct, 2:05 pm" in the item's own zone when known (that is the time printed on the ticket). */
    fun whenLabel(t: Long, tz: String = ""): String {
        if (t <= 0) return ""
        val f = java.text.SimpleDateFormat("EEE d MMM, h:mm a", java.util.Locale.UK)
        // TimeZone.getTimeZone turns an unknown id into GMT; validate first so a bad zone falls back to the phone's, like epoch().
        if (tz.isNotBlank()) runCatching { f.timeZone = java.util.TimeZone.getTimeZone(java.time.ZoneId.of(tz)) }
        return f.format(t).replace("AM", "am").replace("PM", "pm")
    }

    fun span(t: Trip): String = if (t.start <= 0) "dates not known yet" else "${dayFmt.format(t.start)} to ${dayFmt.format(t.end.coerceAtLeast(t.start))}"

    fun item(i: TripItem): String = buildString {
        append("${i.kind}: ${i.title}")
        if (i.start > 0) append(", ${whenLabel(i.start, i.tz)}")
        if (i.end > 0 && i.end != i.start) append(" until ${whenLabel(i.end, i.tz)}")
        if (i.place.isNotBlank() && !i.title.contains(i.place, true)) append(", at ${i.place}")
        if (i.address.isNotBlank()) append(", address ${i.address}")
        if (i.phone.isNotBlank()) append(", phone ${i.phone}")
        if (i.code.isNotBlank()) append(", ref ${i.code}")
        if (i.detail.isNotBlank()) append(", ${i.detail}")
    }

    /** Compact trip context for model prompts: destination, dates, where the wearer is staying and what is next. */
    fun context(t: Trip?, stay: TripItem?, now: Long = System.currentTimeMillis()): String {
        if (t == null) return "No trip is saved."
        return buildString {
            append("Trip \"${t.name}\"${if (t.destination.isNotBlank()) " to ${t.destination}" else ""}, ${span(t)}")
            if (t.currency.isNotBlank()) append("; local currency ${t.currency}")
            if (t.languages.isNotEmpty()) append("; local languages ${t.languages.joinToString()}")
            append(". ")
            if (stay != null) append("Staying at: ${item(stay)}. ")
            val next = t.items.filter { it.start > now }.sortedBy { it.start }.take(3)
            if (next.isNotEmpty()) append("Next up: " + next.joinToString("; ") { item(it) } + ". ")
        }
    }
}

/** The wearer's standing preferences (travel plan §3, traveller profile). Every answer and nudge is filtered through it. */
object Profile {
    fun context(p: Prefs): String = buildString {
        append("Home currency ${p.homeCurrency}. ")
        if (p.languagesSpoken.isNotBlank()) append("Speaks ${p.languagesSpoken}. ")
        if (p.diet.isNotBlank()) append("Diet: ${p.diet}. ")
        if (p.allergies.isNotBlank()) append("Allergies (take seriously): ${p.allergies}. ")
        if (p.dailyBudget > 0) append("Daily budget about ${p.dailyBudget} ${p.homeCurrency}. ")
        if (p.interests.isNotBlank()) append("Interests: ${p.interests}. ")
        if (p.walkingPace.isNotBlank()) append("Walking pace: ${p.walkingPace}. ")
        if (p.aboutMe.isNotBlank()) append("Also: ${p.aboutMe}. ")
    }.trim()
}
