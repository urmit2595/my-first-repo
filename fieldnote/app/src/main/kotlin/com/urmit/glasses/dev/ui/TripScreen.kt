package com.urmit.glasses.dev.ui

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.urmit.glasses.dev.data.Expense
import com.urmit.glasses.dev.data.Here
import com.urmit.glasses.dev.data.Locator
import com.urmit.glasses.dev.data.MediaItem
import com.urmit.glasses.dev.data.Money
import com.urmit.glasses.dev.data.Pack
import com.urmit.glasses.dev.data.Pin
import com.urmit.glasses.dev.data.TravelActions
import com.urmit.glasses.dev.data.TravelText
import com.urmit.glasses.dev.data.Trip
import com.urmit.glasses.dev.data.TripItem
import com.urmit.glasses.dev.service.FieldService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** The trip: where you're staying, cards to show, the offline pack, bookings by day, money, notes and the traveller profile. */
@Composable
fun TripScreen(state: AppState, onCard: (String) -> Unit, onOpenPhoto: (String) -> Unit) {
    val ready by state.travelReady.collectAsState()
    val trips by state.trips.collectAsState()
    val expenses by state.expenses.collectAsState()
    val pins by state.pins.collectAsState()
    val items by state.items.collectAsState(emptyList())
    val busy by state.importBusy.collectAsState()
    val receiving by state.importReceiving.collectAsState()
    val packStep by state.packStep.collectAsState()
    val viewId by state.viewTripId.collectAsState()
    state.prefs.version.collectAsState().value
    // The trip Fieldnote acts on (cards, spends, take me home), unless a trip was opened from an import: that one is only shown.
    val acting = state.currentTrip()
    // With no current trip (the last one ended), the newest is still shown, view-only, so it can be read, exported or deleted.
    val trip = viewId?.let { id -> trips.firstOrNull { it.id == id } } ?: acting ?: trips.maxByOrNull { it.createdAt }
    val viewing = trip != null && trip.id != acting?.id
    // A pin only counts while it takes: an ended trip's pin no longer turns Auto off.
    val pinned = acting != null && acting.id == state.prefs.activeTripId
    // A booking being read or a pack being prepared would write the trip, or its pack, back after a delete.
    val working = busy || receiving || packStep != null
    var pasteOpen by rememberSaveable { mutableStateOf(false) }
    var confirmTrip by rememberSaveable { mutableStateOf(false) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris -> if (uris.isNotEmpty()) state.addBookingImages(uris) }
    fun pick() = try { picker.launch(arrayOf("image/*", "application/pdf")) } catch (_: ActivityNotFoundException) { state.toast.value = "No file picker on this phone" }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp, 24.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Trip", style = MaterialTheme.typography.headlineLarge)
            if (trip != null) TextAction("Delete trip", if (working) F.Line else F.Muted) {
                if (working) state.toast.value = "Wait until Fieldnote has finished with the booking or the offline pack" else confirmTrip = true
            }
        }
        if (!ready) { Text("Opening your trips…", style = MaterialTheme.typography.bodyMedium, color = F.Muted); return@Column }
        if (trip != null) Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(trip.name.ifBlank { "Trip" }, style = MaterialTheme.typography.titleLarge)
            Text(listOf(trip.destination, TravelText.span(trip)).filter { it.isNotBlank() }.joinToString(" · "), style = MaterialTheme.typography.bodyMedium, color = F.Muted)
        }
        if (trips.size > 1 || (trips.isNotEmpty() && acting == null)) Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // Auto: Fieldnote picks the trip by its dates. A trip's chip pins it, unless its dates pick it anyway.
            Chip("Auto", !pinned) { state.setActiveTrip("") }
            trips.sortedBy { if (it.start > 0) it.start else Long.MAX_VALUE }.forEach { t -> Chip(t.name.ifBlank { "Trip" }, t.id == trip?.id) { state.setActiveTrip(t.id) } }
        }
        if (viewing && trip != null && acting != null) Card(padding = PaddingValues(14.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Fieldnote is still using ${acting.name.ifBlank { "your current trip" }} for cards, spends and take me home.", style = MaterialTheme.typography.bodyMedium, color = F.Ink2)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Ghost("Use this trip", Modifier.weight(1f)) { state.setActiveTrip(trip.id) }
                    Ghost("Back to ${acting.name.ifBlank { "it" }}", Modifier.weight(1f)) { state.viewTripId.value = null }
                }
            }
        }
        ImportStatus(state)

        if (trip == null) Card(padding = PaddingValues(16.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("No trip yet", style = MaterialTheme.typography.titleLarge)
                Text("Share booking emails, PDFs or screenshots to Fieldnote: pick “Add to trip” in the share sheet.", style = MaterialTheme.typography.bodyMedium, color = F.Ink2)
                Text("Or paste a booking here. Fieldnote reads it and builds the trip.", style = MaterialTheme.typography.bodyMedium, color = F.Ink2)
                Primary("Paste a booking", Modifier.fillMaxWidth(), enabled = !busy && !receiving) { pasteOpen = true }
                Ghost("Choose screenshots or PDFs", Modifier.fillMaxWidth(), enabled = !busy && !receiving) { pick() }
            }
        } else {
            if (!viewing) { NowCard(state, trip, onCard); CardsGrid(onCard) }
            PackCard(state, trip)
            Timeline(state, trip, onCard)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Ghost("Paste a booking", Modifier.weight(1f), enabled = !busy && !receiving) { pasteOpen = true }
                Ghost("Screenshots or PDFs", Modifier.weight(1f), enabled = !busy && !receiving) { pick() }
            }
        }
        MoneySection(state, trip, expenses, items, onOpenPhoto)
        PinsSection(state, pins, items, onOpenPhoto)
        ProfileSection(state)
    }

    if (pasteOpen) {
        var text by rememberSaveable { mutableStateOf("") }
        AlertDialog(onDismissRequest = { pasteOpen = false }, containerColor = F.Card,
            title = { Text("Paste a booking") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("A confirmation email, a ticket, or your own words: “Hotel Gracery Shinjuku, 3 to 6 October”.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                Field(text, { text = it }, "Paste the booking here", minLines = 6)
            } },
            confirmButton = { TextButton({ pasteOpen = false; state.addBookingText(text) }, enabled = text.isNotBlank()) { Text("Add to trip", color = if (text.isNotBlank()) F.Accent else F.Muted) } },
            dismissButton = { TextButton({ pasteOpen = false }) { Text("Cancel", color = F.Muted) } })
    }
    if (confirmTrip && trip != null) ConfirmDialog("Delete ${trip.name.ifBlank { "this trip" }}?", "Its bookings and offline pack are removed from this phone. Spends stay in the ledger.", "Delete",
        onConfirm = { state.deleteTrip(trip.id) }) { confirmTrip = false }
}

