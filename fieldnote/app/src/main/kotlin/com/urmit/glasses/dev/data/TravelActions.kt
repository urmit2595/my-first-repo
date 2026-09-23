package com.urmit.glasses.dev.data

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

/**
 * The travel actions behind the brain's tools, the instant voice commands and the Trip tab (travel plan §3-§9, phase 1).
 * Everything that can work offline does: notes, take me home (once the stay has been placed), trip lookups, conversions.
 */
object TravelActions {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** A card the wearer asked to see ("driver", "allergy", "phrases", "emergency"); the app opens it, the session shows a notification. */
    val cardRequest = MutableStateFlow<String?>(null)
    val CARDS = listOf("driver", "allergy", "phrases", "emergency")

    /** The country the phone is in now (last named place), else the trip's: emergency numbers follow where you are. */
    fun countryNow(ctx: Context): String = Here.place?.takeIf { System.currentTimeMillis() - Here.at < 6 * 3_600_000L }?.countryCode?.ifBlank { null } ?: TripRepo.get(ctx).current()?.country ?: ""

    /* ---------------- notes pinned to a place ---------------- */

    /** Saves a voice note (or a "remember this" with [photoKey]) at the phone's current place. Returns what to say. */
    suspend fun saveNote(ctx: Context, text: String, photoKey: String = "", kind: String = "note"): String {
        val clean = text.trim().trimStart(':', ',', '-', ' ').replaceFirstChar { it.uppercase() }
        if (clean.isBlank() && photoKey.isBlank()) return "What should I note? Say note, then what to remember."
        val loc = Locator.current(ctx, maxAgeMs = 60_000, timeoutMs = 4_000)
        val name = loc?.let { l -> Locator.reverse(ctx, l.latitude, l.longitude)?.also { Here.set(it, l) } }
        val place = name?.label ?: Here.label(10 * 60_000L).removePrefix("Near ").substringBefore(" (")
        PinRepo.get(ctx).put(Pin(text = clean.ifBlank { "Photo" }, lat = loc?.latitude ?: Double.NaN, lng = loc?.longitude ?: Double.NaN, place = place,
            photoKey = photoKey, tripId = TripRepo.get(ctx).current()?.id ?: "", kind = kind))
        if (photoKey.isNotBlank() && loc != null) Repo.get(ctx).update(photoKey) { if (it.place.isNotBlank()) it else it.copy(lat = loc.latitude, lng = loc.longitude, place = place) }
        Diagnostics.get(ctx).event("note_saved", mapOf("kind" to kind, "place" to place.isNotBlank(), "photo" to photoKey.isNotBlank(), "located" to (loc != null)))
        val where = if (place.isNotBlank()) " at $place" else if (loc == null) ", but without a location" else ""
        return if (kind == "remember") "Remembered${if (photoKey.isNotBlank()) ", with a photo," else ""}$where." else "Noted$where."
    }

    /** Pins, photos, spends and bookings matching [query], newest first. Offline. */
    fun find(ctx: Context, query: String): String {
        val words = Search.words(query)
        val pins = PinRepo.get(ctx).search(query, 4)
        val photos = if (words.isEmpty()) emptyList() else Repo.get(ctx).notes.value.values
            .map { it to Search.score(words, it.place + " " + it.lastAnswer) }.filter { it.second > 0 }.sortedByDescending { it.second }.take(3).map { it.first }
        val spends = if (words.isEmpty()) emptyList() else Ledger.get(ctx).expenses.value.filter { Search.score(words, "${it.merchant} ${it.note} ${it.place}") > 0 }.take(3)
        val items = if (words.isEmpty()) emptyList() else (TripRepo.get(ctx).current()?.items ?: emptyList()).filter { Search.score(words, "${it.title} ${it.place} ${it.address} ${it.detail}") > 0 }.take(3)
        if (pins.isEmpty() && photos.isEmpty() && spends.isEmpty() && items.isEmpty()) return "Nothing saved matches \"$query\"."
        return buildString {
            pins.forEach { p -> append("${if (p.kind == "remember") "Remembered" else "Note"} ${ago(p.at)}${if (p.place.isNotBlank()) " at ${p.place}" else ""}: ${p.text}${if (p.photoKey.isNotBlank()) " (with photo ${p.photoKey})" else ""}. ") }
            photos.forEach { n -> append("Photo ${n.key}${if (n.place.isNotBlank()) " at ${n.place}" else ""}: ${n.lastAnswer.take(140).ifBlank { "not looked at" }}. ") }
            spends.forEach { e -> append("Spend ${ago(e.at)}: ${e.merchant.ifBlank { e.category }} ${Money.fmt(e.amount, e.currency)}${if (e.place.isNotBlank()) " at ${e.place}" else ""}. ") }
            items.forEach { append("Booking: ${TravelText.item(it)}. ") }
        }.trim()
    }

    /* ---------------- where am I, take me home ---------------- */

