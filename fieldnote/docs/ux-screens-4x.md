# Fieldnote 4.x: key screens mockup spec

Companion to `ux-plan-4x.md` (revised after review; plan section N logs the changes). Eighteen phone screens that show the plan at a
glance: frames 1–12 are the core surfaces, frames 13–18 the ChatGPT-parity surfaces ask 1 is judged on. Frame: **390 × 844 px**
(1 px = 1 dp), dark theme. Everything here is sample data for an Indian owner at home in Delhi and on a trip to Japan. Rates: 1 USD =
₹95.65; ¥1 = ₹0.57 ("13 Oct rate"). Business names are invented. Frames show the finished design; the release that first ships each
frame is in its heading.

---

## 0. Shared rules for every frame

**Type** (Bricolage Grotesque for display, IBM Plex Sans for text, IBM Plex Mono for ids; tabular figures for all numbers)

| Token | Spec | Use |
|---|---|---|
| display | Bricolage 600, 34/40 | kcal hero, money hero |
| headline | Bricolage 600, 26/32 | tab titles, Plateful wordmark |
| title | Bricolage 500, 18/24 | top-bar titles, card titles |
| body-lg | Plex 400, 16/24 | answers, turns |
| body | Plex 400, 14/20 | rows, secondary text |
| label | Plex 600, 14/20 | buttons, chips |
| eyebrow | Plex 600, 11/16, uppercase, +0.6 tracking | turn meta lines, section heads |
| caption | Plex 400, 12/16 | timestamps, hints |
| mono | Plex Mono 400, 13/20 | model ids, codes |

**Colours:** bg #141416 · surface #1A1B1D (bars, composer, sheets) · card #1F2022 · card-2 #26282C (your turns, inputs) · line #34363A ·
line-soft #2C2E32 · text #F3F0E9 · text-2 #D6D1C7 · muted #A39E94 · accent #E8742C (on-accent #1A1206) · accent-soft = accent 14% ·
**glasses teal #5FB3A6, used only for things from the glasses** · **protein #7FA0D0** · warning #E9A23B · **danger #E36B5F** (≥ 4.5:1
on every dark surface) · hatch = text-2 30% at 45°. Success ticks use text-2 or accent, never teal.

**Layout:** status bar 24 · top bar 56 · side gutter 16 · card radius 16 · chip radius 12 · button radius 14 · input radius 22. Every
height in this spec is a **minimum** (`heightIn(min=…)`): chips 36, context row 32, rows 56 / 72, primary buttons 52, secondary 48,
so nothing clips at 200% font size. **Every touch target is ≥ 48**, even where the drawn icon or circle is 40 or 44 (answer icon row,
photo overlay buttons, steppers). Bottom nav 64 with 4 items (Chat, Trip, Plateful, Photos; the active item has an accent-soft pill
behind the icon and an accent label; until 4.2 a fifth Glasses tab stays). **The bottom nav hides while the keyboard is open.**

**Icons:** Lucide line icons, 24, stroke 1.75, round caps; custom glyphs for glasses, Look (eye in brackets), plate and tap dots.
No emoji anywhere. Every icon has a text description for TalkBack; glasses turns read as "From glasses, double-tap Look, 13:02".

**Signature elements (use them consistently):**
- **Eyebrow meta line** above every answer: KIND · MODEL · SECONDS · ₹ (muted, eyebrow style).
- **Answers as notes:** full-width text with a 2 px left rule in line colour; no bubble.
- **Your turns:** right-aligned card-2 cards, radius 18/18/6/18, max 85% width.
- **Glasses rail:** anything that came from the glasses has a 3 px teal rail on its leading edge and tap dots in its eyebrow (●● Look,
  ●●● Ask, ↺ follow-up, ● photo).
- **Glasses pill** at the right of every top bar: 32 high, radius 16, teal dot + state word ("Ready", "Listening", "Looking",
  "Thinking", "Speaking", "Paused", "Low data · roaming"), grey dot + "Off". The pill is the only place the plain state shows.

---

## 1. Chat · conversation with glasses turns and attachments (3.6 / 4.0)

**Purpose:** the home screen. One conversation holding double-tap Looks, spoken follow-ups and a typed question with a PDF, all in
one place, live.

**Frame content, top to bottom**

1. **Status bar** 13:24.
2. **Top bar** (56): ≡ (drawer) · title **"Japan · Day 3"** (title style) with subline **"Kyoto"** (caption, muted) · glasses pill
   **"● Ready"** · ✎ (new chat).