/* ---------------- import progress (paste, picker) ---------------- */

@Composable
private fun ImportStatus(state: AppState) {
    val busy by state.importBusy.collectAsState()
    val receiving by state.importReceiving.collectAsState()
    val r by state.importResult.collectAsState()
    val pending by state.pendingImport.collectAsState()
    if (!busy && !receiving && r == null) return
    Card(padding = PaddingValues(14.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            val res = r
            if (busy || receiving) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CircularProgressIndicator(Modifier.size(16.dp), color = F.Accent, strokeWidth = 2.dp)
                Text(if (receiving) "Opening the files…" else "Reading your booking…", style = MaterialTheme.typography.bodyMedium)
            } else if (res != null) {
                Text(res.message, style = MaterialTheme.typography.bodyMedium, color = if (res.ok) F.Ink else F.Red)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Only the import that failed: not an older one still pending, and not a file that never opened (id 0).
                    if (!res.ok && res.forId != 0L && res.forId == pending?.id) Ghost("Try again", Modifier.weight(1f)) { state.runImport() }
                    Ghost(if (res.ok) "OK" else "Dismiss", Modifier.weight(1f)) { if (res.ok) state.viewTrip(res.tripId); state.clearImportResult() }
                }
            }
        }
    }
}

/* ---------------- now: where you're staying ---------------- */

