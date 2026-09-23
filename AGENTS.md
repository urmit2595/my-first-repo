# AGENTS.md — Fieldnote screen redesign

Instructions for Codex (and any other coding agent) working in this repository.

## What this is

Fieldnote is a personal Android app (Kotlin, Jetpack Compose) that is the phone companion for Ray-Ban Meta glasses.
The glasses have a camera, microphones and speakers but **no display**: the phone is the only screen. The app source
is in `fieldnote/` (Gradle project root). Read `fieldnote/README.md` and the top of `fieldnote/RELEASE-NOTES.md` first.

The current job is a **visual redesign of the existing screens** (version 3.5, "new look"), driven by mockups made in
ChatGPT. The plan is `design/PLAN.md`; the screen-by-screen spec is `design/screens.md`; the task list you will be
given, one task at a time, is `design/codex-tasks.md`.

## Sources of truth

| What | Where | Rule |
| --- | --- | --- |
| Look: layout, hierarchy, colour, spacing, icon choice | `design/mockups/*.png` | Match it closely. It is a direction, not a redline: ignore AI artefacts (garbled or invented text, uneven spacing, extra buttons). |
| Words, data and behaviour | the existing Kotlin code, then `design/screens.md` | Text on screen comes from the code. Change a string only when `design/screens.md` says so. The mockup's text never overrides code. |
| Design tokens | `design/tokens.json` → `ui/Theme.kt` | Colours, type, radii and spacing live in `Theme.kt` only. No raw hex values or font sizes in screen files. |
| The app today | `design/before/*.png` | Screenshots of the current app, for comparison. |

## Hard rules

1. **UI layer only.** You may change `fieldnote/app/src/main/kotlin/com/urmit/glasses/dev/ui/**`, the UI parts of
   `MainActivity.kt` (`Root`, `TabIcon`, `Welcome`, `Step`), `res/font`, `res/drawable`, `res/mipmap*`, and test-only
   dependencies/plugins in `app/build.gradle.kts`. Do **not** change `data/`, `service/`, `FieldnoteApp.kt`,
   `AndroidManifest.xml`, the package or `applicationId`, signing config, telemetry, or model prompts.
2. **Behaviour is frozen.** Every button, chip and gesture must call exactly what it calls today (same `AppState`
   method, same `FieldService.send(...)` action, same navigation route). When you split a screen, move logic lines
   verbatim; do not "tidy" them.
3. **Stateless content + previews.** When you restyle a screen, split it into `XxxScreen(state: AppState, …)` (reads
   state, wires callbacks, unchanged signature) and `XxxContent(ui: XxxUi, actions: XxxActions)` (pure UI). Add
   `@Preview`s for every state listed for that screen in `design/screens.md`, fed from `ui/preview/SampleData.kt`.
   Preview device: 412×915 dp (`@Preview(widthDp = 412, heightDp = 915, showBackground = true)`).
4. **One screen file per task, one commit per task.** Don't touch other screen files. Commit only after the user
   has seen the renders and said so. Commit message: `UI 3.5: <screen name>`.
5. **Icons:** use the icon set in `ui/icons/` (Lucide paths as Compose `ImageVector`s, ISC licence). No emoji or
   Unicode glyphs as icons (▣ ● ↑ ♥ ↗ 🗑 🎙 🔊 📍 🍽 are the ones to replace). Every icon-only control gets a
   `contentDescription`.
6. **Accessibility:** touch targets ≥ 48 dp, body text ≥ 14 sp, small text ≥ 12 sp, contrast ≥ 4.5:1 for text. Each
   screen gets one extra preview at `fontScale = 1.3f` that must not clip.
7. **Travel cards stay light.** `CardScreen.kt` (driver, allergy, phrases, emergency) is shown to other people in
   daylight: white paper, near-black ink, very large type, full brightness. Restyle within that, never dark.
8. **Voice of the copy:** plain British English, short, no jargon ("Start session", not "Arm"; "analysed", "favourites").

## Build and verify (every task)

Run from `fieldnote/`:

```bash
./gradlew testDebugUnitTest assembleDebug          # must pass before every commit
./gradlew recordRoborazziDebug                     # renders previews to PNG (after task T1 sets it up)
```

Then open the rendered PNGs for the screen you changed (the full set under `app/build/outputs/roborazzi/`, the main
state of each screen copied to `design/renders/<screen-id>.png`), put them next to the mockup, list the differences you can see (layout, spacing, colour, type, icons), fix them, and
render again. Stop when the remaining differences are AI artefacts in the mockup. Say what you left and why.

Sandbox notes for this Mac:
- If Gradle can't write to `~/.gradle`, run it with `GRADLE_USER_HOME="$PWD/.gradle-user"` (already git-ignored as
  `.gradle-user/` after T0).
- If dependency downloads are blocked, say so and ask the user to allow network access or run the first build in
  Terminal. Don't work around it by vendoring jars.

## Never

- Never run `adb uninstall`, `pm clear`, or anything that wipes app data: it deletes the user's chats, meals, trips
  and settings. A debug build cannot install over the release build (different signing key); use an emulator.
- Never commit `local.properties`, keystores, API keys, or the Supabase endpoint/key.
- Never skip, delete or weaken a test to get a build green.
- Never add analytics, network calls or new permissions as part of the redesign.
