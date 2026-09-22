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
    fun ask(key: String, model: String, lens: Lens, photo: File, thread: List<Message>, question: String, aboutMe: String, spokenSeconds: Int): Answer {
        if (key.isBlank()) throw AnalystError("Add your API key in Glasses → Analysis")
        val b64 = Base64.encodeToString(photo.readBytes(), Base64.NO_WRAP)
        val system = buildString {
            append("You are Fieldnote, an assistant looking through smart glasses on behalf of the wearer, who is in India unless the photo shows otherwise. ")
            append("Answers are read aloud, so write plain spoken prose: no markdown, no bullet lists, no headings, no emoji. ")
            append("Keep the first answer to about $spokenSeconds seconds of speech (roughly ${(spokenSeconds * 2.5).toInt()} words); the wearer can say 'more'. ")
            append("Be concrete and honest about uncertainty. ")
            if (aboutMe.isNotBlank()) append("About the wearer: $aboutMe. ")
            append("Lens: ${lens.label}. ${lens.prompt}")
        }
        val messages = JSONArray().put(JSONObject().put("role", "system").put("content", system))
        // First user turn always carries the image.
        val firstText = thread.firstOrNull { it.role == "user" }?.text?.takeIf { thread.isNotEmpty() } ?: (question.ifBlank { "Apply the ${lens.label} lens to this photo." })
        messages.put(JSONObject().put("role", "user").put("content", JSONArray()
            .put(JSONObject().put("type", "text").put("text", firstText))
            .put(JSONObject().put("type", "image_url").put("image_url", JSONObject().put("url", "data:image/jpeg;base64,$b64").put("detail", "low")))))
        var skippedFirstUser = false
        for (m in thread) {
            if (m.role == "user" && !skippedFirstUser) { skippedFirstUser = true; continue }
            messages.put(JSONObject().put("role", m.role).put("content", m.text))
        }
        if (thread.isNotEmpty()) messages.put(JSONObject().put("role", "user").put("content", question.ifBlank { "Apply the ${lens.label} lens to this photo." }))

        val body = JSONObject().put("model", model).put("messages", messages).put("max_tokens", 700)
        if (!model.contains("gpt-5")) body.put("temperature", 0.4)
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
            val content = o.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content").trim()
            val usage = o.optJSONObject("usage")
            // OpenRouter returns cost in USD in usage.cost when available; otherwise estimate cheaply.
            val cost = usage?.optDouble("cost", Double.NaN)?.takeIf { !it.isNaN() }?.let { (it * 100).toInt().coerceAtLeast(1) } ?: 1
            return Answer(content, model, System.currentTimeMillis() - t0, cost)
        }
    }
}
