# Fieldnote 3.5 — screens and ChatGPT prompts

One section per image. Each has the file name to save it as, the code it replaces, the states Codex has to build
(most are **not** drawn, only described), and a ready-to-paste ChatGPT prompt.

How to use it: set up the ChatGPT project once (section 0), then go top to bottom. For every screen, attach the three
reference images it lists, paste its prompt, iterate, and save the one you approve into `design/mockups/` under the
exact name given.

The sample data is the same everywhere (a Tokyo trip, rupees as the home currency) so mockups agree with each other
and with the previews Codex builds (`ui/preview/SampleData.kt`).

---

## 0. One-time setup in ChatGPT

1. Create a **Project** called `Fieldnote screens`. Every chat for this work lives in it, so it keeps the context.
2. Paste the block below into the project's **Instructions**.
3. Upload to the project's files: every screenshot in `design/before/` (the current app).

```text
You are designing the screens of Fieldnote, a personal Android app. It is the phone companion for Ray-Ban Meta smart
glasses. The glasses have a camera, microphones and speakers but NO display: the phone is the only screen, and the
glasses talk back through their speakers. The user starts a session, pockets the phone and taps the glasses: one tap
takes a photo, two taps take a photo and speak an answer, three taps let them ask anything. An AI "brain" answers,
reads menus and signs through "lenses" (Scene, Heritage, Food, Read text, Translate, Menu, Price, Receipt, Flight
board), logs meals and spends, and runs a travel kit: bookings, "take me home", cards to show a driver or a waiter,
and an offline pack.

The app has five tabs: Chat, Photos, Trip, Food, Glasses. We are redesigning the existing screens, not adding
features.

Rules for every screen image:
- Exactly ONE Android phone screen, flat and front-on, 412 x 915 dp proportions (about 9:20), rounded screen corners.
  No phone frame, no hands, no perspective, no drop shadow, no background scene. Centre it on a plain #DADADA
  background in a portrait 2:3 image.
- Include the Android status bar (10:42, Wi-Fi, battery 78%) and a thin gesture bar at the bottom.
- Tab screens show the bottom navigation: Chat, Photos, Trip, Food, Glasses, each a line icon over a label; the
  active tab in the accent colour. Pushed screens (details, cards) have no tab bar.
- Use exactly the words I give you, in British English. Do not add buttons, features, badges, numbers or text I did
  not list. If something does not fit, leave it out rather than inventing.
- Icons: simple line icons on a 24 px grid, 1.75 px stroke, rounded caps and joins (Lucide style). No emoji.
- Crisp, flat, production UI. Legible text. 8 dp spacing grid, 16 dp side margins, 48 dp minimum touch targets.
- Keep the approved visual system identical across screens: same colours, fonts, radii, icon style, card style.
```

After round 1 (the style tile), add one more paragraph to the project instructions describing the approved
direction, and upload the approved style tile and, later, the approved Chat screen (S03) to the project files.

---

## Round 1 — the visual system

### D00 · Style tile — `d00-style-tile.png`

Generate all three directions in separate chats, pick one, then refine it. Direction A keeps the current app's
identity and costs the least code; B and C are real alternatives.

```text
Create a UI style tile (a one-page design system sheet) for Fieldnote, landscape 3:2, flat, on a plain #DADADA
background. Show, clearly labelled:
- The wordmark "Fieldnote".
- Colour swatches with their hex codes.
- A type scale: Display 30, Headline 26, Title 20, Title small 15 semibold, Body 15, Body 14, Small 12,
  LABEL 12 CAPS LETTER-SPACED.
- Buttons: primary "Start session", ghost "End session", disabled "Add".
- Chips: "All" (selected), "Photos", "Favourites"; lens chips "Scene", "Menu" (selected), "Translate".
- A card: photo thumbnail, title "Okonomiyaki", line "12:40 · 24 g protein", right-aligned "610 kcal".
- A chat pair: user bubble "What's this dish?" and a reply bubble "Okonomiyaki, a savoury cabbage pancake."
- A status pill with a dot: "Glasses on".
- A round session indicator reading "Ready" / "on for 24 min".
- A checklist row with a tick: "Glasses linked to Fieldnote" / "Fieldnote can use the camera".
- A text field with placeholder "Ask or tell me anything" and a round microphone button.
- The five-tab bottom bar: Chat, Photos, Trip, Food, Glasses.
- A small white "card to show someone" sample: large black text "Hotel Gracery Shinjuku" on white.

Direction: <paste ONE of the three directions below>
```

