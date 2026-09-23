package com.urmit.glasses.dev.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/* ---------- Offline pack per destination (travel plan §3): one tap on Wi-Fi before flying ---------- */

data class Phrase(val situation: String, val en: String, val local: String, val roman: String) {
    fun toJson(): JSONObject = JSONObject().put("situation", situation).put("en", en).put("local", local).put("roman", roman)
    companion object { fun from(o: JSONObject) = Phrase(o.optString("situation"), o.optString("en"), o.optString("local"), o.optString("roman")) }
}

data class EmergencyNumbers(val country: String, val general: String, val police: String = "", val ambulance: String = "", val fire: String = "") {
    /** "Police 110, ambulance and fire 119" for speech and the card. */
    val spoken: String get() {
        val parts = mutableListOf<String>()
        if (general.isNotBlank()) parts += "all emergencies $general"
        val rest = listOf("police" to police, "ambulance" to ambulance, "fire" to fire).filter { it.second.isNotBlank() && it.second != general }
        rest.groupBy { it.second }.forEach { (num, names) -> parts += names.joinToString(" and ") { it.first } + " $num" }
        return parts.joinToString(", ").replaceFirstChar { it.uppercase() }
    }
}

internal fun allergyKey(p: Prefs) = "${p.diet.trim()}|${p.allergies.trim()}"

data class Pack(
    val tripId: String,
    val preparedAt: Long,
    val language: String,
    val phrases: List<Phrase> = emptyList(),
    val allergyLocal: String = "", val allergyEn: String = "",
    val driverRequestLocal: String = "", val driverRequestEn: String = "",
    val etiquette: List<String> = emptyList(),
    val tipping: String = "",
    val rateAt: Long = 0,
    val translateReady: Boolean = false,
    val readReady: Boolean = false,
    val placed: Int = 0,                 // trip items given map coordinates
    val problems: List<String> = emptyList(),
    val allergySource: String = ""       // the profile's diet + allergies the allergy card was written from
) {
    /** True when the profile's diet or allergies changed after this pack was written: the card needs a refresh. */
    fun allergyStale(p: Prefs) = allergySource.isNotEmpty() && allergySource != allergyKey(p)   // packs from before 3.4 final: unknown, not stale
    fun toJson(): JSONObject = JSONObject().put("tripId", tripId).put("preparedAt", preparedAt).put("language", language)
        .put("phrases", JSONArray().apply { phrases.forEach { put(it.toJson()) } }).put("allergyLocal", allergyLocal).put("allergyEn", allergyEn)
        .put("driverRequestLocal", driverRequestLocal).put("driverRequestEn", driverRequestEn).put("etiquette", JSONArray(etiquette)).put("tipping", tipping)
        .put("rateAt", rateAt).put("translateReady", translateReady).put("readReady", readReady).put("placed", placed).put("problems", JSONArray(problems)).put("allergySource", allergySource)
    companion object {
        fun from(o: JSONObject): Pack {
            fun strs(k: String) = o.optJSONArray(k)?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList()
            val ph = o.optJSONArray("phrases") ?: JSONArray()
            return Pack(o.optString("tripId"), o.optLong("preparedAt"), o.optString("language"), (0 until ph.length()).map { Phrase.from(ph.getJSONObject(it)) },
                o.optString("allergyLocal"), o.optString("allergyEn"), o.optString("driverRequestLocal"), o.optString("driverRequestEn"), strs("etiquette"), o.optString("tipping"),
                o.optLong("rateAt"), o.optBoolean("translateReady"), o.optBoolean("readReady"), o.optInt("placed"), strs("problems"), o.optString("allergySource"))
        }
    }
}

object OfflinePack {
    private fun file(ctx: Context, tripId: String) = File(ctx.filesDir, "pack_${tripId.filter { it.isLetterOrDigit() || it == '-' }}.json")

    fun load(ctx: Context, tripId: String): Pack? = runCatching { Pack.from(JSONObject(file(ctx, tripId).readText())) }.getOrNull()
    fun delete(ctx: Context, tripId: String) { file(ctx, tripId).delete() }

