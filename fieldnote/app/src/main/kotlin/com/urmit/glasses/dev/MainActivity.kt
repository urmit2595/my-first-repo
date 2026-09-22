package com.urmit.glasses.dev

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.urmit.glasses.dev.service.Bus
import com.urmit.glasses.dev.service.FieldService
import com.urmit.glasses.dev.service.SessionState
import com.urmit.glasses.dev.ui.AppState
import com.urmit.glasses.dev.ui.Card
import com.urmit.glasses.dev.ui.DetailScreen
import com.urmit.glasses.dev.ui.F
import com.urmit.glasses.dev.ui.FieldnoteTheme
import com.urmit.glasses.dev.ui.GalleryScreen
import com.urmit.glasses.dev.ui.GlassesScreen
import com.urmit.glasses.dev.ui.Primary
import com.urmit.glasses.dev.ui.ChatScreen
import com.urmit.glasses.dev.ui.FoodScreen
import com.urmit.glasses.dev.ui.MealScreen

class MainActivity : ComponentActivity() {
    private lateinit var state: AppState
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        state = AppState(this)
        state.start()
        setContent { FieldnoteTheme { Root(state) } }
    }
    override fun onResume() { super.onResume(); state.refresh() }
}

private val tabs = listOf("chat" to "Chat", "gallery" to "Photos", "food" to "Food", "glasses" to "Glasses")
private val PERMS = arrayOf(android.Manifest.permission.BLUETOOTH_CONNECT, android.Manifest.permission.RECORD_AUDIO, android.Manifest.permission.POST_NOTIFICATIONS, android.Manifest.permission.READ_MEDIA_IMAGES, android.Manifest.permission.READ_MEDIA_VIDEO)

