/* Baseline runner for the rules test suite.
   Modes:
     node tools/baseline.js save   -> runs all baseline tests and writes Tests/baseline/<name>.txt
     node tools/baseline.js check  -> runs all baseline tests and compares against Tests/baseline/<name>.txt
   Exits with code 1 if any test fails or differs. */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const BASELINE_DIR = path.join(ROOT, "Tests", "baseline");
const TESTS = [
  "check_bundle",
  "check_rules",
  "check_gifts",
  "check_steps",
  "check_teams",
  "check_balance",
  "check_cheese",
  "check_save",
  "check_scenarios",
  "check_split_brief",
  "check_split_timing",
  "check_split_bots",
  "check_mirror_data",
  "check_mirror_lobby",
  "check_mirror_setup",
  "check_mirror_dance",
  "check_mirror_score",
  "check_mirror_timing",
  "check_mirror_bots",
];

function runTest(name) {
  const file = path.join("Tests", name + ".js");
  const res = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: "utf8" });
  const out = (res.stdout || "") + (res.stderr || "");
  return { status: res.status, out: out.replace(/\r\n/g, "\n") };
}

function normalizeLines(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter(line => !/^Full run time:\s*[\d.]+\s*seconds\.?$/.test(line))
    .map(line => line.replace(/\s+\([\d.]+\s*s\)$/, ""));
}

function diffLines(expected, actual) {
  const diffs = [];
  const max = Math.max(expected.length, actual.length);
  for (let i = 0; i < max; i++) {
    if (expected[i] !== actual[i]) {
      diffs.push(`  line ${i + 1}:`);
      if (i < expected.length) diffs.push(`    - ${expected[i]}`);
      if (i < actual.length) diffs.push(`    + ${actual[i]}`);
    }
  }
  return diffs;
}

function save() {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  let failed = false;
  for (const name of TESTS) {
    if (name === "check_bundle") continue;
    const res = runTest(name);
    if (res.status !== 0) {
      console.log(`FAIL  ${name}  (exit ${res.status})`);
      if (res.out) console.log(res.out);
      failed = true;
      continue;
    }
    fs.writeFileSync(path.join(BASELINE_DIR, name + ".txt"), res.out, "utf8");
    console.log(`SAVED ${name}`);
  }
  process.exit(failed ? 1 : 0);
}

function check() {
  let failed = false;
  for (const name of TESTS) {
    if (name === "check_bundle") {
      const res = runTest(name);
      if (res.status === 0) console.log(`PASS  ${name}`);
      else {
        console.log(`FAIL  ${name}  (exit ${res.status})`);
        if (res.out) console.log(res.out);
        failed = true;
      }
      continue;
    }
    const basePath = path.join(BASELINE_DIR, name + ".txt");
    if (!fs.existsSync(basePath)) {
      console.log(`FAIL  ${name}  (missing baseline; run npm run baseline)`);
      failed = true;
      continue;
    }
    const res = runTest(name);
    const expected = normalizeLines(fs.readFileSync(basePath, "utf8"));
    const actual = normalizeLines(res.out);
    const diffs = diffLines(expected, actual);
    if (res.status !== 0 || diffs.length > 0) {
      console.log(`FAIL  ${name}` + (res.status !== 0 ? `  (exit ${res.status})` : ""));
      if (diffs.length > 0) console.log(diffs.join("\n"));
      failed = true;
    } else {
      console.log(`PASS  ${name}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

const mode = process.argv[2];
if (mode === "save") save();
else if (mode === "check") check();
else {
  console.error("Usage: node tools/baseline.js <save|check>");
  process.exit(1);
}
