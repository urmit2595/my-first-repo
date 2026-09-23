# Fieldnote 3.4 — travel core (23 September 2026)

Built from the recovered 3.3 source. Package, signing key and data files are unchanged, so it installs over 3.3 and keeps
photos, chats, meals and settings. versionCode 340.

This is phase 1 of the "Fieldnote travel feature plan" — its "if only five things get built first" list — built on the
3.0 brain-and-tools design rather than a server:

1. **Trip brain and traveller profile.** Share booking emails, PDFs or screenshots into Fieldnote ("Add to trip" in the
   share sheet), or paste them on the new Trip tab. The model extracts flights, stays, trains, tickets and tables with
   local times and time zones, addresses, phone numbers and booking references, and files them into the current trip or
   a new one. The traveller profile (home currency, languages, diet, allergies, daily budget, interests, walking pace,
   emergency contacts) goes into every answer. The brain gains `trip_info` and `add_booking`.
2. **One reading pipeline.** New lenses: Translate, Menu (dishes explained, allergens flagged against your profile, two or
   three picks, prices in rupees), Price (tags and bills read as numbers; the phone converts), Receipt and Flight board
   (finds your own flight or train from the trip). Reading lenses always take the glasses' full photo and send it at
   high detail; a quick 504×896 stream frame is too coarse for small print. Exchange rates come from open.er-api.com
   (Frankfurter as fallback) and are cached, so conversions work offline on the last saved rate.
3. **Receipt to ledger.** The Receipt lens, "log this receipt", or a spoken spend ("taxi 2400 yen") adds an entry with the
   amount in rupees. The Trip tab shows today and trip totals by category and exports CSV. The brain gains `log_expense`,
   `spend_summary` and `convert_currency`.
4. **Auto-tagging and voice notes.** Fieldnote captures are tagged with the place they were taken (phone location plus
   reverse geocoding). While a session runs, a light location track (one fix every ~2 minutes or 50 m) lets Meta AI album
   photos be placed later. "Note: …" saves a voice note pinned to where you are; "remember this" / "remember where I
   parked" adds a photo. "Where did I …" searches notes, photo places, spends and bookings offline.
5. **Take me home, driver card, offline pack.** "Take me home" gives direction, distance and walking time to your stay,
   its front-desk number, and opens the driver card: the address in the local script, large, with a spoken request.
   The offline pack (Trip tab, once on Wi-Fi) saves exchange rates, places stays on the map, writes quick phrases for
   taxi, hotel, restaurant, pharmacy, shop and help, an allergy card in the local language, and local-script addresses,
   and downloads ML Kit's on-device translation and text-reading models. With no data, the Read, Translate, Menu and
   Flight board lenses fall back to on-device reading and translation. Emergency numbers for ~70 countries are built in.

Instant voice commands (no brain, no data needed): "note …", "remember this", "take me home", "where am I", "driver
card", "allergy card", "emergency numbers". They also appear in Chat. "Hand off to Meta" releases the glasses for Meta's
live translation.

## Fixes to inherited 3.3 behaviour
A six-area code review of the recovered 3.3 code (plus the new travel code), with every finding checked by a second,
sceptical reviewer, found these; all are fixed in 3.4. None of them has been seen on hardware yet.

**Glasses session**
- Quick photos (3.3): the colour-layout test was the wrong way round, so quick-photo JPEGs very likely had scrambled
  colours; the layout is now measured by vertical smoothness (works on grey scenes too) and logged as `layout` on each
  `capture_ok`. A quick photo that failed after the frame arrived left the camera session open on the glasses; it is now
  always released. Fallback timings and the `heic-fallback` label were wrong.
