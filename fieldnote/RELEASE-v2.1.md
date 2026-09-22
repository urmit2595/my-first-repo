# Fieldnote 2.1 — release notes (20 September 2026)

## 2.1 changes
- Fixed: headings and body text rendered near-black on the dark background (content colour was not set on the root surface).
- Fixed: gallery tiles opened and immediately closed the detail screen (item keys contain ':' which the navigator mangled; keys are now URL-encoded).
- Telemetry now goes to Supabase (table fieldnote_events, insert-only publishable key, reads blocked from the phone) with
  structured props: capture stage timings, answer latency/model/lens/cost, error class, media-key names, session states.
- Live dashboard "Fieldnote Ops" (claude.ai artifact) reads the table through the Supabase connector.
- Meta registration row now spells out the Developer Mode prerequisite.

# Fieldnote 2.0 — release notes (19 September 2026)

Built from scratch in Kotlin / Jetpack Compose against Meta Wearables DAT SDK 0.9.0 (Maven Central), following the
"Fieldnote build brief" (standby capture, tap triggers, pause handling) and the "Fieldnote redesign" canvas.

Package com.urmit.glasses.dev · version 2.0 (200) · minSdk 31 · Developer Mode (APPLICATION_ID 0 / CLIENT_TOKEN 0).
Signed with a NEW key (fieldnote.keystore in this archive). The old ChatGPT-built app must be uninstalled first.

## Implemented
- Standby, not streaming: no device session while idle. Trigger → createSession → start → addCamera → stream.start →
  capturePhoto → removeCamera → stop, with a 12 s timeout per stage, one retry, then a spoken failure. Photo is saved
  (Pictures/Fieldnote via MediaStore) before any analysis.
- Hold on PAUSED; STOPPED returns to standby and stays armed.
- Touchpad taps as media buttons: play/pause/hook = tap (capture), next = double-tap (capture + lens + speak),
  previous = triple-tap (tap-to-talk). Media session active only while armed; music controls return on disarm.
- Tap-to-talk over the glasses mic (Bluetooth SCO route confirmed, no silent phone-mic fallback). Fixed commands
  (take a photo / what am I looking at / read this / analyse my last photo / more / stop / disarm); anything else is a
  question about a fresh photo.
- Wake-word mode (opt-in, 20-minute time box, hidden until Test D is marked passed). Implemented as repeated short
  listen windows on the glasses mic — not a dedicated wake-word engine.
- Lock-screen notification: state on the first line, Capture / Ask / End actions, wake-word time remaining.
- Tones: armed, captured, listening, analysing, failed, disarmed. Spoken answers chunked to the chosen length;
  "more" continues.
- Gallery from MediaStore: Meta AI album ("Meta AI"/"Meta View" buckets) merged with Fieldnote captures, F/G badges,
  status dots from the analysis queue, filters, multi-select, hide-not-delete for album items.
- Photo detail: lens chips (Scene / Heritage / Food / Read text), threaded follow-ups by text or voice, model and
  latency per answer, read aloud, share, favourite, retry on failure.
- Analysis via your own OpenRouter or OpenAI key, model per lens, daily spend cap with an 80% spoken warning,
  persistent queue with saved / queued / analysing / analysed / waiting-for-network / failed.
- Session tab with Arm/Disarm ring, "Safe to lock your phone" only when all checks pass, mode switch, gesture legend.
- Glasses tab: registration via Meta AI, permissions, battery-optimisation exemption, Tests A–D, gesture mapping
  reflecting Test A, sounds preview, album detection, unregister, diagnostics (optional event upload to the
  ChatGPT Sites endpoint; URL + device token entered on the phone; only event names/ids/timestamps/version/API level).

## Not verified on hardware
Nothing in this build has run on a real phone or glasses. Untested and therefore unmet until you run them:
Test A (do taps arrive as media buttons while a silent clip plays), Test B (cold-capture latency), Test C (pause
recovery), Test D (wake word). The Meta AI album bucket name is detected at runtime and shown under Glasses.

## Known limits
- Video capture from Fieldnote is out of scope (shutter-hold video imports through Meta AI).
- A partial wake lock is held while armed; battery cost depends on how long you stay armed.
- OpenRouter per-request cost is read from the response when present; otherwise counted as 1 cent.

## 2.2 changes (from the first real-device telemetry, 19 Sep 2026)
Observed on device: registration OK, taps arrive as media keys (Test A effectively passed), 7 captures OK, Gemini answers in ~2.5 s.
- Capture latency was 7–12 s, with 5–9 s in "shot": capturePhoto plus decoding the HEIC the glasses return. HEIC is now saved
  as-is through MediaStore (no decode on the hot path); save time is logged separately as photo_saved.save_ms.
- "Microphone route is not the glasses": the route check ran once after 400 ms. It now polls for up to 3 s and accepts
  LE-audio headsets as well as classic SCO.
- Rapid taps stacked captures that then timed out; at most one capture is now queued while one is running (extra taps are
  dropped and logged as trigger_dropped). createSession retries three times and waits 1.5 s after the previous session stop.
