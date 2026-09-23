package com.urmit.glasses.dev

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
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
import androidx.core.content.IntentCompat
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.urmit.glasses.dev.data.Locator
import com.urmit.glasses.dev.data.TravelActions
import com.urmit.glasses.dev.service.Bus
import com.urmit.glasses.dev.service.FieldService
import com.urmit.glasses.dev.service.SessionState
import com.urmit.glasses.dev.service.TravelSession
import com.urmit.glasses.dev.ui.AppState
import com.urmit.glasses.dev.ui.Card
import com.urmit.glasses.dev.ui.CardScreen
import com.urmit.glasses.dev.ui.DetailScreen
import com.urmit.glasses.dev.ui.F
import com.urmit.glasses.dev.ui.FieldnoteTheme
import com.urmit.glasses.dev.ui.GalleryScreen
import com.urmit.glasses.dev.ui.GlassesScreen
import com.urmit.glasses.dev.ui.ImportScreen
import com.urmit.glasses.dev.ui.LOCATION_ASKED
import com.urmit.glasses.dev.ui.LOCATION_PERMS
import com.urmit.glasses.dev.ui.PERMS_ASKED
import com.urmit.glasses.dev.ui.missingPerms
import com.urmit.glasses.dev.ui.rememberPermsAsk
import com.urmit.glasses.dev.ui.TripScreen
import com.urmit.glasses.dev.ui.UI_PREFS
import com.urmit.glasses.dev.ui.Primary
import com.urmit.glasses.dev.ui.ChatScreen
import com.urmit.glasses.dev.ui.FoodScreen
import com.urmit.glasses.dev.ui.MealScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    private lateinit var state: AppState
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The process's one AppState: a rotation gets the same one back, with the pending share and any work in flight.
        state = AppState.get(this)
        // Not again after a rotation: the same intent comes back and the share was already taken in.
        if (savedInstanceState == null) handle(intent)
        setContent { FieldnoteTheme { Root(state) } }
    }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); handle(intent) }
    override fun onResume() {
        super.onResume(); visible = true; state.resumed.value = true; state.permTick.value = state.permTick.value + 1; state.refresh()
        // Location allowed while a session runs (from a row here or in Settings): the session starts using it. No-op otherwise.
        if (Locator.permitted(this)) FieldService.send(this, FieldService.ACT_LOCATION)
    }
    override fun onPause() { visible = false; state.resumed.value = false; super.onPause() }

    /** A card from the session's notification, or bookings shared from another app ("Add to trip"). */
    private fun handle(i: Intent?) {
        // Reopened from Recents: the original intent comes back, but its share grant is gone and the card was seen.
        if (i == null || i.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0) return
        i.getStringExtra(EXTRA_CARD)?.let { k ->
            i.removeExtra(EXTRA_CARD)
            if (k in TravelActions.CARDS) { TravelActions.cardRequest.value = null; state.go("card/$k") }
            return
        }
        if (i.action != Intent.ACTION_SEND && i.action != Intent.ACTION_SEND_MULTIPLE) return
        val subject = i.getStringExtra(Intent.EXTRA_SUBJECT).orEmpty().trim()
        val body = i.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString().orEmpty().trim()
        val text = if (subject.isNotBlank() && !body.startsWith(subject)) "$subject\n\n$body".trim() else body
        val uris = buildList<Uri> {
            if (i.action == Intent.ACTION_SEND) IntentCompat.getParcelableExtra(i, Intent.EXTRA_STREAM, Uri::class.java)?.let { add(it) }
            else IntentCompat.getParcelableArrayListExtra(i, Intent.EXTRA_STREAM, Uri::class.java)?.let { addAll(it) }
            if (isEmpty()) i.clipData?.let { c -> for (n in 0 until c.itemCount) c.getItemAt(n).uri?.let { add(it) } }
        }
        state.receiveShare(text, uris, i.type)
        state.go("import")
    }
    companion object {
        /** True while the app is on screen; the session then leaves showing cards to the app instead of notifying. */
        @Volatile var visible = false
        /** Intent extra naming a card to open full screen ("driver", "allergy", "phrases", "emergency"). */
        const val EXTRA_CARD = "card"
    }
}

