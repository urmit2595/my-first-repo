# Codex tasks — Fieldnote 3.5 screens

Paste these into Codex on your Mac **one at a time, one thread per task**, in this order. Each one ends with Codex
showing you its snapshots and a diff. You review, then say "commit" (or what to fix).

- **Codex app:** open the repo folder as the project, run it locally (on your Mac, not in the cloud), start a new
  thread per task, drag the mockup PNGs into the message (or just name their paths; Codex can open them).
  Appshots (press Command twice) attaches whatever window is in front, e.g. the Android emulator or Android Studio's
  preview, if you want to show Codex something on screen.
- **Codex CLI instead:** `cd` into the repo, then `codex -i design/mockups/s03-chat.png "<prompt>"` (repeat `-i` for more
  images).
- Codex reads `AGENTS.md` at the start of every thread; the prompts below rely on it.

---

## T0 · Working branch and toolchain (no UI changes)

Run this first. It is the only prompt that works before `AGENTS.md` is on your branch.

```text
Set up this repo for the Fieldnote 3.5 screen work. Don't change any app code.

1. git fetch origin. Create a branch fieldnote-3.5-ui from origin/claude/meta-ai-glasses-cowork-4oegas (the Fieldnote
   3.4 source, in fieldnote/). Merge origin/claude/beautiful-shannon-cd2q84 into it (it only adds AGENTS.md and design/).
   Then read AGENTS.md, design/PLAN.md and fieldnote/README.md.
2. Check the toolchain and report what's missing, with the exact install command for each, before installing
   anything: JDK 17+ (java -version), the Android SDK (ANDROID_HOME or ~/Library/Android/sdk) with platform 35 and
   build-tools 35, Gradle 8.11+. Android Studio provides the JDK and SDK; Gradle can come from Homebrew.
3. If fieldnote/local.properties doesn't exist, create it with only sdk.dir=<the SDK path>. Never commit it. Tell me
   which lines I must add myself for a signed release build (keystore path and passwords, see fieldnote/README.md).
4. Add a Gradle wrapper (gradle wrapper --gradle-version 8.11.1, run in fieldnote/) so ./gradlew works, and add
   .gradle-user/ to fieldnote/.gitignore.
5. Run ./gradlew testDebugUnitTest assembleDebug in fieldnote/. If the sandbox blocks ~/.gradle, use
   GRADLE_USER_HOME="$PWD/.gradle-user". If downloads are blocked, stop and tell me.
6. Show me the result, then commit only the wrapper files and .gitignore: "Add Gradle wrapper".
```

---

## T1 · Previews, sample data and snapshot rendering

```text
Set up a way to see Fieldnote screens without a phone, so we can compare them with the mockups.

1. Add Roborazzi screenshot tests (Robolectric + Compose) to the app module as test-only dependencies. Pick versions
   that work with AGP 8.9.1, Kotlin 2.2.0, compileSdk 35 and the Compose BOM in app/build.gradle.kts; check Maven
   Central for the current ones. If Roborazzi won't work with this setup, say why and propose the fallback (an
   emulator plus adb screencap) instead of forcing it.
2. Create ui/preview/PreviewFrame.kt: a PhoneFrame composable that applies FieldnoteTheme at 412 x 915 dp, with an
   option to draw the bottom tab bar (the same tabs as MainActivity: Chat, Photos, Trip, Food, Glasses).
3. Create ui/preview/SampleData.kt with the sample data at the end of design/screens.md, built from the app's own
   data classes (read-only use of data/; don't change it).
4. Create one screenshot test that renders named previews to PNG at 412 x 915 dp, xxhdpi. Put the full set under
   app/build/outputs/roborazzi/ and copy the main state of each screen to design/renders/<screen-id>.png (committed).
5. Prove it: render a "components" preview of the existing shared components as they are today (Card, Primary,
   Ghost, Chip, Eyebrow, LensChip, ArmPill) to design/renders/components-before.png.
6. ./gradlew testDebugUnitTest assembleDebug must pass. Show me the PNG, then commit: "UI 3.5: preview and snapshot setup".
```

---

## T2 · Design system: tokens, type, components, icons, tab bar

Attach: `d00-style-tile.png`, `d01-icons.png`, `s03-chat.png`.

```text
Apply the approved visual system to the shared UI, before any screen.

1. Read design/tokens.json and the attached style tile. Update ui/Theme.kt: the F colours, the typography and the
   shapes. Keep every existing F name (screens use them); add new ones only if the tile needs them. If the direction
   needs new fonts, add them to res/font from their official source with their licence (OFL), and tell me.
2. Move the shared components into ui/Components.kt (same package, so callers don't change) and restyle them to the
   tile: Card, Primary, Ghost, Chip, LensChip, Eyebrow, Section, CheckRow, ToggleRow, Field, ArmPill (status pill),
   plus the round icon button, tag, badge, segmented control and progress ring that several screens draw on their
   own today. Keep their parameters compatible.
3. Create ui/icons/: the Lucide icons named on the attached icon sheet, as Compose ImageVectors (24 dp, stroke
   1.75), with the ISC licence in a comment. Add an Icon helper that takes a contentDescription.
4. Restyle the bottom tab bar in MainActivity.Root to the mockup using the new icons; keep the navigation code and
   the teal "session on" dot on Glasses exactly as they are. Delete TabIcon only once nothing uses it.
5. Render a components preview to design/renders/components.png, compare it with the style tile, fix differences,
   render again (up to 3 rounds). List what still differs and why.
6. Build and unit tests must pass. Other screens will look half-new until their task; that's expected. Show me the
   before/after renders and the diff summary. Commit after I say so: "UI 3.5: design system".
```

