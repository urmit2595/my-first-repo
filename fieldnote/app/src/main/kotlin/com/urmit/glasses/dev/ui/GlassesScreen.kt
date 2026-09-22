package com.urmit.glasses.dev.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.types.RegistrationState
import com.urmit.glasses.dev.data.Lenses
import com.urmit.glasses.dev.service.Bus
import com.urmit.glasses.dev.service.FieldService
import com.urmit.glasses.dev.service.SessionState
import com.urmit.glasses.dev.service.Speaker

@Composable
fun GlassesScreen(state: AppState, onOpenPhoto: (String) -> Unit, onArm: () -> Unit) {
    val ctx = LocalContext.current
    val prefs = state.prefs
    prefs.version.collectAsState().value
    val st by Bus.state.collectAsState()
    val armed = st != SessionState.DISARMED
    val reg = runCatching { Wearables.registrationState.collectAsState().value }.getOrDefault(RegistrationState.UNAVAILABLE)
    val devices = runCatching { Wearables.devices.collectAsState().value }.getOrDefault(emptySet())
    val perms = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }
    val needed = listOf(android.Manifest.permission.BLUETOOTH_CONNECT, android.Manifest.permission.RECORD_AUDIO, android.Manifest.permission.POST_NOTIFICATIONS, android.Manifest.permission.READ_MEDIA_IMAGES, android.Manifest.permission.READ_MEDIA_VIDEO)
    val permsOk = needed.all { ctx.checkSelfPermission(it) == android.content.pm.PackageManager.PERMISSION_GRANTED }
    val battOk = ctx.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(ctx.packageName)
    val mediaEvents by Bus.mediaEvents.collectAsState()
    val timings by Bus.captureTimings.collectAsState()
    var key by remember { mutableStateOf(prefs.apiKey) }
    var showKey by remember { mutableStateOf(false) }
    var about by remember { mutableStateOf(prefs.aboutMe) }
    var cap by remember { mutableStateOf((prefs.dailyCapCents / 100.0).toString()) }
    var diagUrl by remember { mutableStateOf(state.diag.endpoint) }
    var diagToken by remember { mutableStateOf(state.diag.token) }
    var diagOn by remember { mutableStateOf(state.diag.enabled) }
    val speaker = remember { Speaker(ctx) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp, 24.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Glasses", style = MaterialTheme.typography.headlineLarge)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.size(8.dp).background(if (devices.isNotEmpty()) F.Teal else F.Muted, CircleShape))
                Text(if (devices.isNotEmpty()) (runCatching { Wearables.devicesMetadata[devices.first()]?.value?.name }.getOrNull() ?: "Glasses linked") else "No glasses linked", style = MaterialTheme.typography.bodySmall, color = F.Muted)
            }
        }

        fun openLast(k: String) = onOpenPhoto(k)
        SessionBody(state, ::openLast, onArm)

        val setupOk = reg == RegistrationState.REGISTERED && permsOk && battOk
        Section(if (setupOk) "Setup · all good" else "Setup · needs attention", open = !setupOk) {
            CheckRow(reg == RegistrationState.REGISTERED, "Glasses linked to Fieldnote", when (reg) { RegistrationState.REGISTERED -> "Fieldnote can use the camera"; RegistrationState.UNAVAILABLE -> "Install the Meta AI app, pair the glasses, then turn on Developer Mode in Meta AI → Settings"; else -> "Tap Link and approve in the Meta AI app" },
                action = if (reg == RegistrationState.AVAILABLE) "Link" else null) { (ctx as? Activity)?.let { Wearables.startRegistration(it) } }
            CheckRow(permsOk, "Permissions", "Bluetooth, microphone, notifications, photos", action = if (!permsOk) "Allow" else null) { perms.launch(needed.toTypedArray()) }
            CheckRow(battOk, "Keep running in the background", if (battOk) "Allowed" else "Needed so Android doesn't close the session", action = if (!battOk) "Allow" else null) {
                runCatching { ctx.startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${ctx.packageName}"))) }
            }
            TestRow("A", "Taps reach Fieldnote", prefs.testResult("A"), enabled = armed, hint = if (!armed) "Start a session first" else null) {
                FieldService.send(ctx, FieldService.ACT_TEST_A)
            }
            if (mediaEvents.isNotEmpty()) {
                Text("${mediaEvents.size} events: " + mediaEvents.takeLast(6).joinToString(", ") { it.substringAfter(' ') }, style = MaterialTheme.typography.bodySmall, color = F.Muted)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Ghost("Taps worked", Modifier.weight(1f)) { prefs.setTestResult("A", "pass:${mediaEvents.size} taps received") }
                    Ghost("Taps didn't work", Modifier.weight(1f)) { prefs.setTestResult("A", "fail:${mediaEvents.size} taps received · use the notification buttons and Chat instead") }
                }
            }
            TestRow("B", "Photo speed", prefs.testResult("B"), enabled = armed, hint = if (!armed) "Start a session first" else null) { FieldService.send(ctx, FieldService.ACT_TEST_B) }
            if (timings.isNotEmpty()) Text(timings.joinToString(" · ") { "${it.totalMs} ms (${if (it.warm) "warm" else "session ${it.sessionMs}, cam ${it.cameraMs}, stream ${it.streamMs}"}, shot ${it.captureMs}${if (it.attempts > 1) ", ${it.attempts} tries" else ""})" }, style = MaterialTheme.typography.bodySmall, color = F.Muted)
            ManualTest("C", "Recovers after interruptions", "With a session on: say “Hey Meta, what time is it”, take a photo with the shutter button, take a call, take the glasses off and on, fold and unfold. After each one, a single tap should still take a photo without touching the phone.", prefs)
            ManualTest("D", "Wake word", "30 minutes outdoors, phone locked, wake-word mode. Say “Hey Fieldnote” 20 times. Pass: 18 heard, at most 1 false trigger, glasses battery drop under 25 points.", prefs, unlockNote = "Passing unlocks wake-word mode above.")
        }

        Section(if (prefs.apiKey.isBlank()) "Answers · add your key" else "Answers", open = prefs.apiKey.isBlank()) {
            Text("API key", style = MaterialTheme.typography.titleMedium)
            Text("Paste an OpenRouter key (sk-or-…) or an OpenAI key (sk-…). It stays on this phone; each question goes straight from the phone to the provider.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
            Field(key, { key = it; prefs.apiKey = it }, "sk-or-v1-…", visual = if (showKey) VisualTransformation.None else PasswordVisualTransformation())
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                TextButton({ showKey = !showKey }, contentPadding = PaddingValues(0.dp)) { Text(if (showKey) "Hide" else "Show", color = F.Accent) }
                TextButton({ state.testKey() }, contentPadding = PaddingValues(0.dp)) { Text("Test key", color = F.Accent) }
                Text("Provider: ${if (prefs.provider == "openrouter") "OpenRouter" else "OpenAI"}", style = MaterialTheme.typography.bodySmall, color = F.Muted)
            }
            HorizontalDivider(color = F.Line2)
            Text("Brain (decides what to do)", style = MaterialTheme.typography.titleMedium)
            Text("Reads what you say or type, then takes photos, picks a lens, logs meals, files things into the right chat, or just answers. GPT-5.6 Sol is the default; Luna is cheaper and faster.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
            ModelPicker("Brain", prefs.agentModel, prefs.agentModels) { prefs.agentModel = it }
            HorizontalDivider(color = F.Line2)
            Text("Eyes (looks at photos), per lens", style = MaterialTheme.typography.titleMedium)
            (listOf("default" to "Default") + Lenses.ALL.map { it.id to it.label }).forEach { (id, label) ->
                ModelPicker(label, if (id == "default") prefs.defaultModel else prefs.modelFor(id), prefs.models) { m -> if (id == "default") prefs.defaultModel = m else prefs.setModelFor(id, m) }
            }
            HorizontalDivider(color = F.Line2)
            Text("Double-tap lens", style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Lenses.ALL.forEach { l -> LensChip(l.label, prefs.doubleTapLens == l.id) { prefs.doubleTapLens = l.id } } }
            ToggleRow("Answer after every single tap", "Off: a tap only saves the photo; double-tap asks", prefs.autoAnalyse) { prefs.autoAnalyse = it }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column { Text("Spoken answer length", style = MaterialTheme.typography.titleMedium); Text("Say “more” to continue", style = MaterialTheme.typography.bodySmall, color = F.Muted) }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf(10, 15, 25).forEach { s -> Chip("$s s", prefs.answerSeconds == s) { prefs.answerSeconds = s } } }
            }
            HorizontalDivider(color = F.Line2)
            Text("Food targets per day", style = MaterialTheme.typography.titleMedium)
            var kcalT by remember { mutableStateOf(prefs.kcalTarget.toString()) }
            var protT by remember { mutableStateOf(prefs.proteinTarget.toString()) }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.weight(1f)) { Field(kcalT, { kcalT = it; it.toIntOrNull()?.let { v -> prefs.kcalTarget = v } }, "2000 kcal", keyboard = KeyboardType.Number) }
                Box(Modifier.weight(1f)) { Field(protT, { protT = it; it.toIntOrNull()?.let { v -> prefs.proteinTarget = v } }, "80 g protein", keyboard = KeyboardType.Number) }
            }
            Text("Daily spend cap (USD)", style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { Field(cap, { cap = it; it.toDoubleOrNull()?.let { v -> prefs.dailyCapCents = (v * 100).toInt() } }, "2.00", keyboard = KeyboardType.Decimal) }
                Text("used ${"%.2f".format(prefs.spentTodayCents / 100.0)} today", style = MaterialTheme.typography.bodySmall, color = F.Muted)
            }
            Text("About you (optional)", style = MaterialTheme.typography.titleMedium)
            Field(about, { about = it; prefs.aboutMe = it }, "e.g. vegetarian; interested in temple architecture", minLines = 2)
        }

        Section("More glasses options", open = false) {
            Text("Taps", style = MaterialTheme.typography.titleMedium)
            Text(when { prefs.testResult("A").startsWith("pass") -> "Tap, double-tap and triple-tap are working."; prefs.testResult("A").startsWith("fail") -> "Taps aren't reaching Fieldnote: use the notification buttons or Chat."; else -> "Not tested yet. Run the tap test in Setup." }, style = MaterialTheme.typography.bodySmall, color = F.Muted)
            Text("The shutter button takes Meta's own photo; it shows up in Photos once the Meta AI app imports it.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
            HorizontalDivider(color = F.Line2)
            Text("Keep the camera warm after a photo", style = MaterialTheme.typography.titleMedium)
            Text("Off: the camera starts fresh each time (saves glasses battery). Warm: a second photo within the window skips the 2–3 s start-up, but a tap during that window may pause the glasses instead.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf(0 to "Off", 30 to "30 s", 90 to "90 s").forEach { (v, l) -> Chip(l, prefs.warmSeconds == v) { prefs.warmSeconds = v; FieldService.send(ctx, FieldService.ACT_RELOAD) } } }
            HorizontalDivider(color = F.Line2)
            Text("Sounds", style = MaterialTheme.typography.titleMedium)
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Speaker.Tone.values().forEach { t -> Chip(t.name.lowercase().replaceFirstChar { it.uppercase() }, false) { speaker.tone(t) } }
            }
            HorizontalDivider(color = F.Line2)
            val bucket = remember { state.media.detectedGlassesBucket() }
            Text("Meta AI album", style = MaterialTheme.typography.titleMedium)
            Text(if (bucket != null) "Watching “$bucket”. New imports appear in Photos automatically." else "No glasses album found yet. Take a shutter photo and import it in the Meta AI app; Fieldnote watches for “Meta AI” or “Meta View”.", style = MaterialTheme.typography.bodySmall, color = if (bucket != null) F.Teal else F.Muted)
            HorizontalDivider(color = F.Line2)
            Text("Unlink the glasses", style = MaterialTheme.typography.titleMedium)
            Text("Hands the glasses back to Meta AI only. You can link again any time.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
            Ghost("Unlink", Modifier.fillMaxWidth(), enabled = reg == RegistrationState.REGISTERED) { (ctx as? Activity)?.let { Wearables.startUnregistration(it) } }
        }

        Section("Diagnostics", open = false) {
            ToggleRow("Send usage events to the dashboard", "Latencies, lens, model, error class and state per event; random install and session ids. Never media, answers, questions, location or hardware ids.", diagOn) { diagOn = it; state.diag.enabled = it }
            Field(diagUrl, { diagUrl = it; state.diag.endpoint = it }, "https://…supabase.co/rest/v1/fieldnote_events")
            Field(diagToken, { diagToken = it; state.diag.token = it }, "publishable key", visual = PasswordVisualTransformation())
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(state.diag.lastStatus, style = MaterialTheme.typography.bodySmall, color = F.Muted)
                Ghost("Sync now", enabled = diagOn) { state.syncDiagnostics() }
            }
            HorizontalDivider(color = F.Line2)
            Text("Recent events (on this phone)", style = MaterialTheme.typography.titleMedium)
            val log = state.diag.recent().take(12)
            if (log.isEmpty()) Text("Nothing yet", style = MaterialTheme.typography.bodySmall, color = F.Muted)
            log.forEach { Text(it, style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp), color = F.Muted) }
        }
        Text("Fieldnote 3.1 · Meta DAT SDK 0.9.0 · Developer Mode build. Photos, chats and meals stay on this phone; only the images you ask about go to your model provider with your key.", style = MaterialTheme.typography.bodySmall, color = F.Muted, textAlign = TextAlign.Center)
    }
}

