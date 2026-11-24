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
     - header: (phase, view) => string  (optional custom header HTML for "write" | "vote" | "result")
     - costHint: () => string           (optional hint below result table)
     - subsLayout: "cols" | "subs"      (default "cols")
     - showVotePoints: boolean          (default false)
     - writeFooter: () => string        (optional HTML below writing view)
     - resultFooter: () => string       (optional HTML below result table)
     - onEndNow: () => void             (optional handler for #endNow button)
     - onResultNext: () => void         (optional handler for #next button)
     - onVoteDone: () => void           (optional callback when vote closes after castVote) */
  function screen(opts) {
    const G = opts.game, ME = opts.me, MYTEAM = opts.team, state = opts.state;
    const view = G.judgedView(ME);
    const defaultHdr = () => `<div><span class="chip r">The Trial · Level ${G.level} · ${esc(G.round.name)}</span><h2 style="margin-top:8px">${esc(G.round.name)}</h2></div>`;
    const hdr = ph => (opts.header ? opts.header(ph, view) : defaultHdr());

    if (!view) return { html: hdr("write"), bind: null, waitHint: "Submit your answer first" };

    if (view.done) {
      const rank = view.ranking || [];
      const mine = rank.find(r => r.isMine);
      const won = mine ? mine.won : MYTEAM.won;
      const vpHead = opts.showVotePoints ? "<th>Vote points</th>" : "";
      const vpCell = r => opts.showVotePoints ? `<td class="n">${r.total.toFixed(1)}</td>` : "";
      const hint = opts.costHint ? `<span class="hint">${opts.costHint()}</span>` : "";
      const footer = opts.resultFooter ? opts.resultFooter() : "";
      const html = `${hdr("result")}<div class="result"><b style="color:${won ? "var(--ok)" : "var(--bad)"}">Team ${won ? "WIN" : "LOSS"}.</b><table class="levels"><thead><tr><th>Place</th><th>Team</th>${vpHead}<th>Score</th><th>1st places</th><th>Result</th></tr></thead><tbody>${rank.map(r => `<tr><td class="n">${r.place}</td><td>${esc(r.teamName)}${r.isMine ? " (you)" : ""}</td>${vpCell(r)}<td class="n">${r.score.toFixed(3)}</td><td class="n">${r.firsts}</td><td>${r.won ? "Win" : "Loss"}</td></tr>`).join("")}</tbody></table>${hint}</div>${footer}`;
      const bind = rootEl => {
        const nxt = rootEl.querySelector("#next");
        if (nxt && opts.onResultNext) nxt.onclick = opts.onResultNext;
      };
      return { html, bind: opts.onResultNext ? bind : null, waitHint: "Cast your vote first" };
    }

    if (view.writing === null) {
      return {
        html: `${hdr("write")}<div class="panel"><p>Waiting for the host to pick a prompt.</p></div>`,
        bind: null,
        waitHint: "Waiting for the host to pick a prompt",
      };
    }

    if (view.writing === "open") {
      const mine = view.mySubmission, n = state.draft.trim().length, max = view.maxChars;
      const footer = opts.writeFooter ? opts.writeFooter() : "";
      const html = `${hdr("write")}<div class="panel"><span class="label">Prompt${view.prompt && view.prompt.custom ? " · custom" : ""}</span><p class="prompt">${esc(view.prompt ? view.prompt.text : "")}</p></div>
${mine ? `<div class="panel"><span class="label">Submitted</span><p class="txt">${esc(mine)}</p><span class="hint">Waiting for the other players. Writing closes early when everyone active submits.</span></div>`
: `<div class="panel"><label class="label" for="subDraft">Your answer (max ${max} characters)</label><textarea id="subDraft" maxlength="${max}" placeholder="Write your answer...">${esc(state.draft)}</textarea><div class="row" style="justify-content:space-between"><span class="counter" id="subCnt">${n} / ${max}</span><button class="btn green" id="subBtn" ${n && n <= max ? "" : "disabled"}>Submit answer</button></div>${state.msg ? `<div class="err">${esc(state.msg)}</div>` : ""}</div>`}
<span class="hint">${view.submittedCount} of ${view.activeCount} active players have submitted.</span>${footer}`;
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
          opts.onRender();
        };
        const end = rootEl.querySelector("#endNow");
        if (end && opts.onEndNow) end.onclick = opts.onEndNow;
      };
      return { html, bind, waitHint: "Submit your answer first" };
    }

    const slots = view.slots, canRank = view.canVote && slots > 0;
    const optsHtml = `<option value="">Choose...</option>` + view.choices.map(p => `<option value="${p.id}">${esc(p.name)} · ${esc(p.teamName)}</option>`).join("");
    const labels = ["1st (3 points)", "2nd (2 points)", "3rd (1 point)"].slice(0, slots);
    const subsHtml = opts.subsLayout === "subs"
      ? `<div class="subs">${view.submissions.map(s => `<div class="sub ${s.isMine ? "own" : ""}"><span class="label">${esc(s.name)} · ${esc(s.teamName)}${s.isMine ? " · your team, cannot rank" : ""}</span><span class="txt">${esc(s.text)}</span></div>`).join("")}</div>`
      : `<div class="cols">${view.submissions.map(s => `<div class="panel"><span class="label">${esc(s.name)} · ${esc(s.teamName)}${s.isMine ? " · your team" : ""}</span><p>${esc(s.text)}</p></div>`).join("")}</div>`;
    const missingHint = view.hasMissingSubmissions
      ? `<span class="hint">Players with no submission are not listed. They cannot be ranked, but they still vote.</span>` : "";

    let votePanel;
    if (view.hasVoted) {
      votePanel = `<div class="panel" id="voteWait"><span class="label">Vote cast</span><p>Your vote is in. Waiting for the other players (${view.votersDone} of ${view.votersTotal} active voters).</p></div>`;
    } else if (canRank) {
      votePanel = `<div class="panel"><span class="label">Rank the top ${slots} from other teams</span>${labels.map((lb, i) => `<div class="field"><label for="vote${i}">${lb}</label><select id="vote${i}" data-vpick="${i}">${optsHtml}</select></div>`).join("")}${state.msg ? `<div class="err">${esc(state.msg)}</div>` : ""}<div class="row"><button class="btn red" id="castVote">Cast vote ▶</button></div></div>`;
    } else if (view.canVote) {
      votePanel = `<div class="panel"><p>No eligible submissions from other teams to rank.</p>${state.msg ? `<div class="err">${esc(state.msg)}</div>` : ""}<div class="row"><button class="btn red" id="castVote">See vote result ▶</button></div></div>`;
    } else {
      votePanel = `<div class="panel"><p>${view.isStuck ? "You are Stuck and cannot vote." : "You are idle and cannot vote until you interact."}</p><span class="hint">Waiting for active players to finish voting (${view.votersDone} of ${view.votersTotal}).</span></div>`;
    }

    const html = `${hdr("vote")}<div class="panel"><span class="label">Prompt</span><p>${esc(view.prompt ? view.prompt.text : "")}</p></div>
${subsHtml}${missingHint}
${votePanel}`;
    const bind = rootEl => {
      rootEl.querySelectorAll("[data-vpick]").forEach(sel => {
        const idx = +sel.dataset.vpick;
        if (state.picks[idx]) sel.value = state.picks[idx];
        sel.onchange = () => { state.picks[idx] = sel.value; };
      });
      const cast = rootEl.querySelector("#castVote");
      if (cast) cast.onclick = () => {
        let ids = [];
        if (canRank) {
          ids = Array.from({ length: slots }, (_, i) => (rootEl.querySelector("#vote" + i) || {}).value || "");
          state.picks = ids;
          if (ids.some(x => !x)) { state.msg = "Choose a player for every place."; opts.onRender(); return; }
        }
        const r = G.castVote(ME, ids);
        if (!r.ok) { state.msg = r.reason; opts.onRender(); return; }
        state.msg = "";
        if (r.closed && opts.onVoteDone) opts.onVoteDone();
        opts.onRender();
      };
    };
    return {
      html,
      bind,
      waitHint: view.hasVoted ? "Waiting for the other players to vote" : "Cast your vote first",
    };
  }

  root.JudgedView = { screen, fmt };
})(typeof globalThis !== "undefined" ? globalThis : this);
