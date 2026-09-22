package com.urmit.glasses.dev.data

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.database.ContentObserver
import android.graphics.Bitmap
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.io.File

/**
 * Reads the phone's Meta AI album and Fieldnote's own album straight from MediaStore (build brief §4.5):
 * indexed by URI, originals never copied or deleted.
 */
class Media(private val ctx: Context) {
    companion object {
        /** Bucket names the Meta AI app uses on different phones. Confirmed on device: see Glasses → Diagnostics. */
        val GLASSES_BUCKETS = listOf("Meta AI", "Meta View", "MetaAI", "Meta_AI")
        const val OWN_BUCKET = "Fieldnote"
    }

    private val proj = arrayOf(
        MediaStore.Files.FileColumns._ID, MediaStore.Files.FileColumns.MEDIA_TYPE,
        MediaStore.Files.FileColumns.DATE_TAKEN, MediaStore.Files.FileColumns.DATE_ADDED,
        MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME, MediaStore.Files.FileColumns.DURATION
    )

    /** All images and videos in the glasses album plus Fieldnote's album, newest first. */
    fun list(): List<MediaItem> {
        val buckets = GLASSES_BUCKETS + OWN_BUCKET
        val sel = "(${MediaStore.Files.FileColumns.MEDIA_TYPE}=? OR ${MediaStore.Files.FileColumns.MEDIA_TYPE}=?) AND " +
            "${MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME} IN (${buckets.joinToString(",") { "?" }})"
        val args = arrayOf(MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE.toString(), MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO.toString()) + buckets.toTypedArray()
        val out = mutableListOf<MediaItem>()
        val collection = MediaStore.Files.getContentUri("external")
        runCatching {
            ctx.contentResolver.query(collection, proj, sel, args, "${MediaStore.Files.FileColumns.DATE_ADDED} DESC")?.use { c ->
                val iId = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
                val iType = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MEDIA_TYPE)
                val iTaken = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_TAKEN)
                val iAdded = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_ADDED)
                val iBucket = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME)
                val iDur = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DURATION)
                while (c.moveToNext()) {
                    val id = c.getLong(iId)
                    val video = c.getInt(iType) == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO
                    val uri = ContentUris.withAppendedId(if (video) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)
                    val taken = c.getLong(iTaken).takeIf { it > 0 } ?: (c.getLong(iAdded) * 1000)
                    val src = if (c.getString(iBucket) == OWN_BUCKET) Source.FIELDNOTE else Source.GLASSES
                    out += MediaItem("ms:$id", uri, video, taken, src, if (video) c.getLong(iDur) else 0)
                }
            }
        }
        return out
    }

    /** Emits whenever MediaStore changes; the Gallery re-queries on each tick (debounced by the caller). */
    fun changes(): Flow<Unit> = callbackFlow {
        val obs = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) { trySend(Unit) }
        }
        ctx.contentResolver.registerContentObserver(MediaStore.Files.getContentUri("external"), true, obs)
        trySend(Unit)
        awaitClose { ctx.contentResolver.unregisterContentObserver(obs) }
    }

    /** Which glasses bucket actually exists on this phone, for the diagnostics row. */
    fun detectedGlassesBucket(): String? = list().firstOrNull { it.source == Source.GLASSES }?.let { item ->
        runCatching {
            ctx.contentResolver.query(item.uri, arrayOf(MediaStore.MediaColumns.BUCKET_DISPLAY_NAME), null, null, null)?.use { if (it.moveToFirst()) it.getString(0) else null }
        }.getOrNull()
    }

    /** Saves a capture into Pictures/Fieldnote through MediaStore and returns its key + uri. */
    fun saveCapture(bitmap: Bitmap): Pair<String, Uri>? = saveBytes { out -> bitmap.compress(Bitmap.CompressFormat.JPEG, 92, out) }

    fun saveCaptureBytes(bytes: ByteArray, mime: String = "image/jpeg", ext: String = "jpg"): Pair<String, Uri>? =
        saveBytes(mime, ext) { it.write(bytes) }

    private fun saveBytes(mime: String = "image/jpeg", ext: String = "jpg", write: (java.io.OutputStream) -> Unit): Pair<String, Uri>? {
        val name = "FN_${java.text.SimpleDateFormat("yyyyMMdd_HHmmss", java.util.Locale.US).format(System.currentTimeMillis())}.$ext"
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, name)
            put(MediaStore.Images.Media.MIME_TYPE, mime)
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/$OWN_BUCKET")
            put(MediaStore.Images.Media.DATE_TAKEN, System.currentTimeMillis())
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val resolver = ctx.contentResolver
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return null
        return runCatching {
            resolver.openOutputStream(uri)!!.use { write(it) }
            resolver.update(uri, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
            val id = ContentUris.parseId(uri)
            "ms:$id" to uri
        }.getOrElse { resolver.delete(uri, null, null); null }
    }

    /** Copies a MediaStore item into cache as a JPEG file the analyst can read (downscaled). */
    fun cachedJpeg(uri: Uri, maxPx: Int = 1280): File? = runCatching {
        val opts = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        ctx.contentResolver.openInputStream(uri)?.use { android.graphics.BitmapFactory.decodeStream(it, null, opts) }
        var sample = 1
        while (opts.outWidth / sample > maxPx * 2 || opts.outHeight / sample > maxPx * 2) sample *= 2
        var bmp = ctx.contentResolver.openInputStream(uri)?.use { android.graphics.BitmapFactory.decodeStream(it, null, android.graphics.BitmapFactory.Options().apply { inSampleSize = sample }) } ?: return null
        val scale = maxPx.toFloat() / maxOf(bmp.width, bmp.height)
        if (scale < 1f) bmp = Bitmap.createScaledBitmap(bmp, (bmp.width * scale).toInt(), (bmp.height * scale).toInt(), true)
        val f = File(ctx.cacheDir, "a_${uri.lastPathSegment}.jpg")
        f.outputStream().use { bmp.compress(Bitmap.CompressFormat.JPEG, 82, it) }
        f
    }.getOrNull()
}
