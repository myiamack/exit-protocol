/* Test page for Levels 5-6: submissions and vote. Screen code only.
   Every rule lives in rules/ (Game, JudgedTrial, Vote). This page draws screens and calls them.
   Levels 1-4 play instantly with bots (your points are placed the bot way), then you play Levels 5 and 6. */
(function () {
  const JT = EP.Trial.JudgedTrial;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = x => Math.floor(Math.max(0, x) / 60) + ":" + String(Math.max(0, x) % 60).padStart(2, "0");
  let RNG = EP.Rng.seeded(EP.Rng.randomSeed());   // seeded, so the game could be saved (Part 13)
  const TYPE_NAMES = { coop: "Cooperative", indep: "Independent", contra: "Contrarian" };
  const TEAM_NAMES = ["Team Kestrel", "Team Wren", "Team Heron", "Team Finch"];

  let G = null, ME = null, timer = null;
  const BOARD = BoardView.mount(() => (G ? G.board() : null));   // Progress board, read-only
  document.querySelector("#boardBtn").onclick = () => BOARD.open();
  FullscreenView.mount(document.querySelector("#fsBtn"));   // full screen button (screen code only)
  /* Attendance check on the submission and Vote screens. Rules in rules/Attendance.js and rules/Game.js;
     the popup is shared screen code (attendance-view.js). Game pauses it in briefings and intermissions. */
  AttendanceView.mount({ game: () => G, me: () => ME, onChange: () => render() });
  const S = { screen: "setup", name: "You", type: "coop", host: false, draft: "", msg: "", picks: ["", "", ""] };

  /* ----- game setup: 16 players, 4 teams of 4 (8 Cooperative, 5 Independent, 3 Contrarian) ----- */
  function newGame() {
    RNG = EP.Rng.seeded(EP.Rng.randomSeed());
    ME = new EP.Player({ id: 0, name: S.name.trim() || "You", type: S.type, spend: EP.Bots.typicalSpend(S.type) });
    const pool = [...Array(8).fill("coop"), ...Array(5).fill("indep"), ...Array(3).fill("contra")];
    pool.splice(pool.indexOf(S.type), 1);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(RNG() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const players = [ME, ...pool.map((t, i) => EP.Bots.makePlayer(i + 1, "Bot " + (i + 1), t))];
    const teams = TEAM_NAMES.map((n, i) => new EP.Team({ id: i, name: n, members: players.slice(i * 4, i * 4 + 4) }));
    G = new EP.Game({ teams, rng: RNG, host: S.host });
  }
  const myTeam = () => G.teamOf(ME);

  /* Your points go in the bot way, so Levels 1-4 and the end of each round need no clicks. */
  function placeMine() {
    if (ME.isStuck()) return;
    ME.earned = Math.min(ME.earned, ME.roomLeft());
    ME.placePoints(EP.Bots.allocate(ME, ME.earned, false));
  }
  /* Everything after the trial ranking, with bots: costs, accusations, gifts, lock-in, Stats Update. */
  function finishRoundWithBots() {
    G.payTrialCosts(); G.advance();
    EP.Bots.accusations(G, RNG); G.endGlitchReport(); G.advance();
    EP.Bots.gifts(G, RNG); G.advance();
    G.lockIn(); G.advance();
    G.computeEarnings();
    EP.Bots.statsUpdate(G); placeMine();
    G.finishRound();
  }
  function playLevelsOneToFour() {
    for (let n = 1; n <= 4; n++) {
      G.startNextRound(); G.advance();
      EP.Bots.openFloor(G, RNG); G.advance();
      EP.Bots.trial(G, RNG);
      finishRoundWithBots();
    }
  }
  /* Start a judged level: Open Floor with bots, then the Trial step. */
  function startJudgedLevel() {
    G.startNextRound(); G.advance();
    EP.Bots.openFloor(G, RNG); G.advance();
    S.draft = ""; S.msg = ""; S.picks = ["", "", ""];
    if (G.host) { S.screen = "prompt"; render(); }
    else { G.startWriting(); startWritingScreen(); }   // no host: the engine picks at random
  }
  function startWritingScreen() {
    S.screen = "trial";
    EP.Bots.submit(G);   // bots submit "Bot answer" right away
    render();
    if (G.round.trial.writing !== "open") { toVote(); return; }   // e.g. you are Stuck: everyone active already submitted
    stopTimer();
    /* The writing timer is a deadline in Game. Game.tick closes writing when it runs out. */
    timer = setInterval(() => {
      G.tick();
      const left = G.secondsLeft() || 0, t = $("#tmr");
      if (t) { t.textContent = fmt(left); t.classList.toggle("low", left <= 10); }
      if (G.round.trial.writing !== "open") toVote();
    }, 1000);
  }
  function stopTimer() { clearInterval(timer); timer = null; }
  function toVote() { stopTimer(); if (!G.round.trial.vote && !G.didRun("runTrial")) G.startVote(); S.msg = ""; render(); }

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
    trialView = JudgedView.screen({
      game: G, me: ME, team: myTeam(), state: S,
      subsLayout: "subs", showVotePoints: true, onRender: render,
      header: phase => phase === "write"
        ? `<div class="row" style="justify-content:space-between"><div><span class="chip r">The Trial · Level ${G.level} · ${esc(G.round.name)}</span><h2 style="margin-top:8px">Write your answer</h2></div><span class="tmr ${(G.secondsLeft() || 0) <= 10 ? "low" : ""}" id="tmr">${fmt(G.secondsLeft() || 0)}</span></div>`
        : phase === "vote"
          ? `<div><span class="chip r">The Vote · Level ${G.level} · ${esc(G.round.name)}</span><h2 style="margin-top:8px">Rank the top ${G.round.trial.vote.slotsFor(ME)} from other teams</h2></div>`
          : `<div><span class="chip g">Vote result · Level ${G.level}</span><h2 style="margin-top:8px">${myTeam().won ? "Your team won" : "Your team lost"}</h2></div>`,
      writeFooter: () => `<div class="row"><button class="btn soft sm" id="endNow">Test: end the timer now</button></div>`,
      costHint: () => "Score = vote points / (active players x players who could rank them). Top half win, rounded up.",
      resultFooter: () => `<div class="row"><button class="btn red" id="next">${G.level === 5 ? "Finish Level 5 and start Level 6 ▶" : "Finish Level 6 ▶"}</button></div>`,
      onEndNow: () => { G.closeWriting(); toVote(); },
      onVoteDone: () => { stopTimer(); EP.Bots.vote(G, G.round.trial.vote, RNG); G.runTrial(); },
      onResultNext: () => { finishRoundWithBots(); if (G.level === 5) startJudgedLevel(); else { S.screen = "done"; render(); } },
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
        newGame(); playLevelsOneToFour(); G.start(); startJudgedLevel();   // timers run from Level 5 (the writing timer)
      });
    }
    if (S.screen === "prompt") {
      $("#customText").addEventListener("focus", () => { $("#ppCustom").checked = true; });
      on("#usePrompt", () => {
        const sel = $$("[name=pp]").find(x => x.checked);
        if (!sel) { S.msg = "Pick a prompt first."; render(); return; }
        const r = G.setPrompt(sel.value === "custom" ? $("#customText").value : +sel.value);
        if (!r.ok) { S.msg = r.reason; render(); return; }
        S.msg = ""; G.startWriting(); startWritingScreen();
      });
    }
    if (S.screen === "trial" && trialView && trialView.bind) trialView.bind($("#stage"));
    if (S.screen === "done") on("#again", () => { G = null; ME = null; S.screen = "setup"; render(); });
  }

  render();
})();
