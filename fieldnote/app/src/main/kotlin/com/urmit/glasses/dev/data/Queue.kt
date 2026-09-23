package com.urmit.glasses.dev.data

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/** Serial analysis queue over the Repo (build brief §4.8). One request at a time; states persisted per item. */
class AnalysisQueue private constructor(private val ctx: Context) {
    private val repo = Repo.get(ctx)
    private val prefs = Prefs.get(ctx)
    private val media = Media(ctx)
    private val mutex = Mutex()
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Runs the request and returns the answer text (or throws). Callers decide whether to speak it. */
    suspend fun ask(key: String, uri: Uri, lensId: String, question: String = "", byVoice: Boolean = false): String = withContext(Dispatchers.IO) {
        mutex.withLock {
            val lens = Lenses.byId(lensId)
            // 0 = no cap, as the 80% warning in FieldService already assumed.
            if (prefs.dailyCapCents > 0 && prefs.spentTodayCents >= prefs.dailyCapCents) {
                repo.update(key) { it.copy(state = AnalysisState.FAILED, error = "Daily spend cap reached") }
                throw AnalystError("Daily spend cap reached. Raise it in Glasses → Analysis.")
            }
            repo.update(key) { it.copy(state = AnalysisState.ANALYSING, lens = lensId, error = "") }
            val before = repo.get(key)
            val userText = question.ifBlank { "Apply the ${lens.label} lens." }
            val threadBefore = before.thread
            val jpeg = if (lensId in Lenses.READING) media.cachedJpeg(uri, maxPx = 2048) else media.cachedJpeg(uri)
            try {
                if (jpeg == null) throw AnalystError("Could not read the photo")
                val a = answer(key, lens, jpeg, threadBefore, question)
                val now = System.currentTimeMillis()
                repo.update(key) {
                    it.copy(state = AnalysisState.ANALYSED, thread = it.thread +
                        Message("user", userText, now - a.ms, lens = lensId, byVoice = byVoice) +
                        Message("assistant", a.text, now, a.model, lensId, a.ms))
                }
                prefs.spentTodayCents = prefs.spentTodayCents + a.costCents
                Diagnostics.get(ctx).event("analysis_ok", mapOf("lens" to lensId, "model" to a.model, "ms" to a.ms, "cost_cents" to a.costCents, "turn" to threadBefore.count { it.role == "user" } + 1, "by_voice" to byVoice, "answer_chars" to a.text.length))
                a.text
            } catch (e: AnalystError) {
                // No data: the reading lenses still work on the phone (travel plan §2, offline first).
                if (e.network && jpeg != null && lensId in OFFLINE_LENSES) runCatching { offline(key, lens, jpeg, userText, byVoice) }.getOrNull()?.let { return@withLock it }
                Diagnostics.get(ctx).event("analysis_fail", mapOf("lens" to lensId, "model" to prefs.modelFor(lensId), "network" to e.network, "reason" to (e.message ?: "").take(80)))
                repo.update(key) { it.copy(state = if (e.network) AnalysisState.WAITING_FOR_NETWORK else AnalysisState.FAILED, error = e.message ?: "Failed") }
                throw e
            } catch (e: Exception) {
                repo.update(key) { it.copy(state = AnalysisState.FAILED, error = e.message ?: "Failed") }
                throw AnalystError(e.message ?: "Failed")
            }
        }
    }

