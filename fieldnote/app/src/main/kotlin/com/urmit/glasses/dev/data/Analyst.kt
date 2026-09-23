package com.urmit.glasses.dev.data

import android.util.Base64
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class AnalystError(msg: String, val network: Boolean = false) : Exception(msg)

/** Request and response details that differ between OpenRouter and OpenAI's own chat-completions endpoint. */
object Llm {
    fun openRouter(key: String) = Analyst.baseUrl(key).contains("openrouter")

    /** Models that reason before answering; their reasoning tokens count against the output cap. */
    fun reasons(model: String) = model.contains("gpt-5") || model.contains("gemini-2.5-pro") || Regex("(^|/)o[34]").containsMatchIn(model)

    /**
     * Output cap, temperature and reasoning effort in the endpoint's dialect. OpenRouter takes max_tokens and a reasoning
     * object; OpenAI's chat completions takes max_completion_tokens and reasoning_effort, and rejects max_tokens, the
     * reasoning object and temperature on GPT-5-class models (with an OpenAI key every brain turn failed with a 400).
     * Reasoning models get low effort and room for their thinking. Claude is deliberately left without extended thinking:
     * it would need temperature 1, a budget above the cap, and its thinking blocks echoed back between tool rounds.
     */
    fun limits(body: JSONObject, key: String, model: String, maxTokens: Int, temperature: Double): JSONObject {
        val think = reasons(model)
        val cap = if (think) maxOf(maxTokens, 2000) else maxTokens
        if (openRouter(key)) { body.put("max_tokens", cap); if (think) body.put("reasoning", JSONObject().put("effort", "low")) }
        else { body.put("max_completion_tokens", cap); if (think) body.put("reasoning_effort", "low") }
        if (!think) body.put("temperature", temperature)
        return body
    }

    /** The reply text. A JSON null (tool-call turns) is "", not the string "null" that Android's optString returns. */
    fun content(msg: JSONObject): String = if (msg.isNull("content")) "" else msg.optString("content")

    /** OpenRouter reports the cost in USD; otherwise count one cent. */
    fun cents(o: JSONObject): Int = o.optJSONObject("usage")?.optDouble("cost", Double.NaN)?.takeIf { !it.isNaN() }?.let { (it * 100).toInt().coerceAtLeast(1) } ?: 1

    /** 0 = no cap. */
    fun checkCap(prefs: Prefs) { if (prefs.dailyCapCents > 0 && prefs.spentTodayCents >= prefs.dailyCapCents) throw AnalystError("Daily spend cap reached. Raise it in Glasses → Answers.") }
}

data class Answer(val text: String, val model: String, val ms: Long, val costCents: Int)

/** Vision chat over OpenAI-compatible endpoints (OpenRouter by default). One call per question, whole thread as context. */
object Analyst {
    private val client = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS).readTimeout(90, TimeUnit.SECONDS).build()

    fun baseUrl(key: String) = if (Prefs.normaliseKey(key).let { it.startsWith("sk-or-") }) "https://openrouter.ai/api/v1" else "https://api.openai.com/v1"

    fun testKey(key: String): String? {
        if (key.isBlank()) return "No key"
        val or = baseUrl(key).contains("openrouter")
        val req = Request.Builder().url(baseUrl(key) + if (or) "/auth/key" else "/models").header("Authorization", "Bearer $key").build()
        return runCatching { client.newCall(req).execute().use { if (it.isSuccessful) null else "Rejected (${it.code})" } }.getOrElse { "No connection" }
    }

    /**
     * @param photo downscaled JPEG of the item
     * @param thread prior messages on this photo (user + assistant), oldest first
     * @param question the new user turn; blank = "apply the lens"
     */
    /**
     * @param context traveller profile, trip and place (see AnalysisQueue); replaces the bare [aboutMe] line when given
     */
    fun ask(key: String, model: String, lens: Lens, photo: File, thread: List<Message>, question: String, aboutMe: String, spokenSeconds: Int, context: String = ""): Answer {
        if (key.isBlank()) throw AnalystError("Add your API key in Glasses → Analysis")
        val b64 = Base64.encodeToString(photo.readBytes(), Base64.NO_WRAP)
        val system = buildString {
            append("You are Fieldnote, an assistant looking through smart glasses on behalf of the wearer, who is in India unless the photo or the context below shows otherwise. ")
            append("Answers are read aloud, so write plain spoken prose: no markdown, no bullet lists, no headings, no emoji. ")
            append("Keep the first answer to about $spokenSeconds seconds of speech (roughly ${(spokenSeconds * 2.5).toInt()} words); the wearer can say 'more'. ")
            append("Be concrete and honest about uncertainty. Never identify a person from their face. For medicines, legal or safety questions, point to the label, a pharmacist or the local emergency number. ")
            if (context.isNotBlank()) append("Context: $context ") else if (aboutMe.isNotBlank()) append("About the wearer: $aboutMe. ")
            append("Lens: ${lens.label}. ${lens.prompt}")
        }
        val messages = JSONArray().put(JSONObject().put("role", "system").put("content", system))
        // First user turn always carries the image.
        val firstText = thread.firstOrNull { it.role == "user" }?.text?.takeIf { thread.isNotEmpty() } ?: (question.ifBlank { "Apply the ${lens.label} lens to this photo." })
        messages.put(JSONObject().put("role", "user").put("content", JSONArray()
            .put(JSONObject().put("type", "text").put("text", firstText))
            .put(JSONObject().put("type", "image_url").put("image_url", JSONObject().put("url", "data:image/jpeg;base64,$b64").put("detail", if (lens.id in Lenses.READING) "high" else "low")))))
        var skippedFirstUser = false
        for (m in thread) {
            if (m.role == "user" && !skippedFirstUser) { skippedFirstUser = true; continue }
            messages.put(JSONObject().put("role", m.role).put("content", m.text))
        }
        if (thread.isNotEmpty()) messages.put(JSONObject().put("role", "user").put("content", question.ifBlank { "Apply the ${lens.label} lens to this photo." }))

        val body = Llm.limits(JSONObject().put("model", model).put("messages", messages), key, model, 700, 0.4)
        val req = Request.Builder().url("${baseUrl(key)}/chat/completions")
            .header("Authorization", "Bearer $key").header("HTTP-Referer", "https://fieldnote.app").header("X-Title", "Fieldnote")
            .post(body.toString().toRequestBody("application/json".toMediaType())).build()
        val t0 = System.currentTimeMillis()
        val resp = try { client.newCall(req).execute() } catch (e: java.io.IOException) { throw AnalystError("No network", network = true) }
        resp.use { r ->
            val text = r.body?.string() ?: ""
            if (!r.isSuccessful) {
                val msg = runCatching { JSONObject(text).getJSONObject("error").getString("message") }.getOrDefault(text.take(160))
                throw AnalystError("Model error ${r.code}: $msg")
            }
            val o = JSONObject(text)
            val content = Llm.content(o.getJSONArray("choices").getJSONObject(0).getJSONObject("message")).trim()
            val cost = Llm.cents(o)
            // An empty reply was stored as an answer and spoken as "That's all."; say what happened instead.
            if (content.isBlank()) throw AnalystError("The model ran out of room before answering. Try again, or pick a faster model for this lens.")
            return Answer(content, model, System.currentTimeMillis() - t0, cost)
        }
    }
}
