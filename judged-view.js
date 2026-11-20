/* Shared Level 5-6 judged trial screen (writing, voting, and results).
   Screen code only, shared by index.html (game.js) and pages/vote-test.html (pages/vote-test.js).
   Rules live in rules/Trial.js (JudgedTrial, Vote) and rules/Game.js. */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = x => Math.floor(Math.max(0, x) / 60) + ":" + String(Math.max(0, x) % 60).padStart(2, "0");

  /* opts:
     - game: Game instance
     - me: Player instance
     - team: Team instance (me's team)
     - state: { draft: string, msg: string, picks: string[] }
     - onRender: () => void
     - header: (phase) => string  (optional custom header HTML for "write" | "vote" | "result")
     - costHint: () => string     (optional hint below result table)
     - subsLayout: "cols" | "subs" (default "cols")
     - showVotePoints: boolean    (default false)
     - writeFooter: () => string  (optional HTML below writing view)
     - resultFooter: () => string (optional HTML below result table)
     - onEndNow: () => void       (optional handler for #endNow button)
     - onResultNext: () => void   (optional handler for #next button)
     - onVoteDone: () => void     (optional handler after vote; default runs EP.Bots.vote + G.runTrial) */
  function screen(opts) {
    const G = opts.game, ME = opts.me, MYTEAM = opts.team, state = opts.state;
    const JT = EP.Trial.JudgedTrial, jt = G.round.trial, done = G.didRun("runTrial");
    if (jt.writing === null) { G.startWriting(); EP.Bots.submit(G); }
    if (jt.writing === "closed" && !jt.vote && !done) G.startVote();

    const defaultHdr = () => `<div><span class="chip r">The Trial · Level ${G.level} · ${esc(G.round.name)}</span><h2 style="margin-top:8px">${esc(G.round.name)}</h2></div>`;
    const hdr = ph => (opts.header ? opts.header(ph) : defaultHdr());

    if (done) {
      const rank = jt.ranking || [];
      const vpHead = opts.showVotePoints ? "<th>Vote points</th>" : "";
      const vpCell = r => opts.showVotePoints ? `<td class="n">${r.total.toFixed(1)}</td>` : "";
      const hint = opts.costHint ? `<span class="hint">${opts.costHint()}</span>` : "";
      const footer = opts.resultFooter ? opts.resultFooter() : "";
      const html = `${hdr("result")}<div class="result"><b style="color:${MYTEAM.won ? "var(--ok)" : "var(--bad)"}">Team ${MYTEAM.won ? "WIN" : "LOSS"}.</b><table class="levels"><thead><tr><th>Place</th><th>Team</th>${vpHead}<th>Score</th><th>1st places</th><th>Result</th></tr></thead><tbody>${rank.map(r => `<tr><td class="n">${r.place}</td><td>${esc(r.team.name)}${r.team === MYTEAM ? " (you)" : ""}</td>${vpCell(r)}<td class="n">${r.score.toFixed(3)}</td><td class="n">${r.firsts}</td><td>${r.won ? "Win" : "Loss"}</td></tr>`).join("")}</tbody></table>${hint}</div>${footer}`;
      const bind = rootEl => {
        const nxt = rootEl.querySelector("#next");
        if (nxt && opts.onResultNext) nxt.onclick = opts.onResultNext;
      };
      return { html, bind: opts.onResultNext ? bind : null, waitHint: "Cast your vote first" };
    }

    if (jt.writing === "open") {
      const mine = jt.submissions.get(ME), n = state.draft.trim().length, max = JT.MAX_CHARS;
      const active = G.players.filter(p => p.isActive()), submitted = active.filter(p => jt.submissions.has(p)).length;
      const footer = opts.writeFooter ? opts.writeFooter() : "";
      const html = `${hdr("write")}<div class="panel"><span class="label">Prompt${jt.prompt.custom ? " · custom" : ""}</span><p class="prompt">${esc(jt.prompt.text)}</p></div>
${mine ? `<div class="panel"><span class="label">Submitted</span><p class="txt">${esc(mine)}</p><span class="hint">Waiting for the other players. Writing closes early when everyone active submits.</span></div>`
: `<div class="panel"><label class="label" for="subDraft">Your answer (max ${max} characters)</label><textarea id="subDraft" maxlength="${max}" placeholder="Write your answer...">${esc(state.draft)}</textarea><div class="row" style="justify-content:space-between"><span class="counter" id="subCnt">${n} / ${max}</span><button class="btn green" id="subBtn" ${n && n <= max ? "" : "disabled"}>Submit answer</button></div>${state.msg ? `<div class="err">${esc(state.msg)}</div>` : ""}</div>`}
<span class="hint">${submitted} of ${active.length} active players have submitted.</span>${footer}`;
      const bind = rootEl => {
        const d = rootEl.querySelector("#subDraft");
        if (d) d.addEventListener("input", () => {
          state.draft = d.value;
          const c = G.typeSubmission(ME, d.value);
          const cnt = rootEl.querySelector("#subCnt");
          if (cnt) {
            cnt.textContent = c.length + " / " + max;
            cnt.classList.toggle("over", c.tooLong);
            cnt.style.color = c.tooLong ? "var(--bad)" : "";
          }
          const btn = rootEl.querySelector("#subBtn");
          if (btn) btn.disabled = !c.length || c.tooLong;
        });
        const sub = rootEl.querySelector("#subBtn");
        if (sub) sub.onclick = () => {
          const r = G.submit(ME, state.draft);
          if (!r.ok) { state.msg = r.reason; opts.onRender(); return; }
          state.msg = "";
          if (r.closed && !jt.vote) G.startVote();
          opts.onRender();
        };
        const end = rootEl.querySelector("#endNow");
        if (end && opts.onEndNow) end.onclick = opts.onEndNow;
      };
      return { html, bind, waitHint: "Submit your answer first" };
    }

    const v = jt.vote, choices = v.choicesFor(ME), slots = v.slotsFor(ME), can = !ME.isStuck() && slots > 0;
    const subs = G.teams.flatMap(t => t.members.filter(p => jt.submissions.has(p)).map(p => ({ p, t })));
    const optsHtml = `<option value="">Choose...</option>` + choices.map(p => `<option value="${p.id}">${esc(p.name)} · ${esc(G.teamOf(p).name)}</option>`).join("");
    const labels = ["1st (3 points)", "2nd (2 points)", "3rd (1 point)"].slice(0, slots);
    const subsHtml = opts.subsLayout === "subs"
      ? `<div class="subs">${subs.map(({ p, t }) => `<div class="sub ${t === MYTEAM ? "own" : ""}"><span class="label">${esc(p.name)} · ${esc(t.name)}${t === MYTEAM ? " · your team, cannot rank" : ""}</span><span class="txt">${esc(jt.submissions.get(p))}</span></div>`).join("")}</div>`
      : `<div class="cols">${subs.map(({ p, t }) => `<div class="panel"><span class="label">${esc(p.name)} · ${esc(t.name)}${t === MYTEAM ? " · your team" : ""}</span><p>${esc(jt.submissions.get(p))}</p></div>`).join("")}</div>`;
    const missingHint = G.players.some(p => !p.isStuck() && !jt.submissions.has(p))
      ? `<span class="hint">Players with no submission are not listed. They cannot be ranked, but they still vote.</span>` : "";
    const html = `${hdr("vote")}<div class="panel"><span class="label">Prompt</span><p>${esc(jt.prompt.text)}</p></div>
${subsHtml}${missingHint}
${can ? `<div class="panel"><span class="label">Rank the top ${slots} from other teams</span>${labels.map((lb, i) => `<div class="field"><label for="vote${i}">${lb}</label><select id="vote${i}" data-vpick="${i}">${optsHtml}</select></div>`).join("")}${state.msg ? `<div class="err">${esc(state.msg)}</div>` : ""}<div class="row"><button class="btn red" id="castVote">Cast vote ▶</button></div></div>`
: `<div class="panel"><p>${ME.isStuck() ? "You are Stuck and cannot vote." : "No eligible submissions from other teams to rank."}</p><div class="row"><button class="btn red" id="castVote">See vote result ▶</button></div></div>`}`;
    const bind = rootEl => {
      rootEl.querySelectorAll("[data-vpick]").forEach(sel => {
        const idx = +sel.dataset.vpick;
        if (state.picks[idx]) sel.value = state.picks[idx];
        sel.onchange = () => { state.picks[idx] = sel.value; };
      });
      const cast = rootEl.querySelector("#castVote");
      if (cast) cast.onclick = () => {
        if (can) {
          const ids = Array.from({ length: slots }, (_, i) => (rootEl.querySelector("#vote" + i) || {}).value || "");
          state.picks = ids;
          if (ids.some(x => !x)) { state.msg = "Choose a player for every place."; opts.onRender(); return; }
          G.activity(ME);
          const r = v.cast(ME, ids.map(id => G.players.find(p => String(p.id) === id)));
          if (!r.ok) { state.msg = r.reason; opts.onRender(); return; }
        }
        state.msg = "";
        if (opts.onVoteDone) opts.onVoteDone();
        else { EP.Bots.vote(G, v, G.rng); G.runTrial(); }
        opts.onRender();
      };
    };
    return { html, bind, waitHint: "Cast your vote first" };
  }

  root.JudgedView = { screen, fmt };
})(typeof globalThis !== "undefined" ? globalThis : this);
