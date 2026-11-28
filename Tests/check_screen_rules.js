/* Standing guard check: screen files must follow the Screen State Rule (CLAUDE.md).
   Run from the repo folder:  node Tests/check_screen_rules.js
   Pass/fail check (no snapshot file). Registered in tools/baseline.js. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const REQUIRED_SCREEN_FILES = [
  "game.js",
  "world-map.js",
  "pixel-art.js",
  "board.js",
  "attendance-view.js",
  "fullscreen-view.js",
  "splitbrief-view.js",
  "mirror-view.js",
  "mirror-dance-view.js",
  "judged-view.js",
  "pages/vote-test.js",
];

/* Non-screen .js files in repo root or pages/ that should not be scanned.
   Each entry: { file: "relative/path.js", reason: "one-line reason" } */
const EXCLUDED_FILES = [];

/* Named allowlist (no line numbers). Each entry names file, function/helper, rule, and a one-line reason. */
const ALLOWLIST = [
  { file: "game.js", target: "top-level page clock setInterval", rule: "R3", reason: "Page clock calls G.tick() and draws the timer banner." },
  { file: "pages/vote-test.js", target: "top-level page clock setInterval", rule: "R3", reason: "Test-page clock calls G.tick(), G.pollAttendance(), and updates #tmr from G.timerView()." },
  { file: "game.js", target: "newSession -> EP.Bots.soloGame", rule: "R4", reason: "Bootstraps the solo prototype Game session with bots." },
  { file: "game.js", target: "newSession -> hooks: EP.Bots.hooks", rule: "R4", reason: "Passes EP.Bots.hooks as a session option in newSession()." },
  { file: "game.js", target: "devJump -> EP.Bots.devBuild", rule: "R4", reason: "Fills default type and spend for the Ctrl+Shift+1..7 dev shortcut." },
  { file: "pages/vote-test.js", target: "newGame -> EP.Bots.soloGame", rule: "R4", reason: "Bootstraps the Levels 5-6 test page solo session." },
  { file: "pages/vote-test.js", target: "newGame -> EP.Bots.typicalSpend", rule: "R4", reason: "Computes starter build spend for the Levels 5-6 test page." },
  { file: "pages/vote-test.js", target: "newGame -> hooks: EP.Bots.hooks", rule: "R4", reason: "Passes EP.Bots.hooks as a session option in newGame()." },
  { file: "pages/vote-test.js", target: "newGame -> G.host = S.host", rule: "R4", reason: "Test-page bootstrap sets host until Bots.soloGame takes a host option (logged for Step 14)." },
  { file: "game.js", target: "protoNameStore -> localStorage", rule: "R5", reason: "Prototype-only display-name helper marked // prototype-only: replaced by Base44 login." },
];

let pass = 0;
let fail = 0;
function ok(name, cond, info) {
  console.log((cond ? "PASS  " : "FAIL  ") + name + (info !== undefined ? "  -> " + info : ""));
  if (cond) pass++;
  else fail++;
}

function listJsFiles(dirRel) {
  const full = dirRel ? path.join(ROOT, dirRel) : ROOT;
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith(".js"))
    .map(d => (dirRel ? `${dirRel}/${d.name}` : d.name));
}

function discoverScreenFiles() {
  const excluded = new Set(EXCLUDED_FILES.map(e => e.file));
  const found = [...listJsFiles(""), ...listJsFiles("pages")].filter(f => !excluded.has(f));
  return [...new Set(found)].sort();
}

const REGEX_PREV_WORDS = new Set([
  "return", "throw", "case", "delete", "void", "typeof",
  "in", "instanceof", "new", "else", "do", "await", "yield",
]);
const REGEX_PREV_CHARS = new Set([
  "", "(", "[", "{", ",", ";", ":", "?", "=", "!", "&", "|", "^", "~", "+", "-", "*", "/", "%", "<", ">",
]);

/* Replace comments, string interiors, regex interiors, and static template text with spaces,
   preserving string length and all \n characters so indices and line numbers stay 1-to-1. */
