package com.urmit.glasses.dev.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.urmit.glasses.dev.R

object F {
    val Bg = Color(0xFF141416)
    val Bar = Color(0xFF1A1B1D)
    val Card = Color(0xFF1F2022)
    val Card2 = Color(0xFF222326)
    val Line = Color(0xFF34363A)
    val Line2 = Color(0xFF2C2E32)
    val Ink = Color(0xFFF3F0E9)
    val Ink2 = Color(0xFFD6D1C7)
    val Muted = Color(0xFFA39E94)
    val Accent = Color(0xFFE8742C)
    val Teal = Color(0xFF5FB3A6)
    val Amber = Color(0xFFE9A23B)
    val Red = Color(0xFFD9574A)
    val Tile = Color(0xFF2A2C30)
}

@OptIn(ExperimentalTextApi::class)
val Display = FontFamily(
    Font(R.font.bricolage, FontWeight.Medium, variationSettings = FontVariation.Settings(FontVariation.weight(500), FontVariation.Setting("opsz", 48f))),
    Font(R.font.bricolage, FontWeight.SemiBold, variationSettings = FontVariation.Settings(FontVariation.weight(600), FontVariation.Setting("opsz", 48f)))
)

@OptIn(ExperimentalTextApi::class)
val Body = FontFamily(
    Font(R.font.plex, FontWeight.Normal, variationSettings = FontVariation.Settings(FontVariation.weight(400))),
    Font(R.font.plex, FontWeight.Medium, variationSettings = FontVariation.Settings(FontVariation.weight(500))),
    Font(R.font.plex, FontWeight.SemiBold, variationSettings = FontVariation.Settings(FontVariation.weight(600)))
)

@Composable
fun FieldnoteTheme(content: @Composable () -> Unit) {
    val scheme = darkColorScheme(primary = F.Accent, onPrimary = F.Bg, background = F.Bg, onBackground = F.Ink, surface = F.Card, onSurface = F.Ink, surfaceVariant = F.Card2, onSurfaceVariant = F.Muted, outline = F.Line, error = F.Red)
    val b = MaterialTheme.typography
    MaterialTheme(colorScheme = scheme, typography = b.copy(
        headlineLarge = b.headlineLarge.copy(fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 30.sp, lineHeight = 34.sp),
        headlineMedium = b.headlineMedium.copy(fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 26.sp, lineHeight = 30.sp),
        titleLarge = b.titleLarge.copy(fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 20.sp),
        titleMedium = b.titleMedium.copy(fontFamily = Body, fontWeight = FontWeight.SemiBold, fontSize = 15.sp),
        bodyLarge = b.bodyLarge.copy(fontFamily = Body, fontSize = 15.sp, lineHeight = 22.sp),
        bodyMedium = b.bodyMedium.copy(fontFamily = Body, fontSize = 14.sp, lineHeight = 20.sp),
        bodySmall = b.bodySmall.copy(fontFamily = Body, fontSize = 12.sp, lineHeight = 16.sp),
        labelLarge = b.labelLarge.copy(fontFamily = Body, fontWeight = FontWeight.SemiBold, fontSize = 14.sp),
        labelMedium = b.labelMedium.copy(fontFamily = Body, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = 1.sp),
        labelSmall = b.labelSmall.copy(fontFamily = Body, fontSize = 11.sp)
    )) {
        androidx.compose.material3.Surface(color = F.Bg, contentColor = F.Ink, modifier = Modifier.fillMaxSize()) { content() }
    }
}

@Composable
fun Card(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, padding: PaddingValues = PaddingValues(14.dp), radius: Int = 16, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(radius.dp)
    var m = modifier.fillMaxWidth().background(F.Card, shape).border(1.dp, F.Line, shape)
    if (onClick != null) m = m.clickable(onClick = onClick)
    Box(m.padding(padding)) { content() }
}

@Composable
fun Primary(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Button(onClick, modifier.heightIn(min = 48.dp), enabled = enabled, shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = F.Accent, contentColor = F.Bg, disabledContainerColor = F.Line, disabledContentColor = F.Muted)) {
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun Ghost(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    OutlinedButton(onClick, modifier.heightIn(min = 44.dp), enabled = enabled, shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, F.Line),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.Transparent, contentColor = F.Ink, disabledContentColor = F.Muted)) {
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun Chip(text: String, on: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    Box(Modifier.heightIn(min = 36.dp).background(if (on) F.Ink else Color.Transparent, shape).border(1.dp, if (on) F.Ink else F.Line, shape).clickable(onClick = onClick).padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.labelLarge.copy(fontSize = 13.sp), color = if (on) F.Bg else F.Ink)
    }
}

@Composable
fun Eyebrow(text: String) = Text(text.uppercase(), style = MaterialTheme.typography.labelMedium, color = F.Muted)
