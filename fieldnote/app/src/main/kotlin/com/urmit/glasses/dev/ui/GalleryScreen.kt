package com.urmit.glasses.dev.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.urmit.glasses.dev.data.AnalysisState
import com.urmit.glasses.dev.data.MediaItem
import com.urmit.glasses.dev.data.Source
import com.urmit.glasses.dev.service.Bus
import com.urmit.glasses.dev.service.Mode
import com.urmit.glasses.dev.service.SessionState

private val FILTERS = listOf("All", "Photos", "Videos", "Analysed", "Favourites")

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun GalleryScreen(state: AppState, onOpen: (String) -> Unit, onSession: () -> Unit) {
    val all by state.items.collectAsState(emptyList())
    val loading by state.loading.collectAsState()
    val st by Bus.state.collectAsState()
    val mode by Bus.mode.collectAsState()
    var filter by remember { mutableStateOf("All") }
    var selecting by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf(setOf<String>()) }
    var confirmDelete by remember { mutableStateOf(false) }

    val visible = all.filter { !it.note.hidden }.filter {
        when (filter) { "Photos" -> !it.isVideo; "Videos" -> it.isVideo; "Analysed" -> it.note.state == AnalysisState.ANALYSED; "Favourites" -> it.note.favourite; else -> true }
    }
    val groups = visible.groupBy { dayStart(it.takenAt) }.toSortedMap(compareByDescending { it })
    val analysing = all.count { it.note.state == AnalysisState.ANALYSING || it.note.state == AnalysisState.QUEUED }
    val waiting = all.count { it.note.state == AnalysisState.WAITING_FOR_NETWORK }
    val hidden = all.count { it.note.hidden }

    LazyVerticalGrid(GridCells.Fixed(3), Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 24.dp, 16.dp, 24.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        item(span = { GridItemSpan(3) }) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(bottom = 10.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(if (selecting) "${selected.size} selected" else "Photos", style = MaterialTheme.typography.headlineLarge)
                    if (selecting) Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Ghost("Delete", enabled = selected.isNotEmpty()) { confirmDelete = true }
                        Ghost("Done") { selecting = false; selected = emptySet() }
                    } else ArmPill(st, mode, onSession)
                }
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) { FILTERS.forEach { f -> Chip(f, filter == f) { filter = f } } }
                Card(padding = PaddingValues(12.dp, 10.dp), radius = 14) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(buildString {
                            if (analysing > 0) append("$analysing analysing")
                            if (waiting > 0) { if (isNotEmpty()) append(" · "); append("$waiting waiting for network") }
                            if (isEmpty()) append(if (st == SessionState.DISARMED) "Glasses off" else "Glasses ready")
                        }, style = MaterialTheme.typography.titleMedium)
                        val lastKey by Bus.lastCaptureKey.collectAsState()
                        val last = all.firstOrNull { it.key == lastKey } ?: all.firstOrNull { it.source == Source.FIELDNOTE }
                        Text(if (last != null) "Last capture ${agoLabel(last.takenAt)}" else "No Fieldnote captures yet", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                    }
                }
            }
        }
        if (loading) item(span = { GridItemSpan(3) }) { Text("Reading your albums…", color = F.Muted, style = MaterialTheme.typography.bodyMedium) }
        else if (visible.isEmpty()) item(span = { GridItemSpan(3) }) {
            Card(padding = PaddingValues(20.dp)) {
                Text(if (all.isEmpty()) "Nothing here yet. Photos from the Meta AI album and Fieldnote captures will appear as they land on the phone. If you have glasses photos already, check Glasses → Diagnostics shows the album."
                    else "No items match this filter.", style = MaterialTheme.typography.bodyMedium, color = F.Muted, textAlign = TextAlign.Center)
            }
        }
        groups.forEach { (day, list) ->
            item(span = { GridItemSpan(3) }) {
                Row(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                    Eyebrow(dayLabel(day)); Text("${list.size} item${if (list.size == 1) "" else "s"}", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                }
            }
            items(list, key = { it.key }) { item ->
                val sel = item.key in selected
                Box(Modifier.aspectRatio(1f).clip(RoundedCornerShape(10.dp)).background(F.Tile)
                    .border(if (sel) 3.dp else 0.dp, if (sel) F.Accent else Color.Transparent, RoundedCornerShape(10.dp))
                    .combinedClickable(onClick = { if (selecting) selected = if (sel) selected - item.key else selected + item.key else onOpen(item.key) },
                        onLongClick = { selecting = true; selected = selected + item.key })) {
                    AsyncImage(model = item.uri, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    Badge(if (item.source == Source.FIELDNOTE) "F" else "G", Modifier.align(Alignment.TopStart).padding(6.dp))
                    if (item.isVideo) Badge(durationLabel(item.durationMs), Modifier.align(Alignment.TopEnd).padding(6.dp))
                    statusColour(item.note.state)?.let { c -> Box(Modifier.align(Alignment.BottomEnd).padding(6.dp).size(8.dp).background(c, CircleShape)) }
                    if (item.note.favourite) Text("♥", color = F.Ink, modifier = Modifier.align(Alignment.BottomStart).padding(6.dp), style = MaterialTheme.typography.labelSmall)
                    if (sel) Box(Modifier.align(Alignment.Center).size(28.dp).background(F.Accent, CircleShape), contentAlignment = Alignment.Center) { Text("✓", color = F.Bg, style = MaterialTheme.typography.labelLarge) }
                }
            }
        }
        if (hidden > 0) item(span = { GridItemSpan(3) }) {
            Text("$hidden hidden. Originals stay on the phone.", style = MaterialTheme.typography.bodySmall, color = F.Muted, modifier = Modifier.padding(top = 12.dp))
        }
    }

    if (confirmDelete) AlertDialog(onDismissRequest = { confirmDelete = false }, containerColor = F.Card,
        title = { Text("Remove ${selected.size} item${if (selected.size == 1) "" else "s"}?") },
        text = { Text("Fieldnote captures are deleted from the phone. Glasses-album items are only hidden here; their originals stay.") },
        confirmButton = { TextButton({ confirmDelete = false; all.filter { it.key in selected }.forEach { state.delete(it) }; selecting = false; selected = emptySet() }) { Text("Remove", color = F.Red) } },
        dismissButton = { TextButton({ confirmDelete = false }) { Text("Cancel", color = F.Muted) } })
}

