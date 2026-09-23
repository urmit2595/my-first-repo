package com.urmit.glasses.dev.data

import android.content.Context
import android.net.Uri
import android.util.Base64
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit

/* ---------- Plateful, folded into Fieldnote: meals, daily totals, trends ---------- */

data class FoodItem(val name: String, val quantity: String, val kcalMin: Int, val kcalMax: Int, val proteinG: Int) {
    fun toJson() = JSONObject().put("name", name).put("quantity", quantity).put("kcalMin", kcalMin).put("kcalMax", kcalMax).put("proteinG", proteinG)
    companion object { fun from(o: JSONObject) = FoodItem(o.optString("name"), o.optString("quantity"), o.optInt("kcalMin"), o.optInt("kcalMax"), o.optInt("proteinG")) }
}

data class Meal(
    val id: String,
    val photoKey: String,          // Gallery key of the photo, or "" for a spoken/typed meal
    val eatenAt: Long,
    val title: String,
    val items: List<FoodItem> = emptyList(),
    val kcalMin: Int = 0, val kcalMax: Int = 0,
    val proteinMin: Int = 0, val proteinMax: Int = 0,
    val confidence: String = "medium",
    val question: String = "",     // one thing the model was unsure about
    val note: String = "",         // what the wearer said about it
    val model: String = ""
) {
    val kcalMid get() = (kcalMin + kcalMax) / 2
    val proteinMid get() = (proteinMin + proteinMax) / 2
    fun toJson(): JSONObject = JSONObject().put("id", id).put("photoKey", photoKey).put("eatenAt", eatenAt).put("title", title)
        .put("items", JSONArray().apply { items.forEach { put(it.toJson()) } })
        .put("kcalMin", kcalMin).put("kcalMax", kcalMax).put("proteinMin", proteinMin).put("proteinMax", proteinMax)
        .put("confidence", confidence).put("question", question).put("note", note).put("model", model)
    companion object {
        fun from(o: JSONObject): Meal {
            val arr = o.optJSONArray("items") ?: JSONArray()
            return Meal(o.getString("id"), o.optString("photoKey"), o.optLong("eatenAt"), o.optString("title"),
                (0 until arr.length()).map { FoodItem.from(arr.getJSONObject(it)) },
                o.optInt("kcalMin"), o.optInt("kcalMax"), o.optInt("proteinMin"), o.optInt("proteinMax"),
                o.optString("confidence", "medium"), o.optString("question"), o.optString("note"), o.optString("model"))
        }
    }
}

data class DayTotals(val day: Long, val kcalMin: Int, val kcalMax: Int, val protein: Int, val meals: Int) { val kcalMid get() = (kcalMin + kcalMax) / 2 }

class FoodRepo private constructor(ctx: Context) {
    private val file = File(ctx.filesDir, "meals.json")
    private val lock = Any()
    private val _meals = MutableStateFlow<List<Meal>>(load())
    val meals: StateFlow<List<Meal>> = _meals

    private fun load(): List<Meal> = runCatching {
        if (!file.exists()) return emptyList()
        val arr = JSONArray(file.readText()); (0 until arr.length()).map { Meal.from(arr.getJSONObject(it)) }.sortedByDescending { it.eatenAt }
    }.getOrElse { Store.quarantine(file); emptyList() }

    private fun persist(l: List<Meal>) { val tmp = File(file.parentFile, "meals.tmp"); tmp.writeText(JSONArray().apply { l.forEach { put(it.toJson()) } }.toString()); tmp.renameTo(file) }

    fun get(id: String) = _meals.value.firstOrNull { it.id == id }
    fun put(m: Meal) = synchronized(lock) { val l = (_meals.value.filter { it.id != m.id } + m).sortedByDescending { it.eatenAt }; persist(l); _meals.value = l }
    fun delete(id: String) = synchronized(lock) { val l = _meals.value.filter { it.id != id }; persist(l); _meals.value = l }
    fun forPhoto(key: String) = _meals.value.firstOrNull { it.photoKey == key }

    fun totals(day: Long): DayTotals {
        val end = day + 86_400_000L
        val ms = _meals.value.filter { it.eatenAt in day until end }
        return DayTotals(day, ms.sumOf { it.kcalMin }, ms.sumOf { it.kcalMax }, ms.sumOf { it.proteinMid }, ms.size)
    }
    fun lastDays(n: Int, today: Long): List<DayTotals> = (n - 1 downTo 0).map { totals(today - it * 86_400_000L) }

    companion object {
        @Volatile private var inst: FoodRepo? = null
        fun get(ctx: Context) = inst ?: synchronized(this) { inst ?: FoodRepo(ctx.applicationContext).also { inst = it } }
    }
}

