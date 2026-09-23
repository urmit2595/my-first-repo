package com.urmit.glasses.dev.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.urmit.glasses.dev.data.ChatMessage
import com.urmit.glasses.dev.service.Bus
import com.urmit.glasses.dev.service.SessionState

/** Meta-AI-style chat with the orchestrator. Type or speak; attach the latest photo; every action the brain takes shows inline. */
@Composable
fun ChatScreen(state: AppState, onOpenPhoto: (String) -> Unit, onOpenMeal: (String) -> Unit, onGlasses: () -> Unit) {
    val allMessages by state.chat.messages.collectAsState()
    val chats by state.chat.chats.collectAsState()
    val currentId by state.chat.current.collectAsState()
    val pinned by state.chat.pinned.collectAsState()
    val messages = allMessages.filter { it.chat == currentId }
    val currentChat = chats.firstOrNull { it.id == currentId }
    var showChats by remember { mutableStateOf(false) }
    val busy by state.chat.busy.collectAsState()
    val status by state.chat.status.collectAsState()
    val listening by state.listening.collectAsState()
    val items by state.items.collectAsState(emptyList())
    val st by Bus.state.collectAsState()
    val trips by state.trips.collectAsState()
    state.prefs.version.collectAsState().value
    var text by remember { mutableStateOf("") }
    var attached by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val sessionOn = st != SessionState.DISARMED
    val hasKey = state.prefs.apiKey.isNotBlank()

    LaunchedEffect(messages.size, busy) { if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size + 1) }

    fun send(t: String) {
        val q = t.trim(); if (q.isBlank() || busy) return
        state.sendChat(q, attached); text = ""; attached = ""
    }

    Column(Modifier.fillMaxSize().imePadding()) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 20.dp, 16.dp, 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f).clickable { showChats = !showChats }) {
                Text(if (showChats) "Chats" else (currentChat?.title?.ifBlank { "New chat" } ?: "Fieldnote"), style = MaterialTheme.typography.headlineMedium, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                Text(if (showChats) "Tap one to open it" else if (chats.size <= 1) "Chats ▾" else "${chats.size} chats ▾ · ${if (pinned) "staying here" else "auto-sorted by topic"}", style = MaterialTheme.typography.bodySmall, color = F.Accent)
            }
            Row(Modifier.background(F.Card, RoundedCornerShape(20.dp)).border(1.dp, F.Line, RoundedCornerShape(20.dp)).clickable { onGlasses() }.padding(12.dp, 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.size(8.dp).background(if (sessionOn) F.Teal else F.Muted, CircleShape))
                Text(if (sessionOn) "Glasses on" else "Glasses off", style = MaterialTheme.typography.labelLarge, color = if (sessionOn) F.Ink else F.Muted)
            }
        }
        if (showChats) {
            LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp, 8.dp, 16.dp, 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item { Primary("＋ New chat", Modifier.fillMaxWidth()) { state.chat.newChat(pin = true); showChats = false } }
                item { Text("Say \"new topic\" or \"back to <chat name>\" to switch by voice. Open a chat here to stay in it; tap Auto to let the brain sort questions by topic again.", style = MaterialTheme.typography.bodySmall, color = F.Muted) }
                if (pinned) item { Ghost("Auto: let the brain pick the chat", Modifier.fillMaxWidth()) { state.chat.unpin(); showChats = false } }
                items(chats, key = { it.id }) { c ->
                    val last = allMessages.lastOrNull { it.chat == c.id }
                    Card(onClick = { state.chat.select(c.id, pin = true); showChats = false }, padding = androidx.compose.foundation.layout.PaddingValues(14.dp, 12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(c.title.ifBlank { "Untitled" }, style = MaterialTheme.typography.titleMedium, color = if (c.id == currentId) F.Accent else F.Ink)
                                Text((last?.text?.take(80) ?: "Empty") + " · " + agoLabel(c.updatedAt), style = MaterialTheme.typography.bodySmall, color = F.Muted, maxLines = 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                            }
                            Text("Delete", style = MaterialTheme.typography.labelLarge, color = F.Red, modifier = Modifier.clickable { state.chat.delete(c.id) }.padding(8.dp))
                        }
                    }
                }
            }
            return@Column
        }
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = listState, contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp, 8.dp, 16.dp, 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                if (messages.isEmpty()) Column(Modifier.fillMaxWidth().padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Hi. I'm the brain of your glasses.", style = MaterialTheme.typography.headlineMedium)
                    Text(if (!hasKey) "First, add your API key in Glasses → Answers so I can think." else if (!sessionOn) "Start a session in Glasses and I can take photos for you. Or ask me anything here." else "Ask me anything, or try one of these:", style = MaterialTheme.typography.bodyLarge, color = F.Ink2)
                    if (!hasKey) Primary("Add my key") { onGlasses() }
                }
            }
            items(messages, key = { it.chat + it.at.toString() + it.role + it.text.hashCode() }) { m -> Bubble(m, items.firstOrNull { it.key == m.photoKey }?.uri, onOpenPhoto, onOpenMeal) }
            item {
                if (busy) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(4.dp)) {
                    CircularProgressIndicator(Modifier.size(16.dp), color = F.Accent, strokeWidth = 2.dp)
                    Text(status.ifBlank { "Thinking…" }, style = MaterialTheme.typography.bodyMedium, color = F.Muted)
                }
            }
        }
        // Suggestions
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val ideas = if (sessionOn) listOf("What am I looking at?", "Log this meal", "Read this for me", "Where am I?", "How much have I eaten today?")
                else listOf("What's in my last photo?", "How much have I eaten today?", "Log: two rotis, dal and salad", "What did I photograph today?")
            val travel = if (trips.isNotEmpty()) listOf("Take me home", "What did I spend today?", "Translate this sign", "Read the menu", "Where am I?") else emptyList()
            // Take me home and Where am I are answered on the phone, as by voice: offline and without a key.
            (travel + ideas).distinct().forEach { s -> Chip(s, false) { when { busy -> {}; s == "Take me home" -> state.takeMeHome(); s == "Where am I?" -> state.whereAmI(); else -> send(s) } } }
        }
        // Input row
        Column(Modifier.fillMaxWidth().background(F.Bar).padding(12.dp, 10.dp, 12.dp, 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val latest = items.firstOrNull { !it.isVideo }
            if (attached.isNotBlank()) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AsyncImage(model = items.firstOrNull { it.key == attached }?.uri, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(44.dp).clip(RoundedCornerShape(8.dp)))
                Text("Photo attached", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                Text("Remove", style = MaterialTheme.typography.labelLarge, color = F.Accent, modifier = Modifier.clickable { attached = "" })
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RoundButton(if (attached.isNotBlank()) "✓" else "▣", on = attached.isNotBlank(), enabled = latest != null) { attached = if (attached.isBlank()) latest?.key ?: "" else "" }
                OutlinedTextField(text, { text = it }, Modifier.weight(1f), placeholder = { Text(if (listening) "Listening…" else "Ask or tell me anything", color = F.Muted) }, maxLines = 4, shape = RoundedCornerShape(22.dp), textStyle = MaterialTheme.typography.bodyLarge,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = F.Accent, unfocusedBorderColor = F.Line, focusedContainerColor = F.Card, unfocusedContainerColor = F.Card, cursorColor = F.Accent, focusedTextColor = F.Ink, unfocusedTextColor = F.Ink))
                if (text.isBlank()) RoundButton("●", on = listening, enabled = !busy, accent = listening) { state.speakToChat(attached) }
                else RoundButton("↑", on = true, enabled = !busy) { send(text) }
            }
            Text(if (sessionOn) "▣ attaches your latest photo · ● speak" else "▣ attaches your latest photo · ● speak · start a session for live photos", style = MaterialTheme.typography.bodySmall, color = F.Muted)
        }
    }
}