@Composable
private fun NowCard(state: AppState, trip: Trip, onCard: (String) -> Unit) {
    val ctx = LocalContext.current
    val tick by state.permTick.collectAsState()
    state.prefs.version.collectAsState().value
    val stay = state.currentStay()
    var line by remember { mutableStateOf("") }
    var dist by remember { mutableFloatStateOf(-1f) }
    LaunchedEffect(stay?.id, stay?.lat, stay?.lng, tick) {
        line = ""; dist = -1f
        if (stay == null) return@LaunchedEffect
        val app = ctx.applicationContext
        val pace = state.prefs.walkingPace
        val (text, d) = withContext(Dispatchers.IO) {
            // Placing the stay needs the network once; afterwards "take me home" and this line work offline.
            val s = if (stay.hasPoint) stay else runCatching { TravelActions.placeItem(app, stay, trip.id) }.getOrNull() ?: stay
            if (!Locator.permitted(app)) return@withContext "Allow location (Traveller profile, below) to see how far it is." to -1f
            val loc = runCatching { Locator.current(app, maxAgeMs = 5 * 60_000L, timeoutMs = 5_000) }.getOrNull()
                ?: return@withContext "No location fix right now." to -1f
            if (!s.hasPoint) return@withContext "Not on the map yet. Preparing the offline pack places it." to -1f
            val m = Locator.distanceM(loc.latitude, loc.longitude, s.lat, s.lng)
            if (m < 60) return@withContext "You're there." to m
            val walk = Locator.walkMinutes(m, pace)
            "${Locator.distanceWords(m)} to the ${Locator.compass(Locator.bearing(loc.latitude, loc.longitude, s.lat, s.lng))}" +
                (if (walk <= 45) ", about $walk min on foot" else "; take a taxi or transit") to m
        }
        line = text; dist = d
    }
    Card(padding = PaddingValues(16.dp), radius = 20) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Eyebrow("Now")
            if (stay == null) Text("No stay in this trip yet. Share your hotel booking and it shows here, with the way back.", style = MaterialTheme.typography.bodyMedium, color = F.Ink2)
            else {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Staying at", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                    Text(stay.place.ifBlank { stay.title }, style = MaterialTheme.typography.titleLarge)
                    if (stay.address.isNotBlank()) Text(stay.address, style = MaterialTheme.typography.bodyMedium, color = F.Ink2, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                Text(line.ifBlank { "Finding where you are…" }, style = MaterialTheme.typography.bodyMedium, color = if (dist >= 0) F.Teal else F.Muted)
                Here.label().takeIf { it.isNotBlank() }?.let { Text("You: $it", style = MaterialTheme.typography.bodySmall, color = F.Muted) }
                Primary("Take me home", Modifier.fillMaxWidth()) { openMaps(ctx, state, stay, if (dist > 3000) "d" else "w") }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Ghost("Driver card", Modifier.weight(1f)) { onCard("driver") }
                    if (stay.phone.isNotBlank()) Ghost("Call", Modifier.weight(1f)) { dial(ctx, state, stay.phone) }
                }
            }
            val now = System.currentTimeMillis()
            trip.items.filter { it.start > now }.minByOrNull { it.start }?.let { n ->
                HorizontalDivider(color = F.Line2)
                Text("Next: ${n.title}, ${TravelText.whenLabel(n.start, n.tz)}", style = MaterialTheme.typography.bodySmall, color = F.Muted)
            }
        }
    }
}

@Composable
private fun CardsGrid(onCard: (String) -> Unit) {
    val cards = listOf(Triple("driver", "Driver", "Address for a taxi"), Triple("allergy", "Allergy", "For waiters and cooks"),
        Triple("phrases", "Phrases", "Say it or show it"), Triple("emergency", "Emergency", "Numbers to call"))
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Eyebrow("Cards to show")
        cards.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { (kind, title, sub) ->
                    Card(Modifier.weight(1f).heightIn(min = 64.dp), onClick = { onCard(kind) }, padding = PaddingValues(14.dp, 12.dp)) {
                        Column { Text(title, style = MaterialTheme.typography.titleMedium); Text(sub, style = MaterialTheme.typography.bodySmall, color = F.Muted) }
                    }
                }
            }
        }
    }
}

/* ---------------- offline pack ---------------- */

@Composable
private fun PackCard(state: AppState, trip: Trip) {
    val step by state.packStep.collectAsState()
    val packTrip by state.packTripId.collectAsState()
    val version by state.packVersion.collectAsState()
    val rates by state.rates.collectAsState()
    state.prefs.version.collectAsState().value
    val pack by produceState<Pack?>(null, trip.id, version) { value = state.packFor(trip.id) }
    val running = step != null
    Card(padding = PaddingValues(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Eyebrow("Offline pack")
            val p = pack
            if (p == null) Text("Not prepared yet. It saves phrases, cards, map points and exchange rates for ${trip.destination.ifBlank { trip.name }}, so they work with no data.", style = MaterialTheme.typography.bodyMedium, color = F.Ink2)
            else {
                PackLine("Prepared", agoLabel(p.preparedAt))
                PackLine("Phrases", if (p.phrases.isEmpty()) "none" else "${p.phrases.size} in ${langName(p.language)}")
                PackLine("Offline translation", if (p.translateReady) "ready" else "not ready", p.translateReady)
                PackLine("Offline reading", if (p.readReady) "ready" else "not ready", p.readReady)
                PackLine("Exchange rate", Money.rateAge(rates))
                if (p.allergyStale(state.prefs)) Text("Your diet or allergies changed since the allergy card was written. Refresh the offline pack.", style = MaterialTheme.typography.bodySmall, color = F.Amber)
                p.problems.forEach { Text(it, style = MaterialTheme.typography.bodySmall, color = F.Muted) }
            }
            Primary(when { running && packTrip == trip.id -> "$step…"; running -> "Preparing another trip…"; p == null -> "Prepare offline pack"; else -> "Refresh offline pack" },
                Modifier.fillMaxWidth(), enabled = !running) { state.prepareOfflinePack(trip.id) }
            Text("Do this on Wi-Fi before you fly.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
        }
    }
}

@Composable
private fun PackLine(label: String, value: String, ok: Boolean? = null) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = F.Muted)
        Text(value, style = MaterialTheme.typography.bodyMedium, color = when (ok) { true -> F.Teal; false -> F.Amber; null -> F.Ink })
    }
}

