package com.urmit.glasses.dev.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import java.io.File

/** Sidecar store for notes/threads, one JSON file. Survives process death, which the analysis queue needs. */
class Repo private constructor(ctx: Context) {
    private val file = File(ctx.filesDir, "notes.json")
    private val lock = Any()
    private val _notes = MutableStateFlow<Map<String, Note>>(load())
    val notes: StateFlow<Map<String, Note>> = _notes

    private fun load(): Map<String, Note> = runCatching {
        if (!file.exists()) return emptyMap()
        val arr = JSONArray(file.readText())
        (0 until arr.length()).map { Note.from(arr.getJSONObject(it)) }.associateBy { it.key }
    }.getOrElse { Store.quarantine(file); emptyMap() }

    private fun persist(m: Map<String, Note>) {
        val tmp = File(file.parentFile, "notes.tmp")
        tmp.writeText(JSONArray().apply { m.values.forEach { put(it.toJson()) } }.toString())
        tmp.renameTo(file)
    }

    fun get(key: String): Note = _notes.value[key] ?: Note(key)

    fun put(note: Note) = synchronized(lock) {
        val m = _notes.value + (note.key to note)
        persist(m); _notes.value = m
    }

    /** Read-modify-write under the lock: the analysis queue and the place tagger update the same note concurrently. */
    fun update(key: String, f: (Note) -> Note) = synchronized(lock) {
        val m = _notes.value + (key to f(_notes.value[key] ?: Note(key)))
        persist(m); _notes.value = m
    }

    /**
     * Anything left mid-flight by a killed process is marked failed with Retry offered. (It used to go back to QUEUED, but
     * nothing drains QUEUED, so those photos showed "queued" for ever.)
     */
    fun recoverInterrupted() = synchronized(lock) {
        val m = _notes.value.mapValues { (_, n) -> if (n.state == AnalysisState.ANALYSING || n.state == AnalysisState.QUEUED) n.copy(state = AnalysisState.FAILED, error = "Interrupted when the app closed") else n }
        persist(m); _notes.value = m
    }

    companion object {
        @Volatile private var inst: Repo? = null
        fun get(ctx: Context) = inst ?: synchronized(this) { inst ?: Repo(ctx.applicationContext).also { inst = it } }
    }
}

/** Shared file safety for the JSON stores. */
object Store {
    /**
     * Moves an unreadable store file aside (name.corrupt-<time>.json) instead of letting the next save overwrite it with an
     * empty list, so a bad write never silently wipes notes, chats, meals, trips or spends.
     */
    fun quarantine(f: File) { if (f.exists()) runCatching { f.renameTo(File(f.parentFile, "${f.nameWithoutExtension}.corrupt-${System.currentTimeMillis()}.json")) } }
}
