# Fieldnote 4.x: the UI and UX plan

Owner's plan document. 23 Sep 2026, revised the same day after three adversarial reviews (section N logs every change).
Base: Fieldnote 3.4 (commit ab1cf4e, about 7,450 lines of Kotlin).
Code paths are relative to `fieldnote/app/src/main/kotlin/com/urmit/glasses/dev/` unless stated.
Money is in rupees at 1 USD = ₹95.65 (rate on 23 Sep). What you actually pay is about 10% more: OpenRouter adds 5.5% when you buy
credit, and the card adds its forex markup, so the app converts with an "effective ₹ per $" setting (E7). **[est]** marks an
estimate, not a measurement.
No keys or secrets were read or printed while writing this plan.

---

## 0. In short

**The idea in one sentence.** Everything you do with Fieldnote (a tap, a double-tap Look, a question to the glasses, a typed
message, a meal, a receipt) becomes a turn in **one conversation store**, placed by **simple rules you can predict**, so whatever you
start on the glasses or the phone simply continues; Chat is the home, and Plateful, Trip and Photos are richer views of the same
store.

**What you get, and when.** One developer working with Claude sessions, about 5 engineering days a week, **one track**. The dates
leave out weekends, Gandhi Jayanti (2 Oct), Dussehra (20 Oct), 3 days in Diwali week and 4 days over Christmas and New Year. They
slip with travel. Asks 2, 4 and 5 get their core on today's store **before** the big store change (4.0), so no ask waits behind
another ask's plumbing (K18).

| Release | What it gives you | Asks | Days | Ready about |
|---|---|---|---|---|
| **3.5** Before 20 October | Looks and food move to a model tested on your own photos before Gemini 2.5 retires on 20 Oct; spend in ₹; glasses questions and double-tap answers go to **one dated chat a day** ("Glasses · Wed 7 Oct"), never split by the model; opening a chat no longer captures the glasses; a tap stops speech; "log it" logs a meal from the glasses; the Food tab can add, edit and delete meals; old chats are no longer trimmed silently | 1, 4 (stopgaps) | 11 | 9 Oct (installable 7 Oct) |
| **3.6** Chat quick wins | Model picker with ₹ per reply; streaming with Stop and a "Thinking · 12 s" row; tables and formatting; copy; web search with sources; phone photos; a real chat drawer (search, rename, pin, delete with Undo); Retry and Edit on the last turn; a clear "OpenRouter credit is used up" state | 1 (ChatGPT parity), **3 done** | 14 | 30 Oct |
| **3.7** Plateful core | Plateful opens as its own app from its own icon; Today with + Log and one-tap Usuals; Meal detail with steppers that work offline; delete with Undo | 4 (core) | 9 | 17 Nov |
| **3.8** Files and video | PDFs, text files, videos up to 3 min, the glasses album, "+ Last glasses photo", "Ask Fieldnote" in the share sheet, cost hint and ₹20 confirm | **2 (core)** | 6.5 | 26 Nov |
| **3.9** Look | Nine lenses become one Look; "Reading, hold still"; signs, menus, prices, cash, boards, Wi-Fi cards; receipts and meals wait for your yes; offline price and board reading; "think harder"; hand-off to Meta as a pause; driving mode | **5 done** | 12 | 14 Dec |
| **4.0** One conversation | One store with full-text search; glasses turns placed by rules you can say out loud; follow-up listening (if the device test allows); one tap cancels anything; retry and edit any turn; Private chats | **1 done** | 24 | 21 Jan |
| **4.1** Plateful complete | Review, pickup of Meta shutter photos, Trends, Goals, evening review, voice fixes ("actually three rotis") | **4 done** | 10 | 4 Feb |
| **4.2** Shell and polish | The Glasses tab becomes a pill and a sheet; one Settings area; icons; snackbars everywhere; 7 earcons; a Start glasses shortcut and Quick Settings tile | polish | 8 | 16 Feb |
| **4.3** Attach the rest | Audio files and voice notes; video to any model (frames + transcript); trim; per-message cost breakdown; Office files if you want them (K12) | **2 done** | 8 | 26 Feb |
| Backlog | Decided after the five acceptance suites pass: memory list, temporary chat, talk mode, light theme, Health Connect, Trip tab rebuild, barcode, onboarding rebuild | — | ≈ 15 | — |

Total ≈ 102.5 engineering days to 4.3, which is inside the judges' realistic range for the base proposal (95–110 days) even with
the review fixes. The backlog (about 15 days) comes on top, and only if you still want it. **Every shipped build raises
`versionCode`** (350, 360, 370, 380, 390, 400…; patches +1), because Android refuses a lower one as a downgrade and uninstalling
wipes the data.

---

## How this plan was assembled

Three proposals were written and three judges scored them.

| Proposal | Owner value (J1) | Feasibility (J2) | Glasses ergonomics (J3) | Total |
|---|---|---|---|---|
| P1 Conversation spine | 8 | 8 | 7 | **23** |
| P2 Moment-first | 6.5 | 7 | 8 | 21.5 |
| P3 Focused suite | 7 | 6 | 5.5 | 18.5 |

**This plan starts from P1** (chat is home, one store, placement by code, smallest data risk). It grafts P2's glasses grammar and
honest latency engineering, and P3's Plateful identity, follow-up policy and Hinglish parsing. It fixes every judge's must-fix item
(Appendix 1 maps each one to the section that handles it).

### Grafts taken in

| From | Idea | Where |
|---|---|---|
| P2 | One tap stops anything, in every busy state (listening, capturing, thinking, speaking); two taps always Look; three taps always Ask | C6 |
| P2 | `Glasses.captureProgressive()`: frame, on-device text check, then a full photo on the still-open session; "Reading, hold still" spoken within 1 s | G3 |
| P2 | 3.5 continuity stopgap, made stricter after review: one dated glasses chat a day, no model routing at all, double-tap answers written into it | J |
| P2 | Pause taps (music mode) for 30 min; hand-off to Meta as a pause | C6, G8 |
| P2 | Same-photo override ("no, just translate"); pinned intent ("menu mode") | G4 |
| P2 | Local answers with no model: today's food, today's spend, currency conversion | C7 |
| P2 | Chat tiers ride `~…-latest` aliases (glasses roles pin tested ids); the model that served each answer is shown | E |
| P2 | Look follow-ups get a text digest of the latest Look, wherever it was filed | C4 |
| P2 | WorkManager drains queued turns; `spend_reconciled` telemetry | C10, J |
| P2 | Context-ordered Quick looks and a Just-now Look card (on Trip · Today and the Glasses sheet, not as a new home) | B, G |
| P3 | Plateful identity: its own app window (`PlatefulActivity`), launcher icon, wordmark, shortcuts, "Log to Plateful" share door | F1 |
| P3 | Usuals chip in each empty meal slot; Hinglish counts and times; nutrition label photo | F |
| P3 | `JobScheduler` content trigger for the Meta AI album (works with the app closed) | F2 |
| P3 | Follow-up mic after questions and proposals; after reading Looks too (review), never after scene Looks | C5 |
| P3 | "How much" reuses a Look under 2 min old, no new photo | G4 |
| P3 | Voice tool subset (about 15 tools) | C12 |
| P3 | Visible Auto rule; long-press the model chip to swap the last two models; Spend screen by role | E |
| P3 | All spends; browse-only trips (the manual spend form moves to the backlog) | G9 |
| P3 | 3.5 device baseline before the design freezes | J |
| P3 | "Glasses on. Still in X." at start; composer drafts kept per conversation | C7 |
| P2 + P3 | [All good] on the evening notification; spoken food summary when the glasses stop after 7 pm | F7 |
| J2 | A 3.6 "chat quick wins" release on the old store before the migration | J |
| J3 | Tap pips within 150 ms; listen tone only when the mic is live; silence budget; bad-data watchdog; 7 earcons; driving mode | C6, G |

### Disagreements, and which way this plan goes

