# Fieldnote

A personal Android companion for Ray-Ban Meta glasses (no display), built on the Meta Wearables Device Access Toolkit
(DAT SDK 0.9.0) in Kotlin and Jetpack Compose. Arm a session, pocket the phone, and use the glasses' touchpad and
microphone: tap for a photo, double-tap for a photo plus a spoken answer, triple-tap to ask anything. A "brain" model
(OpenRouter or OpenAI, your own key) decides what to do with each request using tools: take a photo, look through a lens,
log a meal, and so on.

Package `com.urmit.glasses.dev`, minSdk 31, target 34, arm64 only, Developer Mode (Meta APPLICATION_ID 0).

Release history and the device-test results are in `RELEASE-v2.1.md` (covers 2.0 to 3.3).

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
