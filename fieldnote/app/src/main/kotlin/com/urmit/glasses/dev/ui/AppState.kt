package com.urmit.glasses.dev.ui

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapRegionDecoder
import android.graphics.Rect
import android.graphics.pdf.PdfRenderer
import android.media.ExifInterface
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import androidx.core.content.FileProvider
import com.urmit.glasses.dev.data.Agent
import com.urmit.glasses.dev.data.AnalysisQueue
import com.urmit.glasses.dev.data.AnalystError
import com.urmit.glasses.dev.data.ChatMessage
import com.urmit.glasses.dev.data.ChatRepo
import com.urmit.glasses.dev.data.Expense
import com.urmit.glasses.dev.data.FoodAnalyst
import com.urmit.glasses.dev.data.FoodRepo
import com.urmit.glasses.dev.data.Here
import com.urmit.glasses.dev.data.Ledger
import com.urmit.glasses.dev.data.Lenses
import com.urmit.glasses.dev.data.Meal
import com.urmit.glasses.dev.data.OfflinePack
import com.urmit.glasses.dev.data.Pack
import com.urmit.glasses.dev.data.Pin
import com.urmit.glasses.dev.data.PinRepo
import com.urmit.glasses.dev.data.RateTable
import com.urmit.glasses.dev.data.Rates
import com.urmit.glasses.dev.data.Spending
import com.urmit.glasses.dev.data.Tagger
import com.urmit.glasses.dev.data.TravelActions
import com.urmit.glasses.dev.data.TravelAnalyst
import com.urmit.glasses.dev.data.Trip
import com.urmit.glasses.dev.data.TripItem
import com.urmit.glasses.dev.data.TripRepo
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
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Calendar
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.ceil

/** Something shared into Fieldnote, already copied into cache (the share's read grant ends with the activity). */
data class SharedFile(val uri: Uri, val mime: String, val name: String) {
    val isImage get() = mime.startsWith("image/")
    val isPdf get() = mime == "application/pdf"
}

/**
 * A booking waiting to be read: shared or pasted text plus files. [failed] counts shared items that couldn't be opened.
 * [done] once its bookings were filed: a restored Import screen must not offer to add them again.
 */
data class PendingImport(val text: String, val files: List<SharedFile>, val failed: Int = 0, val id: Long = System.nanoTime(), val done: Boolean = false)

data class ImportResult(val ok: Boolean, val message: String, val tripId: String = "", val forId: Long = 0)

/** Travel import, pack and spend progress, shared by every screen that shows it. */
private object TravelUi {
    val pendingImport = MutableStateFlow<PendingImport?>(null)
    val importReceiving = MutableStateFlow(false)
    val importBusy = MutableStateFlow(false)
    val importBusyFor = MutableStateFlow(0L)
    val importResult = MutableStateFlow<ImportResult?>(null)
    val packStep = MutableStateFlow<String?>(null)
    val packTripId = MutableStateFlow("")
    val packVersion = MutableStateFlow(0)
    val spendBusy = MutableStateFlow(false)
    val spendMessage = MutableStateFlow<String?>(null)
}

/**
 * One per process ([get]), on the application context: a rotation or a dark-mode switch reuses it, so work it started (an
 * import, the offline pack, a spend) still reaches the screen, and its watchers run once rather than once per activity.
 */
class AppState private constructor(context: Context) {
    private val ctx: Context = context.applicationContext
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

    private val started = AtomicBoolean(false)

    /** Starts the MediaStore, toast and travel watchers; later calls do nothing. */
    @OptIn(FlowPreview::class)
    fun start() {
        if (!started.compareAndSet(false, true)) return
        scope.launch { media.changes().debounce(600).collect { refresh() } }
        scope.launch { Bus.toast.collect { it?.let { m -> toast.value = m; Bus.toast.value = null } } }
        startTravel()
    }

    private val tagging = AtomicBoolean(false)

    fun refresh() = scope.launch {
        val list = media.list()
        raw.value = list; loading.value = false
        // Place names for photos that missed them (taken offline, or imported from the Meta AI album). Skips itself when
        // location isn't allowed or tagging is off. The raw list carries empty notes, so join the real ones first.
        if (tagging.compareAndSet(false, true)) launch {
            try { Tagger.catchUp(app, list.map { it.copy(note = repo.get(it.key)) }) } catch (_: Exception) { } finally { tagging.set(false) }
        }
    }