/* ---------------- bookings by day ---------------- */

@Composable
private fun Timeline(state: AppState, trip: Trip, onCard: (String) -> Unit) {
    var open by remember { mutableStateOf<String?>(null) }
    var confirm by remember { mutableStateOf<TripItem?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Eyebrow("Bookings")
        if (trip.items.isEmpty()) Card { Text("No bookings in this trip yet.", style = MaterialTheme.typography.bodyMedium, color = F.Muted) }
        trip.items.sortedBy { if (it.start > 0) it.start else Long.MAX_VALUE }.groupBy { localDay(it) }.forEach { (day, list) ->
            Text(day, style = MaterialTheme.typography.titleMedium, color = F.Muted, modifier = Modifier.padding(top = 6.dp))
            list.forEach { i -> BookingRow(state, i, open == i.id, { open = if (open == i.id) null else i.id }, onCard) { confirm = i } }
        }
    }
    confirm?.let { i ->
        ConfirmDialog("Delete this booking?", i.title, "Delete", onConfirm = { state.deleteTripItem(trip.id, i.id) }) { confirm = null }
    }
}

/** The booking's own day, in its own time zone when known (the day printed on the ticket). */
private fun localDay(i: TripItem): String {
    if (i.start <= 0) return "Date not known"
    val zone = runCatching { if (i.tz.isNotBlank()) ZoneId.of(i.tz) else null }.getOrNull() ?: ZoneId.systemDefault()
    val d = Instant.ofEpochMilli(i.start).atZone(zone).toLocalDate()
    val today = LocalDate.now(zone)
    return when (d) { today -> "Today"; today.plusDays(1) -> "Tomorrow"; today.minusDays(1) -> "Yesterday"; else -> d.format(DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.UK)) }
}