- Photo retries: when the stream is paused, the second `capturePhoto` 600 ms later always failed ("Can only capture photos
  while streaming video" in 3.2 telemetry); it now skips straight to a fresh session.
- Wake word: after a session ended in wake-word mode, the next session ignored every tap; and each wake-word command left
  the state on "Answering", so the wake word worked once per session. Commands now go through the trigger queue, the mode
  resets every session, and only one listening loop runs.
- A tap during the brain's last answer before "end session" could reopen the glasses from a stopped service and crash the
  app. Nothing runs after End now.
- The service could wait for ever on text-to-speech that never reported back (engine restarted, utterance flushed), and
  End then queued behind it. Speech waits are bounded and every utterance outcome is handled.
- Android 13+ showed the media session's play/pause/skip in the shade and on the lock screen instead of Photo / Ask /
  End, so there was no End on the lock screen. The buttons are back. (If taps ever stop reaching Fieldnote, this is the
  first change to suspect; Test A should be re-run.)
- "Tell me more about the fort" and anything containing "continue" were treated as "more" and never reached the brain.
- Spoken answers were split at decimal points ("12." … "50 euros") and could lose their place after a line break.
- "End session" by voice is now said in full; the "started without microphone access" warning is no longer wiped at once;
  a restart Android refuses no longer crashes the app; one SDK coroutine leaked per session attempt; the speech recogniser
  leaked on a listen timeout.

**Brain, lenses and money**
- OpenAI keys: every brain turn failed with HTTP 400 (and GPT-5 lens or food models), because requests used OpenRouter's
  parameter names. Requests now use each endpoint's own (`max_completion_tokens` and `reasoning_effort` for OpenAI).
- Reasoning models picked as "eyes" could return an empty answer, spoken as "That's all."; they now get low effort and
  room to think, and an empty reply is reported instead of stored. Claude no longer gets extended thinking requested.
- The daily spend cap now stops brain turns too, and meal estimates count towards it. A cap of 0 means no cap (it used to
  block every lens answer).
- "Log a meal" in Chat hours later could re-estimate, and overwrite, the meal from an old photo. Only a photo attached,
  taken this turn, or taken in the last 20 minutes counts now.
- `new_chat` left the question behind in the old chat; the out-of-steps reply now summarises what was done.

**Data**
- Photos interrupted mid-analysis when the app closed showed "queued" for ever; they now show Retry.
- Two writers to the same photo note could erase an answer (now atomic).
- Telemetry: overlapping uploads dropped events; one upload at a time now, removing only what was sent.
- An unreadable data file is set aside as `name.corrupt-<time>.json` instead of being overwritten with an empty one.
- Android backup no longer includes the API key or the location track.
- Photos sent for answers keep their EXIF rotation.

**Screens**
- Each rotation or re-open created another copy of the app's state that never stopped (with a second place tagger and
  media watcher). There is now one per process.
- On Android 12 the permission list included Android 13-only permissions, so Setup never passed and a session could not
  start. Permissions now follow the Android version, and a permanently refused one opens Settings instead of dead-ending.
- Read aloud on a photo and the sound previews leaked a speech engine each time; the Glasses tab's album check ran a full
  photo query on the main thread.

## Not verified on hardware
Nothing in 3.4 has run on the phone or the glasses. Untested and therefore unmet until run: every travel feature above,
the quick-photo colour fix (check that a double-tap photo has natural colours; telemetry now logs `layout` on each
`capture_ok`), location while the phone is locked, the card notifications, ML Kit downloads and offline reading, and the
share-sheet import from Gmail and PDF viewers.

Device tests still open from the build brief: Test B fails (cold capture median ~11 s against 4 s, 3.2 telemetry),
Tests C and D have no recorded runs, and the 30-minute locked-phone walk (definition of done) has not been done.

## Suggested first run
1. Install over 3.3. Allow location when asked (optional; everything else works without it).
2. Trip tab → share one real booking email or PDF to Fieldnote → check the times (they are shown in the place's own zone).
3. Trip tab → Prepare offline pack on Wi-Fi → check the driver card and phrases.
4. Start a session. Double-tap at something (quick photo: check colours), then Translate a sign or menu (full photo).
5. Say "note the café on the corner does good dosa", then "where did I note dosa?" in Chat.
6. Airplane mode → Translate lens on a printed sign → you should hear "Offline reading…".

## Known limits and costs
- APK grows from 11.7 MB to 29.8 MB: ML Kit's translation engine (16 MB of native code). Text-reading models live in
  Google Play services and are fetched by the offline pack; translation models (~30 MB per language) too.
- ML Kit sends anonymous usage logs to Google (its standard data-transport component). Photos and text never leave the
  phone for on-device reading.
- Location is foreground-only (no background permission). Allowing location during a session takes effect from the
  next session.
- Emergency numbers are a built-in table (September 2026); the card says to confirm locally.
- Phase 2+ of the travel plan (flight watch, proactive nudges, SOS, daily recap, interpreter mode) is not started.

---

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
