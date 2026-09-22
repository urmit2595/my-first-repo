package com.urmit.glasses.dev.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.urmit.glasses.dev.data.Lenses
import com.urmit.glasses.dev.service.Bus
import com.urmit.glasses.dev.service.FieldService
import com.urmit.glasses.dev.service.Mode
import com.urmit.glasses.dev.service.SessionState
import kotlinx.coroutines.delay

@Composable
fun SessionBody(state: AppState, onOpenLast: (String) -> Unit, onArm: () -> Unit) {
    val ctx = LocalContext.current
    val st by Bus.state.collectAsState()
    val mode by Bus.mode.collectAsState()
    val since by Bus.armedSince.collectAsState()
    val lastAnswer by Bus.lastAnswer.collectAsState()
    val lastKey by Bus.lastCaptureKey.collectAsState()
    val lastError by Bus.lastError.collectAsState()
    val checks by Bus.checks.collectAsState()
    val wakeEnds by Bus.wakeWordEndsAt.collectAsState()
    state.prefs.version.collectAsState().value
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(10_000); now = System.currentTimeMillis() } }
    val armed = st != SessionState.DISARMED
    val allOk = checks.isNotEmpty() && checks.all { it.second }
    val testDPassed = state.prefs.testResult("D").startsWith("pass")

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Card(padding = PaddingValues(16.dp, 24.dp, 16.dp, 20.dp), radius = 24) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                val ring = when (st) { SessionState.DISARMED -> F.Line; SessionState.STANDBY -> F.Accent; SessionState.HELD -> F.Amber; else -> F.Amber }
                Box(Modifier.size(148.dp).border(3.dp, ring, CircleShape).background(ring.copy(alpha = 0.08f), CircleShape), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(when (st) { SessionState.DISARMED -> "Off"; SessionState.STANDBY -> "Ready"; SessionState.CAPTURING -> "Photo"; SessionState.LISTENING -> "Listening"; SessionState.ANALYSING -> "Thinking"; SessionState.SPEAKING -> "Answering"; SessionState.HELD -> "Paused"; else -> "Busy" }, style = MaterialTheme.typography.headlineMedium)
                        Text(if (armed && since > 0) "on for ${((now - since) / 60000)} min" else "tap Start to use the glasses", style = MaterialTheme.typography.bodySmall, color = F.Muted)
                    }
                }
                if (armed) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (allOk) "✓" else "!", color = if (allOk) F.Teal else F.Amber, style = MaterialTheme.typography.titleMedium)
                    Text(if (allOk) "All good. You can lock your phone." else "Needs attention: ${checks.firstOrNull { !it.second }?.first ?: "…"}", style = MaterialTheme.typography.titleMedium, color = if (allOk) F.Teal else F.Amber)
                }
                if (armed) Ghost("End session", Modifier.fillMaxWidth()) { FieldService.send(ctx, FieldService.ACT_END) }
                else Primary("Start session", Modifier.fillMaxWidth()) { onArm() }
                if (lastError.isNotBlank()) Text(lastError, style = MaterialTheme.typography.bodySmall, color = F.Red)
            }
        }
        Row(Modifier.fillMaxWidth().background(F.Card, RoundedCornerShape(14.dp)).border(1.dp, F.Line, RoundedCornerShape(14.dp)).padding(4.dp)) {
            Seg("Taps", mode == Mode.TAP, Modifier.weight(1f)) { FieldService.send(ctx, FieldService.ACT_MODE, mapOf("mode" to "tap")) }
            Seg(if (mode == Mode.WAKE_WORD && wakeEnds > 0) "Wake word · ${((wakeEnds - now) / 60000).coerceAtLeast(0)} min" else "Wake word · 20 min", mode == Mode.WAKE_WORD, Modifier.weight(1f), enabled = armed && testDPassed) { FieldService.send(ctx, FieldService.ACT_MODE, mapOf("mode" to "wake")) }
        }
        if (!testDPassed) Text("Wake word unlocks after the wake-word test passes (Setup, below).", style = MaterialTheme.typography.bodySmall, color = F.Muted)
        if (armed) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Ghost("Photo", Modifier.weight(1f)) { FieldService.send(ctx, FieldService.ACT_CAPTURE) }
            Ghost("Photo + answer", Modifier.weight(1f)) { FieldService.send(ctx, FieldService.ACT_ANALYSE) }
            Ghost("Ask", Modifier.weight(1f)) { FieldService.send(ctx, FieldService.ACT_ASK) }
        }
        Card(padding = PaddingValues(14.dp, 12.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Eyebrow("Last answer")
                Text(if (lastAnswer.isBlank()) "Nothing yet." else "“${lastAnswer.take(160)}${if (lastAnswer.length > 160) "…" else ""}”", style = MaterialTheme.typography.bodyLarge)
                if (lastKey != null) Text("Open the photo", color = F.Accent, style = MaterialTheme.typography.labelLarge, modifier = Modifier.heightIn(min = 32.dp).clickable { onOpenLast(lastKey!!) })
            }
        }
        Card(padding = PaddingValues(14.dp, 4.dp)) {
            Column {
                Legend("1", "Tap", "Take a photo")
                Legend("2", "Double-tap", "Photo + spoken answer (${Lenses.byId(state.prefs.doubleTapLens).label})")
                Legend("3", "Triple-tap", "Ask anything, then speak")
                Legend("◉", "Shutter button", "Meta's own photo, shows up later", last = true)
            }
        }
        Text("While a session is on, the glasses' taps belong to Fieldnote (music controls come back when you end it). After a triple-tap, just talk: \"what am I looking at\", \"log this meal\", \"how much have I eaten today\", \"read this menu\", or any question.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
    }
}

@Composable
private fun Seg(text: String, on: Boolean, modifier: Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Box(modifier.heightIn(min = 40.dp).background(if (on) F.Ink else Color.Transparent, RoundedCornerShape(10.dp)).clickable(enabled = enabled, onClick = onClick), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.labelLarge, color = if (on) F.Bg else if (enabled) F.Muted else F.Line)
    }
}

@Composable
private fun Legend(n: String, gesture: String, action: String, last: Boolean = false) {
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(n, style = MaterialTheme.typography.titleLarge, color = if (n == "◉") F.Muted else F.Ink, modifier = Modifier.size(28.dp))
            Text(gesture, style = MaterialTheme.typography.bodyLarge)
        }
        Text(action, style = MaterialTheme.typography.bodyMedium, color = F.Muted)
    }
    if (!last) HorizontalDivider(color = F.Line2)
}