- **A · Evolved Fieldnote (recommended).** Warm charcoal dark: background #141416, cards #1F2022 with 1 px #34363A
  borders, warm off-white text #F3F0E9, muted text #A39E94, one orange accent #E8742C, teal #5FB3A6 for "on / done",
  amber #E9A23B for "working", red #D9574A for errors. Display font Bricolage Grotesque semibold (a characterful
  grotesque), body IBM Plex Sans. 16 dp card radius, 14 dp button radius, generous spacing. Calm and tactile, like a
  field journal at night.
- **B · Field journal.** Light and warm for outdoor use: paper #F6F1E7, ink #1D1B18, pencil grey #6B665E, hairline
  rules like a notebook, accent ink blue #2F5BD3, photos as slightly rounded prints. Display font a soft serif
  (Fraunces), body IBM Plex Sans. Readable in sunlight.
- **C · Instrument.** True black #000000 for OLED, white text, one signal red #D71921 accent, dot-matrix numerals for
  big numbers (session state, calories, money), IBM Plex Mono for labels, thin 1 px white-at-15% rules, almost no
  fills. Precise and technical, like a device readout.

Refine the chosen one with image comments (click a spot, say what to change) until the swatches, type and components
are right. Then, in the same chat:

```text
List the final design tokens of this style tile as JSON with exactly these keys, so a developer can copy them:
colour: Bg, Bar, Card, Card2, Tile, Line, Line2, Ink, Ink2, Muted, Accent, Teal, Amber, Red (hex);
type: headlineLarge, headlineMedium, titleLarge, titleMedium, bodyLarge, bodyMedium, bodySmall, labelLarge,
labelMedium, labelSmall (font, weight, size in sp, line height in sp); radius: card, button, chip, tile, sheet;
fonts: display, body. Use the values you actually drew.
```

