/* Plain data module for Level 3 (The Mirror: Presentation Day). No logic, no classes, no hardcoded team names.
   Numbers and flavor copy follow Hannah Ziegler's reference implementation (commit cdf3eff). */

const MirrorData = {
  // Four rack cable ports; machines are bound to the live teams at run time.
  ports: ["HDMI", "USB-C", "AirLink", "VGA"],

  // Six shared-drive files; only the client-signed v3 deck is valid.
  files: [
    { name: "MEDLINE_deck_v1_draft.pptx", correct: false },
    { name: "MEDLINE_deck_v2_client_comments.pptx", correct: false },
    { name: "MEDLINE_deck_v3_CLIENT_SIGNED.pptx", correct: true },
    { name: "MEDLINE_budget_v3.xlsx", correct: false },
    { name: "team_retro_cat_video.mp4", correct: false },
    { name: "DO_NOT_OPEN.exe", correct: false },
  ],

  // Three Medline rapid-fire Q&A items, copied verbatim from cdf3eff.
  qaItems: [
    {
      question: "The client asks: \u201cSo what is the difference between an Incident and a Problem?\u201d In the dry run that answer was muddy. What do you do?",
      options: [
        "Read the definition off the tablet, word for word.",
        "Give a one-line plain-English answer, then a real example from the Medline data.",
        "Say you will follow up by email and move on.",
      ],
      correctIndex: 1,
      why: "Plain language plus a real example is what landed with Medline.",
    },
    {
      question: "A teammate freezes mid-answer and the room goes quiet. What is your move?",
      options: [
        "Step in with one sentence that hands them an easy next line.",
        "Wait it out. They will find their place.",
        "Take over the rest of the answer yourself.",
      ],
      correctIndex: 0,
      why: "A quiet hand-off keeps them in the presentation and keeps the room with you.",
    },
    {
      question: "Medline leans in: \u201cYour timeline slipped twice already. Why should we trust the new date?\u201d",
      options: [
        "Repeat the new date, louder, and move on.",
        "Own the slips in one sentence, then show the two guardrails that hold the date.",
        "Blame the vendor and promise to escalate.",
      ],
      correctIndex: 1,
      why: "Owning the miss and showing the guardrails is what rebuilt trust in the dry run.",
    },
  ],

  // Canonical order of the 5 sequential Setup Crew steps.
  setupSteps: ["cables", "sound", "mic", "deck", "qa"],

  // Sequential step split by Setup Crew player count (1 to 3 slots).
  setupSplits: {
    1: [["cables", "sound", "mic", "deck", "qa"]],
    2: [["cables", "sound", "mic"], ["deck", "qa"]],
    3: [["cables", "sound"], ["mic", "deck"], ["qa"]],
  },

  timers: {
    tickMs: 250,          // screen update interval in milliseconds (4 ticks per second)
    lobbySeconds: 30,     // lobby doors-open countdown duration in seconds
    lobbyTicks: 120,      // lobby doors-open countdown duration in 250ms ticks
    revealSeconds: 1,     // CREW LOCKED reveal pause duration in seconds
    revealTicks: 4,       // CREW LOCKED reveal pause duration in 250ms ticks
    showtimeSeconds: 75,  // showtime timer duration in seconds (also denominator for base attention and Hannah's baseBoost)
  },

  scoring: {
    attentionMin: 0,      // minimum audience attention (0 ends the trial with score 0)
    attentionMax: 100,    // maximum/full audience attention (also top percentage in Hannah's baseBoost: 100 - secondsLeft / 75 * 100)
    maxScore: 7,          // maximum Level 3 base trial score (0 to 7)
    maxSetupCrew: 3,      // maximum active players dealt to Setup Crew
  },

  lobby: {
    signalBandWidth: 14,      // width of the green signal-grab target band out of 100
    signalZoneMin: 10,        // minimum left offset for the green target band
    signalZonePadding: 20,    // combined left/right margin keeping the green band off both edges
    signalStartSpeedMin: 7,   // minimum starting sweep speed per tick
    signalStartSpeedRange: 4, // random speed spread above minimum (7 to 10)
    signalMissSpeedUp: 2,     // speed added to a player's tile on each missed grab
    signalMaxSpeed: 16,       // maximum sweep speed per tick after misses
    botConnectMinSeconds: 3,  // earliest seconds after lobby start a bot connects
    botConnectMaxSeconds: 15, // latest seconds after lobby start a bot connects
  },

  cables: {
    travelTicks: 11,     // ticks a cable slides on the belt before reaching the plug frame (2.75s)
    hitWindowTicks: 2,   // +/- tick window around the plug frame for a valid cable plug
    spawnGapInitial: 6,  // ticks between cable spawns while 0 machines are connected
    spawnGapMid: 5,      // ticks between cable spawns after 1 or 2 machines connect
    spawnGapFast: 4,     // ticks between cable spawns after 3 or more machines connect
    wrongPenalty: 3,     // attention lost on a wrong machine click (spark)
  },

  sound: {
    start: 45,                    // starting sound level and drift rest point
    min: 0,                       // minimum sound meter value
    max: 110,                     // maximum sound meter value
    greenMin: 70,                 // lower bound of the green sound hold zone
    greenMax: 85,                 // upper bound of the green sound hold zone
    holdSeconds: 3,               // consecutive seconds in the green zone required to lock sound
    holdTicks: 12,                // consecutive ticks in the green zone required to lock sound (3.0s)
    feedbackAt: 100,              // sound level that triggers feedback reset and penalty
    feedbackPenalty: 4,           // attention lost when sound hits feedback
    controls: [-10, 5, 10],       // mixer gain control buttons
    driftStep: 2,                 // per-tick drift step back toward the starting level
    jitterHalf: 1.7,              // half-range of random per-tick sound jitter
    spikeInitialMinTicks: 12,     // minimum ticks before the first crowd spike (3.0s)
    spikeInitialRangeTicks: 6,    // random tick spread for the first crowd spike (12 to 17 ticks)
    spikeIntervalMinTicks: 12,    // minimum ticks between later crowd spikes (3.0s)
    spikeIntervalRangeTicks: 9,   // random tick spread between later crowd spikes (12 to 20 ticks)
    spikeBoostMin: 8,             // minimum level jump when the crowd whoops
    spikeBoostRange: 10,          // random spread added to a crowd spike (+8 to +17)
  },

  mic: {
    count: 4,                // number of mic buttons (MIC 1 to MIC 4)
    roundLengths: [3, 4, 5], // sequence lengths across the 3 mic memory rounds
    flashRound1Ticks: 9,     // ticks the sequence flashes on round 1 (2.25s)
    flashBaseTicks: 6,       // base ticks added to sequence length on later or retry flashes
    wrongPenalty: 4,         // attention lost on a wrong mic tap
  },

  deck: {
    reshuffleTicks: 8,       // ticks between automatic drive reshuffles (2.0s)
    wrongReshuffleTicks: 2,  // ticks before spite reshuffle after clicking a wrong file (0.5s)
    wrongPenalty: 6,         // attention lost on clicking a wrong file
  },

  qa: {
    countdownTicks: 29, // ticks allowed per Q&A question before timeout (7.25s)
    lowWarningTicks: 8, // ticks left when the Q&A bar switches to low warning
    rightRecover: 5,    // maximum lost attention penalty points restored by a right answer
    wrongPenalty: 5,    // attention lost on a wrong answer or timeout
  },

  dance: {
    arrows: ["left", "up", "right", "down"],                                   // four rhythm lane arrow directions
    arrowGlyphs: { left: "\u2190", up: "\u2191", right: "\u2192", down: "\u2193" }, // glyphs for rhythm notes and pad buttons
    boostCap: 45,            // maximum attention boost per dancer
    travelTicks: 10,         // ticks a note slides across the lane toward the hit frame (2.5s)
    perfectWindowTicks: 1,   // inner hit tolerance (+/- 1 tick) for PERFECT
    goodWindowTicks: 2,      // outer hit tolerance (+/- 2 ticks) for good
    perfectBoost: 3,         // dance boost gained on a PERFECT hit
    goodBoost: 2,            // dance boost gained on a good hit
    strayPenalty: 1,         // attention penalty on an off-beat stray press
    missPenalty: 2,          // attention penalty on a missed note
    gapInitialTicks: 6,      // ticks between spawned notes before tempo ramps
    gapMidTicks: 5,          // ticks between spawned notes after tempoRampMidNotes
    gapFastTicks: 4,         // ticks between spawned notes after tempoRampFastNotes
    tempoRampMidNotes: 20,   // spawned note count threshold for the first tempo speed-up
    tempoRampFastNotes: 40,  // spawned note count threshold for the second tempo speed-up
    maxConsecutiveSame: 2,   // maximum identical arrows allowed in a row
    stumbleTicks: 3,         // ticks the dancer avatar displays stumble after a miss or stray
    choreoLength: 64,        // number of moves in a choreography sequence
  },

  bots: {
    // Set milestone timings (ticks/seconds into showtime) when a bot setup crew advances.
    setupMilestones: [
      { step: "cables", ticks: 16, seconds: 4, label: "connected every machine" },
      { step: "sound", ticks: 40, seconds: 10, label: "locked the house sound" },
      { step: "mic", ticks: 64, seconds: 16, label: "cleared the mic check" },
      { step: "deck", ticks: 88, seconds: 22, label: "pulled up the signed deck" },
      { step: "qa", ticks: 112, seconds: 28, label: "survived the Q&A" },
      { step: "wrapUp", ticks: 136, seconds: 34, label: "wrapped up" },
    ],
    setupHiccupChance: 0.3, // 30% chance of a hiccup on each bot setup step
    setupHiccupPenalty: 3,  // attention lost when a bot setup step hits a hiccup
    danceBoostStep: 1,      // boost added each bot dancer interval
    danceMinSeconds: 1.5,   // fastest bot dancer +1 boost interval in seconds (6 ticks)
    danceMaxSeconds: 2.5,   // slowest bot dancer +1 boost interval in seconds (10 ticks)
  },

  flavor: {
    danceMoves: [
      "does the spreadsheet shuffle",
      "hits the debugger dab",
      "moonwalks past the projector",
      "does the merge-conflict wiggle",
      "spins like a loading icon",
    ],
    glitchReasons: [
      "a wifi hiccup",
      "a frozen screen",
      "a cat on the keyboard",
      "a VPN drop",
      "a headset firmware update",
      "an untimely system update",
    ],
    statusMessages: {
      lobbyJoined: "{name} is in the call.",
      lobbyAllIn: "Everyone is in. {setupCount} on setup, {danceCount} on dance. Showtime.",
      lobbyMiss: "{name} lost the signal ({reason}). The sweep comes back faster.",
      doorsFailed: "The doors closed with you still outside. The client presented to an empty chair.",
      doorsPartial: "Doors closed. {lost} never made it in. {setupCount} on setup, {danceCount} on dance.",
      doorsAllIn: "Everyone made it. {setupCount} on setup, {danceCount} on dance.",
      dancePerfect: "PERFECT. the crowd is with you",
      danceGood: "good. {move}",
      danceStray: "off beat. the crowd winces (attention \u22121)",
      danceMiss: "a missed note. the crowd dips (attention \u22122)",
      danceBotMove: "{name} {move}",
      botSetupStep: "setup crew: {label}",
      botSetupHiccup: "setup crew: {label}, after a hiccup (attention \u22123)",
      cableConnected: "{machine} is on the projector. {left} to go.",
      cableAllConnected: "{machine} is on the projector. Every machine is live. Sound check next.",
      cableSpark: "Spark. {machine} takes {port} and there is no {port} cable in the frame (attention \u22123).",
      cableMissed: "the {port} cable slid past the frame. back on the belt.",
      soundSpike: "The crowd whoops and the level jumps. Pull it back.",
      soundFeedback: "FEEDBACK. The front row covers its ears. Back to 45 (attention \u22124).",
      soundLocked: "Steady. Sound locked at {level}. Mic check, round 1 of 3.",
      micTapOk: "Mic {mic} checks out. {left} to go.",
      micNextRound: "Round {round} of 3. Watch the flash.",
      micDone: "Mic check complete. Every channel is clean. Grab the deck.",
      micWrong: "Feedback squeal (attention \u22124). New order for round {round}, watch closely.",
      deckGrabbed: "The deck is up. Medline is watching. Questions coming in hot.",
      deckWrong: "{file} is not the deck. The drive reshuffles out of spite (attention \u22126).",
      qaRight: "Land it. {why}",
      qaWrong: "The room cools. {why}",
      qaTimeout: "You hesitate and the room cools (attention \u22125).",
    },
  },
};

export { MirrorData };