private val tabs = listOf("chat" to "Chat", "gallery" to "Photos", "trip" to "Trip", "food" to "Food", "glasses" to "Glasses")

@Composable
fun Root(state: AppState) {
    val nav = rememberNavController()
    val ctx = LocalContext.current
    val toast by state.toast.collectAsState()
    state.prefs.version.collectAsState().value
    LaunchedEffect(toast) { toast?.let { Toast.makeText(ctx, it, Toast.LENGTH_SHORT).show(); state.toast.value = null } }
    val perms = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { state.refresh() }
    val askPerms = rememberPermsAsk(state)
    LaunchedEffect(Unit) {
        // Never show armed when it is not (brief §4.1): a persisted armed flag with no live service means Android killed it.
        if (state.prefs.armedPersisted && Bus.state.value == SessionState.DISARMED) { state.prefs.armedPersisted = false; Bus.lastError.value = "Session was ended by Android. Arm again."; state.toast.value = "Session was ended by Android. Arm again." }
    }
    LaunchedEffect(Unit) {
        // Location is optional (photo places, where am I, take me home): asked once, with the others, never required.
        val ui = ctx.getSharedPreferences(UI_PREFS, Context.MODE_PRIVATE)
        val askLocation = withContext(Dispatchers.IO) { !ui.getBoolean(LOCATION_ASKED, false) } && !Locator.permitted(ctx)
        val missing = missingPerms(ctx)
        if (missing.isNotEmpty() || askLocation) {
            ui.edit().apply { if (askLocation) putBoolean(LOCATION_ASKED, true); if (missing.isNotEmpty()) putBoolean(PERMS_ASKED, true) }.apply()
            perms.launch((missing + if (askLocation) LOCATION_PERMS.toList() else emptyList()).toTypedArray())
        }
    }

    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route ?: "chat"
    val start = if (state.prefs.onboarded) "chat" else "welcome"
    val st by Bus.state.collectAsState()

    fun tab(r: String) = nav.navigate(r) { popUpTo("chat") { saveState = true }; launchSingleTop = true; restoreState = true }
    // Leaves a pushed screen, only while it is still on top and never past the start destination: a second tap during the
    // 700 ms fade used to pop the start destination too and leave an empty screen. The screen is dropped, not saved into a
    // tab's back stack, so [then] (a tab switch) can't bring it back.
    fun leave(e: NavBackStackEntry, then: () -> Unit = {}) {
        if (nav.currentBackStackEntry?.id != e.id) return
        if (nav.previousBackStackEntry != null) nav.popBackStack()
        then()
    }
    val go by state.pendingRoute.collectAsState()
    LaunchedEffect(go) { val r = go ?: return@LaunchedEffect; state.pendingRoute.value = null; runCatching { nav.navigate(r) { launchSingleTop = true } } }
    // Cards the brain or a voice command asks for ("take me home", "show the allergy card"). Only while the app is on
    // screen: otherwise the session posts a notification, and the request waits here until the app comes back.
    LaunchedEffect(Unit) {
        combine(TravelActions.cardRequest, state.resumed) { k, on -> if (on) k else null }.collect { k ->
            if (k != null) {
                TravelActions.cardRequest.value = null
                if (k in TravelActions.CARDS) state.go("card/$k")
                // A card asked for while the app was away was also posted as a notification; it's on screen now.
                runCatching { ctx.getSystemService(NotificationManager::class.java)?.cancel(TravelSession.CARD_NID) }
            }
        }
    }

    fun arm() {
        if (missingPerms(ctx).isNotEmpty()) { state.toast.value = "Grant permissions first"; askPerms(); return }
        if (state.prefs.apiKey.isBlank()) state.toast.value = "No API key yet: photos will save, but there'll be no answers"
        FieldService.arm(ctx)
    }

    Column(Modifier.fillMaxSize().background(F.Bg).statusBarsPadding()) {
        Box(Modifier.weight(1f)) {
            NavHost(nav, startDestination = start) {
                composable("welcome") { Welcome(state) { state.prefs.onboarded = true; nav.navigate("chat") { popUpTo("welcome") { inclusive = true } } } }
                // The Glasses shortcuts switch tabs: pushed onto Chat or Photos, Glasses came back each time that tab was tapped.
                composable("chat") { ChatScreen(state, { nav.navigate("detail/${android.net.Uri.encode(it)}") }, { nav.navigate("meal/$it") }) { tab("glasses") } }
                composable("gallery") { GalleryScreen(state, { nav.navigate("detail/${android.net.Uri.encode(it)}") }) { tab("glasses") } }
                composable("food") { FoodScreen(state) { nav.navigate("meal/$it") } }
                composable("glasses") { GlassesScreen(state, { nav.navigate("detail/${android.net.Uri.encode(it)}") }) { arm() } }
                composable("trip") { TripScreen(state, { nav.navigate("card/$it") { launchSingleTop = true } }) { nav.navigate("detail/${android.net.Uri.encode(it)}") } }
                composable("detail/{key}") { e -> DetailScreen(state, android.net.Uri.decode(e.arguments?.getString("key") ?: ""), { nav.navigate("meal/$it") }, onOpenTrip = { leave(e) { tab("trip") } }) { leave(e) } }
                composable("meal/{id}") { e -> MealScreen(state, e.arguments?.getString("id") ?: "", { k -> nav.navigate("detail/${android.net.Uri.encode(k)}") }) { leave(e) } }
                composable("card/{kind}?item={item}", listOf(navArgument("kind") { type = NavType.StringType }, navArgument("item") { type = NavType.StringType; defaultValue = "" })) { e ->
                    CardScreen(state, e.arguments?.getString("kind") ?: "", e.arguments?.getString("item") ?: "") { leave(e) }
                }
                composable("import") { e -> ImportScreen(state, { leave(e) { tab("trip") } }) { leave(e) } }
            }
        }
        if (tabs.any { it.first == route }) Column(Modifier.fillMaxWidth().background(F.Bar).navigationBarsPadding()) {
            HorizontalDivider(color = F.Line2)
            Row(Modifier.fillMaxWidth().padding(12.dp, 8.dp, 12.dp, 10.dp), horizontalArrangement = Arrangement.SpaceAround) {
                tabs.forEach { (r, label) ->
                    val on = r == route
                    val c = if (on) F.Accent else F.Muted
                    Column(Modifier.widthIn(min = 64.dp).heightIn(min = 48.dp).clickable { tab(r) }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
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
            "trip" -> {
                // A suitcase: body, handle, two straps.
                drawRoundRect(c, Offset(3 * u, 8 * u), androidx.compose.ui.geometry.Size(18 * u, 12 * u), androidx.compose.ui.geometry.CornerRadius(2.5f * u), style = s)
                drawPath(Path().apply { moveTo(9 * u, 8 * u); lineTo(9 * u, 5 * u); lineTo(15 * u, 5 * u); lineTo(15 * u, 8 * u) }, c, style = s)
                drawLine(c, Offset(8 * u, 8 * u), Offset(8 * u, 20 * u), s.width, StrokeCap.Round)
                drawLine(c, Offset(16 * u, 8 * u), Offset(16 * u, 20 * u), s.width, StrokeCap.Round)
            }
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
        Text("Your glasses, with a brain. Start a session, pocket the phone, and just tap or talk: what am I looking at, read this menu, log this meal, how much have I eaten today. Everything lands in Chat, Photos, Trip and Food.", style = MaterialTheme.typography.bodyLarge, color = F.Ink2)
        Card(padding = PaddingValues(16.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Step("1", "Allow the permissions when asked (Bluetooth, microphone, notifications, photos). Location is optional: it tags photos with places and finds the way back to your hotel.")
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