    fun ask(item: MediaItem, lensId: String, question: String = "", byVoice: Boolean = false) = scope.launch {
        runCatching { queue.ask(item.key, item.uri, lensId, question, byVoice) }.onFailure { toast.value = it.message }
    }

    /** Chat tab: typed message → orchestrator. */
    fun sendChat(text: String, photoKey: String = "") = scope.launch {
        if (prefs.apiKey.isBlank()) { toast.value = "Add your API key first (Glasses → Answers)"; return@launch }
        agent.run(text, photoKey, byVoice = false)
        refresh()
    }

    /** Chat chips answered on the phone, like the voice commands: they work offline and without a key. */
    fun takeMeHome() = answerOnPhone("Take me home", "Finding the way home…") { TravelActions.takeMeHome(it) }
    fun whereAmI() = answerOnPhone("Where am I?", "Finding you…") { TravelActions.whereAmI(it) }

    private fun answerOnPhone(said: String, status: String, answer: suspend (Context) -> String) = scope.launch {
        val t0 = System.currentTimeMillis()
        chat.add(ChatMessage("user", said, t0))
        val mine = chat.busy.compareAndSet(false, true)
        if (mine) chat.status.value = status
        try {
            val out = try { answer(app) } catch (e: Exception) { e.message?.takeIf { it.isNotBlank() } ?: "Something went wrong. Try again." }
            chat.add(ChatMessage("assistant", out, System.currentTimeMillis(), model = "on phone", ms = System.currentTimeMillis() - t0))
        } finally { if (mine) { chat.busy.value = false; chat.status.value = "" } }
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
            val updated = FoodAnalyst.analyse(prefs.apiKey, prefs.modelFor(Lenses.FOOD.id), jpeg, prefs.aboutMe, note, m, prefs)
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
            val meal = FoodAnalyst.analyse(prefs.apiKey, prefs.modelFor(Lenses.FOOD.id), jpeg, prefs.aboutMe, "", prev, prefs).copy(photoKey = item.key, eatenAt = prev?.eatenAt ?: item.takenAt)
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

    /* ======================= Travel (3.4) ======================= */

    private val app: Context = ctx

    private val _trips = MutableStateFlow<List<Trip>>(emptyList())
    private val _expenses = MutableStateFlow<List<Expense>>(emptyList())
    private val _pins = MutableStateFlow<List<Pin>>(emptyList())
    val trips: StateFlow<List<Trip>> = _trips
    val expenses: StateFlow<List<Expense>> = _expenses
    val pins: StateFlow<List<Pin>> = _pins
    /** Last saved exchange rates, updated whenever anything (the session, the brain, the Trip tab) fetches them. */
    val rates: StateFlow<RateTable?> = Rates.table
    /** A trip the Trip tab shows without making it the one Fieldnote acts on (bookings just filed into another trip). */
    val viewTripId = MutableStateFlow<String?>(null)
    /** True once the trip, ledger and pin files have been read. They are read off the main thread; until then screens wait. */
    val travelReady = MutableStateFlow(false)

    /** True between onResume and onPause: cards the brain asks for open on screen only then (otherwise the session notifies). */
    val resumed = MutableStateFlow(false)
    /** Bumped on every resume (which includes coming back from a permission dialog or Settings), so permission rows re-check. */
    val permTick = MutableStateFlow(0)
    /** A route the activity wants shown (a card from a notification, the import screen after a share). */
    val pendingRoute = MutableStateFlow<String?>(null)
    fun go(route: String) { pendingRoute.value = route }

    val tripRepo: TripRepo get() = TripRepo.get(app)
    val ledger: Ledger get() = Ledger.get(app)

    val pendingImport: StateFlow<PendingImport?> = TravelUi.pendingImport
    val importReceiving: StateFlow<Boolean> = TravelUi.importReceiving
    val importBusy: StateFlow<Boolean> = TravelUi.importBusy
    val importBusyFor: StateFlow<Long> = TravelUi.importBusyFor
    val importResult: StateFlow<ImportResult?> = TravelUi.importResult
    val packStep: StateFlow<String?> = TravelUi.packStep
    val packTripId: StateFlow<String> = TravelUi.packTripId
    val packVersion: StateFlow<Int> = TravelUi.packVersion
    val spendBusy: StateFlow<Boolean> = TravelUi.spendBusy
    val spendMessage: StateFlow<String?> = TravelUi.spendMessage

    private fun startTravel() = scope.launch {
        val t = TripRepo.get(app); val l = Ledger.get(app); val p = PinRepo.get(app)
        Rates.cached(app)   // reads rates.json once into Rates.table
        _trips.value = t.trips.value; _expenses.value = l.expenses.value; _pins.value = p.pins.value
        travelReady.value = true
        launch { t.trips.collect { _trips.value = it } }
        launch { l.expenses.collect { _expenses.value = it } }
        launch { p.pins.collect { _pins.value = it } }
    }

    /** The trip Fieldnote acts on (see [TripRepo.current]); null until the trips are read. Cheap: in memory. */
    fun currentTrip(): Trip? = if (travelReady.value) tripRepo.current() else null
    fun currentStay(): TripItem? = if (travelReady.value) tripRepo.currentStay() else null

    /** Shows [tripId] on the Trip tab (bookings just filed there) without changing the trip Fieldnote acts on. */
    fun viewTrip(tripId: String) { viewTripId.value = tripId.takeIf { it.isNotBlank() && it != currentTrip()?.id } }

    /**
     * Pins [id] as the trip Fieldnote acts on; "" goes back to choosing by date. A trip the date rules pick anyway is not
     * pinned, so a later trip still takes over when its dates come.
     */
    fun setActiveTrip(id: String) {
        viewTripId.value = null
        prefs.activeTripId = ""
        if (id.isBlank() || tripRepo.byDate()?.id == id) return
        prefs.activeTripId = id
        // An ended trip's pin doesn't take (TripRepo.current); show it view-only instead of doing nothing.
        if (tripRepo.current()?.id != id) { prefs.activeTripId = ""; viewTripId.value = id }
    }

    /** Not while a booking is being read or a pack prepared: either would write the trip, or its pack, back afterwards. */
    fun deleteTrip(id: String) {
        if (TravelUi.importBusy.value || TravelUi.importReceiving.value || TravelUi.packStep.value != null) { toast.value = "Wait until Fieldnote has finished with the booking or the offline pack"; return }
        scope.launch { tripRepo.delete(id); OfflinePack.delete(app, id) }
    }
    fun deleteTripItem(tripId: String, itemId: String) = scope.launch { tripRepo.deleteItem(tripId, itemId) }
    fun deleteExpense(id: String) = scope.launch { ledger.delete(id) }
    fun deletePin(id: String) = scope.launch { PinRepo.get(app).delete(id) }

    /* ---- bookings in: share sheet, paste box, file picker ---- */

    /** From the share sheet. Copies the shared files into cache right away, while the read grant lasts. */
    fun receiveShare(text: String, uris: List<Uri>, typeHint: String?) {
        TravelUi.importResult.value = null
        TravelUi.pendingImport.value = PendingImport(text, emptyList())
        if (uris.isEmpty()) return
        TravelUi.importReceiving.value = true
        scope.launch {
            try {
                val (files, failed) = copyIn(uris, typeHint)
                TravelUi.pendingImport.value = PendingImport(text, files, failed)
            } finally { TravelUi.importReceiving.value = false }
        }
    }

    /** Paste box on the Trip tab. */
    fun addBookingText(text: String) {
        if (text.isBlank()) return
        TravelUi.pendingImport.value = PendingImport(text.trim(), emptyList())
        runImport()
    }

    /** Screenshots or PDFs from the picker on the Trip tab. */
    fun addBookingImages(uris: List<Uri>) {
        if (uris.isEmpty() || TravelUi.importBusy.value) return
        TravelUi.importResult.value = null
        TravelUi.importReceiving.value = true
        scope.launch {
            val (files, failed) = try { copyIn(uris, null) } finally { TravelUi.importReceiving.value = false }
            if (files.isEmpty()) {
                // The earlier import is done with (and copyIn cleared its files): Try again must not run it a second time.
                TravelUi.pendingImport.value = null
                TravelUi.importResult.value = ImportResult(false, "Couldn't open ${if (failed == 1) "that file" else "those files"}.")
                return@launch
            }
            TravelUi.pendingImport.value = PendingImport("", files, failed)
            runImport()
        }
    }

    fun clearImportResult() { TravelUi.importResult.value = null }

    /** Reads the pending import (images, PDF pages, text) and files the bookings into a trip. */
    fun runImport() {
        val p = TravelUi.pendingImport.value?.takeIf { !it.done } ?: return
        if (!TravelUi.importBusy.compareAndSet(false, true)) return
        TravelUi.importBusyFor.value = p.id
        TravelUi.importResult.value = null
        scope.launch {
            var images: List<File> = emptyList()
            val result = try {
                val (text, read, note) = readForBookings(p)
                images = read
                if (text.isBlank() && images.isEmpty()) throw AnalystError(note.ifBlank { "Couldn't open what was shared. Try a screenshot of the booking." })
                val added = TravelActions.addBookings(app, text, images)
                ImportResult(true, added.summary + if (note.isNotBlank()) " $note" else "", added.trip.id, p.id)
            } catch (e: Exception) {
                ImportResult(false, e.message?.takeIf { it.isNotBlank() } ?: "Couldn't read that booking.", forId = p.id)
            } finally {
                images.forEach { runCatching { it.delete() } }   // downscaled copies and PDF pages; the shared originals stay for Try again
            }
            if (result.ok) TravelUi.pendingImport.compareAndSet(p, p.copy(done = true))
            TravelUi.importResult.value = result
            TravelUi.importBusy.value = false
        }
    }

    private fun copyIn(uris: List<Uri>, typeHint: String?): Pair<List<SharedFile>, Int> {
        val root = File(app.cacheDir, "import")
        if (!TravelUi.importBusy.value) root.listFiles()?.forEach { it.deleteRecursively() }
        val dir = File(root, System.currentTimeMillis().toString()).apply { mkdirs() }
        val cr = app.contentResolver
        // Only other apps' content: a file:// path or Fieldnote's own provider would be read with Fieldnote's permissions
        // (its prefs hold the API key). The exported share target accepts intents from any app.
        val (ok, refused) = uris.distinct().partition { u -> u.scheme == ContentResolver.SCHEME_CONTENT && u.authority.let { a -> !a.isNullOrBlank() && !a.startsWith(OWN_AUTHORITY) } }
        var failed = refused.size
        val files = ok.take(MAX_SHARED).mapIndexedNotNull { i, u ->
            runCatching {
                val name = displayName(u) ?: u.lastPathSegment?.substringAfterLast('/')?.ifBlank { null } ?: "file ${i + 1}"
                // A provider's octet-stream or a wildcard share type says nothing: the name, then the file's first bytes decide.
                val declared = cr.getType(u)?.takeUnless { generic(it) } ?: mimeFromName(name) ?: typeHint?.takeUnless { generic(it) } ?: ""
                val f = File(dir, "${i}_" + name.replace(Regex("[^A-Za-z0-9._-]"), "_").takeLast(60))
                val copied = cr.openInputStream(u)?.use { input -> f.outputStream().use { out -> copyCapped(input, out) } } ?: false
                if (!copied) { f.delete(); null } else SharedFile(Uri.fromFile(f), (sniff(f) ?: declared).lowercase(), name)
            }.getOrNull() ?: run { failed++; null }
        }
        return files to failed + (ok.size - ok.take(MAX_SHARED).size)
    }

    private fun generic(mime: String) = '*' in mime || mime.equals("application/octet-stream", true)

    /** The type from the file's first bytes, for the kinds read here; null for text and anything else. */
    private fun sniff(f: File): String? {
        val b = ByteArray(12)
        val n = runCatching { f.inputStream().use { it.read(b) } }.getOrDefault(0)
        fun at(i: Int, s: String) = n >= i + s.length && s.indices.all { b[i + it] == s[it].code.toByte() }
        return when {
            at(0, "%PDF") -> "application/pdf"
            n >= 3 && b[0] == 0xFF.toByte() && b[1] == 0xD8.toByte() && b[2] == 0xFF.toByte() -> "image/jpeg"
            n >= 4 && b[0] == 0x89.toByte() && at(1, "PNG") -> "image/png"
            at(0, "RIFF") && at(8, "WEBP") -> "image/webp"
            at(4, "ftyp") -> when (String(b, 8, 4, Charsets.US_ASCII)) {   // the brand: videos share the box
                "avif", "avis" -> "image/avif"; "heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "msf1" -> "image/heif"; else -> null
            }
            else -> null
        }
    }

    private fun displayName(u: Uri): String? = runCatching {
        app.contentResolver.query(u, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
    }.getOrNull()?.takeIf { it.isNotBlank() }

    private fun mimeFromName(name: String): String? = when (name.substringAfterLast('.', "").lowercase()) {
        "pdf" -> "application/pdf"; "jpg", "jpeg" -> "image/jpeg"; "png" -> "image/png"; "webp" -> "image/webp"; "heic", "heif" -> "image/heif"
        "txt", "eml" -> "text/plain"; "htm", "html" -> "text/html"; else -> null
    }

    /** Copies at most 40 MB; false when the file was bigger (nothing that large is a booking). */
    private fun copyCapped(input: java.io.InputStream, out: java.io.OutputStream, max: Long = 40L * 1024 * 1024): Boolean {
        val buf = ByteArray(64 * 1024); var total = 0L
        while (true) { val n = input.read(buf); if (n < 0) return true; total += n; if (total > max) return false; out.write(buf, 0, n) }
    }

    /**
     * Text as is; images downscaled to 2048 px, long screenshots cut into strips; PDFs rendered to JPEG, up to 4 pages each.
     * At most 6 images go to the model.
     */
    private fun readForBookings(p: PendingImport): Triple<String, List<File>, String> {
        val text = StringBuilder(p.text)
        val images = mutableListOf<File>(); val problems = mutableListOf<String>(); var dropped = false
        for (f in p.files) {
            when {
                f.isImage -> if (images.size >= MAX_IMAGES) dropped = true else {
                    val cut = runCatching { strips(f, MAX_IMAGES - images.size) }.getOrNull()
                    if (cut != null && cut.first.isNotEmpty()) { images += cut.first; if (cut.second) dropped = true }
                    else media.cachedJpeg(f.uri, maxPx = 2048)?.let { images += it } ?: run { problems += "Couldn't open ${f.name}." }
                }
                f.isPdf -> try {
                    val (pages, total) = renderPdf(f.uri, minOf(PDF_PAGES, MAX_IMAGES - images.size))
                    images += pages
                    if (total > pages.size) dropped = true
                } catch (e: SecurityException) { problems += "${f.name} is password-protected. Share a screenshot of it instead." }
                catch (e: Exception) { problems += "Couldn't open ${f.name}." }
                f.mime.startsWith("text/") -> readText(f.uri)?.let { if (it.isNotBlank()) { if (text.isNotEmpty()) text.append("\n\n"); text.append(it) } } ?: run { problems += "Couldn't open ${f.name}." }
                else -> problems += "${f.name} isn't a type Fieldnote can read."
            }
        }
        if (dropped) problems += "Only the first $MAX_IMAGES pages and images were read."
        if (p.failed > 0) problems += "${p.failed} shared item${if (p.failed == 1) "" else "s"} couldn't be opened."
        return Triple(text.toString(), images, problems.joinToString(" "))
    }

    /**
     * A long scrolling screenshot (taller than [TALL]:1) as full-width strips, top first, at most [slots] of them and none
     * wider than [STRIP_PX]: shrunk whole by its long side, a 1080 × 12000 capture came out 184 px wide and unreadable.
     * Null for any other image. The flag is true when the strips stop short of the bottom.
     */
    private fun strips(f: SharedFile, slots: Int): Pair<List<File>, Boolean>? {
        val path = f.uri.path?.takeIf { f.uri.scheme == "file" } ?: return null
        val b = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, b)
        val w = b.outWidth; val h = b.outHeight
        if (slots <= 0 || w <= 0 || h <= w * TALL) return null
        // A sideways photo's pixels aren't upright: cachedJpeg turns those.
        val turn = runCatching { ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
        if (turn != ExifInterface.ORIENTATION_NORMAL && turn != ExifInterface.ORIENTATION_UNDEFINED) return null
        // Strips up to 2.5:1 while the slots last, then taller ones up to 4:1; past that the bottom is left out.
        val n = minOf(slots, ceil(h / (w * 2.5f)).toInt())
        val stripH = minOf((h + n - 1) / n, w * 4)
        var sample = 1; while (w / (sample * 2) >= STRIP_PX) sample *= 2
        val decoder = BitmapRegionDecoder.newInstance(path)
        val out = mutableListOf<File>(); var top = 0
        try {
            while (top < h && out.size < n) {
                val bottom = minOf(h, top + stripH)
                val raw = runCatching { decoder.decodeRegion(Rect(0, top, w, bottom), BitmapFactory.Options().apply { inSampleSize = sample }) }.getOrNull() ?: break
                val bmp = if (raw.width > STRIP_PX) Bitmap.createScaledBitmap(raw, STRIP_PX, (raw.height * STRIP_PX.toFloat() / raw.width).toInt().coerceAtLeast(1), true).also { raw.recycle() } else raw
                try {
                    val s = File(app.cacheDir, "strip_${System.nanoTime()}.jpg")
                    s.outputStream().use { bmp.compress(Bitmap.CompressFormat.JPEG, 85, it) }
                    out += s
                } finally { bmp.recycle() }
                top = bottom
            }
        } finally { decoder.recycle() }
        return out to (top < h)
    }

    /** Renders up to [maxPages] pages at ~1600 px wide on white (PDF pages are transparent). Returns the files and the page count. */
    private fun renderPdf(uri: Uri, maxPages: Int): Pair<List<File>, Int> {
        val pfd = (if (uri.scheme == "file") ParcelFileDescriptor.open(File(uri.path ?: ""), ParcelFileDescriptor.MODE_READ_ONLY) else app.contentResolver.openFileDescriptor(uri, "r"))
            ?: throw AnalystError("Couldn't open the PDF")
        val out = mutableListOf<File>()
        val renderer = try { PdfRenderer(pfd) } catch (e: Exception) { pfd.close(); throw e }
        renderer.use { r ->
            val stamp = System.currentTimeMillis()
            for (i in 0 until minOf(r.pageCount, maxPages.coerceAtLeast(0))) {
                r.openPage(i).use { page ->
                    // render() stretches the page to the bitmap: keep its shape, narrower for a tall e-ticket, never squashed.
                    var w = 1600; var h = (w.toFloat() * page.height / page.width.coerceAtLeast(1)).toInt().coerceAtLeast(1)
                    if (h > 4000) { w = (w * 4000f / h).toInt().coerceAtLeast(1); h = 4000 }
                    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                    try {
                        bmp.eraseColor(android.graphics.Color.WHITE)
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        val f = File(app.cacheDir, "pdf_${stamp}_$i.jpg")
                        f.outputStream().use { bmp.compress(Bitmap.CompressFormat.JPEG, 85, it) }
                        out += f
                    } finally { bmp.recycle() }
                }
            }
            return out to r.pageCount
        }
    }

    private fun readText(uri: Uri, max: Int = 60_000): String? = runCatching {
        app.contentResolver.openInputStream(uri)?.bufferedReader()?.use { r ->
            val buf = CharArray(max); var n = 0
            while (n < max) { val k = r.read(buf, n, max - n); if (k < 0) break; n += k }
            String(buf, 0, n)
        }
    }.getOrNull()

    /* ---- offline pack ---- */

    fun prepareOfflinePack(tripId: String) {
        if (!TravelUi.packStep.compareAndSet(null, "Starting")) return
        TravelUi.packTripId.value = tripId
        scope.launch {
            try {
                val p = OfflinePack.prepare(app, tripId) { step -> TravelUi.packStep.value = step }
                toast.value = if (p.problems.isEmpty()) "Offline pack ready" else "Offline pack ready, with ${p.problems.size} problem${if (p.problems.size == 1) "" else "s"}"
            } catch (e: Exception) {
                toast.value = e.message ?: "Couldn't prepare the offline pack"
            } finally {
                TravelUi.packStep.value = null
                TravelUi.packVersion.value = TravelUi.packVersion.value + 1
            }
        }
    }

    /** The saved pack for a trip, read off the main thread. */
    suspend fun packFor(tripId: String): Pack? = withContext(Dispatchers.IO) { OfflinePack.load(app, tripId) }

    /* ---- money ---- */

    /** "taxi 2400 yen": read by the model, converted and logged on the phone. [onDone] (main thread) says whether it was logged. */
    /** [tripId] = the trip on screen (it may be a view-only one); "" = the current trip. */
    fun logSpokenSpend(text: String, tripId: String = "", onDone: (Boolean) -> Unit = {}) {
        val t = text.trim(); if (t.isBlank()) return
        if (!TravelUi.spendBusy.compareAndSet(false, true)) return
        TravelUi.spendMessage.value = null
        scope.launch {
            try {
                val target = tripId.takeIf { it.isNotBlank() }?.let { tripRepo.get(it) } ?: tripRepo.current()
                val r = TravelAnalyst.readReceipt(prefs, null, t, target)
                val place = Here.place?.takeIf { System.currentTimeMillis() - Here.at < 30 * 60_000L }?.label ?: ""
                val e = Spending.log(app, r, place = place, note = t, tripId = target?.id)
                val said = Spending.describe(app, e)
                TravelUi.spendMessage.value = said; toast.value = said
                withContext(Dispatchers.Main) { onDone(true) }
            } catch (e: Exception) {
                val m = e.message ?: "Couldn't log that"
                TravelUi.spendMessage.value = m; toast.value = m
                withContext(Dispatchers.Main) { onDone(false) }
            } finally {
                TravelUi.spendBusy.value = false
            }
        }
    }

    /** A receipt photo into the ledger, through the receipt lens (the queue logs it once). */
    fun logReceipt(item: MediaItem) = scope.launch {
        runCatching { queue.ask(item.key, item.uri, Lenses.RECEIPT.id) }.onSuccess { toast.value = it }.onFailure { toast.value = it.message }
    }

    /** Writes the spends of [tripId] ("" = all) to a CSV in cache and opens the share sheet. */
    fun exportCsv(tripId: String) = scope.launch {
        try {
            val l = if (tripId.isBlank()) ledger.expenses.value else ledger.forTrip(tripId)
            if (l.isEmpty()) { toast.value = "Nothing to export yet"; return@launch }
            val f = File(app.cacheDir, "fieldnote-spend.csv").apply { writeText(ledger.csv(l)) }
            val uri = FileProvider.getUriForFile(app, "com.urmit.glasses.dev.files", f)
            val send = Intent(Intent.ACTION_SEND).setType("text/csv").putExtra(Intent.EXTRA_STREAM, uri)
                .putExtra(Intent.EXTRA_SUBJECT, "Fieldnote spending").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            send.clipData = ClipData.newRawUri("spending", uri)
            withContext(Dispatchers.Main) {
                // From the application context, so a new task: this outlives the activity that asked.
                try { ctx.startActivity(Intent.createChooser(send, "Export spending").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                catch (_: ActivityNotFoundException) { toast.value = "No app on this phone can take a CSV file" }
            }
        } catch (e: Exception) { toast.value = "Couldn't export: ${e.message}" }
    }

    companion object {
        private const val MAX_IMAGES = 6      // the booking reader looks at six images at most
        private const val PDF_PAGES = 4
        private const val MAX_SHARED = 12
        private const val TALL = 2.2f         // taller than this (height / width) is read as strips
        private const val STRIP_PX = 1280     // strip width at most
        /** Fieldnote's own provider authorities (the manifest's FileProvider is "com.urmit.glasses.dev.files"). */
        private const val OWN_AUTHORITY = "com.urmit.glasses.dev"

        @Volatile private var inst: AppState? = null
        /** The process's AppState, started on first use. */
        fun get(c: Context): AppState = inst ?: synchronized(this) { inst ?: AppState(c).also { inst = it; it.start() } }
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
