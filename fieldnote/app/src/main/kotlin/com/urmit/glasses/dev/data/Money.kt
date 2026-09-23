package com.urmit.glasses.dev.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit

/* ---------- Prices in rupees and the trip ledger (travel plan §6). Works offline on the last cached rate. ---------- */

/** Exchange rates against one base: [rates] maps a currency to units of it per 1 [base]. */
/** [at] is the provider's publication time (shown to the wearer); [fetched] is when this phone got it (drives refreshing). */
data class RateTable(val base: String, val at: Long, val source: String, val rates: Map<String, Double>, val fetched: Long = at) {
    fun has(c: String) = c == base || rates.containsKey(c)
    /** Converts between any two currencies in the table; null when either is missing. */
    fun convert(amount: Double, from: String, to: String): Double? {
        val f = if (from == base) 1.0 else rates[from] ?: return null
        val t = if (to == base) 1.0 else rates[to] ?: return null
        return amount / f * t
    }
    fun toJson(): JSONObject = JSONObject().put("base", base).put("at", at).put("source", source).put("rates", JSONObject(rates as Map<*, *>)).put("fetched", fetched)
    companion object {
        fun from(o: JSONObject): RateTable {
            val r = o.optJSONObject("rates") ?: JSONObject()
            return RateTable(o.optString("base"), o.optLong("at"), o.optString("source"), r.keys().asSequence().associateWith { r.getDouble(it) }, o.optLong("fetched", o.optLong("at")))
        }
    }
}

object Rates {
    private val client = OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS).build()
    @Volatile private var mem: RateTable? = null
    private fun file(ctx: Context) = File(ctx.filesDir, "rates.json")
    /** The latest table, for screens to observe: updated whenever anything (service, brain, Trip tab) fetches rates. */
    val table = MutableStateFlow<RateTable?>(null)

    /** Last saved table, or null if rates were never fetched. Never touches the network. */
    fun cached(ctx: Context): RateTable? = mem ?: runCatching { RateTable.from(JSONObject(file(ctx).readText())) }.getOrNull()?.also { mem = it; table.value = it }

    /** Cached rates if younger than [maxAgeMs] and on the same base, otherwise a fresh fetch; falls back to the cache offline. */
    fun get(ctx: Context, base: String, maxAgeMs: Long = 12 * 3_600_000L): RateTable? {
        val c = cached(ctx)
        // Age from our own fetch: the provider publishes once a day, so its timestamp made the cache look stale half the day.
        if (c != null && c.base == base && System.currentTimeMillis() - c.fetched < maxAgeMs) return c
        return runCatching { refresh(ctx, base) }.getOrNull() ?: c
    }

    /**
     * Fetches rates for [base]. open.er-api.com covers ~160 currencies with no key; Frankfurter (ECB, ~30 currencies) is the
     * fallback. Blocking: call off the main thread.
     */
    fun refresh(ctx: Context, base: String): RateTable {
        val b = base.uppercase(Locale.US)
        val t = runCatching {
            fetch("https://open.er-api.com/v6/latest/$b") { o ->
                if (o.optString("result") != "success") error("rates refused")
                RateTable(b, o.optLong("time_last_update_unix") * 1000, "ExchangeRate-API", toMap(o.getJSONObject("rates")))
            }
        }.getOrElse {
            fetch("https://api.frankfurter.dev/v1/latest?base=$b") { o -> RateTable(b, System.currentTimeMillis(), "Frankfurter (ECB)", toMap(o.getJSONObject("rates"))) }
        }
        val now = System.currentTimeMillis()
        val stamped = t.copy(at = if (t.at <= 0) now else t.at, fetched = now)
        runCatching { val tmp = File(ctx.filesDir, "rates.tmp"); tmp.writeText(stamped.toJson().toString()); tmp.renameTo(file(ctx)) }
        mem = stamped; table.value = stamped
        return stamped
    }

    private fun <T> fetch(url: String, parse: (JSONObject) -> T): T =
        client.newCall(Request.Builder().url(url).build()).execute().use { r -> if (!r.isSuccessful) error("rates ${r.code}"); parse(JSONObject(r.body?.string() ?: "{}")) }

    private fun toMap(o: JSONObject) = o.keys().asSequence().associateWith { o.getDouble(it) }
}

