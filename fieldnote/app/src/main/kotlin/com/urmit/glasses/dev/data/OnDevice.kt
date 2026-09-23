package com.urmit.glasses.dev.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.ExifInterface
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.moduleinstall.InstallStatusListener
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate.InstallState
import com.google.android.gms.tasks.Task
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import java.util.Locale
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * On-device reading and translation (travel plan §5, §11: ML Kit), for when there is no data.
 * Text reading uses the Play services recognisers (models live in Play services, not in the APK; fetched once by
 * [ensureReader]); translation models (~30 MB each) are fetched by [ensureTranslateModel] and never on demand.
 */
object OnDevice {
    private const val DOWNLOAD_MS = 5 * 60_000L   // a translation model on slow roaming data
    private const val LIMIT = 600                 // characters of spoken answer
    private val ALIAS = mapOf("fil" to "tl", "nn" to "no")   // BCP-47 codes ML Kit spells differently (it maps iw, in, nb itself)

    /** True when an on-device model can translate [lang] (BCP-47) into English. */
    fun canTranslate(lang: String): Boolean = source(lang) != null

    /** Downloads the [lang] → English translation model if it is missing. True when it is ready to use offline. */
    suspend fun ensureTranslateModel(ctx: Context, lang: String): Boolean {
        val src = source(lang) ?: return false
        if (translateReady(ctx, lang)) return true
        // Default conditions (any network, not only Wi-Fi): the wearer tapped to prepare the pack, so use the data they chose to use.
        safely(null) { withTimeoutOrNull(DOWNLOAD_MS) { RemoteModelManager.getInstance().download(TranslateRemoteModel.Builder(src).build(), DownloadConditions.Builder().build()).await() } }
        return translateReady(ctx, lang)
    }

    /** True when the [lang] → English model is already on the phone (no download). */
    suspend fun translateReady(ctx: Context, lang: String): Boolean {
        val src = source(lang) ?: return false
        return safely(false) { RemoteModelManager.getInstance().getDownloadedModels(TranslateRemoteModel::class.java).await().any { it.language == src } }
    }

    /** Makes sure the text reader for [lang]'s script is installed. True when reading works offline. */
    suspend fun ensureReader(ctx: Context, lang: String): Boolean {
        if (!playServices(ctx)) return false
        val rec = safely(null) { recognizer(lang) } ?: return false
        return try {
            val client = ModuleInstall.getClient(ctx)
            client.areModulesAvailable(rec).await().areModulesAvailable() || install(ctx, rec)
        } catch (e: CancellationException) { throw e } catch (_: Throwable) { warmUp(rec) } finally { rec.close() }
    }

    /** Recognised text in reading order, "" when none. [lang] picks the script (ja, zh, ko, hi/mr/ne, else Latin). */
    suspend fun readText(ctx: Context, photo: File, lang: String): String = recognise(ctx, photo, lang) ?: ""

    /** English translation, or null when the model is not on the phone. Never downloads. */
    suspend fun translate(ctx: Context, text: String, from: String): String? = translateLines(ctx, text.lines(), from, Int.MAX_VALUE)

    /**
     * Offline answer for the reading lenses: on-device text reading, then translation into English when [translate] and the
     * model is present. Spoken-friendly; says plainly when it could only read and not translate.
     */
    suspend fun offlineRead(ctx: Context, photo: File, lang: String, translate: Boolean): String {
        val text = recognise(ctx, photo, lang) ?: throw AnalystError(if (playServices(ctx)) "Offline reading isn't ready on this phone. Prepare the trip's offline pack while you have data."
            else "This phone can't read text offline: it needs Google Play services.")
        if (text.isBlank()) throw AnalystError("I couldn't find any text in that photo.")
        val wanted = translate && lang.isNotBlank() && base(lang) != "en"
        val english = if (wanted) translateLines(ctx, text.lines(), lang, LIMIT + 50)?.takeIf { it.isNotBlank() } else null
        return when {
            english != null -> "Offline reading. It says: ${spoken(english)}"
            wanted -> "Offline, so I can only read it, not translate it: ${spoken(text)}"
            else -> "Offline reading. It says: ${spoken(text)}"
        }
    }