function maskNonCode(src) {
  const out = [];
  const tplStack = []; // tracks nested { } depth inside ${ ... } template expressions
  let mode = "code";   // "code" | "line" | "block" | "sq" | "dq" | "tpl" | "regex"
  let prevChar = "";
  let prevWord = "";
  let regexInClass = false;

  const pushSpace = ch => { out.push(ch === "\n" ? "\n" : " "); };
  const updatePrevToken = ch => {
    if (/[A-Za-z0-9_$]/.test(ch)) {
      prevWord += ch;
      prevChar = "";
    } else if (!/\s/.test(ch)) {
      prevChar = ch;
      prevWord = "";
    }
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (mode === "line") {
      pushSpace(ch);
      if (ch === "\n") mode = "code";
      continue;
    }
    if (mode === "block") {
      if (ch === "*" && next === "/") {
        out.push(" ", " ");
        i++;
        mode = "code";
      } else {
        pushSpace(ch);
      }
      continue;
    }
    if (mode === "sq" || mode === "dq") {
      const q = mode === "sq" ? "'" : '"';
      if (ch === "\\") {
        pushSpace(ch);
        if (i + 1 < src.length) { pushSpace(src[i + 1]); i++; }
        continue;
      }
      if (ch === q) {
        out.push(ch);
        mode = "code";
        prevChar = q;
        prevWord = "";
        continue;
      }
      pushSpace(ch);
      continue;
    }
    if (mode === "regex") {
      if (ch === "\\") {
        pushSpace(ch);
        if (i + 1 < src.length) { pushSpace(src[i + 1]); i++; }
        continue;
      }
      if (ch === "[") { regexInClass = true; pushSpace(ch); continue; }
      if (ch === "]") { regexInClass = false; pushSpace(ch); continue; }
      if (!regexInClass && ch === "/") {
        out.push(ch);
        mode = "code";
        prevChar = "/";
        prevWord = "";
        continue;
      }
      pushSpace(ch);
      continue;
    }
    if (mode === "tpl") {
      if (ch === "\\") {
        pushSpace(ch);
        if (i + 1 < src.length) { pushSpace(src[i + 1]); i++; }
        continue;
      }
      if (ch === "`") {
        out.push(ch);
        mode = "code";
        prevChar = "`";
        prevWord = "";
        continue;
      }
      if (ch === "$" && next === "{") {
        out.push("$", "{");
        i++;
        tplStack.push(0);
        mode = "code";
        prevChar = "{";
        prevWord = "";
        continue;
      }
      pushSpace(ch);
      continue;
    }

    // mode === "code"
    if (ch === "/" && next === "/") {
      out.push(" ", " ");
      i++;
      mode = "line";
      continue;
    }
    if (ch === "/" && next === "*") {
      out.push(" ", " ");
      i++;
      mode = "block";
      continue;
    }
    if (ch === "'") { out.push(ch); mode = "sq"; continue; }
    if (ch === '"') { out.push(ch); mode = "dq"; continue; }
    if (ch === "`") { out.push(ch); mode = "tpl"; continue; }
    if (ch === "/" && (REGEX_PREV_CHARS.has(prevChar) || REGEX_PREV_WORDS.has(prevWord))) {
      out.push(ch);
      mode = "regex";
      regexInClass = false;
      continue;
    }

    if (tplStack.length > 0) {
      if (ch === "{") tplStack[tplStack.length - 1]++;
      else if (ch === "}") {
        if (tplStack[tplStack.length - 1] === 0) {
          tplStack.pop();
          out.push(ch);
          mode = "tpl";
          continue;
        }
        tplStack[tplStack.length - 1]--;
      }
    }

    out.push(ch);
    updatePrevToken(ch);
  }
  return out.join("");
}

function lineOf(src, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) {
    if (src[i] === "\n") line++;
  }
  return line;
}

