package com.urmit.glasses.dev.ui

import android.app.Activity
import android.speech.tts.TextToSpeech
import android.view.Window
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.urmit.glasses.dev.data.EmergencyNumbers
import com.urmit.glasses.dev.data.OfflinePack
import com.urmit.glasses.dev.data.Pack
import com.urmit.glasses.dev.data.Phrase
import com.urmit.glasses.dev.data.Trip
import com.urmit.glasses.dev.data.TripItem
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

/* Cards are shown to someone else, often in daylight: white, near-black, very large type, screen at full brightness. */
private val Paper = Color.White
private val Ink0 = Color(0xFF111111)
private val Grey = Color(0xFF5C5C5C)
private val Rule = Color(0xFFE3E3E3)
private val Soft = Color(0xFFF1F1F1)

/** Full-screen card: "driver" (the stay, or booking [itemId]), "allergy", "phrases" or "emergency". */
@Composable
fun CardScreen(state: AppState, kind: String, itemId: String, onClose: () -> Unit) {
    val trips by state.trips.collectAsState()
    state.travelReady.collectAsState().value
    state.prefs.version.collectAsState().value
    val itemTrip = if (itemId.isBlank()) null else trips.firstOrNull { t -> t.items.any { it.id == itemId } }
    val trip = itemTrip ?: state.currentTrip()
    val stay = state.currentStay()
    val item = itemTrip?.items?.firstOrNull { it.id == itemId } ?: stay
    val pack by produceState<Pack?>(null, trip?.id) { value = trip?.let { state.packFor(it.id) } }
    val lang = trip?.language?.ifBlank { null } ?: pack?.language?.ifBlank { null } ?: "en"
    val speech = rememberSpeech(lang)
    val scroll = rememberScrollState()
    // The large phrase by its text, so it survives turning the phone to show it; a different card (the same screen reused
    // for "take me home") starts on its own content.
    var bigLocal by rememberSaveable(kind, itemId) { mutableStateOf<String?>(null) }
    val big = bigLocal?.let { l -> pack?.phrases?.firstOrNull { it.local == l } }
    KeepBright()
    BackHandler(enabled = big != null) { bigLocal = null }

    CompositionLocalProvider(LocalContentColor provides Ink0) {
        val shown = big
        if (shown != null) BigPhrase(shown, speech) { bigLocal = null }
        else Column(Modifier.fillMaxSize().background(Paper).verticalScroll(scroll).padding(20.dp, 12.dp, 20.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                CloseButton(onClose)
                Text(when (kind) { "driver" -> "For the driver"; "allergy" -> "Allergy card"; "phrases" -> "Phrases"; "emergency" -> "Emergency"; else -> "Card" }, fontSize = 18.sp, color = Grey)
            }
            when (kind) {
                "driver" -> DriverCard(state, item, pack, lang, speech)
                "allergy" -> AllergyCard(state, pack, lang, speech)
                "phrases" -> PhrasesCard(pack, lang, speech) { bigLocal = it.local }
                "emergency" -> EmergencyCard(state, trip, stay)
                else -> Say("There's no card called “$kind”.", 26.sp)
            }
        }
    }
}

@Composable
private fun DriverCard(state: AppState, item: TripItem?, pack: Pack?, lang: String, speech: Speech) {
    val ctx = LocalContext.current
    if (item == null) {
        Say("No stay saved yet", 30.sp, bold = true)
        Say("Share your hotel booking with Fieldnote (Add to trip) and its address shows here, ready for a driver.", 18.sp, Grey)
        return
    }
    val name = item.place.ifBlank { item.title }
    val local = item.addressLocal
    Say(name, 22.sp, Grey)
    Say(local.ifBlank { item.address.ifBlank { name } }, 40.sp, bold = true, lineHeight = 50.sp)
    if (local.isNotBlank() && item.address.isNotBlank()) Say(item.address, 20.sp, Grey, lineHeight = 27.sp)
    val request = pack?.driverRequestLocal.orEmpty()
    if (request.isNotBlank() || pack?.driverRequestEn.orEmpty().isNotBlank()) HorizontalDivider(color = Rule)
    if (request.isNotBlank()) Say(request, 28.sp, lineHeight = 36.sp)
    pack?.driverRequestEn?.takeIf { it.isNotBlank() }?.let { Say(it, 16.sp, Grey) }
    if (local.isBlank() && !lang.startsWith("en")) Say("Prepare the offline pack on the Trip tab to get this address in ${langName(lang)}.", 15.sp, Grey)
    if (item.phone.isNotBlank()) Text(item.phone, fontSize = 26.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.heightIn(min = 48.dp).clickable { dial(ctx, state, item.phone) })
    val words = listOf(request, local).filter { it.isNotBlank() }.joinToString(". ")
        .ifBlank { if (lang.startsWith("en")) listOf(pack?.driverRequestEn.orEmpty(), item.address).filter { it.isNotBlank() }.joinToString(". ") else "" }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        if (words.isNotBlank()) SpeakButton(speech, words, Modifier.weight(1f))
        CardButton("Navigate", Modifier.weight(1f), filled = words.isBlank()) { openMaps(ctx, state, item) }
    }
    VoiceNote(speech, words.isNotBlank())
}