object Money {
    private val SPOKEN = mapOf(
        "INR" to "rupees", "JPY" to "yen", "USD" to "dollars", "EUR" to "euros", "GBP" to "pounds", "THB" to "baht", "SGD" to "Singapore dollars",
        "AED" to "dirhams", "CNY" to "yuan", "KRW" to "won", "VND" to "dong", "IDR" to "rupiah", "MYR" to "ringgit", "LKR" to "Sri Lankan rupees",
        "NPR" to "Nepali rupees", "CHF" to "Swiss francs", "AUD" to "Australian dollars", "HKD" to "Hong Kong dollars", "TRY" to "lira",
        "CAD" to "Canadian dollars", "NZD" to "New Zealand dollars", "PHP" to "pesos", "MXN" to "pesos", "TWD" to "Taiwan dollars", "QAR" to "riyals",
        "SAR" to "riyals", "OMR" to "rials", "BHD" to "dinars", "KWD" to "dinars", "EGP" to "Egyptian pounds", "ZAR" to "rand", "BDT" to "taka",
        "MVR" to "rufiyaa", "BTN" to "ngultrum", "SEK" to "kronor", "NOK" to "kroner", "DKK" to "kroner", "CZK" to "koruna", "HUF" to "forint", "PLN" to "zloty")
    private val SYMBOL = mapOf("INR" to "₹", "USD" to "$", "EUR" to "€", "GBP" to "£", "JPY" to "¥")

    private fun digits(cur: String) = runCatching { java.util.Currency.getInstance(cur).defaultFractionDigits }.getOrDefault(2).coerceAtLeast(0)

    /** Whole units once the amount is large enough that paise, cents or sen stop mattering. */
    private fun number(amount: Double, cur: String): String {
        val d = if (kotlin.math.abs(amount) >= 100) 0 else digits(cur)
        val nf = java.text.NumberFormat.getNumberInstance(if (cur == "INR") Locale("en", "IN") else Locale.UK)
        nf.minimumFractionDigits = if (d > 0 && amount % 1.0 != 0.0) d else 0; nf.maximumFractionDigits = d
        return nf.format(amount)
    }

    /** "₹1,234", "¥1,200", "THB 350". */
    fun fmt(amount: Double, cur: String): String = SYMBOL[cur]?.let { "$it${number(amount, cur)}" } ?: "$cur ${number(amount, cur)}"

    /** "1,200 yen", "about 680 rupees" reads naturally through text-to-speech. */
    fun spoken(amount: Double, cur: String): String = "${number(amount, cur)} ${SPOKEN[cur] ?: runCatching { java.util.Currency.getInstance(cur).getDisplayName(Locale.UK) }.getOrDefault(cur)}"

    /** "1,200 yen (about 680 rupees)"; just the local amount when no rate is known. */
    fun both(amount: Double, cur: String, home: String, rates: RateTable?): String {
        if (cur == home) return spoken(amount, cur)
        val h = rates?.convert(amount, cur, home) ?: return spoken(amount, cur)
        return "${spoken(amount, cur)} (about ${spoken(h, home)})"
    }

    private val TOKEN = Regex("""\{\{\s*([0-9][0-9.,]*)\s*([A-Za-z]{3})?\s*\}\}""")

    /**
     * Replaces the price tokens a lens was told to write, `{{1200}}` or `{{12.50 EUR}}`, with the amount in the local currency
     * and in the home currency: models read prices reliably but multiply badly, so the conversion happens here.
     */
    fun annotate(text: String, local: String, home: String, rates: RateTable?): String = TOKEN.replace(text) { m ->
        // "12,50" is a decimal comma (menus in euros); "1,200" is a thousands separator.
        val raw = m.groupValues[1]
        val amount = (if (Regex("""^\d+,\d{1,2}$""").matches(raw)) raw.replace(',', '.') else raw.replace(",", "")).toDoubleOrNull() ?: return@replace m.value
        val cur = m.groupValues[2].uppercase(Locale.US).ifBlank { local }
        if (cur.isBlank()) number(amount, "USD") else both(amount, cur, home, rates)
    }

    /** "rate of 22 Sep" for honesty about offline conversions. */
    fun rateAge(t: RateTable?): String = if (t == null) "no rate saved" else "rate of ${java.text.SimpleDateFormat("d MMM", Locale.UK).format(t.at)}"
}