/** Structured meal estimate from a photo and/or the wearer's words. */
object FoodAnalyst {
    private val client = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS).readTimeout(90, TimeUnit.SECONDS).build()
    private const val SYSTEM = """You are a careful nutritionist helping someone in India track what they eat (assume Indian home and restaurant food unless the photo clearly shows otherwise). Estimate the dish and its calories and protein. Be honest about uncertainty: give ranges, not single numbers. Use everyday Indian portions (katori, roti, tsp of ghee). If the photo is not food or drink set is_food=false. If something important is unknowable (how many rotis, ghee or oil, sugar in the chai), put ONE short question in `question` and set confidence "low"; otherwise leave `question` empty. If the person tells you what they ate, trust them over the photo.
Reply ONLY with JSON: {"is_food":bool,"title":"short dish name, e.g. Dal, two rotis, sabzi","items":[{"name":"","quantity":"e.g. 2 pieces / 1 katori","kcal_min":0,"kcal_max":0,"protein_g":0}],"kcal_min":0,"kcal_max":0,"protein_min":0,"protein_max":0,"confidence":"low|medium|high","question":""}"""

    class NotFood : Exception("That doesn't look like food")

    fun analyse(key: String, model: String, photo: File?, aboutMe: String, note: String, previous: Meal? = null, prefs: Prefs? = null): Meal {
        if (key.isBlank()) throw AnalystError("Add your API key in Glasses → Answers")
        prefs?.let { Llm.checkCap(it) }
        if (photo == null && note.isBlank()) throw AnalystError("Nothing to log yet")
        val text = buildString {
            append(if (photo != null) "Estimate this meal." else "Estimate this meal from the description alone.")
            if (aboutMe.isNotBlank()) append(" About me: $aboutMe.")
            if (previous != null) append(" Your earlier estimate: ${previous.title}, ${previous.kcalMin}-${previous.kcalMax} kcal; items: ${previous.items.joinToString("; ") { "${it.name} ${it.quantity}" }}.")
            if (note.isNotBlank()) append(" The person eating says: \"$note\". Trust that, and clear the question if it answers it.")
        }
        val content = JSONArray().put(JSONObject().put("type", "text").put("text", text))
        if (photo != null) content.put(JSONObject().put("type", "image_url").put("image_url", JSONObject().put("url", "data:image/jpeg;base64," + Base64.encodeToString(photo.readBytes(), Base64.NO_WRAP)).put("detail", "low")))
        val body = Llm.limits(JSONObject().put("model", model).put("response_format", JSONObject().put("type", "json_object"))
            .put("messages", JSONArray().put(JSONObject().put("role", "system").put("content", SYSTEM)).put(JSONObject().put("role", "user").put("content", content))), key, model, 600, 0.2)
        val req = Request.Builder().url("${Analyst.baseUrl(key)}/chat/completions").header("Authorization", "Bearer $key").header("HTTP-Referer", "https://fieldnote.app").header("X-Title", "Fieldnote")
            .post(body.toString().toRequestBody("application/json".toMediaType())).build()
        val resp = try { client.newCall(req).execute() } catch (e: java.io.IOException) { throw AnalystError("No internet right now", network = true) }
        resp.use { r ->
            val raw = r.body?.string() ?: ""
            if (!r.isSuccessful) throw AnalystError("The model said no (${r.code}): " + runCatching { JSONObject(raw).getJSONObject("error").getString("message") }.getOrDefault(raw.take(120)))
            val resp0 = JSONObject(raw)
            // Meal estimates now count towards the daily spend cap like every other call.
            prefs?.let { it.spentTodayCents = it.spentTodayCents + Llm.cents(resp0) }
            var c = Llm.content(resp0.getJSONArray("choices").getJSONObject(0).getJSONObject("message")).trim()
            if (c.isBlank()) throw AnalystError("The model ran out of room before answering. Try again.")
            if (c.startsWith("```")) c = c.removePrefix("```json").removePrefix("```").removeSuffix("```").trim()
            val o = JSONObject(c)
            if (!o.optBoolean("is_food", true)) throw NotFood()
            val items = o.optJSONArray("items") ?: JSONArray()
            return Meal(previous?.id ?: UUID.randomUUID().toString(), previous?.photoKey ?: "", previous?.eatenAt ?: System.currentTimeMillis(), o.optString("title", "Meal"),
                (0 until items.length()).map { i -> val it = items.getJSONObject(i); FoodItem(it.optString("name"), it.optString("quantity"), it.optInt("kcal_min"), it.optInt("kcal_max"), it.optInt("protein_g")) },
                o.optInt("kcal_min"), o.optInt("kcal_max"), o.optInt("protein_min"), o.optInt("protein_max"), o.optString("confidence", "medium"), o.optString("question"), note.ifBlank { previous?.note ?: "" }, model)
        }
    }
}