@Composable
private fun BookingRow(state: AppState, i: TripItem, open: Boolean, onToggle: () -> Unit, onCard: (String) -> Unit, onDelete: () -> Unit) {
    val ctx = LocalContext.current
    Card(onClick = onToggle, padding = PaddingValues(12.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                KindIcon(i.kind)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(i.title, style = MaterialTheme.typography.bodyLarge, maxLines = if (open) 4 else 2, overflow = TextOverflow.Ellipsis)
                    val at = TravelText.whenLabel(i.start, i.tz)
                    if (at.isNotBlank()) Text(at + if (i.kind == "stay" && i.end > i.start) " to ${TravelText.whenLabel(i.end, i.tz)}" else "", style = MaterialTheme.typography.bodySmall, color = F.Ink2)
                    val where = i.place.takeIf { it.isNotBlank() && !i.title.contains(it, true) } ?: i.address
                    if (where.isNotBlank()) Text(where, style = MaterialTheme.typography.bodySmall, color = F.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (i.code.isNotBlank()) Text("Ref ${i.code}", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold), color = F.Ink2)
                }
            }
            if (open) {
                HorizontalDivider(color = F.Line2)
                if (i.detail.isNotBlank()) Text(i.detail, style = MaterialTheme.typography.bodyMedium)
                if (i.address.isNotBlank()) Text(i.address, style = MaterialTheme.typography.bodyMedium, color = F.Ink2)
                if (i.addressLocal.isNotBlank()) Text(i.addressLocal, style = MaterialTheme.typography.bodyMedium, color = F.Ink2)
                if (i.phone.isNotBlank()) Text(i.phone, style = MaterialTheme.typography.bodyMedium, color = F.Ink2)
                val hasAddress = i.address.isNotBlank() || i.addressLocal.isNotBlank()
                val acts = buildList<Pair<String, () -> Unit>> {
                    if (i.hasPoint || hasAddress || i.place.isNotBlank()) add("Navigate" to { openMaps(ctx, state, i) })
                    if (i.phone.isNotBlank()) add("Call" to { dial(ctx, state, i.phone) })
                    if (hasAddress) add("Show to driver" to { onCard("driver?item=${Uri.encode(i.id)}") })
                    add("Delete" to onDelete)
                }
                acts.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { (label, act) -> Ghost(label, Modifier.weight(1f)) { act() } }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

/* ---------------- money ---------------- */

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MoneySection(state: AppState, trip: Trip?, expenses: List<Expense>, items: List<MediaItem>, onOpenPhoto: (String) -> Unit) {
    val rates by state.rates.collectAsState()
    val busy by state.spendBusy.collectAsState()
    val said by state.spendMessage.collectAsState()
    state.prefs.version.collectAsState().value
    val home = state.prefs.homeCurrency
    val budget = state.prefs.dailyBudget
    val ledger = state.ledger
    val todayStart = dayStart(System.currentTimeMillis())
    val todays = expenses.filter { it.at >= todayStart }
    val list = if (trip != null) expenses.filter { it.tripId == trip.id } else expenses
    val today = ledger.totalHome(todays, home, rates).first
    val total = ledger.totalHome(list, home, rates).first
    val unconverted = ledger.totalHome((todays + list).distinctBy { it.id }, home, rates).second
    val cats = ledger.byCategory(list, home, rates).sortedByDescending { it.second }
    var spend by rememberSaveable { mutableStateOf("") }
    var confirm by remember { mutableStateOf<Expense?>(null) }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Eyebrow("Money")
        Card(padding = PaddingValues(16.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("Today", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                        Text(Money.fmt(today, home), style = MaterialTheme.typography.headlineMedium, color = if (budget > 0 && today > budget) F.Amber else F.Ink)
                        if (budget > 0) Text("of ${Money.fmt(budget.toDouble(), home)} a day", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(if (trip != null) "This trip" else "All spends", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                        Text(Money.fmt(total, home), style = MaterialTheme.typography.headlineMedium)
                        Text("${list.size} spend${if (list.size == 1) "" else "s"}", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                    }
                }
                if (unconverted > 0) Text("$unconverted spend${if (unconverted == 1) " has" else "s have"} no exchange rate yet and aren't in the totals.", style = MaterialTheme.typography.bodySmall, color = F.Amber)
                if (cats.isNotEmpty()) {
                    HorizontalDivider(color = F.Line2)
                    val max = cats.maxOf { it.second }.coerceAtLeast(0.01)
                    cats.forEach { (c, v) ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(c.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.width(80.dp))
                            Box(Modifier.weight(1f).height(8.dp).background(F.Line2, RoundedCornerShape(4.dp))) {
                                Box(Modifier.fillMaxWidth((v / max).toFloat().coerceIn(0.02f, 1f)).fillMaxHeight().background(F.Accent, RoundedCornerShape(4.dp)))
                            }
                            Text(Money.fmt(v, home), style = MaterialTheme.typography.bodySmall, color = F.Muted, textAlign = TextAlign.End, modifier = Modifier.width(72.dp))
                        }
                    }
                }
                Text("Converted at the ${Money.rateAge(rates)}", style = MaterialTheme.typography.bodySmall, color = F.Muted)
            }
        }
        if (list.isEmpty()) Card { Text("No spends yet. Say “log this receipt” to the glasses, or type one below.", style = MaterialTheme.typography.bodyMedium, color = F.Muted) }
        else Card(padding = PaddingValues(14.dp, 2.dp)) {
            Column {
                val recent = list.take(10)
                recent.forEachIndexed { n, e ->
                    val homeAmount = when { e.currency == home -> null; !e.home.isNaN() && e.homeCurrency == home -> e.home; else -> rates?.convert(e.amount, e.currency, home) }
                    Row(Modifier.fillMaxWidth().combinedClickable(onClick = {
                        if (e.photoKey.isNotBlank()) { if (items.any { it.key == e.photoKey }) onOpenPhoto(e.photoKey) else state.toast.value = "That receipt photo isn't on the phone any more" }
                    }, onLongClick = { confirm = e }).padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Column(Modifier.weight(1f)) {
                            Text(e.merchant.ifBlank { e.category.replaceFirstChar { it.uppercase() } }, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text("${dayLabel(e.at)}, ${timeLabel(e.at)}" + if (e.photoKey.isNotBlank()) " · receipt" else "", style = MaterialTheme.typography.bodySmall, color = F.Muted, maxLines = 1)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(Money.fmt(e.amount, e.currency), style = MaterialTheme.typography.bodyLarge)
                            if (homeAmount != null) Text("≈ ${Money.fmt(homeAmount, home)}", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                        }
                        TextAction("Delete", F.Muted) { confirm = e }
                    }
                    if (n < recent.size - 1) HorizontalDivider(color = F.Line2)
                }
            }
        }
        Text("Add a spend", style = MaterialTheme.typography.titleMedium)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.weight(1f)) { Field(spend, { spend = it }, "taxi 2400 yen") }
            // Cleared once logged: offline, or with no amount heard, the typed spend stays to try again.
            // Cleared at once (so typing the next one isn't wiped, and a rotation can't bring a logged spend back); put back only on failure.
            Primary(if (busy) "Adding…" else "Add", enabled = spend.isNotBlank() && !busy) { val sent = spend; spend = ""; state.logSpokenSpend(sent, trip?.id ?: "") { ok -> if (!ok && spend.isBlank()) spend = sent } }
        }
        said?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = F.Muted) }
        Ghost("Export CSV", Modifier.fillMaxWidth(), enabled = list.isNotEmpty()) { state.exportCsv(trip?.id ?: "") }
    }
    confirm?.let { e ->
        ConfirmDialog("Delete this spend?", "${e.merchant.ifBlank { e.category }} · ${Money.fmt(e.amount, e.currency)}", "Delete", onConfirm = { state.deleteExpense(e.id) }) { confirm = null }
    }
}

