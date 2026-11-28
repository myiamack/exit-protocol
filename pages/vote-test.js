/* Test page for Levels 5-6: submissions and vote. Screen code only.
   Every rule lives in rules/ (Game, JudgedTrial, Vote). This page draws screens and calls Game methods.
   Levels 1-4 fast-forward via Game.jumpToLevel(5), then you play Levels 5 and 6. */
(function () {
  const JT = EP.Trial.JudgedTrial;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = x => Math.floor(Math.max(0, x) / 60) + ":" + String(Math.max(0, x) % 60).padStart(2, "0");
  let RNG = EP.Rng.seeded(EP.Rng.randomSeed());   // seeded, so the game could be saved (Part 13)
  const TYPE_NAMES = { coop: "Cooperative", indep: "Independent", contra: "Contrarian" };
  const TEAM_NAMES = ["Team Kestrel", "Team Wren", "Team Heron", "Team Finch"];

  let G = null, ME = null;
  const BOARD = BoardView.mount(() => (G ? G.board() : null));   // Progress board, read-only
  document.querySelector("#boardBtn").onclick = () => BOARD.open();
  FullscreenView.mount(document.querySelector("#fsBtn"));   // full screen button (screen code only)
  /* Attendance check on the submission and Vote screens. Rules in rules/Attendance.js and rules/Game.js;
     the popup is shared screen code (attendance-view.js). Game pauses it in briefings and intermissions. */
  const ATT = AttendanceView.mount({ game: () => G, me: () => ME, onChange: () => render() });
  const S = { screen: "setup", name: "You", type: "coop", host: false, draft: "", msg: "", picks: ["", "", ""] };

  /* ----- game setup: 16 players, 4 teams of 4 (8 Cooperative, 5 Independent, 3 Contrarian) ----- */
  function newGame() {
    RNG = EP.Rng.seeded(EP.Rng.randomSeed());
    const spend = EP.Bots.typicalSpend(S.type);
    const solo = EP.Bots.soloGame({
      me: { name: S.name.trim() || "You", type: S.type, spend },
      myTeam: { name: TEAM_NAMES[0], mates: ["Bot 1", "Bot 2", "Bot 3"] },
      others: TEAM_NAMES.slice(1).map((n, ti) => ({
        name: n,
        players: [0, 1, 2, 3].map(j => "Bot " + (4 + ti * 4 + j)),
      })),
      rng: RNG,
      hooks: EP.Bots.hooks,
    });
    G = solo.game;
    ME = solo.me;
    G.host = S.host;
  }

  /* Open the judged trial for the current level (must be at briefing). */
  function openJudgedTrial() {
    G.advance();       // Briefing -> Open Floor
    G.closeTimer();    // Open Floor -> Trial (hooks run Bots.openFloor; non-host opens writing + Bots.submit)
    S.draft = ""; S.msg = ""; S.picks = ["", "", ""];
    S.screen = G.host ? "prompt" : "trial";
    render();
  }

  setInterval(() => {
    if (!G || !G.round) return;
    const closed = G.tick();
    ATT.sync(G.pollAttendance());
    if (closed.length) { render(); return; }
    const tv = G.timerView(), t = $("#tmr");
    if (tv && t) { t.textContent = fmt(tv.secondsLeft); t.classList.toggle("low", tv.secondsLeft <= 10); }
  }, 250);

  /* ----- screens ----- */
  const V = {};
  V.setup = () => `<div><span class="chip r">Test page</span><h2 style="margin-top:8px">Levels 5 and 6: submissions and vote</h2>
    <p class="hint" style="margin-top:6px">Levels 1 to 4 play instantly with bots. Then you write and vote in Levels 5 and 6. 16 players, 4 teams of 4.</p></div>
    <div class="cols"><div class="panel">
      <div class="field"><label for="nm">Your name</label><input type="text" id="nm" value="${esc(S.name)}" maxlength="16"></div>
      <div class="field"><label for="ty">Your type</label><select id="ty">${Object.entries(TYPE_NAMES).map(([k, n]) => `<option value="${k}" ${k === S.type ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <label class="row" style="gap:8px"><input type="checkbox" id="host" ${S.host ? "checked" : ""}> Host mode (you pick the prompt)</label>
      <span class="hint">Without host mode, the engine picks a prompt at random.</span>
    </div></div>
    <div class="row"><button class="btn red" id="go">Play Levels 1-4 with bots ▶</button></div>`;

  V.prompt = () => {
    const list = JT.prompts(G.level);
    return `<div><span class="chip b">Host · Level ${G.level} · ${esc(G.round.name)}</span><h2 style="margin-top:8px">Pick the prompt</h2>
      <p class="hint" style="margin-top:6px">Pick one from the list, or type your own. A custom prompt is saved on this game's record only.</p></div>
      <div class="plist">${list.map((p, i) => `<label><input type="radio" name="pp" value="${i}"><span>${i + 1}. ${esc(p)}</span></label>`).join("")}
        <label><input type="radio" name="pp" value="custom" id="ppCustom"><span style="flex:1;display:grid;gap:6px">Custom prompt<textarea id="customText" style="min-height:70px" maxlength="${JT.MAX_PROMPT_CHARS}" placeholder="Up to ${JT.MAX_PROMPT_CHARS} characters"></textarea></span></label></div>
      ${S.msg ? `<div class="err">${esc(S.msg)}</div>` : ""}
      <div class="row"><button class="btn red" id="usePrompt">Use this prompt ▶</button></div>`;
  };

  let trialView = null;
  V.trial = () => {
    const myTeam = G.teamOf(ME);
    trialView = JudgedView.screen({
      game: G, me: ME, team: myTeam, state: S,
      subsLayout: "subs", showVotePoints: true, onRender: render,
      header: (phase, view) => {
        if (phase === "write") {
          const tv = G.timerView();
          const left = tv ? tv.secondsLeft : 0;
          return `<div class="row" style="justify-content:space-between"><div><span class="chip r">The Trial · Level ${G.level} · ${esc(G.round.name)}</span><h2 style="margin-top:8px">Write your answer</h2></div><span class="tmr ${left <= 10 ? "low" : ""}" id="tmr">${fmt(left)}</span></div>`;
        }
        if (phase === "vote") {
          return `<div><span class="chip r">The Vote · Level ${G.level} · ${esc(G.round.name)}</span><h2 style="margin-top:8px">Rank the top ${view ? view.slots : 0} from other teams</h2></div>`;
        }
        const mine = view && view.ranking ? view.ranking.find(r => r.isMine) : null;
        const won = mine ? mine.won : myTeam.won;
        return `<div><span class="chip g">Vote result · Level ${G.level}</span><h2 style="margin-top:8px">${won ? "Your team won" : "Your team lost"}</h2></div>`;
      },
      writeFooter: () => `<div class="row"><button class="btn soft sm" id="endNow">Test: end the timer now</button></div>`,
      costHint: () => "Score = vote points / (active players x players who could rank them). Top half win, rounded up.",
      resultFooter: () => `<div class="row"><button class="btn red" id="next">${G.level === 5 ? "Finish Level 5 and start Level 6 ▶" : "Finish Level 6 ▶"}</button></div>`,
      onEndNow: () => { G.closeWriting(); render(); },
      onResultNext: () => {
        if (G.level === 5) { G.jumpToLevel(6); openJudgedTrial(); }
        else { G.jumpToLevel(7); S.screen = "done"; render(); }
      },
    });
    return trialView.html;
  };

  V.done = () => `<div><span class="chip g">Done</span><h2 style="margin-top:8px">Levels 5 and 6 complete</h2></div>
    <div class="panel"><span class="label">Prompts on this game's record</span>${G.prompts.map(p => `<p>Level ${p.level}${p.custom ? " · custom" : " · list #" + (p.index + 1)}: ${esc(p.text)}</p>`).join("")}</div>
    <div class="row"><button class="btn blue" id="again">Play again</button></div>`;

  function render() {
    $("#where").textContent = G && G.round ? "Level " + G.level + " · " + G.round.name : "";
    $("#boardBtn").hidden = !G;
    trialView = null;
    $("#stage").innerHTML = V[S.screen]();
    bind();
    BOARD.refresh();
  }

  function bind() {
    const on = (sel, fn) => { const e = $(sel); if (e) e.onclick = fn; };
    if (S.screen === "setup") {
      on("#go", () => {
        S.name = $("#nm").value; S.type = $("#ty").value; S.host = $("#host").checked;
        newGame(); G.jumpToLevel(5); openJudgedTrial();
      });
    }
    if (S.screen === "prompt") {
      $("#customText").addEventListener("focus", () => { $("#ppCustom").checked = true; });
      on("#usePrompt", () => {
        const sel = $$("[name=pp]").find(x => x.checked);
        if (!sel) { S.msg = "Pick a prompt first."; render(); return; }
        const r = G.setPrompt(sel.value === "custom" ? $("#customText").value : +sel.value);
        if (!r.ok) { S.msg = r.reason; render(); return; }
        S.msg = ""; G.startWriting(); S.screen = "trial"; render();
      });
    }
    if (S.screen === "trial" && trialView && trialView.bind) trialView.bind($("#stage"));
    if (S.screen === "done") on("#again", () => { ATT.close(); G = null; ME = null; S.screen = "setup"; render(); });
  }

  render();
})();