/** One spend in the trip ledger. [home] is the amount in the home currency at the time it was logged (NaN when no rate was known). */
data class Expense(
    val id: String = UUID.randomUUID().toString(),
    val at: Long = System.currentTimeMillis(),
    val merchant: String = "",
    val category: String = "other",   // one of CATEGORIES
    val amount: Double,
    val currency: String,
    val home: Double = Double.NaN,
    val homeCurrency: String = "INR",
    val note: String = "",            // what the wearer said, or line items in short
    val photoKey: String = "",        // the receipt photo, "" for a spoken spend
    val tripId: String = "",
    val place: String = "",
    val taxNote: String = ""          // "service 10% added", "tax-free eligible", …
) {
    fun toJson(): JSONObject = JSONObject().put("id", id).put("at", at).put("merchant", merchant).put("category", category).put("amount", amount).put("currency", currency)
        .put("home", if (home.isNaN()) JSONObject.NULL else home).put("homeCurrency", homeCurrency).put("note", note).put("photoKey", photoKey).put("tripId", tripId).put("place", place).put("taxNote", taxNote)
    companion object {
        val CATEGORIES = listOf("food", "transport", "stay", "tickets", "shopping", "other")
        fun from(o: JSONObject) = Expense(o.optString("id"), o.optLong("at"), o.optString("merchant"), o.optString("category", "other").let { if (it in CATEGORIES) it else "other" },
            o.optDouble("amount", 0.0), o.optString("currency"), o.optDouble("home", Double.NaN), o.optString("homeCurrency", "INR"), o.optString("note"), o.optString("photoKey"),
            o.optString("tripId"), o.optString("place"), o.optString("taxNote"))
    }
}

class Ledger private constructor(ctx: Context) {
    private val file = File(ctx.filesDir, "expenses.json")
    private val lock = Any()
    private val _expenses = MutableStateFlow<List<Expense>>(load())
    val expenses: StateFlow<List<Expense>> = _expenses

    private fun load(): List<Expense> = runCatching {
        if (!file.exists()) return emptyList()
        val arr = JSONArray(file.readText()); (0 until arr.length()).map { Expense.from(arr.getJSONObject(it)) }.sortedByDescending { it.at }
    }.getOrElse { Store.quarantine(file); emptyList() }

    private fun persist(l: List<Expense>) { val tmp = File(file.parentFile, "expenses.tmp"); tmp.writeText(JSONArray().apply { l.forEach { put(it.toJson()) } }.toString()); tmp.renameTo(file) }

    fun get(id: String) = _expenses.value.firstOrNull { it.id == id }
    fun forPhoto(key: String) = _expenses.value.firstOrNull { it.photoKey == key }
    fun put(e: Expense) = synchronized(lock) { val l = (_expenses.value.filter { it.id != e.id } + e).sortedByDescending { it.at }; persist(l); _expenses.value = l }
    fun delete(id: String) = synchronized(lock) { val l = _expenses.value.filter { it.id != id }; persist(l); _expenses.value = l }

    fun forTrip(tripId: String) = _expenses.value.filter { it.tripId == tripId }
    fun between(from: Long, to: Long) = _expenses.value.filter { it.at in from until to }

    /** Sum in the home currency; spends logged without a rate are converted with [rates] now, or left out and counted in the second value. */
    fun totalHome(l: List<Expense>, home: String, rates: RateTable?): Pair<Double, Int> {
        var sum = 0.0; var missing = 0
        for (e in l) {
            val v = when { e.currency == home -> e.amount; !e.home.isNaN() && e.homeCurrency == home -> e.home; else -> rates?.convert(e.amount, e.currency, home) }
            if (v == null) missing++ else sum += v
        }
        return sum to missing
    }

    fun byCategory(l: List<Expense>, home: String, rates: RateTable?): List<Pair<String, Double>> =
        Expense.CATEGORIES.map { c -> c to totalHome(l.filter { it.category == c }, home, rates).first }.filter { it.second > 0 }

    /** Spreadsheet-friendly export: one row per spend. */
    fun csv(l: List<Expense>): String = buildString {
        append("date,time,merchant,category,amount,currency,home_amount,home_currency,place,note\n")
        val d = java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US); val t = java.text.SimpleDateFormat("HH:mm", Locale.US)
        fun q(s: String) = "\"" + s.replace("\"", "\"\"") + "\""
        l.sortedBy { it.at }.forEach { e -> append("${d.format(e.at)},${t.format(e.at)},${q(e.merchant)},${e.category},${e.amount},${e.currency},${if (e.home.isNaN()) "" else "%.2f".format(Locale.US, e.home)},${e.homeCurrency},${q(e.place)},${q(e.note)}\n") }
    }

    companion object {
        @Volatile private var inst: Ledger? = null
        fun get(ctx: Context) = inst ?: synchronized(this) { inst ?: Ledger(ctx.applicationContext).also { inst = it } }
    }
}

