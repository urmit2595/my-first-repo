package com.urmit.glasses.dev.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

/**
 * One line in a chat. role: "user" | "assistant" | "action" (something the assistant did: took a photo, logged a meal).
 * photoKey links the line to a Gallery item; mealId to a Food entry; chat is the chat it belongs to.
 */
data class ChatMessage(
    val role: String, val text: String, val at: Long,
    val photoKey: String = "", val mealId: String = "", val byVoice: Boolean = false, val model: String = "", val ms: Long = 0, val chat: String = ""
) {
    fun toJson() = JSONObject().put("role", role).put("text", text).put("at", at).put("photoKey", photoKey).put("mealId", mealId).put("byVoice", byVoice).put("model", model).put("ms", ms).put("chat", chat)
    companion object { fun from(o: JSONObject) = ChatMessage(o.optString("role"), o.optString("text"), o.optLong("at"), o.optString("photoKey"), o.optString("mealId"), o.optBoolean("byVoice"), o.optString("model"), o.optLong("ms"), o.optString("chat")) }
}

/** A saved chat (topic). Messages reference it by id. */
data class Chat(val id: String, val title: String, val createdAt: Long, val updatedAt: Long) {
    fun toJson() = JSONObject().put("id", id).put("title", title).put("createdAt", createdAt).put("updatedAt", updatedAt)
    companion object { fun from(o: JSONObject) = Chat(o.getString("id"), o.optString("title"), o.optLong("createdAt"), o.optLong("updatedAt")) }
}

/**
 * All chats and messages, one JSON file. `current` is the chat new messages go to. `pinned` is true when the wearer chose
 * that chat themselves (routing then stays there); false means the brain may route each question to the best chat.
 */
class ChatRepo private constructor(ctx: Context) {
    private val file = File(ctx.filesDir, "chat.json")
    private val lock = Any()
    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    private val _chats = MutableStateFlow<List<Chat>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages
    val chats: StateFlow<List<Chat>> = _chats
    val current = MutableStateFlow("")
    val pinned = MutableStateFlow(false)
    /** True while the assistant is working on a reply. */
    val busy = MutableStateFlow(false)
    val status = MutableStateFlow("")

    init { load() }

    private fun load() = runCatching {
        if (!file.exists()) return@runCatching
        val root = JSONObject(file.readText())
        val ms = root.optJSONArray("messages") ?: JSONArray(); val cs = root.optJSONArray("chats") ?: JSONArray()
        _messages.value = (0 until ms.length()).map { ChatMessage.from(ms.getJSONObject(it)) }
        _chats.value = (0 until cs.length()).map { Chat.from(cs.getJSONObject(it)) }.sortedByDescending { it.updatedAt }
        current.value = root.optString("current")
    }.let {
        // Older file format was a bare array of messages: adopt them into one chat.
        if (_messages.value.isEmpty() && file.exists() && file.readText().trimStart().startsWith("[")) runCatching {
            val arr = JSONArray(file.readText()); val id = UUID.randomUUID().toString()
            _messages.value = (0 until arr.length()).map { ChatMessage.from(arr.getJSONObject(it)).copy(chat = id) }
            _chats.value = listOf(Chat(id, "Earlier chat", _messages.value.firstOrNull()?.at ?: 0, _messages.value.lastOrNull()?.at ?: 0)); current.value = id; persist()
        }
        // Unreadable and not the old format: set it aside rather than overwrite it with an empty history on the next message.
        if (it.isFailure && _messages.value.isEmpty() && file.exists() && !file.readText().trimStart().startsWith("[")) Store.quarantine(file)
        if (current.value.isBlank() || _chats.value.none { it.id == current.value }) current.value = _chats.value.firstOrNull()?.id ?: ""
    }

    private fun persist() {
        val tmp = File(file.parentFile, "chat.tmp")
        tmp.writeText(JSONObject().put("current", current.value)
            .put("chats", JSONArray().apply { _chats.value.forEach { put(it.toJson()) } })
            .put("messages", JSONArray().apply { _messages.value.forEach { put(it.toJson()) } }).toString())
        tmp.renameTo(file)
    }

    fun chat(id: String) = _chats.value.firstOrNull { it.id == id }
    fun inChat(id: String) = _messages.value.filter { it.chat == id }

    /** Start a new chat and make it current. */
    fun newChat(title: String = "", pin: Boolean = true): Chat = synchronized(lock) {
        val c = Chat(UUID.randomUUID().toString(), title, System.currentTimeMillis(), System.currentTimeMillis())
        _chats.value = listOf(c) + _chats.value; current.value = c.id; pinned.value = pin; persist(); c
    }
    fun select(id: String, pin: Boolean = true) { if (chat(id) != null) { current.value = id; pinned.value = pin; synchronized(lock) { persist() } } }
    fun unpin() { pinned.value = false }
    fun rename(id: String, title: String) = synchronized(lock) { _chats.value = _chats.value.map { if (it.id == id) it.copy(title = title) else it }; persist() }
    fun delete(id: String) = synchronized(lock) {
        _chats.value = _chats.value.filter { it.id != id }; _messages.value = _messages.value.filter { it.chat != id }
        if (current.value == id) { current.value = _chats.value.firstOrNull()?.id ?: ""; pinned.value = false }
        persist()
    }

    /** Add a message to the current chat (creating one if none), or to m.chat when set. Titles the chat from its first user line. */
    fun add(m: ChatMessage): ChatMessage = synchronized(lock) {
        val id = m.chat.ifBlank { current.value.ifBlank { newChat(pin = false).id } }
        val msg = m.copy(chat = id)
        _messages.value = (_messages.value + msg).takeLast(2000)
        _chats.value = _chats.value.map { c ->
            if (c.id != id) c else c.copy(updatedAt = msg.at, title = c.title.ifBlank { if (msg.role == "user") msg.text.take(48).trim() else "" })
        }.sortedByDescending { it.updatedAt }
        persist(); msg
    }

    /** Move one message (matched by timestamp + role) into another chat. Used when the brain routes a question elsewhere. */
    fun move(at: Long, role: String, toChat: String) = synchronized(lock) {
        _messages.value = _messages.value.map { if (it.at == at && it.role == role) it.copy(chat = toChat) else it }
        _chats.value = _chats.value.map { c -> if (c.id == toChat) c.copy(updatedAt = maxOf(c.updatedAt, at), title = c.title.ifBlank { _messages.value.firstOrNull { it.chat == toChat && it.role == "user" }?.text?.take(48)?.trim() ?: "" }) else c }.sortedByDescending { it.updatedAt }
        // Drop a chat left empty by the move.
        _chats.value = _chats.value.filter { c -> c.id == toChat || _messages.value.any { it.chat == c.id } }
        persist()
    }

    fun clearAll() = synchronized(lock) { _messages.value = emptyList(); _chats.value = emptyList(); current.value = ""; pinned.value = false; persist() }

    /** Recent turns of one chat for the model, oldest first. */
    fun recent(chatId: String, n: Int = 24) = inChat(chatId).takeLast(n)
    /** Short summaries of other chats for routing, newest first. */
    fun summaries(exclude: String, n: Int = 12): List<Triple<String, String, String>> =
        _chats.value.filter { it.id != exclude }.take(n).map { c -> Triple(c.id, c.title.ifBlank { "Untitled" }, inChat(c.id).lastOrNull { it.role == "assistant" }?.text?.take(90) ?: "") }

    companion object {
        @Volatile private var inst: ChatRepo? = null
        fun get(ctx: Context) = inst ?: synchronized(this) { inst ?: ChatRepo(ctx.applicationContext).also { inst = it } }
    }
}