fun statusColour(s: AnalysisState): Color? = when (s) {
    AnalysisState.ANALYSING, AnalysisState.QUEUED -> F.Amber
    AnalysisState.ANALYSED -> F.Teal
    AnalysisState.WAITING_FOR_NETWORK -> F.Muted
    AnalysisState.FAILED -> F.Red
    AnalysisState.SAVED -> null
}

@Composable
private fun Badge(text: String, modifier: Modifier) {
    Box(modifier.background(Color(0xCC141416), RoundedCornerShape(6.dp)).padding(6.dp, 2.dp)) { Text(text, style = MaterialTheme.typography.labelSmall.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold), color = F.Ink) }
}

@Composable
fun ArmPill(st: SessionState, mode: Mode, onClick: () -> Unit) {
    val (label, colour) = when (st) {
        SessionState.DISARMED -> "Off" to F.Muted
        SessionState.HELD -> "Paused" to F.Amber
        SessionState.STANDBY -> "Ready" to F.Accent
        else -> st.name.lowercase().replaceFirstChar { it.uppercase() } to F.Amber
    }
    Row(Modifier.heightIn(min = 40.dp).background(F.Card, RoundedCornerShape(20.dp)).border(1.dp, F.Line, RoundedCornerShape(20.dp)).clickable(onClick = onClick).padding(start = 10.dp, end = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(10.dp).background(colour, CircleShape))
        Text(label, style = MaterialTheme.typography.labelLarge.copy(fontSize = 13.sp))
        if (st != SessionState.DISARMED) Text(if (mode == Mode.WAKE_WORD) "Wake word" else "Taps", style = MaterialTheme.typography.bodySmall, color = F.Muted)
    }
}

private val Int.sp get() = androidx.compose.ui.unit.TextUnit(this.toFloat(), androidx.compose.ui.unit.TextUnitType.Sp)