    /**
     * Builds the pack for a trip: fresh exchange rates, map points for addresses (so "take me home" works offline), phrases,
     * allergy and driver cards and local-script addresses from the model, then the on-device translation and reading models.
     * Each step that fails is recorded in [Pack.problems] instead of stopping the rest.
     */
    suspend fun prepare(ctx: Context, tripId: String, onStep: (String) -> Unit = {}): Pack = withContext(Dispatchers.IO) {
        val prefs = Prefs.get(ctx); val trips = TripRepo.get(ctx)
        val problems = mutableListOf<String>()
        var trip = trips.get(tripId) ?: throw AnalystError("That trip no longer exists")
        val lang = trip.language.ifBlank { "en" }

        onStep("Exchange rates")
        val rates = runCatching { Rates.refresh(ctx, prefs.homeCurrency) }.onFailure { problems += "Exchange rates: couldn't fetch (${it.message})" }.getOrNull()
        if (rates != null && trip.currency.isNotBlank() && !rates.has(trip.currency)) problems += "No exchange rate for ${trip.currency}"

        onStep("Placing addresses on the map")
        var placed = 0
        for (it in trip.items.filter { !it.hasPoint && (it.address.isNotBlank() || it.addressLocal.isNotBlank()) }) {
            val p = Locator.forward(ctx, it.address.ifBlank { it.addressLocal }) ?: Locator.forward(ctx, "${it.place.ifBlank { it.title }}, ${trip.destination}")
            if (p != null) { trips.updateItem(tripId, it.copy(lat = p.first, lng = p.second)); placed++ } else problems += "Couldn't place ${it.place.ifBlank { it.title }} on the map"
        }
        trip = trips.get(tripId) ?: trip

        onStep("Writing phrases and cards")
        val text = if (lang == "en" && prefs.allergies.isBlank()) null else runCatching { TravelAnalyst.packText(prefs, trip, lang) }.onFailure { problems += "Phrases: ${it.message}" }.getOrNull()
        text?.addressesLocal?.forEach { (id, local) -> trip.items.firstOrNull { it.id == id && it.addressLocal.isBlank() }?.let { trips.updateItem(tripId, it.copy(addressLocal = local)) } }

        onStep("Downloading offline translation")
        val canTranslate = lang != "en" && OnDevice.canTranslate(lang)
        val translateReady = if (canTranslate) runCatching { OnDevice.ensureTranslateModel(ctx, lang) }.onFailure { problems += "Offline translation: ${it.message}" }.getOrDefault(false) else false
        if (lang != "en" && !canTranslate) problems += "Offline translation isn't available for this language"

        onStep("Getting text reading ready")
        val readReady = runCatching { OnDevice.ensureReader(ctx, lang) }.onFailure { problems += "Offline reading: ${it.message}" }.getOrDefault(false)

        val pack = Pack(tripId, System.currentTimeMillis(), lang, text?.phrases ?: emptyList(), text?.allergyLocal ?: "", text?.allergyEn ?: "",
            text?.driverRequestLocal ?: "", text?.driverRequestEn ?: "", text?.etiquette ?: emptyList(), text?.tipping ?: "", rates?.at ?: 0, translateReady, readReady, placed, problems,
            allergyKey(prefs))
        // The trip may have been deleted while the pack was being built: don't leave an orphan pack behind.
        if (trips.get(tripId) != null) runCatching { val f = file(ctx, tripId); val tmp = File(f.parentFile, f.name + ".tmp"); tmp.writeText(pack.toJson().toString()); tmp.renameTo(f) }
        Diagnostics.get(ctx).event("pack_ready", mapOf("lang" to lang, "phrases" to pack.phrases.size, "translate" to translateReady, "read" to readReady, "placed" to placed, "problems" to problems.size))
        pack
    }

    /**
     * Emergency numbers for common destinations, built in so they work with no data. Compiled from the widely published
     * national numbers (September 2026) but not re-verified source by source, so the card tells the wearer to confirm locally.
     */
    fun emergency(country: String): EmergencyNumbers? {
        val c = country.uppercase(java.util.Locale.US)
        if (c in EU112) return EmergencyNumbers(c, "112")
        return TABLE[c]
    }

    private val EU112 = setOf("AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "NO", "LI", "TR", "RU", "GE", "AM")
    private val TABLE = listOf(
        EmergencyNumbers("IN", "112", "100", "108", "101"),
        EmergencyNumbers("GB", "999"), EmergencyNumbers("CH", "112", "117", "144", "118"),
        EmergencyNumbers("US", "911"), EmergencyNumbers("CA", "911"), EmergencyNumbers("MX", "911"), EmergencyNumbers("PH", "911"),
        EmergencyNumbers("AU", "000"), EmergencyNumbers("NZ", "111"),
        EmergencyNumbers("JP", "", "110", "119", "119"), EmergencyNumbers("KR", "", "112", "119", "119"), EmergencyNumbers("TW", "", "110", "119", "119"),
        EmergencyNumbers("CN", "", "110", "120", "119"), EmergencyNumbers("HK", "999"), EmergencyNumbers("MO", "999"),
        EmergencyNumbers("SG", "", "999", "995", "995"), EmergencyNumbers("MY", "999"), EmergencyNumbers("BD", "999"),
        EmergencyNumbers("TH", "", "191", "1669", "199"), EmergencyNumbers("VN", "", "113", "115", "114"), EmergencyNumbers("ID", "112", "110", "118", "113"),
        EmergencyNumbers("AE", "", "999", "998", "997"), EmergencyNumbers("QA", "999"), EmergencyNumbers("OM", "9999"), EmergencyNumbers("SA", "911"),
        EmergencyNumbers("LK", "", "119", "1990", "110"), EmergencyNumbers("NP", "", "100", "102", "101"), EmergencyNumbers("BT", "", "113", "112", "110"),
        EmergencyNumbers("MV", "", "119", "102", "118"), EmergencyNumbers("EG", "", "122", "123", "180"), EmergencyNumbers("ZA", "112", "10111", "10177", ""),
        EmergencyNumbers("BR", "", "190", "192", "193"), EmergencyNumbers("IL", "", "100", "101", "102"), EmergencyNumbers("KE", "999")
    ).associateBy { it.country }
}