@Composable
private fun AllergyCard(state: AppState, pack: Pack?, lang: String, speech: Speech) {
    val p = state.prefs
    // Written from the profile as it was: once the diet or allergies change, show what the profile says now instead.
    val stale = pack != null && pack.allergyStale(p)
    val local = pack?.allergyLocal.orEmpty()
    if (local.isNotBlank()) {
        // Even when out of date the translation stays: offline, a waiter can't read the English below it.
        Say(local, 34.sp, bold = true, lineHeight = 44.sp)
        pack?.allergyEn?.takeIf { it.isNotBlank() }?.let { Say(it, 20.sp, Grey, lineHeight = 27.sp) }
        if (stale) {
            Say("Written before your last profile change, so it may be out of date. Your profile now:", 16.sp, Color(0xFF9A5B00), bold = true, lineHeight = 22.sp)
            if (p.allergies.isNotBlank()) Say("Allergies: ${p.allergies}", 18.sp, lineHeight = 24.sp)
            if (p.diet.isNotBlank()) Say("Diet: ${p.diet}", 18.sp, lineHeight = 24.sp)
            Say("Refresh the offline pack when you have data.", 15.sp, Grey)
        }
        SpeakButton(speech, local, Modifier.fillMaxWidth())
        VoiceNote(speech, true)
        return
    }
    if (p.allergies.isBlank() && p.diet.isBlank()) {
        Say("No allergies or diet saved", 30.sp, bold = true)
        Say("Add them on the Trip tab, under Traveller profile.", 18.sp, Grey)
        return
    }
    if (p.allergies.isNotBlank()) Say("I am allergic to: ${p.allergies}", 30.sp, bold = true, lineHeight = 40.sp)
    if (p.diet.isNotBlank()) Say("My diet: ${p.diet}", 24.sp, lineHeight = 32.sp)
    if (stale) Say("Your diet or allergies changed since this card was written. Refresh the offline pack.", 16.sp, Grey, bold = true, lineHeight = 22.sp)
    else if (!lang.startsWith("en")) Say("Prepare the offline pack on the Trip tab to get this in ${langName(lang)}.", 15.sp, Grey)
}

@Composable
private fun PhrasesCard(pack: Pack?, lang: String, speech: Speech, onBig: (Phrase) -> Unit) {
    val phrases = pack?.phrases.orEmpty()
    if (phrases.isEmpty()) {
        Say("No phrases yet", 30.sp, bold = true)
        Say(if (lang.startsWith("en")) "This trip's language is English, so there are no phrases to prepare."
            else "Prepare the offline pack on the Trip tab, on Wi-Fi, to get phrases in ${langName(lang)}.", 18.sp, Grey)
        return
    }
    val order = listOf("taxi", "hotel", "restaurant", "pharmacy", "shop", "help")
    val situations = order.filter { s -> phrases.any { it.situation == s } } + phrases.map { it.situation }.distinct().filter { it !in order }
    var picked by rememberSaveable { mutableStateOf("") }
    val sel = picked.takeIf { it in situations } ?: situations.first()
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        situations.forEach { s -> LightChip(s.replaceFirstChar { it.uppercase() }, s == sel) { picked = s } }
    }
    Say("Tap a phrase to show it large.", 14.sp, Grey)
    Column {
        phrases.filter { it.situation == sel }.forEach { p ->
            Column(Modifier.fillMaxWidth().clickable { onBig(p) }.padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Say(p.local, 26.sp, bold = true, lineHeight = 34.sp)
                if (p.roman.isNotBlank()) Say(p.roman, 18.sp, Ink0.copy(alpha = 0.75f))
                Say(p.en, 14.sp, Grey)
            }
            HorizontalDivider(color = Rule)
        }
    }
    VoiceNote(speech, true)
}