- armed_min in the disarmed event was computed after the timer was cleared; fixed.

## 2.3 changes
- The first captures after arming failed with "Failed to capture photo" while later ones worked: the shot was taken as soon as
  the stream reported STREAMING, before frames were flowing. Capture now waits for the first video frame (up to 4 s), and
  capturePhoto gets one in-session retry before the session is torn down.
- Warm-capture option (Glasses → Keep camera warm): 0 / 30 / 90 s. Brief §3 Test B says to test a warm variant when the cold
  median is over 4 s; it was 7–8 s. Off by default because a tap during a live session can pause it. Timings carry warm/attempts.
- Test B now takes 5 captures 10 s apart and records cold vs warm.
- Everything on the glasses is released on disarm.

## 3.0 — the agentic release

**Chat tab (home).** A Meta-AI-style chat with the app's brain. Type or tap ● to speak; ▣ attaches your latest photo. Every action the brain takes (took a photo, logged a meal) appears inline and links to the photo or meal.

**Brain = orchestrator model (default openai/gpt-5 via OpenRouter; pick GPT-5 mini, Claude Sonnet 4.5, Gemini 2.5 Pro… under Glasses → Answers → Brain).** It gets text only and acts through tools: `take_photo`, `look(lens, question, fresh)`, `log_meal`, `food_summary`, `recent_photos`, `set_setting`, `end_session`. Vision stays with the per-lens "eyes" models. Up to 6 tool rounds per turn.

**Voice.** Triple-tap → whatever you say goes to the brain (only "stop", "more", "end session", "take a photo" are handled instantly). The microphone now falls back to the phone if the glasses' headset link doesn't come up in 3 s instead of failing with "Microphone route is not the glasses"; the route used is logged (`voice_command.route`, `voice_fail`).

**Food tab (Plateful merged).** Today's calorie/protein rings vs targets, last-7-days bars, meal log with photos, meal detail with items, the model's one open question, and a "correct it" box that re-estimates. "＋ Log as meal" chip on any photo. Data in meals.json.

**Glasses tab.** Session controls (Start/End session, Taps/Wake word, Photo / Photo + answer / Ask) on top; Setup, Answers, More glasses options and Diagnostics below as collapsible sections. Copy rewritten in plain English (no "arm/disarm/register").

**Telemetry.** New events: agent_ok{ms,model,by_voice,chars}, agent_fail{reason}, agent_tool{tool,round}, voice_fail{route,reason}; voice_command gains route (glasses|phone) and from (chat). Dashboard has a "Brain & voice" card.

## 3.1 — GPT-5.6 Sol and saved chats

- Brain default is now `openai/gpt-5.6-sol` (verified on OpenRouter: tools + images, $2/$10 per M tokens); Luna and 5.4-mini offered as cheaper options. Sol/Luna also selectable as "eyes".
- Chats (topics): messages live in named chats. Tap the title in Chat for the list, New chat, delete, and "Auto". Selecting a chat pins it; the brain then stays there. In Auto, the brain gets other chats' titles + last reply and may `switch_chat` / `new_chat` / `rename_chat`; on ambiguity it asks instead of switching. "New topic"/"new chat" spoken or typed starts one; "back to <name>" reopens. Old single-thread history migrates into "Earlier chat".

## 3.2 and 3.3 — recovered from the 3.3 APK (22 September 2026)

The 3.3 source was not in the handover (only `Fieldnote-3.1-source.zip` and `Fieldnote-3.3.apk`). It was rebuilt from the 3.1
source and a decompile of the signed 3.3 APK, then checked by building it and comparing every class structurally with the
real APK: the data and service layers match exactly; the UI matches once built the same incremental way the original was.
3.2 was an intermediate build (telemetry shows it on 20 Sep); its changes are folded into 3.3 below.

- Quick photos for answers (Glasses → More glasses options, on by default): double-tap, the notification's analyse action and
  the brain's photo tools grab a frame off the live stream (about 3 s) instead of the glasses' full photo (10 s+). A single
  tap still takes the full photo. The stream is now MEDIUM quality (504×896) and uncompressed so frames can be encoded to
  JPEG on the phone; if a frame's layout is unknown it falls back to a full photo on the same session.
- Warm-camera window options changed from 30 s / 90 s to 45 s / 2 min.
- Brain requests to reasoning models (GPT-5 family, Gemini 2.5 Pro, Claude) ask for low reasoning effort; 3.0 telemetry
  showed ~20 s per brain turn at the default. Chat answers now also update the session's last-answer line.
- Diagnostics upload: HTTP 409 counts as delivered, 5xx keeps the queue for a retry, other 4xx clear it; status reads
  "Synced", "Server error (…); will retry" or "Server refused (…); cleared the queue".

Telemetry from 3.2 (20 Sep): Test B cold capture median about 11 s (10.5–15.8 s over 9 runs), so Test B still fails the
4 s target; one "Can only capture photos while streaming video" failure after two in-session retries. No 3.3 telemetry
has arrived yet.