@Composable
fun Root(state: AppState) {
    val nav = rememberNavController()
    val ctx = LocalContext.current
    val toast by state.toast.collectAsState()
    state.prefs.version.collectAsState().value
    LaunchedEffect(toast) { toast?.let { Toast.makeText(ctx, it, Toast.LENGTH_SHORT).show(); state.toast.value = null } }
    val perms = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { state.refresh() }
    LaunchedEffect(Unit) {
        // Never show armed when it is not (brief §4.1): a persisted armed flag with no live service means Android killed it.
        if (state.prefs.armedPersisted && Bus.state.value == SessionState.DISARMED) { state.prefs.armedPersisted = false; Bus.lastError.value = "Session was ended by Android. Arm again."; state.toast.value = "Session was ended by Android. Arm again." }
    }
    LaunchedEffect(Unit) { if (PERMS.any { ctx.checkSelfPermission(it) != android.content.pm.PackageManager.PERMISSION_GRANTED }) perms.launch(PERMS) }

    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route ?: "chat"
    val start = if (state.prefs.onboarded) "chat" else "welcome"
    val st by Bus.state.collectAsState()

    fun arm() {
        val missing = PERMS.filter { ctx.checkSelfPermission(it) != android.content.pm.PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) { state.toast.value = "Grant permissions first"; perms.launch(missing.toTypedArray()); return }
        if (state.prefs.apiKey.isBlank()) state.toast.value = "No API key yet: photos will save, but there'll be no answers"
        FieldService.arm(ctx)
    }

    Column(Modifier.fillMaxSize().background(F.Bg).statusBarsPadding()) {
        Box(Modifier.weight(1f)) {
            NavHost(nav, startDestination = start) {
                composable("welcome") { Welcome(state) { state.prefs.onboarded = true; nav.navigate("chat") { popUpTo("welcome") { inclusive = true } } } }
                composable("chat") { ChatScreen(state, { nav.navigate("detail/${android.net.Uri.encode(it)}") }, { nav.navigate("meal/$it") }) { nav.navigate("glasses") { launchSingleTop = true } } }
                composable("gallery") { GalleryScreen(state, { nav.navigate("detail/${android.net.Uri.encode(it)}") }) { nav.navigate("glasses") { launchSingleTop = true } } }
                composable("food") { FoodScreen(state) { nav.navigate("meal/$it") } }
                composable("glasses") { GlassesScreen(state, { nav.navigate("detail/${android.net.Uri.encode(it)}") }) { arm() } }
                composable("detail/{key}") { DetailScreen(state, android.net.Uri.decode(it.arguments?.getString("key") ?: ""), { nav.navigate("meal/$it") }) { nav.popBackStack() } }
                composable("meal/{id}") { MealScreen(state, it.arguments?.getString("id") ?: "", { k -> nav.navigate("detail/${android.net.Uri.encode(k)}") }) { nav.popBackStack() } }
            }
        }
        if (tabs.any { it.first == route }) Column(Modifier.fillMaxWidth().background(F.Bar).navigationBarsPadding()) {
            HorizontalDivider(color = F.Line2)
            Row(Modifier.fillMaxWidth().padding(12.dp, 8.dp, 12.dp, 10.dp), horizontalArrangement = Arrangement.SpaceAround) {
                tabs.forEach { (r, label) ->
                    val on = r == route
                    val c = if (on) F.Accent else F.Muted
                    Column(Modifier.widthIn(min = 80.dp).heightIn(min = 48.dp).clickable { nav.navigate(r) { popUpTo("chat") { saveState = true }; launchSingleTop = true; restoreState = true } }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        TabIcon(r, c, st)
                        Text(label, fontSize = 12.sp, color = c, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun TabIcon(route: String, c: Color, st: SessionState) {
    Canvas(Modifier.size(24.dp)) {
        val s = Stroke(width = 1.75.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
        val u = size.width / 24f
        when (route) {
            "gallery" -> listOf(4f to 4f, 13f to 4f, 4f to 13f, 13f to 13f).forEach { (x, y) -> drawRoundRect(c, Offset(x * u, y * u), androidx.compose.ui.geometry.Size(7 * u, 7 * u), androidx.compose.ui.geometry.CornerRadius(1.5f * u), style = s) }
            "chat" -> { val p = Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(3f * u, 4f * u, 21f * u, 17f * u, androidx.compose.ui.geometry.CornerRadius(4f * u))); moveTo(7f * u, 17f * u); lineTo(7f * u, 21f * u); lineTo(11f * u, 17f * u) }; drawPath(p, c, style = s) }
            "food" -> { drawCircle(c, 8 * u, Offset(12 * u, 12 * u), style = s); drawCircle(c, 4 * u, Offset(12 * u, 12 * u), style = s) }
            "glasses" -> {
                drawCircle(c, 3.5f * u, Offset(7 * u, 13 * u), style = s); drawCircle(c, 3.5f * u, Offset(17 * u, 13 * u), style = s)
                drawLine(c, Offset(10.5f * u, 12.5f * u), Offset(13.5f * u, 12.5f * u), s.width, StrokeCap.Round)
                val p = Path().apply { moveTo(3.5f * u, 12 * u); lineTo(5.5f * u, 7 * u); lineTo(18.5f * u, 7 * u); lineTo(20.5f * u, 12 * u) }
                drawPath(p, c, style = s)
                if (st != SessionState.DISARMED) drawCircle(F.Teal, 2.5f * u, Offset(20 * u, 4 * u))
            }
            else -> {
                drawCircle(c, 3.5f * u, Offset(7 * u, 13 * u), style = s); drawCircle(c, 3.5f * u, Offset(17 * u, 13 * u), style = s)
                drawLine(c, Offset(10.5f * u, 12.5f * u), Offset(13.5f * u, 12.5f * u), s.width, StrokeCap.Round)
                val p = Path().apply { moveTo(3.5f * u, 12 * u); lineTo(5.5f * u, 7 * u); lineTo(18.5f * u, 7 * u); lineTo(20.5f * u, 12 * u) }
                drawPath(p, c, style = s)
            }
        }
    }
}

@Composable
private fun Welcome(state: AppState, onDone: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(24.dp, 40.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text("Fieldnote", style = MaterialTheme.typography.headlineLarge)
        Text("Your glasses, with a brain. Start a session, pocket the phone, and just tap or talk: what am I looking at, read this menu, log this meal, how much have I eaten today. Everything lands in Chat, Photos and Food.", style = MaterialTheme.typography.bodyLarge, color = F.Ink2)
        Card(padding = PaddingValues(16.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Step("1", "Allow the permissions when asked (Bluetooth, microphone, notifications, photos).")
                Step("2", "Glasses tab → Setup → Link the glasses. Developer Mode must be on in the Meta AI app.")
                Step("3", "Glasses tab → Answers → paste your OpenRouter key and tap Test key.")
                Step("4", "Glasses tab → Start session. Then tap the glasses once for a photo, twice for an answer, three times to ask anything.")
            }
        }
        Spacer(Modifier.weight(1f))
        Primary("Let's go", Modifier.fillMaxWidth()) { onDone() }
    }
}

@Composable
private fun Step(n: String, text: String) {
    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(n, style = MaterialTheme.typography.titleLarge, color = F.Accent)
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}
