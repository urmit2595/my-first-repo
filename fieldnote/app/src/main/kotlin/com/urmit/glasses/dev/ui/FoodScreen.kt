package com.urmit.glasses.dev.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.urmit.glasses.dev.data.Meal

/** Plateful, inside Fieldnote: today's totals, the meal log, and the last week. */
@Composable
fun FoodScreen(state: AppState, onOpenMeal: (String) -> Unit) {
    val meals by state.food.meals.collectAsState()
    val items by state.items.collectAsState(emptyList())
    state.prefs.version.collectAsState().value
    val today = dayStart(System.currentTimeMillis())
    val t = state.food.totals(today)
    val week = state.food.lastDays(7, today)
    val kcalTarget = state.prefs.kcalTarget; val protTarget = state.prefs.proteinTarget

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp, 24.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Food", style = MaterialTheme.typography.headlineLarge)
        Card(padding = PaddingValues(16.dp), radius = 20) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                Box(Modifier.size(110.dp), contentAlignment = Alignment.Center) {
                    Ring(t.kcalMid / kcalTarget.toFloat().coerceAtLeast(1f), F.Accent, 110.dp, 10.dp)
                    Ring(t.protein / protTarget.toFloat().coerceAtLeast(1f), F.Teal, 82.dp, 8.dp)
                    Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("${t.kcalMid}", style = MaterialTheme.typography.headlineMedium); Text("kcal", style = MaterialTheme.typography.bodySmall, color = F.Muted) }
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Eyebrow("Today")
                    Stat(F.Accent, "Calories", "${t.kcalMin}–${t.kcalMax} of $kcalTarget")
                    Stat(F.Teal, "Protein", "${t.protein} g of $protTarget g")
                    Text(when { t.meals == 0 -> "Nothing logged yet. Say \"log this meal\" to the glasses or tell Chat what you ate."; t.kcalMid > kcalTarget -> "Over target by ${t.kcalMid - kcalTarget} kcal."; else -> "${kcalTarget - t.kcalMid} kcal left today." }, style = MaterialTheme.typography.bodySmall, color = F.Muted)
                }
            }
        }
        Card(padding = PaddingValues(14.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Eyebrow("Last 7 days")
                val max = maxOf(week.maxOf { it.kcalMax }, kcalTarget, 1)
                Row(Modifier.fillMaxWidth().height(96.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
                    week.forEach { d ->
                        Column(Modifier.weight(1f).fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                            val h = (d.kcalMid / max.toFloat()).coerceIn(0.02f, 1f)
                            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.BottomCenter) {
                                Box(Modifier.fillMaxWidth(0.7f).fillMaxHeight(h).background(if (d.day == today) F.Accent else if (d.kcalMid > kcalTarget) F.Amber else F.Line, RoundedCornerShape(6.dp)))
                            }
                            Text(java.text.SimpleDateFormat("EEE", java.util.Locale.UK).format(d.day).take(2), style = MaterialTheme.typography.bodySmall, color = F.Muted)
                        }
                    }
                }
                val avg = week.filter { it.meals > 0 }.let { if (it.isEmpty()) 0 else it.sumOf { d -> d.kcalMid } / it.size }
                Text(if (avg == 0) "No meals logged this week yet." else "Average $avg kcal on days you logged. Target $kcalTarget.", style = MaterialTheme.typography.bodySmall, color = F.Muted)
            }
        }
        Eyebrow("Meals")
        if (meals.isEmpty()) Card { Text("Your meals will show up here. Take a photo of the plate and say \"log this meal\", or type what you ate in Chat.", style = MaterialTheme.typography.bodyMedium, color = F.Muted) }
        meals.groupBy { dayStart(it.eatenAt) }.forEach { (day, list) ->
            Text(dayLabel(day), style = MaterialTheme.typography.titleMedium, color = F.Muted)
            list.forEach { m -> MealRow(m, items.firstOrNull { it.key == m.photoKey }?.uri) { onOpenMeal(m.id) } }
        }
    }
}

@Composable
private fun Stat(c: androidx.compose.ui.graphics.Color, label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(8.dp).background(c, androidx.compose.foundation.shape.CircleShape))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = F.Muted); Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun Ring(fraction: Float, c: androidx.compose.ui.graphics.Color, size: androidx.compose.ui.unit.Dp, width: androidx.compose.ui.unit.Dp) {
    Canvas(Modifier.size(size)) {
        val w = width.toPx(); val s = Size(this.size.width - w, this.size.height - w); val o = Offset(w / 2, w / 2)
        drawArc(F.Line2, -90f, 360f, false, o, s, style = Stroke(w, cap = StrokeCap.Round))
        drawArc(c, -90f, 360f * fraction.coerceIn(0f, 1f), false, o, s, style = Stroke(w, cap = StrokeCap.Round))
    }
}

