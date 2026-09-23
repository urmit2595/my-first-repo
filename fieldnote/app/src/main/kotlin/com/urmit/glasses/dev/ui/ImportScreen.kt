package com.urmit.glasses.dev.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage

/** What was shared into Fieldnote ("Add to trip"), read into the trip on one tap. */
@Composable
fun ImportScreen(state: AppState, onOpenTrip: () -> Unit, onBack: () -> Unit) {
    val p by state.pendingImport.collectAsState()
    val receiving by state.importReceiving.collectAsState()
    val busy by state.importBusy.collectAsState()
    val busyFor by state.importBusyFor.collectAsState()
    val result by state.importResult.collectAsState()

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp, 16.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Box(Modifier.heightIn(min = 44.dp).clickable { onBack() }, contentAlignment = Alignment.CenterStart) { Text("‹ Back", style = MaterialTheme.typography.labelLarge, color = F.Accent) }
        Text("Add to trip", style = MaterialTheme.typography.headlineLarge)
        val shared = p
        when {
            receiving -> Working("Opening what you shared…")
            shared == null || (shared.text.isBlank() && shared.files.isEmpty()) -> Card(padding = PaddingValues(16.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(if ((shared?.failed ?: 0) > 0) "Fieldnote couldn't open what was shared. Try a screenshot of the booking instead."
                        else "Nothing to add. Share a booking email, PDF or screenshot to Fieldnote and pick “Add to trip”.", style = MaterialTheme.typography.bodyMedium, color = F.Ink2)
                    Ghost("Open trip", Modifier.fillMaxWidth()) { onOpenTrip() }
                }
            }
            else -> {
                if (shared.text.isNotBlank()) Card(padding = PaddingValues(14.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Eyebrow("Text")
                        Text(shared.text.take(400) + if (shared.text.length > 400) "…" else "", style = MaterialTheme.typography.bodyMedium, color = F.Ink2)
                    }
                }
                if (shared.files.isNotEmpty()) Card(padding = PaddingValues(14.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Eyebrow("${shared.files.size} file${if (shared.files.size == 1) "" else "s"}")
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            shared.files.forEach { f ->
                                Column(Modifier.width(96.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    if (f.isImage) AsyncImage(model = f.uri, contentDescription = f.name, contentScale = ContentScale.Crop, modifier = Modifier.size(96.dp).clip(RoundedCornerShape(10.dp)).background(F.Tile))
                                    else Box(Modifier.size(96.dp).background(F.Tile, RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
                                        Text(if (f.isPdf) "PDF" else "File", style = MaterialTheme.typography.titleMedium, color = F.Muted)
                                    }
                                    Text(f.name, style = MaterialTheme.typography.bodySmall, color = F.Muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                }
                            }
                        }
                    }
                }
                if (shared.failed > 0) Text("${shared.failed} shared item${if (shared.failed == 1) "" else "s"} couldn't be opened.", style = MaterialTheme.typography.bodySmall, color = F.Amber)
                val mine = result?.takeIf { it.forId == shared.id }
                when {
                    busy && busyFor == shared.id -> Working("Reading your booking…")
                    busy -> Working("Finishing the last booking first…")
                    mine?.ok == true -> {
                        Card(padding = PaddingValues(14.dp)) { Text(mine.message, style = MaterialTheme.typography.bodyLarge) }
                        Primary("Open trip", Modifier.fillMaxWidth()) { state.viewTrip(mine.tripId); state.clearImportResult(); onOpenTrip() }
                    }
                    // Filed already (the result was dismissed on the Trip tab): never offer to add the same share twice.
                    shared.done -> {
                        Card(padding = PaddingValues(14.dp)) { Text("Added to your trip.", style = MaterialTheme.typography.bodyLarge) }
                        Primary("Open trip", Modifier.fillMaxWidth()) { onOpenTrip() }
                    }
                    mine != null -> {
                        Text(mine.message, style = MaterialTheme.typography.bodyMedium, color = F.Red)
                        Ghost("Try again", Modifier.fillMaxWidth()) { state.runImport() }
                    }
                    else -> {
                        Primary("Add to trip", Modifier.fillMaxWidth()) { state.runImport() }
                        Text("Fieldnote sends this to your model provider to read the bookings, then files them into the right trip.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                    }
                }
            }
        }
    }
}

@Composable
private fun Working(text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        CircularProgressIndicator(Modifier.size(18.dp), color = F.Accent, strokeWidth = 2.dp)
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}