/** Logging and summing spends, shared by the receipt lens, the brain's tools and the Trip tab. */
object Spending {
    /** Adds a read receipt or spoken spend to the ledger, converting to the home currency with the freshest rate available. */
    fun log(ctx: Context, r: TravelAnalyst.ReceiptRead, photoKey: String = "", place: String = "", note: String = "", tripId: String? = null): Expense {
        val prefs = Prefs.get(ctx); val home = prefs.homeCurrency
        val rates = if (r.currency == home) null else Rates.get(ctx, home)
        val e = Expense(at = if (r.at > 0) r.at else System.currentTimeMillis(), merchant = r.merchant, category = r.category, amount = r.amount, currency = r.currency,
            home = if (r.currency == home) r.amount else rates?.convert(r.amount, r.currency, home) ?: Double.NaN, homeCurrency = home,
            note = listOf(note, r.items).filter { it.isNotBlank() }.joinToString(" · "), photoKey = photoKey, tripId = tripId ?: TripRepo.get(ctx).current()?.id ?: "", place = place, taxNote = r.taxNote)
        Ledger.get(ctx).put(e)
        Diagnostics.get(ctx).event("expense_logged", mapOf("category" to e.category, "currency" to e.currency, "photo" to photoKey.isNotBlank(), "converted" to !e.home.isNaN()))
        return e
    }

    /** "Logged 2,400 yen at Lawson (about 1,340 rupees). Today: 5,200 rupees; this trip: 31,000 rupees." */
    fun describe(ctx: Context, e: Expense): String {
        val prefs = Prefs.get(ctx); val home = prefs.homeCurrency; val rates = Rates.cached(ctx)
        val ledger = Ledger.get(ctx)
        val today = ledger.totalHome(ledger.between(dayStart(System.currentTimeMillis()), Long.MAX_VALUE), home, rates).first
        val trip = e.tripId.takeIf { it.isNotBlank() }?.let { ledger.totalHome(ledger.forTrip(it), home, rates).first }
        return buildString {
            append("Logged ${Money.spoken(e.amount, e.currency)}")
            if (e.merchant.isNotBlank()) append(" at ${e.merchant}")
            if (e.currency != home) append(if (e.home.isNaN()) " (no exchange rate saved yet)" else " (about ${Money.spoken(e.home, home)})")
            append(". Today: ${Money.spoken(today, home)}")
            if (trip != null) append("; this trip: ${Money.spoken(trip, home)}")
            append(".")
            if (prefs.dailyBudget > 0 && today > prefs.dailyBudget) append(" That's over your daily budget of ${Money.spoken(prefs.dailyBudget.toDouble(), home)}.")
            if (e.taxNote.isNotBlank()) append(" Note: ${e.taxNote.trimEnd('.')}.")
        }
    }

    /** Totals for today, the last [days] days, or the current trip ("trip"), by category, in the home currency. */
    fun summary(ctx: Context, period: String, days: Int = 1): String {
        val prefs = Prefs.get(ctx); val home = prefs.homeCurrency; val rates = Rates.cached(ctx); val ledger = Ledger.get(ctx)
        val trip = TripRepo.get(ctx).current()
        val (label, list) = when {
            period == "trip" && trip != null -> "On ${trip.name}" to ledger.forTrip(trip.id)
            period == "trip" -> "No trip is saved, so for the last 7 days" to ledger.between(dayStart(System.currentTimeMillis()) - 6 * 86_400_000L, Long.MAX_VALUE)
            days <= 1 -> "Today" to ledger.between(dayStart(System.currentTimeMillis()), Long.MAX_VALUE)
            else -> "In the last $days days" to ledger.between(dayStart(System.currentTimeMillis()) - (days - 1) * 86_400_000L, Long.MAX_VALUE)
        }
        if (list.isEmpty()) return "$label: nothing logged."
        val (total, missing) = ledger.totalHome(list, home, rates)
        return buildString {
            append("$label: ${Money.spoken(total, home)} across ${list.size} spend${if (list.size == 1) "" else "s"}")
            val cats = ledger.byCategory(list, home, rates)
            if (cats.size > 1) append(", " + cats.sortedByDescending { it.second }.joinToString(", ") { "${it.first} ${Money.spoken(it.second, home)}" })
            append(".")
            if (missing > 0) append(" $missing spend${if (missing == 1) " has" else "s have"} no exchange rate yet and aren't counted.")
            if (days <= 1 && period != "trip" && prefs.dailyBudget > 0) append(if (total > prefs.dailyBudget) " Over the daily budget of ${Money.spoken(prefs.dailyBudget.toDouble(), home)}." else " Within the daily budget of ${Money.spoken(prefs.dailyBudget.toDouble(), home)}.")
            append(" Recent: " + list.take(4).joinToString("; ") { "${it.merchant.ifBlank { it.category }} ${Money.fmt(it.amount, it.currency)}" } + ".")
        }
    }
}
