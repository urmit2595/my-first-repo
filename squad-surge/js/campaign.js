/* Operation Homeward. Authored distances, no procedural encounters or opening boost.
 * Event discriminator: `event`; a wave's `type` is its enemy archetype.
 * See design/campaign-script.md for structure and design/campaign-engine-notes.md for I1 tuning.
 */
(function () {
  "use strict";
  const chapters = [
    { id: 1, name: "Old Town", theme: "town", boss: "ogre", blurb: "Find our people. Light the first way home." },
    { id: 2, name: "Red Bridge", theme: "bridge", boss: "bulwark", blurb: "Keep a lane open. Bring both banks together." },
    { id: 3, name: "Dust Road", theme: "desert", boss: "ravager", blurb: "Read the dust. Carry the signal through." },
    { id: 4, name: "The Pier", theme: "pier", boss: "gunner", blurb: "Break the crossfire. Get the ferry families ashore." },
    { id: 5, name: "Broken Blocks", theme: "ruins", boss: "colossus", blurb: "Make room for each other. Rebuild the route." },
    { id: 6, name: "The Arena", theme: "arena", boss: "warlord", blurb: "Six districts. One last light. Everybody home." }
  ];
  const skills = {
    noWaste: "Win without wasting a power-up",
    rescueAll: "Take every rescue gate",
    perfect2: "Land two PERFECT counters",
    medicsFirst: "Defeat every medic before its patient",
    noCharge: "Lose no soldiers to chargers",
    bossClean: "Lose fewer than 20 soldiers during the boss",
    fast: "Finish without a rescue slowdown",
    noAssist: "Win without Assist"
  };
  const e = (at, event, data) => ({ at, event, ...data });
  const gate = (at, left, right, moving = false) => e(at, "gate", { left, right, ...(moving ? { moving: true } : {}) });
  const wave = (at, type, count, lane = 0, formation = "block", depth = 6) =>
    e(at, "wave", { type, count, lane, spread: 0.8, depth, formation });
  const solid = (at, kind, x, hp, extra = {}) => e(at, "solid", { kind, x, hp, ...extra });
  const drop = (at, powerup) => e(at, "drop", { powerup });
  const pair = (at, a, b) => e(at, "drop", { pair: [a, b] });
  const threat = (at, kind) => e(at, "threat", { kind });
  const hazard = (at, kind, lane, period = 3.2) => e(at, "hazard", { kind, lane, period });
  const scenery = (at, kind, lane) => e(at, "scenery", { kind, lane });
  const radio = (at, who, text) => e(at, "radio", { who, text });
  const tool = powerup => ({ powerup });
  const recruit = (kind, n) => ({ recruit: kind, n });
  const rescue = (n, cost) => ({ rescue: n, cost });
  const missions = {};
  function mission(chapter, n, title, length, start, skill, rook, mira, win, events, hp) {
    const c = chapters[chapter - 1], id = `c${chapter}m${n}`;
    missions[id] = {
      id, chapter, n, tag: n === 6 ? "boss" : n === 5 ? "hard" : "normal",
      theme: c.theme, title, seed: 730000 + chapter * 100 + n, length, start,
      brief: [["rook", rook], ["mira", mira]], win: ["rook", win],
      skill: { id: skill, text: skills[skill] }, events,
      ...(hp ? { boss: { type: c.boss, hp } } : {})
    };
    (c.missions || (c.missions = [])).push(id);
  }

  // OLD TOWN: small, separated onboarding encounters; the first brute stands alone.
  mission(1, 1, "Out of the Barracks", 220, 8, "noAssist",
    "Boots on. We start with the next street.", "Green numbers bring friends. Red ones cost them.",
    "First street clear. That's a start.", [
      gate(24, ["+", 4], ["-", 2]), wave(62, "grunt", 4, -1),
      solid(94, "weaponCase", 3.4, 24, { weapon: 1 }),
      radio(100, "mira", "That case holds a rifle. Give it a few shots."),
      gate(132, ["-", 2], ["+", 3]), wave(172, "grunt", 6, 0)
    ]);
  mission(1, 2, "One Big Problem", 230, 10, "noWaste",
    "Big boots don't own this town.", "One brute ahead. Keep a clear lane beside it.",
    "Big problem. Small dent in our day.", [
      solid(22, "weaponCase", -3.4, 28, { weapon: 1 }), drop(42, "giant"),
      radio(66, "mira", "Wait until he's close, then try GIANT."),
      wave(86, "brute", 1, 0), gate(126, ["+", 4], ["-", 2]),
      wave(164, "grunt", 8, -1), wave(202, "grunt", 6, 1)
    ]);
  mission(1, 3, "Hold That Button", 240, 14, "noWaste",
    "A tool in the belt is a plan in your pocket.", "AIRSTRIKE for the swarm. Wait for the warning.",
    "Good timing. The square belongs to everyone again.", [
      gate(24, ["+", 5], ["-", 3]), wave(58, "grunt", 10, 1),
      drop(88, "airstrike"), radio(108, "mira", "Let the swarm arrive. Then call it in."),
      threat(128, "swarm"),
      radio(174, "mira", "Shelter left: send two escorts. Or take SHIELD on the right."),
      gate(196, rescue(4, 2), tool("shield")), wave(218, "grunt", 8, -1)
    ]);
  mission(1, 4, "Chalk Arrows", 240, 18, "rescueAll",
    "Someone chalked arrows to the shelter. Follow them.", "Rescues cost an escort. We have room to help.",
    "Everyone out. Leave the arrows for the next squad.", [
      wave(40, "grunt", 5, 0), gate(78, rescue(6, 3), ["+", 3]),
      solid(116, "blockBlue", 3.4, 8, { reward: 2 }),
      radio(136, "mira", "The baker saved a whole tin of biscuits. Priorities."),
      gate(164, tool("shield"), rescue(8, 3)), wave(204, "grunt", 6, -1)
    ]);
  mission(1, 5, "Market Squeeze", 260, 18, "noWaste",
    "The market's tight. Save a tool for the crowd.", "Brutes hold the middle. The swarm follows them.",
    "Market open. Mind the broken apples.", [
      gate(22, tool("airstrike"), ["+", 6]), solid(48, "weaponCase", 3.4, 38, { weapon: 2 }),
      wave(78, "grunt", 18, -1), drop(108, "airstrike"),
      radio(136, "mira", "Swarm ahead, brute behind it. Leave yourself an exit."),
      threat(150, "swarm"), wave(150, "brute", 3, 0),
      gate(218, tool("giant"), recruit("grenadier", 2)), wave(240, "grunt", 16, 1)
    ]);
  mission(1, 6, "The First Light", 280, 20, "bossClean",
    "That tower used to call us in for supper.", "The Ogre guards it. Dodge the slam; clear his helpers.",
    "One light on. Five more, and we can all find home.", [
      radio(0, "warlord", "You want a light? My Ogre will show you stars."),
      gate(24, ["+", 8], tool("giant")), solid(50, "weaponCase", -3.4, 40, { weapon: 1 }),
      wave(86, "grunt", 20, -1), wave(128, "brute", 2, 0),
      gate(164, recruit("grenadier", 2), tool("shield")), wave(192, "grunt", 18, 1),
      pair(226, "shield", "airstrike"), radio(250, "mira", "His raised arm is your cue. Move, then hit back.")
    ], 900);

  // RED BRIDGE: shield flanks, then mortars, then a single falling lane.
  mission(2, 1, "Side Door", 270, 20, "noWaste",
    "Bridge crew's pinned down. Let's make an opening.", "A shieldbearer. Step wide or use a piercer.",
    "Front door shut. Side door worked.", [
      gate(24, recruit("piercer", 2), ["+", 5]), drop(42, "giant"),
      wave(82, "shieldbearer", 1, 0), radio(90, "mira", "Get beside that shield. The front just eats bullets."),
      wave(138, "grunt", 22, -1), gate(176, tool("airstrike"), recruit("piercer", 2)),
      wave(218, "shieldbearer", 2, 0), wave(218, "grunt", 14, 0)
    ]);
  mission(2, 2, "Rain Check", 280, 22, "noWaste",
    "Keep those bridge workers moving.", "Red circles mean mortars. SHIELD buys us breathing room.",
    "Workers across. Nobody left in the rain.", [
      gate(20, recruit("piercer", 3), ["+", 8]), wave(38, "grunt", 14, -1),
      drop(104, "shield"), radio(128, "mira", "Don't stand in a red circle. The rest of the road is yours."),
      threat(144, "mortars"), gate(216, tool("giant"), rescue(8, 3)),
      wave(248, "shieldbearer", 3, 0), wave(248, "grunt", 6, 0)
    ]);
  mission(2, 3, "Missing Planks", 290, 24, "noWaste",
    "Bridge is shedding planks. Eyes up.", "The left lane will fall. Cross to the right before it does.",
    "Still a bridge. Just a little less of one.", [
      gate(22, tool("giant"), ["+", 7]), wave(62, "shieldbearer", 4, 0),
      wave(62, "grunt", 14, 0), drop(96, "shield"), threat(136, "mortars"), gate(176, recruit("piercer", 2), ["+", 6]),
      radio(204, "mira", "Cracks on the left. Right lane stays solid."),
      hazard(226, "collapse", -1), wave(258, "grunt", 16, 0)
    ]);
  mission(2, 4, "Last Bus", 280, 26, "rescueAll",
    "A bus full of families. We're their walking escort.", "Both rescue stops are on sound decking.",
    "Last passenger counted. Even the cat.", [
      wave(38, "grunt", 16, 0), gate(82, rescue(12, 4), ["+", 6]),
      gate(128, recruit("piercer", 2), tool("giant")), wave(168, "shieldbearer", 2, 0),
      gate(210, tool("shield"), rescue(10, 4)), wave(248, "grunt", 12, -1)
    ]);
  mission(2, 5, "Steel and Rain", 300, 26, "noWaste",
    "Shields below, shells above. We've seen both.", "Take a piercer and keep the mortar counter ready.",
    "They held a wall. We kept a way through.", [
      gate(22, recruit("piercer", 3), ["+", 8]), wave(58, "grunt", 10, 1), wave(58, "shieldbearer", 9, 0),
      drop(90, "shield"), threat(130, "mortars"), wave(130, "shieldbearer", 12, -1),
      radio(174, "mira", "Right side is open. Don't let their shields pin you."),
      hazard(200, "collapse", -1), gate(208, tool("giant"), recruit("piercer", 2)),
      drop(246, "shield"), wave(268, "grunt", 10, 0), wave(268, "shieldbearer", 8, 0),
      threat(282, "mortars")
    ]);
  mission(2, 6, "A Crack in Iron", 310, 28, "bossClean",
    "The bridge tower is just past that walking wall.", "Bulwark opens its core after a slam. That's our moment.",
    "Two banks, one signal. Bring the bus over.", [
      radio(0, "warlord", "Iron Bulwark doesn't open for strays."),
      gate(24, recruit("piercer", 3), ["+", 8]), solid(52, "weaponCase", 3.4, 52, { weapon: 3 }),
      wave(90, "shieldbearer", 7, 0), wave(90, "grunt", 10, 0),
      gate(146, recruit("piercer", 2), tool("airstrike")), drop(156, "shield"), wave(184, "shieldbearer", 4, -1), threat(196, "mortars"),
      wave(220, "grunt", 10, 1), pair(256, "shield", "giant"),
      radio(280, "mira", "Let the slam pass. Shoot the glow.")
    ], 1700);

  // DUST ROAD: charger and bomber debuts are separate, isolated encounters.
  mission(3, 1, "Read the Dust", 300, 28, "noCharge",
    "Fresh tracks. Fast feet. We can read both.", "That charger crouches before it runs. Leave its lane.",
    "It ran out of road. We didn't.", [
      wave(50, "charger", 1, 0), radio(54, "mira", "Red arrow: move sideways. No tool needed."),
      gate(100, ["+", 8], ["-", 5]), wave(136, "grunt", 20, -1),
      solid(174, "weaponCase", 3.4, 56, { weapon: 1 }),
      wave(212, "charger", 4, -1, "line", 12), gate(236, recruit("piercer", 2), ["+", 6]), wave(258, "grunt", 20, 0)
    ]);
  mission(3, 2, "Short Fuse", 310, 30, "noWaste",
    "Keep a little daylight between us and trouble.", "One bomber ahead. Shoot early or step outside its ring.",
    "Fuse out. Water convoy rolling.", [
      drop(24, "airstrike"), wave(64, "bomber", 1, 0),
      radio(68, "mira", "The ring marks the blast. Both side lanes are clear."),
      gate(110, recruit("grenadier", 3), ["+", 8]), wave(150, "grunt", 34, 1),
      scenery(192, "fuelTruck", -1), wave(202, "bomber", 4, -1, "line", 12),
      wave(202, "grunt", 20, -1), wave(266, "charger", 5, 0, "line", 12)
    ]);
  mission(3, 3, "Keep One Back", 320, 30, "noCharge",
    "Tools are scarce out here. Save one for a crowd.", "Bombers and chargers share a lane. Don't share it with them.",
    "A little patience got a lot of people through.", [
      gate(24, tool("airstrike"), ["+", 9]), wave(64, "grunt", 36, 1),
      wave(112, "charger", 5, -1, "wedge", 12), wave(112, "bomber", 4, -1),
      gate(166, rescue(8, 3), recruit("grenadier", 2)),
      radio(192, "mira", "No fresh drop before this swarm. Use what you saved."),
      threat(224, "swarm"), wave(292, "grunt", 30, 0)
    ]);
  mission(3, 4, "Water for Everyone", 300, 34, "rescueAll",
    "The pump crew stayed behind. We go back for them.", "Two shelters. Enough water for both.",
    "Fill every bottle. Then fill the road with footsteps.", [
      wave(42, "grunt", 22, -1), gate(84, rescue(14, 5), ["+", 8]),
      solid(124, "weaponCase", 3.4, 46, { weapon: 2 }),
      wave(166, "charger", 3, 0, "line", 12), gate(212, tool("shield"), rescue(12, 5)),
      wave(256, "grunt", 20, 1)
    ]);
  mission(3, 5, "Fuse Run", 330, 32, "noCharge",
    "Fast feet and short fuses. Make them chase empty road.", "The centre is clear when the left pack rushes.",
    "Convoy safe. Those tracks lead all the way to the tower.", [
      gate(24, recruit("grenadier", 4), ["+", 10]), wave(66, "grunt", 40, 1),
      scenery(106, "fuelTruck", -1), wave(118, "charger", 7, -1, "wedge", 14),
      wave(118, "bomber", 6, -1, "line", 12), gate(174, tool("airstrike"), recruit("grenadier", 3)),
      wave(218, "charger", 6, 1, "line", 12), wave(218, "bomber", 5, 1),
      wave(278, "grunt", 34, 0), wave(278, "shieldbearer", 3, 0)
    ]);
  mission(3, 6, "The Long Sidestep", 340, 34, "noCharge",
    "The tower's buried in dust. We'll shake it clean.", "Ravager charges twice when hurt. Keep reading the arrows.",
    "Third light. The water trucks can see us now.", [
      radio(0, "warlord", "My Ravager will grind your little road to sand."),
      gate(24, ["+", 10], recruit("grenadier", 3)), solid(52, "weaponCase", -3.4, 64, { weapon: 3 }),
      wave(94, "grunt", 38, 1), wave(142, "charger", 7, 0, "line", 14),
      gate(190, tool("giant"), recruit("piercer", 3)), wave(228, "bomber", 6, -1, "line", 12),
      wave(228, "grunt", 28, -1), drop(282, "shield"),
      radio(310, "mira", "One arrow, then another. Move twice; don't drift back.")
    ], 2500);

  // THE PIER: rifleman alone, medic alone, then patients and crossfire decisions.
  mission(4, 1, "Red Lines", 330, 34, "noWaste",
    "The ferry's waiting. Clear its landing.", "A rifleman paints its shot first. Step off the red line.",
    "Landing clear. Tell the ferry to come in slow.", [
      gate(22, recruit("defender", 3), ["+", 8]), wave(62, "rifleman", 1, -1),
      radio(66, "mira", "The laser follows your lane. Step off the red line."),
      wave(120, "grunt", 42, 0), drop(160, "shield"),
      wave(200, "rifleman", 6, 1, "line", 12), wave(200, "grunt", 24, 1),
      gate(252, recruit("grenadier", 3), tool("giant")), wave(292, "charger", 5, -1, "line", 12)
    ]);
  mission(4, 2, "Cut the Thread", 340, 36, "medicsFirst",
    "That glow is keeping their heavies on their feet.", "First, spot the medic. Then follow its tether to the patient.",
    "Their line broke. Ours is still moving.", [
      wave(46, "medic", 1, -1), radio(50, "mira", "That's the healer. Learn its coat before the crowd arrives."),
      gate(94, recruit("piercer", 3), ["+", 10]),
      wave(140, "medic", 2, -1), wave(140, "brute", 4, 0),
      wave(188, "grunt", 40, 1), solid(228, "weaponCase", -3.4, 68, { weapon: 1 }),
      wave(276, "rifleman", 6, 1), wave(276, "grunt", 34, 1)
    ]);
  mission(4, 3, "Double or Duck", 350, 36, "noWaste",
    "Big numbers can come with a red line attached.", "Left doubles us under fire. Right adds twenty in the clear.",
    "A good choice is one your squad can walk away from.", [
      gate(24, recruit("defender", 4), tool("shield")), wave(68, "grunt", 42, 0),
      radio(100, "mira", "Riflemen guard the doubler. The plus side is the safe gain."),
      wave(126, "rifleman", 6, -1, "line", 12), gate(132, ["x", 2], ["+", 20]),
      wave(188, "medic", 3, -1), wave(188, "brute", 4, 0),
      gate(238, tool("airstrike"), rescue(8, 4)),
      wave(282, "bomber", 5, 1), wave(282, "grunt", 32, 1)
    ]);
  mission(4, 4, "Ferry Tickets", 330, 40, "rescueAll",
    "No tickets today. Everybody gets a place.", "The dockhands need escorts at both gangways.",
    "Ferry empty. Safe shore full. That's how we like it.", [
      wave(40, "grunt", 28, 0), gate(86, rescue(18, 6), ["+", 9]),
      gate(130, recruit("defender", 3), tool("shield")), wave(176, "rifleman", 4, -1),
      gate(224, tool("giant"), rescue(16, 6)), wave(274, "grunt", 26, 1)
    ]);
  mission(4, 5, "Covering Fire", 360, 38, "medicsFirst",
    "Their shooters cover the healers. Break that arrangement.", "Medics left, rifles right. Keep the centre as your exit.",
    "No more tethers. No more families pinned on the docks.", [
      gate(24, recruit("defender", 4), ["+", 12]), wave(66, "grunt", 44, 0),
      wave(114, "medic", 3, -1), wave(114, "brute", 5, -1),
      wave(114, "rifleman", 8, 1, "line", 12),
      gate(174, tool("shield"), recruit("piercer", 4)),
      wave(222, "medic", 3, -1), wave(222, "brute", 5, -1),
      wave(222, "rifleman", 8, 1, "line", 12),
      gate(276, recruit("grenadier", 4), tool("airstrike")), wave(316, "grunt", 44, 0)
    ]);
  mission(4, 6, "Harbor Lights", 370, 40, "bossClean",
    "That tower should guide boats, not aim guns.", "Gunner marks its barrage lanes. Find the unmarked waterline.",
    "Four lights. Every boat in the bay just answered.", [
      radio(0, "warlord", "My Harbor Gunner will turn your ferry into driftwood."),
      gate(24, recruit("defender", 5), ["+", 12]), solid(54, "weaponCase", 3.4, 76, { weapon: 3 }),
      wave(100, "rifleman", 8, -1), wave(100, "grunt", 42, -1),
      wave(158, "medic", 3, -1), wave(158, "brute", 5, 0),
      gate(212, tool("airstrike"), recruit("grenadier", 4)), wave(252, "grunt", 42, 1),
      pair(306, "shield", "airstrike"), radio(338, "mira", "Step out of the barrage. Clear the rifles when they land.")
    ], 3400);

  // BROKEN BLOCKS: splitter alone; machinery is always confined to one lane.
  mission(5, 1, "Room to Breathe", 350, 40, "noWaste",
    "Our street's under the rubble. We'll find it.", "That splitter breaks into three. Leave space for the little ones.",
    "One clear street. Plenty of room to share it.", [
      gate(22, recruit("grenadier", 4), ["+", 10]), drop(40, "airstrike"),
      wave(80, "splitter", 1, 0), radio(84, "mira", "Three minis after the split. Keep firing, keep room."),
      wave(138, "grunt", 46, -1), gate(184, tool("airstrike"), recruit("piercer", 3)),
      wave(228, "splitter", 8, 1, "line", 12), wave(228, "grunt", 30, 1),
      wave(302, "shieldbearer", 5, 0)
    ]);
  mission(5, 2, "Through the Rubble", 360, 42, "perfect2",
    "One crowd, one wall. Bring the right answers.", "AIRSTRIKE for the swarm. GIANT for the barricade.",
    "Road open. The builders can bring their carts.", [
      gate(22, recruit("grenadier", 4), ["+", 10]), wave(58, "grunt", 28, -1),
      drop(88, "airstrike"), threat(128, "swarm"),
      wave(192, "splitter", 9, 0, "line", 12), drop(228, "giant"),
      radio(250, "mira", "Wall ahead. GIANT breaks it; the side gap still works."),
      threat(268, "barricade"), wave(336, "grunt", 20, 1)
    ]);
  mission(5, 3, "A Better Way", 370, 42, "fast",
    "We can go around. Or make a door.", "Shoot the shortcut wall to skip the crusher. Right lane is clear too.",
    "New door. Neighbours will appreciate that.", [
      gate(20, recruit("grenadier", 4), ["+", 12]), wave(40, "grunt", 28, -1),
      scenery(122, "shortcut", -1), hazard(162, "crusher", -1, 3.6),
      wave(206, "splitter", 9, 0, "line", 14),
      gate(244, rescue(10, 5), ["+", 10]),
      radio(268, "mira", "Saw on the right. Left and centre stay open."),
      hazard(292, "saw", 1, 3.4), wave(330, "grunt", 10, 0), wave(330, "brute", 1, 0)
    ]);
  mission(5, 4, "Names on the Wall", 350, 46, "rescueAll",
    "They wrote every missing name here. Let's cross some off.", "Two shelters answered. Both need an escort out.",
    "Those aren't missing names anymore. They're our neighbours.", [
      gate(26, recruit("grenadier", 3), tool("airstrike")), wave(68, "grunt", 30, -1),
      gate(112, rescue(20, 7), ["+", 10]), wave(164, "splitter", 5, 0),
      gate(218, tool("giant"), rescue(18, 7)), wave(272, "grunt", 30, 1),
      solid(312, "blockBlue", -3.4, 16, { reward: 3 })
    ]);
  mission(5, 5, "Moving Parts", 380, 44, "noWaste",
    "Keep the minis away from the machinery.", "The crusher takes the left. Fight the splitters from the right.",
    "Machinery stopped. People moving. Good trade.", [
      gate(22, recruit("grenadier", 5), ["+", 12]), wave(62, "grunt", 18, 0), wave(62, "splitter", 4, 0),
      scenery(104, "shortcut", -1), hazard(144, "crusher", -1, 3),
      wave(144, "splitter", 12, 0, "line", 14),
      gate(202, tool("airstrike"), recruit("piercer", 4)), hazard(250, "saw", 1, 3.2),
      wave(250, "splitter", 32, 0, "line", 14), drop(282, "giant"), threat(322, "barricade"),
      wave(346, "splitter", 14, 0)
    ]);
  mission(5, 6, "Two Halves, One Plan", 390, 46, "bossClean",
    "Colossus is standing in our front garden.", "It splits at half strength. Save some splash for both halves.",
    "Five towers lit. I can see our old roof from here.", [
      radio(0, "warlord", "Break my Colossus and you'll only have twice the trouble."),
      gate(24, recruit("grenadier", 5), ["+", 12]), solid(54, "weaponCase", 0, 36, { weapon: 4 }),
      wave(100, "splitter", 14, 0, "line", 14), wave(100, "grunt", 16, 0),
      drop(144, "giant"), threat(184, "barricade"), gate(210, tool("airstrike"), recruit("defender", 4)),
      wave(254, "splitter", 14, 0),
      pair(324, "airstrike", "giant"), radio(356, "mira", "Two halves, same rule: leave yourself space.")
    ], 4600);

  // THE ARENA: recall each lesson, then use it with a second learned pressure.
  mission(6, 1, "Bring What We Know", 380, 46, "perfect2",
    "Every district taught us something. Bring it all.", "Two threats. Two tools. You know when to use them.",
    "They built an arena. We found a road through it.", [
      gate(22, recruit("piercer", 4), ["+", 12]), wave(60, "shieldbearer", 8, -1),
      wave(60, "grunt", 48, -1), drop(98, "shield"), threat(138, "mortars"),
      wave(208, "charger", 8, 0, "line", 14), drop(244, "airstrike"),
      threat(284, "swarm"), wave(352, "grunt", 42, 1)
    ]);
  mission(6, 2, "Pick Your Ground", 390, 46, "noCharge",
    "Same tricks. New floor. Keep your feet thinking.", "Stay clear of the crusher, then read the rush lanes.",
    "Good feet beat a bad floor.", [
      gate(22, recruit("grenadier", 5), ["+", 12]), wave(62, "grunt", 32, -1),
      scenery(102, "shortcut", 1), hazard(142, "crusher", 1, 3.2),
      wave(142, "splitter", 9, 0, "line", 14),
      gate(200, tool("shield"), recruit("defender", 4)),
      wave(246, "charger", 6, -1, "line", 14), wave(246, "bomber", 6, -1),
      wave(322, "rifleman", 6, 1), wave(322, "grunt", 28, 1)
    ]);
  mission(6, 3, "The Price of Plenty", 400, 48, "medicsFirst",
    "He's offering easy numbers. Read the fine print.", "Left doubles us under rifles. Right gives twenty safely.",
    "We kept our people. He can keep his promises.", [
      gate(24, tool("shield"), recruit("defender", 5)), wave(68, "grunt", 46, 0),
      wave(118, "rifleman", 7, -1, "line", 14), gate(124, ["x", 2], ["+", 20]),
      wave(184, "medic", 4, -1), wave(184, "brute", 6, 0),
      scenery(234, "fuelTruck", 1), wave(246, "splitter", 10, 1, "line", 14),
      wave(246, "bomber", 8, 1), gate(304, tool("airstrike"), rescue(10, 5)),
      wave(350, "shieldbearer", 6, 0), wave(350, "grunt", 38, 0)
    ]);
  mission(6, 4, "Leave Nobody", 380, 50, "rescueAll",
    "Last holding yard. Nobody spends another night here.", "Three groups waiting. The gate crews can escort them.",
    "Every name answered. Now we finish this.", [
      gate(24, recruit("grenadier", 4), tool("airstrike")), wave(66, "grunt", 34, 0),
      gate(108, rescue(22, 6), ["+", 10]), wave(156, "splitter", 7, -1),
      gate(200, tool("shield"), rescue(18, 6)), wave(248, "rifleman", 5, 1),
      gate(292, rescue(16, 6), recruit("defender", 3)), wave(336, "grunt", 32, 0)
    ]);
  mission(6, 5, "All the Way Through", 410, 48, "medicsFirst",
    "They've saved their hardest road for last.", "Pick off healers. Keep one lane clear when the floor bites.",
    "Road clear. Six districts are right behind us.", [
      gate(22, recruit("defender", 5), recruit("grenadier", 5)),
      wave(66, "medic", 4, -1), wave(66, "brute", 6, -1),
      wave(66, "rifleman", 9, 1, "line", 14),
      gate(126, tool("airstrike"), ["+", 14]),
      scenery(166, "shortcut", -1), hazard(206, "crusher", -1, 3),
      wave(206, "splitter", 14, 0, "line", 14), wave(206, "bomber", 8, 0),
      gate(266, recruit("piercer", 5), tool("giant")), hazard(310, "saw", 1, 3),
      wave(310, "charger", 8, 0, "line", 14), wave(310, "shieldbearer", 8, 0),
      wave(370, "grunt", 66, -1)
    ]);
  mission(6, 6, "Operation Homeward", 420, 50, "bossClean",
    "There's our last light. Let's bring it home.", "Slams, rushes, barrages. Read each warning. Keep an exit.",
    "All six lights. Kettle on, Mira. We're home.", [
      radio(0, "warlord", "I built these walls to keep you apart. You will stay apart!"),
      gate(24, recruit("piercer", 5), recruit("grenadier", 5)),
      solid(54, "weaponCase", -3.4, 92, { weapon: 3 }),
      wave(100, "shieldbearer", 8, 0), wave(100, "grunt", 54, 0),
      wave(156, "medic", 4, -1), wave(156, "brute", 6, 0),
      gate(212, recruit("defender", 5), ["+", 14]),
      wave(256, "charger", 8, 1, "line", 14), wave(256, "bomber", 8, 1),
      wave(306, "splitter", 10, -1, "line", 12), pair(352, "shield", "airstrike"),
      radio(386, "mira", "All five towers answering. Nobody's alone anymore.")
    ], 6200);

  const keepPct = m => ({ normal: 65, hard: 50, boss: 45 }[m?.tag] ?? 65);
  window.Campaign = { version: 1, chapters, missions, keepPct };
})();