@Composable
private fun BigPhrase(p: Phrase, speech: Speech, onDone: () -> Unit) {
    Column(Modifier.fillMaxSize().background(Paper).padding(20.dp, 12.dp, 20.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        CloseButton(onDone)
        Spacer(Modifier.weight(1f))
        Text(p.local, fontSize = 48.sp, lineHeight = 60.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        if (p.roman.isNotBlank()) Text(p.roman, fontSize = 22.sp, lineHeight = 28.sp, textAlign = TextAlign.Center, color = Ink0.copy(alpha = 0.75f), modifier = Modifier.fillMaxWidth())
        Text(p.en, fontSize = 18.sp, textAlign = TextAlign.Center, color = Grey, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.weight(1f))
        SpeakButton(speech, p.local, Modifier.fillMaxWidth())
        VoiceNote(speech, true)
    }
}

@Composable
private fun EmergencyCard(state: AppState, trip: Trip?, stay: TripItem?) {
    val ctx = LocalContext.current
    // Where the phone is now (last named place), else the trip's country: numbers must match the country you're standing in.
    val country = remember { com.urmit.glasses.dev.data.TravelActions.countryNow(ctx) }.ifBlank { trip?.country.orEmpty() }
    val nums = OfflinePack.emergency(country)
    val where = if (country.isBlank()) "" else Locale("", country).getDisplayCountry(Locale.UK).ifBlank { country }
    if (where.isNotBlank()) Say(where, 22.sp, Grey)
    if (nums == null) {
        Say(if (country.isBlank()) "No trip saved, so no country to look up" else "No built-in numbers for $where", 28.sp, bold = true, lineHeight = 36.sp)
        Say("Ask your hotel or someone nearby for the local emergency number.", 18.sp, Grey)
    } else numberRows(nums).forEach { (label, n) ->
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable { dial(ctx, state, n) }.padding(vertical = 4.dp)) {
            Say(label, 18.sp, Grey)
            Text(n, fontSize = 64.sp, lineHeight = 70.sp, fontWeight = FontWeight.Bold)
        }
    }
    val contacts = state.prefs.emergencyContacts.split(';', '\n').map { it.trim() }.filter { it.isNotBlank() }
    if (contacts.isNotEmpty()) {
        HorizontalDivider(color = Rule)
        Say("My emergency contacts", 16.sp, Grey)
        contacts.forEach { c ->
            val number = PHONE.find(c)?.value?.trim()
            val name = if (number == null) c else c.replace(number, "").trim(' ', ',', ':', '-')
            Column(Modifier.fillMaxWidth().then(if (number != null) Modifier.clickable { dial(ctx, state, number) } else Modifier).padding(vertical = 4.dp)) {
                if (name.isNotBlank()) Say(name, 20.sp)
                if (number != null) Text(number, fontSize = 28.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
    if (stay != null) {
        HorizontalDivider(color = Rule)
        Say("Staying at", 16.sp, Grey)
        Say(stay.place.ifBlank { stay.title }, 22.sp, bold = true)
        stay.addressLocal.takeIf { it.isNotBlank() }?.let { Say(it, 22.sp, lineHeight = 30.sp) }
        if (stay.address.isNotBlank()) Say(stay.address, 18.sp, Grey, lineHeight = 24.sp)
        if (stay.phone.isNotBlank()) Text(stay.phone, fontSize = 22.sp, modifier = Modifier.heightIn(min = 44.dp).clickable { dial(ctx, state, stay.phone) })
    }
    Say("Built-in numbers. Confirm locally.", 13.sp, Grey)
}

private val PHONE = Regex("""\+?\d[\d ()-]{5,}\d""")

/** "All emergencies 112", then police, ambulance and fire, sharing a line when they share a number. */
private fun numberRows(n: EmergencyNumbers): List<Pair<String, String>> = buildList {
    if (n.general.isNotBlank()) add("All emergencies" to n.general)
    listOf("Police" to n.police, "Ambulance" to n.ambulance, "Fire" to n.fire).filter { it.second.isNotBlank() && it.second != n.general }
        .groupBy { it.second }.forEach { (num, names) -> add(names.joinToString(" and ") { it.first }.lowercase().replaceFirstChar { it.uppercase() } to num) }
}

/* ---------------- pieces ---------------- */

@Composable
private fun Say(text: String, size: TextUnit, color: Color = Ink0, bold: Boolean = false, lineHeight: TextUnit = TextUnit.Unspecified) =
    Text(text, fontSize = size, lineHeight = lineHeight, color = color, fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal)

@Composable
private fun CloseButton(onClick: () -> Unit) {
    Box(Modifier.size(48.dp).clip(CircleShape).background(Soft).clickable(onClickLabel = "Close", onClick = onClick), contentAlignment = Alignment.Center) {
        Text("×", fontSize = 30.sp, color = Ink0)
    }
}

@Composable
private fun CardButton(text: String, modifier: Modifier = Modifier, filled: Boolean = true, enabled: Boolean = true, onClick: () -> Unit) {
    Button(onClick, modifier.heightIn(min = 56.dp), enabled = enabled, shape = RoundedCornerShape(14.dp), border = if (filled) null else BorderStroke(1.5.dp, Ink0),
        colors = if (filled) ButtonDefaults.buttonColors(containerColor = Ink0, contentColor = Paper, disabledContainerColor = Rule, disabledContentColor = Grey)
        else ButtonDefaults.buttonColors(containerColor = Paper, contentColor = Ink0, disabledContainerColor = Paper, disabledContentColor = Grey)) {
        Text(text, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun LightChip(text: String, on: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(22.dp)
    Box(Modifier.heightIn(min = 44.dp).background(if (on) Ink0 else Paper, shape).border(1.5.dp, Ink0, shape).clip(shape).clickable(onClick = onClick).padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
        Text(text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = if (on) Paper else Ink0)
    }
}

/** Cards up per window. Two can be composed at once during NavHost's fade, so the last one to close restores the window. */
private val brightCards = java.util.WeakHashMap<Window, Int>()

/** Full brightness and screen on while a card is up; both restored when the last card closes. */
@Composable
private fun KeepBright() {
    val activity = LocalContext.current as? Activity ?: return
    DisposableEffect(activity) {
        val w = activity.window
        val n = (brightCards[w] ?: 0) + 1
        brightCards[w] = n
        if (n == 1) {
            w.attributes = w.attributes.also { it.screenBrightness = 1f }
            w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        onDispose {
            val left = (brightCards[w] ?: 1) - 1
            if (left > 0) brightCards[w] = left
            else {
                brightCards.remove(w)
                w.attributes = w.attributes.also { it.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE }
                w.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }
}

/* ---------------- text to speech in the trip's language ---------------- */

private class Speech(val locale: Locale, private val scope: CoroutineScope) {
    var tts: TextToSpeech? = null
    var status by mutableIntStateOf(LOADING)
    fun say(text: String) {
        val t = tts ?: return
        if (text.isBlank()) return
        scope.launch(Dispatchers.IO) { runCatching { t.speak(text, TextToSpeech.QUEUE_FLUSH, null, "card") } }
    }
    companion object { const val LOADING = 0; const val READY = 1; const val NO_VOICE = 2; const val FAILED = 3 }
}

/** The engine binds asynchronously; the language check runs off the main thread. Released when the card closes. */
@Composable
private fun rememberSpeech(lang: String): Speech {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val s = remember(lang) { Speech(Locale.forLanguageTag(lang), scope) }
    DisposableEffect(s) {
        var gone = false
        var engine: TextToSpeech? = null
        engine = TextToSpeech(ctx.applicationContext) { status ->
            if (gone) return@TextToSpeech
            if (status != TextToSpeech.SUCCESS) { s.status = Speech.FAILED; return@TextToSpeech }
            scope.launch(Dispatchers.IO) {
                val t = engine ?: return@launch
                val a = runCatching { t.isLanguageAvailable(s.locale) }.getOrDefault(TextToSpeech.LANG_NOT_SUPPORTED)
                if (a >= TextToSpeech.LANG_AVAILABLE) runCatching { t.language = s.locale; t.setSpeechRate(0.9f) }
                withContext(Dispatchers.Main) { if (!gone) { s.tts = t; s.status = if (a >= TextToSpeech.LANG_AVAILABLE) Speech.READY else Speech.NO_VOICE } }
            }
        }
        onDispose { gone = true; s.tts = null; runCatching { engine?.stop(); engine?.shutdown() } }
    }
    return s
}

@Composable
private fun SpeakButton(speech: Speech, text: String, modifier: Modifier = Modifier) {
    CardButton(if (speech.status == Speech.LOADING) "Speak…" else "Speak", modifier, enabled = speech.status == Speech.READY && text.isNotBlank()) { speech.say(text) }
}

@Composable
private fun VoiceNote(speech: Speech, relevant: Boolean) {
    if (!relevant) return
    when (speech.status) {
        Speech.NO_VOICE -> Say("No voice for this language on this phone", 14.sp, Grey)
        Speech.FAILED -> Say("Text to speech isn't working on this phone", 14.sp, Grey)
    }
}
