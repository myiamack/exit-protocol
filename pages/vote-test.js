/* Test page for Levels 5-6: submissions and vote. Screen code only.
   Every rule lives in rules/ (Game, JudgedTrial, Vote). This page draws screens and calls them.
   Levels 1-4 play instantly with bots (your points are placed the bot way), then you play Levels 5 and 6. */
(function () {
  const JT = EP.Trial.JudgedTrial;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = x => Math.floor(Math.max(0, x) / 60) + ":" + String(Math.max(0, x) % 60).padStart(2, "0");
  const RNG = Math.random;
  const TYPE_NAMES = { coop: "Cooperative", indep: "Independent", contra: "Contrarian" };
  const TEAM_NAMES = ["Team Kestrel", "Team Wren", "Team Heron", "Team Finch"];

  let G = null, ME = null, timer = null;
  const S = { screen: "setup", name: "You", type: "coop", host: false, left: 0, draft: "", msg: "", result: null };

  /* ----- game setup: 16 players, 4 teams of 4 (8 Cooperative, 5 Independent, 3 Contrarian) ----- */
  function newGame() {
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
      G.startNextRound();
      EP.Bots.openFloor(G, RNG); G.advance();
      EP.Bots.trial(G, RNG);
      finishRoundWithBots();
    }
  }
  /* Start a judged level: Open Floor with bots, then the Trial step. */
  function startJudgedLevel() {
    G.startNextRound();
    EP.Bots.openFloor(G, RNG); G.advance();
    S.draft = ""; S.msg = ""; S.result = null;
    if (G.host) { S.screen = "prompt"; render(); }
    else { G.startWriting(); startWritingScreen(); }   // no host: the engine picks at random
  }
  function startWritingScreen() {
    S.screen = "write";
    S.left = JT.WRITING_SECONDS;
    EP.Bots.submit(G);   // bots submit "Bot answer" right away
    render();
    if (G.round.trial.writing !== "open") { toVote(); return; }   // e.g. you are Stuck: everyone active already submitted
    stopTimer();
    timer = setInterval(() => {
      S.left -= 1;
      const t = $("#tmr"); if (t) { t.textContent = fmt(S.left); t.classList.toggle("low", S.left <= 10); }
      if (S.left <= 0) { G.closeWriting(); toVote(); }
    }, 1000);
  }
  function stopTimer() { clearInterval(timer); timer = null; }
  function toVote() { stopTimer(); G.startVote(); S.screen = "vote"; S.msg = ""; render(); }
  function finishVote() {
    EP.Bots.vote(G, G.round.trial.vote, RNG);
    S.result = G.runTrial();
    S.screen = "result";
    render();
  }

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

  V.write = () => {
    const jt = G.round.trial, mine = jt.submissions.get(ME), n = S.draft.trim().length, max = JT.MAX_CHARS;
    const active = G.players.filter(p => !p.isStuck()), done = active.filter(p => jt.submissions.has(p)).length;
    return `<div class="row" style="justify-content:space-between"><div><span class="chip r">The Trial · Level ${G.level} · ${esc(G.round.name)}</span><h2 style="margin-top:8px">Write your answer</h2></div>
      <span class="tmr ${S.left <= 10 ? "low" : ""}" id="tmr">${fmt(S.left)}</span></div>
      <div class="panel"><span class="label">Prompt${jt.prompt.custom ? " · custom" : ""}</span><p class="prompt">${esc(jt.prompt.text)}</p></div>
      ${ME.isStuck() ? `<div class="panel"><p>You are Stuck. You watch this round.</p></div>` :
        mine ? `<div class="panel"><span class="label">Submitted</span><p class="txt">${esc(mine)}</p><span class="hint">Waiting for the others. Writing closes early when every active player has submitted.</span></div>` :
        `<div class="panel"><label class="label" for="draft">Your submission · signed with your name</label>
          <textarea id="draft" maxlength="${max}" placeholder="Up to ${max} characters">${esc(S.draft)}</textarea>
          <div class="row" style="justify-content:space-between"><span class="counter" id="cnt">${n} / ${max}</span><button class="btn green" id="submit" ${n ? "" : "disabled"}>Submit</button></div>
          ${S.msg ? `<div class="err">${esc(S.msg)}</div>` : ""}</div>`}
      <span class="hint">${done} of ${active.length} active players have submitted.</span>
      <div class="row"><button class="btn soft sm" id="endNow">Test: end the timer now</button></div>`;
  };

  V.vote = () => {
    const jt = G.round.trial, v = jt.vote, mine = myTeam();
    const choices = v.choicesFor(ME), slots = v.slotsFor(ME), can = !ME.isStuck();
    const subs = G.teams.flatMap(t => t.members.filter(p => jt.submissions.has(p)).map(p => ({ p, t })));
    const opts = `<option value="">Choose</option>` + choices.map(p => `<option value="${p.id}">${esc(p.name)} · ${esc(G.teamOf(p).name)}</option>`).join("");
    const ranks = ["1st (3 points)", "2nd (2 points)", "3rd (1 point)"].slice(0, slots);
    return `<div><span class="chip r">The Vote · Level ${G.level} · ${esc(G.round.name)}</span><h2 style="margin-top:8px">Rank the top ${slots} from other teams</h2>
      <p class="hint" style="margin-top:6px">Prompt: ${esc(jt.prompt.text)}</p></div>
      <div class="subs">${subs.map(({ p, t }) => `<div class="sub ${t === mine ? "own" : ""}"><span class="label">${esc(p.name)} · ${esc(t.name)}${t === mine ? " · your team, cannot rank" : ""}</span><span class="txt">${esc(jt.submissions.get(p))}</span></div>`).join("")}</div>
      ${G.players.some(p => !p.isStuck() && !jt.submissions.has(p)) ? `<span class="hint">Players with no submission are not listed. They cannot be ranked, but they still vote.</span>` : ""}
      ${can ? `<div class="panel">${ranks.map((r, i) => `<div class="field"><label for="rk${i}">${r}</label><select id="rk${i}">${opts}</select></div>`).join("")}
        ${S.msg ? `<div class="err">${esc(S.msg)}</div>` : ""}
        <div class="row"><button class="btn red" id="cast">Cast vote ▶</button></div></div>` :
        `<div class="panel"><p>You are Stuck and cannot vote.</p><div class="row"><button class="btn red" id="cast">Continue ▶</button></div></div>`}`;
  };

  V.result = () => {
    const won = myTeam().won;
    return `<div><span class="chip g">Vote result · Level ${G.level}</span><h2 style="margin-top:8px">${won ? "Your team won" : "Your team lost"}</h2></div>
      <div class="panel"><table><tr><th>Place</th><th>Team</th><th>Vote points</th><th>Score</th><th>1st places</th><th></th></tr>
      ${S.result.map(r => `<tr><td>${r.place}</td><td>${esc(r.team.name)}${r.team === myTeam() ? " (you)" : ""}</td><td>${r.total.toFixed(1)}</td><td>${r.score.toFixed(3)}</td><td>${r.firsts}</td><td>${r.won ? "Win" : ""}</td></tr>`).join("")}</table>
      <span class="hint">Score = vote points / (active players x players who could rank them). Top half win, rounded up.</span></div>
      <div class="row"><button class="btn red" id="next">${G.level === 5 ? "Finish Level 5 and start Level 6 ▶" : "Finish Level 6 ▶"}</button></div>`;
  };

  V.done = () => `<div><span class="chip g">Done</span><h2 style="margin-top:8px">Levels 5 and 6 complete</h2></div>
    <div class="panel"><span class="label">Prompts on this game's record</span>${G.prompts.map(p => `<p>Level ${p.level}${p.custom ? " · custom" : " · list #" + (p.index + 1)}: ${esc(p.text)}</p>`).join("")}</div>
    <div class="row"><button class="btn blue" id="again">Play again</button></div>`;

  function render() {
    $("#where").textContent = G && G.round ? "Level " + G.level + " · " + G.round.name : "";
    $("#stage").innerHTML = V[S.screen]();
    bind();
  }

  function bind() {
    const on = (sel, fn) => { const e = $(sel); if (e) e.onclick = fn; };
    if (S.screen === "setup") {
      on("#go", () => {
        S.name = $("#nm").value; S.type = $("#ty").value; S.host = $("#host").checked;
        newGame(); playLevelsOneToFour(); startJudgedLevel();
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
    if (S.screen === "write") {
      const d = $("#draft");
      if (d) d.addEventListener("input", () => {
        S.draft = d.value;
        const c = G.typeSubmission(ME, d.value);   // typing counts as activity (Attendance check)
        $("#cnt").textContent = c.length + " / " + JT.MAX_CHARS;
        $("#cnt").classList.toggle("over", c.tooLong);
        $("#submit").disabled = !c.length || c.tooLong;
      });
      on("#submit", () => {
        const r = G.submit(ME, S.draft);
        if (!r.ok) { S.msg = r.reason; render(); return; }
        S.msg = "";
        if (r.closed) toVote(); else render();
      });
      on("#endNow", () => { G.closeWriting(); toVote(); });
    }
    if (S.screen === "vote") {
      on("#cast", () => {
        if (!ME.isStuck()) {
          const v = G.round.trial.vote, ids = $$("[id^=rk]").map(s => s.value);
          if (ids.some(x => !x)) { S.msg = "Choose a player for every place."; render(); return; }
          const r = v.cast(ME, ids.map(id => G.players.find(p => String(p.id) === id)));
          if (!r.ok) { S.msg = r.reason; render(); return; }
        }
        finishVote();
      });
    }
    if (S.screen === "result") {
      on("#next", () => {
        finishRoundWithBots();
        if (G.level === 5) startJudgedLevel(); else { S.screen = "done"; render(); }
      });
    }
    if (S.screen === "done") on("#again", () => { G = null; ME = null; S.screen = "setup"; render(); });
  }

  render();
})();
