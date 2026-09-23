package com.urmit.glasses.dev.ui

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.urmit.glasses.dev.data.AnalysisState
import com.urmit.glasses.dev.data.Lenses
import com.urmit.glasses.dev.data.Money
import com.urmit.glasses.dev.data.Source
import com.urmit.glasses.dev.service.Bus
import com.urmit.glasses.dev.service.SessionState

@Composable
fun DetailScreen(state: AppState, key: String, onOpenMeal: (String) -> Unit = {}, onOpenTrip: () -> Unit = {}, onBack: () -> Unit) {
    val all by state.items.collectAsState(emptyList())
    val item = all.firstOrNull { it.key == key }
    val ctx = LocalContext.current
    val reader = remember { ReadAloud(ctx.applicationContext) { state.toast.value = "Text to speech isn't working on this phone" } }
    DisposableEffect(reader) { onDispose { reader.release() } }
    if (item == null) { LaunchedEffect(Unit) { onBack() }; return }
    val note = item.note
    var lens by remember(key) { mutableStateOf(note.lens) }
    var question by remember { mutableStateOf("") }
    var confirmDelete by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val busy = note.state == AnalysisState.ANALYSING || note.state == AnalysisState.QUEUED
    val armedBusy = Bus.state.collectAsState().value.let { it != SessionState.DISARMED && it != SessionState.STANDBY }

    val speech = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        if (r.resultCode == Activity.RESULT_OK) r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.let { if (it.isNotBlank()) state.ask(item, lens, it, byVoice = true) }
    }
    fun send(q: String) { if (q.isBlank() && note.thread.isNotEmpty()) return; state.ask(item, lens, q); question = "" }
    fun readAloud() { val t = note.lastAnswer; if (t.isNotBlank()) reader.say(t) }
    fun share() {
        val i = Intent(Intent.ACTION_SEND).setType(if (item.isVideo) "video/*" else "image/*").putExtra(Intent.EXTRA_STREAM, item.uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        if (note.lastAnswer.isNotBlank()) i.putExtra(Intent.EXTRA_TEXT, note.lastAnswer)
        try { ctx.startActivity(Intent.createChooser(i, "Share")) } catch (_: ActivityNotFoundException) { state.toast.value = "No app on this phone can share this" }
    }
    LaunchedEffect(note.thread.size) { if (note.thread.isNotEmpty()) listState.animateScrollToItem(note.thread.size) }

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().height(340.dp).background(F.Tile).clickable {
            if (item.isVideo) try { ctx.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(item.uri, "video/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)) } catch (_: ActivityNotFoundException) { state.toast.value = "No app on this phone can play this video" }
        }) {
            AsyncImage(model = item.uri, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            RoundButton("‹", Modifier.align(Alignment.TopStart).padding(16.dp), onBack)
            Row(Modifier.align(Alignment.TopEnd).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RoundButton(if (note.favourite) "♥" else "♡", onClick = { state.setFavourite(key, !note.favourite) }, tint = if (note.favourite) F.Accent else F.Ink)
                RoundButton("↗", onClick = ::share)
                RoundButton("🗑", onClick = { confirmDelete = true })
            }
            if (item.isVideo) Box(Modifier.align(Alignment.Center).size(64.dp).background(Color(0xAA141416), CircleShape), contentAlignment = Alignment.Center) { Text("▶", color = F.Ink, style = MaterialTheme.typography.headlineMedium) }
            Row(Modifier.align(Alignment.BottomStart).padding(16.dp, 14.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Tag(if (item.source == Source.FIELDNOTE) "Fieldnote" else "Glasses", strong = true)
                Tag("${dayLabel(item.takenAt)} ${timeLabel(item.takenAt)}")
                if (note.place.isNotBlank()) Tag("📍 " + note.place, Modifier.weight(1f, fill = false))
            }
        }
        Column(Modifier.fillMaxSize().padding(top = 0.dp).background(F.Bar, RoundedCornerShape(22.dp, 22.dp, 0.dp, 0.dp)).padding(16.dp, 12.dp, 16.dp, 0.dp)) {
            Box(Modifier.align(Alignment.CenterHorizontally).size(40.dp, 4.dp).background(F.Line, RoundedCornerShape(2.dp)))
            Spacer(Modifier.height(12.dp))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Lenses.ALL.forEach { l -> LensChip(l.label, lens == l.id) { lens = l.id; state.setLens(key, l.id) } }
                val logged = state.food.meals.collectAsState().value.firstOrNull { it.photoKey == key }
                LensChip(if (logged != null) "Logged · ${logged.kcalMid} kcal" else "＋ Log as meal", logged != null) { if (logged != null) onOpenMeal(logged.id) else if (!busy) state.logMeal(item) }
                val spent = state.expenses.collectAsState().value.firstOrNull { it.photoKey == key }
                LensChip(if (spent != null) "Spent · ${Money.fmt(spent.amount, spent.currency)}" else "＋ Log as expense", spent != null) { if (spent != null) onOpenTrip() else if (!busy && !item.isVideo) state.logReceipt(item) }
            }
            if (note.thread.isNotEmpty() && lens != note.thread.last().lens) Text("Changing the lens sends another request.", style = MaterialTheme.typography.bodySmall, color = F.Muted, modifier = Modifier.padding(top = 6.dp))
            Spacer(Modifier.height(12.dp))
            LazyColumn(Modifier.weight(1f), state = listState, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (note.thread.isEmpty() && !busy) item {
                    Card(padding = PaddingValues(16.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(if (item.isVideo) "Videos can't be looked at yet." else "Nothing asked about this photo yet.", style = MaterialTheme.typography.bodyMedium, color = F.Muted)
                            Primary("Ask with the ${Lenses.byId(lens).label} lens", Modifier.fillMaxWidth(), enabled = !item.isVideo) { send("") }
                        }
                    }
                }
                items(note.thread) { m ->
                    if (m.role == "user") Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                        Column(Modifier.widthIn(max = 290.dp).background(Color(0xFF2E3034), RoundedCornerShape(16.dp, 16.dp, 4.dp, 16.dp)).padding(14.dp, 10.dp)) {
                            Text(if (m.byVoice) "You, by voice" else "You", style = MaterialTheme.typography.labelSmall.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold), color = F.Muted)
                            Text(m.text, style = MaterialTheme.typography.bodyLarge)
                        }
                    } else Card(padding = PaddingValues(14.dp, 12.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("${Lenses.byId(m.lens).label} · ${m.model.substringAfter('/')} · ${"%.1f".format(m.ms / 1000f)} s", style = MaterialTheme.typography.labelSmall.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold), color = F.Muted)
                                Text("🔊", Modifier.clickable { readAloud() }.padding(4.dp), style = MaterialTheme.typography.bodyMedium)
                            }
                            SelectionContainer { Text(m.text, style = MaterialTheme.typography.bodyLarge) }
                        }
                    }
                }
                if (busy) item { Card(padding = PaddingValues(14.dp)) { Text("Thinking…", style = MaterialTheme.typography.bodyMedium, color = F.Muted) } }
                if (note.state == AnalysisState.FAILED || note.state == AnalysisState.WAITING_FOR_NETWORK) item {
                    Card(padding = PaddingValues(14.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(note.error.ifBlank { "Analysis failed" }, style = MaterialTheme.typography.bodyMedium, color = F.Red)
                            Text("The photo is safe. Retry when ready.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                            Ghost("Retry", Modifier.fillMaxWidth()) { state.ask(item, lens, note.thread.lastOrNull { it.role == "user" }?.text?.takeIf { note.thread.isNotEmpty() } ?: "") }
                        }
                    }
                }
                item { Spacer(Modifier.height(4.dp)) }
            }
            Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(52.dp).background(if (busy) F.Line else F.Accent, CircleShape).clickable(enabled = !busy) {
                    runCatching { speech.launch(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_PROMPT, "Ask about this photo")) }.onFailure { state.toast.value = "No speech input on this phone" }
                }, contentAlignment = Alignment.Center) { Text("🎙", style = MaterialTheme.typography.titleLarge) }
                OutlinedTextField(question, { question = it }, Modifier.weight(1f), placeholder = { Text(if (note.thread.isEmpty()) "Ask, or analyse with the lens" else "Ask a follow-up", color = F.Muted) },
                    singleLine = true, shape = RoundedCornerShape(26.dp), enabled = !busy,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = F.Accent, unfocusedBorderColor = F.Line, focusedContainerColor = F.Card2, unfocusedContainerColor = F.Card2, cursorColor = F.Accent, focusedTextColor = F.Ink, unfocusedTextColor = F.Ink),
                    trailingIcon = { TextButton({ send(question) }, enabled = !busy && (question.isNotBlank() || note.thread.isEmpty())) { Text("Send", color = F.Accent) } })
            }
            if (armedBusy) Text("Glasses session busy; phone requests wait for it.", style = MaterialTheme.typography.bodySmall, color = F.Muted, modifier = Modifier.padding(bottom = 8.dp))
        }
    }

    if (confirmDelete) AlertDialog(onDismissRequest = { confirmDelete = false }, containerColor = F.Card,
        title = { Text(if (item.source == Source.FIELDNOTE) "Delete this capture?" else "Hide this photo?") },
        text = { Text(if (item.source == Source.FIELDNOTE) "It is removed from the phone." else "The original stays in the Meta AI album; it is only hidden in Fieldnote.") },
        confirmButton = { TextButton({ confirmDelete = false; state.delete(item); onBack() }) { Text(if (item.source == Source.FIELDNOTE) "Delete" else "Hide", color = F.Red) } },
        dismissButton = { TextButton({ confirmDelete = false }) { Text("Cancel", color = F.Muted) } })
}