@Composable
fun MealRow(m: Meal, uri: android.net.Uri?, onClick: () -> Unit) {
    Card(onClick = onClick, padding = PaddingValues(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (uri != null) AsyncImage(model = uri, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(56.dp).clip(RoundedCornerShape(10.dp)))
            else Box(Modifier.size(56.dp).background(F.Tile, RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) { Text("🍽", style = MaterialTheme.typography.titleLarge) }
            Column(Modifier.weight(1f)) {
                Text(m.title.ifBlank { "Meal" }, style = MaterialTheme.typography.bodyLarge)
                Text("${timeLabel(m.eatenAt)} · ${m.proteinMid} g protein" + if (m.question.isNotBlank()) " · one question" else "", style = MaterialTheme.typography.bodySmall, color = if (m.question.isNotBlank()) F.Amber else F.Muted)
            }
            Column(horizontalAlignment = Alignment.End) { Text("${m.kcalMid}", style = MaterialTheme.typography.titleLarge); Text("kcal", style = MaterialTheme.typography.bodySmall, color = F.Muted) }
        }
    }
}

/** One meal: items, the open question, a note box that re-estimates, delete. */
@Composable
fun MealScreen(state: AppState, id: String, onOpenPhoto: (String) -> Unit, onBack: () -> Unit) {
    val meals by state.food.meals.collectAsState()
    val items by state.items.collectAsState(emptyList())
    val m = meals.firstOrNull { it.id == id }
    if (m == null) { Column(Modifier.padding(16.dp)) { Text("That meal was removed.", color = F.Muted); Ghost("Back") { onBack() } }; return }
    val uri = items.firstOrNull { it.key == m.photoKey }?.uri
    var note by remember { mutableStateOf("") }
    val busy by state.chat.busy.collectAsState()
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp, 16.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("‹ Food", style = MaterialTheme.typography.labelLarge, color = F.Accent, modifier = Modifier.clickable { onBack() })
            Text("Remove", style = MaterialTheme.typography.labelLarge, color = F.Red, modifier = Modifier.clickable { state.food.delete(m.id); onBack() })
        }
        if (uri != null) AsyncImage(model = uri, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(18.dp)).clickable { onOpenPhoto(m.photoKey) })
        Text(m.title, style = MaterialTheme.typography.headlineMedium)
        Text("${dayLabel(m.eatenAt)} ${timeLabel(m.eatenAt)} · ${m.confidence} confidence · ${m.model.substringAfter('/')}", style = MaterialTheme.typography.bodySmall, color = F.Muted)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Card(Modifier.weight(1f)) { Column { Eyebrow("Calories"); Text("${m.kcalMin}–${m.kcalMax}", style = MaterialTheme.typography.headlineMedium) } }
            Card(Modifier.weight(1f)) { Column { Eyebrow("Protein"); Text("${m.proteinMin}–${m.proteinMax} g", style = MaterialTheme.typography.headlineMedium) } }
        }
        if (m.items.isNotEmpty()) Card(padding = PaddingValues(14.dp, 4.dp)) {
            Column {
                m.items.forEachIndexed { i, it ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column(Modifier.weight(1f)) { Text(it.name, style = MaterialTheme.typography.bodyLarge); Text(it.quantity, style = MaterialTheme.typography.bodySmall, color = F.Muted) }
                        Text("${it.kcalMin}–${it.kcalMax} kcal · ${it.proteinG} g", style = MaterialTheme.typography.bodyMedium, color = F.Muted)
                    }
                    if (i < m.items.size - 1) HorizontalDivider(color = F.Line2)
                }
            }
        }
        if (m.question.isNotBlank()) Card { Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { Eyebrow("One question"); Text(m.question, style = MaterialTheme.typography.bodyLarge, color = F.Amber) } }
        if (m.note.isNotBlank()) Text("You said: “${m.note}”", style = MaterialTheme.typography.bodyMedium, color = F.Ink2)
        Eyebrow("Correct it")
        Field(note, { note = it }, if (m.question.isNotBlank()) "Answer the question or fix the portions" else "e.g. it was three rotis, no ghee", minLines = 2)
        Primary(if (busy) "Working…" else "Update estimate", Modifier.fillMaxWidth(), enabled = note.isNotBlank() && !busy) { state.correctMeal(m, note); note = "" }
        Spacer(Modifier.height(8.dp))
    }
}