    /**
     * One lens answer. Price and receipt lenses read numbers as JSON and the phone does the currency maths; the other lenses
     * are free text with the traveller, trip and place as context, and menu prices come back as tokens converted here.
     */
    private fun answer(key: String, lens: Lens, jpeg: java.io.File, thread: List<Message>, question: String): Answer {
        val trip = TripRepo.get(ctx).current(); val home = prefs.homeCurrency
        val t0 = System.currentTimeMillis()
        return when (lens.id) {
            Lenses.PRICE.id -> {
                val p = TravelAnalyst.readPrices(prefs, jpeg, trip, question)
                val rates = if (p.currency.isBlank() || p.currency == home) null else Rates.get(ctx, home)
                // Cost was already counted inside TravelAnalyst.
                Answer(TravelAnalyst.speakPrices(p, home, rates), prefs.modelFor(lens.id), System.currentTimeMillis() - t0, 0)
            }
            // A receipt is logged once; follow-up questions about it are answered as free text below.
            Lenses.RECEIPT.id -> Ledger.get(ctx).forPhoto(key).let { logged ->
                if (logged == null) {
                    val r = TravelAnalyst.readReceipt(prefs, jpeg, question, trip)
                    val e = Spending.log(ctx, r, photoKey = key, place = repo.get(key).place, note = question)
                    Answer(Spending.describe(ctx, e), prefs.modelFor(lens.id), System.currentTimeMillis() - t0, 0)
                } else if (question.isBlank()) Answer("Already in the ledger: ${Money.both(logged.amount, logged.currency, home, Rates.cached(ctx))}${if (logged.merchant.isNotBlank()) " at ${logged.merchant}" else ""}.", "ledger", 0, 0)
                else Analyst.ask(prefs.apiKey, prefs.modelFor(lens.id), lens, jpeg, thread, question, prefs.aboutMe, prefs.answerSeconds, context(key, lens, trip))
            }
            else -> {
                val a = Analyst.ask(prefs.apiKey, prefs.modelFor(lens.id), lens, jpeg, thread, question, prefs.aboutMe, prefs.answerSeconds, context(key, lens, trip))
                if (!a.text.contains("{{")) a else a.copy(text = Money.annotate(a.text, trip?.currency ?: "", home, Rates.get(ctx, home)))
            }
        }
    }

    /** Traveller profile, trip and where the photo was taken, for the lens prompt. */
    private fun context(key: String, lens: Lens, trip: Trip?): String = buildString {
        append(Profile.context(prefs)).append(' ')
        if (trip != null) {
            val trips = TripRepo.get(ctx)
            append(TravelText.context(trip, trips.currentStay()))
            if (lens.id == Lenses.BOARD.id) {
                val now = System.currentTimeMillis()
                val legs = trip.items.filter { it.kind in setOf("flight", "train", "bus", "ferry") && it.start > now - 12 * TripRepo.HOUR && it.start < now + 36 * TripRepo.HOUR }
                append(if (legs.isEmpty()) "No flight or train in the trip within the next day and a half. " else "The wearer's own departures: " + legs.joinToString("; ") { TravelText.item(it) } + ". ")
            }
            if (lens.id == Lenses.MENU.id && trip.currency.isNotBlank()) append("Menu prices are in ${trip.currency} unless marked otherwise. ")
        }
        repo.get(key).place.takeIf { it.isNotBlank() }?.let { append("Photo taken at: $it. ") } ?: Here.label().takeIf { it.isNotBlank() }?.let { append("$it. ") }
    }.trim()

    /** On-device reading (and translation when the model is present) when the cloud can't be reached. */
    private suspend fun offline(key: String, lens: Lens, jpeg: java.io.File, userText: String, byVoice: Boolean): String {
        val lang = TripRepo.get(ctx).current()?.language ?: ""
        val t0 = System.currentTimeMillis()
        val text = OnDevice.offlineRead(ctx, jpeg, lang, translate = lens.id != Lenses.READ.id)
        val now = System.currentTimeMillis()
        repo.update(key) { it.copy(state = AnalysisState.ANALYSED, error = "", thread = it.thread + Message("user", userText, t0, lens = lens.id, byVoice = byVoice) + Message("assistant", text, now, "on-device", lens.id, now - t0)) }
        Diagnostics.get(ctx).event("analysis_offline", mapOf("lens" to lens.id, "ms" to (now - t0), "lang" to lang))
        return text
    }

    companion object {
        /** Lenses that can fall back to on-device reading with no data. */
        val OFFLINE_LENSES = setOf(Lenses.READ.id, Lenses.TRANSLATE.id, Lenses.MENU.id, Lenses.BOARD.id)
        @Volatile private var inst: AnalysisQueue? = null
        fun get(ctx: Context) = inst ?: synchronized(this) { inst ?: AnalysisQueue(ctx.applicationContext).also { inst = it } }
    }
}
