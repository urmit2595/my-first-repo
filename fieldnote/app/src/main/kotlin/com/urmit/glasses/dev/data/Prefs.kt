package com.urmit.glasses.dev.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow

class Prefs(ctx: Context) {
    private val sp = ctx.applicationContext.getSharedPreferences("fieldnote", Context.MODE_PRIVATE)
    val version = MutableStateFlow(0)
    private fun touch() { version.value = version.value + 1 }
    private fun str(k: String, d: String = "") = sp.getString(k, d) ?: d

    var apiKey: String
        get() = str("apiKey")
        set(v) { sp.edit().putString("apiKey", normaliseKey(v)).apply(); touch() }
    val provider get() = if (apiKey.startsWith("sk-or-") || apiKey.startsWith("or-v1-")) "openrouter" else "openai"
    val models get() = if (provider == "openrouter") OPENROUTER_MODELS else OPENAI_MODELS

    /** Model per lens; empty = default model. */
    fun modelFor(lensId: String): String {
        val m = str("model.$lensId")
        return if (m in models) m else defaultModel
    }
    fun setModelFor(lensId: String, m: String) { sp.edit().putString("model.$lensId", m).apply(); touch() }
    var defaultModel: String
        get() = str("model.default").let { if (it in models) it else models.first() }
        set(v) { sp.edit().putString("model.default", v).apply(); touch() }

    var autoAnalyse: Boolean
        get() = sp.getBoolean("autoAnalyse", false)
        set(v) { sp.edit().putBoolean("autoAnalyse", v).apply(); touch() }
    var answerSeconds: Int
        get() = sp.getInt("answerSeconds", 15)
        set(v) { sp.edit().putInt("answerSeconds", v).apply(); touch() }
    var dailyCapCents: Int
        get() = sp.getInt("dailyCapCents", 200)
        set(v) { sp.edit().putInt("dailyCapCents", v).apply(); touch() }
    var spentTodayCents: Int
        get() = if (str("spendDay") == today()) sp.getInt("spentCents", 0) else 0
        set(v) { sp.edit().putString("spendDay", today()).putInt("spentCents", v).apply(); touch() }
    var aboutMe: String
        get() = str("aboutMe")
        set(v) { sp.edit().putString("aboutMe", v).apply(); touch() }
    var doubleTapLens: String
        get() = str("doubleTapLens", "scene")
        set(v) { sp.edit().putString("doubleTapLens", v).apply(); touch() }
    /** Seconds to keep the camera session live after a capture; 0 = cold every time (brief default). */
    var warmSeconds: Int
        get() = sp.getInt("warmSeconds", 0)
        set(v) { sp.edit().putInt("warmSeconds", v).apply(); touch() }
    /** Orchestrator ("brain") model: routes chat and voice requests to tools. */
    var agentModel: String
        get() = str("model.agent").let { if (it in agentModels) it else agentModels.first() }
        set(v) { sp.edit().putString("model.agent", v).apply(); touch() }
    val agentModels get() = if (provider == "openrouter") OPENROUTER_AGENT_MODELS else OPENAI_AGENT_MODELS
    /** Daily calorie target for the Food tab. */
    var kcalTarget: Int
        get() = sp.getInt("kcalTarget", 2000)
        set(v) { sp.edit().putInt("kcalTarget", v).apply(); touch() }
    var proteinTarget: Int
        get() = sp.getInt("proteinTarget", 80)
        set(v) { sp.edit().putInt("proteinTarget", v).apply(); touch() }
    /** Speak answers through the phone too when no glasses are connected. */
    var speakOnPhone: Boolean
        get() = sp.getBoolean("speakOnPhone", true)
        set(v) { sp.edit().putBoolean("speakOnPhone", v).apply(); touch() }
    var wakeWordEnabled: Boolean
        get() = sp.getBoolean("wakeWord", false)
        set(v) { sp.edit().putBoolean("wakeWord", v).apply(); touch() }

    /** Self-test results, as "pass|fail|notrun:numbers". */
    fun testResult(id: String) = str("test.$id", "notrun:")
    fun setTestResult(id: String, v: String) { sp.edit().putString("test.$id", v).apply(); touch() }

    var onboarded: Boolean
        get() = sp.getBoolean("onboarded", false)
        set(v) { sp.edit().putBoolean("onboarded", v).apply(); touch() }

    var armedPersisted: Boolean
        get() = sp.getBoolean("armed", false)
        set(v) { sp.edit().putBoolean("armed", v).apply(); touch() }

    private fun today() = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US).format(System.currentTimeMillis())

    companion object {
        val OPENROUTER_MODELS = listOf("google/gemini-2.5-flash", "openai/gpt-5.6-sol", "openai/gpt-5.6-luna", "google/gemini-2.5-pro", "openai/gpt-5.4-mini", "anthropic/claude-sonnet-4.5", "openai/gpt-5")
        val OPENAI_MODELS = listOf("gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o", "gpt-5-mini", "gpt-5")
        val OPENROUTER_AGENT_MODELS = listOf("openai/gpt-5.6-sol", "openai/gpt-5.6-luna", "openai/gpt-5.4-mini", "openai/gpt-5", "anthropic/claude-sonnet-4.5", "google/gemini-2.5-pro")
        val OPENAI_AGENT_MODELS = listOf("gpt-5.6-sol", "gpt-5.6-luna", "gpt-5", "gpt-5-mini", "gpt-4.1")
        fun normaliseKey(raw: String): String {
            var k = raw.filter { !it.isWhitespace() }.trim('"', '\'', '`')
            if (k.startsWith("Bearer", true)) k = k.substring(6)
            if (k.startsWith("or-v1-")) k = "sk-$k"
            return k
        }
        @Volatile private var inst: Prefs? = null
        fun get(ctx: Context) = inst ?: synchronized(this) { inst ?: Prefs(ctx).also { inst = it } }
    }
}
