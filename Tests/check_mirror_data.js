/* Data-shape test for Level 3 (The Mirror: Presentation Day) data module.
   Checks: plain data only, 4 cable ports, 6 deck files (1 correct), 3 Q&A items (1 correct each),
   setup split table for 1-3 players covering all 5 steps once each, timing/penalty/boost numbers,
   flavor strings, and zero hardcoded team names anywhere in the module or source file.
   Run from the repo folder:  node Tests/check_mirror_data.js */
const fs = require("fs");
const path = require("path");
const EP = require("../rules/index.js");

let pass = 0, fail = 0;
function expect(label, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + label + (detail !== undefined ? "  -> " + detail : ""));
  ok ? pass++ : fail++;
}

function hasNoFunctions(val) {
  if (typeof val === "function") return false;
  if (Array.isArray(val)) return val.every(hasNoFunctions);
  if (val && typeof val === "object") return Object.values(val).every(hasNoFunctions);
  return true;
}

const d = EP.MirrorData;
expect("MirrorData exists as plain object", Boolean(d && typeof d === "object"));
expect("MirrorData contains only plain data (no functions)", Boolean(d && hasNoFunctions(d)));

if (d) {
  expect("Exactly 4 cable ports", Array.isArray(d.ports) && d.ports.length === 4, d.ports && d.ports.join(", "));
  expect(
    "Ports match HDMI, USB-C, AirLink, VGA",
    JSON.stringify(d.ports) === JSON.stringify(["HDMI", "USB-C", "AirLink", "VGA"]),
  );

  expect("Exactly 6 deck files", Array.isArray(d.files) && d.files.length === 6, d.files && d.files.length);
  const filesValid = (d.files || []).every(f => typeof f.name === "string" && f.name.length > 0 && typeof f.correct === "boolean");
  expect("Every deck file has name and boolean correct flag", filesValid);
  const correctFiles = (d.files || []).filter(f => f.correct);
  expect(
    "Exactly 1 correct deck file (MEDLINE_deck_v3_CLIENT_SIGNED.pptx)",
    correctFiles.length === 1 && correctFiles[0].name === "MEDLINE_deck_v3_CLIENT_SIGNED.pptx",
    correctFiles.map(f => f.name).join(", "),
  );

  expect("Exactly 3 Medline Q&A items", Array.isArray(d.qaItems) && d.qaItems.length === 3, d.qaItems && d.qaItems.length);
  const qaValid = Array.isArray(d.qaItems) && d.qaItems.every(item =>
    typeof item.question === "string" && item.question.length > 0
    && Array.isArray(item.options) && item.options.length === 3
    && item.options.every(opt => typeof opt === "string" && opt.length > 0)
    && Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex < item.options.length
    && typeof item.why === "string" && item.why.length > 0
  );
  expect("Each Q&A has question, 3 options, single valid correctIndex, and why", qaValid);

  expect(
    "setupSteps lists all 5 steps in order",
    JSON.stringify(d.setupSteps) === JSON.stringify(["cables", "sound", "mic", "deck", "qa"]),
    d.setupSteps && d.setupSteps.join(", "),
  );

  const splitKeys = d.setupSplits ? Object.keys(d.setupSplits).sort() : [];
  expect("setupSplits covers 1, 2, and 3 players", JSON.stringify(splitKeys) === JSON.stringify(["1", "2", "3"]), splitKeys.join(", "));
  const splitsValid = ["1", "2", "3"].every(k => {
    const groups = d.setupSplits && d.setupSplits[k];
    if (!Array.isArray(groups) || groups.length !== Number(k)) return false;
    if (groups.some(g => !Array.isArray(g) || g.length === 0)) return false;
    const flat = groups.flat();
    return flat.length === 5 && JSON.stringify(flat) === JSON.stringify(d.setupSteps);
  });
  expect("Each split covers all 5 steps exactly once in order", splitsValid);

  const timersValid = d.timers
    && d.timers.tickMs === 250
    && d.timers.lobbySeconds === 30 && d.timers.lobbyTicks === 120
    && d.timers.revealSeconds === 1 && d.timers.revealTicks === 4
    && d.timers.showtimeSeconds === 75;
  expect("Timers match 250ms tick, 30s lobby, 1s reveal, 75s showtime", Boolean(timersValid));

  const scoringValid = d.scoring
    && d.scoring.attentionMin === 0 && d.scoring.attentionMax === 100
    && d.scoring.maxScore === 7 && d.scoring.maxSetupCrew === 3;
  expect("Scoring constants match 0..100 attention, max score 7, max setup 3", Boolean(scoringValid));

  const lobbyValid = d.lobby
    && d.lobby.signalBandWidth === 14
    && d.lobby.signalZoneMin === 10 && d.lobby.signalZonePadding === 20
    && d.lobby.signalStartSpeedMin === 7 && d.lobby.signalStartSpeedRange === 4
    && d.lobby.signalMissSpeedUp === 2 && d.lobby.signalMaxSpeed === 16
    && d.lobby.botConnectMinSeconds === 3 && d.lobby.botConnectMaxSeconds === 15;
  expect("Lobby constants match band 14, speed-up +2 cap 16, bot 3-15s", Boolean(lobbyValid));

  const cablesValid = d.cables
    && d.cables.travelTicks === 11 && d.cables.hitWindowTicks === 2
    && d.cables.spawnGapInitial === 6 && d.cables.spawnGapMid === 5 && d.cables.spawnGapFast === 4
    && d.cables.wrongPenalty === 3;
  expect("Cable constants match travel 11, window 2, gaps 6/5/4, penalty 3", Boolean(cablesValid));

  const soundValid = d.sound
    && d.sound.start === 45 && d.sound.min === 0 && d.sound.max === 110
    && d.sound.greenMin === 70 && d.sound.greenMax === 85
    && d.sound.holdSeconds === 3 && d.sound.holdTicks === 12
    && d.sound.feedbackAt === 100 && d.sound.feedbackPenalty === 4
    && JSON.stringify(d.sound.controls) === JSON.stringify([-10, 5, 10])
    && d.sound.driftStep === 2 && d.sound.jitterHalf === 1.7
    && d.sound.spikeInitialMinTicks === 12 && d.sound.spikeInitialRangeTicks === 6
    && d.sound.spikeIntervalMinTicks === 12 && d.sound.spikeIntervalRangeTicks === 9
    && d.sound.spikeBoostMin === 8 && d.sound.spikeBoostRange === 10;
  expect("Sound constants match green 70-85 for 3s, feedback at 100 (-4), spikes", Boolean(soundValid));

  const micValid = d.mic
    && d.mic.count === 4
    && JSON.stringify(d.mic.roundLengths) === JSON.stringify([3, 4, 5])
    && d.mic.flashRound1Ticks === 9 && d.mic.flashBaseTicks === 6 && d.mic.wrongPenalty === 4;
  expect("Mic constants match 4 mics, lengths [3,4,5], flash ticks, penalty 4", Boolean(micValid));

  const deckValid = d.deck
    && d.deck.reshuffleTicks === 8 && d.deck.wrongReshuffleTicks === 2 && d.deck.wrongPenalty === 6;
  expect("Deck constants match reshuffle 8 ticks, spite 2 ticks, penalty 6", Boolean(deckValid));

  const qaRulesValid = d.qa
    && d.qa.countdownTicks === 29 && d.qa.lowWarningTicks === 8
    && d.qa.rightRecover === 5 && d.qa.wrongPenalty === 5;
  expect("Q&A constants match 29-tick countdown, +5 recover, -5 penalty", Boolean(qaRulesValid));

  const danceValid = d.dance
    && JSON.stringify(d.dance.arrows) === JSON.stringify(["left", "up", "right", "down"])
    && d.dance.arrowGlyphs && Object.keys(d.dance.arrowGlyphs).length === 4
    && d.dance.boostCap === 45 && d.dance.travelTicks === 10
    && d.dance.perfectWindowTicks === 1 && d.dance.goodWindowTicks === 2
    && d.dance.perfectBoost === 3 && d.dance.goodBoost === 2
    && d.dance.strayPenalty === 1 && d.dance.missPenalty === 2
    && d.dance.gapInitialTicks === 6 && d.dance.gapMidTicks === 5 && d.dance.gapFastTicks === 4
    && d.dance.tempoRampMidNotes === 20 && d.dance.tempoRampFastNotes === 40
    && d.dance.maxConsecutiveSame === 2 && d.dance.stumbleTicks === 3 && d.dance.choreoLength === 64;
  expect("Dance constants match cap 45, perfect/good +3/+2, stray/miss -1/-2, tempo", Boolean(danceValid));

  const botsValid = d.bots
    && Array.isArray(d.bots.setupMilestones) && d.bots.setupMilestones.length === 6
    && d.bots.setupMilestones.every(m => typeof m.step === "string" && typeof m.ticks === "number" && typeof m.seconds === "number" && typeof m.label === "string" && m.label.length > 0)
    && d.bots.setupHiccupChance === 0.3 && d.bots.setupHiccupPenalty === 3
    && d.bots.danceBoostStep === 1 && d.bots.danceMinSeconds === 1.5 && d.bots.danceMaxSeconds === 2.5;
  expect("Bot constants match 6 setup milestones, 30% hiccup (-3), 1.5-2.5s dance", Boolean(botsValid));

  const flavorValid = d.flavor
    && Array.isArray(d.flavor.danceMoves) && d.flavor.danceMoves.length > 0
    && d.flavor.danceMoves.every(s => typeof s === "string" && s.length > 0)
    && Array.isArray(d.flavor.glitchReasons) && d.flavor.glitchReasons.length > 0
    && d.flavor.glitchReasons.every(s => typeof s === "string" && s.length > 0)
    && d.flavor.statusMessages && typeof d.flavor.statusMessages === "object"
    && Object.keys(d.flavor.statusMessages).length >= 20
    && Object.values(d.flavor.statusMessages).every(s => typeof s === "string" && s.length > 0);
  expect("Flavor lists and status messages are populated strings", Boolean(flavorValid));
}

const rawSource = fs.readFileSync(path.join(__dirname, "..", "rules", "mirrorData.js"), "utf8");
const serialized = JSON.stringify(d || {});
const teamPattern = /\b(kestrel|wren|finch|heron)\b/i;
const teamProperPattern = /\bTeam\s+[A-Z]\w*/;
expect(
  "Zero hardcoded team names in mirrorData.js source or exported data",
  !teamPattern.test(rawSource) && !teamPattern.test(serialized)
    && !teamProperPattern.test(rawSource) && !teamProperPattern.test(serialized),
);

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