3. **No glasses banner** in this state: the glasses are here and idle, and the pill already says so.
4. **Turn list** (scrolled; newest at the bottom):
   - Centred day divider (caption, muted): "Tuesday 13 October".
   - **Photo row** with teal rail: eyebrow "● PHOTOS · 12:48" and a strip of 3 thumbnails (56 × 56, radius 10): torii gate, lantern
     street, a bicycle rack.
   - **Look turn** (your capture): teal rail, eyebrow "●● DOUBLE-TAP · 13:02".
     Look card (card fill, radius 16): photo 358 × 200 (a laminated ramen menu in Japanese, top-cropped), overlay chip bottom-right
     **"MENU · JAPANESE"** (overlay #141416 at 80%, eyebrow text).
   - **Look answer** (note style): eyebrow "LOOK · GEMINI 3.8 FLASH · 3.1 s · ₹0.52" (the model is whichever wins the 3.5 bake-off).
     Bold first line (body-lg 600): "Menu, Japanese. Tonkotsu ramen, 980 yen, about ₹559, is the house special. The ebi tempura has
     shellfish." Then a Markdown table (body, horizontal scroll if needed):

     | Dish | ¥ | ₹ | Note |
     |---|---|---|---|
     | Tonkotsu ramen | 980 | 559 | pork-bone broth |
     | Yuzu shio ramen | 1,050 | 599 | chicken stock |
     | Gyoza (5) | 450 | 257 | pork |
     | Ebi tempura | 700 | 399 | **shellfish** (warning colour) |
     | Edamame | 350 | 200 | no meat or shellfish listed |

     Chips row: [Anything veg?] [Show allergy card] [Log meal] [Read it all].
   - **Your spoken turn** (right card with teal rail on its leading edge): eyebrow "↺ 13:03 · SPOKEN, NO TAP" (it came through the
     follow-up window after a reading Look), text "is the broth veg?"
   - **Answer**: eyebrow "↺ GPT-6 LUNA · 1.8 s · ₹0.11". "No. Tonkotsu is pork-bone broth, and the yuzu shio uses chicken stock. The
     edamame lists no meat or shellfish, but ask staff about dashi, since your shellfish allergy is marked medical."
   - **Your typed turn** (right card, no rail): eyebrow "13:20 · PHONE". Attachment chip inside the card (card fill, 56 high): PDF icon,
     "ryokan-booking.pdf", "3 pages · 1.2 MB". Text: "What time is check-in tonight, and is breakfast included?"
   - **Answer, streaming**: eyebrow "GPT-6 SOL · streaming…". Above the text, folded: "Thought for 4 s ›" (caption, muted). Text:
     "Check-in at **Hotel Gion Hanare** is from **3 pm**; the front desk closes at 11 pm, so tell them if you'll be later. Breakfast is
     **included on both nights** (page 2), served 7:00–9:30 in the" and a 2 px accent caret.
5. **"↓ New reply" pill** is not shown (you are at the bottom).
6. **Composer** (surface, top rule):
   - Context row (min 32): model chip **"Smart ▾"** (accent-soft fill) · **"Web: Auto"** chip · spacer · cost hint **"≈ ₹2.10"** (muted).
   - Input row (min 56): [+] 48 round · field "Message Fieldnote" (card-2, radius 22) · [mic] 48 · **[■ Stop]** 48 accent circle
     (because a reply is streaming).
7. **Bottom nav** (64): **Chat** (active) · Trip · Plateful · Photos.

**Components:** TopBar, GlassesPill, TurnAction (photo strip), TurnLook, TurnAssistant (markdown table, chips, folded thinking),
TurnVoice, TurnUser with AttachmentChip, Composer (ModelChip, Web chip, CostHint), BottomNav.

**States to show (small variants beside the frame)**
- **Thinking** (before the first word; new): in place of the streaming answer, a row with a small animated three-bar glyph and
  **"Thinking · 12 s"** (label, text-2), under it the live tool step in caption ("Searching the web…"), and a text button **Answer
  now** at the right. When reasoning summaries stream, they appear in caption, muted, under the row (max 3 lines, fading). Once the
  answer starts, the row folds into "Thought for 14 s ›" (tap to expand).
- **Glasses elsewhere:** teal banner (min 36) "Glasses are in *Wed 7 Oct* · **Continue here**".
- **Glasses speaking:** banner "Speaking on your glasses · **Stop**"; **paused:** "Taps are with your music · **Resume**".
- **Live glasses turn:** at the bottom of the list a teal row "◉ Listening…" (pulsing dot), then "Looking at the menu…" with a Stop
  icon.
- **After the stream:** icon row under the newest answer: copy · read aloud · retry · share · ⋯ (40 drawn, 48 touch).
- **Link turn** (in a topic chat that holds the glasses): one caption line with a teal glasses glyph: "Looked at: bookshop sign · Wed 7
  Oct ›".
- **Incompatible attachment:** above the composer: "*GPT-6 Sol can't watch video.* [Use Media for this message (≈ ₹0.80)] [Remove]"
  (4.3 adds "[Send 16 frames + transcript (≈ ₹3.10)]").
- **Last capture chip:** above the composer, "+ Last glasses photo · 2 min ago" (accent-soft chip with a thumbnail).
- **Offline:** banner (warning tint) "Offline · messages send when you're back (2 queued)"; a queued turn shows a clock icon and
  "Queued".
- **Budget used:** banner "Today's ₹200 is used · [Raise by ₹100 for today]". **At 80%:** the model chip reads "Quick ▾ · budget"
  with a caption "Typed chat is on Quick for the rest of today · Use Smart once".
- **No OpenRouter credit:** danger banner "OpenRouter credit is used up · **Top up ›**".
- **Moved notice:** centred caption "Glasses moved here from *Wed 7 Oct* · Undo · Move everything since 13:38 ›".
- **After time away (New chat):** empty conversation with starter cards; the first reads "Continue *Wed 7 Oct* · 14 turns ›".

---

## 2. Chat drawer (conversation list) (3.6 / 4.0)

**Purpose:** find, switch and manage conversations; see where the glasses are; see today's spend. Opens from ≡ only (a left-edge
swipe is Android's Back); swipe it shut once open.

**Frame:** the drawer (320 wide, surface fill) over the dimmed Chat screen (bg at 60% scrim).

1. **Search field** (48, card-2, radius 22): search icon + "Search chats".
2. **New chat** row (48): ✎ icon + "New chat" (label, accent).
3. **ON YOUR GLASSES** (eyebrow) card (card fill, teal rail): teal dot · **"Japan · Day 3"** (title) · "Kyoto · active 2 min ago"
   (caption). Right: "Change" (text button).
4. **PINNED** (eyebrow):
   - "Japan visa documents" · "Mon" · pin icon
   - "Kyoto ryokan shortlist" · "Sun" · pin icon
5. **TRIPS** (eyebrow) · **Japan · 11–19 Oct** (expandable, expanded):
   - "Day 3 · today" · subline "Nishiki market, Gion ramen" · glasses icon
   - "Day 2" · "Arashiyama, bamboo grove"
   - "Day 1" · "Osaka arrival, Dotonbori"
   - "Kyoto train passes" (a topic chat tagged to the trip)
6. **TODAY** (eyebrow): "Diwali gifts under ₹2,000" · "10:05".
7. **YESTERDAY**: "SIP vs FD for 3 years" · "21:40".
8. **THIS WEEK**: "Wed 7 Oct" · subline "Lodhi Garden, dal lunch" · glasses icon; "Mumbai–Pune Vande Bharat timings"; "Mom's knee MRI
   report" · PDF icon · **lock icon** (Private).
9. **EARLIER**: "Photos · Tue 16 Sep" (migrated answers).
10. **Footer** (surface, top rule): a thin bar at 24% (accent) with "₹48 of ₹200 today ›" (body) · row "Settings" with gear icon.

Rows: min 56 high, title body 600, subline caption muted, time caption right-aligned. The current conversation row has accent-soft
fill.

**States**
- **Long-press menu** on "Kyoto ryokan shortlist" (sheet): Rename · Unpin · Continue on glasses · Private · Move to trip · Export ·
  Delete (danger).
- **Deleted:** snackbar "Deleted *SIP vs FD for 3 years* · Undo" (8 s).
- **Search active:** see frame 17.
- **Empty (first run):** "Your chats appear here, glasses conversations too."
- **3.6 variant** (today's store): the same drawer without TRIPS and the date groups: New chat, search over titles, pinned chats, then
  all chats by recency, with the "Glasses · Wed 7 Oct" chats marked with the glasses icon.

---

## 3. Attach sheet (3.8)

**Purpose:** add anything to a message: phone camera, gallery, files, the glasses.

**Frame:** bottom sheet (surface, top radius 24, drag handle 36 × 4) over the Chat screen; sheet height about 520.

1. Title row: **"Add to this message"** (title) · right: "2 of 10" (caption, muted).
2. **Tile row** (4 tiles, 80 × 80, card fill, radius 16; icon 28 + label): **Camera** · **Video** · **Photos & videos** · **Files**.
3. **FROM YOUR GLASSES** (eyebrow):
   - Row (56, teal rail): glasses icon · **"Take a glasses photo now"** · caption "Full photo · about 12 s · you'll hear 'Hold still'".
   - Thumbnail strip (64 × 64, radius 10, horizontal scroll): torii gate 12:48 · lantern street 12:49 · ramen menu 13:02 (small teal
     "looked at" dot) · matcha and wagashi 11:20 · video tile with "0:14" badge ("Nishiki clip") · Fushimi Inari gates 09:05 · "All ›".
     In this frame two thumbnails and the video are selected (accent ring and check).
4. Two rows (56), muted with a "Soon" caption until 4.3: **Voice note** (mic icon, "up to 20 min") · **Paste** (clipboard icon).
5. Footer caption (muted): "Up to 10 items · 25 MB per message · videos up to 3 min".
6. **Sticky primary button** (52, full width, accent) at the bottom: **"Add 3"**. Hidden when nothing in the strip is selected.

**Behind the sheet (visible above it):** the composer with two chips: "ryokan-booking.pdf · 3 pages · Sends as PDF ✕" and "▶
nishiki.mp4 · 0:48 · Transcoding 43%" with a progress ring.

**States**
- **Glasses off:** the glasses row is disabled: "Start glasses to take a photo" with a [Start] text button.
- **Taking a glasses photo:** row shows a spinner "Hold still… 6 s".
- **Attachment chip states** (a strip of examples): Copying · Preparing 43% · Ready · Uploading 62% · Sent · Failed "Couldn't read
  this PDF · Retry · Remove" (danger outline).
- **Background upload:** the progress notification "Uploading nishiki.mp4 · 62%" (the phone can be locked).
- **Retry on mobile data:** dialog "Retry (27 MB)? You're on mobile data. [Retry] [Wait for Wi-Fi]".
- **Cost confirm** (dialog): "About ₹24: 40-page PDF on Best. [Send] [Use Smart (≈ ₹9)]".

---

## 4. Model picker (Model sheet) (3.6)

**Purpose:** choose a model for this chat in one tap, see capabilities and ₹ per reply, set thinking level.

**Frame:** bottom sheet (surface, top radius 24) about 700 high over Chat.

1. Header: **"Model for 'Japan visa documents'"** (title) · right "₹48 of ₹200 today" (caption).
2. **Tier rows** (min 72 each, radio at left, card fill when selected with accent ring):

| Tier | Line 1 | Line 2 (mono, muted) | Badges | Right |
|---|---|---|---|---|
| ○ Auto | "Auto · Quick for short questions, Media for video, Smart for long ones" | "Fieldnote rule" | — | "≈ ₹0.15–3.30" |
| ○ Quick | "Quick · GPT-6 Luna · Fast everyday answers" | `openai/gpt-6-luna` | Sees · Files · Tools | "≈ ₹0.15 / reply" |
| ● Smart | "Smart · GPT-6 Sol · Stronger reasoning and writing" | `openai/gpt-6-sol` | Sees · Files · Tools · Thinks | "≈ ₹3.30 / reply" |
| ○ Best | "Best · Claude Opus (latest) · Hardest problems, long documents" | `~anthropic/claude-opus-latest` | Sees · Files · Tools · Thinks | "≈ ₹6.50 / reply" |
| ○ Media | "Media · Gemini 3.8 Flash · Watches video, listens to audio" | `google/gemini-3.8-flash` | Sees · Video · Audio · Files · Tools · Thinks | "≈ ₹1.20 / reply" |

   Badges are 24-high chips with a line icon and a word (eye, film, headphones, file-text, wrench, brain). Under Media, a caption:
   "Stopping a reply doesn't stop billing on Google models."
3. **RECENT** (eyebrow): one row of chips: "Grok 4.7" · "Gemini 3.1 Flash-Lite" · "Qwen 3.8 Omni Flash". **STARRED** (eyebrow): "Kimi
   K3". One tap picks for this chat.
4. **THINKING** (eyebrow): chips ( Low ● ) ( Medium ) ( High ). Caption: "Applies from the next reply."
5. **Action row** (56): **"Make default for new chats"** (body) · right, caption: "Default now: Smart ›". It is a button, not a
   toggle: picking a tier above never changes the default.
6. Toggle row (48): **Also on glasses** (off; caption "Glasses normally use Luna for speed").
7. Rows with chevrons: **All models ›** (caption "about 440 text models · updated 3 h ago") · **Manage defaults ›**.

**States**
- **After a raw pick** (variant): a sixth row "● Custom · Grok 4.7 · `x-ai/grok-4.7`" is selected, and the composer chip reads "Grok
  4.7 ▾".
- **All models (second frame):** search field "Search models"; filter chips Sees · Video · Audio · Files · Tools · Thinks · Free (Video
  on); sort "Recommended ▾"; rows with a star at the right: "Gemini 3.8 Flash · Google · [New]" with "₹72 in / ₹359 out per 1M · ≈
  ₹1.20 / reply · 1M context"; "Gemini 3.1 Flash-Lite · ₹24 in / ₹143 out"; "Qwen 3.8 Omni Flash"; a row **"Gemini 2.5 Pro · [Retires
  20 Oct]"** (warning badge). No image-generation models are listed.
- **Catalogue offline:** caption "Prices from 21 Sep".
- **Retired notice** (in chat): "Gemini 2.5 Flash has retired; answered with Gemini 3.8 Flash. Change ›".
- **Long-press on the chip:** an inline change "Swapped to Media" under the chip for 2 s.

---

## 5. Glasses sheet (the old Glasses tab, now a sheet) (4.2)

**Purpose:** control the glasses and aim a Look from the phone; know where the glasses' answers are going.

**Frame:** full-height sheet (surface) opened from the glasses pill, over Chat.

1. Header row: "Glasses" (title) · right: gear (→ Settings › Glasses) · close ✕. (No battery figure: the glasses SDK does not give
   one. A "Glasses are warm" line appears only when the SDK reports heat.)
2. **Status ring** (96 diameter, 3 px teal ring, teal 8% fill) centred: **"Ready"** (title) and "on for 1 h 12 min" (caption). Under it
   (text-2, label): "✓ Safe to lock your phone".
3. Buttons row: **[End glasses]** (secondary, 48) · **[Pause taps · 30 min]** (secondary, 48).
4. Segmented control (48, card fill): **Taps** (selected) | Wake word · 20 min (disabled, caption "after Test D").
5. **Active conversation row** (56, teal rail): "Glasses are in **Japan · Day 3**" · caption "last turn 2 min ago" · [Change].
6. Row (48): "Double-tap does: **Look (auto)**" · caption "Say 'menu mode' to read menus for 30 min" · chevron.
7. **JUST NOW** (eyebrow) card: 72 × 72 menu photo · eyebrow "MENU · JAPANESE · 13:02" · text (2 lines): "Tonkotsu ramen, 980 yen (about
   ₹559), is the house special. The ebi tempura has shellfish…" · chips [Log meal] [Prices in ₹] [Open].
8. **QUICK LOOKS** (eyebrow) + caption "Abroad: reading first": 5 buttons (64 × 64, card fill, icon + label): **Read** · **Menu** ·
   **Price** · **Receipt** · **Look**.
9. **Gesture card** (card fill): "When busy, **1 tap stops**. **2 taps look**. **3 taps ask**. When idle, 1 tap takes a photo." ·
   caption "Shown for your first 7 days (day 4)".
10. Footer row: "All checks passed ›" (text-2 check).

**Related surface: the lock-screen notification** (draw as a 358 × 150 card below the frame, two versions side by side):
- **Locked (default):** title "Fieldnote · Ready", no answer text, actions **Look · Ask · End**.
- **Unlocked:** title "Ready · in Japan, day 3", text "Last: Tonkotsu ramen, 980 yen, is the house special…", actions **Look · Ask ·
  End**. (A Private chat is never named: "Ready · in your phone chat".)
- Speaking: title "Speaking", actions **Stop · Ask · End**.
- Paused for music: title "Paused · taps are with your music", text "Look and Ask still work here", actions **Look · Ask · Resume**.
- Paused by you: title "Paused · 24 min left", action **Resume**.

**States:** not linked ("Link your glasses" primary); needs attention (danger row "Bluetooth permission missing: taps won't reach
Fieldnote · Allow"); off (ring grey "Off", primary **Start glasses**); paused (ring warning colour "Paused", button "Resume taps");
partial photo access (warning row "Fieldnote can only see photos you picked · Allow all photos").

---

## 6. Trip · Today (3.9)

**Purpose:** the live trip dashboard: what you just looked at, one-tap Looks, where you stay, cards to show, today's journal. In 3.9
the new blocks sit on top of the 3.4 Trip tab; sub-tabs are in the backlog.

1. Top bar: **"Japan"** (title) + subline "Day 3 of 9 · Kyoto · Active ▾" (tap → trip switcher: browse any trip, "Make active" is a
   separate button) · glasses pill "● Ready" · ⋮ (Paste a booking, Export CSV).
2. **JUST NOW** card (the same component as the Glasses sheet): menu 13:02, 2-line answer, chips [Log meal] [Prices in ₹] [Open].
3. **QUICK LOOKS** (eyebrow) · caption "Glasses on: the glasses take the photo": **Read · Menu · Price · Receipt · Look** (5 × 64
   buttons).
4. **TODAY** journal (eyebrow + "₹2,400 of ₹8,000 today" right, caption):
   - 08:10 · plate icon · "Breakfast at the hotel · 420–520 kcal"
   - 09:40 · Look icon · "Sign at Kiyomizu-dera: no tripods on the stage"
   - 10:15 · receipt icon · "Entry, Kiyomizu-dera · ¥500 · ₹285"
   - 11:20 · photo icon · "3 photos · matcha and wagashi"
   - 12:05 · pin icon · "Bike parked at Gojo rack 14"
   - 13:02 · Look icon · "Menu at Kazehana · picks and ₹ prices"
   Each row min 48, thumbnail 40 × 40 where there is a photo; tap opens the turn in "Japan · Day 3".
5. **TO CONFIRM (1)** (eyebrow, warning): "Receipt · Marufuku Mart · ¥2,400 · ₹1,368" [Log] [Discard].
6. **Now card** (card, radius 20; the 3.4 block, unchanged): eyebrow "STAYING AT" · **"Hotel Gion Hanare"** (title) · "1.2 km to the
   north-east · about 15 min on foot" · buttons **[Take me home]** (primary) · [Driver card] · [Call] · caption "Next: Dinner at
   Kazehana · 19:30 · 600 m".
7. Below (collapsed preview, muted): "Cards · Offline pack ready · Bookings · Money · Notes" (the 3.4 blocks follow).
8. Bottom nav: Chat · **Trip** (active) · Plateful · Photos.

**States:** glasses off (Quick looks caption "Opens your phone camera"); viewing another trip (banner "Viewing *Goa, Dec 2025* only ·
[Make active] [Back to Japan]"); no trip ("No trip right now" with [Paste a booking] [Screenshots or PDFs]); location off (inline
"Allow location" button in the Now card).

---

## 7. Travel Look result (Photo detail for a sign) (3.9)

**Purpose:** everything about one glasses photo: the Look answer, the original script, follow-ups, "Look as" chips that run at once.

1. **Hero** (full width × 340): photo of a white sign with red Japanese text on a pole beside bicycles, night lighting. Overlay round
   buttons (44 drawn, 48 touch, overlay fill): ‹ back (top-left) · heart · share-2 · ⋮ (top-right). Bottom-left tags (caption on
   overlay): "Glasses" · "Tue 13 Oct, 21:10" · map-pin "Gion, Kyoto".
2. **Sheet** (surface, top radius 24, overlaps the hero by 24, handle):
   - **LOOK AS** (eyebrow) chips (one row, max 5): [Sign ✓] (selected) · [Read it all] · [Translate fully] · [Scene] · [Price].
   - **Answer card** (note style): kind chip **"SIGN · JAPANESE"**; eyebrow "LOOK · GEMINI 3.8 FLASH · FULL PHOTO · 15.2 s · ₹0.55";
     bold line: "No bicycle parking, 8 am to 8 pm. Bikes are removed; the release fee is 2,300 yen, about ₹1,311."
   - **Original** (quote block, card-2, Japanese text in body-lg): "駐輪禁止 8:00〜20:00 / 撤去した自転車の返還手数料 2,300円" and
     under it (caption) "Read on your glasses at 21:10".
   - **Your spoken follow-up** (right card, teal rail): "↺ 21:11 · so can I park here now?"
   - **Answer**: eyebrow "↺ GPT-6 LUNA · 1.6 s · ₹0.10": "Yes. It's 9:11 pm, and the ban runs 8 am to 8 pm. The sign says 8:00 to 20:00."
   - Link row: "In **Japan · Day 3** ›" (accent text).
   - **Destination line** (caption, muted, above the composer): "Goes to **Japan · Day 3** · Change".
   - Composer (min 56): field "Ask about this photo" · mic · send.

**States (side variants):**
- **Running a chip:** "Translate fully" chip shows a small spinner; the new answer appends below.
- **Receipt photo variant:** answer "Receipt, Ramen Kazehana" then a proposal row (warning tint), built from the parsed amount: "Log
  ¥2,960 · ₹1,687 to Japan? [Log] [Not now]"; after Log: "Logged · Undo". If the total could not be read: "Couldn't read the total ·
  [Enter amount]".
- **Offline variant:** eyebrow "ON-DEVICE READING · NO MODEL"; answer "No bicycle parking 8:00–20:00…"; caption "The full answer
  will arrive when you're online."
- **Failed variant:** "The photo is safe · [Retry]".
- **Shutter photo variant** (no Look yet): destination line "Goes to **Tue 13 Oct** (the photo's day) · Change".

---

## 8. Plateful · Today (3.7)

**Purpose:** today's food at a glance; log in one tap; see what needs a check. Drawn as **`PlatefulActivity`**, the window the
Plateful icon opens; the Plateful tab inside Fieldnote shows the same content under Fieldnote's own bottom nav.

1. Top bar: plate glyph + **"Plateful"** wordmark (headline, Bricolage) · glasses pill "● Ready" · gear (→ Settings › Plateful) · ⋮
   (Open Fieldnote, Export).
2. Day pager (min 40): ‹ · **"Today · Thu 8 Oct"** · › · calendar icon.
3. **Hero:** **"1,260 kcal"** (display) with "of 2,000" (body, muted) on the same baseline; caption "range 1,080–1,440 · about 740 left".
4. **Kcal bar** (12 high, radius 6): accent fill to 63%, then a hatched segment (14%) labelled below right "+275 in drafts".
5. **Protein bar**: label "Protein **36** of 90 g" · protein-blue fill to 40%.
6. **Review banner** (warning 14% fill, radius 16): "**2 to review** · 1 draft, 1 might be food" · [Review].
7. **Meal slots** (rows min 64; eyebrow slot label left, 48 wide time column):
   - BREAKFAST · 8:40 · 48 × 48 photo (poha) · **"Poha with peanuts, curd"** · caption "usual" · right "380–440" + tick (text-2).
   - LUNCH · 1:15 · photo (thali) · **"Dal tadka, 2 rotis, bhindi"** · caption with a teal glasses icon "from your glasses" ·
     "580–740" + tick (text-2).
   - SNACK · 5:10 · photo (chai) · **"Chai + Marie biscuits"** · amber dot + caption "How many biscuits?" · chips inline [1] [2] [3] [4+] ·
     "120–260".
   - DRAFT row (dashed 1 px warning outline): 6:30 · photo (samosa on a paper plate) · **"Samosa, 1 piece"** · pill "Draft · from
     shutter photo" · "250–300" · [Confirm].
   - DINNER · — · empty-slot row: "Nothing yet" (muted) · **UsualChip** "Rajma chawal · 540" (accent-soft) · [Log dinner] (text button).
8. Sync line (caption, muted): "Last import from your glasses 6:32 pm · **Import now**".
9. **FAB** "+ Log" (extended, 56 high, accent, bottom-right, 16 above the nav).
10. **Plateful's own bottom nav** (64): **Today** (active) · Review (2) · Trends. No Fieldnote tabs. Back leaves the app.

**States:** empty day ("Nothing logged today. Double-tap your plate, or tap + Log." with [+ Log] and [How it works]); offline estimate
row ("Waiting for network · will estimate automatically"); failed row ("Couldn't estimate · Retry"); past day header "Mon 5 Oct" with
the pager's › enabled; macros on (a third row "Carbs 142 g · Fat 38 g · Fibre 17 g"); partial photo access (sync line "Plateful can
only see photos you picked · Allow all photos").

**Embedded variant:** the same content inside Fieldnote, where the top bar keeps the Plateful wordmark, a segmented control **Today |
Review (2) | Trends** replaces Plateful's nav, and Fieldnote's bottom nav shows Chat · Trip · **Plateful** · Photos.

---

## 9. Plateful · Meal detail (review and edit) (3.7)

**Purpose:** fix one meal in seconds, by hand, offline.

1. Top bar: ‹ "Plateful" · star · ⋮ (Not food · Split meal · Merge with… · Duplicate to today · Delete).
2. **Photo strip** (240 high, pager "1/2"): thali on a steel plate (2 rotis, a katori of dal, bhindi), second photo a close-up of the
   rotis.
3. Title **"Dal tadka, 2 rotis, bhindi"** (title, tap to edit, pencil icon).
4. Chips row: [Lunch ▾] · [Today 1:15 pm ▾] · segmented [Home | Eating out] (Home selected).
5. Source line (caption): teal glasses icon "From your glasses · Lajpat Nagar". Quote (body italic): "you said: 'the rotis had ghee'".
6. **ITEMS** (eyebrow), rows min 64:
   - "Roti (phulka, medium)" · stepper [−] **2** [+] (44 drawn, 48 touch) · "piece" · right "170–200 kcal · 6 g"
   - "Dal tadka" · [−] **1** [+] · "katori" · "160–210 kcal · 9 g"
   - "Bhindi sabzi" · [−] **1** [+] · "katori" · "110–160 kcal · 3 g"
   - "Cooking fat" · 4-way segmented ( None | Light | Normal | **Rich** ) · "+140–170 kcal" · caption "set from what you said"
   - "+ Add item" (accent text)
7. **Total** (divider above): **"580–740 kcal"** (headline) · "Protein 18–22 g" (protein blue) · caption "medium confidence · oil is a
   guess".
8. **ONE QUESTION** (eyebrow): "How much ghee on the rotis?" · chips [None] [A little] [**1 tsp each**] [More].
9. Buttons: **[Looks right]** (primary, full width, 52) · row: [Fix by voice] [Not food] (secondary, 48).
10. Link: "Open in conversation ›" (caption, accent).

**States:**
- **After tapping + on Roti:** count 3, the row reads "255–300 kcal · 9 g", total animates to "665–840 kcal", caption "Changed on your
  phone · no model used".
- **Draft variant:** pill "Draft · from shutter photo" under the title; primary button reads **"Log this meal"**.
- **"Might be a meal?" variant** (a food Look you did not log): pill "Not logged · you looked at this at 1:15 pm"; primary **"Log this
  meal"**, secondary **"Not mine"**.
- **Offline:** banner "Offline · edits are saved on your phone"; "Fix by voice" disabled with caption "Needs a connection".
- **Item sheet** (tap "Dal tadka"): name field, unit picker (katori · cup · bowl · ladle · g · ml), quantity, per-unit kcal 160–210 and
  protein 9 g (editable), [Save to my dishes].
- **Deleted:** returns to Today with snackbar "Deleted lunch · Undo".

---

## 10. Plateful · Log sheet (add a meal) (3.7)

**Purpose:** every phone logging path in one sheet; a usual meal in one tap.

**Frame:** bottom sheet (surface, top radius 24, about 600 high) over Plateful · Today.

1. Title **"Log a meal"** · right caption "Dinner · now".
2. **WHEN** (eyebrow) chips (horizontal scroll): [**Now · 7:45 pm**] (selected) · [Breakfast 8:00] · [Lunch 1:00] · [Snack 5:00] ·
   [Dinner 8:30] · [Pick…].
3. **USUALS** (eyebrow) chips (accent-soft, 2 rows): "Rajma chawal · 540" · "Poha + curd · 410" · "Chai + 2 Marie · 150" · "Masala dosa
   · 480" · "Same as yesterday's dinner". One tap logs; a snackbar "Logged dinner · Rajma chawal · Undo" appears.
4. **Tiles** (4 × 80, card fill): **Camera** · **Photos** · **Describe** · **Label** (Label shows "Soon" until 4.1).
5. **Describe** (expanded in this frame): field (card-2, 3 lines) containing "do roti ek katori dal aur salad" with a mic button; a parse
   preview row of chips: "2 roti" · "1 katori dal" · "1 bowl salad"; caption "Estimated: 420–520 kcal · 16 g protein"; primary
   **[Log dinner]**.
6. Caption (muted): "Clear meals from your glasses shutter show up in Review by themselves."

**States:** offline ("Saved. I'll estimate it when you're online." after Log); share-door entry ("Log to Plateful" from WhatsApp opens
Plateful's own window with the shared photo as a chip at the top, time taken from the photo "Today 1:05 pm"); label tile flow (camera
→ "Per 100 g: 520 kcal, 7 g protein. How much did you eat? [½ pack] [1 pack] [grams]").

---

## 11. Plateful · Review (evening) (4.1)

**Purpose:** close the day in a few taps: confirm drafts, decide on food you looked at, sort "might be food" photos, fill gaps.
Review is a **segment of the Plateful shell**, not a pushed screen.

1. Top bar: plate glyph + "Plateful" · pill · gear. Plateful nav with **Review (2)** active (in the embedded variant, the segmented
   control **Today | Review (2) | Trends**).
2. Header line: **"Thu 8 Oct"** (title) · progress line under it: "1 of 2" (caption) with a thin 50% bar.
3. **Card** (card fill, radius 20):
   - Photo 358 × 240: samosa on a paper plate with green chutney.
   - Caption: "Glasses shutter · 6:30 pm · Khan Market".
   - **"Samosa, 1 piece"** (title) · "250–300 kcal · 5 g protein" · stepper [−] 1 [+] piece.
   - Question: "With chutney?" chips [No] [**Green**] [Imli].
   - Buttons: **[Looks right]** (primary) · [Adjust] · [Not food] (secondary).
4. **MIGHT BE A MEAL?** (eyebrow) · caption "You looked at these but didn't log them. Not counted.": one row: thumbnail of a thali ·
   "1:15 pm · 'Dal, two rotis, bhindi'" · [Log meal] [Not mine].
5. **MIGHT BE FOOD?** (eyebrow) · caption "Not sent anywhere until you say Food": one tile (170 wide): photo (a tall glass on a café
   table) · "7:05 pm · could be a drink" · [Food] [Not food].
6. **NOT LOGGED · TUESDAY (2) ›** (eyebrow row, muted): drafts older than 48 h, still confirmable for 7 days.
7. **ANYTHING MISSING?** (eyebrow): Dinner slot "Nothing yet" · UsualChip "Rajma chawal · 540" · [Log dinner].
8. Summary strip (surface, bottom): "Day so far: **1,260 kcal** · 36 g protein" · after the last card: **"Day closed. 1,535 kcal · 41 g
   protein."**

**Related surface: the evening notification** (358 × 110 card below the frame): "Plateful · 9:30 pm" · title "Thursday: about 1,535
kcal · 41 g protein" · text "1 draft to check" · actions **[Review] [Confirm 1 draft, +280 kcal]** (the second shows a lock glyph: it
asks you to unlock first).

**States:** all caught up ("All caught up. Today about 1,535 kcal · 41 g protein."); a trip day where 10 market photos all sit under
"Might be food?" with nothing uploaded; "12 photos set aside as not food · they never left your phone ›".

---

## 12. Settings (root) (4.2)

**Purpose:** one place for all configuration; each row says its current state.

1. Top bar: ‹ · **"Settings"** · no pill.
2. Rows (min 72 each, icon 24 left, title body 600, current state as caption, chevron right):
   - **Key and budget** · "OpenRouter · key works · ₹48 of ₹200 today"
   - **Models** · "Chat: Smart · Glasses: GPT-6 Luna · Look: Gemini 3.8 Flash (tested 6 Oct)"
   - **You** · "INR · English, Hindi · eggetarian · allergy: shellfish (medical)"
   - **Glasses** · "Taps · follow-up after questions and reading Looks · web on request"
   - **Conversations** · "New chat after 30 min · 45 min window · trip-day threads on"
   - **Plateful** · "2,000 kcal · 90 g protein · review at 9:30 pm"
   - **Travel** · "Offline pack: Japan ready · low data: roaming or Data Saver"
   - **Privacy and data** · "Answers hidden on lock screen · backup 12 MB of 25 MB"
   - **About** · "Fieldnote 4.2 · 16 Feb"
3. Footer caption (muted): "Developer options: tap the version 7 times."

**Second frame: Key and budget** (pushed):
- **OPENROUTER KEY** (eyebrow): masked field "sk-or-…7F2A" (mono) · [Paste] · [Save] (primary) · [Test] (secondary) · inline result
  (text-2 tick) **"Key works · no key limit set"** and under it (caption, muted) "Set a credit limit on this key at openrouter.ai so
  Fieldnote can warn you before it runs out."
- **Limit variant:** "Key works · key limit left ≈ ₹1,186 ($11.30)"; under ₹300 it turns warning colour: "Key limit left ≈ ₹240 · top
  up before your trip".
- **RATE** (eyebrow): "Effective ₹ per $: **₹105.0**" · caption "₹95.65 today × 1.055 OpenRouter fee × 1.04 card markup" · [Edit].
- **DAILY BUDGET** (eyebrow): chips ₹50 · ₹100 · **₹200** · ₹500 · Custom · None; caption "Today ₹48 used · resets at midnight"; row
  "Kept for the glasses: **₹30**" · caption "Typed chat can't use this. At 80%, typed chat moves to Quick."
- **Spend ›** row: "By role this week: Chat ₹212 · Glasses ₹31 · Looks ₹58 · Food ₹9 · Web ₹14".
- **Confirm before sending** (eyebrow): "Ask when one message costs more than **₹20**" (stepper).

**States:** key rejected (danger inline "OpenRouter said the key is invalid (401). Paste it again."); no credit (danger inline
"OpenRouter credit is used up · Top up ›"); a "Saved" tick beside a field after it loses focus; retiring model warning row on Models
("Look model retires 20 Oct · Switch").

---

## 13. Web answer with citations, and the Sources sheet (3.6)

**Purpose:** show that a web answer is sourced, readably, on a phone.

**Frame A (the answer in Chat):**
1. Top bar: ≡ · "Japan visa documents" (subline none) · pill "● Off" · ✎.
2. Your typed turn: "Does the bank statement need a stamp on every page?"
3. **Action row** (compact, muted, globe icon): "Searched the web · 3 sources ›".
4. **Answer** (note style): eyebrow "GPT-6 SOL · WEB · 6.8 s · ₹3.90". Text with numbered superscript markers as small accent pills
   (min 20 high, 48 touch via padding): "The Japan consulate's checklist asks for the **last 6 months** of statements, **stamped by the
   bank on the first and last page** ①. Some VFS centres ask for every page to be stamped ②; check your centre's list ③."
5. Under the answer, a **source strip** (horizontal chips, card fill): favicon-free text chips "① in.emb-japan.go.jp" · "② vfsglobal.com"
   · "③ reddit.com/r/JapanTravel". Then the icon row (copy · read aloud · retry · share · ⋯).
6. Composer with "Web: Auto" chip.

**Frame B (Sources sheet):** bottom sheet (surface, top radius 24), title **"Sources"** · caption "3 pages, searched 13:12". Rows (min
72): number pill · page title (body 600, 2 lines) · domain (caption, mono) · the quoted passage (caption, muted, 2 lines, in a left-ruled
quote). Tapping a row opens the page in a Custom Tab. Footer caption: "Web search cost ₹1.20 of this answer's ₹3.90".

**States:** "Web: On request" chip after 80% of the budget; a Private chat shows "Web: Off · Private" with a one-message "Search
once" action.

---

## 14. Message actions (3.6 / 4.0)

**Purpose:** everything you can do to one turn, from a long-press.

**Frame A (assistant turn, long-pressed):** the pressed answer lifts (card fill, 16 radius) and a bottom sheet opens:
- Header: eyebrow "GPT-6 SOL · 13:12 · ₹3.90".
- Rows (min 56, icon + label): **Copy** · **Select text** · **Retry** · **Retry with…** › · **Shorter** · **More detail** · **Read
  aloud** › (sub-choice "On phone | On glasses", last choice ticked) · **Share** · **Move to…** · **Split from here** · **Delete**
  (danger).
- Caption at the bottom: "Retries never log anything again."
- 3.6 variant: only Copy, Select text, Retry (last reply only), Share and Delete; the others are marked "Soon".

**Frame B (your turn, long-pressed, then Edit):**
- The sheet for your turn: **Edit** · Copy · Delete.
- After **Edit**: the composer refills with "Does the bank statement need a stamp on every page?" and the PDF chip; a thin warning bar
  above it: "Editing · the reply below will be replaced · Cancel". The old reply dims (text at 40%).
- **Edit on a turn that logged something** (4.0 variant): snackbar after sending "Undid lunch log (520 kcal) · Redo".

---

## 15. Retry versions and "Retry with…" (4.0)

**Purpose:** compare answers and pick another model for one reply.

**Frame A (versions on a turn):** an answer with eyebrow "CLAUDE OPUS 5.5 · 9.4 s · ₹6.10" and, at its top right, a pager **"‹ 2/2
›"** (label, text-2; the arrows 48 touch). Swiping or tapping ‹ shows version 1 with its own eyebrow "GPT-6 SOL · 6.8 s · ₹3.90".
Caption under the pager: "Second opinion".

**Frame B ("Retry with…" sheet):** bottom sheet, title "Retry with" · caption "This reply only; the chat keeps GPT-6 Sol". Rows (min
56): **Best · Claude Opus (latest) · ≈ ₹6.50** · **Media · Gemini 3.8 Flash · ≈ ₹1.20** · **Quick · GPT-6 Luna · ≈ ₹0.15** · RECENT chips
(Grok 4.7, Kimi K3) · **All models ›**. Models without Tools show "No tools · answers from text only".

**Glasses variant:** a spoken "think harder" appears as version 2 of the glasses answer, eyebrow "↺ THINK HARDER · GPT-6 SOL · 7.2 s ·
₹3.10".

---

## 16. Conversation info (4.0)

**Purpose:** per-conversation controls in one sheet, from a tap on the chat title.

**Frame:** bottom sheet (surface, top radius 24, about 640 high) over "Japan visa documents".
1. Title field (title style, editable) **"Japan visa documents"** · caption "Topic · started Mon 5 Oct".
2. Row: **Pin** (toggle, on).
3. Row: **Private** (toggle, off) · caption "Private chats are never named aloud or on the lock screen, and go only to providers
   that don't store prompts."
4. Row: **Model for this chat** · "Smart · GPT-6 Sol ›" · caption "Thinking: Low".
5. Row: **Instructions for this chat** · "Reply as a checklist; cite the consulate first ›".
6. Row (teal rail): **Continue on glasses** (primary text button) · caption "Your spoken questions go here for 3 h. Looks still go to
   today's thread." With the glasses off, the button reads **Start glasses here**.
7. **Stats line** (caption): "24 turns · 2 photos · 1 PDF · ₹38.40 spent".
8. Rows: **Export** (Markdown) · **Delete** (danger).

**States:** held by the glasses ("Glasses are here until 17:40 · Stop"); a day thread shows scope "Day · Wed 7 Oct" and no Continue
button (it is already where the glasses go).

---

## 17. Drawer search results (3.6 titles / 4.0 full text)

**Purpose:** find a past conversation by what was said, not only its title.

**Frame:** the drawer with the search field focused: "ryokan" (keyboard up, the bottom nav hidden).
1. Filter chips (min 36): **All** (selected) · Glasses · With photos · This trip.
2. Results grouped by conversation (group header: title, body 600, and date caption right):
   - **Kyoto ryokan shortlist** · Sun — snippet (caption): "…the **ryokan** near Yasaka has a private onsen…" · second snippet "…two
     **ryokan** under ¥30,000…"
   - **Japan · Day 3** (teal glasses icon) · today — "●● Look · 'Sign outside the **ryokan**: check-in from 15:00'"
   - **Mom's knee MRI report** does not appear: Private chats are found only when the Private filter is added.
3. Footer row: "Search photos instead ›".

**States:** 3.6 variant (titles only: "Showing chats with 'ryokan' in the title · full search in 4.0"); empty ("No chat mentions
'ramen'. Search photos instead ›").

---

## 18. "Ask Fieldnote" share-in sheet (3.8)

**Purpose:** send something from another app into a chat without anything sending by itself.

**Frame:** bottom sheet over Fieldnote, opened from Gmail's share sheet.
1. Title **"Ask Fieldnote"** · caption "From Gmail".
2. **Preview:** a PDF chip "lab-report-oct.pdf · 4 pages · 2.3 MB" and the shared text "Reports attached" (caption, 2 lines).
3. **Private notice** (lock icon, caption): "A new chat with a document is Private: its title is never spoken, and it goes only to
   providers that don't store prompts."
4. **Where** (eyebrow) rows (min 56, radio):
   - ● **New chat** (default)
   - ○ The glasses' conversation · "Japan · Day 3" (teal rail)
   - ○ Recent: "Mom's knee MRI report" (lock) · "Japan visa documents" · "Diwali gifts under ₹2,000"
5. Primary button **"Open in chat"** (52). Caption: "Nothing sends until you press Send."

**States:** the share expired ("The share expired. Share it again." when Android has already revoked the grant); a video over 3 min
("Videos up to 3 min for now"); many items ("10 items max · the first 10 are added").

---

## Screen-to-plan map

| Screen | Release | Plan sections |
|---|---|---|
| 1 Chat conversation | 3.6 / 4.0 | B1, C1, C3, C4, C8, D1, D3, E2, E7 |
| 2 Drawer | 3.6 / 4.0 | B1, C1, C7, E7 |
| 3 Attach sheet | 3.8 | D1, D2, D4 |
| 4 Model sheet | 3.6 | E1, E2, E3, E5 |
| 5 Glasses sheet | 4.2 | B1, B2, C5, C6, G4, G8, G9 |
| 6 Trip · Today | 3.9 | G9 |
| 7 Look result | 3.9 | C3, G3, G4, G7, G8, G10 |
| 8 Plateful · Today | 3.7 | F1, F2, F5 |
| 9 Meal detail | 3.7 | F2, F3, F4 |
| 10 Log sheet | 3.7 | F2, F8 |
| 11 Review | 4.1 | F2, F6, F7 |
| 12 Settings | 4.2 | H1, E7 |
| 13 Web answer and Sources | 3.6 | C1, C12, E4 |
| 14 Message actions | 3.6 / 4.0 | C1, C13 |
| 15 Retry versions | 4.0 | C1, C13, E2, G4 |
| 16 Conversation info | 4.0 | B3, C1, C9, C12 |
| 17 Drawer search | 3.6 / 4.0 | B3, C1 |
| 18 Share-in sheet | 3.8 | D5, C1 |
