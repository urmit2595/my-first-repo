# Fieldnote

A personal Android companion for Ray-Ban Meta glasses (no display), built on the Meta Wearables Device Access Toolkit
(DAT SDK 0.9.0) in Kotlin and Jetpack Compose. Arm a session, pocket the phone, and use the glasses' touchpad and
microphone: tap for a photo, double-tap for a photo plus a spoken answer, triple-tap to ask anything. A "brain" model
(OpenRouter or OpenAI, your own key) decides what to do with each request using tools: take a photo, look through a lens,
log a meal, and so on.

Package `com.urmit.glasses.dev`, minSdk 31, target 34, arm64 only, Developer Mode (Meta APPLICATION_ID 0).

Release history, device-test results and the unmet requirements of every build are in `RELEASE-NOTES.md`.

## What's in it

- **Chat**: the brain (a tool-using model) takes typed or spoken requests: take a photo, look through a lens, log a meal
  or a spend, answer about the trip, save a note, take you home.
- **Photos**: Fieldnote captures and the Meta AI album, with per-photo answers, lenses and place tags.
- **Trip** (3.4): bookings shared in from email, PDFs or screenshots; the stay and "take me home"; cards to show a driver
  or a waiter; the offline pack; the ledger; notes and places; the traveller profile.
- **Food**: meals, calories and protein against daily targets.
- **Glasses**: the session, setup and device tests, models per lens, diagnostics.

Code: `data/` (stores, model calls, travel logic), `service/` (the foreground session: glasses capture, taps, voice,
travel hooks), `ui/` (Compose screens). Unit tests for the travel logic: `gradle testDebugUnitTest`.

## Building

Needs JDK 17+, the Android SDK (platform 35, build-tools 35) and Gradle 8.11+.

Machine-local values live in `local.properties`, which is git-ignored. Nothing secret is committed.

```properties
sdk.dir=/path/to/android-sdk
# Telemetry (Supabase REST insert endpoint + publishable key). Leave blank to build without a default endpoint.
fieldnote.diagEndpoint=https://<project>.supabase.co/rest/v1/fieldnote_events
fieldnote.diagKey=<publishable key>
# Release signing. Use the same keystore for every build, or the APK will not install over the previous one.
fieldnote.keystore=/absolute/path/to/fieldnote.keystore
fieldnote.storePassword=...
fieldnote.keyAlias=fieldnote
fieldnote.keyPassword=...
```

Then `gradle assembleRelease` (signed, R8-minified) or `gradle assembleDebug`.