---

## T3 · One screen file at a time (template)

Fill in the three `<…>` parts from the table, attach the listed mockups, paste. Order matters: Chat first, because
it's the hero and it settles the patterns every other screen reuses.

| # | File(s) | Screens in design/screens.md | Attach |
| --- | --- | --- | --- |
| 1 | `ui/ChatScreen.kt` | S03, S02, S04 | s03, s02, s04 |
| 2 | `ui/GlassesScreen.kt` + `ui/SessionScreen.kt` | S17, S18, S19 | s17, s18, s19 |
| 3 | `ui/GalleryScreen.kt` | S05 | s05 |
| 4 | `ui/DetailScreen.kt` | S06 | s06 |
| 5 | `ui/TripScreen.kt` | S07, S08, S09, S20 | s07, s08, s09, s20 |
| 6 | `ui/ImportScreen.kt` | S10 | s10 |
| 7 | `ui/CardScreen.kt` | S11, S12, S13, S14 | s11–s14 |
| 8 | `ui/FoodScreen.kt` | S15, S16 | s15, s16 |
| 9 | `MainActivity.kt` (`Welcome`, `Step`) | S01 | s01 |

```text
Restyle <FILE(S)> to the new design: screens <SCREEN IDS> in design/screens.md. Mockups attached: <FILE NAMES>.
The before screenshots are in design/before/ if there's a matching one.

1. Read AGENTS.md, those sections of design/screens.md (including every state listed), and the current code.
2. Split each screen into XxxScreen (same signature; reads AppState; wires callbacks) and a stateless XxxContent that
   takes a small UI model and an actions object. Move logic lines verbatim; every button must still call exactly
   what it calls now.
3. Restyle XxxContent to match the mockup, using only Theme tokens, ui/Components.kt and ui/icons/. Replace every
   emoji or Unicode glyph used as an icon. Keep the code's strings unless the spec says otherwise; where the mockup's
   words differ from the code, the code wins.
4. Add a preview for every state listed in the spec plus one at fontScale 1.3, fed from SampleData.kt (extend it if
   you need to). Add them to the screenshot test.
5. Build, run unit tests, render. Put each render next to its mockup, list the visible differences (layout, spacing,
   colour, type, icons), fix, render again, up to 3 rounds. Ignore AI artefacts in the mockup and say which ones.
6. Show me: the render paths (main state copied to design/renders/), the remaining differences, and a short diff
   summary that confirms no behaviour changed. Commit only when I say so: "UI 3.5: <screen name>".
If a new shared component variant is needed, add it to ui/Components.kt and tell me; don't restyle other screens.
```

---

## T4 · Consistency and accessibility pass

```text
All screens are done. Do a consistency and accessibility pass without changing behaviour.

1. Render every screen's main state and make one contact sheet, design/renders/contact-sheet.png (all screens in a
   grid, labelled with their IDs).
2. Compare them with each other and with the mockups: header sizes, side margins, card radii, spacing between
   sections, icon sizes, chip heights, button styles, empty-state style. Fix inconsistencies in the shared components
   first, screen code second.
3. Check: every icon-only control has a contentDescription; touch targets are at least 48 dp; no text under 12 sp;
   text contrast at least 4.5:1 (list any pair that fails); the fontScale 1.3 previews don't clip; status and
   navigation bar colours match the theme; the travel cards are still white with very large type.
4. Build and unit tests pass. Show me the contact sheet and the list of fixes. Commit after my OK: "UI 3.5: consistency
   and accessibility pass".
```

---

## T5 · Release 3.5

```text
Prepare Fieldnote 3.5 ("new look").

1. Set versionCode 350 and versionName "3.5" in app/build.gradle.kts. Nothing else in that file.
2. Add a "Fieldnote 3.5 — new look" section at the top of fieldnote/RELEASE-NOTES.md, in the style of the others:
   what changed per screen, "no behaviour changes", the new icon set and fonts (with licences), the snapshot setup,
   and "Not verified on hardware" with the device checks from design/PLAN.md (Phase 3).
3. ./gradlew testDebugUnitTest assembleRelease. This needs my keystore lines in local.properties; if they're
   missing, stop and tell me exactly which lines to add. Don't create a new keystore: a different key can't install
   over the app on my phone.
4. Tell me the APK path and the install command (adb install -r <apk>, which keeps my data). Do not run adb
   yourself, and never uninstall.
5. Commit after my OK: "Fieldnote 3.5: new look".
```

---

## Later · Screens for new features

The unfinished "Fieldnote UI and UX plan" doc lists new features (a fuller chat with uploads, a model picker with
prices in rupees, Plateful inside Food, a revised lens and gesture map). None of them are decided yet. Once they are,
each new screen goes through the same loop: add a section to `design/screens.md`, draw it in ChatGPT against the style
tile and hero, then a T3-style task, with the one difference that the feature's logic is new and needs its own tests.