function matchDelim(masked, openIdx, openCh, closeCh) {
  let depth = 0;
  for (let i = openIdx; i < masked.length; i++) {
    const ch = masked[i];
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findNamedRange(masked, name, kind) {
  const re = kind === "object"
    ? new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*\\{`, "g")
    : new RegExp(`\\bfunction\\s+${name}\\s*\\(`, "g");
  const m = re.exec(masked);
  if (!m) return null;
  let openIdx;
  if (kind === "object") {
    openIdx = m.index + m[0].length - 1;
  } else {
    const closeParen = matchDelim(masked, m.index + m[0].length - 1, "(", ")");
    if (closeParen < 0) return null;
    openIdx = masked.indexOf("{", closeParen);
    if (openIdx < 0) return null;
  }
  const closeIdx = matchDelim(masked, openIdx, "{", "}");
  if (closeIdx < 0) return null;
  return { start: m.index, open: openIdx, close: closeIdx };
}

function inRange(idx, range) {
  return !!range && idx >= range.start && idx <= range.close;
}

/* Split the first argument of a timer call at top-level comma or closing paren. */
function firstArgSlice(masked, openParenIdx) {
  let p = 0, b = 0, k = 0;
  for (let i = openParenIdx + 1; i < masked.length; i++) {
    const ch = masked[i];
    if (ch === "(") p++;
    else if (ch === ")") {
      if (p === 0 && b === 0 && k === 0) return { start: openParenIdx + 1, end: i };
      p--;
    } else if (ch === "{") b++;
    else if (ch === "}") b--;
    else if (ch === "[") k++;
    else if (ch === "]") k--;
    else if (ch === "," && p === 0 && b === 0 && k === 0) {
      return { start: openParenIdx + 1, end: i };
    }
  }
  return null;
}

function findTopLevelArrow(masked, start, end) {
  let p = 0, b = 0, k = 0;
  for (let i = start; i < end - 1; i++) {
    const ch = masked[i];
    if (ch === "(") p++;
    else if (ch === ")") p--;
    else if (ch === "{") b++;
    else if (ch === "}") b--;
    else if (ch === "[") k++;
    else if (ch === "]") k--;
    else if (ch === "=" && masked[i + 1] === ">" && p === 0 && b === 0 && k === 0) return i;
  }
  return -1;
}

function findLocalFunctionBody(masked, fnName) {
  const fnRange = findNamedRange(masked, fnName, "function");
  if (fnRange) return masked.slice(fnRange.open + 1, fnRange.close);

  const varRe = new RegExp(`\\b(?:const|let|var)\\s+${fnName}\\s*=`, "g");
  const m = varRe.exec(masked);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < masked.length && /\s/.test(masked[i])) i++;
  if (masked.startsWith("function", i)) {
    const paren = masked.indexOf("(", i);
    if (paren < 0) return null;
    const cp = matchDelim(masked, paren, "(", ")");
    const ob = cp >= 0 ? masked.indexOf("{", cp) : -1;
    const cb = ob >= 0 ? matchDelim(masked, ob, "{", "}") : -1;
    return cb >= 0 ? masked.slice(ob + 1, cb) : null;
  }
  // Arrow initializer
  let p = 0, b = 0, k = 0;
  for (let j = i; j < masked.length - 1; j++) {
    const ch = masked[j];
    if (ch === "(") p++;
    else if (ch === ")") p--;
    else if (ch === "{") b++;
    else if (ch === "}") b--;
    else if (ch === "[") k++;
    else if (ch === "]") k--;
    else if ((ch === ";" || ch === "\n") && p === 0 && b === 0 && k === 0 && !/=>/.test(masked.slice(i, j + 5))) {
      return null;
    } else if (ch === "=" && masked[j + 1] === ">" && p === 0 && b === 0 && k === 0) {
      let bodyStart = j + 2;
      while (bodyStart < masked.length && /\s/.test(masked[bodyStart])) bodyStart++;
      if (masked[bodyStart] === "{") {
        const cb = matchDelim(masked, bodyStart, "{", "}");
        return cb >= 0 ? masked.slice(bodyStart + 1, cb) : null;
      }
      // Concise arrow up to ; or newline at depth 0
      let ep = 0, eb = 0, ek = 0;
      for (let e = bodyStart; e < masked.length; e++) {
        const c = masked[e];
        if (c === "(") ep++;
        else if (c === ")") ep--;
        else if (c === "{") eb++;
        else if (c === "}") eb--;
        else if (c === "[") ek++;
        else if (c === "]") ek--;
        else if ((c === ";" || c === "\n") && ep === 0 && eb === 0 && ek === 0) {
          return masked.slice(bodyStart, e);
        }
      }
      return masked.slice(bodyStart);
    }
  }
  return null;
}

function extractTimerBody(masked, openParenIdx) {
  const slice = firstArgSlice(masked, openParenIdx);
  if (!slice) return null;
  let s = slice.start;
  let e = slice.end;
  while (s < e && /\s/.test(masked[s])) s++;
  while (e > s && /\s/.test(masked[e - 1])) e--;
  const arg = masked.slice(s, e);

  if (/^function\b/.test(arg)) {
    const openBrace = masked.indexOf("{", s);
    if (openBrace < 0 || openBrace >= e) return null;
    const closeBrace = matchDelim(masked, openBrace, "{", "}");
    if (closeBrace < 0 || closeBrace > e) return null;
    return masked.slice(openBrace + 1, closeBrace);
  }
  const arrowIdx = findTopLevelArrow(masked, s, e);
  if (arrowIdx >= 0) {
    let bodyStart = arrowIdx + 2;
    while (bodyStart < e && /\s/.test(masked[bodyStart])) bodyStart++;
    if (masked[bodyStart] === "{") {
      const closeBrace = matchDelim(masked, bodyStart, "{", "}");
      if (closeBrace >= 0 && closeBrace <= e) return masked.slice(bodyStart + 1, closeBrace);
    }
    return masked.slice(bodyStart, e);
  }
  if (/^[A-Za-z_$][\w$]*$/.test(arg)) {
    return findLocalFunctionBody(masked, arg);
  }
  return null;
}

function findR4Hits(file, masked, src, scopes) {
  const hits = [];

  // Postfix ++/--, assignment, compound assignment on G.*, ME.*, MYTEAM.*, trial.*, round.*
  const writeRe = /(^|[^.\w$])\b(G|ME|MYTEAM|trial|round)((?:\s*\.\s*[A-Za-z_$][\w$]*|\s*\[[^\]\n]+\])+)\s*(?:\+\+|--|(?:[+\-*/%]|\?\?|\|\||&&)?=(?![=>]))/g;
  let m;
  while ((m = writeRe.exec(masked)) !== null) {
    const rootVar = m[2];
    const propChain = m[3].replace(/\s+/g, "");
    const idx = m.index + m[1].length;
    if (file === "pages/vote-test.js" && rootVar === "G" && propChain === ".host" && inRange(idx, scopes.newGame)) {
      continue;
    }
    hits.push({ rule: "R4", file, line: lineOf(src, idx), detail: `direct write to ${rootVar}${propChain}` });
  }

  // Prefix ++/-- on G.*, ME.*, MYTEAM.*, trial.*, round.*
  const prefixRe = /(?:\+\+|--)\s*(G|ME|MYTEAM|trial|round)((?:\s*\.\s*[A-Za-z_$][\w$]*|\s*\[[^\]\n]+\])+)/g;
  while ((m = prefixRe.exec(masked)) !== null) {
    hits.push({ rule: "R4", file, line: lineOf(src, m.index), detail: `prefix update on ${m[1]}${m[2].replace(/\s+/g, "")}` });
  }

  // Mutating calls: G.round.trial.*, *.cast(...), ME.placePoints(...)
  const trialCallRe = /\bG\s*\.\s*round\s*\.\s*trial\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = trialCallRe.exec(masked)) !== null) {
    hits.push({ rule: "R4", file, line: lineOf(src, m.index), detail: `direct G.round.trial.${m[1]}() call` });
  }
  const castRe = /\.\s*cast\s*\(/g;
  while ((m = castRe.exec(masked)) !== null) {
    hits.push({ rule: "R4", file, line: lineOf(src, m.index), detail: "direct .cast() call" });
  }
  const placeRe = /\bME\s*\.\s*placePoints\s*\(/g;
  while ((m = placeRe.exec(masked)) !== null) {
    hits.push({ rule: "R4", file, line: lineOf(src, m.index), detail: "direct ME.placePoints() call" });
  }

  // EP.Bots.* references/calls
  const botsRe = /\bEP\s*\.\s*Bots\s*\.\s*([A-Za-z_$][\w$]*)/g;
  while ((m = botsRe.exec(masked)) !== null) {
    const prop = m[1];
    const idx = m.index;
    const before = masked.slice(Math.max(0, idx - 24), idx);
    const after = masked.slice(idx + m[0].length, idx + m[0].length + 8);
    const isHooksOption =
      prop === "hooks" &&
      /hooks\s*:\s*$/.test(before) &&
      !/^\s*\./.test(after) &&
      ((file === "game.js" && inRange(idx, scopes.newSession)) ||
        (file === "pages/vote-test.js" && inRange(idx, scopes.newGame)));
    const allowed =
      isHooksOption ||
      (file === "game.js" && prop === "soloGame" && inRange(idx, scopes.newSession)) ||
      (file === "game.js" && prop === "devBuild" && inRange(idx, scopes.devJump)) ||
      (file === "pages/vote-test.js" && (prop === "soloGame" || prop === "typicalSpend") && inRange(idx, scopes.newGame));
    if (!allowed) {
      hits.push({ rule: "R4", file, line: lineOf(src, idx), detail: `EP.Bots.${prop} outside allowed bootstrap` });
    }
  }

  return hits;
}

function isAllowedTimerCallback(file, kind, body) {
  if (kind !== "setInterval") return false;
  if (/\b(EP|trial)\s*\./.test(body)) return false;
  if (findR4Hits("__timer__", body, body, {}).length > 0) return false;
  const gRefs = [...body.matchAll(/\bG\s*\.\s*([A-Za-z_$][\w$]*)/g)].map(x => x[1]);
  if (file === "game.js") return gRefs.length > 0 && gRefs.every(p => p === "tick");
  if (file === "pages/vote-test.js") {
    const okProps = new Set(["round", "tick", "pollAttendance", "timerView"]);
    return gRefs.length > 0 && gRefs.every(p => okProps.has(p));
  }
  return false;
}

function scanSource(file, src) {
  const norm = src.replace(/\r\n/g, "\n");
  const masked = maskNonCode(norm);
  const rawLines = norm.split("\n");
  const maskedLines = masked.split("\n");
  const scopes = {
    newSession: findNamedRange(masked, "newSession", "function"),
    devJump: findNamedRange(masked, "devJump", "function"),
    newGame: findNamedRange(masked, "newGame", "function"),
    protoNameStore: findNamedRange(masked, "protoNameStore", "object"),
  };

  const violations = [];

  // R1: Math.random() without // cosmetic-ok on the same line
  for (let i = 0; i < maskedLines.length; i++) {
    if (/\bMath\s*\.\s*random\s*\(/.test(maskedLines[i]) && !/\/\/\s*cosmetic-ok\b/.test(rawLines[i])) {
      violations.push({ rule: "R1", file, line: i + 1, detail: "Math.random() without // cosmetic-ok" });
    }
  }

  // R2: Date.now() or new Date
  for (let i = 0; i < maskedLines.length; i++) {
    if (/\bDate\s*\.\s*now\s*\(|\bnew\s+Date\b/.test(maskedLines[i])) {
      violations.push({ rule: "R2", file, line: i + 1, detail: "Date.now() or new Date in screen code" });
    }
  }

  // R3: setTimeout, setInterval, requestAnimationFrame whose callback touches G., EP., trial., or mutates game objects
  const timerRe = /\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/g;
  let tm;
  while ((tm = timerRe.exec(masked)) !== null) {
    const kind = tm[1];
    const openParen = tm.index + tm[0].length - 1;
    const body = extractTimerBody(masked, openParen);
    if (!body) continue;
    const touchesGame = /\b(G|EP|trial)\s*\./.test(body) || findR4Hits("__timer__", body, body, {}).length > 0;
    if (touchesGame && !isAllowedTimerCallback(file, kind, body)) {
      violations.push({ rule: "R3", file, line: lineOf(norm, tm.index), detail: `${kind} callback touches game state or rules` });
    }
  }

  // R4: direct writes and mutating calls
  violations.push(...findR4Hits(file, masked, norm, scopes));

  // R5: localStorage / sessionStorage outside protoNameStore in game.js
  const storeRe = /\b(localStorage|sessionStorage)\b/g;
  let sm;
  while ((sm = storeRe.exec(masked)) !== null) {
    const kind = sm[1];
    const idx = sm.index;
    const hasProtoMarker = scopes.protoNameStore &&
      /\/\/\s*prototype-only:\s*replaced by Base44 login\b/.test(
        rawLines.slice(Math.max(0, lineOf(norm, scopes.protoNameStore.start) - 2), lineOf(norm, scopes.protoNameStore.close)).join("\n")
      );
    const allowed = file === "game.js" && kind === "localStorage" && inRange(idx, scopes.protoNameStore) && hasProtoMarker;
    if (!allowed) {
      violations.push({ rule: "R5", file, line: lineOf(norm, idx), detail: `${kind} outside protoNameStore` });
    }
  }

  return violations;
}

/* ---------- 1. Check required files and discover screen files ---------- */
const files = discoverScreenFiles();
for (const req of REQUIRED_SCREEN_FILES) {
  const onDisk = fs.existsSync(path.join(ROOT, req));
  ok(`required screen file present: ${req}`, onDisk && files.includes(req));
}
ok(`allowlist documented (${ALLOWLIST.length} entries, ${EXCLUDED_FILES.length} excluded)`, ALLOWLIST.length > 0);

/* ---------- 2. Scan all discovered root + pages/ screen files ---------- */
for (const file of files) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const hits = scanSource(file, src);
  const summary = hits.length ? hits.map(h => `${h.rule} L${h.line}: ${h.detail}`).join("; ") : "clean";
  ok(`screen rules clean: ${file}`, hits.length === 0, summary);
}

/* ---------- 3. In-memory proof (Step 7): 5 bad samples fail, 2 good samples pass ---------- */
const PROOF_SAMPLES = [
  { name: "proof R1 bad (untagged Math.random)", file: "fake-view.js", expected: ["R1"], code: `const x = Math.random();` },
  { name: "proof R2 bad (Date.now + new Date)", file: "fake-view.js", expected: ["R2", "R2"], code: `const a = Date.now();\nconst b = new Date();` },
  { name: "proof R3 bad (setTimeout touching G.)", file: "fake-view.js", expected: ["R3"], code: `setTimeout(() => { G.advance(); }, 500);` },
  {
    name: "proof R4 bad (direct writes + mutating calls)",
    file: "fake-view.js",
    expected: ["R4", "R4", "R4", "R4", "R4"],
    code: `ME.earned = 5;\nG.round.trial.lockIn(ME);\nv.cast(ME, []);\nME.placePoints({});\nEP.Bots.answer(G);`,
  },
  {
    name: "proof R4 bad (EP.Bots.hooks.onGift in level4-view.js)",
    file: "level4-view.js",
    expected: ["R4"],
    code: `EP.Bots.hooks.onGift(G, gift);`,
  },
  { name: "proof R5 bad (localStorage outside protoNameStore)", file: "fake-view.js", expected: ["R5"], code: `localStorage.setItem("ep.cheat", "1");` },
  { name: "proof R1 good (Math.random with // cosmetic-ok)", file: "fake-view.js", expected: [], code: `const x = Math.random(); // cosmetic-ok` },
  {
    name: "proof R3 good (allowed game.js page clock G.tick)",
    file: "game.js",
    expected: [],
    code: `setInterval(() => { if (!G) return; const closed = G.tick(); if (closed.length) afterClose(closed); else drawTimer(); }, 250);`,
  },
];

for (const sample of PROOF_SAMPLES) {
  const hits = scanSource(sample.file, sample.code);
  const got = hits.map(h => h.rule);
  const matched = got.length === sample.expected.length && got.every((r, i) => r === sample.expected[i]);
  ok(sample.name, matched, matched ? (got.length ? got.join(",") : "0 hits") : `expected [${sample.expected}], got [${got}]`);
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
