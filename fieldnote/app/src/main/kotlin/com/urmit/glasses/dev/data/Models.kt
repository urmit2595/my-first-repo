package com.urmit.glasses.dev.data

import org.json.JSONArray
import org.json.JSONObject

/** Where an item came from. */
enum class Source { FIELDNOTE, GLASSES }

/** Analysis queue state, read by Gallery badges (build brief §4.8). */
enum class AnalysisState { SAVED, QUEUED, ANALYSING, ANALYSED, WAITING_FOR_NETWORK, FAILED }

data class Lens(val id: String, val label: String, val prompt: String)

object Lenses {
    val SCENE = Lens("scene", "Scene", "Describe what is in front of me in two or three short sentences, the way a knowledgeable friend would: what it is, anything notable, and one useful detail. No preamble.")
    val HERITAGE = Lens("heritage", "Heritage", "I am looking at a place, building, monument or artefact. Identify it if you can (style, period, likely region, purpose) and give the two or three most interesting facts. Say what you are unsure of. Keep it under 90 words unless asked for more.")
    val FOOD = Lens("food", "Food", "This is food or drink. Say what it most likely is, how it is usually made or eaten, and a rough calorie range for what is visible. Use Indian portion names where they fit. Under 80 words.")
    val READ = Lens("read", "Read text", "Read aloud all text visible in the image, in reading order, exactly as written. If it is a menu, sign or label, keep the structure. No commentary.")
    val ALL = listOf(SCENE, HERITAGE, FOOD, READ)
    fun byId(id: String) = ALL.firstOrNull { it.id == id } ?: SCENE
}

data class Message(
    val role: String,          // "user" | "assistant"
    val text: String,
    val at: Long,
    val model: String = "",
    val lens: String = "",
    val ms: Long = 0,
    val byVoice: Boolean = false
) {
    fun toJson() = JSONObject().put("role", role).put("text", text).put("at", at).put("model", model).put("lens", lens).put("ms", ms).put("byVoice", byVoice)
    companion object { fun from(o: JSONObject) = Message(o.optString("role"), o.optString("text"), o.optLong("at"), o.optString("model"), o.optString("lens"), o.optLong("ms"), o.optBoolean("byVoice")) }
}

/** Fieldnote's record about one photo or video. The media itself lives in MediaStore; this is the sidecar. */
data class Note(
    val key: String,                       // MediaStore id ("ms:123") or capture file name ("fn:xxx.jpg")
    val state: AnalysisState = AnalysisState.SAVED,
    val thread: List<Message> = emptyList(),
    val favourite: Boolean = false,
    val hidden: Boolean = false,
    val lens: String = "scene",
    val error: String = ""
) {
    val lastAnswer get() = thread.lastOrNull { it.role == "assistant" }?.text ?: ""
    fun toJson() = JSONObject().put("key", key).put("state", state.name)
        .put("thread", JSONArray().apply { thread.forEach { put(it.toJson()) } })
        .put("favourite", favourite).put("hidden", hidden).put("lens", lens).put("error", error)
    companion object {
        fun from(o: JSONObject): Note {
            val arr = o.optJSONArray("thread") ?: JSONArray()
            return Note(o.getString("key"),
                runCatching { AnalysisState.valueOf(o.optString("state")) }.getOrDefault(AnalysisState.SAVED),
                (0 until arr.length()).map { Message.from(arr.getJSONObject(it)) },
                o.optBoolean("favourite"), o.optBoolean("hidden"), o.optString("lens", "scene"), o.optString("error"))
        }
    }
}

/** One row in the Gallery: a MediaStore item joined with its Note. */
data class MediaItem(
    val key: String,
    val uri: android.net.Uri,
    val isVideo: Boolean,
    val takenAt: Long,
    val source: Source,
    val durationMs: Long = 0,
    val note: Note = Note(key)
)
