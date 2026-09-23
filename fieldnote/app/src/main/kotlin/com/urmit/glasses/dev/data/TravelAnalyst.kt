package com.urmit.glasses.dev.data

import android.util.Base64
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * Structured reads for travel (travel plan §3, §6, §7): bookings into the trip brain, prices and receipts into numbers the
 * phone converts itself, and the offline pack's phrases. Same key and provider as the lenses; every call counts towards the
 * daily spend cap.
 */
object TravelAnalyst {
    private val client = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS).readTimeout(120, TimeUnit.SECONDS).build()

    /** One JSON-mode chat call. Images go in as low-detail JPEG data URLs. */
    private fun json(prefs: Prefs, model: String, system: String, text: String, images: List<File> = emptyList(), maxTokens: Int = 1200, detail: String = "low"): JSONObject {
        val key = prefs.apiKey
        if (key.isBlank()) throw AnalystError("Add your API key in Glasses → Answers")
        Llm.checkCap(prefs)
        val content = JSONArray().put(JSONObject().put("type", "text").put("text", text))
        images.forEach { f -> content.put(JSONObject().put("type", "image_url").put("image_url", JSONObject().put("url", "data:image/jpeg;base64," + Base64.encodeToString(f.readBytes(), Base64.NO_WRAP)).put("detail", detail))) }
        val body = Llm.limits(JSONObject().put("model", model).put("response_format", JSONObject().put("type", "json_object"))
            .put("messages", JSONArray().put(JSONObject().put("role", "system").put("content", system)).put(JSONObject().put("role", "user").put("content", content))), key, model, maxTokens, 0.1)
        val req = Request.Builder().url("${Analyst.baseUrl(key)}/chat/completions").header("Authorization", "Bearer $key").header("HTTP-Referer", "https://fieldnote.app").header("X-Title", "Fieldnote")
            .post(body.toString().toRequestBody("application/json".toMediaType())).build()
        val resp = try { client.newCall(req).execute() } catch (e: java.io.IOException) { throw AnalystError("No internet right now", network = true) }
        resp.use { r ->
            val raw = r.body?.string() ?: ""
            if (!r.isSuccessful) throw AnalystError("The model said no (${r.code}): " + runCatching { JSONObject(raw).getJSONObject("error").getString("message") }.getOrDefault(raw.take(120)))
            val o = JSONObject(raw)
            prefs.spentTodayCents = prefs.spentTodayCents + Llm.cents(o)
            return parseJson(Llm.content(o.getJSONArray("choices").getJSONObject(0).getJSONObject("message")))
        }
    }

    /** Models sometimes wrap JSON in a code fence or add a sentence around it; take the outermost object. */
    internal fun parseJson(c: String): JSONObject {
        val t = c.trim().removePrefix("```json").removePrefix("```").removeSuffix("```").trim()
        return runCatching { JSONObject(t) }.getOrElse {
            val a = t.indexOf('{'); val b = t.lastIndexOf('}')
            if (a >= 0 && b > a) JSONObject(t.substring(a, b + 1)) else throw AnalystError("The model's answer wasn't readable. Try again.")
        }
    }

    private fun num(o: JSONObject, k: String): Double? = when (val v = o.opt(k)) { is Number -> v.toDouble(); is String -> v.replace(",", "").trim().toDoubleOrNull(); else -> null }

    /** "2026-10-03T14:05" in [tz] (or the phone's zone) to epoch ms; 0 when missing or unreadable. Date-only means midday. */
    internal fun epoch(local: String, tz: String): Long {
        if (local.isBlank()) return 0
        val zone = runCatching { ZoneId.of(tz) }.getOrElse { ZoneId.systemDefault() }
        return runCatching { LocalDateTime.parse(local.trim().take(16)).atZone(zone).toInstant().toEpochMilli() }
            .recoverCatching { java.time.LocalDate.parse(local.trim().take(10)).atTime(12, 0).atZone(zone).toInstant().toEpochMilli() }
            .getOrDefault(0)
    }

    /* ---------------- bookings → trip brain ---------------- */

    data class Bookings(val tripName: String, val destination: String, val country: String, val currency: String, val languages: List<String>, val items: List<TripItem>, val note: String)

    private const val BOOKINGS = """You read travel booking confirmations (emails, PDFs, screenshots, tickets, or a traveller's own words) and turn them into a clean itinerary. Extract every booking you can see: flights (one item per flight leg), hotels and other stays, trains, buses, ferries, car hire, event or museum tickets, restaurant tables, tours.
Rules:
- Times are LOCAL times at the place they happen, as printed, in ISO form "YYYY-MM-DDTHH:MM" (use the date alone "YYYY-MM-DD" if no time is given). Give the IANA time zone of that place in "tz" (e.g. "Asia/Tokyo"). For a flight, start = departure (departure airport's zone), end = arrival; put the arrival zone in "detail" if it differs, e.g. "arrives 06:10 local".
- For stays, start = check-in, end = check-out.
- title: short and speakable: "AI 306 Delhi to Tokyo Narita", "Hotel Gracery Shinjuku", "Shinkansen Tokyo to Kyoto", "teamLab Planets tickets".
- address: exactly as written. address_local: the address in the destination's own script ONLY if it is printed in the booking; otherwise "".
- code: the booking reference, PNR or confirmation number. phone: the property's or operator's phone if shown. detail: seat, terminal, gate, room, what is included, in a few words.
- Never invent a booking, time, address or code. Skip marketing, loyalty points and prices.
- Also give the trip's main destination: a short trip name ("Japan, October"), destination ("Tokyo and Kyoto, Japan"), ISO country code, ISO 4217 local currency, and the BCP-47 codes of the local languages (main first).
Reply ONLY with JSON: {"trip_name":"","destination":"","country":"","currency":"","languages":[""],"items":[{"kind":"flight|stay|train|bus|ferry|car|ticket|table|tour|other","title":"","start":"","end":"","tz":"","place":"","address":"","address_local":"","phone":"","code":"","detail":""}],"note":"one short sentence on anything unclear, or empty"}"""

    /**
     * Reads bookings from pasted/shared [text] and/or [images] (screenshots, photos of tickets, PDF pages rendered to JPEG).
     * [existing] gives the model the trip so far, so a hotel email for the same trip is not treated as a new destination.
     */
    fun extractBookings(prefs: Prefs, text: String, images: List<File>, existing: Trip?): Bookings {
        if (text.isBlank() && images.isEmpty()) throw AnalystError("Nothing to read yet")
        val prompt = buildString {
            append("Today is ${java.text.SimpleDateFormat("EEEE d MMMM yyyy", Locale.UK).format(System.currentTimeMillis())}. The traveller's home currency is ${prefs.homeCurrency}.")
            if (existing != null) append(" Trip so far: ${TravelText.context(existing, null, 0)}")
            if (text.isNotBlank()) append("\n\nBooking text:\n" + text.take(24_000))
            if (images.isNotEmpty()) append("\n\n${images.size} image(s) of bookings attached.")
        }
        // High detail for images: booking references and times are small print.
        val o = json(prefs, prefs.modelFor(Lenses.READ.id), BOOKINGS, prompt, images.take(6), maxTokens = 2500, detail = "high")
        val arr = o.optJSONArray("items") ?: JSONArray()
        val items = (0 until arr.length()).mapNotNull { i ->
            val it = arr.optJSONObject(i) ?: return@mapNotNull null
            val title = it.optString("title").trim().ifBlank { return@mapNotNull null }
            val tz = it.optString("tz").trim()
            TripItem(UUID.randomUUID().toString(), it.optString("kind", "other").lowercase(Locale.US).let { k -> if (k in TripItem.KINDS) k else "other" }, title,
                epoch(it.optString("start"), tz), epoch(it.optString("end"), tz), it.optString("place").trim(), it.optString("address").trim(), it.optString("address_local").trim(),
                it.optString("phone").trim(), it.optString("code").trim(), it.optString("detail").trim(), Double.NaN, Double.NaN, tz)
        }
        val langs = o.optJSONArray("languages")?.let { a -> (0 until a.length()).map { a.optString(it).trim() }.filter { it.isNotBlank() } } ?: emptyList()
        return Bookings(o.optString("trip_name").trim(), o.optString("destination").trim(), o.optString("country").trim().uppercase(Locale.US).take(2),
            o.optString("currency").trim().uppercase(Locale.US).take(3), langs, items, o.optString("note").trim())
    }

    /* ---------------- price in rupees ---------------- */

    data class PriceLine(val label: String, val amount: Double)
    data class PriceRead(val currency: String, val lines: List<PriceLine>, val total: Double?, val note: String)

    private const val PRICES = """You read prices from a photo: a price tag, shelf label, menu board, bill or ticket machine. Report the amounts exactly as printed; never convert currencies.
- currency: ISO 4217 code of the prices shown (infer from symbols, language and the trip's local currency if unmarked).
- lines: up to 8 of the most relevant priced things, label in plain English, amount as a plain number.
- total: the amount to pay if there is one (bill total), else null.
- note: one short sentence on tax, service charge, deposit, per-kg/per-person pricing or discounts if printed; else "".
Reply ONLY with JSON: {"currency":"","lines":[{"label":"","amount":0}],"total":null,"note":""}"""

    fun readPrices(prefs: Prefs, photo: File, trip: Trip?, question: String = ""): PriceRead {
        val prompt = buildString {
            append("Trip local currency: ${trip?.currency?.ifBlank { null } ?: "unknown"}. ")
            if (trip?.destination?.isNotBlank() == true) append("Destination: ${trip.destination}. ")
            if (question.isNotBlank()) append("The wearer asks: \"$question\". Put what they asked about first. ")
        }
        val o = json(prefs, prefs.modelFor(Lenses.PRICE.id), PRICES, prompt, listOf(photo), maxTokens = 700, detail = "high")
        val arr = o.optJSONArray("lines") ?: JSONArray()
        val lines = (0 until arr.length()).mapNotNull { i -> arr.optJSONObject(i)?.let { l -> num(l, "amount")?.let { PriceLine(l.optString("label").trim(), it) } } }
        val cur = o.optString("currency").trim().uppercase(Locale.US).take(3).ifBlank { trip?.currency ?: "" }
        return PriceRead(cur, lines, num(o, "total"), o.optString("note").trim())
    }

    /** Spoken answer for a price read: amounts in both currencies, converted here, with the rate's age when it is old. */
    fun speakPrices(p: PriceRead, home: String, rates: RateTable?): String {
        if (p.lines.isEmpty() && p.total == null) return "I couldn't find a price in that photo."
        val c = p.currency.ifBlank { home }
        return buildString {
            if (p.total != null) append("The total is ${Money.both(p.total, c, home, rates)}. ")
            p.lines.take(if (p.total != null) 3 else 5).forEach { append("${it.label.ifBlank { "Item" }}: ${Money.both(it.amount, c, home, rates)}. ") }
            if (p.note.isNotBlank()) append(p.note.trimEnd('.') + ". ")
            if (c != home && rates != null && System.currentTimeMillis() - rates.at > 2 * 86_400_000L) append("That uses the ${Money.rateAge(rates)}.")
            if (c != home && (rates == null || !rates.has(c))) append("I have no exchange rate for ${c.ifBlank { "this currency" }} yet.")
        }.trim()
    }

    /* ---------------- receipt to ledger ---------------- */

    data class ReceiptRead(val merchant: String, val category: String, val amount: Double, val currency: String, val at: Long, val items: String, val taxNote: String)

    private const val RECEIPT = """You turn a receipt, bill, ticket or a traveller's spoken spend ("taxi 2400 yen", "lunch 18 euros") into one ledger entry. Never convert currencies.
- merchant: shop, restaurant or operator name, short. category: food | transport | stay | tickets | shopping | other.
- amount: the total actually paid, as a plain number, including tax and service if charged. currency: ISO 4217 code.
- time: local date and time printed on the receipt as "YYYY-MM-DDTHH:MM", or "" if none.
- items: up to five main items, comma separated, in plain English. tax_note: tax, service charge or tax-free eligibility if printed, else "".
If there is no amount at all, set amount to 0.
Reply ONLY with JSON: {"merchant":"","category":"","amount":0,"currency":"","time":"","items":"","tax_note":""}"""

    /** [photo] null = a spoken or typed spend only. [spoken] adds what the wearer said ("split with Ravi", "that was the taxi"). */
    fun readReceipt(prefs: Prefs, photo: File?, spoken: String, trip: Trip?): ReceiptRead {
        if (photo == null && spoken.isBlank()) throw AnalystError("Nothing to log yet")
        // Receipt times are local to where the phone is (it switches zone when you land), not the trip's first booking.
        val tz = ""
        val prompt = buildString {
            append("Trip local currency: ${trip?.currency?.ifBlank { null } ?: "unknown"}; home currency ${prefs.homeCurrency}. ")
            if (photo == null) append("No photo: the traveller said: \"$spoken\".") else if (spoken.isNotBlank()) append("The traveller adds: \"$spoken\". Trust it over the photo.")
        }
        val o = json(prefs, prefs.modelFor(Lenses.RECEIPT.id), RECEIPT, prompt, listOfNotNull(photo), maxTokens = 500, detail = "high")
        val amount = num(o, "amount") ?: 0.0
        if (amount <= 0) throw AnalystError(if (photo != null) "I couldn't find a total on that receipt." else "I didn't catch an amount.")
        val cat = o.optString("category").lowercase(Locale.US).let { if (it in Expense.CATEGORIES) it else "other" }
        return ReceiptRead(o.optString("merchant").trim(), cat, amount, o.optString("currency").trim().uppercase(Locale.US).take(3).ifBlank { trip?.currency?.ifBlank { null } ?: prefs.homeCurrency },
            epoch(o.optString("time"), tz), o.optString("items").trim(), o.optString("tax_note").trim())
    }

    /* ---------------- offline pack text ---------------- */

    data class PackText(
        val phrases: List<Phrase>,
        val allergyLocal: String, val allergyEn: String,
        val driverRequestLocal: String, val driverRequestEn: String,
        val addressesLocal: Map<String, String>,   // TripItem.id → address in the local script
        val etiquette: List<String>, val tipping: String
    )

    private const val PACK = """You prepare an offline phrase pack for a traveller from India, to be used with no internet. Write natural, polite, commonly used phrasing a local would understand; keep each phrase short enough to show on a phone screen. "roman" is a pronunciation guide in Latin letters (empty for languages already in Latin script).
Situations: taxi, hotel, restaurant, pharmacy, shop, help. Five to eight phrases each, the most useful first.
allergy_local / allergy_en: a clear card for a waiter or cook built from the traveller's diet and allergies; say plainly if an allergy is medical and serious. Empty if they have none.
driver_request_local / driver_request_en: one polite line asking a driver to take them to the address shown.
addresses_local: for each stay or place id given, the address written the way a local driver would read it, in the local script. Only if you are confident; otherwise leave that id out.
etiquette: up to six short, practical notes (greetings, shoes, queues, photography, dress at religious sites). tipping: one or two sentences.
Reply ONLY with JSON: {"phrases":[{"situation":"taxi","en":"","local":"","roman":""}],"allergy_local":"","allergy_en":"","driver_request_local":"","driver_request_en":"","addresses_local":{"<id>":""},"etiquette":[""],"tipping":""}"""

    fun packText(prefs: Prefs, trip: Trip, language: String): PackText {
        val places = trip.items.filter { it.address.isNotBlank() && it.kind in setOf("stay", "table", "ticket", "tour", "other") }.take(12)
        val prompt = buildString {
            append("Destination: ${trip.destination.ifBlank { trip.name }} (${trip.country}). Language for the pack: $language. ")
            append("Traveller: ${Profile.context(prefs)} ")
            if (places.isNotEmpty()) append("Places (id → name, address): " + places.joinToString("; ") { "${it.id} → ${it.place.ifBlank { it.title }}, ${it.address}" })
        }
        val o = json(prefs, prefs.agentModel, PACK, prompt, maxTokens = 4000)
        val arr = o.optJSONArray("phrases") ?: JSONArray()
        val phrases = (0 until arr.length()).mapNotNull { i -> arr.optJSONObject(i)?.let { p -> Phrase(p.optString("situation", "help").lowercase(Locale.US), p.optString("en").trim(), p.optString("local").trim(), p.optString("roman").trim()).takeIf { it.en.isNotBlank() && it.local.isNotBlank() } } }
        val addr = o.optJSONObject("addresses_local")?.let { a -> a.keys().asSequence().associateWith { a.optString(it).trim() }.filterValues { it.isNotBlank() }.filterKeys { k -> places.any { it.id == k } } } ?: emptyMap()
        val et = o.optJSONArray("etiquette")?.let { a -> (0 until a.length()).map { a.optString(it).trim() }.filter { it.isNotBlank() } } ?: emptyList()
        return PackText(phrases, o.optString("allergy_local").trim(), o.optString("allergy_en").trim(), o.optString("driver_request_local").trim(), o.optString("driver_request_en").trim(), addr, et, o.optString("tipping").trim())
    }
}