    /* ---------------- reading ---------------- */

    /** Every non-Latin recogniser also reads Latin, so a bilingual sign comes out whole. */
    private fun recognizer(lang: String): TextRecognizer = TextRecognition.getClient(when (base(lang)) {
        "ja" -> JapaneseTextRecognizerOptions.Builder().build()
        "zh" -> ChineseTextRecognizerOptions.Builder().build()
        "ko" -> KoreanTextRecognizerOptions.Builder().build()
        "hi", "mr", "ne", "sa" -> DevanagariTextRecognizerOptions.Builder().build()
        else -> TextRecognizerOptions.DEFAULT_OPTIONS
    })

    /** Blocks in ML Kit's reading order, one per line; null when the reader itself failed (no Play services, module not installed yet). */
    private suspend fun recognise(ctx: Context, photo: File, lang: String): String? {
        if (!playServices(ctx)) return null
        return safely(null) {
            val bmp = withContext(Dispatchers.IO) { decode(photo) } ?: return@safely ""
            val rec = recognizer(lang)
            try {
                val text = withTimeoutOrNull(30_000) { rec.process(InputImage.fromBitmap(bmp, rotation(photo))).await() } ?: return@safely null
                withContext(Dispatchers.Default) { text.textBlocks.map { b -> join(b.lines.map { it.text.trim() }) }.filter { it.isNotBlank() }.joinToString("\n") }
            } finally { rec.close(); bmp.recycle() }
        }
    }

