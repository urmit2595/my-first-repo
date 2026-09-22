package com.urmit.glasses.dev.ui

import android.content.Context
import android.net.Uri
import com.urmit.glasses.dev.data.Agent
import com.urmit.glasses.dev.data.AnalysisQueue
import com.urmit.glasses.dev.data.ChatRepo
import com.urmit.glasses.dev.data.FoodAnalyst
import com.urmit.glasses.dev.data.FoodRepo
import com.urmit.glasses.dev.data.Lenses
import com.urmit.glasses.dev.data.Meal
import com.urmit.glasses.dev.service.Speaker
import com.urmit.glasses.dev.service.Voice
import com.urmit.glasses.dev.data.Diagnostics
import com.urmit.glasses.dev.data.Media
import com.urmit.glasses.dev.data.MediaItem
import com.urmit.glasses.dev.data.Prefs
import com.urmit.glasses.dev.data.Repo
import com.urmit.glasses.dev.service.Bus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Calendar

class AppState(val ctx: Context) {
    val prefs = Prefs.get(ctx)
    val repo = Repo.get(ctx)
    val media = Media(ctx)
    val diag = Diagnostics.get(ctx)
    private val queue = AnalysisQueue.get(ctx)
    val chat = ChatRepo.get(ctx)
    val food = FoodRepo.get(ctx)
    private val agent = Agent.get(ctx)
    private val voice by lazy { Voice(ctx) }
    private val speaker by lazy { Speaker(ctx) }
    val listening = MutableStateFlow(false)
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val raw = MutableStateFlow<List<MediaItem>>(emptyList())
    val items = combine(raw, repo.notes) { list, notes -> list.map { it.copy(note = notes[it.key] ?: it.note) } }
    val loading = MutableStateFlow(true)
    val toast = MutableStateFlow<String?>(null)

    @OptIn(FlowPreview::class)
    fun start() {
        scope.launch { media.changes().debounce(600).collect { refresh() } }
        scope.launch { Bus.toast.collect { it?.let { m -> toast.value = m; Bus.toast.value = null } } }
    }

    fun refresh() = scope.launch { raw.value = media.list(); loading.value = false }

    fun ask(item: MediaItem, lensId: String, question: String = "", byVoice: Boolean = false) = scope.launch {
        runCatching { queue.ask(item.key, item.uri, lensId, question, byVoice) }.onFailure { toast.value = it.message }
    }

    /** Chat tab: typed message → orchestrator. */
    fun sendChat(text: String, photoKey: String = "") = scope.launch {
        if (prefs.apiKey.isBlank()) { toast.value = "Add your API key first (Glasses → Answers)"; return@launch }
        agent.run(text, photoKey, byVoice = false)
        refresh()
    }

    /** Chat tab: mic button → phone (or glasses) microphone → orchestrator → spoken + written reply. */
    fun speakToChat(photoKey: String = "") = scope.launch {
        if (listening.value) return@launch
        listening.value = true
        val heard = try { voice.listenOnce(8_000, glassesFirst = true) } catch (e: Exception) { toast.value = e.message; listening.value = false; return@launch }
        listening.value = false
        diag.event("voice_command", mapOf("chars" to heard.length, "route" to voice.lastRoute, "from" to "chat"))
        if (prefs.apiKey.isBlank()) { toast.value = "Add your API key first (Glasses → Answers)"; return@launch }
        val out = agent.run(heard, photoKey, byVoice = true)
        if (prefs.speakOnPhone) speaker.say(out.text)
        refresh()
    }

    fun correctMeal(m: Meal, note: String) = scope.launch {
        chat.busy.value = true
        try {
            val item = items.let { media.list().firstOrNull { it.key == m.photoKey } }
            val jpeg = item?.let { media.cachedJpeg(it.uri) }
            val updated = FoodAnalyst.analyse(prefs.apiKey, prefs.modelFor(Lenses.FOOD.id), jpeg, prefs.aboutMe, note, m)
            food.put(updated.copy(photoKey = m.photoKey, eatenAt = m.eatenAt))
            toast.value = "Updated: ${updated.kcalMin}–${updated.kcalMax} kcal"
        } catch (e: Exception) { toast.value = e.message } finally { chat.busy.value = false }
    }

    /** Log a photo from the Gallery as a meal. */
    fun logMeal(item: MediaItem) = scope.launch {
        chat.busy.value = true
        try {
            val jpeg = media.cachedJpeg(item.uri)
            val prev = food.forPhoto(item.key)
            val meal = FoodAnalyst.analyse(prefs.apiKey, prefs.modelFor(Lenses.FOOD.id), jpeg, prefs.aboutMe, "", prev).copy(photoKey = item.key, eatenAt = prev?.eatenAt ?: item.takenAt)
            food.put(meal); setLens(item.key, Lenses.FOOD.id)
            toast.value = "Logged ${meal.title}: ${meal.kcalMin}–${meal.kcalMax} kcal"
        } catch (e: FoodAnalyst.NotFood) { toast.value = "That doesn't look like food" }
        catch (e: Exception) { toast.value = e.message } finally { chat.busy.value = false }
    }

    fun testKey() = scope.launch {
        toast.value = "Checking key…"
        toast.value = com.urmit.glasses.dev.data.Analyst.testKey(prefs.apiKey) ?: "Key works (${if (prefs.provider == "openrouter") "OpenRouter" else "OpenAI"})"
    }

    fun syncDiagnostics() = scope.launch { toast.value = diag.flush() }

    fun setFavourite(key: String, v: Boolean) = repo.update(key) { it.copy(favourite = v) }
    fun setHidden(key: String, v: Boolean) = repo.update(key) { it.copy(hidden = v) }
    fun setLens(key: String, lens: String) = repo.update(key) { it.copy(lens = lens) }

    /** Fieldnote's own captures are deleted from MediaStore; glasses-album items are only hidden. */
    fun delete(item: MediaItem) = scope.launch {
        if (item.source == com.urmit.glasses.dev.data.Source.FIELDNOTE) runCatching { ctx.contentResolver.delete(item.uri, null, null) }
        setHidden(item.key, true)
        refresh()
    }
}

fun dayStart(t: Long): Long = Calendar.getInstance().apply { timeInMillis = t; set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
fun timeLabel(t: Long): String = java.text.SimpleDateFormat("h:mm a", java.util.Locale.UK).format(t).lowercase()
fun dayLabel(t: Long): String {
    val d = dayStart(t); val today = dayStart(System.currentTimeMillis())
    return when (d) { today -> "Today"; today - 86_400_000L -> "Yesterday"; else -> java.text.SimpleDateFormat("EEEE d MMMM", java.util.Locale.UK).format(t) }
}
fun durationLabel(ms: Long) = "%d:%02d".format(ms / 60000, (ms / 1000) % 60)
fun agoLabel(t: Long): String { val m = (System.currentTimeMillis() - t) / 60000; return when { m < 1 -> "just now"; m < 60 -> "$m min ago"; m < 1440 -> "${m / 60} h ago"; else -> "${m / 1440} d ago" } }
