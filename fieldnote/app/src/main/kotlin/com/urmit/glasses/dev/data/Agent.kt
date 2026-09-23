package com.urmit.glasses.dev.data

import android.content.Context
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** What the orchestrator is allowed to do on the phone/glasses. The session service plugs in capture and end-session while it runs. */
interface AgentHands {
    /**
     * Take a photo through the glasses; returns the Gallery key. Throws with a spoken-friendly message.
     * [sharp] = the glasses' full photo even when quick photos are on (reading small print).
     */
    suspend fun takePhoto(sharp: Boolean = false): String
    fun endSession()
    val sessionRunning: Boolean
}

/**
 * The orchestrator ("brain"). One text-only reasoning model (GPT-5.6 Sol by default) decides what to do with what the wearer
 * said or typed, using tools: take a photo, look through a lens, log a meal, read food totals, change a setting, end the
 * session. Vision itself stays with the per-lens models, so the brain only ever sees text. Every turn is stored in ChatRepo.
 */
class Agent private constructor(private val ctx: Context) {
    private val prefs = Prefs.get(ctx)
    private val repo = Repo.get(ctx)
    private val media = Media(ctx)
    private val food = FoodRepo.get(ctx)
    private val chat = ChatRepo.get(ctx)
    private val queue = AnalysisQueue.get(ctx)
    private val diag = Diagnostics.get(ctx)
    private val client = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS).readTimeout(90, TimeUnit.SECONDS).build()
    private val lock = Mutex()

    @Volatile var hands: AgentHands? = null

    /** Phone-only fallback: no glasses capture, no end-session. */
    private val noHands = object : AgentHands {
        override suspend fun takePhoto(sharp: Boolean): String = throw AnalystError("Start a glasses session first, then I can take photos.")
        override fun endSession() {}
        override val sessionRunning = false
    }

    data class Outcome(val text: String, val photoKey: String = "", val mealId: String = "")

    /**
     * @param text what the wearer said or typed
     * @param photoKey a photo the wearer attached (chat) or the latest capture (voice); "" = none
     */
    suspend fun run(text: String, photoKey: String = "", byVoice: Boolean = false, onStatus: (String) -> Unit = {}): Outcome = withContext(Dispatchers.IO) {
        lock.withLock {
            chat.busy.value = true
            val lower = text.lowercase().trim()
            if (lower.startsWith("new topic") || lower.startsWith("new chat") || lower == "start a new chat" || lower == "start a new topic") chat.newChat(pin = true)
            val userMsg = chat.add(ChatMessage("user", text, System.currentTimeMillis(), photoKey = photoKey, byVoice = byVoice))
            val t0 = System.currentTimeMillis()
            try {
                val out = loop(text, photoKey, byVoice, onStatus, userMsg)
                chat.add(ChatMessage("assistant", out.text, System.currentTimeMillis(), photoKey = out.photoKey, mealId = out.mealId, model = prefs.agentModel, ms = System.currentTimeMillis() - t0))
                com.urmit.glasses.dev.service.Bus.lastAnswer.value = out.text
                diag.event("agent_ok", mapOf("ms" to (System.currentTimeMillis() - t0), "model" to prefs.agentModel, "by_voice" to byVoice, "chars" to out.text.length))
                out
            } catch (e: Exception) {
                val msg = friendly(e)
                chat.add(ChatMessage("assistant", msg, System.currentTimeMillis()))
                diag.event("agent_fail", mapOf("reason" to (e.message ?: "").take(80), "by_voice" to byVoice))
                Outcome(msg)
            } finally { chat.busy.value = false; chat.status.value = "" }
        }
    }

    private fun friendly(e: Exception) = when {
        e is AnalystError && e.network -> "I can't reach the internet right now. Try again in a moment."
        e.message?.contains("API key", true) == true -> "I need your API key first. Add it in Glasses → Answers."
        else -> e.message?.takeIf { it.isNotBlank() } ?: "Something went wrong. Try again."
    }

    private fun currentPhotoKey(attached: String): String? =
        attached.ifBlank { null } ?: com.urmit.glasses.dev.service.Bus.lastCaptureKey.value ?: media.list().firstOrNull { !it.isVideo }?.key

    /** The wearer's message may end up in a different chat than it started in (routing); actions logged along the way follow it. */
    private fun routeTo(userMsg: ChatMessage, chatId: String, pin: Boolean) {
        if (chatId == chat.current.value) return
        chat.select(chatId, pin = pin)
        chat.move(userMsg.at, "user", chatId)
        chat.inChat(userMsg.chat).filter { it.role == "action" && it.at >= userMsg.at }.forEach { chat.move(it.at, "action", chatId) }
    }

    private suspend fun loop(text: String, attached: String, byVoice: Boolean, onStatus: (String) -> Unit, userMsg: ChatMessage): Outcome {
        val h = hands ?: noHands
        val key = prefs.apiKey
        if (key.isBlank()) throw AnalystError("Add your API key in Glasses → Answers")
        var photoKey = currentPhotoKey(attached) ?: ""
        var mealId = ""
        val turnStart = System.currentTimeMillis()
        /** The current photo when it is this turn's subject: attached, taken in this turn, or taken in the last 20 minutes. */
        fun recentItem() = media.list().firstOrNull { it.key == photoKey }?.takeIf { (attached.isNotBlank() && it.key == attached) || it.takenAt > turnStart - 20 * 60_000L }
        val messages = JSONArray().put(JSONObject().put("role", "system").put("content", system(h, attached, byVoice)))
        for (m in chat.recent(chat.current.value).dropLast(1)) when (m.role) {
            "user" -> messages.put(JSONObject().put("role", "user").put("content", (if (m.photoKey.isNotBlank()) "[with a photo] " else "") + m.text))
            "assistant" -> messages.put(JSONObject().put("role", "assistant").put("content", m.text))
            "action" -> messages.put(JSONObject().put("role", "assistant").put("content", "(${m.text})"))
        }
        messages.put(JSONObject().put("role", "user").put("content", (if (attached.isNotBlank()) "[with a photo] " else "") + text))

        repeat(6) { round ->
            onStatus(if (round == 0) "Thinking…" else "Working…"); chat.status.value = if (round == 0) "Thinking…" else "Working…"
            val reply = call(key, prefs.agentModel, messages)
            val calls = reply.optJSONArray("tool_calls")
            if (calls == null || calls.length() == 0) {
                val content = Llm.content(reply).trim()
                return Outcome(if (content.isBlank()) "Done." else content, photoKey, mealId)
            }
            messages.put(reply)
            for (i in 0 until calls.length()) {
                val c = calls.getJSONObject(i); val fn = c.getJSONObject("function")
                val name = fn.getString("name"); val args = runCatching { JSONObject(fn.optString("arguments", "{}")) }.getOrDefault(JSONObject())
                diag.event("agent_tool", mapOf("tool" to name, "round" to round))
                val result = try {
                    when (name) {
                        "take_photo" -> { onStatus("Taking a photo…"); chat.status.value = "Taking a photo…"; photoKey = h.takePhoto(); chat.add(ChatMessage("action", "Took a photo", System.currentTimeMillis(), photoKey = photoKey)); "Photo taken and saved." }
                        "look" -> {
                            val lensId = Lenses.byId(args.optString("lens", prefs.doubleTapLens)).id
                            if (args.optBoolean("fresh", false) || photoKey.isBlank()) { onStatus("Taking a photo…"); chat.status.value = "Taking a photo…"; photoKey = h.takePhoto(sharp = lensId in Lenses.READING); chat.add(ChatMessage("action", "Took a photo", System.currentTimeMillis(), photoKey = photoKey)) }
                            val item = media.list().firstOrNull { it.key == photoKey } ?: throw AnalystError("I can't find that photo any more.")
                            onStatus("Looking…"); chat.status.value = "Looking through the ${Lenses.byId(lensId).label} lens…"
                            queue.ask(item.key, item.uri, lensId, args.optString("question"), byVoice)
                        }
                        "log_meal" -> {
                            val desc = args.optString("description")
                            if (args.optBoolean("fresh", false)) { onStatus("Taking a photo…"); chat.status.value = "Taking a photo…"; photoKey = h.takePhoto(); chat.add(ChatMessage("action", "Took a photo", System.currentTimeMillis(), photoKey = photoKey)) }
                            // Only a photo that is this turn's subject: "I had two rotis" hours later must not re-estimate (and
                            // overwrite) the meal logged from an old photo.
                            val usePhoto = args.optBoolean("use_photo", true) && photoKey.isNotBlank()
                            val item = if (usePhoto) recentItem() else null
                            onStatus("Estimating…"); chat.status.value = "Counting calories…"
                            val jpeg = item?.let { media.cachedJpeg(it.uri) }
                            val prev = item?.let { food.forPhoto(it.key) }
                            val meal = FoodAnalyst.analyse(key, prefs.modelFor(Lenses.FOOD.id), jpeg, prefs.aboutMe, desc, prev, prefs).let { m -> if (item != null) m.copy(photoKey = item.key, eatenAt = prev?.eatenAt ?: item.takenAt) else m }
                            food.put(meal); mealId = meal.id
                            if (item != null) repo.update(item.key) { it.copy(lens = Lenses.FOOD.id) }
                            chat.add(ChatMessage("action", "Logged ${meal.title} · ${meal.kcalMin}–${meal.kcalMax} kcal", System.currentTimeMillis(), photoKey = item?.key ?: "", mealId = meal.id))
                            val t = food.totals(dayStart(System.currentTimeMillis()))
                            "Logged: ${meal.title}; ${meal.kcalMin}-${meal.kcalMax} kcal, ${meal.proteinMin}-${meal.proteinMax} g protein; confidence ${meal.confidence}" +
                                (if (meal.question.isNotBlank()) "; open question: ${meal.question}" else "") +
                                ". Today so far: ${t.kcalMin}-${t.kcalMax} kcal of a ${prefs.kcalTarget} target, ${t.protein} g protein of ${prefs.proteinTarget}."
                        }
                        "food_summary" -> {
                            val days = args.optInt("days", 1).coerceIn(1, 30)
                            val today = dayStart(System.currentTimeMillis())
                            food.lastDays(days, today).joinToString("\n") { d ->
                                val meals = food.meals.value.filter { it.eatenAt in d.day until d.day + 86_400_000L }
                                "${java.text.SimpleDateFormat("EEE d MMM", java.util.Locale.UK).format(d.day)}: ${d.kcalMin}-${d.kcalMax} kcal, ${d.protein} g protein, ${d.meals} meals" +
                                    (if (meals.isNotEmpty() && days <= 3) " (" + meals.joinToString("; ") { "${it.title} ${it.kcalMid} kcal" } + ")" else "")
                            } + "\nTargets: ${prefs.kcalTarget} kcal, ${prefs.proteinTarget} g protein per day."
                        }
                        "recent_photos" -> {
                            val n = args.optInt("count", 5).coerceIn(1, 12)
                            media.list().filter { !it.isVideo }.take(n).joinToString("\n") { it -> "${com.urmit.glasses.dev.ui.agoLabel(it.takenAt)}: " + (it.note.lastAnswer.take(140).ifBlank { "not looked at yet" }) }.ifBlank { "No photos yet." }
                        }
                        "set_setting" -> {
                            val v = args.optString("value")
                            when (args.optString("name")) {
                                "double_tap_lens" -> { prefs.doubleTapLens = Lenses.byId(v).id; "Double-tap now uses the ${Lenses.byId(v).label} lens." }
                                "answer_seconds" -> { prefs.answerSeconds = v.toIntOrNull()?.coerceIn(5, 60) ?: 15; "Answers are now about ${prefs.answerSeconds} seconds." }
                                "auto_answer" -> { prefs.autoAnalyse = v.toBooleanStrictOrNull() ?: v.contains("on"); "Auto-answer after a single tap is ${if (prefs.autoAnalyse) "on" else "off"}." }
                                "kcal_target" -> { prefs.kcalTarget = v.toIntOrNull()?.coerceIn(800, 6000) ?: prefs.kcalTarget; "Daily calorie target is now ${prefs.kcalTarget}." }
                                "protein_target" -> { prefs.proteinTarget = v.toIntOrNull()?.coerceIn(20, 300) ?: prefs.proteinTarget; "Daily protein target is now ${prefs.proteinTarget} g." }
                                "about_me" -> { prefs.aboutMe = v; "Saved what you told me about yourself." }
                                else -> "Unknown setting."
                            }
                        }
                        "end_session" -> { h.endSession(); "Session ended." }
                        /* ---- travel (travel plan phase 1) ---- */
                        "trip_info" -> TravelActions.tripInfo(ctx, args.optString("query"))
                        "add_booking" -> { onStatus("Reading the booking…"); chat.status.value = "Reading the booking…"; TravelActions.addBookings(ctx, args.optString("text"), emptyList()).let { chat.add(ChatMessage("action", it.summary.substringBefore(":"), System.currentTimeMillis())); it.summary } }
                        "log_expense" -> {
                            val desc = args.optString("description")
                            if (args.optBoolean("fresh", false)) { onStatus("Taking a photo…"); chat.status.value = "Taking a photo…"; photoKey = h.takePhoto(sharp = true); chat.add(ChatMessage("action", "Took a photo", System.currentTimeMillis(), photoKey = photoKey)) }
                            // fresh=true means "photograph this receipt": use that photo even if use_photo was left out.
                            val item = if ((args.optBoolean("use_photo", false) || args.optBoolean("fresh", false)) && photoKey.isNotBlank()) recentItem() else null
                            if (item != null && Ledger.get(ctx).forPhoto(item.key) != null) "That receipt is already in the ledger." else {
                                onStatus("Logging the spend…"); chat.status.value = "Reading the receipt…"
                                val r = TravelAnalyst.readReceipt(prefs, item?.let { media.cachedJpeg(it.uri) }, desc, TripRepo.get(ctx).current())
                                val e = Spending.log(ctx, r, photoKey = item?.key ?: "", place = item?.note?.place?.ifBlank { null } ?: Here.label(30 * 60_000L).removePrefix("Near ").substringBefore(" ("), note = desc)
                                if (item != null) repo.update(item.key) { it.copy(lens = Lenses.RECEIPT.id) }
                                chat.add(ChatMessage("action", "Logged ${Money.fmt(e.amount, e.currency)}${if (e.merchant.isNotBlank()) " · ${e.merchant}" else ""}", System.currentTimeMillis(), photoKey = item?.key ?: ""))
                                Spending.describe(ctx, e)
                            }
                        }
                        "spend_summary" -> Spending.summary(ctx, args.optString("period", "today"), args.optInt("days", 1).coerceIn(1, 60))
                        "convert_currency" -> TravelActions.convert(ctx, args.optDouble("amount", 0.0), args.optString("from"), args.optString("to"))
                        "save_note" -> {
                            if (args.optBoolean("with_photo", false)) { onStatus("Taking a photo…"); chat.status.value = "Taking a photo…"; photoKey = h.takePhoto(); chat.add(ChatMessage("action", "Took a photo", System.currentTimeMillis(), photoKey = photoKey)) }
                            val said = TravelActions.saveNote(ctx, args.optString("text"), if (args.optBoolean("with_photo", false)) photoKey else "", if (args.optBoolean("with_photo", false)) "remember" else "note")
                            chat.add(ChatMessage("action", said, System.currentTimeMillis(), photoKey = if (args.optBoolean("with_photo", false)) photoKey else "")); said
                        }
                        "find_notes" -> TravelActions.find(ctx, args.optString("query"))
                        "where_am_i" -> { onStatus("Finding you…"); chat.status.value = "Finding you…"; TravelActions.whereAmI(ctx) }
                        "take_me_home" -> { onStatus("Finding the way home…"); chat.status.value = "Finding the way home…"; TravelActions.takeMeHome(ctx) }
                        "show_card" -> args.optString("kind").let { k -> if (k in TravelActions.CARDS) { TravelActions.cardRequest.value = k; "The $k card is open on the phone screen." } else "Unknown card." }
                        "hand_off_to_meta" -> { h.endSession(); TravelActions.HAND_OFF }
                        "switch_chat" -> {
                            val want = args.optString("chat_id"); val c = chat.chats.value.firstOrNull { it.id == want || it.id.startsWith(want) || it.title.equals(want, true) }; val id = c?.id ?: ""
                            if (c == null) "No chat with that id; ask the wearer which one they mean." else { routeTo(userMsg, id, pin = args.optBoolean("pin", false)); "Now in chat \"${c.title}\". Its last lines: " + chat.inChat(id).takeLast(6).joinToString(" | ") { "${it.role}: ${it.text.take(120)}" } }
                        }
                        // newChat() already makes the chat current, so routeTo() saw nothing to move and the question stayed behind.
                        "new_chat" -> { val from = userMsg.chat; val c = chat.newChat(args.optString("title").take(48), pin = false)
                            chat.move(userMsg.at, "user", c.id); chat.inChat(from).filter { it.role == "action" && it.at >= userMsg.at }.forEach { chat.move(it.at, "action", c.id) }
                            chat.select(c.id, pin = false); "Started a new chat \"${c.title}\"." }
                        "rename_chat" -> { chat.rename(chat.current.value, args.optString("title").take(48)); "Renamed." }
                        else -> "Unknown tool."
                    }
                } catch (e: FoodAnalyst.NotFood) { "That photo does not show food; nothing logged." }
                catch (e: Exception) { "Could not do that: ${e.message}" }
                messages.put(JSONObject().put("role", "tool").put("tool_call_id", c.optString("id")).put("content", result))
            }
        }
        // Out of rounds: ask once more with tools off, so the work already done is summarised instead of thrown away.
        val last = runCatching { Llm.content(call(key, prefs.agentModel, messages, toolChoice = "none")).trim() }.getOrDefault("")
        return Outcome(last.ifBlank { "I did what I could, but ran out of steps. Ask again?" }, photoKey, mealId)
    }

    private fun system(h: AgentHands, attached: String, byVoice: Boolean): String {
        val lastPhoto = media.list().firstOrNull { !it.isVideo }
        val t = food.totals(dayStart(System.currentTimeMillis()))
        return buildString {
            append("You are Fieldnote, a friendly assistant living in the wearer's smart glasses and phone. The wearer lives in India; the trip and phone location below say where they are now. ")
            append("You can act with tools; use them instead of guessing. When the wearer asks about what they are seeing, eating, reading, or where they are, call `look` (choose the lens: scene, heritage, food, read) — take a fresh photo unless they clearly mean an earlier one. ")
            append("When they mention eating or want calories logged, call `log_meal`. For questions about their day's food, call `food_summary`. General knowledge and chit-chat you answer yourself. ")
            append("TRAVEL: for signs and notices in another language use look with lens translate; menus lens menu; price tags lens price; departure boards lens board. Spends and receipts: `log_expense` (not log_meal) and `spend_summary`; conversions `convert_currency`, never do currency maths yourself. Anything about bookings, the hotel, flights or references: `trip_info` first; new bookings in words: `add_booking`. 'Note …' or 'remember …': `save_note` (with_photo for 'remember this' or where something was left); 'where did I …': `find_notes`. 'Where am I': `where_am_i`; 'take me home' or 'back to the hotel': `take_me_home`. Cards for someone else to read: `show_card`. Never claim you booked, paid or sent anything. Never identify people from their faces. ")
            append(if (byVoice) "Your reply will be read aloud: plain spoken sentences, no lists, no markdown, at most ${(prefs.answerSeconds * 2.5).toInt()} words unless they ask for detail. " else "Reply in short, warm, plain English. Light markdown is fine. Never mention tools or JSON. ")
            val cur = chat.chat(chat.current.value)
            append("CHATS: the wearer's conversation is organised into chats (topics). Current chat: \"${cur?.title?.ifBlank { "untitled" } ?: "none"}\"${if (chat.pinned.value) " (chosen by the wearer: stay here, do not switch unless they say 'new topic' or 'back to …')" else " (automatic routing)"}. ")
            val others = chat.summaries(chat.current.value)
            if (others.isNotEmpty()) append("Other chats [id → title → last reply]: " + others.joinToString("; ") { "${it.first.take(8)} → ${it.second} → ${it.third}" } + ". Use the 8-character ids. ")
            if (!chat.pinned.value) append("Routing: if this message clearly continues one of the other chats, call switch_chat first; if it is clearly a new subject unrelated to the current chat and the current chat is not empty, call new_chat with a short title; if it follows on from the current chat, do nothing. If it is genuinely unclear which chat it belongs to, do not switch: answer and ask in one short sentence. ")
            append("If the wearer says 'back to <name>', call switch_chat with pin=true for the matching chat; if two chats match, ask which. A pause or starting voice is never a new topic. ")
            append("Glasses session running: ${h.sessionRunning}. ")
            if (!h.sessionRunning) append("Without a session you cannot take photos; say so briefly and offer to use the latest photo instead. ")
            if (attached.isNotBlank()) append("The wearer attached a photo to this message; `look` and `log_meal` will use it unless fresh=true. ")
            else if (lastPhoto != null) append("Latest photo was taken ${com.urmit.glasses.dev.ui.agoLabel(lastPhoto.takenAt)}. ")
            append("Food today so far: ${t.kcalMin}-${t.kcalMax} kcal, ${t.protein} g protein, target ${prefs.kcalTarget} kcal / ${prefs.proteinTarget} g. ")
            append("Default lens for double-tap: ${prefs.doubleTapLens}. Answer length: about ${prefs.answerSeconds} s of speech. ")
            append("Traveller: ${Profile.context(prefs)} ")
            val trips = TripRepo.get(ctx)
            trips.current()?.let { append(TravelText.context(it, trips.currentStay())) }
            Here.label().takeIf { it.isNotBlank() }?.let { append("Phone location: $it. ") }
            append("Local time: ${java.text.SimpleDateFormat("EEEE d MMMM, h:mm a", java.util.Locale.UK).format(System.currentTimeMillis())}.")
        }
    }

    private fun tools(): JSONArray {
        fun tool(name: String, desc: String, props: JSONObject, required: List<String> = emptyList()) = JSONObject().put("type", "function").put("function",
            JSONObject().put("name", name).put("description", desc).put("parameters", JSONObject().put("type", "object").put("properties", props).put("required", JSONArray(required))))
        fun p(type: String, desc: String, enum: List<String>? = null) = JSONObject().put("type", type).put("description", desc).also { if (enum != null) it.put("enum", JSONArray(enum)) }
        return JSONArray()
            .put(tool("take_photo", "Take a photo through the glasses and save it (no analysis).", JSONObject()))
            .put(tool("look", "Look at a photo through a lens and answer a question about it. Takes a fresh photo when fresh=true or none exists.",
                JSONObject().put("lens", p("string", "scene: what is in front of me; heritage: place, building, monument, history; food: identify a dish; read: read text exactly as written; translate: read and translate a sign, notice or label; menu: explain a menu with allergens, picks and prices in rupees; price: read a price tag or bill and convert to rupees; receipt: log a receipt into the trip ledger; board: find the wearer's flight or train on a departures board", Lenses.ALL.map { it.id }))
                    .put("question", p("string", "The wearer's question, in their words. Empty = just apply the lens."))
                    .put("fresh", p("boolean", "true to take a new photo first")), listOf("lens")))
            .put(tool("log_meal", "Estimate calories and protein for a meal and add it to the food log. Uses the current photo plus what the wearer said.",
                JSONObject().put("description", p("string", "What the wearer said they ate or drank, portions, corrections. May be empty when the photo is enough."))
                    .put("use_photo", p("boolean", "false when the wearer only described food and no photo is relevant"))
                    .put("fresh", p("boolean", "true to take a new photo of the plate first"))))
            .put(tool("food_summary", "Calories, protein and meals for recent days.", JSONObject().put("days", p("integer", "How many days back, 1 = today only"))))
            .put(tool("recent_photos", "What the last few photos were and what was said about them.", JSONObject().put("count", p("integer", "How many"))))
            .put(tool("set_setting", "Change a Fieldnote setting.", JSONObject().put("name", p("string", "Which setting", listOf("double_tap_lens", "answer_seconds", "auto_answer", "kcal_target", "protein_target", "about_me"))).put("value", p("string", "New value")), listOf("name", "value")))
            .put(tool("end_session", "End the glasses session (stop listening for taps).", JSONObject()))
            .put(tool("trip_info", "The saved trip: destination, dates, every booking with times, addresses, phone numbers and booking references, the stay, emergency numbers, tipping and etiquette notes. Call before answering anything about the trip or bookings.", JSONObject().put("query", p("string", "What the wearer asked about, to put matching bookings first"))))
            .put(tool("add_booking", "Add a booking the wearer describes in words (flight, hotel, train, table, ticket) to the trip.", JSONObject().put("text", p("string", "Everything they said about it: name, dates, times, address, reference")), listOf("text")))
            .put(tool("log_expense", "Log a spend in the trip ledger, from the current photo of a receipt or bill and/or what the wearer said (\"taxi 2400 yen\").", JSONObject()
                .put("description", p("string", "What they said about the spend; may be empty when the receipt photo is enough"))
                .put("use_photo", p("boolean", "true when the current photo is the receipt"))
                .put("fresh", p("boolean", "true to take a new photo of the receipt first"))))
            .put(tool("spend_summary", "What the wearer has spent, in their home currency, by category.", JSONObject().put("period", p("string", "today, days (the last N days) or trip", listOf("today", "days", "trip"))).put("days", p("integer", "For period=days"))))
            .put(tool("convert_currency", "Convert an amount between currencies with the saved exchange rate (works offline).", JSONObject().put("amount", p("number", "Amount")).put("from", p("string", "ISO code; empty = the trip's local currency")).put("to", p("string", "ISO code; empty = home currency")), listOf("amount")))
            .put(tool("save_note", "Save a voice note pinned to where the wearer is now, or remember something with a photo (parking bay, locker, hotel room, where they left something).", JSONObject()
                .put("text", p("string", "The note, in the wearer's words")).put("with_photo", p("boolean", "true for 'remember this' / 'remember where I parked': takes a photo too")), listOf("text")))
            .put(tool("find_notes", "Search the wearer's saved notes, remembered places, photo places, spends and bookings (\"where did I park\", \"what was that noodle place\").", JSONObject().put("query", p("string", "What to look for")), listOf("query")))
            .put(tool("where_am_i", "Where the wearer is now (place name) and the direction and distance to their stay.", JSONObject()))
            .put(tool("take_me_home", "Direction, distance and walking time to the wearer's stay, its phone number, and open the driver card with the address in the local script.", JSONObject()))
            .put(tool("show_card", "Open a card on the phone screen for someone else to read: driver (stay address in local script), allergy (diet and allergies in the local language), phrases (quick phrases), emergency (local emergency numbers).", JSONObject().put("kind", p("string", "Which card", TravelActions.CARDS)), listOf("kind")))
            .put(tool("hand_off_to_meta", "Hand the glasses back to Meta AI, e.g. for Meta's live conversation translation, and tell the wearer how to come back.", JSONObject()))
            .put(tool("switch_chat", "Move this conversation into another saved chat.", JSONObject().put("chat_id", p("string", "8-character id from the chat list")).put("pin", p("boolean", "true when the wearer explicitly asked to go back to it")), listOf("chat_id")))
            .put(tool("new_chat", "Start a new chat for a new subject and put this message in it.", JSONObject().put("title", p("string", "2-5 word title")), listOf("title")))
            .put(tool("rename_chat", "Give the current chat a better title.", JSONObject().put("title", p("string", "2-5 word title")), listOf("title")))
    }

    private fun call(key: String, model: String, messages: JSONArray, toolChoice: String = "auto"): JSONObject {
        // The daily cap covered only lens calls; brain turns now count and stop at it too.
        Llm.checkCap(prefs)
        // Reasoning models spent ~20 s per turn at their default effort (telemetry, 3.0); Llm.limits asks for low effort.
        val body = Llm.limits(JSONObject().put("model", model).put("messages", messages).put("tools", tools()).put("tool_choice", toolChoice), key, model, 900, 0.3)
        val req = Request.Builder().url("${Analyst.baseUrl(key)}/chat/completions").header("Authorization", "Bearer $key").header("HTTP-Referer", "https://fieldnote.app").header("X-Title", "Fieldnote")
            .post(body.toString().toRequestBody("application/json".toMediaType())).build()
        val resp = try { client.newCall(req).execute() } catch (e: java.io.IOException) { throw AnalystError("No internet right now", network = true) }
        resp.use { r ->
            val raw = r.body?.string() ?: ""
            if (!r.isSuccessful) throw AnalystError("The brain model said no (${r.code}): " + runCatching { JSONObject(raw).getJSONObject("error").getString("message") }.getOrDefault(raw.take(120)))
            val o = JSONObject(raw)
            prefs.spentTodayCents = prefs.spentTodayCents + Llm.cents(o)
            val msg = o.getJSONArray("choices").getJSONObject(0).getJSONObject("message")
            // Echo back role, content and tool_calls, plus OpenRouter's reasoning_details, which reasoning models need to see
            // again between tool rounds.
            return JSONObject().put("role", "assistant").put("content", Llm.content(msg)).also {
                if (msg.has("tool_calls") && !msg.isNull("tool_calls")) it.put("tool_calls", msg.getJSONArray("tool_calls"))
                msg.optJSONArray("reasoning_details")?.let { d -> it.put("reasoning_details", d) }
            }
        }
    }

    companion object {
        @Volatile private var inst: Agent? = null
        fun get(ctx: Context) = inst ?: synchronized(this) { inst ?: Agent(ctx.applicationContext).also { inst = it } }
    }
}

internal fun dayStart(t: Long): Long = java.util.Calendar.getInstance().apply { timeInMillis = t; set(java.util.Calendar.HOUR_OF_DAY, 0); set(java.util.Calendar.MINUTE, 0); set(java.util.Calendar.SECOND, 0); set(java.util.Calendar.MILLISECOND, 0) }.timeInMillis