/* ---------------- notes and places ---------------- */

@Composable
private fun PinsSection(state: AppState, pins: List<Pin>, items: List<MediaItem>, onOpenPhoto: (String) -> Unit) {
    var shown by remember { mutableIntStateOf(10) }
    var confirm by remember { mutableStateOf<Pin?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Eyebrow("Notes and places")
        if (pins.isEmpty()) Card { Text("Say “note:” and what to remember to pin it to where you are, or “remember this” to keep a photo of it.", style = MaterialTheme.typography.bodyMedium, color = F.Muted) }
        pins.take(shown).forEach { p ->
            val uri = if (p.photoKey.isBlank()) null else items.firstOrNull { it.key == p.photoKey }?.uri
            Card(padding = PaddingValues(10.dp, 8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (uri != null) AsyncImage(model = uri, contentDescription = "Photo", contentScale = ContentScale.Crop,
                        modifier = Modifier.size(56.dp).clip(RoundedCornerShape(10.dp)).clickable { onOpenPhoto(p.photoKey) })
                    Column(Modifier.weight(1f).padding(vertical = 4.dp)) {
                        Text(p.text, style = MaterialTheme.typography.bodyLarge)
                        Text(listOf(p.place, agoLabel(p.at)).filter { it.isNotBlank() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = F.Muted)
                    }
                    TextAction("Delete", F.Muted) { confirm = p }
                }
            }
        }
        if (pins.size > shown) TextAction("Show all ${pins.size}", F.Accent) { shown = Int.MAX_VALUE }
    }
    confirm?.let { p -> ConfirmDialog("Delete this note?", p.text, "Delete", onConfirm = { state.deletePin(p.id) }) { confirm = null } }
}

/* ---------------- traveller profile ---------------- */

@Composable
private fun ProfileSection(state: AppState) {
    val ctx = LocalContext.current
    val prefs = state.prefs
    state.prefs.version.collectAsState().value
    state.permTick.collectAsState().value
    val located = Locator.permitted(ctx)
    val askLocation = rememberLocationAsk(state)
    Section("Traveller profile", open = false) {
        Text("Stays on this phone. A short summary goes with your questions so answers, cards and phrases fit you.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
        var cur by remember { mutableStateOf(prefs.homeCurrency) }
        var langs by remember { mutableStateOf(prefs.languagesSpoken) }
        var diet by remember { mutableStateOf(prefs.diet) }
        var allergies by remember { mutableStateOf(prefs.allergies) }
        var budget by remember { mutableStateOf(prefs.dailyBudget.takeIf { it > 0 }?.toString() ?: "") }
        var interests by remember { mutableStateOf(prefs.interests) }
        var contacts by remember { mutableStateOf(prefs.emergencyContacts) }
        Text("Home currency", style = MaterialTheme.typography.titleMedium)
        Field(cur, { v -> cur = v.filter { it.isLetter() }.uppercase().take(3); if (cur.length == 3) prefs.homeCurrency = cur }, "INR")
        Text("Languages you speak", style = MaterialTheme.typography.titleMedium)
        Field(langs, { langs = it; prefs.languagesSpoken = it }, "English, Hindi")
        Text("Diet", style = MaterialTheme.typography.titleMedium)
        Field(diet, { diet = it; prefs.diet = it }, "e.g. vegetarian, no egg")
        Text("Allergies", style = MaterialTheme.typography.titleMedium)
        Field(allergies, { allergies = it; prefs.allergies = it }, "e.g. peanuts")
        Text("Say if an allergy is medical, e.g. “peanuts: medical, I carry an adrenaline pen”.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
        Text("Daily budget (${prefs.homeCurrency})", style = MaterialTheme.typography.titleMedium)
        Field(budget, { v -> budget = v.filter { it.isDigit() }.take(9); prefs.dailyBudget = budget.toIntOrNull() ?: 0 }, "No budget", keyboard = KeyboardType.Number)
        Text("Interests", style = MaterialTheme.typography.titleMedium)
        Field(interests, { interests = it; prefs.interests = it }, "e.g. temples, street food, design shops")
        Text("Walking pace", style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("slow" to "Slow", "average" to "Average", "fast" to "Fast").forEach { (v, l) -> Chip(l, prefs.walkingPace.equals(v, true)) { prefs.walkingPace = v } }
        }
        Text("Emergency contacts", style = MaterialTheme.typography.titleMedium)
        Field(contacts, { contacts = it; prefs.emergencyContacts = it }, "Name +91 98…; Name +44 …", minLines = 2)
        Text("Shown on the emergency card. Nothing is sent automatically.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
        HorizontalDivider(color = F.Line2)
        ToggleRow("Tag photos with the place", "Uses the phone's location when a photo is taken, and names the place when there's data.", prefs.autoTag) { prefs.autoTag = it }
        CheckRow(located, "Location", if (located) "Allowed: photo places, where am I, take me home" else "Optional. Needed for photo places, where am I and take me home",
            action = if (!located) "Allow" else null, optional = true) { askLocation() }
    }
}

/* ---------------- shared bits (Trip tab, cards, Glasses) ---------------- */

internal val LOCATION_PERMS = arrayOf(android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION)
internal const val UI_PREFS = "fieldnote_ui"
internal const val LOCATION_ASKED = "locationAsked"
internal const val PERMS_ASKED = "permsAsked"

/**
 * What a session needs. Notifications and READ_MEDIA_* only exist from Android 13 (API 33): on 12 they always read as denied
 * (no dialog, so a session could never start), and photos need READ_EXTERNAL_STORAGE instead.
 */
internal val SESSION_PERMS: Array<String> = buildList {
    add(android.Manifest.permission.BLUETOOTH_CONNECT); add(android.Manifest.permission.RECORD_AUDIO)
    if (Build.VERSION.SDK_INT >= 33) { add(android.Manifest.permission.POST_NOTIFICATIONS); add(android.Manifest.permission.READ_MEDIA_IMAGES); add(android.Manifest.permission.READ_MEDIA_VIDEO) }
    else add(android.Manifest.permission.READ_EXTERNAL_STORAGE)
}.toTypedArray()

internal fun missingPerms(ctx: Context) = SESSION_PERMS.filter { ctx.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }

/** The app's page in the phone's Settings, where a permission Android no longer asks for can still be allowed. */
internal fun openAppSettings(ctx: Context, state: AppState, what: String) {
    state.toast.value = "Allow $what for Fieldnote in Settings"
    try { ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}"))) }
    catch (_: ActivityNotFoundException) { state.toast.value = "Allow $what for Fieldnote in the phone's Settings" }
}

/** Asks for the session's permissions; once Android stops showing the dialog (denied twice, or "Don't allow"), opens Settings. */
@Composable
internal fun rememberPermsAsk(state: AppState): () -> Unit {
    val ctx = LocalContext.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { state.permTick.value = state.permTick.value + 1; state.refresh() }
    return remember(launcher) {
        {
            val missing = missingPerms(ctx)
            val ui = ctx.getSharedPreferences(UI_PREFS, Context.MODE_PRIVATE)
            val act = ctx as? Activity
            when {
                missing.isEmpty() -> {}
                ui.getBoolean(PERMS_ASKED, false) && act != null && missing.none { act.shouldShowRequestPermissionRationale(it) } ->
                    openAppSettings(ctx, state, if (Build.VERSION.SDK_INT >= 33) "Bluetooth, microphone, notifications and photos" else "Bluetooth, microphone and photos")
                else -> { ui.edit().putBoolean(PERMS_ASKED, true).apply(); launcher.launch(missing.toTypedArray()) }
            }
        }
    }
}

/**
 * Asks for location; once Android stops showing the dialog (denied twice), opens the app's settings page instead. A session
 * already running starts using it (MainActivity.onResume does the same after Settings).
 */
@Composable
internal fun rememberLocationAsk(state: AppState): () -> Unit {
    val ctx = LocalContext.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        state.permTick.value = state.permTick.value + 1
        if (Locator.permitted(ctx)) FieldService.send(ctx, FieldService.ACT_LOCATION)
    }
    return remember(launcher) {
        {
            val ui = ctx.getSharedPreferences(UI_PREFS, Context.MODE_PRIVATE)
            val act = ctx as? Activity
            val blocked = ui.getBoolean(LOCATION_ASKED, false) && act != null && LOCATION_PERMS.none { act.shouldShowRequestPermissionRationale(it) }
            if (blocked) openAppSettings(ctx, state, "location")
            else { ui.edit().putBoolean(LOCATION_ASKED, true).apply(); launcher.launch(LOCATION_PERMS) }
        }
    }
}

/** Directions in the maps app (offline if its area is downloaded); falls back to a plain map pin, then says so. */
internal fun openMaps(ctx: Context, state: AppState, item: TripItem, mode: String = "w") {
    val label = Uri.encode(item.place.ifBlank { item.title })
    val tries = listOfNotNull(TravelActions.directionsUri(item, mode), if (item.hasPoint) Uri.parse("geo:${item.lat},${item.lng}?q=${item.lat},${item.lng}($label)") else null)
    for (u in tries) { try { ctx.startActivity(Intent(Intent.ACTION_VIEW, u)); return } catch (_: ActivityNotFoundException) { } }
    state.toast.value = "No maps app on this phone"
}

internal fun dial(ctx: Context, state: AppState, number: String) {
    val n = number.filter { it.isDigit() || it == '+' }
    if (n.isBlank()) { state.toast.value = "That isn't a phone number"; return }
    try { ctx.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$n"))) } catch (_: ActivityNotFoundException) { state.toast.value = "This phone can't make calls" }
}

/** "Japanese" for "ja". */
internal fun langName(tag: String): String = Locale.forLanguageTag(tag.ifBlank { "en" }).getDisplayLanguage(Locale.UK).ifBlank { tag }

@Composable
internal fun TextAction(text: String, color: Color, onClick: () -> Unit) {
    Box(Modifier.heightIn(min = 44.dp).clickable(onClick = onClick).padding(horizontal = 8.dp), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.labelLarge, color = color)
    }
}

@Composable
internal fun ConfirmDialog(title: String, body: String, action: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(onDismissRequest = onDismiss, containerColor = F.Card,
        title = { Text(title) },
        text = { Text(body, maxLines = 6, overflow = TextOverflow.Ellipsis) },
        confirmButton = { TextButton({ onDismiss(); onConfirm() }) { Text(action, color = F.Red) } },
        dismissButton = { TextButton(onDismiss) { Text("Cancel", color = F.Muted) } })
}

/** A booking's kind, drawn in the tab icons' stroke style. */
@Composable
internal fun KindIcon(kind: String, c: Color = F.Ink2) {
    Box(Modifier.size(40.dp).background(F.Tile, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(22.dp)) {
            val s = Stroke(width = 1.6.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
            val u = size.width / 24f
            fun line(vararg p: Pair<Float, Float>, close: Boolean = false) = drawPath(Path().apply {
                moveTo(p[0].first * u, p[0].second * u); p.drop(1).forEach { lineTo(it.first * u, it.second * u) }; if (close) close()
            }, c, style = s)
            fun box(l: Float, t: Float, r: Float, b: Float, rad: Float) = drawRoundRect(c, Offset(l * u, t * u), Size((r - l) * u, (b - t) * u), CornerRadius(rad * u), style = s)
            fun wheel(x: Float, y: Float, r: Float) = drawCircle(c, r * u, Offset(x * u, y * u), style = s)
            when (kind) {
                "flight" -> { line(2f to 11f, 22f to 3f, 14f to 21f, 11f to 13f, close = true); line(11f to 13f, 22f to 3f) }
                "stay" -> { line(3f to 11f, 12f to 4f, 21f to 11f); line(5f to 9.5f, 5f to 20f, 19f to 20f, 19f to 9.5f); line(10f to 20f, 10f to 15f, 14f to 15f, 14f to 20f) }
                "train" -> { box(6f, 3f, 18f, 17f, 3f); line(6f to 11f, 18f to 11f); line(9f to 17f, 7f to 21f); line(15f to 17f, 17f to 21f) }
                "bus" -> { box(4f, 4f, 20f, 18f, 2.5f); line(4f to 12f, 20f to 12f); wheel(8f, 19.5f, 1.5f); wheel(16f, 19.5f, 1.5f) }
                "ferry" -> { line(3f to 14f, 21f to 14f, 18f to 19f, 6f to 19f, close = true); line(7f to 14f, 7f to 9f, 16f to 9f, 16f to 14f); line(11f to 9f, 11f to 5f) }
                "car" -> { line(3f to 16f, 3f to 12f, 6f to 7f, 18f to 7f, 21f to 12f, 21f to 16f, close = true); wheel(7.5f, 17f, 2f); wheel(16.5f, 17f, 2f) }
                "ticket" -> { box(3f, 7f, 21f, 17f, 2f); line(15f to 8.5f, 15f to 10f); line(15f to 12f, 15f to 13f); line(15f to 15f, 15f to 15.5f) }
                "table" -> { line(6f to 3f, 6f to 8f, 10f to 8f, 10f to 3f); line(8f to 8f, 8f to 21f); line(16f to 21f, 16f to 3f, 19f to 9f, 16f to 11f) }
                "tour" -> { line(5f to 21f, 5f to 3f); line(5f to 4f, 18f to 4f, 15f to 8.5f, 18f to 13f, 5f to 13f) }
                else -> { wheel(12f, 12f, 7f); drawCircle(c, 1.5f * u, Offset(12 * u, 12 * u)) }
            }
        }
    }
}