    suspend fun whereAmI(ctx: Context): String {
        val loc = Locator.current(ctx) ?: return if (!Locator.permitted(ctx)) "Fieldnote isn't allowed to use location. Allow it in the Trip tab." else "I can't get a location fix right now."
        val name = Locator.reverse(ctx, loc.latitude, loc.longitude)?.also { Here.set(it, loc) }
        return buildString {
            append(if (name != null) "You're near ${name.label}${if (name.country.isNotBlank()) ", ${name.country}" else ""}. " else "I can't name this place offline, but I have your position. ")
            homeLine(ctx, loc.latitude, loc.longitude)?.let { append(it) }
        }.trim()
    }

    /** Offline once the stay has map coordinates: direction, distance, walking time, address for a driver, front desk number. */
    suspend fun takeMeHome(ctx: Context): String {
        val trips = TripRepo.get(ctx)
        var stay = trips.currentStay() ?: return "I don't know where you're staying yet. Share your hotel booking with Fieldnote, or tell me the hotel and address."
        if (!stay.hasPoint) placeItem(ctx, stay)?.let { stay = it }
        val loc = Locator.current(ctx)
        cardRequest.value = "driver"
        return buildString {
            append("Your stay is ${stay.place.ifBlank { stay.title }}. ")
            when {
                loc == null -> append("I can't get your location, so I can't give a direction. ")
                !stay.hasPoint -> append("I couldn't place it on the map, so no direction yet. ")
                else -> append(homeLine(ctx, loc.latitude, loc.longitude, named = false) ?: "")
            }
            append(if (stay.addressLocal.isNotBlank()) "The address in the local script is on your phone for a driver. " else if (stay.address.isNotBlank()) "The address is on your phone. " else "")
            if (stay.phone.isNotBlank()) append("Front desk: ${stay.phone}.")
        }.trim()
    }

    private fun homeLine(ctx: Context, lat: Double, lng: Double, named: Boolean = true): String? {
        val stay = TripRepo.get(ctx).currentStay()?.takeIf { it.hasPoint } ?: return null
        val d = Locator.distanceM(lat, lng, stay.lat, stay.lng)
        if (d < 60) return "You're at ${if (named) stay.place.ifBlank { stay.title } else "your stay"}. "
        val dir = Locator.compass(Locator.bearing(lat, lng, stay.lat, stay.lng))
        val walk = Locator.walkMinutes(d, Prefs.get(ctx).walkingPace)
        return "${if (named) stay.place.ifBlank { stay.title } else "It"}${if (named) " is" else "'s"} ${Locator.distanceWords(d)} to the $dir" +
            (if (walk <= 45) ", about $walk minutes' walk. " else "; take a taxi or transit. ")
    }

    /** Gives a trip item map coordinates from its address (needs the network once). */
    suspend fun placeItem(ctx: Context, item: TripItem, tripId: String = ""): TripItem? {
        val trips = TripRepo.get(ctx); val trip = (if (tripId.isNotBlank()) trips.get(tripId) else null) ?: trips.current()?.takeIf { t -> t.items.any { it.id == item.id } } ?: return null
        val p = Locator.forward(ctx, item.address.ifBlank { item.addressLocal }) ?: Locator.forward(ctx, "${item.place.ifBlank { item.title }}, ${trip.destination}") ?: return null
        val placed = item.copy(lat = p.first, lng = p.second)
        trips.updateItem(trip.id, placed)
        return placed
    }

    /**
     * Directions to a trip item as a universal Google Maps link: opens the Maps app when installed (which navigates offline if
     * its area is downloaded), otherwise the browser. google.navigation: only worked with the Maps app.
     */
    fun directionsUri(item: TripItem, mode: String = "walking"): Uri = Uri.parse("https://www.google.com/maps/dir/?api=1&travelmode=" +
        when (mode) { "w", "walking" -> "walking"; "d", "driving" -> "driving"; "r", "transit" -> "transit"; "b", "bicycling" -> "bicycling"; else -> "walking" } + "&destination=" +
        if (item.hasPoint) "${item.lat},${item.lng}" else Uri.encode(item.address.ifBlank { item.addressLocal }.ifBlank { item.place.ifBlank { item.title } }))

    /* ---------------- trip brain ---------------- */

    data class Added(val trip: Trip, val count: Int, val summary: String)