    /** Callers pass a JPEG of at most 1280 px; the sampling only guards against an original straight from the camera. */
    private fun decode(f: File): Bitmap? {
        val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }.also { BitmapFactory.decodeFile(f.path, it) }
        if (o.outWidth <= 0 || o.outHeight <= 0) return null
        var s = 1; while (maxOf(o.outWidth, o.outHeight) / s > 2560) s *= 2
        return BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = s })
    }

    private fun rotation(f: File) = when (runCatching { ExifInterface(f.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1) }.getOrDefault(1)) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90; ExifInterface.ORIENTATION_ROTATE_180 -> 180; ExifInterface.ORIENTATION_ROTATE_270 -> 270; else -> 0
    }

    /** A block's lines as one line: a sign or paragraph wrapped over lines reads, and translates, as one sentence. No space between CJK characters. */
    private fun join(lines: List<String>) = lines.filter { it.isNotEmpty() }.fold("") { acc, l -> if (acc.isEmpty()) l else acc + (if (cjk(acc.last()) && cjk(l.first())) "" else " ") + l }
    private fun cjk(c: Char) = c in '\u2E80'..'\u9FFF' || c in '\uF900'..'\uFAFF' || c in '\uFF00'..'\uFFEF'

    /** Asks Play services for the module and waits for the install itself: the request's task only says it was accepted. */
    private suspend fun install(ctx: Context, rec: TextRecognizer): Boolean {
        val client = ModuleInstall.getClient(ctx)
        var listener: InstallStatusListener? = null
        try {
            val done = withTimeoutOrNull(DOWNLOAD_MS) {
                suspendCancellableCoroutine<Boolean> { c ->
                    val l = InstallStatusListener { u ->
                        when (u.installState) {
                            InstallState.STATE_COMPLETED -> if (c.isActive) c.resume(true)
                            InstallState.STATE_FAILED, InstallState.STATE_CANCELED -> if (c.isActive) c.resume(false)
                        }
                    }.also { listener = it }
                    client.installModules(ModuleInstallRequest.newBuilder().addApi(rec).setListener(l, Runnable::run).build())
                        .addOnSuccessListener(Runnable::run) { if (it.areModulesAlreadyInstalled() && c.isActive) c.resume(true) }
                        .addOnFailureListener(Runnable::run) { if (c.isActive) c.resumeWithException(it) }
                }
            }
            return done ?: client.areModulesAvailable(rec).await().areModulesAvailable()
        } finally { listener?.let { runCatching { client.unregisterListener(it) } } }
    }

    /** Fallback when the module API is missing from Play services: a first recognition starts the model download and fails until it lands. */
    private suspend fun warmUp(rec: TextRecognizer): Boolean = safely(false) {
        val blank = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
        try { rec.process(InputImage.fromBitmap(blank, 0)).await(); true } finally { blank.recycle() }
    }

    private fun playServices(ctx: Context) = runCatching { GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(ctx) == ConnectionResult.SUCCESS }.getOrDefault(false)

    /* ---------------- translation ---------------- */

    private fun base(lang: String) = lang.trim().lowercase(Locale.US).substringBefore('-').substringBefore('_')

    /** ML Kit's code for [lang], or null when it has no model for it or it is English already. */
    private fun source(lang: String): String? = base(lang).let { ALIAS[it] ?: it }.let { runCatching { TranslateLanguage.fromLanguageTag(it) }.getOrNull() }?.takeIf { it != TranslateLanguage.ENGLISH }

    /**
     * Translates line by line, so a menu or sign keeps its shape and numbers-only lines (prices, times) pass through untouched;
     * stops once [budget] characters of English are done. Null unless the model is already on the phone.
     */
    private suspend fun translateLines(ctx: Context, lines: List<String>, from: String, budget: Int): String? {
        val src = source(from) ?: return null
        if (!translateReady(ctx, from)) return null
        return safely(null) {
            val t = Translation.getClient(TranslatorOptions.Builder().setSourceLanguage(src).setTargetLanguage(TranslateLanguage.ENGLISH).build())
            try {
                withContext(Dispatchers.Default) {
                    val out = mutableListOf<String>(); var n = 0
                    for (l in lines.map { it.trim() }.filter { it.isNotEmpty() }) {
                        if (n >= budget) break
                        val e = if (l.any { it.isLetter() }) t.translate(l).await().trim() else l
                        if (e.isNotEmpty()) { out += e; n += e.length + 1 }
                    }
                    out.joinToString("\n")
                }
            } finally { t.close() }
        }
    }

    /* ---------------- plumbing ---------------- */

    /** Lines as sentences, so text-to-speech pauses between them; cut near [LIMIT] at a sentence end, saying so. */
    private fun spoken(s: String): String {
        val all = s.lines().map { it.trim() }.filter { it.isNotEmpty() }.joinToString(" ") { if (it.last() in ".!?:;…。！？।") it else "$it." }
        if (all.length <= LIMIT) return all
        val head = all.take(LIMIT)
        val end = head.indices.lastOrNull { i -> head[i] in "。！？।" || (head[i] in ".!?" && (i + 1 == head.length || head[i + 1] == ' ')) }?.takeIf { it >= LIMIT / 2 }
            ?: head.lastIndexOf(' ').takeIf { it >= LIMIT / 2 } ?: (LIMIT - 1)
        return head.take(end + 1).trimEnd() + " (There's more text.)"
    }

    /** ML Kit and Play services fail in many ways offline or without Play services: callers get [fallback], never a crash. Cancellation still propagates. */
    private inline fun <T> safely(fallback: T, block: () -> T): T = try { block() } catch (e: CancellationException) { throw e } catch (_: Throwable) { fallback }

    /** Google Task → coroutine without kotlinx-coroutines-play-services. Completes on the finishing thread, so it never needs the main looper. */
    private suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { c ->
        addOnCompleteListener(Runnable::run) { t -> if (t.isSuccessful) c.resume(t.result) else c.resumeWithException(t.exception ?: IllegalStateException("Task cancelled")) }
    }
}
