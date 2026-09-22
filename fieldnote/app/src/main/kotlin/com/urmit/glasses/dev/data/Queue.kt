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
            if (prefs.spentTodayCents >= prefs.dailyCapCents) {
                repo.update(key) { it.copy(state = AnalysisState.FAILED, error = "Daily spend cap reached") }
                throw AnalystError("Daily spend cap reached. Raise it in Glasses → Analysis.")
            }
            repo.update(key) { it.copy(state = AnalysisState.ANALYSING, lens = lensId, error = "") }
            val before = repo.get(key)
            val userText = question.ifBlank { "Apply the ${lens.label} lens." }
            val threadBefore = before.thread
            try {
                val jpeg = media.cachedJpeg(uri) ?: throw AnalystError("Could not read the photo")
                val a = Analyst.ask(prefs.apiKey, prefs.modelFor(lensId), lens, jpeg, threadBefore, question, prefs.aboutMe, prefs.answerSeconds)
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
                Diagnostics.get(ctx).event("analysis_fail", mapOf("lens" to lensId, "model" to prefs.modelFor(lensId), "network" to e.network, "reason" to (e.message ?: "").take(80)))
                repo.update(key) { it.copy(state = if (e.network) AnalysisState.WAITING_FOR_NETWORK else AnalysisState.FAILED, error = e.message ?: "Failed") }
                throw e
            } catch (e: Exception) {
                repo.update(key) { it.copy(state = AnalysisState.FAILED, error = e.message ?: "Failed") }
                throw AnalystError(e.message ?: "Failed")
            }
        }
    }

    companion object {
        @Volatile private var inst: AnalysisQueue? = null
        fun get(ctx: Context) = inst ?: synchronized(this) { inst ?: AnalysisQueue(ctx.applicationContext).also { inst = it } }
    }
}