@Composable
private fun RoundButton(glyph: String, on: Boolean, enabled: Boolean = true, accent: Boolean = false, onClick: () -> Unit) {
    val bg = when { accent -> F.Red; on -> F.Accent; else -> F.Card }
    Box(Modifier.size(44.dp).background(if (enabled) bg else F.Line2, CircleShape).border(1.dp, if (on) Color.Transparent else F.Line, CircleShape).clickable(enabled = enabled, onClick = onClick), contentAlignment = Alignment.Center) {
        Text(glyph, color = if (on || accent) F.Bg else F.Ink, fontSize = 18.sp)
    }
}

@Composable
private fun Bubble(m: ChatMessage, uri: android.net.Uri?, onOpenPhoto: (String) -> Unit, onOpenMeal: (String) -> Unit) {
    when (m.role) {
        "user" -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (uri != null) AsyncImage(model = uri, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(120.dp).clip(RoundedCornerShape(14.dp)).clickable { onOpenPhoto(m.photoKey) })
                Box(Modifier.widthIn(max = 300.dp).background(F.Accent, RoundedCornerShape(18.dp, 18.dp, 4.dp, 18.dp)).padding(14.dp, 10.dp)) {
                    Text(m.text + if (m.byVoice) "  🎙" else "", style = MaterialTheme.typography.bodyLarge, color = F.Bg)
                }
            }
        }
        "action" -> Row(Modifier.fillMaxWidth().clickable(enabled = m.mealId.isNotBlank() || m.photoKey.isNotBlank()) { if (m.mealId.isNotBlank()) onOpenMeal(m.mealId) else onOpenPhoto(m.photoKey) }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (uri != null) AsyncImage(model = uri, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(40.dp).clip(RoundedCornerShape(8.dp)))
            else Box(Modifier.size(8.dp).background(F.Teal, CircleShape))
            Text(m.text, style = MaterialTheme.typography.bodySmall, color = F.Teal)
        }
        else -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Box(Modifier.widthIn(max = 320.dp).background(F.Card, RoundedCornerShape(18.dp, 18.dp, 18.dp, 4.dp)).border(1.dp, F.Line, RoundedCornerShape(18.dp, 18.dp, 18.dp, 4.dp)).padding(14.dp, 10.dp)) {
                    Text(m.text, style = MaterialTheme.typography.bodyLarge)
                }
                if (m.model.isNotBlank()) Text("${m.model.substringAfter('/')} · ${"%.1f".format(m.ms / 1000.0)} s", style = MaterialTheme.typography.bodySmall.copy(fontSize = 10.sp), color = F.Muted, modifier = Modifier.padding(start = 6.dp))
            }
        }
    }
}