@Composable
fun Section(title: String, open: Boolean = true, content: @Composable () -> Unit) {
    var shown by remember(title) { mutableStateOf(open) }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 36.dp).clickable { shown = !shown }, horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Eyebrow(title); Text(if (shown) "Hide" else "Show", style = MaterialTheme.typography.labelLarge, color = F.Accent)
        }
        if (shown) Card(padding = PaddingValues(14.dp)) { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { content() } }
    }
}

@Composable
fun ModelPicker(label: String, current: String, options: List<String>, set: (String) -> Unit) {
    var open by remember(label) { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable { open = !open }, horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodyLarge); Text("${current.substringAfter('/')} ›", style = MaterialTheme.typography.bodyMedium, color = F.Muted)
    }
    if (open) Column(Modifier.padding(bottom = 6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { m ->
            Row(Modifier.fillMaxWidth().background(if (m == current) F.Accent.copy(alpha = 0.18f) else F.Bg, RoundedCornerShape(10.dp)).clickable { set(m); open = false }.padding(12.dp, 10.dp)) {
                Text(m, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun CheckRow(ok: Boolean, title: String, sub: String, action: String? = null, onAction: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.size(22.dp).background(if (ok) F.Teal else F.Amber, CircleShape), contentAlignment = Alignment.Center) { Text(if (ok) "✓" else "!", color = F.Bg, style = MaterialTheme.typography.labelLarge) }
        Column(Modifier.weight(1f)) { Text(title, style = MaterialTheme.typography.bodyLarge); Text(sub, style = MaterialTheme.typography.bodySmall, color = F.Muted) }
        if (action != null) Ghost(action) { onAction() }
    }
}

@Composable
private fun TestRow(id: String, title: String, result: String, enabled: Boolean, hint: String?, onRun: () -> Unit) {
    val (status, numbers) = result.split(":", limit = 2).let { it[0] to it.getOrElse(1) { "" } }
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        when (status) {
            "pass" -> Box(Modifier.size(22.dp).background(F.Teal, CircleShape), contentAlignment = Alignment.Center) { Text("✓", color = F.Bg, style = MaterialTheme.typography.labelLarge) }
            "fail" -> Box(Modifier.size(22.dp).background(F.Red, CircleShape), contentAlignment = Alignment.Center) { Text("✕", color = F.Bg, style = MaterialTheme.typography.labelLarge) }
            else -> Box(Modifier.size(22.dp).border(2.dp, F.Line, CircleShape))
        }
        Column(Modifier.weight(1f)) { Text("Test $id · $title", style = MaterialTheme.typography.bodyLarge); Text(numbers.ifBlank { hint ?: "Not run" }, style = MaterialTheme.typography.bodySmall, color = F.Muted) }
        Ghost(if (status == "notrun") "Run" else "Re-run", enabled = enabled) { onRun() }
    }
}

@Composable
private fun ManualTest(id: String, title: String, procedure: String, prefs: com.urmit.glasses.dev.data.Prefs, unlockNote: String? = null) {
    val r = prefs.testResult(id)
    var open by remember { mutableStateOf(false) }
    TestRow(id, title, r, enabled = true, hint = "Manual test") { open = !open }
    if (open) Column(Modifier.padding(start = 34.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(procedure, style = MaterialTheme.typography.bodySmall, color = F.Muted)
        if (unlockNote != null) Text(unlockNote, style = MaterialTheme.typography.bodySmall, color = F.Muted)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Ghost("Passed", Modifier.weight(1f)) { prefs.setTestResult(id, "pass:marked by hand"); open = false }
            Ghost("Failed", Modifier.weight(1f)) { prefs.setTestResult(id, "fail:marked by hand"); open = false }
        }
    }
}

@Composable
private fun ToggleRow(title: String, sub: String, on: Boolean, set: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { Text(title, style = MaterialTheme.typography.titleMedium); Text(sub, style = MaterialTheme.typography.bodySmall, color = F.Muted) }
        Switch(on, set, colors = SwitchDefaults.colors(checkedTrackColor = F.Accent, checkedThumbColor = F.Bg))
    }
}

@Composable
fun Field(value: String, onChange: (String) -> Unit, placeholder: String, keyboard: KeyboardType = KeyboardType.Text, minLines: Int = 1, visual: VisualTransformation = VisualTransformation.None) {
    OutlinedTextField(value, onChange, Modifier.fillMaxWidth(), placeholder = { Text(placeholder, color = F.Line) }, minLines = minLines, singleLine = minLines == 1, visualTransformation = visual,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboard), shape = RoundedCornerShape(12.dp), textStyle = MaterialTheme.typography.bodyMedium,
        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = F.Accent, unfocusedBorderColor = F.Line, focusedContainerColor = F.Bg, unfocusedContainerColor = F.Bg, cursorColor = F.Accent, focusedTextColor = F.Ink, unfocusedTextColor = F.Ink))
}