/** One engine per screen: bound on the first tap, speaks once it is up, stopped and released when the screen closes. */
private class ReadAloud(private val ctx: Context, private val onFail: () -> Unit) {
    @Volatile private var tts: TextToSpeech? = null
    @Volatile private var ready = false
    @Volatile private var failed = false
    @Volatile private var waiting: String? = null
    fun say(text: String) {
        when {
            failed -> onFail()
            tts == null -> {
                waiting = text
                tts = TextToSpeech(ctx) { s ->
                    ready = s == TextToSpeech.SUCCESS; failed = !ready
                    val w = waiting; waiting = null
                    if (w != null) { if (ready) speak(w) else onFail() }
                }
            }
            ready -> speak(text)
            else -> waiting = text
        }
    }
    private fun speak(text: String) { runCatching { tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "d") } }
    fun release() { val t = tts; tts = null; waiting = null; runCatching { t?.stop(); t?.shutdown() } }
}

@Composable
private fun RoundButton(glyph: String, modifier: Modifier = Modifier, onClick: () -> Unit, tint: Color = F.Ink) {
    Box(modifier.size(44.dp).background(Color(0xBF141416), CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) { Text(glyph, color = tint, style = MaterialTheme.typography.titleLarge) }
}

@Composable
private fun Tag(text: String, modifier: Modifier = Modifier, strong: Boolean = false) {
    Box(modifier.background(Color(0xBF141416), RoundedCornerShape(8.dp)).padding(8.dp, 4.dp)) { Text(text, style = MaterialTheme.typography.bodySmall.copy(fontWeight = if (strong) androidx.compose.ui.text.font.FontWeight.SemiBold else androidx.compose.ui.text.font.FontWeight.Normal), color = if (strong) F.Ink else F.Ink2, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis) }
}

@Composable
fun LensChip(text: String, on: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    Box(Modifier.heightIn(min = 36.dp).background(if (on) F.Accent else Color.Transparent, shape).border(1.dp, if (on) F.Accent else F.Line, shape).clickable(onClick = onClick).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.labelLarge, color = if (on) F.Bg else F.Ink)
    }
}