Paste the answer into `design/tokens.json` (keep the file's key names) and set `"direction"`.

### D01 · Icon sheet — `d01-icons.png`

```text
Using the approved style tile, draw one consistent icon sheet: 24 px grid, 1.75 px stroke, rounded caps and joins,
Lucide style, each icon labelled underneath, 6 per row, in the accent and ink colours on the app background.
Icons: chat, photos (grid), trip (suitcase), food (plate), glasses, camera, microphone, send (arrow up),
attach photo, heart, share, delete (bin), read aloud (speaker), place (map pin), back (chevron left), close (x),
add (plus), done (check), warning, car, allergy, speech bubble with translation, emergency (plus in a circle),
offline (cloud off), receipt, currency, calendar, plane, bed, train, sparkle (AI), eye (lens), sliders (settings),
pulse (diagnostics), battery, link.
```

Codex does not trace this image. It picks the matching Lucide icons by name and uses this sheet only to check the
choice and weight.

### D02 · App icon (optional) — `d02-app-icon.png`

```text
Design the Android launcher icon for Fieldnote in the approved style: a simple, bold symbol that combines a notebook
page (field notes) with a pair of glasses or a lens, centred in the 66% safe zone of a 108 x 108 adaptive icon, flat,
two or three colours from the palette, no text. Show it large, then at 48 px, on light and dark wallpaper.
```

---

## Round 2 — the hero screen

Get this one right before anything else. Every later prompt attaches it, so it sets the look for all screens.

### S03 · Chat, conversation (hero) — `s03-chat.png`

- Code: `ui/ChatScreen.kt` (`ChatScreen`, `Bubble`, `RoundButton`)
- Attach: `d00-style-tile.png`, `design/before/chat.png`
- States Codex builds: empty (S02), conversation, brain thinking ("Thinking…" + spinner), listening (mic button red,
  placeholder "Listening…"), photo attached (thumbnail + "Photo attached" + "Remove"), no API key, session off.

```text
Screen S03 · Chat (conversation), the app's home tab. Active tab: Chat.
Top to bottom:
1. Header: large title "Tokyo trip" with a small accent line under it "3 chats ▾ · auto-sorted by topic" (tappable,
   opens the chat list). Right: a pill "Glasses on" with a teal dot.
2. Conversation:
   - User bubble (right, accent colour) with a small photo above it (a plate of okonomiyaki on a griddle):
     "What's this dish?" and a small microphone mark meaning it was spoken.
   - Action line (left, small, teal, with a 40 dp photo thumbnail): "Took a photo · Menu lens".
   - Reply bubble (left, card colour): "Okonomiyaki: a savoury cabbage pancake with pork, topped with mayo, sauce and
     bonito flakes. Contains egg and fish, no peanuts. ¥980, about ₹550."
     Under it, tiny muted text: "gpt-5.6-sol · 2.4 s".
   - User bubble: "Log it as lunch".
   - Action line with a small plate icon: "Logged a meal · 610 kcal".
   - Reply bubble: "Logged as lunch: about 520–700 kcal and 24 g protein. You're at 1,240 of 2,000 kcal today."
3. A row of suggestion chips (scrolls sideways): "Take me home", "What did I spend today?", "Translate this sign".
4. Input bar: round attach-photo button, a rounded text field "Ask or tell me anything", round microphone button.
   Under it, small muted hint: "Attach your latest photo · or speak".
5. Bottom tab bar.
```

When it's approved: upload it to the project files as the hero.

---

## Round 3 — every other screen

Attach to every prompt: `d00-style-tile.png`, `s03-chat.png` (hero), and the matching `design/before/` screenshot if
you have one. Start each prompt with: **"Same visual system as the attached style tile and Chat screen."**

Priority: screens marked **MVP** first (they cover every component type); the rest reuse the same parts.

### S01 · Welcome (first run) — `s01-welcome.png`

- Code: `MainActivity.kt` (`Welcome`, `Step`) · States: only this one.
- Copy change allowed: the intro may be shortened; keep the four steps' meaning.

```text
Screen S01 · Welcome, shown once on first launch. No tab bar.
Top to bottom:
1. Wordmark "Fieldnote" and one line: "Your glasses, with a brain."
2. A simple illustration of three gestures on the glasses' temple, as three small labelled rows:
   "1 tap · Photo", "2 taps · Photo + spoken answer", "3 taps · Ask anything".
3. A card titled "Four steps" with numbered rows:
   1 "Allow the permissions when asked. Location is optional."
   2 "Glasses tab → Setup → Link the glasses. Developer Mode must be on in the Meta AI app."
   3 "Glasses tab → Answers → paste your OpenRouter key and tap Test key."
   4 "Start a session, pocket the phone, and tap or talk."
4. Primary button at the bottom, full width: "Let's go".
```

### S02 · Chat, empty — `s02-chat-empty.png`

- Code: `ui/ChatScreen.kt` · States: no key ("Add my key" button), session off, ready.

```text
Screen S02 · Chat, empty state. Active tab: Chat.
1. Header: title "New chat", accent line "Chats ▾". Right: pill "Glasses off" with a grey dot.
2. Big friendly heading: "Hi. I'm the brain of your glasses."
   Body: "Start a session in Glasses and I can take photos for you. Or ask me anything here."
3. Suggestion chips (wrap to two rows): "What's in my last photo?", "How much have I eaten today?",
   "Log: two rotis, dal and salad", "What did I photograph today?"
4. Input bar as in the Chat screen, with the hint "Attach your latest photo · speak · start a session for live photos".
5. Bottom tab bar.
```

### S04 · Chat list — `s04-chats.png`

- Code: `ui/ChatScreen.kt` (the `showChats` branch) · States: pinned (shows the Auto button), auto.

```text
Screen S04 · Chats list (opened from the Chat title). Active tab: Chat.
1. Header: title "Chats", accent line "Tap one to open it".
2. Primary button, full width: "New chat" with a plus icon.
3. Small muted help text: "Say "new topic" or "back to <chat name>" to switch by voice."
4. Ghost button, full width: "Auto: let the brain pick the chat".
5. List of chat cards, each with title, a two-line muted preview and time, and a red "Delete" text action:
   - "Tokyo trip" (accent, current) · "Logged as lunch: about 520–700 kcal… · 2 min ago"
   - "Food" · "You're at 1,240 of 2,000 kcal today · 1 h ago"
   - "Earlier chat" · "Kaminarimon is the outer gate of Sensō-ji… · Yesterday"
6. Bottom tab bar.
```

### S05 · Photos — `s05-photos.png` · MVP

- Code: `ui/GalleryScreen.kt` (`GalleryScreen`, `Badge`, `ArmPill`) · States: loading ("Reading your albums…"),
  empty, filter with no results, selecting (N selected + Delete / Done + tick overlays), delete confirmation dialog,
  hidden-count footer.

```text
Screen S05 · Photos. Active tab: Photos.
1. Header: large title "Photos". Right: a pill with an orange dot "Ready" and muted "Taps".
2. Filter chips: "All" (selected), "Photos", "Videos", "Analysed", "Favourites".
3. A slim status card: "2 analysing" (title) and muted "Last capture 3 min ago".
4. Section label "TODAY" with "9 items" on the right, then a 3-column grid of square photos with 4 dp gaps:
   travel photos in Tokyo (a temple gate, a menu board, a ramen bowl, a street crossing, a train platform sign,
   a receipt, a vending machine, a shrine, a hotel lobby). Tiny corner badges: "F" (Fieldnote capture) or "G"
   (glasses album) top-left; a small status dot bottom-right on some (amber = analysing, teal = analysed);
   one tile has a small heart; one tile is a video with "0:14" top-right.
5. Section label "YESTERDAY" with "5 items", first row of its grid.
6. Bottom tab bar.
```

### S06 · Photo detail — `s06-photo-detail.png` · MVP

- Code: `ui/DetailScreen.kt` (`DetailScreen`, `RoundButton`, `Tag`, `LensChip`) · States: nothing asked yet ("Ask
  with the … lens"), thinking, answered thread, failed / waiting for network ("The photo is safe. Retry when ready."),
  video, logged as meal, logged as expense, glasses session busy, delete / hide confirmation.

```text
Screen S06 · Photo detail. Pushed screen, no tab bar.
1. Top 40% of the screen: a full-bleed photo of Kaminarimon gate (the big red lantern at Sensō-ji, Tokyo).
   Over it: a round back button top-left; top-right three round buttons: heart, share, delete.
   Bottom-left of the photo, small dark tags: "Fieldnote" (bold), "Today 10:42", a map-pin icon + "Asakusa, Tokyo".
2. A sheet rising over the photo (rounded top corners, a small grab handle):
   - A sideways-scrolling row of lens chips: "Scene", "Heritage" (selected), "Food", "Read text", "Translate",
     "Menu", then "+ Log as meal", "+ Log as expense".
   - Your question, right-aligned in a grey bubble with a tiny label "You, by voice": "What's this gate?"
   - An answer card: tiny muted header "Heritage · gpt-5.6-sol · 3.1 s" with a speaker icon on the right, then:
     "Kaminarimon, the Thunder Gate: the outer gate of Sensō-ji, Tokyo's oldest temple. The lantern weighs about
     700 kg. The gate was rebuilt in 1960 after a fire."
3. Bottom input row: a round accent microphone button, a rounded field "Ask a follow-up" with a "Send" text button.
```

### S07 · Trip, empty — `s07-trip-empty.png`

- Code: `ui/TripScreen.kt` · States: opening ("Opening your trips…"), no trip, import running (see S10), paste dialog.

```text
Screen S07 · Trip, no trip yet. Active tab: Trip.
1. Large title "Trip".
2. A welcoming card: an illustration-free suitcase icon, title "No trip yet", body:
   "Share booking emails, PDFs or screenshots to Fieldnote: pick "Add to trip" in the share sheet."
   "Or paste a booking here. Fieldnote reads it and builds the trip."
   Primary button "Paste a booking", ghost button "Choose screenshots or PDFs".
3. Below, a muted card "Traveller profile" (collapsed) with "Show".
4. Bottom tab bar.
```

### S08 · Trip, top half — `s08-trip.png` · MVP

- Code: `ui/TripScreen.kt` (`TripScreen`, `NowCard`, `CardsGrid`, `PackCard`) · States: several trips (chips: Auto +
  one per trip), viewing a trip that isn't the active one ("Use this trip" / "Back to …"), no stay yet, far from the
  stay (> 3 km: driving), pack not prepared / preparing (step text) / prepared / allergy card stale, delete-trip
  confirmation.

```text
Screen S08 · Trip (top of a long scrolling screen). Active tab: Trip.
1. Header row: large title "Trip"; right, a muted text action "Delete trip".
2. Trip name "Tokyo, October" (title) and muted "Tokyo, Japan · 3–9 Oct".
3. Chips: "Auto" (selected), "Tokyo, October", "Goa, December".
4. "NOW" card (the most prominent card):
   muted "Staying at", title "Hotel Gracery Shinjuku", muted "1.2 km · about 15 min on foot",
   muted "You: Shibuya", primary full-width button "Take me home",
   two ghost buttons side by side: "Driver card", "Call",
   muted line: "Next: Shinkansen to Kyoto, Tue 6 Oct 09:03".
5. "CARDS TO SHOW": a 2 x 2 grid of small cards, each with an icon, a title and a muted line:
   "Driver · Address for a taxi", "Allergy · For waiters and cooks", "Phrases · Say it or show it",
   "Emergency · Numbers to call".
6. "OFFLINE PACK" card: four rows with ticks: "Exchange rate · ¥1 = ₹0.57", "Phrases · 36 in Japanese",
   "Map points · 4 stays and bookings", "Reading and translation · downloaded".
   Ghost button "Refresh offline pack", muted note "Do this on Wi-Fi before you fly."
7. The screen continues below (cut off by the tab bar).
8. Bottom tab bar.
```

### S09 · Trip, bookings and money — `s09-trip-money.png`

- Code: `ui/TripScreen.kt` (`Timeline`, `BookingRow`, `MoneySection`, `PinsSection`) · States: booking row expanded
  (its action buttons), no bookings, no spends, over daily budget (amber), unconverted spends warning, adding a spend,
  no notes.

```text
Screen S09 · Trip, scrolled down (same screen as S08, lower part). Active tab: Trip.
1. "BOOKINGS": a vertical timeline, grouped by local day, each row with a kind icon, title, local time and a muted
   reference:
   "Sat 3 Oct" · plane "Flight to Tokyo · lands 07:40 (Haneda)" · "Ref QX7P2L"
   "Sat 3 Oct" · bed "Hotel Gracery Shinjuku · 3–6 Oct" · "Ref 88213094"
   "Tue 6 Oct" · train "Shinkansen to Kyoto · 09:03" · "Car 7, seat 12A"
   "Fri 9 Oct" · plane "Flight to Delhi · 11:15 (Haneda T3)".
2. "MONEY" card: two big figures side by side: "Today ₹4,820" with muted "of ₹8,000 a day", and "Trip ₹31,560" with
   muted "14 spends". Below, four category bars: Food ₹12,400, Transport ₹9,860, Shopping ₹6,300, Tickets ₹3,000.
   Muted note "Converted at today's rate".
   Two recent spends: "Taxi · ¥2,400 · ≈ ₹1,370 · Today 21:10", "Ichiran ramen · ¥1,180 · ≈ ₹673 · receipt".
   A row: text field "taxi 2400 yen" and a primary "Add" button; ghost button "Export CSV".
3. "NOTES AND PLACES": two rows with a map-pin icon: "The café on the corner does good dosa · Shibuya · 2 h ago",
   "Where I parked the bikes · Asakusa · Yesterday" (with a small photo thumbnail).
4. Collapsed card "Traveller profile" with "Show".
5. Bottom tab bar.
```

### S10 · Add to trip (share sheet import) — `s10-add-to-trip.png`

- Code: `ui/ImportScreen.kt` · States: preview of shared text / files (some couldn't be opened), reading ("Reading your
  booking…"), added (with "Open trip"), failed ("Try again").

```text
Screen S10 · Add to trip. Opened from Android's share sheet. Pushed screen, no tab bar.
1. "Back" text button with a chevron, then large title "Add to trip".
2. Section label "TEXT": a card showing the start of a shared email:
   "Your booking is confirmed — Hotel Gracery Shinjuku, check-in Sat 3 Oct from 14:00, check-out Tue 6 Oct…"
3. Section label "2 FILES": two rows with a file icon: "e-ticket-shinkansen.pdf", "Screenshot_2026-09-21.png"
   (with a small thumbnail).
4. Primary button, full width: "Add to trip".
   Muted note: "Fieldnote sends this to your model provider to read the bookings, then files them into the right trip."
```

### S11 · Driver card — `s11-card-driver.png` · MVP

- Code: `ui/CardScreen.kt` (`DriverCard`, `CardButton`, `CloseButton`, `SpeakButton`, `VoiceNote`) · Always light
  (white). States: no stay saved, no local-script address yet ("Prepare the offline pack…"), speaking.
- Note: ChatGPT often garbles Japanese in images. That's fine; Codex uses the real strings from the offline pack.

```text
Screen S11 · Driver card: full screen, shown to a taxi driver in daylight. This screen is WHITE with near-black text,
very large type, no tab bar, no dark theme.
1. Top-left: a large close (x) button; muted grey label "For the driver".
2. Muted grey: "Hotel Gracery Shinjuku".
3. Huge bold address in Japanese (about 40 sp): "東京都新宿区歌舞伎町1-19-1".
4. Grey, 20 sp: "1-19-1 Kabukicho, Shinjuku-ku, Tokyo".
5. A thin grey rule, then 28 sp: "このホテルまでお願いします。" and under it, grey: "Please take me to this hotel."
6. Phone number in 26 sp semibold: "+81 3-1234-5678".
7. Two big buttons side by side: filled black "Speak it" with a speaker icon, outlined "Navigate".
8. Small grey note: "Turn the volume up; the phone speaks it in Japanese."
```

### S12 · Allergy card — `s12-card-allergy.png`

- Code: `ui/CardScreen.kt` (`AllergyCard`) · Light. States: no allergies in profile, pack missing, stale.

```text
Screen S12 · Allergy card, shown to a waiter or cook. WHITE, near-black text, very large type, no tab bar.
1. Close button and grey label "Allergy card".
2. Huge bold (about 36 sp): "私はピーナッツアレルギーです。" then 24 sp:
   "ピーナッツやピーナッツ油を使った料理は食べられません。"
3. Grey English under it: "I have a peanut allergy (medical). I can't eat dishes with peanuts or peanut oil."
4. A soft grey box: "Carries an adrenaline pen".
5. Two big buttons: filled black "Speak it", outlined "Show larger".
```

### S13 · Phrases — `s13-card-phrases.png`

- Code: `ui/CardScreen.kt` (`PhrasesCard`, `BigPhrase`, `LightChip`) · Light. States: situation picked, big phrase
  full screen (rotated to show someone), pack missing.

```text
Screen S13 · Phrases. WHITE, near-black text, no tab bar.
1. Close button and grey label "Phrases".
2. Light chips in a row: "Taxi", "Hotel", "Restaurant" (selected, black fill), "Pharmacy", "Shop", "Help".
3. A list of phrase rows, each with the Japanese large (24 sp), the English small and grey under it, and a small
   speaker icon on the right:
   "ピーナッツ抜きでお願いします。" / "No peanuts, please."
   "おすすめは何ですか？" / "What do you recommend?"
   "お会計をお願いします。" / "The bill, please."
   "これはいくらですか？" / "How much is this?"
```

### S14 · Emergency card — `s14-card-emergency.png`

- Code: `ui/CardScreen.kt` (`EmergencyCard`) · Light. States: no country known, no stay, no contacts.

```text
Screen S14 · Emergency. WHITE, near-black text, very large type, no tab bar.
1. Close button and grey label "Emergency".
2. Grey: "Japan". Then big rows, each a number in huge bold type with its label and a "Call" button:
   "110 · Police", "119 · Fire and ambulance".
3. Grey rule. "Your stay": "Hotel Gracery Shinjuku", "+81 3-1234-5678".
4. "Emergency contacts": "Riya (sister) · +91 98xxxxxx10".
5. Small grey note: "Built-in numbers, September 2026. Confirm locally."
```

### S15 · Food — `s15-food.png` · MVP

- Code: `ui/FoodScreen.kt` (`FoodScreen`, `Stat`, `Ring`, `MealRow`) · States: no meals yet, over target, a meal with
  "one question" (amber).

```text
Screen S15 · Food. Active tab: Food.
1. Large title "Food".
2. "TODAY": two concentric progress rings (outer = calories in accent, inner = protein in teal) with "1,240" and
   muted "kcal" in the middle; beside them two stats: "Calories 1,240 / 2,000" and "Protein 58 / 90 g".
3. "LAST 7 DAYS": seven slim vertical bars (Thu to Wed), the last one highlighted, a faint target line.
4. "MEALS": three rows, each with a square food photo, title, muted line and big kcal on the right:
   "Okonomiyaki · 12:40 · 24 g protein · 610 kcal",
   "Onigiri and green tea · 08:15 · 9 g protein · 280 kcal",
   "Matcha latte · 16:05 · 6 g protein · one question" (the line in amber) "· 190 kcal".
5. Bottom tab bar.
```

### S16 · Meal detail — `s16-meal.png`

- Code: `ui/FoodScreen.kt` (`MealScreen`) · States: removed meal, updating estimate ("Working…").

```text
Screen S16 · Meal detail. Pushed screen, no tab bar.
1. Top row: accent "‹ Food" on the left, red "Remove" on the right.
2. A wide rounded photo of the okonomiyaki.
3. Title "Okonomiyaki", muted "Today 12:40 · medium confidence · gpt-5.6-sol".
4. Two stat cards side by side: "CALORIES 520–700" and "PROTEIN 20–28 g".
5. Items list with right-aligned muted numbers: "Cabbage pancake · 300–380 kcal · 9 g", "Pork belly · 150–200 kcal ·
   11 g", "Mayo and sauce · 60–100 kcal · 0 g", "Bonito flakes · 10–20 kcal · 4 g".
6. Card "ONE QUESTION" in amber: "Was there pork or seafood inside?"
7. "CORRECT IT": a text field "It had squid, not pork" and a primary full-width "Update estimate".
```

### S17 · Glasses, session — `s17-glasses.png` · MVP

- Code: `ui/GlassesScreen.kt` (header) + `ui/SessionScreen.kt` (`SessionBody`, `Seg`, `Legend`) · States: Off, Ready,
  Photo, Listening, Thinking, Answering, Paused (ring colours: line / accent / amber), needs attention (amber "!"),
  wake word locked (hint), wake word running (minutes left), last error (red), no glasses linked.

```text
Screen S17 · Glasses (top: the live session). Active tab: Glasses.
1. Large title "Glasses"; under it a teal dot and muted "Ray-Ban Meta".
2. The session card (the hero of this tab): a large ring (about 150 dp) in the accent colour with "Ready" inside and
   muted "on for 24 min"; under it a teal tick and "All good. You can lock your phone."; a full-width ghost button
   "End session".
3. A two-part segmented control: "Taps" (selected) and "Wake word · 20 min".
4. Three ghost buttons in a row: "Photo", "Photo + answer", "Ask".
5. "LAST ANSWER" card: "“Kaminarimon, the Thunder Gate: the outer gate of Sensō-ji…”" and accent "Open the photo".
6. Gesture legend card, four rows: "1 · Tap · Take a photo", "2 · Double-tap · Photo + spoken answer (Heritage)",
   "3 · Triple-tap · Ask anything, then speak", "Shutter button · Meta's own photo, shows up later".
7. Bottom tab bar.
```

### S18 · Glasses, setup — `s18-glasses-setup.png`

- Code: `ui/GlassesScreen.kt` (`Section`, `CheckRow`, `TestRow`, `ManualTest`) · States: each check done / needs
  action (with its button: Link, Allow), test not run / passed / failed, Test A taps log, manual tests C and D open.

```text
Screen S18 · Glasses, scrolled to Setup. Active tab: Glasses.
1. Section header "SETUP · NEEDS ATTENTION" with accent "Hide".
2. Check rows, each with a round status mark, title, muted line and an optional small button:
   tick "Glasses linked to Fieldnote" / "Fieldnote can use the camera";
   tick "Permissions" / "Bluetooth, microphone, notifications, photos";
   warning "Keep running in the background" / "Needed so Android doesn't close the session" [Allow];
   empty circle "Location (photo places, take me home)" / "Optional. Tags photos with places and finds the way back
   to your stay" [Allow].
3. Test rows: green tick "Test A · Taps reach Fieldnote" / "pass · 12 taps received" [Re-run];
   red cross "Test B · Photo speed" / "median 11.0 s (target 4 s)" [Re-run];
   empty "Test C · Recovers after interruptions" / "Not run" [Run];
   empty "Test D · Wake word" / "Not run" [Run].
4. Collapsed section headers: "ANSWERS" [Show], "MORE GLASSES OPTIONS" [Show], "DIAGNOSTICS" [Show].
5. Bottom tab bar.
```

### S19 · Glasses, answers (key and models) — `s19-glasses-answers.png`

- Code: `ui/GlassesScreen.kt` (Answers section, `ModelPicker`, `Field`, `ToggleRow`) · States: no key, key test
  running / ok / failed, model picker open, spend cap reached.

```text
Screen S19 · Glasses, Answers section expanded. Active tab: Glasses.
1. Section header "ANSWERS" with accent "Hide".
2. "API key": muted help "Paste an OpenRouter key (sk-or-…) or an OpenAI key (sk-…). It stays on this phone.",
   a masked field "sk-or-••••••••••3f9a", accent text button "Test key", muted "Provider: OpenRouter".
3. "Brain (decides what to do)": a row "Brain · gpt-5.6-sol ›", muted help "GPT-5.6 Sol is the default; Luna is
   cheaper and faster."
4. "Eyes (looks at photos), per lens": rows "Scene · gemini-2.5-flash ›", "Menu · gpt-5.6-sol ›",
   "Translate · gpt-5.6-luna ›".
5. "Double-tap lens": chips "Scene", "Heritage" (selected), "Food", "Read text", "Translate".
6. "Spoken answer length" with muted "Say "more" to continue": chips "10 s", "15 s" (selected), "25 s".
7. "Daily spend cap (USD)": field "2.00", muted "used 0.84 today".
8. Bottom tab bar.
```

### S20 · Traveller profile — `s20-profile.png` (optional)

- Code: `ui/TripScreen.kt` (`ProfileSection`) · States: empty profile, editing.

```text
Screen S20 · Trip, Traveller profile expanded (a form). Active tab: Trip.
1. Section header "TRAVELLER PROFILE" with accent "Hide"; muted: "Stays on this phone. A short summary goes with your
   questions so answers, cards and phrases fit you."
2. Fields: "Home currency" [INR], "Languages you speak" [English, Hindi], "Diet" [Vegetarian except fish],
   "Allergies" [Peanuts: medical, I carry an adrenaline pen] with muted help, "Daily budget (INR)" [8000],
   "Interests" [Temples, street food, design shops], "Walking pace" chips "Slow", "Average" (selected), "Fast",
   "Emergency contacts" [Riya (sister) +91 98xxxxxx10] with muted "Shown on the emergency card. Nothing is sent
   automatically."
3. Bottom tab bar.
```

---

## Not drawn in ChatGPT (Codex builds them from the system)

- The lock-screen notification (Photo / Ask / End). Android draws it; only the small icon and the words are ours.
- Dialogs (delete, paste a booking, confirm), toasts, the "More glasses options" and "Diagnostics" sections: standard
  components from the style tile.
- Every state listed under a screen that its image doesn't show.

## Sample data (for `ui/preview/SampleData.kt`)

Everything above in one place, so previews match the mockups: trip "Tokyo, October" (Tokyo, Japan, 3–9 Oct), a second
trip "Goa, December"; stay Hotel Gracery Shinjuku (1-19-1 Kabukicho, Shinjuku-ku, Tokyo · 東京都新宿区歌舞伎町1-19-1 ·
+81 3-1234-5678), 1.2 km away; four bookings as in S09; money as in S09 (home currency INR, ¥1 = ₹0.57, budget ₹8,000 a
day); meals as in S15/S16 (targets 2,000 kcal, 90 g protein); the chat in S03; photo detail in S06; session Ready for
24 min; tests as in S18; profile as in S20. The phone number and emergency contact are fictional placeholders.