| # | Question | Options on the table | Decision | Why |
|---|---|---|---|---|
| D1 | Home screen | Chat (P1, P3) · "Now" dashboard (P2) | **Chat is home.** Now's best parts (Just-now card, Quick looks) move to the Glasses sheet and Trip · Today | J1: chat must be ≤ 1 tap from launch. J2: Now is 4 d of scope nobody asked for |
| D2 | Who places a glasses turn after the window | Code, day thread (P1) · the model picks from a shortlist (P2, J1 graft 3) · lexical match else new chat (P3) | **Code only.** Named resume, then a conservative local "related topic" match, then the day or trip-day thread. The model never moves or creates a conversation; it can *read* any conversation through `search_conversations` | J2 and J3: model placement is the same class of behaviour as the complaint and costs an extra model round. J1's goal (land in the relevant session) is met by the local match; a miss falls back to today's thread, never to "New chat" (P3's failure mode), and retrieval still gets the answer right |
| D3 | Phone → glasses hand-off | Automatic after any phone message (P1 rule 2, P2) · explicit "Continue on glasses" (P3) | **Both, narrowed.** Explicit "Continue on glasses" always works and holds for 3 h from the tap. The automatic rule applies only to a *spoken question* that is *about* the chat you just typed in (shared words), within 10 min, and it is announced. **Looks and tap photos never follow the phone or a chosen chat:** they go to the day or trip-day thread unless your words name a chat | J3: a menu Look must not be filed silently under "Japan visa". J1: "type at the desk, walk out, ask" is the natural hand-off. Review: an unconditional hand-off misfiles the owner's many unrelated chats |
| D4 | When the follow-up mic opens | After every answer (P1) · after questions and proposals only (P3) | **After spoken questions, proposals, "More?", and reading Looks (sign, menu, price, board)**, never while other audio plays, never after scene Looks | Judges: an open mic drops music to 8 kHz call audio, but the window is skipped whenever music plays, so that cost is gone. Review: the main travel loop ("so can I park here now?") should not cost a gesture |
| D5 | Where answers are spoken while the mic may reopen | Keep the call route (SCO) through answers (P1) · answers on normal audio, SCO only to listen (J3) | **Answers on normal audio (A2DP).** Keep SCO up only if the 3.5 device test shows route time p50 > 1 s *and* taps still arrive with SCO up | J3: call-quality speech is worse on the street, and tap delivery with SCO up is untested |
| D6 | Look output format | Speech then JSON, streamed (P1) · JSON mode (P2, P3) | **Speech first, then a JSON block.** Speech streams to the earpiece before the JSON finishes | J3: first audio arrives seconds sooner |
| D7 | Double-tap while speaking | Stop then Look (P1, P2) · "More" (P3) | **Stop, then Look.** "More" is said, not tapped | J3: P3's rule has a built-in mode error |
| D8 | Warm camera in travel | 2 min warm by default (P3) · off (P2) | **Off.** Travel mode changes the text threshold and speaks "hold still" instead | `Glasses.kt` notes a tap during a live session may pause the stream instead of reaching Fieldnote |
| D9 | Typed chat default model | GPT-6 Sol (P1) · Gemini 3.8 Flash (P2, P3) | **Smart = GPT-6 Sol, shown with its ₹ cost; owner to confirm (K9)** | The owner already runs Sol-class as the brain. J2 is right that it is 60–70% of the bill, so the Spend screen and the decision make it visible |
| D10 | Daily cap | ₹200 (P1, P2) · ₹150 (P3) | **₹200**, with ₹30 kept back for the glasses; typed chat drops to Quick at 80%; confirm before sending anything over **₹20** | J1: no silent cut; ₹5 confirms are naggy. Review: one shared cap let a heavy typed day switch off the glasses |
| D11 | Store technology | Room + KSP (P2) · framework SQLite + FTS4 (P1, P3) | **Framework `SQLiteOpenHelper` + FTS4** | J2: no annotation processor exists in this codebase |
| D12 | Passive meal pickup | In-process observer (P1) · WorkManager scan (P2) · `JobScheduler` content trigger (P3) | **`JobScheduler` content trigger**, plus scans at app open, glasses stop and before the evening review | J2: the in-process observer does not fire with the app closed |
| D13 | Photos | Tab (P1) · screen under Now (P2) · under Inbox (P3) | **Photos stays a tab** | It is the library of glasses captures; J1: an Inbox tab is a daily chore |
| D14 | Plateful's look | Leaf accent (P3) · Fieldnote tokens (P1, P2) | **Fieldnote tokens; Plateful gets its own window, wordmark, glyph and launcher icon** | J2: three accents add surface for one user. Identity comes from the name, icon, its own window and structure |
| D15 | Earcons | 10–13 sounds (all three) | **7 sounds**, everything else spoken in 1–3 words | J3: learnable in a day, and distinguishable over call audio |
| D16 | Web search | 4.4 (P1, P3) · 4.3 (P2) | **3.6**, the first chat release: Auto in typed chat with 3 results per search, "on request" on the glasses and after 80% of the budget | J1: without it chat is not ChatGPT-class for travel questions. Review: a search costs about ₹1–1.5, not ₹0.67 |
| D17 | Release order after 3.6 | 4.0 store first (the first draft) · the core of asks 4, 2 and 5 first on today's store (review) | **Asks 4, 2 and 5 first** (3.7–3.9), then 4.0 (K18) | One developer cannot run two tracks. The 3.5 stopgap already fixes most of "new session every time", 4.0 then gets two months of `turn_joined` data, and no ask waits about 16 weeks for another ask's plumbing |

---

## A. Product principles

**The idea:** one conversation, placed by rules you can say out loud; the glasses do, the phone shows.

1. **One store, many views.** Every interaction writes a turn to one store. Chat shows it as it happened. Trip, Plateful and Photos
   filter it and add their own records (meals, spends, bookings, photos). No answer lives only in a side file.
2. **Continue by default; switch only on a clear signal.** Where a turn lands is decided by rules in code (time window, day, trip,
   your words). The model can read any conversation, but it can never move one or start one.
3. **Know where you are without looking.** Silence means "same conversation". Any change is spoken in a few words. "Which chat?"
   always answers.
4. **One tap stops.** When Fieldnote is busy, one tap stops it. Two taps always Look. Three taps always Ask.
5. **Short in the ear, whole on the screen.** About 15 s of speech on the glasses; the full answer, photo and evidence on the phone.
6. **Nothing is written to your records without a yes.** Meals, spends and bookings start as proposals or drafts. Your words ("log
   it"), one tap, or the evening review make them real. Every write can be undone.
7. **Cost and model are always visible, in rupees.** Every answer shows the model that served it and what it cost. The budget is a
   ₹ figure per day.
8. **Offline and slow are normal states.** Local commands and on-device reading keep working. Everything else queues visibly and
   drains by itself. Fieldnote says what it skipped.
9. **What is private stays near you.** Open-ear speakers and the lock screen are public. Private chats are never named aloud or on
   the lock screen, and the lock screen shows the glasses' state, not your answers, unless you choose otherwise.

---

## B. Information architecture

### B1. Navigation

```
Bottom bar (4):   Chat  ·  Trip  ·  Plateful  ·  Photos            (4.2; until then the Glasses tab stays as a fifth tab)
Top bar:          [≡ on Chat | ‹ on pushed screens]  Title / subline ........ [Glasses pill]  [one context action]
Chat drawer (≡):  Search · New chat · On your glasses · Pinned · Trips · Today · Yesterday · This week · Earlier
                  footer: "₹48 of ₹200 today ›" (opens Spend) · Settings
Glasses pill  →   Glasses sheet (status, Start/End, Pause taps, active conversation, Just-now Look, Quick looks, gestures)
Settings      ←   drawer footer · the gear on any screen opens Settings at that screen's section · deep links
                  (⋮ menus hold that screen's own actions only)
Launchers:        "Fieldnote" icon → Chat   ·   "Plateful" icon → PlatefulActivity, its own window (F1)
App shortcuts:    New chat · Look now · Start glasses · Log a meal       Quick Settings tile: Start glasses / End glasses
```

- **Chat is home.** If the app was in the background for **less than 30 min**, launch restores the conversation you last viewed.
  After **more than 30 min** (and when not opened from the notification or a deep link), it opens a **New chat**, like ChatGPT after
  time away. The first starter card there is **"Continue Wed 7 Oct · 14 turns ›"** (the glasses' conversation, or the one you last
  viewed), one tap back. This keeps an unrelated typed question out of the day thread. Setting: Settings › Conversations › "On
  open: New chat after 30 min (default) / Last chat". A new chat is also one tap from anywhere (✎ in the top bar).
- **The Glasses tab goes (4.2).** The glasses are a status, not a place. A pill on every top bar shows the state (Off, Ready,
  Listening, Looking, Thinking, Speaking, Paused, Needs attention) and opens the Glasses sheet. Setup, tests and models move to
  Settings. Five tabs become four. Because the Glasses tab was also the way to start the glasses, 4.2 adds a **Start glasses** app
  shortcut and a **Quick Settings tile**. The tile opens the activity and starts the service from there, which keeps Android's rule
  that a microphone service starts from the foreground. **Look now** with the glasses off starts them, then Looks, and says "Glasses
  on. Looking."
- **Food becomes Plateful** (3.7): the tab embeds Plateful's screens, and the Plateful icon opens Plateful as its own app (section F).
- **Trip** keeps its long scroll for now. 3.9 adds a new top (browse vs Make active, Just-now Look, Quick looks) and a To confirm list
  in Money. The sub-tab rebuild (Today · Plan · Money · Places) is in the backlog.
- **Photos** stays: the library of glasses captures and the Meta AI album, with search and filters (4.2).
- **The drawer opens from ≡ only.** On Android 15 with gesture navigation, a swipe from the left edge is system Back, and Chat is the
  home screen, so an edge swipe would often send the app away. Chat also has sideways-scrolling tables. Once open, the drawer can be
  swiped shut. Back closes the drawer and every sheet first, with predictive back (fixes the missing BackHandler,
  `ui/ChatScreen.kt:92-111`).
- **The bottom bar hides while the keyboard is open**, so typing gets the room.
- **Words.** The UI says "Glasses on / off", "Start glasses", "End glasses". The word "session" leaves the UI. "Chat" and
  "conversation" always mean a thread.
- **Deep links:** `fieldnote://c/{convId}?turn={turnId}`, `fieldnote://meal/{id}`, `fieldnote://plateful/{today|review}`,
  `fieldnote://trip/today`, `fieldnote://settings/{section}`. The notification, evening review, share targets and shortcuts use them.

### B2. How the glasses fit

| Glasses input | Lands as | Phone surface |
|---|---|---|
| Tap (idle) | A compact photo row in today's thread (C3 rule 1); becomes the subject of the next question for 10 min | Chat, Photos |
| Double-tap | A Look pair in today's thread: your photo, then the answer card with its kind, chips and any proposal | Chat; Photo detail; Trip · Today (on a trip); Plateful (food, once you say yes) |
| Triple-tap, then speech | Your spoken turn plus the streamed answer; tool steps as action rows | Chat |
| Follow-up window speech | As triple-tap, with no tap | Chat |
| Shutter (Meta's) | Not a Fieldnote turn. The photo appears in Photos. If it clearly looks like a meal at a mealtime, a draft appears in Plateful; if unsure, it waits under "Might be food?" and nothing is uploaded (F2 #4) | Photos, Plateful |
| Notification Look · Ask · End (Stop while speaking, Resume while paused) | Same as the gestures | Tapping the notification opens the glasses' conversation |

### B3. Screen inventory

| # | Screen | Purpose | Entry points | Key components | Empty and error states |
|---|---|---|---|---|---|
| 1 | **Chat · conversation** (home) | Read and continue any conversation, including live glasses turns | Launch; drawer; notification; share-in; "Open in conversation" from Trip, Plateful, Photos; deep link | Top bar (≡, title and place line, glasses pill, ✎); glasses banner only when it has an action; turns; "Thinking · 12 s" row; composer (context row, +, field, mic, send/stop) | **New chat:** 4 starters chosen by state, the first being "Continue *Wed 7 Oct* · 14 turns ›" after time away. **No key:** card "Add your OpenRouter key" opens Settings › Key directly. **Offline:** banner "Offline · messages send when you're back (2 queued)". **Budget used:** banner "Today's ₹200 is used · Raise by ₹100 for today". **No OpenRouter credit** (HTTP 402): danger banner "OpenRouter credit is used up · Top up ›". **Model retired:** notice turn with Switch |
| 2 | Drawer | Find, switch and manage conversations | ≡ only (3.6; see B1) | Search; New chat; "On your glasses" card; Pinned; Trips (days and trip chats); date groups; lock icon on Private chats; long-press menu (Rename, Pin, Continue on glasses, Private, Delete); footer ₹ meter and Settings | Empty: "Your chats appear here, glasses conversations too." Search empty: "Nothing matches 'fort'. Search photos instead ›" |
| 3 | Search results | Full-text search | Drawer search | Results grouped by conversation with highlighted snippets; filters All · Glasses · With photos · This trip | "No chat mentions 'ramen'." |
| 4 | Conversation info (sheet) | Per-conversation controls | Tap the title | Rename; Pin; Private; Model for this chat; Instructions for this chat; Continue on glasses / Start glasses here; scope ("Day · Wed 7 Oct"); turns, photos, ₹ spent; Export; Delete | — |
| 5 | Message actions (sheet) | All actions on one turn | Long-press; ⋯ on a reply | Copy; Select text; Retry; Retry with…; Shorter; More detail; Read aloud (phone or glasses); Share; Move to…; Split from here; Edit (your turns); Delete | — |
| 6 | Model sheet | Pick model and thinking level | Model chip; Conversation info; Settings › Models | Tiers (Auto, Quick, Smart, Best, Media) with ₹ per reply and capability badges; Recent and Starred models; a Custom row after a raw pick; Thinking chips; "Make default for new chats" (shows the current default); "Also on glasses"; All models › | Catalogue offline: "Prices from 21 Sep". No key: disabled with "Add your key" |
| 7 | All models | Browse 450+ models | Model sheet; Settings › Models | Search; filters (Sees, Video, Audio, Files, Tools, Thinks, Free); sort (Recommended, Price, Newest, Quality); badges (New, Retires 20 Oct, Always latest); star a model; text-output models only | "No model takes video under ₹50 per 1M. Clear a filter." |
| 8 | Attach sheet | Add anything to a message | + in the composer | Camera · Video · Photos & videos · Files; "Take a glasses photo now"; glasses album strip (multi-select, sticky "Add 3" button); Voice note and Paste (4.3) | Glasses off: "Start glasses to take a photo" |
| 9 | Attachment preview / trim (4.3) | Check, trim, choose pages | Tap an attachment chip | Viewer; video trim bar; PDF page range; "Sends as" line; Remove | "Can't read .pages files. Export as PDF and try again." |
| 10 | Share-in "Ask Fieldnote" | Route shared items to a chat | Android share sheet | Preview; New chat (default; documents make it Private); the glasses' conversation; 4 recent; Direct Share targets (4.3) | "The share expired. Share it again." (grants die on a Recents relaunch, `MainActivity.kt:110`) |
| 11 | **Glasses sheet** (4.2) | Control the glasses | Glasses pill; notification; onboarding | Status ring; Start/End; Taps / Wake word; Pause taps; "Glasses are in *X* · Change"; Double-tap does; Just-now Look card; Quick looks; gesture legend (first 7 days); setup line | Not linked: "Link glasses". Missing permission: named row with Allow. Killed by Android: "Android stopped the glasses at 14:02. Start again." |
| 12 | Photos (filters and search 4.2) | Library of captures and the Meta AI album | Tab | Filters (All, Looked at, Meals, Receipts, Videos, Favourites, Hidden); search over place and answers; day groups; grid; multi-select (Ask in chat, Log as meal, Share, Hide, Unhide, Delete) | No album: "No Meta AI album yet. Open the Meta AI app once, then Check again." Filter empty: "No receipts yet." |
| 13 | Photo detail | One item and everything said about it | Photos; any photo in a turn; meal or spend | Pager and pinch zoom; source, time, place; "Look as" chips that run at once; answers about this photo with "in *conversation* ›" links; "Ask about this photo" with the line "Goes to *Japan · Day 3* · Change" above it (C4); Log as meal / spend (by kind) | Failed: "The photo is safe · Retry". Offline: "Will answer when you're online" |
| 14 | **Trip · Today** (new top in 3.9) | Live trip dashboard | Trip tab | Trip header (name, "Day 3 of 9", Active / Viewing only); Now card (stay, direction, Take me home, Driver card); Just-now Look; Quick looks (context-ordered); Cards row; today's journal; offline pack status; the 3.4 blocks below | No trip: "No trip right now" with Paste a booking, Screenshots or PDFs, Plan by hand; Money and Places still usable. Location off: inline Allow button |
| 15 | Trip · Plan (backlog) | Bookings | Sub-tab | Day groups; booking rows; add and edit by hand; import; offline pack card | "No bookings yet. Paste one, share a PDF, or add by hand." |
| 16 | Trip · Money | Ledger | Money block (3.9); sub-tab (backlog) | To confirm (n) and all spends, paged (3.9); today and trip totals in ₹; categories; Add spend form with no model and edit (backlog); CSV | "3 spends wait for a rate (offline)" |
| 17 | Trip · Places (backlog) | Notes and pins | Sub-tab | Pins with Navigate; photo; search; delete with undo | "Say 'remember this' on the glasses to pin a place." |
| 18 | Trip switcher (sheet, 3.9) | Browse or activate trips | Trip title ▾ | Trips; "Viewing only" vs "Make active"; New trip | — |
| 19 | Trip edit (backlog) | Create or edit a trip | Switcher; Plan | Name, dates, destination, currency, language; trip notes (added to trip chats) | — |
| 20 | Cards (Driver, Allergy, Phrases, Emergency, Wi-Fi) | Show someone else | Trip · Today; voice; notification | Light full-bright palette (kept); Speak; Share as image; Copy | Missing data: buttons "Add stay" / "Add allergies" |
| 21 | Import ("Add to trip") | Booking import | "Add to trip" share door | As 3.4 (`ui/ImportScreen.kt`) | As 3.4 |
| 22 | **Plateful · Today** (3.7) | Today's diary. In PlatefulActivity (its own window: nav Today · Review · Trends, Back exits) and embedded in Fieldnote's Plateful tab | Plateful tab; Plateful icon; notification | Day pager; kcal hero; bars (drafts hatched); review banner; meal slots with Usuals chips; + Log | "Nothing logged today. Double-tap your plate, or tap + Log." |
| 23 | Plateful · Review (4.1) | Confirm drafts and "might be food" photos | Review segment; banner; evening notification | Card stack with a "1 of 2" progress line; "Might be a meal?" (food Looks); "Might be food?" grid; "Not logged · Tuesday (2)"; "Anything missing?"; summary | "All caught up. Today about 1,850 kcal · 74 g protein." |
| 24 | Plateful · Trends (4.1; the 3.4 week bars until then) | Patterns | Trends segment | Week / Month / 3 months; bars with target; protein line; tiles; top dishes; timing | "Trends appear after 3 logged days." |
| 25 | Meal detail (3.7) | Review and fix one meal | Meal row; meal turn; Review | Photos; title; time and type; items with steppers; fat level; totals; question chips; Looks right; Fix by voice; ⋮ (Not food, Split, Merge, Duplicate to today, Favourite, Delete) | "Couldn't estimate · Retry". Edits work offline |
| 26 | Plateful · Log sheet (3.7; Label 4.1) | Every phone logging path | + Log; "Log to Plateful" share; shortcut | Usuals and recent chips; Camera; Photos; Describe; Label; time and type chips | Offline: "Saved. I'll estimate it when you're online." |
| 27 | Settings › Plateful (goals and options) | Targets and options | Gear on Plateful (it is the Plateful section of Settings; in PlatefulActivity it opens in place) | Goal wizard; targets; macros toggle; units; evening review; album pickup; export; delete all | Missing basics: manual entry |
| 28 | **Settings** (root + 10 pages, 4.2) | All configuration | Drawer footer; gears | Section H | — |
| 29 | Spend | AI spend in ₹ | Drawer footer; Settings | Today bar; by role; 30-day chart; cap; raise for today | — |
| 30 | Setup check | Device tests A to D | Glasses sheet; Settings › Glasses | Test rows with numbers; red rows say what they disable | "Not run" with Run |
| 31 | Onboarding (4 steps) | First run | First launch; Settings › Run setup again | Welcome · Key · Link glasses (permissions in context) · Try a double-tap | Each step skippable with its limit stated |
| 32 | Session notification | Lock-screen control | While the glasses are on | Title "Ready · in Japan, day 3"; text: last answer; actions change with state. **On the lock screen only a state-only public version shows** ("Fieldnote · Ready"), unless Settings › Privacy › "Show answers on the lock screen" is on; Private chats are never named | — |
| 33 | Evening review notification | Plateful's daily touchpoint | 21:30 (setting) | "Tuesday: about 1,850 kcal · 74 g protein · 2 to check" [Review] [All good] (confirms drafts only; asks for unlock) | Not posted on a day with no meals and no drafts |

---

## C. Chat (ask 1)

### C1. ChatGPT-class feature list

The bar is ChatGPT's *function*, not its look. Priority: **Must** = needed for "as good as ChatGPT" or the owner's asks;
Should = strong gain; Could = later.

| Feature | Priority | Fieldnote behaviour | Release |
|---|---|---|---|
| Streaming replies | **Must** | Text streams in (SSE). Tool steps appear live as action rows ("Taking a photo…", "Reading the receipt…"). In 3.6 the streamed text lives in memory and is saved once, at the end, on Stop or when the app goes to the background (today's store rewrites the whole `chat.json` on every save). From 4.0 partial text is saved every 500 ms | 3.6 |
| Thinking state | **Must** | Between Send and the first word, a row reads **"Thinking · 12 s"** with the live tool step when one runs ("Searching the web…") and an **Answer now** button (cancels, then resends at the lowest effort the model supports). When OpenRouter streams reasoning summaries, they show under the row; once the answer starts they fold into **"Thought for 14 s ›"**. `think_ms` is logged | 3.6 |
| Stop | **Must** | Send turns into Stop while streaming. A glasses tap stops too. The partial reply stays, marked "Stopped". The Model sheet warns that Google providers keep billing after a stop, and so does Answer now on those models | 3.6 |
| Markdown | **Must** | Headings, lists, tables (menus, spends, itineraries; tables scroll sideways), code blocks with Copy and a language label, links, quotes. `multiplatform-markdown-renderer-m3` + `-code`, `retainState=true` for streaming | 3.6 |
| Copy and select text | **Must** | Icon row under the newest reply; long-press any turn → actions sheet; "Select text" opens a selectable view | 3.6 |
| Web search with citations | **Must** | "Web: Auto / On / Off" chip in the composer. OpenRouter's web search server tool with at most 3 results a search; numbered citations open a Sources sheet. Cost from the catalogue's `pricing.web_search`: $0.01 a search on GPT-6 Sol, Luna and Claude Opus, $0.014 on Gemini, plus the result tokens, so **about ₹1–1.5 a search**. Auto becomes "On request" after 80% of the day's budget. Glasses: only on request (C12) | 3.6 |
| Model per chat | **Must** | Model chip in the composer (section E). A change applies from the next reply | 3.6 |
| Voice input (dictation) | **Must** | Mic fills the text box with live partial text; you edit, then send. Replies are written in typed style (fixes `byVoice=true` forcing spoken style, `ui/AppState.kt:168-178`). Uses the glasses mic when they are on | 3.6 |
| Conversation list: search, rename, pin, delete with undo | **Must** | 3.6: a `ModalNavigationDrawer` on today's store with New chat, title search, rename (`ChatRepo.rename` exists, `data/Chat.kt:85`), pin to top, delete with an 8 s Undo, and a BackHandler. 4.0: full-text search over every turn, date groups, Trips, the "On your glasses" card | 3.6 / 4.0 |
| Retry | **Must** | 3.6: Retry on the last reply (re-run with the write tools off). 4.0: on any reply, with Retry with another model · Shorter · More detail. Versions sit on the turn as "‹ 2/2 ›" (a second opinion). **Retries never repeat side effects** (C13) | 3.6 / 4.0 |
| Edit and resend | **Must** | 3.6: Edit on your last message (the composer refills and the old reply is dropped). 4.0: any of your turns; later turns fold under "Show the earlier version". If the old turn logged something, Fieldnote undoes that log first and says so (C13) | 3.6 / 4.0 |
| Jump to latest; scroll only when at the bottom | Should | "↓ New reply" pill; replaces the forced scroll (`ui/ChatScreen.kt:74`) | 3.6 |
| No OpenRouter credit | **Must** | HTTP 402 gets its own state: a danger banner "OpenRouter credit is used up · Top up ›", the glasses say "Your OpenRouter credit has run out. Top up on your phone.", queued turns stop retrying, local commands keep working (E7) | 3.6 |
| Read aloud | **Must** | On the phone or the glasses (your last choice is remembered). Reads the turn you tapped, not the photo's last answer (fixes `ui/DetailScreen.kt:83,140`) | 4.0 |
| Search past chats (as a model tool) | **Must** | `search_conversations(query)` returns snippets with titles and dates; shown as an action row "Searched your chats · 3 matches ›". Private chats are searched only from the phone | 4.0 |
| Long conversations | **Must** | Rolling summary: past 40 turns, older ones fold into a memo written by the Quick model (about ₹0.05); `session_id` = conversation id for prompt caching | 4.0 |
| Custom instructions | **Must** | "About you" (the existing `aboutMe`) and "How to answer" (Brief / Balanced / Detailed, units, ₹); per-conversation and per-trip instructions | 4.0 |
| Offline send queue | **Must** | "Queued · sends when you're online" on your turn; drains by itself (WorkManager); a queued turn keeps the time and place it was asked (C10) | 4.0 |
| Private chats | **Must** | A per-conversation flag: never named aloud or on the lock screen, left out of "list chats" and related resume, and sent with `provider: {data_collection: "deny"}` (C12). On by itself for shared-in documents and for chats the auto-titler marks as health, money or ID | 3.6 flag; automatic for share-ins in 3.8 and for titles in 4.0 |
| Uploads | **Must** | Phone photos in 3.6; PDFs, text, video and the glasses album in 3.8; the rest in 4.3 (section D) | 3.6 / 3.8 / 4.3 |
| Share | Should | One reply as text, or the whole chat as Markdown | 4.0 |
| Delete one turn | Should | Long-press › Delete, with undo | 4.0 |
| Day dividers and timestamps | Should | "Today", "Yesterday 21:10"; exact time on long-press | 4.0 |
| Split into a new chat; Move to… | Should | Fix a mis-filed glasses turn in 2 taps (`ChatRepo.move` exists, `data/Chat.kt:104`, but has no UI); **"Move everything since 13:38 to…"** moves a run of turns at once | 4.0 |
| Auto titles | Should | Titled once after the second reply by the Quick model; editable; a retitle of the chat the glasses are in is spoken once (not for Private chats) | 4.0 |
| Composer drafts per conversation | Should | Unsent text survives switching chats and app death | 4.0 |
| Suggested follow-ups | Could | 2 chips under a Look answer, from the Look's own output (no extra call) | 3.9 |
| Saved memory | Should | "Save to memory?" and a visible list in Settings: edit, delete, pause. At most 40 facts in the prompt. (From 3.5, "remember that I…" already becomes a proposal to update your profile, not a place note, C7) | backlog |
| Temporary chat ("off the record") | Should | Not in history, search or memory; deleted after 24 h; "Keep" converts it. Glasses never join one unless you say "off the record" | backlog |
| Talk mode on the phone | Could | Hands-free loop in the same thread with phone mic and speaker, live transcript, [End] bar | backlog |
| Export | Should | 3.5: "Export everything (zip)" of all app data, runnable before any risky install. Later: all conversations as Markdown | 3.5 / backlog |
| Image generation, canvas documents, full-duplex voice | Won't (4.x) | Not asked for; the glasses' 8 kHz call mic makes full duplex impractical. So the model lists show text-output models only | — |

### C2. What a conversation is

A **conversation** is an ordered list of **turns** with a **scope**.

| Scope | Created when | Spoken name (never changes) | Phone subtitle | Example |
|---|---|---|---|---|
| `day` | The first glasses turn of a local day (the day starts at 04:00) with no trip covering it | The weekday ("Wednesday"); "7 October" when older than a week | Auto summary after 6 turns ("Lodhi Garden, dal lunch") | "Wed 7 Oct" |
| `trip_day` | The first glasses turn of a day a trip covers (trip start −12 h to trip end +12 h) | "Japan, day three" | Auto summary ("Nishiki market, Fushimi Inari") | "Japan · Day 3" |
| `topic` | "New chat" on the phone; "new chat about X" by voice; a share into a new chat | Its title | — | "Japan visa documents" |
| `temp` | "Off the record" (backlog) | "Off the record" | — | — |

- **Why days, not outings.** A day gives at most one glasses conversation a day (one spoken cue in the morning, not three),
  names that are easy to say back ("back to yesterday", "back to day two"), and a natural unit for review.
- **Starting or ending the glasses never creates, closes or changes a conversation.** This is true in code today
  (`service/FieldService.kt:146-181`) and becomes a stated rule.
- A **turn** is one input (typed, spoken, Look, shared, tap photo) and everything Fieldnote did and said in reply: action rows, the
  answer, proposals, notices.
- **Until 4.0** the store is today's `chat.json`, and the day thread is a plain chat named "Glasses · Wed 7 Oct" that 3.5 finds or
  creates (J). The 4.0 migration turns those chats into `day` conversations.

### C3. Placement: which conversation a glasses turn joins

**Phone turns** always go to the conversation on screen. **Share-in** goes where you pick. **A question or "Look as" on Photo
detail** goes to the conversation that holds that photo's capture or its latest Look turn; if there is none (Meta shutter or album
photos), to the day or trip-day thread for the photo's date. It never changes where the glasses are, and the line above Photo
detail's composer says where it will go ("Goes to *Japan · Day 3* · Change"). **"Ask in chat"** from Photos multi-select opens a New
chat with the photos in the composer.

Only glasses turns are placed by the rules below. They run in code, in this order, before any model call, take under 20 ms and are
unit-tested on the JVM. **Two rules to remember:** Looks and tap photos always go to today's thread unless you name a chat, and a
question about what you just looked at goes with the Look.

```
State (persisted in spine.db, survives restarts):
  G = glasses conversation { id, set_by: auto | wearer | handoff, held, set_at, last_turn_at }
      set_by  wearer  = you chose it by voice ("back to X", "new chat", "stay here")
              handoff = you tapped "Continue on glasses" on the phone
              auto    = placed by rules 4–6
      held          = true only after "stay here" or "Continue on glasses"; "back to X" and "new chat" just move G,
                      and the 45 min window (rule 5) carries on from there
      set_at        = when you chose it; the 3 h hold counts from here and is never refreshed
      last_turn_at  = the latest turn in G from any source
  L = the latest Look anywhere { turn_id, conv_id, at, digest }
  S = the scope thread now: trip_day(trip, today) if a trip covers now, else day(today); a day starts at 04:00

place(turn):
 0. EXPLICIT   local parser on your words (C7), always first
      "new chat" | "new topic" | "new chat about X"     → new topic chat; G := it (wearer)       · "New chat."
      "back to X" | "continue X" | "open X"              → fuzzy title match over 30 days, Private chats left out:
                                                           1 match → G := it (wearer)          · "Back in X."
                                                           2+      → "Japan visa or Japan food?" (the window opens)
                                                           0       →                           · "I can't find X. Staying in <G>."
      "stay here"                                         → G held for 3 h (wearer, held)      · "Staying in X."
      "look at this for X" | "log this to X"             → this Look or photo joins X; G unchanged · "In X."
      "which chat" | "where were we" | "call this X" | "move that to X" | "move all that to X" | "show me on the phone"   (C7)
 1. LOOKS AND TAP PHOTOS   → S, always. G is unchanged.
      If G is a topic chat, G also gets a one-line link turn "Looked at: bookshop sign ›" (links in a row merge: "3 Looks today ›").
 2. HOLD       spoken; G.held; now − G.set_at < 3 h; no 04:00 boundary since set_at
                                                          → join G · silent, but "Still in G." when G's last glasses turn is > 45 min old
 3. ABOUT THE LOOK   spoken; no chat named; L.at < 2 min ago, or < 10 min and the words point at it ("this", "it", "that", "here")
                                                          → join L.conv_id · silent. G is unchanged
 4. HAND-OFF   spoken; a typed phone turn in P ≠ G is < 10 min old and newer than G.last_turn_at;
               AND the spoken turn is about P: it shares ≥ 2 distinctive words with P's title or its last 10 user lines
               (the same local scorer as 6b)                → join P; G := P (auto)             · "Continuing P."
 5. WINDOW     spoken; now − G.last_turn_at < 45 min; no 04:00 boundary since G.last_turn_at   → join G · silent
 6. AFTER THE WINDOW (spoken)
   6a. NAMED    the words name a conversation used in the last 7 days
                (≥ 2 distinctive title words, or "about / more on / continue" + 1 title word)   → join T; G := T (auto) · "Back in T."
   6b. RELATED  candidates = topic chats updated in the last 24 h + pinned chats, Private chats left out;
                local full-text score over each candidate's title and last 10 user lines;
                join the best only if it shares ≥ 2 distinctive words AND clearly leads the runner-up
                                                          → join T; G := T (auto) · "Back in T. Say 'new chat' to start fresh."
   6c. SCOPE    join S; G := S (auto)                     · cue only if S ≠ old G: "Wednesday." / "Japan, day three."
```

- **What this fixes.** A Look never lands in a topic chat by accident: not after "Continue on glasses", not after an automatic
  hand-off, not after "new chat about train times". A spoken hand-off needs evidence that you meant it (shared words), so typing in
  "SIP vs FD" at your desk and then asking about a building outside keeps the building in today's thread. A hold lasts 3 hours
  from the moment you chose it, is never stretched by use, ends at 04:00, and the next turn after it ends says where you are
  ("Back in Thursday."). Follow-ups about a Look go with the Look, so "is it veg?" sits under the menu.
- **What still holds.** With "stay here" or "Continue on glasses", your spoken questions (including ones about a Look) go to the
  held chat, and the link turn shows which photo they are about. That is the "reading my visa papers" case: hold "Japan visa", look
  at the bank statement, ask "does it have a stamp on every page?", and the answer lands in "Japan visa" next to "Looked at: bank
  statement ›". To file the Look itself there, say "look at this for the visa".
- **Numbers:** window 45 min (Settings: 20 / 45 / 90), hold 3 h from the choice, Look follow-up 2 min (10 min with "this / it"),
  hand-off 10 min with ≥ 2 shared words, day boundary 04:00, trip coverage ±12 h. No vendor publishes a window length, so these are
  design choices. `turn_joined{rule, related}` and `turn_moved` tune them.
- **Why this does not reproduce "new session every time".** Outside "new chat", the glasses can open at most one new conversation a
  day (the day or trip-day thread). Rule 6b can only *resume* an existing chat; a miss falls back to today's thread, never to a
  fresh chat.
- **The model no longer routes.** The tools `new_chat` and `switch_chat` and the routing paragraph go (`data/Agent.kt:211-218,
  242-246, 294-295`); 3.5 already removes them (J). In their place: read-only `search_conversations(query)` and
  `rename_conversation(title)`. So "relevant session" is met twice: the turn lands predictably, and the model can pull context from
  any conversation ("what did the hotel guy say about the fort on Tuesday?").
- **On the phone**, a change shows as a centred notice: "Glasses moved here from *Wed 7 Oct* · Undo · Move everything since 13:38 ›".
  Undo moves the turn back and restores G. A 6b resume adds one line under the first glasses turn: "Reopened because you said 'visa
  documents'. Wrong chat? Move."
- **At Start glasses:** if a hold or the window still applies, "Glasses on. Still in *Japan, day three*." Otherwise just "Glasses on."
  A Private chat is said as "your phone chat".
- **JVM tests** (named cases, all in the 4.0 suite): "Continue on glasses on *Japan visa*, then 3 Looks over 4 h → the Looks are in
  the day thread, link turns in *Japan visa*, and after 3 h spoken turns fall back to rules 3–6"; "typed in *SIP vs FD* 5 min ago,
  then 'what building is this?' → day thread, no hand-off"; "typed in *Japan visa* 8 min ago, then 'and how many months of
  statements?' → *Japan visa*, 'Continuing Japan visa.'"; "menu Look, then 'anything veg?' 40 s later while G is *Japan visa*
  (auto) → the menu's day thread"; "'stay here' at 23:30 → first turn after 04:00 says 'Back in Thursday.'"; "restart during a
  hold → the hold ends at set_at + 3 h, not later".

### C4. Double-tap and photo answers in the same conversation

- A **double-tap** writes a Look pair into the conversation chosen by C3 (today's thread unless your words named a chat): your
  capture (photo, source "double-tap") and the answer card (kind, spoken text, fuller phone text, chips, any proposal).
- A **tap** writes a compact photo row ("Photo · 11:42"). Taps within 2 min collapse into one strip ("3 photos"). The photo is the
  subject of your next question for 10 min.
- `AnalysisQueue.ask` (`data/Queue.kt:21-57`) stops appending to `Note.thread` and returns a Look result that the store writes as
  turns. `Note` keeps only the media sidecar (state, favourite, hidden, place). From 3.5 until 4.0, each double-tap pair is also
  written to the dated glasses chat in `chat.json`, tagged `source=double_tap` with the `Note` message's time, so the 4.0 migration
  can drop the copy (C11).
- **Follow-ups know what the glasses just said.** A voice turn gets a **text digest of the latest Look anywhere**, if it is under 15
  min old, whichever conversation holds it: `[Look 14:16 · menu · Japanese · text: … (≤ 1,500 chars) · prices: …]`. If the Look was a
  scene, a dish or a tap photo, the image itself also goes along at `detail: low` when it is under 10 min old (the glasses voice model
  accepts images). So "is it veg?" or "what colour is the door?" is **one** model call, not brain → look → brain (fixes critic G2).
  Until 4.0, the double-tap pair in the dated chat is in the brain's last 24 lines, which gives the same effect.
- **Fresh or last photo.** A question refers to the latest photo unless you say "look again", "this one", "now look" or "take a new
  photo" (parsed locally). The prompt line "take a fresh photo unless they clearly mean an earlier one" (`data/Agent.kt:237`) is
  inverted.

### C5. Follow-up listening window

- **When it opens** (default): after an answer to a *spoken* question; after a proposal ("Log it?"); after a chunked answer that has
  more ("More?"); after Fieldnote asks you something ("Japan visa or Japan food?"); and **after a reading Look** (a sign or other text,
  a menu, a price, a board), so "so can I park here now?" or "anything veg?" needs no gesture. **Not** after a scene or landmark
  Look, a tap photo or an instant command. Setting: "After Looks: Off / Reading kinds (default) / All".
- **Never when other audio plays.** The window is skipped when another app is playing, in wake-word mode, and when the setting is
  Off. Music is detected by counting media playback configurations from other apps, **not** `AudioManager.isMusicActive`, which is
  always true while armed because Fieldnote loops a silent clip on the music stream (`service/FieldService.kt:235-241`). So the old
  worry (music dropping to call quality after every Look) does not arise.
- **How it opens.** The answer plays on normal audio. When speech ends, Fieldnote requests the glasses mic. The **MIC OPEN** earcon
  plays only once the route is confirmed and the recogniser reports it is ready (fixes the tone that plays up to 3 s before the mic is
  live, `service/Voice.kt:41-58`). No pre-routing while speech is still playing.
- **Glasses mic only.** Every glasses-started listen (triple-tap, the window, the notification's Ask while the glasses are on) uses the
  glasses mic and **never falls back to the phone mic**; today `Voice.listenOnce` silently does (`service/Voice.kt:41-58`), which
  would open a pocketed phone's mic. If the call route does not come up, a triple-tap hears "Glasses mic isn't available" and a
  window closes silently; the phone shows "Glasses mic not available". The phone's own mic button keeps its fallback.
- **Speech-aware noise gate.** Speech must start within the window (6 s by default, long enough to think), or it closes silently with
  **MIC CLOSED**. Utterances up to 8 s. One-word fillers and anything that is neither a command nor a question close it silently.
  But **if you did speak** (the recogniser reported the start of speech, or the level rose above the gate) and recognition failed,
  Fieldnote says so: "Didn't get that. Triple-tap to ask." On a network error: "No connection for speech." When the on-device speech
  pack is installed and the network is not validated or is roaming, it asks for offline recognition up front.
- **In the window you can say:** any follow-up; "more"; "repeat"; "yes", "log it", "no" (to a proposal); "no, just translate"
  (re-read the same photo); "stop", "thanks", "that's all" (close).
- **Chain cap:** 5 follow-ups, then a tap is needed again (battery).
- **The camera comes first.** A double-tap while the window is open closes the call route (`clearCommunicationDevice`) and waits for
  normal audio before opening the camera, because the call mic and a camera stream together drop to about 1 fps on Android and the
  route must be set before a stream starts. Phone dictation holding the glasses mic is cancelled the same way.
- **Settings › Glasses › Follow-up:** after questions 6 s (default) / 10 s / Off; after Looks Off / Reading kinds (default) / All.
  The setting says plainly that music drops to call quality while the mic is open.
- **Device gate.** The window ships default-on only if the 3.5 device test shows taps still arrive while the call mic is open and the
  route time is acceptable (`voice_route_ms`). Otherwise it ships off, with the notification and voice as the way in.

### C6. The glasses grammar: stop, barge-in, feedback

**The rule you learn: when Fieldnote is busy, one tap stops it. Two taps always Look. Three taps always Ask.**
When it is idle, one tap takes a photo.

| State | 1 tap | 2 taps | 3 taps | What you hear on entry |
|---|---|---|---|---|
| Ready | Photo (full, saved) | **Look** | **Ask** (listen) | 1, 2 or 3 pips within 150 ms |
| Capturing | **Cancel** (a saved photo is kept). If the tap pauses the camera stream instead of reaching Fieldnote, the pause itself counts as Cancel | Cancel (Look only if Test A2 shows taps arrive during a live stream) | Cancel (Ask likewise) | WORKING pulse after 2 s |
| Listening | **Cancel** | Cancel, then Look | Restart listening | MIC OPEN (only when the mic is live) |
| Thinking | **Cancel the turn** (closes the request) | Cancel, then Look | Cancel, then Ask | WORKING pulse every 2 s after 2 s |
| Speaking | **Stop speech** | Stop, then Look | Stop, then Ask | — |
| First 1.5 s after speech ends | Treated as a late "stop" (no photo, so the camera light never surprises people nearby) | Look | Ask | — |
| Follow-up window open | Close the window | Look | Restart listening | MIC CLOSED on timeout |
| Paused (music or Meta) | Taps go to your music or Meta, not Fieldnote | | | "Paused." on entry |

- **Feasibility.** `onKey` runs on the MediaSession callback, not on the worker that blocks while speaking
  (`service/FieldService.kt:249-261, 435-437`), and `enqueue(Trigger.Stop)` already stops speech at once (`:266`). Stop while
  speaking is cheap. **Cancel while capturing or thinking is real work:** today one coroutine loop runs every trigger
  (`service/FieldService.kt:156`), so cancelling it would kill the queue. 4.0 gives each trigger its own child `Job` and cancels the
  OkHttp call on cancellation (about 1 d). 3.5 ships stop-while-speaking only.
- **A tap during a capture may never arrive as a key.** `service/Glasses.kt:44-50` notes that a touchpad tap during a live camera
  session may pause the stream instead, and `FieldService.kt:105` already turns PAUSED during a capture into HELD, which would hang
  until the 20 s silence cap. So from 3.9, `DeviceSessionState.PAUSED` (or a paused stream) during a capture **is** the cancel: the
  capture aborts itself (no child `Job` is needed for that), tears down, says "Cancelled" within 0.5 s and keeps any frame already
  saved. "Cancel, then Look/Ask" during a capture ships only if the 3.5 device gate shows media keys arrive during a live stream. The
  notification's Stop is the path that always works.
- **Tap pips.** `onKey` plays 1, 2 or 3 short pips within 150 ms, before any capture work. You know the tap registered and how it was
  counted. Today the first sound after a double-tap is CAPTURED, about 5 s later.
- **The 7 earcons** (4.2; short OGG files through SoundPool, replacing `ToneGenerator`, `service/Voice.kt:137-152`; the tap pips
  come in 3.5 and today's tones stay until then):

| Earcon | Sound | Means |
|---|---|---|
| TAP pips | 1, 2 or 3 short pips | Heard your tap, and counted it |
| MIC OPEN | soft rising two-note | Speak now (mic is live) |
| MIC CLOSED | soft falling note | Mic closed |
| WORKING | quiet tick every 2 s | Still capturing or thinking |
| SAVED | bright two-note | Photo saved, logged, pinned, done |
| NEEDS A YES | rising question chirp | A proposal waits for "log it" |
| FAILED | low buzz, then a spoken reason | Something failed |

  Everything else is spoken in 1–3 words: "Glasses on", "Glasses off", "Paused", "Back in X", "Reading, hold still", "Offline, saved
  for later". Each earcon plays on the audio route actually in use. Done when the owner can tell every one apart with eyes closed,
  outdoors in traffic, over both normal and call audio (the brief's test).
- **Every spoken hint names an action that works in the next state.** "More?" is spoken only when the window will open. When it
  will not (window off, music playing), the hint is "Triple-tap for more."
- **"Repeat" / "say that again"** replays the last answer, so an accidental stop loses nothing.
- **Pause taps (music mode).** "Pause taps", the notification, or the Glasses sheet release the media buttons for 30 min: the silent
  loop stops and the media session goes inactive (`releaseMediaButtons`, `service/FieldService.kt:243`). Your music gets the taps.
  The notification shows **Resume** and the time left. At the end Fieldnote reclaims the buttons and says "Taps are back."
- **When your music starts while the glasses are on.** Android sends media buttons to the most recently active player, so the taps
  may move to your music app anyway. Default (K8): Fieldnote detects the other playback, says once "Taps are with your music", and
  enters Paused. **It does not take the taps back just because the music stopped:** you often pause music with a tap and resume it
  with another, and if Fieldnote had reclaimed the taps in between, your "resume" tap would take a photo in front of people. It
  reclaims only when you say so (voice "taps back", the notification's Resume, the Glasses sheet) or after 10 min with no other
  player active, and then says "Taps are back." The notification's Look and Ask keep working throughout. This must pass Test A2 with
  music, including "pause the music by tap, wait 30 s, resume by tap", before it ships.

### C7. Knowing and changing the active conversation by voice (local, no model)

| Say (after a triple-tap or in the window) | Does | You hear |
|---|---|---|
| "which chat" / "what chat am I in" | Nothing moves | "Japan, day three. 6 turns. Last: is the broth veg." |
| "where were we" / "recap" | First sentence of the last 2 answers | "Last: the ramen at Kazehana is pork-bone broth, 980 yen…" |
| "new chat" / "new topic" / "new chat about X" | New topic chat; the rest of the phrase is asked in it | "New chat." then the answer |
| "back to X" / "continue X" / "back to yesterday" / "back to day two" | Fuzzy match over the last 30 days | "Back in X." / "Japan visa or Japan food?" / "I can't find that chat. Staying in Wednesday." |
| "list chats" | Reads the 3 most recent titles (Private chats left out) | "Recent: Japan, day three; Japan visa; Kyoto hotels." |
| "stay here" | Holds the glasses here for 3 h from now (ends at 04:00); spoken questions stay, Looks still go to today's thread with a link here | "Staying in Japan visa." |
| "call this chat X" | Rename | "Renamed to X." |
| "move that to X" | Moves the last question and answer (or Look) there; the glasses follow | "Moved to X." |
| "move all that to X" | Moves every glasses turn since the last switch there | "Moved 4 turns to X." |
| "show me on the phone" | Heads-up notification that opens the turn (tables, long answers) | "On your phone." |
| "off the record" (backlog) | Temporary chat for 30 min | "Off the record for 30 minutes." |

**"Remember" is split (3.5)** so place notes and facts about you do not clash. Today any phrase starting "remember " becomes a place
note (`h.startsWith("remember ")`, `service/TravelSession.kt:82-87`), so "remember that I'm allergic to peanuts" is misfiled. From 3.5:
"remember this", "remember where I parked", "remember locker 42" and "remember my room is 412" stay place notes; "remember that I…",
"remember I'm…" and "remember my" + a fact about you (diet, allergy, passport, birthday) go to the brain as a proposal to update your
profile through `set_setting`: "Save to your profile: allergic to peanuts?" A memory list is in the backlog.

**Private chats are never named aloud.** In every cue above, a Private chat is "your phone chat" ("Back in your phone chat.").

### C8. How the phone shows glasses turns

```
┌────────────────────────────────────────────┐
│ ≡  Japan · Day 3                 ● Ready  ✎ │  subline: "Kyoto" (the place only; the pill already says Ready)
├────────────────────────────────────────────┤
│ ●● DOUBLE-TAP · 13:02                      │  eyebrow with tap dots, teal rail on the left
│ [ photo 16:10                  MENU · JA ] │
│ LOOK · GEMINI 3.8 FLASH · 3.1 s · ₹0.52    │
│ Menu, Japanese. Tonkotsu ramen ¥980        │
│ (about ₹559) is the house special…         │
│ [Prices in ₹] [Anything veg?] [Read it all]│
│                ●●● 13:03 ▎is the broth veg? │  your spoken turn, teal rail
│ GPT-6 LUNA · 1.8 s · ₹0.11                 │
│ No. It's pork-bone broth. The yuzu shio…   │
├────────────────────────────────────────────┤
│ Smart ▾   Web: Auto                ≈ ₹2.10 │
│ [+]  Message Fieldnote            [mic][↑] │
└────────────────────────────────────────────┘
```

- **The glasses state is shown once**, by the pill. The **banner appears only when it has an action**: glasses elsewhere ("Glasses
  are in *Wed 7 Oct* · **Continue here**"), live ("Speaking · **Stop**"), or paused ("Taps are with your music · **Resume**"). The
  subline under the title is the place ("Kyoto"), not the state.
- **Live mirror.** A glasses turn appears the moment it starts: "Listening…" with a pulsing teal dot, then your words, then the photo
  as soon as it is saved (before the answer), then the streamed answer. Tool steps show as action rows.
- **Link turns.** In a topic chat that holds the glasses, a Look filed in today's thread shows as one line, "Looked at: bookshop sign
  · Wed 7 Oct ›"; links in a row merge ("3 Looks today ›").
- **Voice answers are short.** The turn's menu has "Expand": the same question answered in typed style in the same conversation.
- Instant commands carry a small tag "on phone · no model" (today `model="on phone"`, `service/FieldService.kt:398`).
- The drawer's **On your glasses** card sits at the top: title, teal dot, "active 12 min ago".
- **TalkBack** reads a glasses turn as "From glasses, double-tap Look, 13:02", not the tap-dot glyphs.

### C9. "Continue on glasses" (phone → glasses) and back

- **Where:** Conversation info; the conversation's ⋮; drawer long-press; the banner's "Continue here". Until 4.0, the drawer's
  long-press menu (3.6; in 3.5 the old list's long-press).
- **Glasses on:** G := this conversation (`set_by=handoff`), held for 3 h from the tap, never stretched by use, ending at 04:00.
  Spoken questions stay there; Looks still go to today's thread with a link turn here (C3). The glasses say "Now in *Japan visa*."
  (a Private chat is "your phone chat"). A snackbar confirms "Your glasses will continue *Japan visa* until 17:40".
- **Glasses off:** the button reads **Start glasses here**. It starts the service (allowed, because the app is on screen), then sets G.
- **Opening a chat on the phone does not move the glasses.** Only this action, or your voice, does. (3.4 pins whatever chat you open,
  `ui/ChatScreen.kt:99`, `data/Chat.kt:83`; 3.5 stops that.)
- **Voice turns in any conversation use the Glasses voice model** (fast), unless the conversation has "Also on glasses" on.
- **Glasses → phone:** tapping the session notification opens G at the latest turn (today it opens the last tab,
  `service/FieldService.kt:514`).

### C10. Restarts, interruptions, slow data

| Event | Behaviour |
|---|---|
| Service killed and restarted | G, `set_by`, `set_at`, `last_turn_at`, the last capture key and the "more" offset (`spoken_upto`) are read from the store; the rules continue unchanged. Today `pinned`, the last capture key and the "more" buffer are lost (`data/Chat.kt:41`, `service/Bus.kt`) |
| Death in mid-stream | The turn is marked "Interrupted" with Retry. The glasses never replay on their own |
| "More" after a restart | Continues from the saved word offset |
| App process killed | Composer drafts and partial replies are kept |
| Phone reboot | The glasses are off (Android blocks starting a mic service in the background). At the next Start the window rule applies |
| Start or end of the glasses | No effect on conversations |
| **Glasses disconnect, folded or taken off mid-turn** | On `ACTION_AUDIO_BECOMING_NOISY` or the glasses' Bluetooth disconnect: speech stops, any open window or listen is cancelled, and the answer goes to a notification. **The answer is not spoken from the phone**: "Speak on phone when the glasses are off" (the missing toggle, `data/Prefs.kt:69-71`) is **Off by default for glasses-started turns** and applies to phone-started turns only |
| **Slow connection** | No first token by 7 s: "Slow connection, still trying." At 20 s: the turn is queued, "I'll put the answer on your phone." It is never left on the 90 s read timeout (`data/Agent.kt:40`) |
| **Offline** | Local commands work. Other turns queue with "Offline, saved for later". WorkManager (network constraint) drains them. If the glasses are still on and the turn is under 10 min old, the answer is spoken; otherwise a notification "Answer ready" |
| **A queued turn keeps its moment** | When a turn queues, its context is frozen in the turn record: time, place label, coordinates, trip day and the latest Look digest. It is sent as "Asked at 14:10 near Fushimi Inari", and a late answer starts "About your 14:10 question: …". A turn older than 60 min that asks about "now", "here", "open" or "today" is not spoken; it arrives as a notification with **[Ask again]** |
| **No OpenRouter credit (HTTP 402)** | Its own state, not a generic failure: the glasses say "Your OpenRouter credit has run out. Top up on your phone." once; queued turns stop retrying until a call succeeds; local commands and on-device reading keep working (E7) |

### C11. One store: unifying `chat.json` and `Note.thread`

**Store:** `spine.db` using the framework `SQLiteOpenHelper`. No Room, no annotation processor; this matches the codebase. It is
split in two files so the part that is backed up stays small:

```sql
-- spine.db (in Auto Backup: small, the record of your life)
conversation(id PK, title, title_src /*auto|wearer|model*/, scope /*topic|day|trip_day|temp*/, trip_id, day, pinned, archived,
             private, model, effort, also_on_glasses, instructions, summary, summary_upto, draft, created_at, updated_at,
             last_glasses_at, last_phone_at)
turn(id PK /*ULID*/, conv_id, parent_id, variant, superseded, role /*user|assistant|event*/,
     kind /*text|voice|photo|look|link|action|proposal|notice|error*/, text, spoken, spoken_upto, detail_md, payload_json,
     source /*phone|tap|double_tap|triple_tap|followup|wake|notification|share|shortcut*/,
     state /*sending|streaming|thinking|done|queued|failed|stopped|interrupted*/, model, ms, think_ms, cost_micro_usd, look_kind,
     asked_ctx /*json: time, place, coords, trip day, Look digest; frozen when a turn queues*/,
     links /*json: mealId, spendId, noteId, bookingId*/, created_at)
attachment(id PK, turn_id, conv_id, kind, mime, name, bytes, duration_ms, pages, w, h,
           sha256, taken_at /*the stable key for photos*/, media_key /*ms:123, a cache re-resolved after a restore*/,
           path, sent_as /*native|frames|text*/, sent_once)
proposal(id PK, turn_id, kind /*spend|meal|booking|wifi|contact*/, payload_json, state /*open|accepted|declined|undone*/, created_at)
glasses_state(k PK, v)        -- active conversation, set_by, set_at, last_turn_at, last_capture_key, latest Look, pinned intent, pause-until
memory(id PK, text, source_turn, enabled, created_at)

-- spine-cache.db (in noBackupFilesDir: large, rebuildable)
turn_fts USING fts4(text, title)                      -- rebuilt from spine.db after a restore
attachment_text(attachment_id PK, digest, transcript) -- up to 60k characters per document
tool_result(turn_id PK, json)                         -- hidden tool results that later turns can read
```

- **No 2,000-message global cap** (`data/Chat.kt:96`; 3.5 already lifts it, J). Tool results are kept (in `spine-cache.db`), so later
  turns can see what `trip_info` or a Look returned (today they are dropped, chat-session §1.1).
- **Backup stays under Android's quota.** Auto Backup stops backing up an app entirely once its data passes 25 MB. So only
  `spine.db`, the meals and trips go to backup; digests, transcripts, tool results and the search index do not. A weekly check
  measures the backed-up set and warns at 20 MB: "Your backup is nearly full · Export everything". Photos are keyed by `sha256` plus
  the time taken, with the MediaStore id as a cache, so after a restore to a new phone they are found again; anything missing shows as
  "Attachment not on this phone", never a broken row.
- **Migration (first 4.0 launch), done safely:**
  1. It runs inside the store's first access, in **one idempotent transaction, before any writer**. The service can start from the
     notification before the UI, so the service waits for it too.
  2. It reads from the **untouched copy** of `chat.json` and `notes.json` that 3.5 put in `filesDir/migration-backup/` on its first
     launch, plus anything written since (the live files and `trimmed.jsonl`). A user-visible export ("Fieldnote backup, 21
     Jan.zip") is offered in the same run.
  3. Each `Chat` becomes a `topic` conversation; each "Glasses · <date>" chat from 3.5 becomes a `day` (or `trip_day`)
     conversation. Each `ChatMessage` becomes a turn with a new ULID (or its 3.6 message id), keeping the `at` order.
  4. **Fields added in 3.6–3.9 are mapped, from a frozen written schema of `chat.json` and a real 3.9 file as a test fixture:**
     `Chat.model/effort/private` → `conversation.model/effort/private`; `attachments[]` → `attachment` rows, with the files moved
     into `noBackupFilesDir/attachments/<convId>/`; web citations → `payload_json`; stopped and partial replies → `turn.state`;
     `photoKey` → an attachment; `mealId`, spend and proposal ids → `links`.
  5. Each `Note.thread` pair: **skipped if a chat line already mirrors it** (same photo and the same time within 2 s, or the same
     text hash; 3.5 tags its mirrors `source=double_tap`). Otherwise, if a chat turn references the same photo, the pair is inserted
     there at its time; if not, into a day conversation for the photo's date, titled "Photos · Tue 16 Sep".
  6. `current` becomes G with `set_by=auto`. The saved model choices map to roles (E6).
  7. **Counts are checked** before the migration is marked done: messages in = turns out + mirrors skipped; attachments in = out;
     citations in = out. The check and the skip count are logged. On failure the app keeps running on today's store with a banner
     "Couldn't move old chats. Send diagnostics."
  8. **No dual-write, and no downgrade.** A signed release APK cannot be downgraded without uninstalling, and uninstalling wipes the
     data. Keeping `chat.json` written in parallel would not help either, because 4.0 stops writing `Note.thread`, so switching back
     would lose every 4.0 Look. Instead: the backup copy stays untouched, the export zip exists, bugs are fixed forward in 4.0.x, and
     a hidden **Developer › Re-run migration from backup** rebuilds the store and re-appends the turns created since (they carry ids).
- **Every writer changes:** `Agent.run` (`data/Agent.kt:58-78`), the instant commands (`service/FieldService.kt:396-398`),
  `FieldService.analyse` (`:345-358`), `AppState.ask` and `sendChat`.
- **Every reader changes,** including the one all three proposals missed: `TravelActions.find` (`data/TravelActions.kt:49, 55`),
  which serves `find_notes` ("where did I see the blue door?") and searched photo answers. It moves to full-text search over turns.
  Also `DetailScreen`, `Queue` (`data/Queue.kt:32, 39, 111`), the `recent_photos` tool (`data/Agent.kt:167`) and the Glasses "Last
  answer" (`ui/SessionScreen.kt:92`).
- `Note.thread` stays readable for one release, then is dropped in 4.1.

### C12. What goes to the model

| Turn | Model (role) | Sent | Output |
|---|---|---|---|
| Typed | The conversation's model (default Smart) | Stable system prefix (identity, profile, instructions, memory) · conversation summary · last 30 turns with the 3 latest hidden tool results · attachments of this turn only (earlier ones as digests) · **volatile facts last** (local time, trip, today's food, photo age) · all tools + web search (3 results) | Cap from the catalogue's `max_completion_tokens`, reasoning budget on top |
| Glasses voice | Glasses voice role (the 3.5 bake-off winner) | Short voice prefix · summary · last 12 turns · latest Look digest from anywhere (and image for visual kinds) · volatile facts last (or the frozen `asked_ctx` for a queued turn) · **voice tool subset (about 15 tools):** look, take_photo, log_meal, edit_meal, log_expense, food_summary, spend_summary, convert_currency, trip_info, save_note, find_notes, search_conversations, show_card, hand_off_to_meta, end_session · web only on request | Spoken sentence by sentence up to the answer-length budget (default 15 s); the rest is kept for "more" |
| Look | Look role (the 3.5 bake-off winner) | Look prompt · profile · trip · place · the image (and on-device text as a hint) | Speech first (≤ 45 words, no proposals or amounts to confirm), then JSON |

- `session_id` = conversation id on every OpenRouter call, for sticky provider routing and prompt-cache hits. Volatile facts sit at
  the end of the system prompt so the prefix caches (today they are mixed in, `data/Agent.kt:247-257`).
- **Private chats** send `provider: {data_collection: "deny"}` on every request, so only providers that do not store prompts serve
  them (`zdr: true` is the stricter option, a setting). If the chosen model has no such provider, the send stops with "GPT-6 Sol has
  no private route. Send anyway · Use another model"; it never silently sends normally. OpenRouter's zero-retention rules do not cover
  its plugins, so web search is off in Private chats unless you turn it on for one message.
- **Web on glasses:** the web tool is offered on a voice turn only when the words ask for live facts ("look up", "search", "open
  now", "today's", "latest", "weather") or when Settings › Glasses › Web is On. Low-data mode turns automatic web search off.
- **Agent lanes.** The single brain lock (`data/Agent.kt:41, 59`) becomes two lanes: glasses and phone. A glasses "is it veg?" never
  waits behind a typed turn's video preparation or a slow reply. Attachment preparation runs outside any lock. The shared
  `chat.busy` flag (which freezes Chat during meal edits, `ui/AppState.kt:181, 193`) becomes per-conversation state. The lane split
  ships in 4.0 only if two weeks of 3.x telemetry show glasses turns waiting on typed ones; otherwise it waits.

### C13. Retries and edits never repeat side effects

- **Retry and Retry with…** run with the write tools disabled (`log_meal`, `log_expense`, `save_note`, `add_booking`, `take_photo`).
  They reuse the original turn's stored tool results.
- **Edit and resend** of a turn that wrote something: the old writes (found through `links`) are undone first, with a snackbar
  "Undid lunch log (520 kcal) · Redo", then the edited turn runs with tools.
- Every accepted write carries **Undo** on its turn and in a snackbar. "Undo that" by voice reverses the last write within 10 min.

---

## D. Uploads (ask 2)

**Phone photos arrive in 3.6. PDFs, text files, videos up to 3 min, the glasses album, "+ Last glasses photo" and the "Ask Fieldnote"
share door arrive in 3.8**, on today's store: an OpenRouter `file` part works with any model, a video is one `video_url` part to a
video model, and 3.4 already has `copyIn` and `sniff` (`ui/AppState.kt:368-407`). **Audio, voice notes, video to models that cannot
watch video (frames + transcript), trim, Direct Share and Office files (if you want them, K12) arrive in 4.3.** The 4.0 migration
carries every 3.x attachment across (C11).

### D1. The composer and the attach menu

```
[ chip: ▢ IMG_2031 · 2.1 MB ✕ ] [ chip: PDF ryokan-booking.pdf · 3 pages ✕ ] [ chip: ▶ nishiki.mp4 · 0:48 · Preparing 40% ✕ ]
[ + Last glasses photo · 2 min ago ]                                   ← only when a glasses or Fieldnote capture is < 10 min old
Smart ▾      Web: Auto                                              ≈ ₹2.40
[+]  Message Fieldnote                                          [mic] [↑ / ■]
```

**+ opens the Attach sheet:**

```
Add to this message                                                          2 of 10
[ Camera ]  [ Video ]  [ Photos & videos ]  [ Files ]          ← 72 dp tiles, icon + label
FROM YOUR GLASSES
  ( ) Take a glasses photo now            ← only while the glasses are on; full photo, about 12 s; "Hold still" is spoken
  [thumb][thumb][thumb][thumb][thumb] All ›   ← last 30 from the Meta AI album and Fieldnote captures, videos included, multi-select
[ Voice note ]   [ Paste ]                ← 4.3; Paste appears when the clipboard holds an image or long text
Up to 10 items · 25 MB per message · videos up to 3 min
[                 Add 3                 ]  ← sticky primary button, shown once something in the strip is selected
```

- **One tap for the common case.** 3.4 attached the latest glasses photo with one tap (▣, `ui/ChatScreen.kt:138-145`). That stays one
  tap: the **"+ Last glasses photo · 2 min ago"** chip above the composer, shown while a capture is under 10 min old.
- **Selecting from the glasses strip** rings each thumbnail; the sticky **Add 3** button (hidden at zero) puts them in the composer.

Mechanisms (no new permissions): `PickMultipleVisualMedia(10)` with images and video (no permission needed); `TakePicture` and
`CaptureVideo` through the existing FileProvider (`AndroidManifest.xml:59-65`; no `CAMERA` permission is declared, so none is
needed); `OpenMultipleDocuments` with the MIME list below (Google Docs exported as PDF); `Media.list()` for the glasses album, which
already indexes its videos (`data/Media.kt:24, 52-56`); `MediaRecorder` AAC for voice notes (4.3). Everything is copied in
immediately to `noBackupFilesDir/attachments/<convId>/`, because picker and share grants can lapse and Auto Backup stops above 25 MB.

### D2. Supported types and limits

| Type | Accepted | Limit per item | How it is sent | Release |
|---|---|---|---|---|
| Photos | JPEG, PNG, WebP, HEIC/HEIF, AVIF, GIF (first frame) | 40 MB in; sent at ≤ 2048 px long side | `image_url`; HEIC → JPEG with `Media.cachedJpeg` (`data/Media.kt:106-124`); `detail: high` when on-device text is found, else `auto` | 3.6 |
| Video (phone or glasses album) | MP4, MOV, WebM, 3GP | ≤ 3 min (longer: "Videos up to 3 min for now"; the trim sheet comes in 4.3). **Transcoded to a size budget** (below) | Native `video_url` to a video model; to other models as frames + transcript (4.3) | 3.8 |
| Audio and voice notes | M4A, MP3, WAV, OGG, AAC, FLAC | ≤ 20 min, ≤ 25 MB | Native `input_audio` on audio models; otherwise speech-to-text, then text | 4.3 |
| PDF | PDF | ≤ 50 MB; the first 100 pages | Native `file` part when the model reads files; otherwise OpenRouter's file parser with engine `cloudflare-ai` (free), **set explicitly** so the paid default is never used by accident. Scanned PDFs offer "Read scanned pages (≈ ₹0.19 a page)" (mistral-ocr) | 3.8 |
| Text | TXT, MD, CSV, JSON, code | ≤ 60k characters | Text part; CSV as the first 200 rows plus column stats | 3.8 |
| Office | DOCX, XLSX, PPTX | ≤ 20 MB; ≤ 60k characters of text | Unzipped and read on the phone (`word/document.xml`, `xl/sharedStrings.xml` + sheets, `ppt/slides/*`); tables as Markdown | 4.3, only if you want it (K12) |
| Glasses | Full photo now; album photos and clips | as above | as above | 3.8 |
| **Per message** | ≤ 10 items, ≤ 25 MB after preparation (≈ 33 MB as base64) | | Larger: "This message is 41 MB. Remove a file." | 3.8 |

**Video size budget.** A 720p H.264 file at the usual 2–5 Mbit/s is 45–110 MB for 3 min, far over 20 MB. So the encoder is set
explicitly (Media3 `VideoEncoderSettings`) from the budget: **total bitrate = min(1.5 Mbit/s, 0.85 × 20 MB × 8 ÷ length)**, audio 48
kbit/s mono AAC. Up to 90 s: 720p at full frame rate (a 60 s clip is about 11 MB). Over 90 s: 480p at 2–4 fps, since Gemini samples
about 1 frame a second anyway (a 3 min clip is about 17 MB). The test uses a real 3-minute clip.

### D3. Per-model capability handling

- The model's `input_modalities` in the catalogue decide the path, not its name. Each chip shows a route label: **Sends as video**,
  **Sends as PDF**, **Sends as text**; from 4.3 also **Sends as 16 frames + transcript** and **Sends as audio**.
- **Incompatible pick (3.8):** a one-line banner above the composer: "*GPT-6 Sol can't watch video.* **Use Media for this message
  (≈ ₹0.80)** · Remove". It is a one-message override; the chat's model is unchanged. From 4.3 the banner adds **Send 16 frames +
  transcript (≈ ₹3.10)**.
- **Video fallback (4.3)** for models without video (all OpenAI, Anthropic and xAI models today): one frame every `max(2 s,
  length/16)`, up to 16 frames at 1024 px (`MediaMetadataRetriever.getScaledFrameAtTime`), with timestamps in the text ("frame at
  0:12"). The audio track goes to speech-to-text (`openai/gpt-4o-mini-transcribe`). The digest (transcript and frame notes) stays on
  the attachment.
- **Heavy content is sent once (3.8).** Later turns send a digest (caption, the model's answer about it, extracted text) and PDF parse
  `annotations`, so a 10-turn chat does not re-upload and re-bill a video. From 4.0 the model can call `reopen_attachment(id)` when
  you refer back ("at 0:40 in the video…").
- **Memory-safe upload.** A streaming, one-shot OkHttp request body pipes the file through `Base64OutputStream`. Today's pattern
  (`readBytes` + `JSONObject.toString`, `data/Analyst.kt:73`) would need over 100 MB of memory for a 20 MB video.
- **Documents in a shared-in chat make it Private** (C1), so a medical PDF is sent only to providers that do not store prompts.

### D4. Progress, cancel, cost preview

- **Chip states:** Copying → Preparing (Transcoding 43%) → Ready → Uploading 62% → Sent. ✕ removes or cancels one item. **■ Stop**
  cancels the whole send (no silent retry of a large upload). Failures keep an outline in the danger colour with "Couldn't read this
  PDF · Retry · Remove". Send stays enabled: if parts are not ready it shows "Send when ready".
- **Long work survives leaving the app.** Transcoding a video takes tens of seconds and a 27 MB upload on mobile data takes longer.
  Preparing, uploading and waiting for the reply run as a **user-initiated data-transfer job** (`JobInfo.Builder.setUserInitiated`,
  Android 14+; a `dataSync` foreground service on Android 12–13) with a progress notification, so locking the phone or switching apps
  does not kill it.
- **No silent re-upload.** Before retrying anything over 5 MB on mobile data, Fieldnote asks: "Retry (27 MB)?". A stream served by
  Google keeps billing after a dropped connection, and the Model sheet says so.
- **Cost hint (3.8)** on the composer's context row whenever something is attached or the model is Smart or Best: "≈ ₹2.40".
  Estimates: about 1,100–1,500 tokens per image, 100 tokens per second of native video, 32 per second of audio, about 700 per PDF
  page, plus the reply cap at the output price, at the effective rate (E7). After sending, the turn shows the actual ₹ from
  `usage.cost`. **Tapping it for a breakdown comes in 4.3.**
- **Confirm above ₹20 per message** (3.8; setting): "About ₹24: 40-page PDF on Best. [Send] [Use Smart (≈ ₹9)]".

### D5. Share sheet: three doors

| Door (share-sheet label) | Accepts | Goes to | Release |
|---|---|---|---|
| **Ask Fieldnote** | `image/*`, `video/*`, `application/pdf`, `text/*` (plus `audio/*` and Office types in 4.3) | Share-in sheet: **New chat** (default for everything; a shared document makes it Private), the glasses' conversation, 4 recent chats. Items land in the composer with the shared text prefilled; nothing sends by itself. **Direct Share** targets for the 4 most recent chats come in 4.3 | 3.8 |
| **Log to Plateful** | `image/*` | Opens **PlatefulActivity**'s Log sheet with the photos → a draft meal (section F) | 4.1 |
| **Add to trip** | `text/plain`, `image/*`, `application/pdf` | Booking import, as today (`AndroidManifest.xml:39-51`) | today |

- New `activity-alias` entries target `MainActivity` (Ask Fieldnote) and `PlatefulActivity` (Log to Plateful); `handle()`
  (`MainActivity.kt:116-126`) switches on `intent.component.className`. Only other apps' `content://` URIs are accepted (as today,
  `ui/AppState.kt:373-375`), and files are copied in at once because grants die on a relaunch from Recents.
- Settings › Privacy can hide the Plateful and Trip doors.

---

## E. Model selection (ask 3)

### E1. The catalogue

- `data/ModelCatalog.kt` fetches `GET https://openrouter.ai/api/v1/models` (public, about 750 KB, 454 entries today) at most every
  24 h, caches it, and bundles a trimmed snapshot for an offline first run. Each entry becomes `ModelInfo`: id, name, created,
  context, max output, input and output modalities, prices (including cache-read and web search), supported parameters, reasoning
  (mandatory, efforts), expiry date, alias target.
- Hidden: `:batch` variants, negative-price routers, expired entries, and **models that do not output text** (11 image-generation
  models today; their images would be dropped, and image generation is out of scope, C1).
- **`RequestProfile` builds parameters from the catalogue, not from the name.** Temperature only if supported; reasoning effort from
  `supported_efforts`, never `none` when reasoning is mandatory; output cap from `max_completion_tokens`, raised well above the
  reasoning budget. This replaces `Llm.reasons()` (`data/Analyst.kt:20-36`), which today treats only `gpt-5*`, `gemini-2.5-pro` and
  o3/o4 as reasoning models.
- The `in models` fallbacks go (`data/Prefs.kt:24-31, 57-60`), so any id can be saved.
- **OpenRouter only for the new model features.** The owner uses OpenRouter (live model ids in telemetry). An OpenAI-direct key keeps
  working with today's fixed lists; the catalogue, the picker, attachments and web search say "Needs an OpenRouter key". No bundled
  OpenAI table is built.

### E2. Where the picker sits, and what it applies to

- **Model chip** at the left of the composer's context row, within thumb reach and visible while typing. It shows the tier
  ("Smart ▾"), or the short model name after a pick from All models ("Grok 4.7 ▾"). It opens the Model sheet. **Long-press swaps
  between your last two models.**
- The conversation's title is not the picker; it stays the chat name.

| Scope | Rule |
|---|---|
| This conversation | Any pick in the sheet sticks to this conversation and applies **from the next reply**. It never changes the default |
| New chats | Only the row **"Make default for new chats"** does that. The row shows the current default ("Default for new chats: Smart"), so you always know which one you are changing |
| One reply | "Retry with…" in the message menu |
| Glasses voice turns | The Glasses voice role (fast), unless the conversation has "Also on glasses" on |
| Look, food, video, transcription, titles | Their own roles (E4); the chat chip never changes them |

Every assistant turn's eyebrow names the model that actually answered (the resolved id when an alias was used) and its ₹ cost:
"GPT-6 SOL · 4.2 s · ₹2.80".

### E3. The Model sheet: tiers first, raw ids one tap away

```
Model for "Japan visa documents"                                   Today ₹48 of ₹200
○ Auto    Quick for short questions, Media for video or audio, Smart for long ones or "think harder"   ≈ ₹0.15–3
○ Quick   GPT-6 Luna          Fast everyday answers              [Sees] [Files] [Tools]                      ≈ ₹0.15 / reply
● Smart   GPT-6 Sol           Stronger reasoning and writing     [Sees] [Files] [Tools] [Thinks]             ≈ ₹3.30 / reply
○ Best    Claude Opus (latest)     Hardest problems, long documents   [Sees] [Files] [Tools] [Thinks]             ≈ ₹6.50 / reply
○ Media   Gemini 3.8 Flash    Watches video, listens to audio    [Sees] [Video] [Audio] [Files] [Tools] [Thinks]  ≈ ₹1.20 / reply
○ Custom  Grok 4.7            (shown only after a pick from All models; selected then)
RECENT    Grok 4.7 · Gemini 3.1 Flash-Lite · Qwen 3.8 Omni Flash               ← last 5 raw picks, one tap each
STARRED   Kimi K3                                                              ← star any model in All models
THINKING  ( Low ) ( Medium ) ( High )          ← only the efforts this model supports; "Off" hidden when reasoning is mandatory
Make default for new chats                                   Default now: Smart ›
[ ] Also on glasses
All models ›                                                            Manage defaults ›
```

- **Tiers for typed chat ride "always latest" aliases**, so they never expire: Quick = `~openai/gpt-luna-latest`, Smart =
  `~openai/gpt-sol-latest`, Best = `~anthropic/claude-opus-latest`, Media = `~google/gemini-flash-latest`. The row shows today's
  resolved model and its id in small mono text (the owner reads ids). The **glasses roles do not follow aliases** (E4).
- **Auto is Fieldnote's own visible rule,** not `openrouter/auto`: video or audio attached → Media; more than 1,500 characters, or
  "think harder" / "step by step" → Smart; otherwise Quick.
- **Badges** come from catalogue fields: Sees (image in), Video, Audio, Files (native PDF), Tools (required for chat and glasses),
  Thinks (reasoning; "always" when mandatory), JSON, 1M (context), **New** (under 14 days old), **Retires 20 Oct** (warning colour),
  **Always latest**. They are text chips with line icons, not emoji.
- **"≈ ₹ per reply"** assumes 8,000 tokens in and 1,500–1,800 out (including reasoning) for typed chat, at the effective rate (E7).
  Cached input in a long chat costs about a tenth, so real replies are often cheaper. **All models** shows "₹191 in / ₹957 out per
  1M" per row.
- **All models:** search; filters Sees · Video · Audio · Files · Tools · Thinks · Free; sort Recommended · Price · Newest · Quality
  (the catalogue's Artificial Analysis index, labelled third-party); a star on each row. Models without Tools are shown but disabled
  for chat ("Can't use Fieldnote's tools"); they stay pickable for "Retry with…".

### E4. Recommended role defaults (Settings › Models › "Who does what")

**Glasses roles are pinned to tested ids, not aliases.** An alias can jump to a new model mid-trip, with different reasoning rules or
worse format-following, and break the "speech, then JSON" Look parser. So the Look, glasses voice and food roles hold a concrete id
chosen by the **3.5 bake-off** (J), and move only when that id nears its `expiration_date` or a newer model passes the same bake-off,
each time with a one-time prompt.

| Role | Default | Why | ≈ ₹ per action [est] |
|---|---|---|---|
| Typed chat | **Smart** · GPT-6 Sol, effort low | ChatGPT-class quality; one generation on from the owner's current brain (`gpt-5.6-sol`). **Owner to confirm (K9)**; the alternative is Media at about a third of the cost | 3.3 per reply (less with cached input) |
| Glasses voice | **The bake-off winner** among `openai/gpt-6-luna` (effort none), `openai/gpt-5.6-luna` and `openai/gpt-5.6-sol` (effort low), on first-audio time and correct tool choice | GPT-6 Luna ($0.10 / $0.50 per 1M) was released 22 Sep and has no latency data yet; try `:nitro` | 0.12 per turn (Luna) |
| Look | **The bake-off winner** among `google/gemini-3.8-flash` (effort low; reasoning is mandatory; $0.75 / $3.75), `google/gemini-3.1-flash-lite` (effort minimal; reasoning optional; $0.25 / $1.50; also takes video and audio) and `openai/gpt-6-luna` (effort none), on reading accuracy on 20 of the owner's photos and first-audio time | Flash-Lite would cut a reading Look from about ₹0.5 to about ₹0.17, about ₹10 less on a travel day, if it reads as well | 3.8 Flash 0.38–0.55 · Flash-Lite 0.12–0.17 · Luna 0.04 |
| Food estimate | **The Look winner**, then an A/B against Luna on 20 logged Indian meals (4.1) | Vision quality over price | 0.12–0.35 per meal |
| Video and audio | **Media** | Native video and audio | 0.8 per 60 s |
| Documents (booking import) | **Media** | Native files; ends the hidden coupling where import uses the Read lens model (`data/TravelAnalyst.kt:94`) | 0.5 |
| Web search | OpenRouter's server tool, 3 results | $0.01 a search on GPT-6 and Claude, $0.014 on Gemini, plus result tokens | ≈ 1–1.5 per search |
| Transcription | `openai/gpt-4o-mini-transcribe` | Cheap speech-to-text | paise per minute |
| Titles, summaries | **Quick** | Cheap | 0.01–0.05 |

**What a day costs with these defaults** (J2's estimates with the corrected search price, including reasoning tokens; Look on
Gemini 3.8 Flash, the dearest candidate). "List" is at ₹95.65 per $; "you pay" adds OpenRouter's 5.5% credit fee and a 4% card
markup (E7):

| Day | Mix | ≈ ₹ list | ≈ ₹ you pay |
|---|---|---|---|
| At home | 6 voice, 8 Looks, 10 typed, 3 meals | 39 | 43 |
| Travel | 20 voice, 30 Looks, 15 typed, 4 meals, 1 video, 1 PDF, 5 searches | 83 | 92 |
| Heavy | 40 voice, 60 Looks, 40 typed, 5 × 3 min video, 3 PDFs, 15 searches | 205 | 225: over the ₹200 cap, so the role budget (E7) moves typed chat to Quick at 80% and keeps ₹30 for the glasses |

Typed chat on Smart is 60–70% of that. With Media as the typed default the same days cost about ₹17 / ₹45 / ₹120 (list). With
Flash-Lite winning the Look bake-off, subtract about ₹3 / ₹10 / ₹20. The Spend screen shows spend by role so the choice is visible.

### E5. Expired, unknown and failing models

- **Now (3.5, installable about 7 Oct):** `google/gemini-2.5-flash`, `-pro` and `-flash-lite` expire on **20 Oct 2026**. Gemini 2.5
  Flash is today's default for every lens and for food (`data/Prefs.kt:132`). 3.5 moves them to **the bake-off winner as a concrete
  id**, migrates saved ids, and **in the same release** fixes the parameters (reasoning effort from the catalogue, output cap ≥
  2,000, temperature only where supported). Without that fix the new models would return empty "ran out of room" answers under
  today's 600–900 token caps (`data/Food.kt:108`, `data/Analyst.kt:95`, `data/Agent.kt:303`). One snackbar: "Looking now uses
  <winner> (Gemini 2.5 retires 20 Oct)."
- **From 3.6:** after each catalogue refresh, a saved role or conversation model within 14 days of its expiry gets a "Retires 20
  Oct" badge and one snackbar with [Switch]. Once expired or gone, a chat model migrates to its tier's alias and a glasses role to its
  bake-off fallback, each with a one-time notice.
- **"Model not found" during a request:** retry once on the role default, answer anyway, and add a notice turn "Gemini 2.5 Flash has
  retired; answered with <model>. Change ›". Telemetry `model_fallback`.
- **Unknown id** (typed by hand): allowed, badge "Custom · capabilities unknown"; attachments go as text.
- **Aliases can change price or behaviour.** The served model shows on every turn; a price change over 2× on refresh posts a notice.

### E6. Your existing choices carry over

- `model.agent` (your brain, `gpt-5.6-sol`) becomes the **typed chat** role, upgraded to the Smart alias only with your OK.
- The glasses voice role becomes the bake-off winner (3.6), with a one-time notice: "Glasses answers now use GPT-6 Luna for speed.
  Your chats stay on Sol. Change ›".
- The 10 `model.<lens>` choices collapse into the Look role; an explicit non-default choice is kept as the Look model.

### E7. Daily budget in rupees

- Spend is stored in **micro-USD** from `usage.cost` (returned on every OpenRouter response). The 1-cent minimum per call goes
  (`data/Analyst.kt:42`; today every call is recorded as at least 1 cent, overstating spend 3–25×). The accumulator becomes atomic,
  since Agent, Queue, Food and TravelAnalyst all write it.
- **Effective ₹ per $.** Every ₹ figure and the cap use one setting (Settings › Key and budget): today's rate × 1.055 (OpenRouter's
  fee on credit purchases) × your card's forex markup (default 4%, editable). That is about ₹105 per $ today, not ₹95.65.
- **Default cap ₹200 a day** (today's $2 ≈ ₹191). Choices ₹50 / 100 / 200 / 500 / custom / none. **Budget by role:**
  - **₹30 is kept back for the glasses** (Looks and voice). Typed chat cannot use it, so a heavy day at the desk never switches off
    the glasses in the evening.
  - **At 80%:** typed chat drops to Quick for the rest of the day (a chip says so and can be overridden per message), web search goes
    to "on request", a snackbar shows, and the glasses say once "Heads up, ₹160 of today's ₹200 used", on every path (today only the
    double-tap path warns, `service/FieldService.kt:354`).
  - **At 100%:** model calls stop with a banner "Today's ₹200 is used · Raise by ₹100 for today" (resets at local midnight). The
    glasses say "Today's budget is used. Say 'raise the budget' or use your phone." Local commands, on-device reading and the food
    diary keep working.
- **The real limit is your OpenRouter credit.** When the account or key runs out, every call fails with **HTTP 402**. Fieldnote treats
  that as its own state (C10): a danger banner "OpenRouter credit is used up · Top up ›" (opens openrouter.ai/credits), one spoken
  line on the glasses, queue draining paused, local commands working.
- **Key check (3.6, at app open and on Test).** `GET /api/v1/key` returns the key's own `limit_remaining`, which is **null when the key
  has no limit**; the account balance needs a management key, which Fieldnote never asks for. So Settings shows "Key works" and, only
  when the key has a limit, "Key limit left ≈ ₹1,186 ($11.30)" (₹ first). With no limit it suggests: "Set a credit limit on this key
  at openrouter.ai so Fieldnote can warn you before it runs out." When `limit_remaining` falls under ₹300, a warning shows at app
  open, and the glasses say it once at Start.
- **Reconciliation.** `spend_reconciled` compares the app's spend with the key's `usage_daily` over the **same UTC day** (05:30 to
  05:30 IST), because OpenRouter's daily figure is a UTC day.
- **Spend screen** (drawer footer, Settings): today's bar; spend by role (Chat, Glasses, Looks, Food, Video, Web, Titles) with the
  glasses reserve; a 30-day chart; the cap. Each conversation shows its total in Conversation info.

---

## F. Plateful (ask 4)

### F1. Decision: how "the Food tab takes me to Plateful"

Nothing called Plateful exists to link to. There is no APK, repo or package; 3.0 folded a thin version into a one-screen Food tab
(`ui/FoodScreen.kt:42`, `data/Food.kt:18`). So "take me to the Plateful app" means **building Plateful**.

**Recommendation: Plateful is its own app window inside the Fieldnote APK, with its own name, glyph, launcher icon and task.** It lives
in its own package (`plateful/`) behind a small interface. It is not a separate APK.

| Option | For | Against |
|---|---|---|
| **Own window in the same APK (recommended)** | One key, one Meta glasses registration, one store. Glasses logging, the Meta AI album, the conversation and the brain all work with no cross-app plumbing. From its icon it looks and behaves like a separate app. The package boundary keeps a later split to about 5 days | Cannot go on the Play Store alone without that split |
| Separate APK with a deep link | Matches the original spec's Play Store product | A second key, a second glasses registration (or no glasses logging), cross-app data sharing, two apps to keep in step, for one user |
| A launcher alias of `MainActivity` (the first draft) | Cheap | It is still Fieldnote: Fieldnote's tabs and pill show, Back goes to Chat (every tab pops to "chat", `MainActivity.kt:167`), and because `MainActivity` is `singleTask` and an alias cannot set its own task affinity, Recents shows one "Fieldnote". That is only an icon, not "take me to Plateful" |

**How it feels like its own app (3.7):**
- **`PlatefulActivity`**, a thin activity with its own label, icon (plate glyph on a warm background) and `taskAffinity`, hosting the
  `plateful/` screens. Its bottom nav is **Today · Review · Trends** (Review appears in 4.1), with **no Fieldnote tabs**. **Back
  exits**, and Recents shows "Plateful" as its own entry. ⋮ has **Open Fieldnote**. Its own `Scaffold` and snackbar host, so it does
  not wait for Fieldnote's shell work (4.2).
- The **Plateful** launcher icon, the app shortcuts (**Log a meal**, **Review today**, **Usual breakfast**), the **"Log to Plateful"**
  share door (D5) and the evening notification all open `PlatefulActivity`. Hideable in Settings.
- **Inside Fieldnote**, the Food tab becomes **Plateful** and embeds the same screens (the same composables, not a copy), with the
  Plateful wordmark (Bricolage, plate glyph) in its top bar and a segmented **Today · Review · Trends**.
- **The gear** on Plateful opens **Settings › Plateful** (goals, targets, units, review time, pickup). In `PlatefulActivity` that page
  opens in place. The gear always means "settings for this screen" across the app; ⋮ holds this screen's actions (B1).
- **Look:** Fieldnote's dark tokens. Kcal uses the accent orange; protein gets its own blue token (I2), because teal means "from the
  glasses". The earlier light "paper" canvas is not used; a light theme for the whole app is in the backlog (K15).
- **Busy state is Plateful's own,** not `chat.busy` (fixes the Chat freeze during meal edits, `ui/AppState.kt:181, 193`).
- **Shared underneath:** the data, the key and the glasses registration stay in one process, so K3's benefits hold.

### F2. Logging paths

Every path writes to the same meals table and shows on Today within 2 s. **Nothing counts in your totals until you said yes, tapped,
or logged it yourself** (principle 6).

| # | Path | Flow | State after | Release |
|---|---|---|---|---|
| 1 | **Glasses double-tap on a plate** | Look detects food → pips, then "Dal, two rotis and bhindi. About 520 to 680 calories." The proposal "Log it as lunch?" is built from the parsed JSON (G8), then NEEDS A YES and the follow-up window → "yes" / "log it" → logged (SAVED) and read back; "no" → dropped. **Silence → no draft.** The Look turn keeps a **[Log meal]** chip, and the photo waits in Review under **"Might be a meal?"**, outside the totals and never kept by itself, because you may only have been looking (a stall, a friend's plate) | Nothing until yes | 3.9 |
| 1a | **3.5 stopgap from the glasses** | Triple-tap **"log it" / "log this" / "log this meal"** within 10 min of any capture → `FoodAnalyst` on that photo directly (1 call, no brain) → "Logged lunch: dal, two rotis, bhindi. About 520 to 680. Say undo." **"undo"** within 10 min reverses it. If you set the double-tap lens to **Food** yourself, that setting is the yes: each Food Look logs the meal and says "Say undo." | Logged, with undo | 3.5 |
| 2 | **Glasses voice** | Triple-tap: "log lunch: two rotis, dal and salad", "I ate poha for breakfast at 8", "do roti ek katori dal", "log my usual breakfast". The local router (G5 row 11) logs a meal **only when the rest parses as food** (dish words, or a count and a unit); "log ₹400 for the taxi" is a spend; anything else asks "Meal or spend?". "I had" counts only when a food or quantity follows ("I had booked a room" never logs). Times ("at 5", "for breakfast", "this morning") and Hinglish numbers (ek, do, teen, char, paanch, aadha, dedh) are parsed, with speech-recognition aliases ("egg katori" → "ek katori" before a unit word, "punch" → "paanch"). **The items are always read back**, so a mishearing is caught: "Logged lunch: one katori dal, two rotis. About 450 to 550. 1,240 today. Say undo." The photo is used if a Look or tap photo is under 10 min old | Logged (your words are the yes); undo for 10 min | 4.0 router, 4.1 |
| 3 | Voice corrections | "Actually three rotis", "make that two" within 15 min → edits that meal (count changes are local, no model). "Delete that meal", "undo" → "Deleted lunch. Say 'undo' to bring it back." **No duplicates** (fixes `data/Agent.kt:143-148`) | Edited | 4.1 |
| 4 | **Meta shutter photos (passive)** | A `JobScheduler` content trigger on MediaStore (`TriggerContentUri`, works with the app closed), plus scans at app open, at glasses stop and before the evening review. New Meta AI album images → on-device ML Kit image labelling and face detection. **A draft is estimated (≈ ₹0.15–0.35) only when all of these hold:** food score ≥ 0.85; inside a mealtime window (7–10, 12–15, 16:30–18, 19–23 local, or your usual times once learned); at most 2 such photos within 30 min (grouped into one meal); no face in the frame; **not on a trip**. Everything else that scores ≥ 0.4 goes to **"Might be food?"** in Review with **nothing uploaded** until you tap Food: a market walk, a shared table, a trip. Below 0.4 → ignored | Draft (hatched, not counted) | 4.1 |
| 5 | Phone camera | + Log › Camera (`TakePicture`, no permission) → estimate → Meal detail opens for a quick check | Logged on "Looks right" | 3.7 |
| 6 | Gallery | + Log › Photos (system picker, any phone photo; up to 4 photos = one meal); the time comes from the photo | Logged | 3.5 (basic) / 3.7 |
| 7 | Describe | + Log › Describe: text or dictation, "2 idli, sambar, coconut chutney at 8"; time chips (Now · 8:00 Breakfast · 13:00 Lunch · 17:00 Snack · 20:30 Dinner · Pick). Dish memory fills known dishes locally; the rest goes to the model | Logged | 3.5 (basic) / 3.7 |
| 8 | **Usuals and repeat** | A chip in each empty meal slot on Today ("Usual breakfast: poha · 330") logs with **one tap**, no model. + Log shows recent and starred meals. Voice: "same breakfast as yesterday" (4.1) | Logged, with Undo snackbar | 3.7 |
| 9 | Nutrition label photo | + Log › Label: reads per-100 g values, asks the amount eaten | Logged | 4.1 |
| 10 | Share door | "Log to Plateful" from any app → `PlatefulActivity`'s Log sheet with the photos | Draft → review | 4.1 |
| 11 | Chat | "Log: two rotis, dal" (the brain's `log_meal`, which gains `time`, `favourite`, and siblings `edit_meal`, `delete_meal`, `undo_last_meal`) | Logged, action row with Undo | 4.1 |
| 12 | Barcode | ML Kit barcode + Open Food Facts (India coverage is patchy; the label photo covers packaged food first) | Logged | backlog |

- **"Import now"** on Today's sync line opens the Meta AI app (`com.facebook.stella`). No manifest change is needed: the glasses SDK
  already merges the `<queries>` entry (J2 checked the merged manifest; critic G7 was wrong).
- **Partial photo access.** On Android 14+ the photos dialog offers "Select photos". Fieldnote declares
  `READ_MEDIA_VISUAL_USER_SELECTED` (4.1) and detects partial access (that permission granted, `READ_MEDIA_IMAGES` not). Then the
  pickup job, the Photos tab and the Attach sheet's glasses strip would see nothing new, so Today's sync line, the Glasses sheet and
  Settings › Privacy say "Plateful can only see photos you picked · Allow all photos". `album_scan` records `access=partial`.
- **Drafts are never kept by themselves.** They show on Today with a dashed outline and a "Draft" pill, hatched in the kcal bar and
  not counted in the total ("+ ~520 in drafts"). After 48 h an unconfirmed draft leaves Today's bar and is listed in Review as **"Not
  logged · Tuesday (2) ›"**, where it can still be confirmed for 7 days before it is dismissed. So an ignored review never *adds*
  food you did not eat, and never silently loses a meal either.
- **Offline:** a meal is always saved. "Waiting for network · will estimate automatically" (today meals are lost offline,
  `data/Food.kt:112`).

### F3. Meal model v2 (`plateful/`)

- `Meal` gains: `type` (breakfast, lunch, snack, dinner, drink; set from the time and editable), `source` (glasses_look, glasses_voice,
  album, camera, gallery, describe, usual, label, share, chat, glasses_log_it), `status` (draft, logged, maybe, not_logged, not_food;
  only `logged` counts in totals), `photoKeys[]`, `favourite`,
  `editedByUser`, `tripId`, `place`, `eatingOut`, `tz`, optional `carbs`, `fat`, `fibre` (always stored, shown by setting), and
  `turnId` (link to the conversation).
- `FoodItem` gains `unit` (roti, katori, piece, cup, glass, plate, bowl, ladle, tbsp, tsp, g, ml), `count`, and **per-unit** kcal
  (min, max) and protein. Steppers recompute on the phone with **no model call, offline**.
- **Migration of `meals.json`:** today `FoodItem.quantity` is free text ("2 pieces", "1 katori") and kcal are item totals
  (`data/Food.kt:20`). Parse count and unit; fall back to "1 × serving"; keep the original string; derive per-unit values.
- `put` de-duplicates by photo as well as by id (fixes double meals from a double-tapped chip, `data/Food.kt:71`).
- The estimator receives diet and allergies, not only `aboutMe` (fixes `data/Food.kt:102`), and returns per-unit values, a fat level,
  and `question_options` for the one question.
- A small `dish` table powers dish memory and Usuals: name, unit, per-unit values, count, last eaten, starred.

### F4. Meal detail: review and correction

```
‹ Plateful                                                     ☆   ⋮
[ photo strip 240 dp · 1/2 ]
Dal, two rotis, bhindi                                   (tap to edit)
[ Lunch ▾ ]  [ Today 1:15 pm ▾ ]  [ Home | Eating out ]
From your glasses · Lajpat Nagar            "you said: cooked in ghee"
ITEMS
  Roti (phulka, medium)   [−]  2  [+] piece     170–200 kcal · 6 g
  Dal tadka               [−]  1  [+] katori    160–210 kcal · 9 g
  Bhindi sabzi            [−]  1  [+] katori    110–160 kcal · 3 g
  Cooking fat             ( None | Light | Normal | Rich )   +45–90 kcal
  + Add item
TOTAL  520–680 kcal · Protein 18–22 g · medium confidence (oil is a guess)
ONE QUESTION  How much ghee on the rotis?   [None] [A little] [1 tsp each]
[            Looks right            ]          ← primary, 52 dp
[ Fix by voice ]   [ Not food ]                ← 48 dp outline
Open in conversation ›
```

- **Steppers** change counts; totals update instantly and offline. **Tap an item** for a sheet: name, unit picker, quantity, editable
  per-unit kcal and protein, "Save to my dishes".
- **Cooking fat is its own line** with four levels, because hidden oil and ghee are the largest error in home food (the spec cites
  about a third of calories underestimated).
- **Question chips** adjust the uncertain item locally when the answer maps to a count or a level.
- **Fix by voice / text:** a short note re-estimates only the named items; your manual edits are kept as constraints (needs network).
- **Title, time, type and home/eating out** are editable inline. Swipe an item left to remove it (Undo).
- **⋮ menu:** Not food · Split meal · Merge with… · Duplicate to today · Favourite · Delete. Delete shows an 8 s Undo snackbar
  (today it deletes at once, `ui/FoodScreen.kt:143`).

### F5. Plateful · Today

```
[plate] Plateful          ‹  Today · Thu 8 Oct  ›          [pill] [gear → Settings › Plateful]
1,260 kcal                                      of 2,000     (range 1,080–1,440 · about 740 left)
[████████████████████▒▒▒▒░░░░░░░░]   hatched = +275 kcal in drafts
Protein  36 of 90 g  [████████░░░░░░░░░░░░]   protein blue, not teal
┌ 2 to review · 1 draft, 1 might be food                         [Review] ┐   warning tint
BREAKFAST  8:40   Poha with peanuts, curd     380–440   ✓   usual           (✓ in text-2)
LUNCH      1:15   Dal tadka, 2 rotis, bhindi  580–740   ✓   glasses icon (teal: it came from the glasses)
SNACK      5:10   Chai + Marie biscuits       120–260   ● How many biscuits?  [1] [2] [3] [4+]
┆ 6:30    Samosa, 1 piece   Draft · from shutter photo   250–300   [Confirm] ┆   dashed
DINNER     —      [ Usual: rajma chawal · 540 ]   [ Log dinner ]
Last import from your glasses 6:32 pm · Import now
                                                           ( + Log )
```

- 3.7 ships Today in both places: `PlatefulActivity` (nav Today · Trends until Review arrives in 4.1) and Fieldnote's Plateful tab.
- Swipe or ‹ › changes the day; the date opens a month calendar with dots on logged days. "Today" recomputes at midnight (today a
  screen left open overnight sticks, food.md §3c). The list is lazy and paged by day (`ui/FoodScreen.kt:53, 91`).
- Macros row (carbs, fat, fibre) appears when the macros setting is on.
- **Empty:** "Nothing logged today. Double-tap your plate, or tap + Log." with [+ Log] and [How it works].
- **Offline estimate:** row reads "Waiting for network · will estimate automatically". **Failed:** "Couldn't estimate · Retry".

### F6. Review, trends, goals

- **Review** (4.1; a segment of the Plateful shell, not a pushed screen; opened from the banner or the evening notification): one
  card at a time for drafts and low-confidence meals: photo, "Shutter · 6:30 pm · Khan Market", the estimate with compact steppers,
  question chips, **[Looks right] [Adjust] [Not food]**, and a progress line "1 of 2". Below:
  - **Might be a meal?** food Looks you did not log (the photo, what the glasses said, [Log meal] [Not mine]). Never in the totals.
  - **Might be food?** a grid of uncertain shutter photos with **Food** / **Not food** (nothing uploaded until Food).
  - **Not logged · Tuesday (2) ›** drafts older than 48 h, still confirmable for 7 days.
  - **Anything missing?** empty meal slots with Usuals chips.
  It ends with "Day closed. 1,850 kcal · 74 g protein." A row "12 photos set aside as not food · they never left your phone ›" is
  reversible.
- **Trends:** Week · Month · 3 months. Kcal bars (midpoints) with values on tap, a target line and an average line; tap a bar to open
  that day. Protein line against target. Tiles: average kcal (range), average protein, days logged ("12 of 14"), protein-hit days.
  Meal timing strip (first and last meal, late dinners). Top 10 dishes with counts. Eating out vs home. Weekday vs weekend. Works
  offline.
- **Goals and targets** (moved out of Glasses › Answers, `ui/GlassesScreen.kt:159-165`): a wizard (sex, age, height, weight, activity,
  goal: maintain / lose 0.25 or 0.5 kg a week / gain) → Mifflin-St Jeor with an activity factor → a suggested kcal target, shown with
  the formula and labelled "a starting point, not medical advice"; protein 1.2 g/kg by default (0.8–2.0). Manual entry validated to
  800–6,000 kcal and 20–300 g (matching the brain's clamps, `data/Agent.kt:175-176`). Fields save on Done, not per keystroke.
  Macros toggle (K4). Diet and allergies are **shared with the traveller profile** (one "You" profile).

### F7. Reminders and the evening review

- **Evening notification at 21:30** (4.1; setting; follows the trip time zone): "Thursday: about 1,850 kcal · 74 g protein · 2 to
  check" with **[Review]** and **[All good]**. **All good confirms the hatched drafts only**, never "Might be a meal?" or "Might be
  food?" items, and it says what it adds: the button reads **"Confirm 2 drafts, +550 kcal"**. It needs the phone unlocked
  (`setAuthenticationRequired(true)`, Android 12+), so it cannot be tapped from a locked screen by accident. Nothing is posted on a
  day with no meals and no drafts.
- **When you stop the glasses after 7 pm** (setting, on): "Today: about eighteen fifty calories and seventy-four grams of protein. Two
  meals to check on your phone."
- **Missed-meal nudge** ("Photos from 13:10 look like food. Review?") is **off** by default.
- No streaks, no guilt copy.

### F8. Indian food specifics

- **Household units with sizes:** katori 150 ml; roti S/M/L (about 20/30/40 g atta), phulka vs paratha (plain or stuffed); ladle
  (karchi) 60 ml; glass 250 ml; chai cup 150 ml with a sugar-teaspoon stepper; tsp ghee 5 g (about 45 kcal); plate of rice about
  150 g cooked; pieces for idli, dosa, vada, samosa, laddoo, momos; a plate for biryani and chole bhature.
- **Thali decomposition:** one photo becomes several items (dal, sabzi, rice, roti, raita, pickle, papad, sweet), never one blob.
- **Names and synonyms:** dal tadka / dal fry, sabzi / sabji, rajma chawal, chole, poha, upma, kadhi, regional names; the item keeps
  your word.
- **Diet flags** from the profile: vegetarian, eggetarian, Jain (no onion, garlic or root vegetables), fasting (vrat) foods such as
  sabudana and kuttu.
- **Eating out** (set from the place tag, a restaurant spend nearby, or an active trip): the fat level starts one step higher, and the
  meal says so.
- **Seed dish table:** about 150 common dishes and ingredients with per-unit ranges derived from published IFCT 2017 values, used to
  anchor the model's numbers (tagged "IFCT" on the item). **Check the data licence first**; without it, the model estimate plus
  steppers remains the fallback (backlog).
- **Dish memory:** after 3 identical confirmations, future estimates of that dish reuse your portions.
- **Hinglish** counts and times in voice and Describe (F2 #2).

### F9. Travel and eating out

- Meals on a trip carry `tripId`, place and time zone. They appear in the trip-day conversation, in Trip · Today's journal and in
  Plateful. Day boundaries use the meal's local zone.
- **Menu → order → log:** after a menu Look, "I'll have the tonkotsu ramen" or "log the ramen" builds the meal from that menu item and
  offers "Also log ¥980 (≈ ₹559) as a spend?" as a proposal.
- **Linking:** a restaurant spend within 90 min of a meal at the same place links both ways ("Dinner at Kazehana · ¥980 · 820 kcal").
- **Unfamiliar dishes** are estimated with "low confidence, unfamiliar dish" and a question chip.
- **Dish diary:** "What was that noodle dish in Kyoto?" works through `search_conversations` plus meals.

### F10. Data

- **Export:** CSV (`meals.csv`: date, time, type, title, kcal min/max/mid, protein, carbs, fat, source, status, place, eating out;
  `items.csv`) and full JSON, through the share sheet.
- **Delete all food data** with a typed confirmation ("delete").
- **Health Connect** `NutritionRecord` per logged meal (midpoints): should, backlog.
- **Privacy line** in Plateful settings: "Only photos detected as food, at a mealtime and without faces, leave your phone, and only
  when estimated. 12 photos were set aside as not food; they never left your phone."

### F11. Plateful screen list

`PlatefulActivity` (its own window and task) hosting: Today (3.7) · Review (4.1) · Trends (4.1; the 3.4 week bars until then) · Meal
detail (3.7) · Item sheet (3.7) · Log sheet (Usuals, Camera, Photos, Describe in 3.7; Label in 4.1) · Calendar sheet (3.7) ·
Settings › Plateful (targets in 3.7; the goal wizard, macros, units, evening review time, album pickup and consent, export, delete all
in 4.1) · Plateful onboarding (4.1; 3 steps on first open: targets with the suggestion; "Your glasses photos" with a consent toggle for
passive pickup; evening review time) · evening notification (4.1). The same screens are embedded in Fieldnote's Plateful tab.

### F12. What ships in the 3.5 stopgap (so Food is usable within two weeks)

- **+ Add meal** on the Food tab: Describe (text with time chips; the time is passed to the estimate, fixing "now" stamping,
  `data/Food.kt:125`) or pick **any phone photo** (system picker).
- **Remove** asks first and offers Undo.
- Targets move into the Food tab.
- Manual edit of the title and time; a single "portions ×0.5 / ×1 / ×1.5 / ×2" control that scales the estimate locally.
- **From the glasses:** "log it" / "log this meal" and "undo" as local phrases, and the Food double-tap lens logs with "Say undo"
  (F2 #1a). Until 3.5 the double-tap Food lens speaks calories and logs nothing (`data/Models.kt:17`), and logging from the glasses
  costs a triple-tap, the brain and two model calls (`data/Agent.kt:137-155`).

---

## G. Travel lenses → one Look (ask 5)

### G1. What was wrong

- Nine flat lenses, and you pick one **before** the photo. Double-tap runs one global lens (default Scene, `data/Prefs.kt:48-50`).
  Any other lens needs a triple-tap and three model calls (brain → lens → brain, `data/Agent.kt:130-136`).
- Overlaps: Read ⊂ Translate; Menu vs Price; Price vs Receipt (Receipt **writes the ledger**, so a mistaken lens logs a false spend);
  Scene vs Heritage; the Food lens vs meal logging (the lens never logs).
- Six lenses force the full photo. No phrase maps to a lens locally (3.0 moved them to the brain). Offline, Price and Board do nothing
  useful.
- The Detail screen's lens chips do not send (`ui/DetailScreen.kt:82, 113, 119, 165`).

### G2. What survives, merges and goes

| 3.4 lens / idea | Fate | Look kind |
|---|---|---|
| Scene, Heritage | Merge | **scene** (names the landmark when it can; "tell me more" goes deeper) |
| Read text, Translate | Merge | **text**: says what it is and the language, then the meaning; English is read as written; "read it exactly" gives verbatim. Original script shown on the phone |
| "Ask the sign" (owner's travel ideas, tier 1) | New, inside text | **text + your question**: "can I park here now?" → answers and quotes the sign, using local time |
| Menu | Survives | **menu**: dishes in plain words, diet and allergy flags from your profile, 2–3 picks, prices in ₹ |
| Price + "Money check" (tier 1) | Merge | **price**: tags and bills with tax or service notes; "count this" counts notes and coins to a total in local currency and ₹ |
| Receipt | Survives, **never writes by itself** | **receipt** → proposal "Log ¥2,400 (≈ ₹1,368)?" |
| Flight board | Survives | **board**: finds your flight or train from the trip legs; platforms too |
| Food | Merge into Plateful | **food** → meal proposal; nothing is logged or drafted without a yes (F2 #1) |
| Wi-Fi card (tier 2) | New | **wifi** → phone notification "Join *Hotel_Guest*" (system add-network panel, API 30+) + Copy password |
| Business card | Could (backlog) | **card** → "Save contact?" proposal |
| Label / medicine | Should (backlog) | **label**: ingredients, allergens, dosage; always "ask a pharmacist" |
| Live conversation translation, live video | **Handed to Meta AI** (the owner's stated preference; **confirm, K2**) | "live translate" → hand-off pause (G8) |
| 10 per-lens model pickers, the double-tap lens setting, the 11-chip row | **Dropped** | One Look model role (E4) and a pinned intent by voice |
| Train watch, card-to-CRM (tier 2 ideas) | Later, not a Look | Need data APIs, not the camera |

The phone labels a text Look by what it is ("SIGN · JAPANESE", "NOTICE · KOREAN", "TICKET · ENGLISH"), so the kind list stays short
while the labels stay specific.

### G3. How one Look works (double-tap)

1. **Pips** within 150 ms (you know it heard a double-tap).
2. **Open and frame.** If the call mic is open (a follow-up window), it is closed first and normal audio restored, because a camera
   stream with the call mic open drops to about 1 fps and the audio route must be set before a stream starts. Then session + camera
   + stream, then one frame. Measured setup is **5.0 s p50** on 3.2 (it was 2.1 s on 2.2). A separate, time-boxed 1-day spike after
   3.5 looks for that regression; "not found" is an acceptable result. The 3.5 device gate also tests the 720×1280 frame against
   today's 504×896 on signs, cash and Wi-Fi cards.
3. **On-device text check** (< 0.5 s) with ML Kit, already bundled (`data/OnDevice.kt:77`), using the trip language's script.
4. **Escalate?** A new `Glasses.captureProgressive()` holds the session open up to 1.5 s while the check decides. Escalate to the
   full photo when there are more than 6 text lines, glyphs under about 14 px high, a price or time pattern, or a flight or train
   number from your trip. In travel mode (a trip abroad) the bar drops to 3 lines. When escalating, Fieldnote **says "Reading, hold
   still"** at once, then shoots on the still-open session. Today `captureFrame()` tears the session down right after the frame
   (`service/Glasses.kt:167, 178-182`), so without this change escalation would mean a second cold open (about 17 s in total).
5. **One Look call.** Speech first, then a JSON block, so the first sentence streams to your ear before the JSON finishes:
   ```
   SPEECH: Menu, Japanese. Tonkotsu ramen {{980}} is the house special; the gyoza has pork…
   ---
   {"kind":"menu","language":"ja","confidence":0.86,"needs_sharper":false,
    "prices":[{"label":"Tonkotsu ramen","amount":980,"currency":"JPY"}],
    "board":null,"receipt":null,"meal":null,"wifi":null,"followups":["Anything veg?","In rupees?"]}
   ```
   `{{amount}}` tokens are converted to "980 yen, about ₹559" on the phone (`Money.annotate`, `data/Money.kt:117-126`).
   **The SPEECH part never carries a proposal or an amount to confirm.** After the JSON arrives and validates, the app builds the
   proposal line from the JSON fields itself ("Receipt, Marufuku Mart, 2,400 yen, about ₹1,368. Log it?"), then plays NEEDS A YES and
   opens the window. So what you agree to is exactly what gets written, and the written row records the amount that was spoken. If
   the JSON is cut off or malformed, there is no proposal: "Couldn't read the total. The receipt is on your phone."
6. **Kind first** ("Menu, Japanese.", "Receipt.", "Your flight.") so a wrong guess is obvious in a second, and you can say "no, just
   translate".
7. If `needs_sharper` is true and only a frame was used, Fieldnote says "Taking a sharper photo" and repeats once with the full photo.

**Silence budget.** About 1 in 5 captures has failed historically (7 `capture_fail` vs 30 `capture_ok`), most after 7.6–15.4 s. So:
"Hold still" when a full photo starts; WORKING ticks every 2 s; "Still trying" at 8 s; capture plus one retry capped at 20 s, then a
plain reason ("The glasses camera didn't respond. Try again."). One tap cancels at any point, **and if that tap pauses the camera
stream instead of arriving as a key, the pause counts as the cancel** (C6); the notification's Stop always works.

**Targets on measured numbers** (first audio, p50, from the double-tap). They assume the Look model answers in about 1.4–3.3 s, as
Gemini 2.5 Flash did; **the 3.5 bake-off measures the new candidates and these targets are restated for the winner** before 3.9 is
built:

| Path | Today's numbers | Target | Stretch (if setup returns to about 2.5 s) |
|---|---|---|---|
| Frame is enough (scene, food, big sign) | setup 5.0 s + frame + model 1.4–3.3 s | ≤ 8 s | ≤ 6 s |
| Escalated to full photo (menu, small print) | + shot 7.25 s p50 (5.9–16.1) | ≤ 16 s, with "Reading, hold still" ≤ 1 s after the frame | ≤ 13 s |
| Kind known from your words (full photo direct) | setup + shot + model | ≤ 15 s, "Hold still" at the start | ≤ 12 s |
| Follow-up about the last Look ("is it veg?") | no capture | ≤ 4 s after you stop speaking | — |

**Warm camera stays off.** `service/Glasses.kt:44-50` notes that a tap during a live session may pause it instead of reaching
Fieldnote, which would break "one tap stops". No warm mode by default, travel included. The same risk makes `captureProgressive()`
slightly longer-lived than today's capture, which is why a pause during a capture is treated as a cancel.

### G4. Auto versus explicit

- **Double-tap is Look (auto).** No choice before capture. Settings › Glasses › "Double-tap does": Look (auto) (default) / Scene only /
  a fixed kind for a day of use.
- **Your words choose the kind** through the local router, with no brain round trip, and they also choose the capture quality up front
  (G6). Anything unmatched goes to the brain with the conversation.
- **Pinned intent:** "menu mode" / "keep reading menus" makes double-taps use menu for 30 min; it is spoken on every Look ("Menu
  mode: …") so it is never hidden; "back to auto" ends it.
- **Override after the fact:** in the follow-up window (or a triple-tap), "no, just translate" or "that's a receipt" re-runs on **the
  same photo** with that kind, with no new capture.
- **"How much" / "in rupees"** within 2 min of a Look that had prices converts from that Look: no photo, no model call.
- **"Think harder" / "look closer"** (the travel plan's own model-router rule: "a stronger model only when you say 'think harder'").
  "Think harder" re-runs the last spoken answer or Look on Smart with the write tools off; after a Look it uses the full photo if one
  was taken, otherwise it takes one. "Look closer" takes a fresh full photo of the same kind. Both say "Thinking harder…" or "Hold
  still", and the phone shows the new answer as a retry version of the same turn ("‹ 2/2 ›").
- **Phone:** Quick looks on Trip · Today and the Glasses sheet; "Look as" chips on Photo detail.

### G5. Gesture and voice map

**Gestures**

| Input | Ready | Busy (capturing, listening, thinking, speaking) | Capture | Model calls |
|---|---|---|---|---|
| Tap | Photo, saved to today's thread | **Stop / cancel** (during a capture, a paused stream also counts as cancel) | Full | 0 |
| Double-tap | **Look (auto)** | Stop, then Look (during a capture: cancel only, until Test A2 shows keys arrive during a live stream) | Frame; full if the text check escalates | 1 |
| Triple-tap | Ask: listen up to 8 s, glasses mic only | Stop, then Ask (same capture caveat) | — | depends on the words |
| Follow-up window | Speak without tapping (after questions, proposals, "More?", reading Looks) | — | — | depends |
| Swipe · tap-and-hold · shutter | Volume · Meta AI · Meta's own photo (→ Photos; a clear meal at a mealtime → Plateful draft) | — | — | — |
| Notification | Compact: **Look · Ask · End**; while speaking: **Stop · Ask · End**; while paused: **Resume** | | | |

**Phrases** (after a triple-tap or in the window). Commands are anchored at the start of what you say. When two could match, **the
earlier row wins**, so the order below is part of the design. Anything unmatched goes to the brain.

| # | Say | Does | Capture | Calls | Offline |
|---|---|---|---|---|---|
| 1 | "stop", "quiet", "cancel" · "more", "go on" · "repeat", "say that again" | stop · next chunk · replay | — | 0 | Works |
| 2 | "no, (just) translate", "no, read it", "that's a receipt", "it's a menu" | **re-run the last Look on the same photo** as that kind (G4); it must sit above row 3, or "no" would swallow it | — | 1 | On-device kinds only |
| 3 | **the whole utterance** is "yes", "yeah", "no", "nope", "log it", "add it" | answer the open proposal. With no proposal open, "log it" logs the latest capture under 10 min old as a meal if the Look said food, as a spend if it said receipt, else asks "Log it as a meal or a spend?" | — | 0 | Works |
| 4 | "undo", "delete that" | undo the last write (10 min) | — | 0 | Works |
| 5 | "which chat", "new chat [about X]", "back to X", "stay here", "call this X", "move that to X", "move all that to X", "list chats", "where were we", "show me on the phone" | conversation commands (C7) | — | 0 | Works |
| 6 | "pause taps", "music mode", "taps back" · "I'm driving", "I'm cycling" · "glasses off" | pause 30 min / resume · audio-only mode · end | — | 0 | Works |
| 7 | "live translate", "translate the conversation", "hand over to Meta" | hand-off pause (G8) | — | 0 | Works |
| 8 | "how am I doing today", "calories today", "how much protein" | local food totals | — | 0 | Works |
| 9 | "what did I spend today", "convert 2400 yen" · "raise the budget" | local ledger sum · local conversion at the cached rate · "Raise today's budget by ₹100? Say yes." | — | 0 | Works |
| 10 | "log this receipt", "log this expense", "add to expenses", "log ₹400 for the taxi" | **spend rows come before any meal row.** With a photo: Look · receipt, and the proposal line is read back from the JSON; your words are the yes. With an amount in the words: a spend with no photo | Full | 1 / 0 | On-device total → draft "check later" |
| 11 | "log …", "I ate / drank …", "I had" + a food or a quantity (Hinglish numbers and times) | log a meal **only when the rest parses as food** (dish words, or a count and a unit); otherwise "Meal or spend?". Items are always read back (F2 #2) | Frame if no photo < 10 min | 1 | Saved; estimated later |
| 12 | "think harder" · "look closer" | re-run the last answer or Look on Smart, write tools off · same kind, fresh full photo (G4) | — / Full | 1 | Queued |
| 13 | "how much is this", "in rupees", "price" | uses a Look < 2 min old with prices; else Look · price | none / full | 0 / 1 | Text check + number regex + cached rate |
| 14 | "count this", "how much cash is this" | Look · price (cash count) | Full | 1 | Queued |
| 15 | "read this", "read it exactly", "what does it say" | Look · text (verbatim / meaning) | Full | 1 | On-device read + translate |
| 16 | "translate this", "what does this sign say" | Look · text, meaning first | Full | 1 | On-device read + translate |
| 17 | "can I park here", "is this allowed", "what does the sign say about …" | Look · text + your question | Full | 1 | Read + translate, no answer to the question |
| 18 | "read the menu", "what should I order", "anything veg" | Look · menu | Full | 1 | Read + translate + ₹ + allergen keyword scan |
| 19 | "find my flight", "which gate", "which platform", "is this my train" | Look · board | Full | 1 | Read + trip-leg regex → your row (hedged, G7) |
| 20 | "wifi", "join this wifi" | Look · wifi | Full | 1 | Read → SSID and password guess |
| 21 | "what's this", "what am I looking at", "what building is this" | Look · scene | Frame | 1 | Queued |
| 22 | "look again", "take a new photo" | same kind, fresh full photo | Full | 1 | as that kind |
| 23 | "menu mode", "back to auto" | pinned intent 30 min | — | 0 | Works |
| 24 | "note …", "remember this", "remember where I parked", "remember locker 42", "take me home", "where am I", "driver card", "allergy card", "emergency" | instant travel commands (`service/TravelSession.kt:73-99`) | Frame for "remember this" | 0 | Works |
| 25 | "remember that I …", "remember I'm …", "remember my" + a fact about you | a proposal to update your profile ("Save to your profile: allergic to peanuts?"), never a place note (from 3.5, C7) | — | 1 | Queued |
| 26 | anything else | brain, with the conversation | as the brain decides | 1+ | Queued |

- Row 2 comes before row 3, so "no, just translate" re-reads the photo instead of declining a proposal. Row 3 matches the **whole**
  utterance only, so "no parking after 8?" is a question, not a "no".
- Row 10 comes before row 11, so "log this receipt" never logs a meal from the receipt photo.
- Row 8 comes before row 13, so "how much protein today" is never read as a price question.
- Row 11 drops a bare "I had", so "I had booked a room" and "I had a question about the visa" go to the brain, not to meals.
- **Speech recognition:** en-IN stays. The recogniser is given biasing phrases (commands, chat titles, common dish names;
  `EXTRA_BIASING_STRINGS`, API 33+, to verify on device), plus aliases for common Hinglish mishearings ("egg" → "ek" before a unit
  word such as katori, roti or plate; "punch" → "paanch"). An en-IN / hi-IN switch is in the backlog. With no validated network, or
  when roaming, the recogniser is asked to prefer on-device (`EXTRA_PREFER_OFFLINE`, today `false`, `service/Voice.kt:92`); the en-IN
  offline speech pack joins the offline pack step.

### G6. Capture quality per kind

| Kind | Known in advance (your words) | Auto (double-tap) | Upload |
|---|---|---|---|
| scene, landmark, food | Frame | Frame | 1280 px, `detail: low` |
| text, sign, price tag | Full ("Hold still") | Frame → escalate on the text check | 2048 px, `detail: high` |
| menu, receipt, board, cash, wifi, card, label | Full ("Hold still") | Frame → escalate | 2048 px, `detail: high` |

**Low-data mode** turns on by itself only **when roaming** (the active network lacks `NET_CAPABILITY_NOT_ROAMING`) **or when Android's
Data Saver is on** (`getRestrictBackgroundStatus() == RESTRICT_BACKGROUND_STATUS_ENABLED`); it is also a setting (Auto / On / Off).
It does **not** turn on for "metered" networks, because Android calls all mobile data metered, and at home that would switch off the
full-photo escalation on every walk outside. In low-data mode: frames unless a full photo is forced, uploads capped at 1280 px, no
automatic web search. It is said once ("Low data mode.") and the pill shows the reason ("Low data · roaming").

### G7. Offline behaviour

Offline answers say what they could not check. A missed match on a distant board is likely, so a negative is never stated as fact.

| Kind | Online | Offline |
|---|---|---|
| scene, landmark, food, cash | Cloud | "Offline, saved for later." Queued; **drains by itself** (today `WAITING_FOR_NETWORK` is never retried, lenses.md §1). A queued Look keeps its time and place (C10) |
| text, sign | Cloud | On-device read + translate (needs the trip's language pack), labelled "on-device reading"; the original script on the phone |
| menu | Cloud | On-device read + translate + **₹ for detected prices at the cached rate** + an **allergen keyword scan** (per-language terms in the offline pack): "Possible peanut: ピーナッツ". Says "No full allergy check offline." |
| price | Cloud | **On-device read + number and currency regex + cached rate: "¥2,400, about ₹1,368 at the 13 Oct rate"** (price has no offline path today, `data/Queue.kt:118`). When a tag shows several prices, it says both ("600, or 660 with tax"), or picks the largest printed number by its ML Kit box and says so ("the big price reads 600") |
| receipt | Cloud → proposal | **On-device total → a draft spend "check later"** |
| board | Cloud | **On-device read + regex for your trip legs' flight or train numbers → your row.** No match is hedged: "I couldn't find AI 314 on this board. Check the screen." |
| Voice commands | Online recogniser | Offline recogniser; every local phrase (G5 rows 1–11, 23, 24) works in flight mode |
| Brain questions | Cloud | "Offline, saved for later"; answered when back online (spoken if still wearing and < 10 min, else a notification; "now / here / open / today" questions older than 60 min get [Ask again] instead, C10) |

**Allergies are never "safe".** When your profile has a medical allergy flag, no Look (online or offline) calls a dish "safe" or
"your only pick". It says what is listed and what it cannot see: "No shellfish listed on the edamame. Ask staff about dashi and
shared fryers." Menu Looks then carry a **[Show allergy card]** chip.

### G8. Side effects need a yes; the hand-off is a pause

| Detected | Proposal (built from the parsed JSON, then the NEEDS A YES earcon) | Accept | If ignored |
|---|---|---|---|
| receipt | "Receipt, Marufuku Mart, 2,400 yen, about ₹1,368. Log it?" | "yes" / "log it" in the window; [Log ₹1,368] on the turn | Trip · Money › **To confirm** |
| food | "Dal, two rotis and bhindi, about 520 to 680 calories. Log it as lunch?" | "yes" / "log it"; [Log meal] | **Nothing is written.** The turn keeps [Log meal]; Review lists it under "Might be a meal?" (F2 #1) |
| ticket or boarding pass | "Boarding pass, AI 314. Add it to the trip?" | "yes"; [Add to trip] | Stays on the turn |
| Wi-Fi card | "Wi-Fi Hotel_Guest. Join on your phone?" | notification [Join] [Copy password] | Stays on the turn |
| business card (backlog) | "Card from Kenji Sato. Save the contact?" | "yes"; [Save] | Stays on the turn |

- **The proposal is never the model's own sentence.** The Look's speech carries no amount to confirm; the app builds the line above
  from the validated JSON, after the JSON arrives (G3 step 5). A cut-off or malformed JSON means no proposal: "Couldn't read the
  total. The receipt is on your phone." The written row stores the amount that was spoken.
- Explicit commands are their own yes ("log this receipt", "log lunch"), and are read back. Every write shows Undo on its turn and in
  a snackbar; "undo" by voice works for 10 min. Target: **zero ledger writes without a yes.**
- **Hand-off to Meta is a pause, not an end.** "Live translate" → "Handing over to Meta AI. Say 'Hey Meta, start live translation'.
  Fieldnote comes back in 30 minutes, or from your phone's notification." The media buttons are released (taps go to Meta), the
  notification shows **Resume** and the time left. Today `hand_off_to_meta` ends the glasses and needs the phone to return
  (`data/TravelActions.kt:181`).
  - **Offline:** Meta's offline language packs cover only some languages, so before pausing with no data Fieldnote says "Meta's live
    translation may need data for Japanese. Your Phrases card is on your phone." and stays active; saying "live translate" again
    hands over anyway.
  - **Coming back:** at 30 min Fieldnote reclaims the taps only if no other app is playing audio or holding a call-audio route or
    the mic (Meta may still be translating); otherwise it quietly extends in 10-min steps. Then "Taps are back." The pause length is a
    setting (15 / 30 / 60 min).
- **Safety and social rules.** No capture without a gesture or your words. "I'm driving" / "I'm cycling" switches to audio only: no
  capture prompts, no proposals, answers short. The glasses SDK gives **no battery percentage** (`DeviceState` has only
  `thermalLevel`; `Device` has name, link state, type, firmware and compatibility), so there is no "battery 64%" anywhere. A battery
  warning is spoken only on `StreamError.BATTERY_LOW` or `DeviceSessionError.BATTERY_CRITICAL`; heat is read from
  `getDeviceState().thermalLevel` and `THERMAL_HOT` errors are spoken plainly, and Looks then drop to frames only. No face
  identification, ever.

### G9. Where results show on the phone

1. **The conversation:** the Look card (photo, kind chip, answer, chips such as "Read it all", "Prices in ₹", "Anything veg?", "Log
   spend", "Log meal", "Show allergy card", "Ask a follow-up").
2. **Photo detail:** every answer about that photo, across conversations, with links.
3. **Trip · Today** (on a trip): the **Just-now Look** card for 30 min, then the day's journal (Looks, spends, notes, meals, pins).
4. **The Glasses sheet** (4.2): the same Just-now card and the Quick looks row.
5. **Plateful:** meals, drafts and "Might be a meal?". **Trip · Money › To confirm:** receipt proposals.
6. **The notification:** the state on the lock screen; the first 80 characters of the last answer only when unlocked, or when
   Settings › Privacy › "Show answers on the lock screen" is on. Private chats are never named.

**Trip tab changes in 3.9** (only what ask 5 needs; the full rebuild is in the backlog):
- **Header:** trip name, "Day 3 of 9 · Kyoto", and a switcher that **browses** a trip without making it active; a separate "Make
  active" button (fixes `ui/TripScreen.kt:134`, where choosing a chip changes what the glasses act on).
- **New top of the tab:** Just-now Look; **Quick looks ordered by context** (abroad: Read · Menu · Price · Receipt · Look; from 3 h
  before to 1 h after a flight or train: Board first; mealtimes add Log meal). With the glasses on they send `ACT_ANALYSE` with a kind
  extra (the service already accepts one, `service/FieldService.kt:133`); with the glasses off they open the phone camera and run the
  same Look. Then today's journal. The 3.4 blocks (Now card, cards, offline pack, bookings, notes) follow unchanged.
- **Money:** a **To confirm (n)** list with [Log] [Discard], and **all spends** paged (today only 10, `ui/TripScreen.kt:452`).
- **Backlog:** sub-tabs (Today · Plan · Money · Places), bookings and trips added and edited by hand, the Add spend form with no model,
  Places with Navigate, the traveller profile in Settings › You, and Share / Copy on the card screens.

### G10. The Detail-screen lens bug

- **Bug (confirmed):** a chip only sets the lens (`ui/DetailScreen.kt:113`); `send("")` returns once a thread exists (`:82`); Send is
  disabled on blank text (`:165`); the hint "Changing the lens sends another request" (`:119`) is false.
- **3.5 fix (a few hours):** a chip tap runs that lens at once (`state.ask(item, lensId, "")`, bypassing the blank-question guard);
  the hint goes; read-aloud reads the tapped answer, not `note.lastAnswer` (`:83, 140`).
- **3.9 redesign:** the 11-chip row becomes **Look as** with at most 5 chips chosen from the detected kind (for a menu: Text, Menu,
  Prices in ₹, Anything veg?, Scene). Each chip runs immediately, with a spinner on the chip and the new answer appended. "Log as meal"
  and "Log as spend" become buttons in the answer's action row, only for food and receipts, never on videos. Voice input uses the
  in-app glasses-first mic instead of the system dialog (`:79-81`). **Where the answer goes** follows C3: the conversation that holds
  this photo's capture or latest Look, else the day thread for the photo's date; the line above the composer says so ("Goes to *Japan ·
  Day 3* · Change") and it never moves the glasses.

---

## H. Settings and onboarding

### H1. One Settings area (4.2)

Until 4.2 the Glasses tab keeps today's settings, and each release adds its new rows there (the 3.6 model defaults, the 3.6 key check
and credit state, the 3.5 export). 4.2 moves them into one Settings area, reached from the drawer footer and deep links
(`fieldnote://settings/{section}`). **One rule for icons: the gear always opens Settings at the section for the screen you are on**
(the Glasses sheet → Settings › Glasses; Plateful → Settings › Plateful; Trip → Settings › Travel; Photos → Settings › Privacy and
data), and **⋮ always holds that screen's own actions**, never Settings. Every field saves on Done or on leaving the field, with a
"Saved" tick, never per keystroke (today the key saves on every keystroke, `ui/GlassesScreen.kt:135`).

| Page | Contents | Moved from |
|---|---|---|
| **Key and budget** | OpenRouter key: masked field, Paste, **Save**, **Test** with an inline result: "Key works", plus "Key limit left ≈ ₹1,186 ($11.30)" only when the key has a limit (from `GET /api/v1/key`; the account balance needs a management key, which Fieldnote never asks for), or "Rejected (401)"; with no key limit, a hint to set one so Fieldnote can warn you; **effective ₹ per $** (rate × 1.055 × card markup, default 4%); daily cap in ₹ with the ₹30 glasses reserve; confirm-above amount; today's spend; Spend › | Glasses › Answers |
| **Models** | "Who does what" roles (E4) with ₹ per action; the bake-off result and the pinned glasses ids; "Also on glasses"; catalogue "Updated 3 h ago · Refresh"; show ₹ per answer (on); retiring warnings | Glasses › Answers (1 brain + 10 eyes pickers) |
| **You** | Home currency (INR), languages, diet, allergies (medical flag), interests, walking pace, emergency contacts (one row each, not ";"-separated), "About you", "How to answer" (Brief / Balanced / Detailed); Memory › (backlog) | Trip › Traveller profile; Glasses › About you |
| **Glasses** | Link / Unlink; Taps or Wake word (wake word locked until Test D passes); Double-tap does; Follow-up (after questions 6 s / 10 s / Off; after Looks Off / Reading kinds / All); When music plays (Yield taps / Keep taps); Pause taps and hand-off length (15 / 30 / 60 min); Answer length 10 / 15 / 25 s; Look frame quality (Medium / High, from the 3.5 test); Web on glasses (Off / On request / Auto); **Speak on phone when the glasses are off** (the missing toggle, `data/Prefs.kt:69-71`; Off for glasses-started turns); Sounds (preview the 7 earcons); Setup check › | Glasses tab |
| **Conversations** | On open: New chat after 30 min / Last chat; continuity window 20 / 45 / 90 min; announce changes (on); trip-day threads (on); related resume (on); day starts at 04:00; Private chats (auto for shared documents and health, money or ID titles: on); export all; delete all (typed confirmation) | — |
| **Plateful** | Goals and targets (wizard), macros, units, evening review time, album pickup and consent, export, delete all food data. The same page opens in place from Plateful's gear | Glasses › Answers (targets) |
| **Travel** | Offline packs (including offline speech); tag photos with place; location permission; low-data mode (Auto: roaming or Data Saver / On / Off); travel mode (Auto / Off) | Trip tab |
| **Privacy and data** | What leaves the phone (a plain list per feature); **Show answers on the lock screen** (off); photo access ("All photos" or "Only photos you picked · Allow all"); album pickup consent; share doors to show; usage events toggle ("counts and timings, never your words"); export everything (zip); backup size ("12 MB of 25 MB"); delete everything | Glasses › Diagnostics |
| **Developer** (hidden: tap the version 7 times) | Diagnostics endpoint and token (out of the user UI, `ui/GlassesScreen.kt:205-218`); event log; Tests C and D procedures; prompt preview; force catalogue refresh; **re-run the migration from the backup**; feature flags (`spine_v1`, follow-up, captureProgressive) | Glasses › Diagnostics |
| About | Version, release notes, licences (Lucide ISC; fonts OFL) | Glasses footer |

**Glasses sheet vs Settings.** Daily controls live in the sheet (Start/End, Pause taps, mode, active conversation, Just-now, Quick
looks). Setup and preferences live in Settings › Glasses. Nothing configurable is shown that the app cannot actually receive (brief §5).

### H2. Onboarding (4 steps; each one does something)

1. **Welcome.** "Fieldnote remembers what you ask through your glasses, in one conversation you can read here." [Continue]
2. **Your key.** Paste your OpenRouter key → [Test] → "Key works. Today's budget: ₹200." Skip: "Photos will save, but there'll be no
   answers until you add a key."
3. **Link your glasses.** [Link] opens Meta registration. Each permission is asked **just before its system dialog**, with one line
   of why: Bluetooth ("to hear your taps"), microphone ("to hear your questions"), notifications ("for the lock-screen controls"),
   photos ("to show your Meta AI album"; if you choose "Select photos", the next line explains what stops working). Location is asked
   later, when first needed. Battery exemption with Nothing OS steps. This fixes the dialogs appearing over the Welcome text
   (`MainActivity.kt:151-160`); 3.5 already moves them after Welcome.
4. **Try it.** [Start glasses] → "Tap once… twice… three times" with a tick as each arrives (an inline Test A) → "Double-tap
   something now." → you land in Chat with your first Look visible. The card "When busy, 1 tap stops. 2 taps look. 3 taps ask." stays
   on the Glasses sheet for 7 days.

The traveller profile, Plateful goals and a first trip are offered later as starter cards, not in onboarding. The owner, already set
up, sees onboarding only through Settings › Run setup again; 4.2 shows a one-screen "What's new" instead. The onboarding rebuild
itself is in the backlog; 3.5 only fixes the permission order.

## I. Visual language and components

**Direction.** Keep the shipped base (Canvas B): dark, Bricolage Grotesque for display, IBM Plex Sans for text, orange `#E8742C`.
It is what the owner has used since 2.0 and it suits an instrument for the glasses. Make it calmer for long reading, and replace every
emoji or Unicode glyph used as an icon. The design must be Fieldnote's own: no copied layouts, colours or iconography from any AI
vendor.

### I1. Type scale (sp; tabular figures for every number)

| Token | Font | Size / line | Use |
|---|---|---|---|
| display | Bricolage 600 | 34 / 40 | Plateful kcal hero, Spend total, trip day hero |
| headline | Bricolage 600 | 26 / 32 | Tab titles (Trip, Photos), Plateful wordmark |
| title | Bricolage 500 | 18 / 24 | Top-bar conversation title, card titles, meal title |
| body-lg | Plex 400 | **16 / 24** (from 15 / 22) | Chat answers and turns |
| body | Plex 400 | 14 / 20 | Lists, settings, secondary text |
| label | Plex 600 | 14 / 20 | Buttons, chips |
| eyebrow | Plex 600, uppercase, +0.6 tracking | 11 / 16 | Turn meta lines ("LOOK · GEMINI 3.8 FLASH · 3.1 s · ₹0.52"), section heads |
| caption | Plex 400 | 12 / 16 | Timestamps, hints |
| mono | IBM Plex Mono 400 (new, OFL, about 100 KB) | 13 / 20 | Code, model ids, Wi-Fi passwords, booking refs |

### I2. Colour tokens

| Token | Dark (default) | Light (backlog) | Use |
|---|---|---|---|
| bg | #141416 | #F4EFE6 | Screens |
| surface | #1A1B1D | #FFFCF6 | Bars, composer, sheets |
| card | #1F2022 | #FBF7EE | Cards, Look cards |
| card-2 | #26282C | #EFE8DA | Your turns (neutral; replaces the orange user bubble), inputs |
| line / line-soft | #34363A / #2C2E32 | #D9D0BF / #E9E1D2 | Borders, dividers, the answer's left rule |
| text / text-2 / muted | #F3F0E9 / #D6D1C7 / #A39E94 | #1C1913 / #3A342A / #5F584B | Text; muted ≈ 6.9:1 on bg |
| accent | #E8742C | #A84A12 (text-safe) | Primary actions, selection, send, kcal |
| on-accent | #1A1206 | #FFFFFF | Text on accent |
| accent-soft | accent at 14% | accent at 12% | Selected chips, active tab pill |
| glasses | #5FB3A6 | #2E7D6F | **Only** things from the glasses: rail, banner, pill dot, glasses icons. Nothing else is teal, so teal always means "the glasses did this" |
| protein | #7FA0D0 (5.5:1 on card-2) | #3E5F8F | Protein bars and figures in Plateful (was teal) |
| warning | #E9A23B | #9A6412 | Drafts, proposals, 80% budget, retiring model |
| danger | **#E36B5F** (≥ 4.5:1 on every dark surface, 4.59 on card-2; the old #D9574A was 3.81–4.44) | #B3362A | Errors, destructive text and outlines |
| hatch | text-2 at 30%, 45° | text at 20% | Unconfirmed meals in bars |

- **Success ticks** (a confirmed meal, "Key works", "All checks passed") use text-2 or accent, not teal.
- Card screens (Driver, Allergy, Phrases, Emergency) keep their always-light, full-bright palette (`ui/CardScreen.kt:67-71`).
- Theme: **Dark now** (K15). "System / Dark / Light" in the backlog, with orange darkened for text on light (orange on paper is about 2.6:1).

### I3. The Fieldnote signature (original, not borrowed)

- **Answers are notes, not bubbles:** full-width text with a 2 dp left rule in `line`, under an **eyebrow meta line** (kind, model,
  seconds, ₹). Your turns are compact `card-2` cards on the right.
- **The glasses rail:** every turn that came from the glasses carries a teal left rail and **tap dots** in its eyebrow (●● a Look,
  ●●● an Ask, ↺ a follow-up), tying the screen to the tap grammar.
- **Photo-first Look cards:** full-width photo, kind chip in small caps ("MENU · JAPANESE"), the spoken line in bold, the fuller
  answer below, then action chips.
- Bricolage numerals for money and kcal.
- No centred-logo empty states, no sparkle icons, no model name as a title dropdown.

### I4. Icons

- **Lucide** line icons (ISC licence), about 50, imported as vector drawables: 24 dp, 1.75 stroke, round caps. No icon library
  dependency. Plus custom glyphs: glasses, glasses-live, Look (an eye in brackets), plate, and tap-1/2/3.
- Replacements: ▣ → image-plus / paperclip · ● (mic) → mic · ↑ → arrow-up · ■ → square · ‹ → chevron-left · ♥ → heart · ↗ → share-2 ·
  🗑 → trash-2 · 🎙 → mic · 🔊 → volume-2 · 🍽 → plate · 📍 → map-pin · ▶ → play · × → x · ▾ → chevron-down · ＋ → plus. Tabs:
  message-square, luggage, plate, images.
- Capability badges: eye (Sees), film (Video), headphones (Audio), file-text (Files), wrench (Tools), brain (Thinks), globe (Web).
- Every icon button has a `contentDescription`, `Role.Button` and a **48 dp touch target**, even when the drawn icon or circle is
  40 or 44 dp (the answer's icon row, the photo overlay buttons, steppers). Fixes P-G9.
- **Tap dots are drawn, not read.** Glasses turns carry a `contentDescription` such as "From glasses, double-tap Look, 13:02", so
  TalkBack never reads "black circle black circle".

### I5. Feedback and motion

- **Snackbars replace all 42 toasts** (`MainActivity.kt:142-144` and about 40 call sites). 3.6 wraps the root in a `Scaffold` with
  a `SnackbarHost` for the drawer's Undo, `PlatefulActivity` has its own (3.7), and 4.2 sweeps the remaining toasts. Destructive
  actions (delete conversation, turn, meal, spend, pin, attachment; move a turn) get **Undo for 8 s**. Background results get
  **View** ("Meal logged · View"). Failures that need action stay inline next to their cause, with Retry. Persistent conditions
  (offline, 80% budget, no OpenRouter credit, retiring model, taps paused, low data) are banners.
- **Haptics:** light tick on send and long-press; confirm tick on "Looks right" and "Log it"; a firmer tick on destructive actions.
- **Motion:** 150–250 ms standard easing. Streamed text fades in by sentence (no typewriter jitter). The teal dot pulses at 1.2 s only
  while listening. The drawer and sheets slide in 250 ms. A photo expands into Photo detail (shared element). When the system
  animation scale is 0, there is no motion.

### I6. Components

TopBar (with place subline) · GlassesPill · GlassesBanner (only with an action) · ConversationRow · TurnUser · TurnVoice (teal rail,
tap dots) · TurnAssistant (eyebrow, markdown, action row, version pager) · ThinkingRow ("Thinking · 12 s", tool step, Answer now;
folds into "Thought for 14 s ›") · TurnLook (photo card, kind chip, chips) · TurnLink ("Looked at: … ›") · TurnProposal (Log / Not
now) · TurnAction (compact row) · TurnNotice (centred) · SourcesSheet · Composer (context row, +, field, mic, send/stop) ·
AttachmentChip (progress, route label) · LastCaptureChip · ModelChip · ModelSheet · CapabilityBadge · CostHint · KindChip · Stepper (48
dp touch) · RangeBar (target tick, hatch) · MealRow · UsualChip · DayPager · SectionEyebrow · SettingsRow · EmptyState (icon + one
line + one action) · Banner (info, warning, danger) · ConfirmSheet. One chip style (replaces `Chip` and `LensChip`), one round button,
one back affordance (the top bar ‹).

**Layout rules for large text.** Every fixed height in the spec (context row 32, chips 36, rows 56 and 72, the banner) is a minimum:
`heightIn(min = …)`, never `height(…)`, so nothing clips at Android 14+'s 200% font scale. Each release is checked at 200%.

---

## J. Phased roadmap

Sizes are engineering days for this codebase (about 7,450 lines of Kotlin, JSON stores, no DI), for **one developer working with
Claude sessions, on one track**, including the judges' corrections to the proposals' optimism. Dates assume about 5 days a week from
Thu 24 Sep and leave out Gandhi Jayanti (2 Oct), Dussehra (20 Oct), 3 days in Diwali week (9–11 Nov) and 4 days over Christmas and
New Year. Every release ends with a real outing as its test, as in the travel plan. **Every shipped build raises `versionCode`**
(3.5 = 350, 3.6 = 360 … 4.0 = 400; patches +1), whatever its name.

### Order of work, and why

1. **3.5 first**, because the default Look and food model (Gemini 2.5 Flash) stops working on **20 Oct**, because it stops silent loss
   of old chats, and because two weeks is the most the owner should wait for visible relief on asks 1 and 4.
2. **3.6 next**, because model choice, streaming, formatting, web search and a real chat list do not depend on the new store. It
   finishes ask 3 and gives most of the visible ChatGPT parity by the end of October.
3. **3.7, 3.8 and 3.9 bring the core of asks 4, 2 and 5 on today's store** (K18). None of them needs the new store: Plateful has its
   own package and meals file; a PDF or a video is one more part on a message that 3.6 already gives an attachments list; the Look
   work lives in the service, the queue and the ledger. Each adds fields to `chat.json` that the 4.0 migration maps (C11). This order
   also gives 4.0 two months of `turn_joined` data from the 3.5 stopgap before its placement rules freeze.
4. **4.0 then** finishes ask 1: one store, placement by rules, cancel anywhere, retry and edit on any turn.
5. **4.1 Plateful complete** (Review, shutter pickup, Trends, Goals, evening review) finishes ask 4. Its voice logging uses the 4.0
   router.
6. **4.2 shell and polish** (Glasses sheet, Settings, icons, snackbars, earcons). No ask depends on it.
7. **4.3 attach the rest** finishes ask 2.
8. **Backlog**, decided after the five acceptance suites (M) pass.

If you would rather have ask 1's continuity first, 4.0 moves to right after 3.6 (ready about 8 Dec), and Plateful core, files and
Look each move 5 to 6 weeks later (21 Dec, 5 Jan, 21 Jan) (K18).

### 3.5 "Before 20 October": 11 d, installable about 7 Oct, measured by 9 Oct

| Work | Code | d |
|---|---|---|
| **Model bake-off, first:** 20 of your saved photos (signs, menus, cash, a Wi-Fi card, meals) and 20 recorded spoken questions with the tool list. Look: `google/gemini-3.8-flash` (low) vs `google/gemini-3.1-flash-lite` (minimal) vs `openai/gpt-6-luna` (none). Voice: `openai/gpt-6-luna` vs `openai/gpt-5.6-luna` vs `openai/gpt-5.6-sol` (low). Scored on first-audio time, reading accuracy and correct tool choice. The winners become pinned ids (E4), and G3's targets are restated for them | a small harness on the API | 1 |
| Capability-aware parameters: gpt-6*, gemini-3*, claude-*-5* get reasoning effort from the catalogue (never `none` when mandatory), output cap ≥ 2,000, temperature only where supported | `data/Analyst.kt:20-36`, `data/Food.kt:108`, `data/Agent.kt:303` | 0.5 |
| Look and food defaults move to the bake-off winner as a **concrete id**; any saved id is accepted; saved `gemini-2.5-*` ids migrate with one snackbar | `data/Prefs.kt:24-31, 57-60, 132-135` | 0.5 |
| Spend in micro-USD, no 1-cent floor, atomic accumulator; cap and spend shown in ₹ at the effective rate (default ₹200); 80% warning on every path | `data/Analyst.kt:42`, `data/Prefs.kt:39-44`, `ui/GlassesScreen.kt:166` | 0.5 |
| **Continuity stopgap, strict version.** (1) Glasses voice turns and double-tap pairs go to **one chat a day, "Glasses · Wed 7 Oct"**, found or created, unless you chose a chat by voice. (2) **Opening a chat on the phone no longer pins it** (`ui/ChatScreen.kt:99`, `data/Chat.kt:83`); the old list's long-press gets **Continue on glasses**, which holds the glasses there for 3 h from the tap. (3) "new chat", "back to X" (a small local fuzzy title match, since today the brain does this through `switch_chat`) and "stay here" choose a chat by voice; a chosen chat keeps the glasses while its last glasses turn is under 45 min old, or for 3 h after "stay here". (4) **`new_chat` and `switch_chat` are removed from the brain entirely**, typed turns included; typed turns go to the chat on screen. (5) At Start: "Glasses on. In Wednesday." (6) Mirrored double-tap lines carry `source=double_tap` and the `Note` message's time (C11) | `data/Chat.kt:41, 67-94`, `data/Agent.kt:62, 211-219, 242-246, 294-295`, `service/FieldService.kt:345-358`, `ui/ChatScreen.kt:92-111` | 1.5 |
| **History safety.** Remove the global `takeLast(2000)` (`data/Chat.kt:96`), which will otherwise delete the oldest chats as double-tap pairs add about 50 messages a day at home and 130 on a travel day. Instead: a flat cap of 20,000 messages and 8 MB; typed and pinned chats are never trimmed; if a trim is ever needed, the oldest "Glasses · <date>" chats go first and their messages are appended to `filesDir/trimmed.jsonl` for the 4.0 migration; `chat_trimmed` telemetry. On the first 3.5 launch, `chat.json` and `notes.json` are copied once to `filesDir/migration-backup/` | `data/Chat.kt:96` | 0.25 |
| Glasses audio: a tap stops speech; tap pips (1/2/3) within 150 ms; the listening tone plays only once the mic is live; **glasses-started listening uses the glasses mic only** (no silent phone-mic fallback, `service/Voice.kt:41-58`); offline speech preferred with no network or when roaming | `service/FieldService.kt:249-261, 369`, `service/Voice.kt:41-58, 92` | 0.75 |
| Notification: opens the glasses' chat; on the lock screen only a state-only public version ("Fieldnote · Ready"), `VISIBILITY_PRIVATE` for the full one (today it sets neither, `service/FieldService.kt:495-521`) | `service/FieldService.kt:495-521` | 0.25 |
| **Glasses food:** local "log it" / "log this" / "log this meal" within 10 min of a capture → `FoodAnalyst` directly, items read back, "Say undo"; local "undo" for 10 min; the Food double-tap lens logs with Undo. **"remember that I…"** goes to the brain as a profile proposal, not a place note | `service/FieldService.kt:379-411`, `service/TravelSession.kt:77-87`, `data/Food.kt` | 0.75 |
| Detail chips send; read-aloud reads the tapped answer; wrong hint removed | `ui/DetailScreen.kt:82-83, 113, 119, 140, 165` | 0.25 |
| Food stopgap (F12): + Add meal (describe with time chips, or any phone photo); Remove with confirm and Undo; title, time and portion scaling by hand; targets moved into Food | `ui/FoodScreen.kt`, `ui/AppState.kt:180-202`, `data/Food.kt:125` | 1.25 |
| Permissions asked after Welcome; "Arm again" copy fixed | `MainActivity.kt:147-160` | 0.25 |
| **Export everything (zip)** of all app data (chats, notes, meals, trips, spends, prefs without the key), in the Glasses tab's Diagnostics, runnable before any risky install | new | 0.25 |
| Telemetry: `turn_routed`, `turn_joined{rule}`, `barge_in`, `tap_ack_ms`, `voice_route_ms`, frame `capture_ok` with setup breakdown, `chat_trimmed`, `meal_logged{source}` | `Diagnostics.event` call sites | 0.25 |
| **Device gate** on one real glasses outing, with a **3.5 test build that has Developer toggles** to hold the call mic open without the recogniser and to switch the frame to 720×1280. Test A2 under five conditions: taps during speech on normal audio; with the call mic open; **during a live camera stream (does a tap arrive as a key, or pause the stream?)**; in wake-word mode; with music playing, including "pause the music by tap, wait 30 s, resume by tap". Also: call-route time; a double-tap while the call mic is open; frame latency and legibility at 504×896 vs 720×1280 on signs, cash and Wi-Fi cards | on device | 1.75 |
| **Setup-time spike** (separate, time-boxed): why capture setup rose from 2.1 s to 5.0 s. "Not found" is an acceptable result | on device | 1 |

**Installing 3.5 safely.** The phone runs an intermediate 3.4 build (critic C9). First compare signing certificates (`apksigner verify
--print-certs` on the new APK against `adb shell dumpsys package com.urmit.glasses.dev`). If they match, update in place with `adb
install -r`; **never uninstall**, which wipes chats, notes, meals, trips and spends (3.4 can export only spends). If they differ, stop
and decide with the owner before anything is lost (if the installed build is debuggable, `adb shell run-as` can copy its files off
first).

**Measure:** zero "model not found" or "ran out of room" failures after the swap; the bake-off table; first `meal_logged{source=add}`
and `{source=glasses_log_it}` events; frame `capture_ok` numbers (never logged before); Test A2 results; `turn_joined` from the
stopgap. **These numbers set the defaults of 3.9 and 4.0** (follow-up window on or off, call-route policy, frame quality, music
policy, cancel during capture, agent lanes).

### 3.6 "Chat quick wins": 14 d, ready about 30 Oct (today's store, no migration)

| Work | d |
|---|---|
| `ModelCatalog` + `RequestProfile` + role slots + mapping of today's model prefs to roles (E6); text-output models only | 2 |
| Model chip, Model sheet (tiers, badges, ₹ per reply, thinking chips, Recent and Starred, Custom row, "Make default for new chats"), All models, per-chat model and effort (fields on today's `Chat`), long-press swap | 1.75 |
| SSE streaming for typed chat with tool rounds; Stop; request cancellation; the **"Thinking · 12 s" row** with the live tool step, **Answer now**, and reasoning summaries folded into "Thought for 14 s ›"; streamed text kept in memory and saved once at the end (C1) | 2.5 |
| **Message ids** on today's `ChatMessage` (moves and edits stop matching on time + role) | 0.25 |
| Markdown renderer (with a Compose version spike), copy and select, jump to latest | 1.5 |
| Web search with citations and a Sources sheet (3 results; cost from `pricing.web_search`) | 1.5 |
| Attach phone photos (picker, up to 4 images) sent straight to a vision-capable chat model; an attachments list on today's messages | 1 |
| **Chat drawer on today's store:** `ModalNavigationDrawer` from ≡ only; New chat; title search; rename (`ChatRepo.rename` exists); pin to top; delete with an 8 s Undo; Continue on glasses and Private in the long-press menu; BackHandler with predictive back; root `Scaffold` with a `SnackbarHost`; opening a New chat after 30 min away (B1) | 1.75 |
| **Retry** on the last reply (write tools off) and **Edit** on your last message (refill the composer, drop the old reply) | 0.75 |
| **No-credit state (HTTP 402)**, key check with `limit_remaining`, the effective ₹ rate, and the budget by role (₹30 glasses reserve; typed chat to Quick at 80%) | 0.5 |
| Dictation into the text box with live partial text; Spend screen by role | 0.5 |

**Test:** a week of normal use. The owner changes the model at least once from the chip; a table renders; a web answer shows sources;
a long reply shows the thinking timer, and Answer now works; a chat is renamed, pinned, deleted and restored with Undo; a bad answer
is retried and a typo edited.

### 3.7 "Plateful core": 9 d, ready about 17 Nov (today's shell)

| Work | d |
|---|---|
| `plateful/` package; meal v2 and `dish` table; migration of `meals.json` with quantity parsing; de-duplication by photo | 2 |
| **`PlatefulActivity`**: its own label, icon, `taskAffinity`, bottom nav, `Scaffold` and snackbar host; Back exits; ⋮ Open Fieldnote; the launcher icon and shortcuts. Fieldnote's Food tab becomes Plateful and embeds the same screens | 1 |
| Today (day pager, range hero with hatched drafts, bars, slots with Usuals chips, + Log, sync line) | 2 |
| Log sheet: Camera, Photos, Describe (text, dictation, time chips, Hinglish counts), Usuals and recent | 1.5 |
| Meal detail: steppers (48 dp), item sheet, fat level, time and type, home / eating out, question chips, Not food, delete with Undo | 2.5 |

**Test:** 7 days with at least 3 meals a day; the Plateful icon opens its own window and Back leaves it; every fix done by hand in
under 10 s, offline.

### 3.8 "Files and video": 6.5 d, ready about 26 Nov (today's store)

| Work | d |
|---|---|
| Attachment chips with progress and cancel on today's messages; files copied to `noBackupFilesDir/attachments/<chatId>/` | 1 |
| Attach sheet: Camera, Video, Photos & videos, Files; glasses album strip with the sticky "Add n" button; Take a glasses photo now; the "+ Last glasses photo" chip | 1 |
| PDF (native `file`, engine `cloudflare-ai` set explicitly), text files; PDF `annotations` and digests so heavy content is sent once | 1 |
| Video: Media3 transcode to the size budget (D2), `video_url` to a video model, "Use Media for this message" banner; streaming base64 body; prepare and upload as a user-initiated job with a progress notification; "Retry (27 MB)?" on mobile data | 2 |
| "Ask Fieldnote" share door → New chat (documents make it Private) | 0.75 |
| Cost hint and the ₹20 confirm | 0.75 |

**Test:** ask about a 3-minute phone video, a 30-page PDF and a CSV; share 3 items from WhatsApp and Gmail; lock the phone during a
video upload and see it finish.

### 3.9 "Look": 12 d, ready about 14 Dec (today's store)

| Work | d |
|---|---|
| `Glasses.captureProgressive()`; on-device text check and escalation; "Reading, hold still"; silence budget; frame quality from the gate; a pause during a capture = cancel; the call route closed before any camera session | 2.5 |
| One Look call, speech then JSON, streamed; kind first; proposals built from the validated JSON only; `needs_sharper` retry; ₹ conversion; allergy wording (G7) | 2.5 |
| Router v2 (local, in `FieldService.route`): Look intents with capture quality, the ordered phrase table (G5) including the override row and whole-utterance yes/no, pinned intent, "how much" reuse, "think harder" / "look closer" | 2 |
| Proposals: receipt → Trip Money "To confirm" and all spends paged; food → [Log meal] and "Might be a meal?"; ticket → trip; Wi-Fi → join notification | 1.5 |
| Offline Look: price and board regexes (hedged), menu allergen keywords; queued Looks drain by themselves (WorkManager) and keep their time and place | 1.5 |
| Trip · Today's new top: Just-now Look, context-ordered Quick looks (phone camera when the glasses are off); browse a trip without making it active | 1 |
| Hand-off to Meta as a pause (offline warning, reclaim rules); driving mode; low-data mode (roaming or Data Saver); battery and heat from the SDK's errors and thermal level | 0.5 |
| Photo detail "Look as" chips, with the destination line | 0.5 |

**Test:** a day out in your own city with 10 signs, 3 menus, 5 prices, 3 receipts, a Wi-Fi card and a platform board, part of it in
flight mode; every receipt proposal matches the JSON amount; a tap during "Reading, hold still" cancels.

### 4.0 "One conversation": 24 d, ready about 21 Jan

| Work | d |
|---|---|
| `spine.db` and `spine-cache.db` (C11); migration from the untouched 3.5 backup plus later writes, with the 3.6–3.9 fields mapped, double-tap mirrors skipped, counts including attachments and citations, re-runnable, no dual-write; every reader moved, including `TravelActions.find`; lean backup with the weekly size check | 6 |
| Placement engine (C3) with the named JVM tests; persisted glasses state (`set_at`); conversation commands and spoken cues; `search_conversations` and `rename_conversation` | 3.5 |
| Glasses turns written to the store (tap, Look, instant commands, link turns); Photo detail as a view; model context (summary, last N, the global Look digest and image, volatile facts last, `session_id`); voice tool subset; queued turns freeze their context | 2.5 |
| Glasses grammar: a child `Job` per trigger with request cancellation; one tap cancels in every busy state (capture per the gate); 1.5 s grace; Pause taps; music yield with explicit reclaim; the follow-up window (if the gate allows) with the speech-aware noise gate; answers streamed sentence by sentence within the answer budget, the rest kept for "more" (offset persisted); bad-data watchdog; `BECOMING_NOISY` and Bluetooth-disconnect handling | 4 |
| Agent lanes (glasses and phone) in place of the single lock, if 3.x telemetry shows glasses turns waiting; per-conversation busy state | 1 |
| Local router v1: conversation commands (including "move all that to X"), food and spend totals, conversion, "repeat", meal-log phrases with Hinglish, aliases and read-back, recogniser biasing | 2 |
| Chat UI on the store: glasses rail, live mirror, banner only with an action, link turns, retry versions and edit on any turn, read aloud, move and "Move everything since…", split, delete turn, day dividers, drafts per conversation, starters, queued states | 3.5 |
| Drawer on the store: full-text search results with filters, Trips and days, the On your glasses card; Conversation info; Continue on glasses / Start glasses here; Private chats set automatically for health, money and ID titles | 1.5 |

**Test:** a half-day walk with the phone locked: 20 glasses turns, 10 Looks, a phone hand-off (related and unrelated), "Continue on
glasses" followed by Looks, a forced restart, a "back to" command, music playing for part of it, and the glasses switched off mid-answer.

### 4.1 "Plateful complete": 10 d, ready about 4 Feb

| Work | d |
|---|---|
| Review (cards, Might be a meal?, Might be food?, Not logged, Anything missing?) | 2 |
| Passive pickup: `JobScheduler` content trigger, ML Kit labelling and face detection, the mealtime, burst and trip rules (F2 #4), consent; `READ_MEDIA_VISUAL_USER_SELECTED` and the partial-access notice | 2.5 |
| Evening notification ([Review]; [All good] confirms drafts only, shows the kcal it adds, needs unlock); spoken summary at glasses stop | 1 |
| Trends | 2 |
| Goals wizard and Settings › Plateful; export CSV/JSON; delete all | 1.5 |
| Voice corrections and brain tools (`edit_meal`, `delete_meal`, `undo_last_meal`, `log_meal(time, favourite)`); Label photo; "Log to Plateful" share door | 1 |

**Test:** 7 days with at least 3 meals a day and no typing except fixes; one day of shutter-only capture with the app closed; a market
walk of 10 food shutter photos in 20 min on a trip adds **nothing** to the totals.

### 4.2 "Shell and polish": 8 d, ready about 16 Feb

| Work | d |
|---|---|
| Glasses sheet replaces the Glasses tab (four tabs); notification rework (conversation in the title; Look · Ask · End; Stop while speaking; Resume while paused); Start glasses shortcut and Quick Settings tile | 2 |
| One Settings area (H1) | 2 |
| Snackbars replace the remaining toasts; Lucide icons with content descriptions; accessibility pass (48 dp touch targets, `heightIn`, 200% font) | 2 |
| 7 earcons on SoundPool; "What's new" | 1 |
| Photos tab: search, filters (Looked at, Meals, Receipts), multi-select "Ask in chat", unhide | 1 |

### 4.3 "Attach the rest": 8 d, ready about 26 Feb

| Work | d |
|---|---|
| Audio files and voice notes (native `input_audio`, or speech-to-text then text) | 1.5 |
| Video to models without video: 16 frames + transcript; `reopen_attachment` | 2 |
| Preview and trim sheet; PDF page range | 1.5 |
| Per-message cost breakdown; the incompatible-model banner with both options; Direct Share targets | 1 |
| Office files (DOCX, XLSX, PPTX) as text, **only if you want them** (K12); otherwise this day is buffer | 1 |
| Buffer for the video library | 1 |

**Test:** ask about a 90 s video on GPT-6 Sol (frames + transcript), a 30 s voice note and (if built) a DOCX; trim a 5-minute clip.

### Backlog (decided after the five acceptance suites pass), about 15 d

Memory list and `remember_fact` (1.5) · temporary chat (0.5) · talk mode on the phone (1.5) · System / Dark / Light theme (1.5) ·
Health Connect (1) · IFCT anchor table and dish memory, after a licence check (1.5) · barcode (1) · onboarding rebuild (1.5) · business
card and label kinds (1) · en-IN / hi-IN trial (0.5) · Trip tab rebuild with sub-tabs, manual bookings and trips, the Add spend form,
Places with Navigate, card Share and Copy (4) · glasses clip spike (10–30 s HEVC → MP4, only if the mic works during a camera stream,
0.5).

**Total ≈ 102.5 days to 4.3** (11 + 14 + 9 + 6.5 + 12 + 24 + 10 + 8 + 8), plus the backlog.

### Telemetry to prove each ask is solved

Events go through the existing `Diagnostics.event` into `fieldnote_events`. As today they carry kinds, counts and timings, never your
words. Pass bars are checked 2–4 weeks after the release that finishes the ask.

| Ask | Events | Solved when |
|---|---|---|
| 1 Chat and continuity | `turn_joined{source, rule: explicit/look/hold/look_followup/handoff/window/named/related/scope, related, idle_min}`, `conversation_created{origin}`, `turn_moved{by, bulk}`, `conv_cmd{cmd}`, `followup{opened, used, speech_start_ms, spoke_unrecognised}`, `barge_in{state, gesture, stop_ms, via: key/pause}`, `tap_ack_ms`, `think_ms`, `stream_first_token_ms{lane}`, `glasses_first_audio_ms{kind}`, `watchdog{stage}`, `chat_action{kind}`, `chat_trimmed` | ≥ 90% of glasses turns join an existing conversation; ≤ 1.5 glasses-created conversations per active day; **no Look lands in a topic chat unless named**; moved turns < 3% of glasses turns; follow-up used in ≥ 20% of opened windows; typed first token p50 ≤ 2 s; voice first audio p50 ≤ 3.5 s after you stop speaking; tap → speech stops p95 ≤ 300 ms; no glasses turn waits on the 90 s timeout; `chat_trimmed` never fires |
| 2 Uploads | `attach_added{kind, source, size_bucket}`, `attach_prepared{kind, route, ms}`, `attach_sent{kind, route, cost_micro}`, `attach_failed{kind, stage}`, `share_in{door}`, `cost_confirm{shown, sent}` | ≥ 95% of attachments send; a 60 s video is ready p50 ≤ 20 s; a 3 min video fits the 20 MB budget; no out-of-memory crash on a 20 MB video; ≥ 1 non-photo attachment a week |
| 3 Models | `model_changed{scope, tier}`, `answer{role, model, cost_micro}`, `model_migrated{from, to, reason}`, `model_fallback{reason}`, `budget{pct, role}`, `credit_402`, `spend_reconciled{app_micro, or_micro, utc_day}` | Zero "model not found" after 20 Oct; app spend within ±5% of the key's `usage_daily` over the same UTC day; the owner changes a model from the chip at least once a week; spend inside the cap on ≥ 95% of days; the glasses never stop for budget while the ₹30 reserve is unused |
| 4 Plateful | `meal_logged{source, status}`, `meal_confirmed{via, ms_since_capture}`, `meal_edit{how: stepper/item/time/voice/model}`, `meal_deleted`, `review_opened{from}`, `all_good{drafts, kcal}`, `album_scan{new, food, maybe, faces, access}` | Meals on ≥ 6 of 7 days; ≥ 50% of meals created without typing; median fix < 10 s; fewer than 1 in 3 meals need a model re-estimate; passive pickup finds ≥ 80% of shutter-photographed meals (owner spot-check); **no meal counted that the owner did not confirm or log** |
| 5 Look | `look{kind_detected, kind_final, capture: frame/full/escalated, setup_ms, shot_ms, model_ms, first_audio_ms, offline}`, `look_override{from, to}`, `intent_local{intent}`, `proposal{kind, outcome, json_ok}`, `handoff{resumed_by}`, `low_data{reason}` | Override < 10%; **zero ledger writes without a yes**, and every write equals its JSON amount; scene first audio p50 ≤ 8 s; escalated ≤ 16 s with "hold still" ≤ 1 s after the frame (restated after the bake-off); ≥ 80% of spoken intents handled locally; price, board and text Looks answer in flight mode |

---

## K. Risks and the owner's decisions

### K1. Decisions for the owner (recommended default in bold)

| # | Decision | Options | Recommended default | Needed by |
|---|---|---|---|---|
| K1 | What "session" meant in ask 1 | (a) a Fieldnote chat that splits · (b) each glasses start feeling fresh · (c) Meta AI "Hey Meta" chats | **(a) and (b)**, fixed first by the 3.5 dated glasses chat, then by the one store and the placement rules. (c) is impossible: the glasses SDK gives camera and audio only | 3.5 |
| K2 | Leave live translation and live streaming to Meta | Yes · No | **Yes** (your travel-ideas doc says so). Fieldnote keeps *reading* signs and menus (with meaning, allergens, ₹ and your trip), which Meta does not do. If "translation" also meant signs, "translate this" becomes a hand-off cue instead | 3.9 |
| K3 | Plateful's form | Own window in the same APK · a launcher alias only · separate APK · personal vs Play product | **Own window (`PlatefulActivity`) in the same APK, personal tool**; package boundary kept for a later split | 3.7 |
| K4 | Nutrition detail | kcal + protein · full macros | **kcal + protein shown**; carbs, fat, fibre stored with a toggle | 3.7 |
| K5 | Plateful look | Fieldnote dark · light "paper" | **Fieldnote dark**; a light theme for the whole app is in the backlog | 3.7 |
| K6 | Continuity rules | Window 20 / 45 / 90 min; hold 3 h; day starts 04:00; trip-day threads; related resume; hand-off needs shared words | **45 min; 3 h from the choice; 04:00; trip-day on; related resume on (conservative); Looks always to today's thread unless named** | 4.0 |
| K7 | Follow-up mic | Off · after questions and proposals · also after reading Looks · after everything | **After questions, proposals, "More?" and reading Looks (sign, menu, price, board), 6 s; never after scene Looks; never while other audio plays** (subject to the 3.5 device gate) | 4.0 |
| K8 | Taps while your music plays (the open brief comment) | Yield taps to music while it plays · keep taps for Fieldnote | **Yield while music plays; take them back only when you say so or after 10 min with no player**, never 10 s after the music stops (a "resume" tap would take a photo); Pause taps for 30 min on request; notification Look and Ask always work. Final only after Test A2 with music | 4.0 |
| K9 | Typed chat default model | Smart (GPT-6 Sol, ≈ ₹3.3 a reply) · Media (Gemini 3.8 Flash, ≈ ₹1.2) · Auto | **Smart**, because you already use Sol-class; a travel day then costs about ₹92 at what you actually pay. Pick Media to cut that to about ₹50 | 3.6 |
| K10 | Glasses voice model | The 3.5 bake-off winner (GPT-6 Luna expected) · same as chat | **The bake-off winner, pinned**, for speed (about ₹0.12 a turn); "Also on glasses" per chat when you want Sol | 3.6 |
| K11 | Budget | ₹ per day; glasses reserve; confirm threshold; card markup | **₹200 a day with ₹30 kept for the glasses; typed chat to Quick at 80%; raise by ₹100 for today in one tap; confirm above ₹20 per message; card markup 4%** (check your card's forex fee) | 3.6 |
| K12 | Upload limits and Office files | Video length; items per message; DOCX/XLSX/PPTX or not | **3 min per video (on a size budget), 10 items, 25 MB per message. Office files only if you say you need them** (export to PDF works today) | 3.8 / 4.3 |
| K13 | Passive pickup of shutter photos | On · off | **On after a one-time consent card**, and only clear meals at mealtimes, 2 or fewer photos in 30 min, no faces, not on a trip; everything else waits under "Might be food?" with nothing uploaded | 4.1 |
| K14 | Share doors | One · three | **Three** (Ask Fieldnote, Log to Plateful, Add to trip), each hideable | 3.8 / 4.1 |
| K15 | Theme | Dark only · System · Light | **Dark now; System and Light in the backlog** | backlog |
| K16 | Telemetry | Keep · off | **Keep**; it is the only way to check section J's pass bars | now |
| K17 | Installing 3.5 | In-place update · uninstall and reinstall | **Compare signing certificates, then `adb install -r`; never uninstall.** If the certificates differ, stop and decide together (J) | 3.5 |
| K18 | Release order after 3.6 | Asks 4, 2, 5 first (3.7–3.9), then 4.0 · 4.0 first | **Asks 4, 2, 5 first**: Plateful core 17 Nov, files and video 26 Nov, Look 14 Dec, one conversation 21 Jan. With 4.0 first: one conversation about 8 Dec, and the other three 5 to 6 weeks later each (21 Dec, 5 Jan, 21 Jan). A second parallel track is not planned (one developer) | 3.6 |
| K19 | Double-tap default | Look (auto) · Scene only · fixed kind | **Look (auto)** | 3.9 |
| K20 | Taps or wake word as the main trigger | Taps · wake word | **Taps**; wake word stays time-boxed and locked until Test D passes | 4.0 |
| K21 | Web search | Off · on request · auto (typed chat); on the glasses | **Auto with 3 results in typed chat, "on request" after 80% of the budget; on request on the glasses** ("look up", "is it open now") | 3.6 |
| K22 | Photos stays a tab | Tab · under another screen | **Tab** | 4.2 |
| K23 | Private chats | Automatic for shared documents and health, money or ID titles · only by hand | **Automatic, with a toggle per chat.** A Private chat is never named aloud or on the lock screen and goes only to providers that do not store prompts; a model with no such provider asks before sending | 3.6 |
| K24 | What the app opens to | Last chat · New chat after 30 min away | **New chat after 30 min away**, with "Continue *Wed 7 Oct*" as the first card | 3.6 |
| K25 | Answers on the lock screen | State only · the last answer | **State only** ("Fieldnote · Ready"); answers show once unlocked | 3.5 |
| K26 | Look and food model | The 3.5 bake-off winner · Gemini 3.8 Flash regardless | **The bake-off winner, pinned by id**; Gemini 3.1 Flash-Lite costs about a third as much if it reads as well | 3.5 |

### K2. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| The store migration touches the core loop (service, agent, queue, UI) | Medium / High | Feature flag `spine_v1` until the count check passes; one transaction before any writer; counts include attachments, citations and skipped mirrors; the untouched 3.5 backup; the export zip; **no dual-write** (it could not restore 4.0 Looks anyway); fix forward and **re-run the migration from the backup**; the half-day walk before shipping |
| **Three releases (3.7–3.9) build on today's fragile store** | Medium / Medium | Message ids in 3.6; the 2,000 trim removed in 3.5; streamed text saved once, not every 500 ms; a frozen written `chat.json` schema and a real 3.9 file as the migration's test fixture |
| **Old chats silently trimmed before 4.0** | High without the fix / High | 3.5 removes the 2,000 cap, never trims typed or pinned chats, and backs up `chat.json` once; `chat_trimmed` alerts |
| Taps do not arrive while the call mic is open, during speech, or while music plays | Medium / High | 3.5 device gate (Test A2). Fallbacks: answers on normal audio, the mic opened only to listen, notification Stop, voice "stop" |
| **A tap during a capture pauses the stream instead of arriving** (`service/Glasses.kt:44-50`) | Medium / Medium | A pause during a capture counts as cancel; "cancel then Look" only if Test A2 shows keys arrive during a live stream; the notification's Stop |
| Music takes the media buttons | High / Medium | Detect other playback; yield, and reclaim only when asked or after 10 min idle (K8); Pause taps; notification Look and Ask |
| **The glasses disconnect mid-turn and audio falls back to the phone** | Medium / Medium | Glasses mic only for glasses-started listening; `BECOMING_NOISY` and Bluetooth-disconnect handling; answers to a notification, not the phone speaker |
| Quick frame too coarse; frame latency never measured | High / Medium | On-device text check and escalation, `needs_sharper`; test 720×1280; frame numbers from 3.5 before 3.9 |
| The full shot stays slow (7.25 s p50 even on an open stream) and setup rose to 5.0 s | High / Medium | "Reading, hold still" within 1 s; WORKING ticks; silence budget; a time-boxed 1-day spike on the setup regression |
| About 1 in 5 captures fails | Medium / Medium | Retry once, cap at 20 s with a plain reason; one tap cancels; `capture_fail` tracked |
| The Look classifier picks the wrong kind | Medium / Medium | Kind spoken first; same-photo override (G5 row 2); pinned intent; no side effect without a yes; `look_override` |
| **A proposal's spoken amount differs from what is written** | Low / High | Proposals are built from the validated JSON, never the model's speech; no JSON, no proposal; `proposal{json_ok}` |
| The related-resume or hand-off rule picks the wrong chat | Low / Medium | Conservative thresholds; hand-off needs shared words; Looks never follow a topic chat; the cue names the chat; "move that" and "move all that"; the phone's Move and "Move everything since…"; `turn_moved` tunes it |
| **New default models are unmeasured** (GPT-6 Luna released 22 Sep; Gemini 3.8 Flash has mandatory reasoning and costs 2.5× 2.5 Flash) | Medium / Medium | The 3.5 bake-off on your own photos and questions picks pinned ids; targets restated for the winner; `:nitro`; fallbacks named in E4 |
| Aliases change model or price without notice | Medium / Low | Only typed-chat tiers ride aliases; glasses roles are pinned; served model on every turn; notice on a > 2× price change |
| **OpenRouter credit runs out abroad** | Medium / High | HTTP 402 as its own state; key-limit warnings under ₹300; suggest a key limit; local commands keep working |
| **A heavy typed day uses the budget the glasses need** | Medium / Medium | Budget by role: ₹30 glasses reserve; typed chat to Quick and web to "on request" at 80% |
| Stopping a Google-served stream does not stop billing | Certain / Low | Noted in the Model sheet and on Answer now; the cap still counts it |
| **Answers or chat titles overheard or seen on the lock screen** | Medium / Medium | Private chats never named aloud; state-only lock-screen notification by default; Private chats sent only to providers that do not store prompts |
| **Auto Backup silently stops above 25 MB** | High over months / High | Lean `spine.db`; search index, digests and tool results in a no-backup file; weekly size check with a warning at 20 MB; photos keyed by hash and time |
| Markdown library vs Compose BOM 2024.12.01 | Medium / Low | A version spike in 3.6; bump the BOM if needed |
| Large base64 video bodies (the OpenRouter ceiling is undocumented) | Medium / Medium | A 20 MB size budget with the encoder set explicitly (D2); streamed one-shot body; a user-initiated job; no silent re-upload |
| `JobScheduler` content triggers delayed on Nothing OS | Medium / Low | Scans at app open, glasses stop and before the review; Import now |
| **Partial photo access on Android 14+** blinds pickup | Medium / Medium | Declare `READ_MEDIA_VISUAL_USER_SELECTED`, detect partial access, show "Allow all photos" |
| ML Kit food labels weak on Indian home food; shutter photos of things you did not eat | Medium / Medium | Drafts only for clear meals at mealtimes with no faces and not on trips; the rest to "Might be food?" with nothing uploaded; drafts never kept by themselves |
| en-IN speech abroad without data | Medium / Medium | Offline preference and the offline speech pack; taps and Looks still work; "No connection for speech" when it fails |
| IFCT data licence | Low / Low | Check before the backlog item; the model estimate plus steppers is the fallback |
| Scope: about 102.5 days to 4.3, one developer | High / Medium | Each release stands alone; 3.5 and 3.6 give visible relief on asks 1, 3 and 4 within five weeks; asks 4, 2 and 5 get their core before the store change; the backlog waits for the acceptance suites |

---

## L. Key journeys, step by step

Times are from the gesture, using measured numbers (setup about 5 s, full shot about 7 s) and the targets in G3. "You hear" is the
glasses; "You see" is the phone. The journeys show the finished design (after 4.1); each release's own test is in J.

### L1. Continuing a conversation from the glasses to the phone and back

Wednesday 7 Oct, Delhi, no trip. Glasses on since 12:30.

1. **12:40, Lodhi Garden.** You double-tap at a tomb. You hear 2 pips at once. About 7 s later: "Wednesday." then "Scene. Shisha
   Gumbad, a Lodi-era tomb from around 1490. The glazed blue tiles are original in places." It is the first glasses turn today, so it
   opens the day conversation "Wed 7 Oct" (rules 1 and 6c).
2. **12:41.** Triple-tap. MIC OPEN (only once the mic is live). "Who's buried there?" It is about the Look you took a minute ago, so it
   joins the Look's conversation (rule 3). About 3 s after you stop: "No one knows for sure; probably a family of the Lodi court." The
   window opens (MIC OPEN). You say nothing; 6 s later MIC CLOSED.
3. **13:30, a café.** You tap the Fieldnote notification (the lock screen shows only "Fieldnote · Ready"). The phone opens "Wed 7
   Oct": the tomb photo card, your spoken question with its teal rail and ●●● dots, the answer.
4. You open the drawer, tap your pinned "Japan visa documents" chat, and type: "Does the bank statement need a stamp on every page?"
   It streams on Smart, with web sources. Opening that chat does **not** move the glasses.
5. **13:38.** You walk out. Triple-tap: "and how many months of statements?" You typed in "Japan visa" 8 min ago, nothing happened on
   the glasses since, and "statements" matches that chat's last lines, so the hand-off applies (rule 4). You hear: "Continuing Japan
   visa." then the answer. (Had you asked "what building is this?", nothing would match, and it would stay in "Wed 7 Oct".)
6. **13:40.** You double-tap a bookshop sign. **Looks always go to today's thread** (rule 1), so it lands in "Wed 7 Oct", and "Japan
   visa" shows one line: "Looked at: bookshop sign · Wed 7 Oct ›". You hear only the answer. "Is it open on Sundays?" 30 s later is
   about the Look, so it joins "Wed 7 Oct" too (rule 3). Nothing needs moving.
7. **Had something landed wrong,** "move that to Wednesday" or **Move** on the phone fixes one turn, and "move all that to Wednesday"
   or "Move everything since 13:38" fixes a run. The phone shows "Moved to Wed 7 Oct · Undo".
8. **16:10.** You triple-tap "what was the tomb called again?" The window has lapsed; no chat is named; rule 6c keeps you in "Wed 7
   Oct" (still today). The answer uses the tomb Look from the conversation. No new conversation was created all day except by your
   own choice.
9. **Phone → glasses, explicitly.** In "Japan visa" you tap **Continue on glasses**. You hear "Now in Japan visa." Your spoken
   questions stay there until 3 h after the tap (across a restart, never stretched by use, ending at 04:00); your Looks still go to
   today's thread, each with a link line in "Japan visa". After a gap of over 45 min, the next question says "Still in Japan visa."

### L2. Asking about a sign abroad

Tuesday 13 Oct, Kyoto, trip "Japan" day 3. A sign by a bicycle rack. No music playing.

1. You double-tap. 2 pips at once.
2. About 5.5 s: the frame arrives; the on-device check finds 5 lines of small Japanese text. You hear **"Reading, hold still"** at
   once, and WORKING ticks.
3. About 13 s: the full photo is taken on the still-open session.
4. About 15 s: "Sign, Japanese. No bicycle parking, 8 am to 8 pm. Bikes are removed; the release fee is 2,300 yen, about ₹1,311."
   It is a reading Look, so the window opens (MIC OPEN).
5. With no tap, you say: "so can I park here now?" About 3.5 s: "Yes. It's 9:10 pm, and the ban runs 8 am to 8 pm. The sign says 8:00
   to 20:00." (One call: the Look digest plus local time; no new photo.) The window opens again; "thanks" closes it.
6. **You see:** in "Japan · Day 3", the Look card with the photo, "SIGN · JAPANESE", the translation, the original text in a quote
   block, chips [Read it all] [Translate fully] [Ask a follow-up]. Trip · Today shows it as the Just-now card for 30 min.
7. **Wrong kind?** Had it said "Menu", you would say "no, just translate". It re-runs on the same photo with no new capture.
8. **Changed your mind mid-capture?** One tap during "Reading, hold still" cancels ("Cancelled"), whether the tap arrives as a key or
   pauses the camera stream.
9. **No data?** Step 4 becomes "On-device reading. No bicycle parking 8:00 to 20:00…", labelled on the phone; the full answer arrives
   when you are back online.

### L3. Logging a meal from the glasses and correcting it in Plateful

Thursday 8 Oct, home in Delhi.

1. **13:15.** You double-tap your plate. About 7.5 s: "Food. Dal tadka, two rotis and bhindi. About 520 to 680 calories." Then, once
   the JSON is in: "Log it as lunch?" and the NEEDS A YES chirp. The mic opens.
2. You say "yes, the rotis had ghee." SAVED. "Logged lunch: dal tadka, two rotis, bhindi, with ghee. 1,070 today. Say undo." The fat
   level is set to Rich, so the estimate becomes 580–740.
3. **If you had said nothing,** nothing is logged: you may only have been looking. The Look keeps a [Log meal] chip, and tonight's
   review lists it under "Might be a meal?".
4. **15:00, phone.** Plateful · Today shows "LUNCH 1:15 · Dal, two rotis, bhindi · 580–740 · glasses". Tap it.
5. Meal detail: you actually ate 3 rotis. Tap + on Roti: the total becomes 665–840 at once, with no network. The question chip "How
   much ghee on the rotis?" → [1 tsp each]. Tap **Looks right**. A light haptic tick.
6. Or by voice, within 15 min of logging: triple-tap "actually three rotis". "Updated lunch: three rotis. 1,160 today." No duplicate.
7. **18:30.** You press the glasses' own shutter at a samosa at home. With Fieldnote closed, the pickup job sees a clear snack at a
   mealtime, one photo, no faces, and makes a hatched draft.
8. **21:30** notification: "Thursday: about 1,535 kcal · 41 g protein · 1 to check" [Review] [Confirm 1 draft, +280 kcal]. You unlock
   and tap Confirm.
9. **Stop the glasses after 7 pm:** "Today: about fifteen hundred calories and forty grams of protein. One meal to check on your
   phone."

### L4. Uploading a PDF and a video to chat, and switching model

1. Chat › ✎ (new chat). + › Files › `ryokan-booking.pdf` (3 pages). The chip shows "Sends as PDF".
2. You type "What time is check-in, and is breakfast included?" The context row shows "Smart ▾ · ≈ ₹2.40". Send. "Thinking · 3 s",
   then the answer streams: "Check-in is from 3 pm; breakfast is included for both nights (page 2)." Eyebrow "GPT-6 SOL · 5.1 s ·
   ₹2.10".
3. + › Photos & videos › `nishiki-market.mp4` (0:48). The chip prepares ("Transcoding 43%"). A banner: "*GPT-6 Sol can't watch video.*
   [Use Media for this message (≈ ₹0.80)] [Remove]" (from 4.3 it also offers "Send 16 frames + transcript"). You tap **Use Media**.
   The chip now says "Sends as video". You lock the phone; the upload finishes in the background, with a progress notification.
4. "What was the snack the vendor offered at 0:30?" Answer: "Tako tamago, a candied baby octopus with a quail egg inside…" Eyebrow
   "GEMINI 3.8 FLASH · THIS MESSAGE · ₹0.78".
5. The next question goes back to Smart (the override was for one message). To move the whole chat to Media, tap the chip › Media;
   long-press the chip later to swap back.
6. Later: "In the video, what did the sign above the stall say?" The video is not re-sent. The earlier answer's digest goes along,
   and from 4.0 the model can call `reopen_attachment` to look again (shown as an action row).
7. **From another app:** in Gmail, share a PDF of a lab report › **Ask Fieldnote** › New chat (the default). It lands in the composer
   and the chat is Private (a lock icon), so the report goes only to providers that do not store prompts and its title is never
   spoken. Nothing sends until you do.

### L5. Logging a receipt

Kyoto, 21:40, after dinner at Kazehana.

1. Double-tap the bill. Frame, then "Reading, hold still", then about 15 s: "Receipt, Ramen Kazehana." Once the JSON is in, the app
   says: "2,960 yen, about ₹1,687. Log it?" NEEDS A YES.
2. "Yes." SAVED. "Logged. Today ₹6,120 of your ₹8,000 trip budget." The row stores ¥2,960, the amount you heard.
3. **You see:** Trip · Money shows the row "Ramen Kazehana · ¥2,960 · ₹1,687 · Food & drink · 21:40" with Undo in a snackbar. The
   chat turn carries [Undo] too. Because a dinner meal was logged at the same place 40 min earlier, a chip offers "Link to dinner?".
4. **Silence instead of yes:** the spend goes to Trip · Money › To confirm (1) with [Log] [Discard].
5. **Explicit way:** triple-tap "log this receipt": a full photo is taken directly ("Hold still"), it is read back ("Ramen Kazehana,
   2,960 yen, logged. Say undo.") and logged without a question. It never logs a meal (G5 row 10 comes before row 11).
6. Triple-tap "what did I spend today?" About 1 s, no model: "₹6,120 today: food ₹3,050, transport ₹1,840, entry fees ₹1,230."
7. Wrong? "Undo" within 10 min, or discard it from To confirm.

### L6. Using the app offline abroad

Fushimi Inari, no data (roaming off). The offline pack for Japan was prepared on hotel Wi-Fi.

1. Glasses on. You hear "Glasses on. Still in Japan, day three." The pill on the phone reads "Ready · offline".
2. Triple-tap: "how much is this in rupees?" at a stall. The recogniser works offline (en-IN offline pack). The kind is known, so a
   full photo is taken ("Hold still"). About 14 s: "600 yen, or 660 with tax. About ₹342 before tax, at the 13 Oct rate. On-device
   reading." No model call.
3. **14:10.** Triple-tap: "is the teahouse up the hill open now?" "Offline, saved for later." The turn keeps its time and place.
4. Double-tap a shrine gate: "Offline, saved for later." The photo and your turn show on the phone as "Queued".
5. Triple-tap "take me home": "Hotel Gion Hanare is 2.8 km north-west, about 35 minutes on foot." Local, offline.
6. Double-tap a menu board at a tea stall: "On-device reading. Matcha soft serve 500 yen, about ₹285. Warabi mochi 700 yen, about
   ₹399. No full allergy check offline." A keyword hit would add "Possible peanut."
7. Triple-tap "what did I spend today?" and "how am I doing today" both answer locally.
8. **17:30,** back on hotel Wi-Fi: WorkManager drains the queue. The shrine gate answer fills in the queued turn in "Japan · Day 3".
   The teahouse question is over 60 min old and asks about "now", so it is not spoken; a notification reads "About your 14:10
   question near Fushimi Inari · [Ask again]".

### L7. Picking up yesterday's topic ("the relevant session")

1. Monday you typed a pinned chat "Kyoto ryokan shortlist".
2. Tuesday 09:20 (window long gone), triple-tap: "which ryokan on my shortlist has a private onsen?"
3. No chat is named in full, but "ryokan" and "shortlist" match the pinned chat's title and recent lines, and it clearly leads, so
   rule 6b resumes it: "Back in Kyoto ryokan shortlist. Say 'new chat' to start fresh." Then the answer.
4. Had it not matched, the turn would land in "Japan · Day 4", and the model would still find the answer with
   `search_conversations` (an action row "Searched your chats · 1 match ›").

### L8. Music, and handing over to Meta

1. Glasses on, you start Spotify. Fieldnote says once "Taps are with your music." The pill shows "Paused · music". The notification
   keeps **Look · Ask** and adds **Resume**.
2. You pause the music with a tap, cross the road, and resume it with another tap 40 s later. The music resumes; **no photo is
   taken**, because Fieldnote does not take the taps back on its own while you might still be using them. When you are done, say
   "taps back" (or tap Resume); otherwise it reclaims after 10 min with no player active. Either way: "Taps are back."
3. At a pharmacy abroad you need a conversation: triple-tap "live translate". "Handing over to Meta AI. Say 'Hey Meta, start live
   translation'. Fieldnote comes back in 30 minutes, or from your phone's notification." Taps now reach Meta. (With no data,
   Fieldnote first warns that Meta may need data for Japanese and points to your Phrases card.)
4. Done early: tap **Resume** on the lock-screen notification. "Taps are back." At 30 min, if Meta is still using the audio,
   Fieldnote waits another 10 min instead of grabbing the taps.

---

## M. Acceptance tests per ask (how the owner verifies it on the device)

Each test is run with the phone locked in a pocket unless it says otherwise. A test passes only if every step passes. The release in
brackets is the first one the test can pass on.

### Ask 1: chat as good as ChatGPT, continuing with the glasses

| # | Test | Pass |
|---|---|---|
| 1.1 | **Continuity walk (4.0).** Start glasses. Double-tap 3 things, triple-tap 3 questions over 40 min, take one tap photo | All 7 turns in one conversation; only one spoken cue (the day name at the start); the phone shows each turn live, photo before answer |
| 1.2 | **Restart (4.0).** Mid-walk, force-stop Fieldnote from Settings › Apps and start the glasses again within 45 min; triple-tap a follow-up | "Glasses on. Still in *Wednesday*." The follow-up lands in the same conversation; "more" continues from the right word |
| 1.3 | **"Which chat" and "back to" (4.0).** Say "which chat", "new chat about train times", "back to Wednesday" | Correct spoken answers; each switch spoken once; the phone shows matching notices |
| 1.4 | **Phone hand-off (4.0).** Type in a pinned chat, walk out, triple-tap a follow-up **that shares words with it** within 10 min; then type in another chat and ask something unrelated | The related follow-up: "Continuing *X*." and the turn is in X. The unrelated one stays in today's thread, with no cue |
| 1.5 | **Next-day resume (4.0).** Ask by voice about yesterday's pinned topic using two of its words | "Back in *X*." or, if not matched, today's thread with a correct answer from "Searched your chats" |
| 1.6 | **Stop, cancel and disconnect (4.0).** Tap during a long answer; tap during "Reading, hold still"; tap while thinking; then fold the glasses in the middle of an answer | Speech stops within 0.3 s; capture and thinking cancel with no answer spoken ("Cancelled"), whether the tap arrived as a key or paused the stream; no photo is taken by the tap. Folding: speech stops, the phone speaker stays silent and no phone mic opens, the answer arrives as a notification |
| 1.7 | **Follow-up window (4.0, if the gate allows).** Ask a question, then speak a follow-up without tapping; after a sign Look, ask about it without tapping; then stay silent after the next answer; then mumble in the window | The follow-ups are answered; the silent window closes with MIC CLOSED and no words; the mumble gets "Didn't get that. Triple-tap to ask."; no window after a scene Look or while music plays |
| 1.8 | **ChatGPT checklist, phone (3.6).** New chat in 1 tap; streaming with first text ≤ 2 s; the "Thinking · n s" row and Answer now; Stop; a Markdown table; copy; edit and resend the last message; retry the last reply; a web answer with numbered sources; read aloud on glasses (4.0); search the drawer; rename; pin; delete and Undo | Every item works; retry after a logged meal does not log it twice |
| 1.9 | **The 3.5 stopgap (3.5).** Open "SIP vs FD" on the phone, lock it, go out; double-tap 3 things and triple-tap 2 questions; restart the app; ask again | Everything lands in "Glasses · <today>", none in "SIP vs FD"; no new chat appears except by your words; "Glasses on. In <weekday>." at start |
| 1.10 | **Looks never follow a topic chat (4.0).** "Continue on glasses" on *Japan visa*, then over 4 h: 3 double-taps, 2 questions about them, 1 unrelated question | The 3 Looks are in today's thread, each with a link line in *Japan visa*; the questions within the 3 h are in *Japan visa*; after 3 h a question returns to today's thread with "Back in <weekday>." |
| 1.11 | **Private (4.0).** Share a medical PDF into Fieldnote, then say "list chats" and "back to" its title on the glasses; look at the lock screen during an answer | The chat is Private; it is not read out; "back to" says "I can't find that chat"; the lock screen shows only the glasses' state |
| 1.12 | **No credit (3.6).** Use a key with a tiny credit limit until it runs out | A danger banner "OpenRouter credit is used up · Top up ›"; the glasses say so once; local commands still work; nothing retries in a loop |

### Ask 2: upload files, photos and videos

| # | Test | Pass |
|---|---|---|
| 2.1 | Attach 3 phone photos and ask a question (3.6) | Answer references all 3 |
| 2.2 | Attach a 30-page text PDF; ask about page 22 (3.8) | Correct answer citing the page; chip showed "Sends as PDF"; cost hint shown before sending |
| 2.3 | Attach a **3-minute** phone video on Smart (3.8) | "Use Media for this message" appears and works; the prepared file is ≤ 20 MB; progress shown; locking the phone does not stop it; Stop cancels mid-upload. From 4.3 the frames + transcript option also works |
| 2.4 | Attach a CSV (3.8), and a DOCX and an XLSX if Office was chosen (4.3) | Answers use their text and tables |
| 2.5 | Record a 30 s voice note (4.3) | Answer uses the transcript |
| 2.6 | Share a PDF from Gmail and a photo from WhatsApp › Ask Fieldnote (3.8) | Share sheet lands in a new chat by default; the PDF chat is Private; nothing sends by itself |
| 2.7 | Take a glasses photo from the Attach sheet, and use "+ Last glasses photo" (3.8) | Photo arrives as a chip with "Hold still" spoken; the chip adds the latest capture in one tap |
| 2.8 | Ask about the video again 5 turns later (3.8) | No re-upload (cost stays small) |

### Ask 3: select models

| # | Test | Pass |
|---|---|---|
| 3.1 | From the chat, change model in 1 tap on the chip (3.6) | The next reply's eyebrow names the new model and its ₹ |
| 3.2 | Open All models; filter "Video"; pick and star a model (3.6) | Only video models listed, with ₹ in/out per 1M and badges; no image-generation models; the chip shows the model's short name; it appears under Starred and Recent |
| 3.3 | "Make default for new chats"; open a new chat (3.6) | New chat starts on that model; the old chat keeps its own; a pick without that row never changes the default |
| 3.4 | After 20 Oct, use Look and food (3.5) | Both answer; no "model not found" or empty replies; the served model is the bake-off winner |
| 3.5 | Set the cap to ₹50 for a day and use it heavily at the desk, then on the glasses (3.6) | At 80% typed chat moves to Quick and the glasses say it once; the ₹30 glasses reserve keeps Looks working after typed chat hits the cap; banner at 100% with "Raise by ₹100"; local commands still work |
| 3.6 | Compare Fieldnote's daily spend with the key's `usage_daily` for the same UTC day (05:30–05:30 IST) (3.6) | Within ±5% |

### Ask 4: Plateful

| # | Test | Pass |
|---|---|---|
| 4.1 | Tap the **Plateful** icon on the home screen (3.7) | Opens Plateful · Today in its own window with Plateful's own nav; Back leaves to the home screen; Recents shows "Plateful" and "Fieldnote" separately |
| 4.2 | Log the usual breakfast (3.7) | 1 tap on the Usual chip in the empty breakfast slot; appears at once; Undo available |
| 4.3 | Double-tap lunch, say "yes" (3.9) | Logged within 2 s of "yes"; the items are read back; Today updates |
| 4.4 | In flight mode, open that lunch and change 2 rotis to 3 (3.7) | Totals update at once, offline |
| 4.5 | With Fieldnote closed, photograph dinner with the glasses' shutter (4.1) | Within 30 min of the photo reaching the Meta AI album, a draft appears in Review |
| 4.6 | At 21:30 tap the confirm button on the notification (4.1) | It asks you to unlock; it names the drafts and the kcal it adds; only hatched drafts are confirmed, never "Might be a meal?" or "Might be food?" items |
| 4.7 | Describe "2 idli sambar at 8 am" (3.7) and say "do roti ek katori dal" (4.1) | Correct time and items; the voice log reads the items back |
| 4.8 | Delete a meal (3.7) | Undo snackbar restores it |
| 4.9 | Open Trends after a week (4.1) | Bars, protein line, top dishes; tapping a bar opens the day |
| 4.10 | On a trip, photograph 10 market stalls with the shutter in 20 min; double-tap a friend's plate and say nothing (4.1) | Nothing is added to the totals; the stalls wait under "Might be food?" with nothing uploaded; the plate is under "Might be a meal?" |
| 4.11 | **3.5 stopgap:** triple-tap "log it" after a double-tap on your plate; then say "undo" (3.5) | Logged with the items read back; undo removes it |

### Ask 5: travel lenses

| # | Test | Pass |
|---|---|---|
| 5.1 | Double-tap a dense sign (3.9) | Kind spoken first; "Reading, hold still" within 1 s of the frame; first audio ≤ 16 s (or the target restated after the bake-off) |
| 5.2 | Double-tap a big simple sign or a scene (3.9) | First audio ≤ 8 s from a frame, no full photo |
| 5.3 | Say "no, just translate" after a wrong kind (3.9) | Re-runs on the same photo, no camera light; no open proposal is declined by it |
| 5.4 | Double-tap a receipt, stay silent (3.9) | Nothing written; the spend waits in To confirm |
| 5.5 | Double-tap a receipt, say "yes" (3.9) | Ledger row written with Undo; its amount equals the spoken amount and the JSON |
| 5.6 | In flight mode: a price tag with two prices, a board with your flight, a board without it, a sign (3.9) | Both prices said; your flight's row; "I couldn't find it on this board. Check the screen."; on-device translation; all spoken |
| 5.7 | "Menu mode", then 3 double-taps on menus (3.9) | Each Look is a menu read, announced as "Menu mode"; with a medical allergy set, no dish is called "safe" |
| 5.8 | "Live translate", then Resume from the notification (3.9) | Taps released to Meta; Resume brings them back without opening the app |
| 5.9 | On Photo detail, tap a "Look as" chip on an answered photo (3.9) | Runs at once (the 3.4 bug is gone); the line above the composer names the conversation it goes to |
| 5.10 | "I'm driving", then double-tap (3.9) | Audio-only mode: no capture, a short spoken reminder |
| 5.11 | "Log this receipt" at a till (3.9) | A spend, read back; never a meal |

---

## Appendix 1: every judge's must-fix, and where this plan handles it

| # | Must-fix (judge) | Where |
|---|---|---|
| 1 | Music vs taps: `isMusicActive` is always true while armed; detect other playback; decide what taps do when Spotify plays; test with music (J1, J2, J3) | C5, C6, K8, J 3.5 device gate |
| 2 | Look latency on verified numbers (setup 5.0 s, shot 7.25 s, reading ≈ 15 s); a progress cue within 1 s; measure the frame (J1, J3) | G3 targets, J 3.5 |
| 3 | Web search with citations in the first chat release (J1); cost from `pricing.web_search`, off for glasses by default (J2) | C1, C12, J 3.6 |
| 4 | Food usable within two weeks (J1) | F12, J 3.5 |
| 5 | Chat ≤ 1 tap from launch; every double-tap answer findable in Chat (J1) | B1, C4, J 3.5 |
| 6 | Retrieval across chats ships with the continuity engine (J1) | C1, C3 (`search_conversations`), J 4.0 |
| 7 | Hand-off to Meta pauses, with Resume (J1, J3) | G8, L8 |
| 8 | ₹200 budget, confirm around ₹20, micro-USD with no floor (J1) | E7, D4 |
| 9 | Gemini 2.5 defaults replaced in 3.5 (now by the bake-off winner as a pinned id, not an alias), any id accepted (J1), and **the parameter fix in the same release** (J2) | E4, E5, J 3.5 |
| 10 | Offline speech: prefer offline with no network; en-IN pack in the offline pack (J1, J3) | G5, G7, H1 |
| 11 | Owner decisions before 4.0 (J1) | K1 |
| 12 | `captureProgressive()` holding the session; warm off (J2, J3) | G3 |
| 13 | A child `Job` per trigger with request cancellation (J2) | C6, J 4.0 |
| 14 | Agent lanes instead of one lock; preparation outside the lock (J2) | C12 |
| 15 | Retries and edits never repeat side effects (J2) | C13 |
| 16 | Safe migration: one transaction before any writer, counts, backup and export (no downgrade); dual-write replaced by a re-runnable migration after review (J2) | C11 |
| 17 | Migrate every `Note.thread` reader including `TravelActions.find` (J2) | C11 |
| 18 | Meal quantity parsing with a fallback; de-duplicate by photo (J2) | F3 |
| 19 | Prefs migration to roles preserving explicit choices; ₹ cap; atomic spend (J2) | E6, E7 |
| 20 | Passive pickup by `JobScheduler`, not the in-process observer; "Import now" needs no manifest change (J2) | F2 |
| 21 | Follow-up: measure route time, Test A with the mic open, no pre-routing during speech (J2, J3) | C5, J 3.5 |
| 22 | Prompt caching: volatile parts last, smaller voice tool set, `session_id` (J2) | C12 |
| 23 | Streaming vs spoken chunking: sentence by sentence within the budget, rest for "more", offset persisted (J2) | C10, C12 |
| 24 | Combined 3.5 of about 5 days by early October with device baseline (J2) | J 3.5 (11 d with the bake-off and a real device gate; installable 7 Oct) |
| 25 | A 3.6 chat quick-wins release on the old store (J2) | J 3.6 |
| 26 | Immediate tap acknowledgement within 150 ms (J3) | C6 |
| 27 | Listen tone only when the mic is live (J3) | C5, J 3.5 |
| 28 | Silence budget for capture: "hold still", "still trying", 20 s cap, tap cancels (J3) | G3 |
| 29 | Investigate the setup regression (2.1 s → 5.0 s) (J3) | G3, J 3.5 |
| 30 | Device gate before building the grammar (Test A2 variants, route time, frame legibility) (J3) | J 3.5 |
| 31 | No default warm camera; no default call-route answers (J3) | D5, D8, G3 |
| 32 | Bad-data watchdog (7 s / 20 s) and low-data mode (J3) | C10, G6 |
| 33 | Follow-up noise gate; never "I didn't catch that" for silence (review: say it when you did speak); chain cap; skip with music (J3) | C5 |
| 34 | Every spoken hint names an action that works next; 1.5 s grace after speech (J3) | C6 |
| 35 | About 7 earcons, tested outdoors over both audio routes (J3) | C6 |
| 36 | Speech language: biasing, en-IN / hi-IN trial, Hinglish, foreign text as English meaning with the original on the phone (J3) | G5, F2, G2 |
| 37 | Router safety: anchored commands, written precedence, unmatched to the brain, kind first (J3) | G5 |
| 38 | Wearer safety: driving mode, no capture without a gesture, battery and heat spoken (from the SDK's errors and thermal level; it has no battery level) (J3) | G8 |

---

## Appendix 2: main code touch-points

| Area | Today | Change |
|---|---|---|
| Tap mapping, pips, cancel | `service/FieldService.kt:249-275` (`onKey`, `enqueue`), worker loop `:156` | State-aware grammar; child `Job` per trigger; pips in `onKey` |
| Media buttons, pause | `service/FieldService.kt:214-247` (silent loop, session) | Pause and reclaim; detect other playback |
| Speech, listening, earcons | `service/Voice.kt:41-58, 81, 88-94, 102-174` | Glasses mic only for glasses turns; route-ready tone; speech-aware noise gate (`onBeginningOfSpeech`); offline preference; biasing; SoundPool earcons; sentence queue |
| Follow-up and "more" | `service/FieldService.kt:367-373, 422-454` | Window after questions; persisted offset |
| Notification | `service/FieldService.kt:495-521` | `VISIBILITY_PRIVATE` with a state-only public version; conversation in the title (never a Private one); state-dependent actions; deep link |
| Capture | `service/Glasses.kt:80-190`; PAUSED handling `service/FieldService.kt:105` | `captureProgressive()`; frame quality; a pause during a capture = cancel; call route closed first |
| Local router | `service/FieldService.kt:379-411`, `service/TravelSession.kt:73-99` | Ordered phrase table (G5): conversation, Look, food, money, pause, driving; "remember" split |
| Conversation store | `data/Chat.kt` (trim at `:96`, pin on open at `:83`), `data/Models.kt:50-64`, `data/Repo.kt` | 3.5: dated glasses chat, no trim, no pin on open; 4.0: `spine.db` + `spine-cache.db`; `Note` keeps the media sidecar |
| Brain | `data/Agent.kt:40-78, 97-230, 232-259, 261-320` | Lanes; streaming; context; tools (`search_conversations`, meal edit tools; no routing tools) |
| Looks | `data/Queue.kt:21-118`, `data/Analyst.kt:71-114`, `data/TravelAnalyst.kt` | One Look call; offline kinds; drain |
| Models and spend | `data/Prefs.kt:24-44, 57-60, 132-135`, `data/Analyst.kt:20-42` | Catalogue, roles, `RequestProfile`, micro-USD |
| Food | `data/Food.kt`, `ui/FoodScreen.kt` | `plateful/` package, meal v2 |
| Travel | `ui/TripScreen.kt` (688 lines), `data/TravelActions.kt:49, 55, 181` | 3.9: new top, browse vs Make active, To confirm, all spends; hand-off pause; 4.0: `find` via full-text search; sub-tabs in the backlog |
| Chat UI | `ui/ChatScreen.kt` (189 lines) | 3.6: drawer, streaming, thinking row, retry and edit on the last turn; 4.0: turns on the store |
| Detail | `ui/DetailScreen.kt:79-165` | 3.5 fix, then "Look as" |
| Settings | `ui/GlassesScreen.kt`, `ui/SessionScreen.kt` | Glasses sheet + Settings area |
| Shell | `MainActivity.kt:89-280` | `Scaffold` (3.6), 4 tabs (4.2), drawer, deep links, share-alias routing; new `PlatefulActivity` (3.7) |
| Manifest | `AndroidManifest.xml:9-10, 30, 39-51` | "Ask Fieldnote" alias; `PlatefulActivity` with its own icon, label and task affinity, and the "Log to Plateful" alias; `READ_MEDIA_VISUAL_USER_SELECTED`; `RUN_USER_INITIATED_JOBS`; Quick Settings tile service |
| Build | `app/build.gradle.kts` (`versionCode` 340 today) | Markdown renderer, Media3 Transformer, ML Kit image labelling and face detection, WorkManager, Plex Mono; `versionCode` rises every build |

---

## N. Review log

Three adversarial reviews (C1 parity and UX, C2 edge cases, C3 feasibility and scope) raised 65 issues. Each was checked against the
3.4 code, the research files, the live OpenRouter catalogue and docs, and the glasses SDK's AAR before deciding. **Result: 59 accepted,
6 accepted in part, 0 rejected outright.** Where a fix was only partly taken, the column says which part was declined and why.

Checks that settled facts: `data/Chat.kt:96` trims to 2,000 and `:83` pins on `select`; `ui/ChatScreen.kt:99` pins on open;
`service/Voice.kt:41-58` falls back to the phone mic; `service/FieldService.kt:105` turns PAUSED into HELD, and `:495-521` sets no
lock-screen visibility; `service/TravelSession.kt:82` files every "remember " as a place note; the manifest lacks
`READ_MEDIA_VISUAL_USER_SELECTED` (targetSdk 34, `versionCode` 340); `mwdat-core` 0.9.0 `DeviceState` has only `thermalLevel`; the
catalogue prices web search at $0.01 (GPT-6, Claude) and $0.014 (Gemini), marks Gemini 3.8 Flash reasoning mandatory, lists Gemini
3.1 Flash-Lite at $0.25 / $1.50 with optional reasoning, and has 11 image-output models; OpenRouter's docs confirm HTTP 402 on no
credit, `limit_remaining` (null when unlimited) and `usage_daily` (UTC) on `/api/v1/key`, per-request `data_collection` and `zdr`,
and a 5.5% credit fee; danger `#D9574A` measures 3.81–4.44:1 on the dark surfaces.

| # | Issue | Decision | What changed |
|---|---|---|---|
| C1-1 | Placement rules contradict themselves; Looks follow a topic chat; hold never expires; digest tied to G | Accepted | C3 rewritten: Looks and tap photos always go to today's thread unless named, with a link line in a held topic chat; new "about the Look" rule; hold counts 3 h from `set_at`, ends at 04:00; global Look digest (C4); D3, C9, L1 agree; named JVM tests |
| C1-2 | Automatic hand-off misfiles unrelated questions | In part | Hand-off now needs ≥ 2 shared words with the typed chat; `turn_joined{related}`. Declined the "chat on screen at lock" alternative: typing in any chat then locking is exactly the misfile case |
| C1-3 | 3.5 stopgap pins whatever chat you open | Accepted | J 3.5: one "Glasses · <date>" chat a day; opening a chat no longer pins; Continue on glasses in the old list; `new_chat`/`switch_chat` removed entirely; local "back to"; "Glasses on. In <day>." |
| C1-4 | 2,000-message trim deletes old chats before 4.0 | Accepted | J 3.5 history safety: 20,000 / 8 MB cap, typed and pinned never trimmed, `trimmed.jsonl`, one-time backup; streamed text saved once in 3.6 |
| C1-5 | No drawer, rename, retry or edit until 4.0 | Accepted | 3.6 gets a real drawer, delete with Undo, BackHandler, Retry last and Edit last (C1, J) |
| C1-6 | Nothing between Send and the first token | Accepted | "Thinking · 12 s" row with tool step and Answer now; reasoning summaries folded; `think_ms`; screens §1 variant |
| C1-7 | Files and videos wait 16 weeks | Accepted | New 3.8 "Files and video" on today's store (PDF, text, video ≤ 3 min, glasses album, share door); rest in 4.3 (D, J) |
| C1-8 | Launch reopens the day thread, polluting it | Accepted | B1: New chat after 30 min away with a "Continue Wed 7 Oct" card; setting; K24 |
| C1-9 | Photo detail questions have no home | Accepted | C3 opening rule, G10, B3 #13, screens §7 "Goes to … · Change"; multi-select opens a New chat |
| C1-10 | Food Look silence and 48 h auto-keep log food not eaten | Accepted | F2 #1 and drafts note: no draft on silence, "Might be a meal?", strict shutter rules, expiry to "Not logged", All good for drafts only |
| C1-11 | Glasses meal logging waits months | Accepted | 3.5 "log it"/"undo" local phrases and Food-lens logging with undo (F2 #1a, F12, J) |
| C1-12 | Dates assume two tracks with one developer | Accepted | One track; 3.7 Plateful core before 4.0; all dates restated (section 0, J, K18); holidays included |
| C1-13 | Plateful icon is only an alias of Fieldnote | Accepted | `PlatefulActivity` with its own label, icon, task, nav; Back exits; used by icon, shortcuts, share door, evening notification (F1) |
| C1-14 | Spec lacks ChatGPT-parity frames | Accepted | ux-screens-4x.md frames 13–18 and the thinking variant |
| C1-15 | No follow-up window after reading Looks | Accepted | C5, D4, K7: window after sign, menu, price and board Looks; setting "Off / Reading kinds / All"; L2 uses it |
| C1-16 | Model sheet default toggle, chip label, recents, image models | Accepted | E2, E3: "Make default for new chats" row, Custom row and short-name chip, Recent and Starred, text-output only (E1) |
| C1-17 | Glasses state shown three times; nav while typing | Accepted | B1, C8: banner only with an action, place-only subline, nav hides with the keyboard; screens §1 |
| C1-18 | Attach sheet has no commit; latest photo lost its one tap | Accepted | D1: sticky "Add 3" button; "+ Last glasses photo" chip |
| C1-19 | Gear means two things; Review drawn as a pushed screen | Accepted | H1 and B1 rule (gear = Settings for this screen, ⋮ = actions); Review is a segment (F6, screens §11) |
| C1-20 | "remember that I…" becomes a place note | Accepted, earlier | Split ships in 3.5, not 4.0 (C7, G5 row 25) |
| C1-21 | No state for OpenRouter credit running out; $ shown | Accepted | C1, C10, E7: HTTP 402 state, key-limit warnings, ₹ first (merged with C2-10, C3-13) |
| C1-22 | No hands-free "think harder" | Accepted | G4 and G5 row 12: "think harder" / "look closer" as retry versions |
| C1-23 | Starting the glasses takes four steps without the tab | Accepted | B1: Start glasses shortcut and Quick Settings tile; "Look now" with glasses off starts them (4.2) |
| C1-24 | Teal means glasses, protein and success | Accepted | I2: teal only for glasses; protein `#7FA0D0`; ticks in text-2 or accent; F5, screens |
| C2-1 | Same trim blocker | Accepted | Merged with C1-4; `chat_trimmed` never fires is a pass bar |
| C2-2 | Look answers duplicated at migration | Accepted | 3.5 tags mirrors; C11 step 5 skips them; counts include skips |
| C2-3 | Migration ignores 3.6+ fields | Accepted | C11 step 4 maps model, effort, private, attachments, citations, states; frozen schema and a real 3.9 fixture |
| C2-4 | Phrase precedence misroutes receipts, "I had", overrides; no read-back | Accepted | G5 reordered (override row 2, whole-utterance yes/no, spend before meal, no bare "I had"); read-back; ASR aliases |
| C2-5 | One wrong placement contaminates an outing | In part | Hold from `set_at`, Looks to today's thread, "Move everything since…", "move all that to X", "Still in X." after gaps. Declined the per-Look chat-name prefix: Looks no longer land in topic chats unless you named one |
| C2-6 | Chat titles and answers leak via speaker, lock screen, providers | In part | Private flag (never spoken, not on lock screen, `data_collection: deny`, web off); state-only lock screen (3.5); K23, K25. Declined auto-Private for every in-app document: it would silently limit providers for ordinary files; it is automatic for shared-in documents and health, money or ID titles |
| C2-7 | Disconnect falls back to the phone mic and speaker | Accepted | C5 glasses mic only (3.5); C10 `BECOMING_NOISY` and disconnect; "Speak on phone" off for glasses turns; test 1.6 |
| C2-8 | Low-data mode on every mobile connection | Accepted | G6: roaming or Data Saver only; reason on the pill |
| C2-9 | Queued turns answered in the wrong time and place | Accepted | C10 and C11 `asked_ctx`; "About your 14:10 question"; [Ask again]; L6 |
| C2-10 | No path for 402 | Accepted | Merged with C1-21; queue pauses on 402 |
| C2-11 | Drafts auto-commit food not eaten; faces uploaded | Accepted | F2 #4 rules (≥ 0.85, mealtime, ≤ 2 in 30 min, no faces, not on trips), never auto-kept, 7-day dismissal, All good shows kcal and needs unlock; test 4.10 |
| C2-12 | Tap to cancel a capture may pause the stream instead | Accepted | C6, G3, G5: PAUSED during capture = cancel; "cancel then Look" gated on Test A2; K2 risk |
| C2-13 | Proposals spoken from free text | Accepted | G3 step 5 and G8: proposal built from validated JSON; no JSON, no proposal; `proposal{json_ok}` |
| C2-14 | 3 min video cannot fit 20 MB; upload dies in background | Accepted | D2 size budget formula; D4 user-initiated job and "Retry (27 MB)?"; test 2.3 uses 3 min |
| C2-15 | Schedule and `versionCode` downgrade | Accepted | One track, restated dates; `versionCode` rises every build (section 0, J) |
| C2-16 | Backup stops above 25 MB; restores break photos | Accepted | C11: `spine-cache.db` outside backup, weekly size check, photos keyed by hash and time, placeholders |
| C2-17 | Silent close drops real speech | Accepted | C5 speech-aware gate: "Didn't get that" only when you spoke; offline recognition up front when roaming |
| C2-18 | Offline negatives, prices and "safe" overclaim | Accepted | G7: hedged board misses, both prices, no "safe" with a medical allergy, [Show allergy card] |
| C2-19 | Hand-off ignores Meta offline and Meta still in use | Accepted | G8: offline warning and Phrases card; reclaim only if no audio or call route; 10-min extensions; length setting |
| C2-20 | Partial photo access blinds pickup | Accepted | F2 note, H1, H2: `READ_MEDIA_VISUAL_USER_SELECTED`, detection, "Allow all photos"; `album_scan{access}` |
| C2-21 | "Install cleanly" could mean uninstall | Accepted | J "Installing 3.5 safely" and K17: cert compare, `adb install -r`, stop if different; export zip in 3.5 for later installs |
| C2-22 | Danger contrast, small targets, fixed heights, TalkBack | Accepted | I2 danger `#E36B5F`; I4 48 dp touch; I6 `heightIn` and 200% check; TalkBack descriptions |
| C2-23 | Drawer edge swipe fights system Back | Accepted | B1: drawer from ≡ only; predictive back closes it |
| C3-1 | One developer booked twice | Accepted | Merged with C1-12 |
| C3-2 | Same tap-during-capture contradiction | Accepted | Merged with C2-12; notification Stop as the sure path |
| C3-3 | 3.5 swaps to unmeasured models | Accepted | 1-day bake-off on the owner's photos and questions; winners pinned; G3 targets restated (E4, E5, J, K26) |
| C3-4 | Budget: search price wrong, one cap starves the glasses, fees missing | In part | Corrected search cost; ₹30 glasses reserve; typed to Quick and web to on-request at 80%; effective ₹ per $ with the 5.5% fee and card markup. Declined defaulting typed web search to Off: web search is a ChatGPT-parity must; it stays Auto with 3 results |
| C3-5 | Asks 2 and 5 wait behind the store work | Accepted | 3.8 Files and video and 3.9 Look on today's store before 4.0 (D17, K18) |
| C3-6 | 4.0 carries work no ask needs | In part | Settings, icons, toast sweep, Glasses sheet and earcons moved to 4.2; 4.0 is 24 d; lanes gated on telemetry. Declined moving driving mode to polish: it is a safety rule that gates captures and proposals, so it ships with Look in 3.9 |
| C3-7 | Reclaiming taps 10 s after music stops turns "resume" into a photo | Accepted | C6, K8, L8: reclaim only on request or after 10 min with no player; test in A2 |
| C3-8 | Device gate too small | Accepted | 1.75 d with a toggle build; separate 1-day setup spike; bake-off added |
| C3-9 | Video bitrate contradiction | Accepted | Merged with C2-14 |
| C3-10 | Dual-write rollback cannot work | Accepted | C11 step 8: no dual-write; backup, export, re-runnable migration, fix forward; K2 |
| C3-11 | 500 ms partial saves rewrite `chat.json` | Accepted | C1 streaming row; message ids in 3.6 |
| C3-12 | No battery level in the SDK | Accepted | G8, screens §5: battery % removed; warnings from SDK errors; thermal level |
| C3-13 | `/auth/key` has no account credit; UTC day mismatch | Accepted | E7, H1, M 3.6: key limit only when set; reconcile on the UTC day |
| C3-14 | 3.5 stopgap re-offers routing after 45 min | Accepted | Merged with C1-3 |
| C3-15 | Drawer edge swipe | Accepted | Merged with C2-23 |
| C3-16 | Call mic and camera stream conflict | Accepted | C5 and G3: close the call route and dictation before any camera session; Test A2 case |
| C3-17 | Aliases can change glasses models mid-trip | Accepted | E3, E4: chat tiers on aliases, glasses roles pinned and migrated with a prompt |
| C3-18 | Releases carry scope outside the asks | In part | Trip rebuild cut from Look (browse fix, Quick looks and To confirm kept); OpenAI-direct table dropped; 4.4 became a backlog; Office behind K12. Declined trimming 4.3 to PDF, text, video and audio only: frames + transcript and trim are what make "videos" work on every model the owner picks |
