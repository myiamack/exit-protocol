/* Data-shape test for Level 2 Split Brief scenarios.
   Checks: 5 cards, 4 tasks with unique ids, both answer keys have 2 real task ids,
   every bot note is 80 characters or less, and the twist has a bot note.
   Run from the repo folder:  node Tests/check_scenarios.js */
const EP = require("../rules/index.js");

let pass = 0, fail = 0;
function expect(label, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + label + (detail !== undefined ? "  -> " + detail : ""));
  ok ? pass++ : fail++;
}

const s = EP.Scenarios && EP.Scenarios.MEDLINE_SPRINT_1;
expect("MEDLINE_SPRINT_1 scenario exists", Boolean(s && typeof s === "object"));

if (s) {
  expect("Exactly 5 cards", Array.isArray(s.cards) && s.cards.length === 5, s.cards && s.cards.length);
  expect("Exactly 4 tasks", Array.isArray(s.tasks) && s.tasks.length === 4, s.tasks && s.tasks.length);

  const taskIds = (s.tasks || []).map(t => t && t.id);
  const uniqueIds = new Set(taskIds.filter(id => typeof id === "string" && id.length > 0));
  expect("4 tasks have unique non-empty ids", uniqueIds.size === 4, taskIds.join(", "));

  const tasksValid = (s.tasks || []).every(t => typeof t.name === "string" && t.name.length > 0 && typeof t.days === "number" && t.days > 0);
  expect("Every task has name and positive days", tasksValid);

  const preValid = Array.isArray(s.preTwistAnswer)
    && s.preTwistAnswer.length === 2
    && s.preTwistAnswer.every(id => uniqueIds.has(id))
    && s.preTwistAnswer[0] !== s.preTwistAnswer[1];
  expect("Pre-twist answer has 2 distinct real task ids", preValid, JSON.stringify(s.preTwistAnswer));

  const postValid = Array.isArray(s.postTwistAnswer)
    && s.postTwistAnswer.length === 2
    && s.postTwistAnswer.every(id => uniqueIds.has(id))
    && s.postTwistAnswer[0] !== s.postTwistAnswer[1];
  expect("Post-twist answer has 2 distinct real task ids", postValid, JSON.stringify(s.postTwistAnswer));

  const cardNotesValid = (s.cards || []).every(c => typeof c.botNote === "string" && c.botNote.length > 0 && c.botNote.length <= 80);
  expect("Every card has a bot note of 80 chars or less", cardNotesValid);

  const twistNoteValid = Boolean(s.twist && typeof s.twist.text === "string" && s.twist.text.length > 0
    && typeof s.twist.botNote === "string" && s.twist.botNote.length > 0 && s.twist.botNote.length <= 80);
  expect("Twist has text and a bot note of 80 chars or less", twistNoteValid, s.twist && s.twist.botNote && s.twist.botNote.length);
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