    /**
     * Reads bookings from text and/or images and files them into the current trip when they belong to it (same country or
     * within three days of it), otherwise into a new trip. Stays are placed on the map in the background.
     */
    fun addBookings(ctx: Context, text: String, images: List<File>): Added {
        val prefs = Prefs.get(ctx); val trips = TripRepo.get(ctx)
        val cur = trips.current()
        val b = TravelAnalyst.extractBookings(prefs, text, images, cur)
        if (b.items.isEmpty()) throw AnalystError("I couldn't find a booking in that." + if (b.note.isNotBlank()) " ${b.note}" else "")
        val starts = b.items.map { it.start }.filter { it > 0 }
        val near = cur != null && cur.start > 0 && starts.isNotEmpty() && starts.all { it in (cur.start - 3 * TripRepo.DAY)..(cur.end + 3 * TripRepo.DAY) }
        // Same country counts only for undated bookings or ones within a month of the trip: Japan in March is a new trip.
        val sameCountry = cur != null && cur.country.isNotBlank() && cur.country == b.country &&
            (starts.isEmpty() || cur.start <= 0 || starts.all { it in (cur.start - 30 * TripRepo.DAY)..(cur.end + 30 * TripRepo.DAY) })
        val fits = cur != null && (cur.items.isEmpty() || near || sameCountry)
        // update(), not put() of the snapshot taken before the 10–20 s model call, so concurrent changes survive.
        // If the trip was deleted during the model call, file into a new one rather than drop the bookings.
        val trip = (if (fits) { trips.update(cur!!.id) { t -> t.copy(destination = t.destination.ifBlank { b.destination }, country = t.country.ifBlank { b.country },
                currency = t.currency.ifBlank { b.currency }, languages = t.languages.ifEmpty { b.languages }) }; trips.get(cur.id) } else null) ?: Trip(UUID.randomUUID().toString(), b.tripName.ifBlank { b.destination }.ifBlank { "New trip" }, b.destination, b.country, b.currency, b.languages).also { trips.put(it) }
        trips.addItems(trip.id, b.items)
        scope.launch { b.items.filter { it.kind == "stay" || it.address.isNotBlank() }.forEach { i -> trips.get(trip.id)?.items?.firstOrNull { it.id == i.id && !it.hasPoint }?.let { placeItem(ctx, it, trip.id) } } }
        Diagnostics.get(ctx).event("bookings_added", mapOf("count" to b.items.size, "kinds" to b.items.map { it.kind }.distinct().joinToString(","), "new_trip" to !fits, "images" to images.size))
        val list = b.items.sortedBy { it.start }.take(4).joinToString("; ") { it.title + if (it.start > 0) " (${TravelText.whenLabel(it.start, it.tz)})" else "" }
        return Added(trips.get(trip.id) ?: trip, b.items.size, "Added ${b.items.size} booking${if (b.items.size == 1) "" else "s"} to ${trip.name}: $list${if (b.items.size > 4) ", and more" else ""}." +
            if (b.note.isNotBlank()) " ${b.note}" else "")
    }

    /** Everything the brain needs to answer a question about the trip, with items matching [query] first. Offline. */
    fun tripInfo(ctx: Context, query: String = ""): String {
        val trips = TripRepo.get(ctx); val t = trips.current() ?: return "No trip is saved. The wearer can share booking emails, PDFs or screenshots into Fieldnote, or tell you a booking to add."
        val words = Search.words(query)
        val items = t.items.sortedBy { if (it.start > 0) it.start else Long.MAX_VALUE }.let { l -> if (words.isEmpty()) l else l.sortedByDescending { Search.score(words, "${it.title} ${it.place} ${it.address} ${it.kind} ${it.detail}") } }
        val pack = OfflinePack.load(ctx, t.id)
        return buildString {
            append(TravelText.context(t, trips.currentStay()))
            append("All bookings (${items.size}): " + items.take(30).joinToString("; ") { TravelText.item(it) } + ". ")
            OfflinePack.emergency(countryNow(ctx))?.let { append("Emergency numbers where you are: ${it.spoken}. ") }
            if (pack == null) append("Offline pack not prepared yet. ") else {
                append("Offline pack prepared ${ago(pack.preparedAt)}${if (pack.translateReady) ", offline translation ready" else ""}. ")
                if (pack.tipping.isNotBlank()) append("Tipping: ${pack.tipping} ")
                if (pack.etiquette.isNotEmpty()) append("Etiquette: ${pack.etiquette.joinToString("; ")}. ")
            }
        }.trim()
    }

    /* ---------------- money ---------------- */

    fun convert(ctx: Context, amount: Double, from: String, to: String = ""): String {
        val prefs = Prefs.get(ctx)
        val f = from.uppercase().trim().ifBlank { TripRepo.get(ctx).current()?.currency ?: "" }; val t = to.uppercase().trim().ifBlank { prefs.homeCurrency }
        if (f.isBlank()) return "Which currency is that in?"
        val rates = Rates.get(ctx, prefs.homeCurrency) ?: return "I have no exchange rates saved and can't fetch them now."
        val v = rates.convert(amount, f, t) ?: return "I have no rate for ${if (!rates.has(f)) f else t}."
        return "${Money.spoken(amount, f)} is about ${Money.spoken(v, t)} (${Money.rateAge(rates)})."
    }

    /* ---------------- hand-off ---------------- */

    /** Meta's live translation hears the other person through the full mic array, which Fieldnote cannot (travel plan §7). */
    const val HAND_OFF = "Handing the glasses back to Meta. Say \"Hey Meta, start live translation\" and pick the language. When you're done, open Fieldnote and start the session again."

    private fun ago(t: Long): String { val m = (System.currentTimeMillis() - t) / 60000; return when { m < 1 -> "just now"; m < 60 -> "$m min ago"; m < 1440 -> "${m / 60} h ago"; else -> "${m / 1440} d ago" } }
}
