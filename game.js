/* ---------- code rain ---------- */
const WORDS=["JavaScript","Python","HTML","CSS","React","Node.js","SQL","Git","GitHub","API","JSON","TypeScript","Java","C#","Bash","Linux","Docker","Azure","AWS","Cloud","Figma","UX","Agile","Scrum","Sprint","Backlog","Debug","Deploy","Commit","Merge","Excel","Power BI","Base44","flexbox","<div>","async","await","function()","const","return","import","console.log","for loop","if/else","null","true","404","localhost","README","DevOps","Jira","Wireframe","Data","Kanban","Retro","Standup"];
const cv=document.getElementById("rain"),cx=cv.getContext("2d");let cols=[],rainOn=false,FS=20,lastT=0,sized=false;
const pick=()=>WORDS[Math.floor(Math.random()*WORDS.length)];
function sizeRain(){const d=Math.min(2,window.devicePixelRatio||1);cv.width=innerWidth*d;cv.height=innerHeight*d;cx.setTransform(d,0,0,d,0,0);FS=innerWidth<600?16:20;const n=Math.ceil(innerWidth/(FS*1.2));cols=Array.from({length:n},()=>({w:pick(),i:0,y:-Math.random()*innerHeight*1.2,gap:0}));sized=true}
function rainFrame(t){
  if(!rainOn)return;requestAnimationFrame(rainFrame);if(t-lastT<60)return;lastT=t;
  cx.fillStyle="rgba(20,25,34,0.15)";cx.fillRect(0,0,innerWidth,innerHeight);
  cx.font=`${FS}px VT323, ui-monospace, monospace`;cx.textAlign="center";cx.textBaseline="top";
  cols.forEach((c,k)=>{const x=k*FS*1.2+FS/2;
    if(c.gap>0){c.gap--;return}
    const ch=c.w[c.i];
    if(c.y>-FS){cx.fillStyle=Math.random()<.05?"#e0394d":"#3a74ff";cx.fillText(ch,x,c.y-FS);cx.fillStyle="#cfe8ff";cx.fillText(ch,x,c.y)}
    c.y+=FS;c.i++;
    if(c.i>=c.w.length){c.i=0;c.w=pick();c.gap=1+Math.floor(Math.random()*3);c.y+=FS}
    if(c.y>innerHeight+FS){c.y=-Math.random()*innerHeight*.5;c.i=0;c.w=pick()}
  })}
function staticRain(){cx.clearRect(0,0,innerWidth,innerHeight);cx.font=`${FS}px VT323, monospace`;cx.textAlign="center";cx.textBaseline="top";cols.forEach((c,k)=>{const x=k*FS*1.2+FS/2;let y=Math.random()*innerHeight*.7;for(let i=0;i<c.w.length;i++){cx.fillStyle=`rgba(105,170,255,${.12+.45*(i/c.w.length)})`;cx.fillText(c.w[i],x,y);y+=FS}})}
function setRain(level){
  cv.style.opacity=String(level);
  if(!sized){sizeRain();if(matchMedia("(prefers-reduced-motion: reduce)").matches)staticRain();else{rainOn=true;requestAnimationFrame(rainFrame)}}
}
addEventListener("resize",()=>{if(sized){sizeRain();if(!rainOn)staticRain()}});

/* ---------- data ---------- */
const A=[{k:"focus",n:"Focus"},{k:"collab",n:"Collaboration"},{k:"initiative",n:"Initiative"},{k:"grit",n:"Grit"},{k:"composure",n:"Composure"}];
const AN=Object.fromEntries(A.map(a=>[a.k,a.n]));
/* Rule data lives in rules/*.js. These tables only add display text. */
const TYPE_TEXT={
  coop:{blurb:"You lift the team. Strong at working with others and staying calm. Slower to jump in first.",pathDesc:"Cancel 1 teammate glitch with a gift in the gift window."},
  indep:{blurb:"You lock in and push through. Strong focus and grit. Teamwork costs you more.",pathDesc:"Make 1 correct accusation yourself."},
  contra:{blurb:"You question the system. Quick to act and hard to stop. Easier to rattle. Can sabotage.",pathDesc:"Get through 3 sabotage rounds without being caught."}};
/* ct is the rules CharacterType. Ask it (T().ct.canSabotage(), ...) instead of checking the type name. */
const TYPES=Object.fromEntries(EP.CharacterType.all().map(ct=>[ct.key,{ct,n:ct.name,bonus:ct.bonus,pen:ct.penalty,path:ct.pathName,goal:ct.goal,...TYPE_TEXT[ct.key]}]));
/* "1 heart per point", or "1 point costs 2 hearts, 2 points cost 3" */
const giftCostText=ct=>ct.giftCost(1)===1&&ct.giftCost(2)===2?"1 heart per point":`1 point costs ${ct.giftCost(1)} hearts, 2 points cost ${ct.giftCost(2)}`;
const ROUNDS=EP.Round.LEVELS.map(l=>({n:l.n,name:l.name,a:l.attr,c:l.cost}));
const TEAM=[{n:"Juno",av:{body:1,skin:2,hair:7,hairC:3,top:1,topS:3,bot:0,botS:0,hat:4,extra:2,acc:0,tool:0}},{n:"Dex",av:{body:0,skin:8,hair:0,hairC:0,top:6,topS:2,bot:1,botS:0,hat:3,extra:0,acc:0,tool:3}},{n:"Mara",av:{body:0,skin:5,hair:9,hairC:1,top:2,topS:4,bot:0,botS:0,hat:0,extra:4,acc:1,tool:2}}];
const OTHERS=[{t:"Team Wren",p:["Rook","Ivy","Sol","Kai"]},{t:"Team Finch",p:["Tess","Omar","Bea","Lin"]},{t:"Team Heron",p:["Nia","Theo","Ruth","Ash"]}];
const SOP=EP.Trial.SopTrial.STEPS;   // the coffee SOP lives in the rules (Trial.SopTrial)
const DECOY=EP.Trial.SopTrial.ENDLESS;
const CLUES=[
  {level:1,id:"L",kind:"ERROR",where:"Sign-in screen",found:"The title ends in a capital L. Systems don't make typos by accident.",hint:"Something on the very first screen was spelled wrong."},
  {level:1,id:"id",kind:"WATCHER",where:"Your badge",found:"Your intern ID says ATTEMPT 02. You have been here before.",hint:"Your badge flickered. Did you read it closely?"},
  {level:1,id:"loop",kind:"LOOP",where:"SOP trial",found:"One SOP step told you to repeat forever. You left it out.",hint:"One step in the procedure didn't belong."}];
/* Anomalies: the 3 CLUES above are the only ones that count. Ghosts give hints only. */
const anomaliesFound=()=>G&&ME?G.anomaliesFor(ME).length:0;
const STEPS=["Sign in","Menu","Wardrobe","Work style","Arrival","Briefing","Open Floor","Trial","Glitch Report","Stats Update"];
const FAC=[
  ["Players sign in with their i.c.stars email and the join code you give them.","Do NOT mention a simulation. If anyone asks about the capital L, say: \"Please report any issues to IT.\""],
  ["Tell everyone to press PLAY. How to Play is the onboarding packet; give the room 3 minutes with it."],
  ["About 5 minutes in the wardrobe. Names: letters, numbers and spaces only. No real names."],
  ["Work style is secret. Remind players: never tell anyone your type or your numbers.","Everyone ends with 24 total points and 3 hearts."],
  ["Intermission in All Skate. Teams of 4. Move players between teams if needed, then start Level 1."],
  ["Reveal: Boot Up tests Grit. Every player pays 2 Grit after the trial."],
  ["Open Floor: players walk the office. Breakout Room = sabotage a teammate (Contrarians). High Tea = network with a guest for a hint. All Skate = reflect and plan. Conference Room has the emergency button. Kitchen = gift any teammate (also in the gift window).","Live game: ~3 minutes. Demo timer: 90 seconds."],
  ["Teams play the SOP challenge (coffee). Each team scores 1 point per step in the right place, +1 if they leave out the endless step. The top half of teams win."],
  ["All-hands meeting in the Conference Room. Each player may accuse one teammate.","Then open the 30-second gift window. Glitches lock in when it closes."],
  ["Win = 4 points, Loss = 2, glitched = 1. Bonuses: correct accusation +1, Skim, Cash Out. Players place points before the next trial is revealed. Hearts refill by 1."]];
const MEMOS=[["From: Management","Performance reviews are mandatory. Exit is not guaranteed."],["From: IT","We are aware of a typo on the sign-in screen. It is not a typo."],["From: Facilities","The Kitchen coffee machine has been restocked. Again. And again. And again."]];

/* Per-level briefing, ghost/tea hint, and host script tables (keyed by level 1 to 7). */
const BRIEFINGS={
  1:{
    header:"System Briefing · Level 1",
    title:"Boot Up: Team Week",
    memo:"Your first client, a national medical supply company, has sent a Request for Proposal. Before Sprint 1 starts on Sep 8, your team must show it has the grit to see a task through: write a Standard Operating Procedure everyone can follow.",
    phase:"Weeks 1–2: Team Week, teams formed, Medline RFP, SOP challenge",
    workshops:"LW2A Know Your Lens · LW2B Team Agreement",
  },
  2:{
    header:"System Briefing · Level 2",
    title:"Sprint 1: Back-Plan the Demo",
    memo:"Medline wants a demo in 4 days. Your team has more work than time. Each of you holds part of the client brief. Share what you know, pick the 2 tasks that matter, and put them in order. Plans change. Stay alert.",
    phase:"Weeks 2–4 (Sep 8 – Sep 25)",
    workshops:"LW3A Perception vs. Intent · LW3B Roles + Handoff · BW3B Prioritize Under Pressure · W3A 14-Week Budget · BW4A Credibility in Writing · BW4B Tell the Story · LW4A Act on Purpose Under Pressure · W4A Emotional Patterns Map",
  },
  3:{
    header:"System Briefing · Level 3",
    title:"The Mirror: Presentation Day",
    memo:"Today you present to Medline. The call opens in 30 seconds. Every active member must connect before the doors close, or the room empties and your team scores zero. Once you're in, crews are drawn at random. Setup Crew runs the steps in order: cables, sound, mic, deck, Q&A. Dance Crew keeps the audience awake. Attention drains from the moment showtime starts. Finish fast and finish clean.",
    phase:"Week 5 (Oct 1): Medline presentation and Q&A feedback",
    workshops:"Q&A prep · Presentation review",
  },
  4:{
    header:"System Briefing · Level 4",
    title:"Geek Week: Testing Challenge",
    memo:"Sprint 2 begins with a full testing push and artifact catch-up. Bugs do not fix themselves. Step up, test every piece, and close the gaps before the deadline.",
    phase:"Week 6 (Oct 5 – Oct 9): Testing and artifact catch-up",
    workshops:"LW6A Adaptability · LW6B Team Inclusion Audit · BW6B Organize for Outcomes · W6A Reframing for Growth",
  },
  5:{
    header:"System Briefing · Level 5",
    title:"Sprint 2: Fix the Broken Team",
    memo:"Communication gaps and file-version chaos are slowing the build. Write your response to the sprint crisis, then vote on the strongest answers from other teams.",
    phase:"Weeks 6–9 (Oct 5 – Oct 30): Resolution Plan and Signal build",
    workshops:"BW7B Verbal Presence · LW7B Self-Initiated Contribution · BW8A Workflows That Work",
  },
  6:{
    header:"System Briefing · Level 6",
    title:"Sprint 3: Final Build and Dream Speech",
    memo:"Delivery is here. Finish the build, prepare your hand-off, and share your final response. Other teams will rank the strongest answers.",
    phase:"Weeks 10–13 (Nov 2 – Nov 27): Finish, polish, test, hand-off",
    workshops:"Dream Speeches · Digital Portfolio · Career Roadmap",
  },
  7:{
    header:"System Briefing · Level 7",
    title:"Graduation: Final Performance Review",
    memo:"Week 14. Floor 60 reaches its final review. Place your final 3 points and face the exit check: 24 or more total points, every attribute at least 2, and not Stuck. A completed secret path also counts as a win.",
    phase:"Week 14 (Nov 30 – Dec 1): Dry run and final Medline presentation",
    workshops:"Final Performance Review",
  },
};
const LEVEL_HINTS={
  1:{
    ghosts:{
      "USER_???":"Did you read your badge? Read it again.",
      "ATTEMPT_01":"The coffee step that never ends... leave it out.",
      "NULL":"Someone on Team Wren keeps slipping into the Breakout Room.",
    },
    tea:"When I wrote my first SOP, I put in a step that never ended. A good procedure has no step that sends you in circles. If a step never ends, it doesn't belong.",
  },
  2:{
    ghosts:{
      "ATTEMPT_01":"We locked our plan in early. Then the client changed everything.",
      "NULL":"Not every note is true. Check who wrote it.",
      "USER_???":"The news comes halfway through. Only one of you hears it first.",
    },
    tea:"On my first sprint, we committed to a plan on day one. Halfway through, our vendor went down and the plan was dead. Now I wait for the news before I commit. And whoever hears it first tells everyone.",
  },
  3:{
    ghosts:{
      "USER_???":"The doors closed with one of us still outside. They don't wait for stragglers. Neither does the client.",
      "ATTEMPT_01":"I grabbed the first deck I saw. Draft. Wrong version. The client only trusts what they signed.",
      "NULL":"Seventy to eighty-five. Louder is not better. When the crowd roars, pull the sound down.",
    },
    tea:"My first client demo, the projector cable didn't fit. We had tested everything except the room. Now I check the setup first, I keep the signed version of the deck in one place, and I know the client's problem cold before anyone asks me a question. A presentation fails in the setup long before it fails on stage.",
  },
  4:{
    ghosts:{
      "USER_???":"Half-built tests break when nobody is looking.",
      "ATTEMPT_01":"Every bug left in Week 6 comes back twice as loud in Sprint 2.",
      "NULL":"Initiative costs more than you think.",
    },
    tea:"In Geek Week we thought catching up later would work. Waiting until Monday only stacked the work higher.",
  },
  5:{
    ghosts:{
      "USER_???":"Other teams are reading what you write. Say what you would actually do.",
      "ATTEMPT_01":"Composure drops fast when two sprints collide.",
      "NULL":"You cannot vote for your own team. Earn theirs.",
    },
    tea:"When a sprint stalls over version chaos, the person who stays calm and owns the next step moves the whole room.",
  },
  6:{
    ghosts:{
      "USER_???":"One floor left. Check your numbers before the final bell.",
      "ATTEMPT_01":"Five points is a steep price if your Composure is thin.",
      "NULL":"Every round counts toward who leaves Floor 60.",
    },
    tea:"At hand-off, the client only keeps what works cleanly. Cut the noise and ship what stands on its own.",
  },
  7:{
    ghosts:{
      "USER_???":"Every attribute at 2 or higher. Total 24. Do the math.",
      "ATTEMPT_01":"The elevator remembers everyone who stayed.",
      "NULL":"Even if the numbers miss, a second path still opens the door.",
    },
    tea:"There is no trick left on Floor 7. Either the record holds together or the contract renews.",
  },
};
const FAC_BY_LEVEL={
  1:{
    5:FAC[5],
    7:FAC[7],
  },
  2:{
    5:["Reveal: Sprint 1 tests Collaboration. Every player pays 3 Collaboration after the trial."],
    7:["Teams play Split Brief (Collaboration, cost 3). Each player gets private brief cards and can share up to 3 team notes (80 characters max).","Teams pick 2 tasks in order on the board. Halfway through the 180-second timer (at 90s), one active player per team gets a twist card.","Post-twist scoring is out of 5. Ties after influence break to the earliest Lock In after the twist fired, then random. Top half win."],
  },
  3:{
    5:["Level 3. Presentation Day. Read the memo. You present to the Medline client today."],
    7:{
      lobby:["Doors open. Connect to the call in the next 30 seconds. Anyone left outside, the whole team fails."],
      showtime:["Crews are locked. Setup, work your steps in order. Dancers, keep the room awake. Attention is draining. Go."],
    },
  },
  4:{
    5:["Reveal: Geek Week tests Initiative. Every player pays 4 Initiative after the trial."],
    7:["Placeholder AutoTrial (Initiative, cost 4). Teams run the trial for a random 0 to 7 score plus light stat influence. Top half win."],
  },
  5:{
    5:["Reveal: Sprint 2 tests Composure. Every player pays 4 Composure after the trial."],
    7:["Judged trial (Composure, cost 4). Players write an answer (3-minute timer, 300 characters max), then rank top 3 submissions from other teams. Top half win."],
  },
  6:{
    5:["Reveal: Sprint 3 tests Composure. Every player pays 5 Composure after the trial."],
    7:["Judged trial (Composure, cost 5). Players write an answer (3-minute timer, 300 characters max), then rank top 3 submissions from other teams. Top half win."],
  },
  7:{
    5:["Final review: no trial cost. Players go straight to Graduation to place their final 3 points."],
    9:["Graduation check: 24+ total points, every attribute 2+, not Stuck, or a completed secret path. Lock in final points or wait out the 60-second timer to see endings."],
  },
};
const currentLevel=()=>G&&G.level?G.level:1;
function ghostHint(name){const h=LEVEL_HINTS[currentLevel()]||LEVEL_HINTS[1];return (h.ghosts&&h.ghosts[name])||LEVEL_HINTS[1].ghosts[name]||"";}
function teaHint(){const h=LEVEL_HINTS[currentLevel()]||LEVEL_HINTS[1];return h.tea||LEVEL_HINTS[1].tea;}
function facLines(step,level,phase){const byLv=FAC_BY_LEVEL[level],entry=byLv&&byLv[step];if(entry&&!Array.isArray(entry)){const p=phase||(G&&G.mirrorPhase?G.mirrorPhase():null);if(p==="lobby")return entry.lobby;if(p==="reveal"||p==="showtime")return entry.showtime;return [...entry.lobby,...entry.showtime]}return entry||FAC[step]||[];}

/* ---------- state ---------- */
const fresh=()=>({step:0,maxStep:0,menu:"map",email:"",code:"",pendingL:false,
  av:{body:1,skin:7,hair:4,hairC:0,top:0,topS:1,bot:1,botS:1,hat:0,extra:3,acc:4,tool:4},name:"",draft:"",tab:"body",
  type:null,spend:{focus:0,initiative:0,collab:0,composure:0,grit:0},
  room:"studio",arrived:false,arr:"elev",arrLine:0,doorsDone:false,pos:{x:100,y:710},visited:{elevator:true},panel:false,wroom:"elevator",nearGhost:0,
  of:{msg:""},mmHidden:false,
  sop:{pile:[],submitted:false},/* pile: display order only. The board itself is in Game (G.sopBoard). */
  trialUI:{draft:"",msg:"",picks:["","",""],noteDraft:"",confirmLock:false,twistDismissed:false},   /* countdowns: Game deadlines */
  });
let S=fresh();

/* ---------- rules engine session ----------
   G is the Game object from rules/Game.js. It owns every rule number.
   ME is your Player. S above only holds screen state. */
let G=null,ME=null,MYTEAM=null;
const MATE=n=>G&&G.players.find(p=>p.name===n);
function newSession(){
  ({game:G,me:ME,team:MYTEAM}=EP.Bots.soloGame({me:{name:S.name,type:S.type,spend:S.spend},
    myTeam:{name:"Team Kestrel",mates:TEAM.map(p=>p.n)},others:OTHERS.map(o=>({name:o.t,players:o.p})),
    rng:EP.Rng.seeded(EP.Rng.randomSeed()),hooks:EP.Bots.hooks}));   /* seeded so the game can be saved; bots act through Game hooks */
  if(S.pendingL){G.recordAnomaly(ME,"L");S.pendingL=false}
}
/* Round progress comes from Game, not from screen flags. */
const floorOpen=()=>!!G&&G.step==="openFloor";
const trialDone=()=>!!G&&G.didRun("runTrial");
const accDone=()=>!!G&&G.didRun("endGlitchReport");
const gwClosed=()=>!!G&&G.didRun("lockIn");
const roundDone=()=>!!G&&G.didRun("finishRound");
function endSession(){if(currentTrialView&&currentTrialView.cleanup)currentTrialView.cleanup();currentTrialView=null;G=null;ME=null;MYTEAM=null}
/* Sign out keeps only the display name, saved under the email. Look, tool and progress reset.
   The name comes back on the next sign-in with the same email. */
const NAMES={};
const nameKey=em=>String(em||"").trim().toLowerCase();
function savedName(em){const k=nameKey(em);if(NAMES[k])return NAMES[k];try{return (JSON.parse(localStorage.getItem("ep.names")||"{}"))[k]||""}catch(e){return ""}}
function saveName(em,name){const k=nameKey(em);if(!k||!name)return;NAMES[k]=name;try{const all=JSON.parse(localStorage.getItem("ep.names")||"{}");all[k]=name;localStorage.setItem("ep.names",JSON.stringify(all))}catch(e){}}
function signOut(){saveName(S.email,S.name);endSession();S=fresh();render()}
function resetRoundUI(){
  S.panel=false;S.of={msg:""};S.sop={pile:[],submitted:false};
  S.trialUI={draft:"",msg:"",picks:["","",""],noteDraft:"",confirmLock:false,twistDismissed:false};
}
function startLevel(){if(!G.level){if(G.timer)G.closeTimer();else{G.startNextRound();if(!G.running)G.start()}}go(5)}
function startNextLevel(){
  if(!G||!roundDone()||G.level>=7)return;
  resetRoundUI();
  G.startNextRound();
  go(5);
}
const LEVEL1={...EP.Round.LEVELS[0],isFinal:false};
const R=()=>(G&&ME&&G.roundSummary(ME))||LEVEL1;

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const aOrAn=w=>(/^[aeiou]/i.test(w)?"an ":"a ")+w;   // "an Independent", "a Contrarian"
const shownName=()=>S.name||"Guest";   // one name source for the top bar and My Badge
const T=()=>TYPES[S.type];
const isBonus=k=>!!S.type&&T().ct.isBonus(k);
const maxOf=k=>S.type?T().ct.max(k):EP.CharacterType.MAX;
const spendLeft=()=>EP.Player.spendLeft(S.spend);
const fmt=x=>Math.floor(Math.max(0,x)/60)+":"+String(Math.max(0,x)%60).padStart(2,"0");
function cleanName(v){return v.replace(/[^A-Za-z0-9 ]/g,"").replace(/\s{2,}/g," ").replace(/^\s+/,"").slice(0,16)}
const status=()=>ME?ME.boardStatus():"Active";
const flag=s=>`<span class="flag ${s==="At risk"?"risk":s}">${s}</span>`;
const HEART=on=>`<svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 20.5 3.2 12A5.3 5.3 0 0 1 12 4.6 5.3 5.3 0 0 1 20.8 12Z" fill="${on?"#e0394d":"#3a1520"}" stroke="#0b0e13" stroke-width="2.4" stroke-linejoin="round"/>${on?'<path d="M7 8.5a2.5 2.5 0 0 1 3-1.5" stroke="#ffb3bd" stroke-width="1.8" fill="none" stroke-linecap="round"/>':""}</svg>`;
/* Timers live in Game (Part 13): each timed step has a deadline. The countdown reads it.
   One page clock asks Game to close any timer that ran out (G.tick), then follows on screen. */
function drawTimer(poll=true){
  const tv=G?G.timerView():null,s=tv?tv.secondsLeft:null,txt=fmt(s==null?0:s),low=s!=null&&s<=10;
  const b=$("#banner"),bt=$("#bannerT"),cin=S.step===4&&!S.arrived;
  const label=tv?TIMER_LABELS[tv.name]||null:null;
  const showB=!cin&&!!label;
  if(b){b.hidden=!showB;if(showB&&bt)bt.textContent=label}
  for(const id of ["#tmr","#floorTmr","#gwTmr"]){const e=$(id);if(e){e.textContent=txt;e.classList.toggle("low",low)}}
  if(currentTrialView&&currentTrialView.tick)currentTrialView.tick(txt,low);
  if(poll&&G&&ATT)ATT.sync(G.pollAttendance());
}
function stepForGame(){
  if(!G)return S.step;
  switch(G.step){
    case "intermission":return G.level===0?4:9;
    case "briefing":return 5;
    case "openFloor":return 6;
    case "trial":return 7;
    case "glitchReport":case "giftWindow":case "lockIn":return 8;
    case "statsUpdate":case "graduation":return 9;
    default:return S.step;
  }
}
function afterClose(closed){
  let target=null;
  for(const n of closed){
    if(n==="intermission"){if(S.step===4)target=5}
    else if(n==="openFloor"){if(S.step===6)target=7}
    else if(n==="writing"){S.trialUI.msg=""}
    else if(n==="giftWindow"){if(S.step===8)target=9}
  }
  const synced=closed.length?stepForGame():null;
  if(synced!=null)target=synced;
  if(target!=null&&target!==S.step)go(target);
  else render();
  if(G&&ATT)ATT.sync(G.pollAttendance());
}
setInterval(()=>{if(!G)return;const closed=G.tick();if(closed.length)afterClose(closed);else drawTimer()},250);

/* ---------- navigation ---------- */
function canBack(){if(S.step===0||S.step>=5)return false;if(S.maxStep>=5)return false;if(G&&G.over)return false;return true}
function fwd(){
  switch(S.step){
    case 0:return{label:"Clock in ▶",ok:true,cls:"red"};
    case 1:return{label:"Play ▶",ok:true,cls:"red"};
    case 2:return{label:"Save look ▶",ok:S.draft.trim().length>=2,cls:"green"};
    case 3:return{label:"Confirm stats ▶",ok:!!S.type&&spendLeft()===0,cls:"red"};
    case 4:return S.arrived?{label:`Start Level ${(G?G.level:0)+1} ▶`,ok:true,cls:"red"}:{label:S.arr==="elev"?"Skip intro ▶":"Continue ▶",ok:S.arr!=="spawn",cls:"blue"};
    case 5:return{label:R().isFinal?"Go to Graduation ▶":"Open the floor ▶",ok:true,cls:"red"};
    case 6:return floorOpen()?{label:"Waiting for timer",ok:false,cls:"soft"}:{label:"Ready for trial ▶",ok:true,cls:"red"};
    case 7:return{label:"All-hands ▶",ok:trialDone(),cls:"red"};
    case 8:return{label:"Stats Update ▶",ok:gwClosed(),cls:"red"};
    case 9:
      if(G&&G.over)return{label:"Game complete",ok:false,cls:"soft"};
      if(R().isFinal){
        if(ME.isStuck()||ME.earned===0)return{label:ME.placedThisRound>0?"Points locked in":"Waiting for timer",ok:false,cls:"soft"};
        return{label:"Lock in final points ▶",ok:placeLeft()===0,cls:"green"};
      }
      if(roundDone()){
        if(R().n===3)return{label:"Level 4 locked",ok:false,cls:"soft"};
        const nx=EP.Round.LEVELS[R().n]||null;
        return{label:`Start Level ${nx?nx.n:R().n+1} ▶`,ok:true,cls:"red"};
      }
      if(ME.isStuck()||ME.earned===0)return{label:ME.placedThisRound>0?"Points locked in":"Waiting for timer",ok:false,cls:"soft"};
      return{label:"Lock in points",ok:placeLeft()===0,cls:"green"};
  }
}
function goForward(){
  if(!fwd().ok)return;
  switch(S.step){
    case 0:$("#signForm").requestSubmit();return;
    case 1:go(2);return;
    case 2:S.name=S.draft.trim();if(S.wardFrom==="badge"){S.menu="badge";go(1)}else go(3);return;
    case 3:if(S.maxStep<5)newSession();go(4);return;
    case 4:if(!S.arrived){if(S.arr==="elev")skipArrival();else arrivalAdvance();return}startLevel();return;
    case 5:if(G.step==="briefing")G.advance();go(R().isFinal?9:6);return;   /* Briefing > Open Floor or Graduation */
    case 6:if(!floorOpen())go(7);return;
    case 7:payCost();go(8);return;
    case 9:if(G&&G.over)return;if(R().n===3&&roundDone())return;if(!R().isFinal&&roundDone())startNextLevel();else lockPoints();return;
    default:go(S.step+1);
  }
}
const milestoneTitle=()=>R().n===2?"Sprint 1 Complete":R().n===3?"Presentation Day Complete":null;
function updateNav(){
  const b=$("#navBack"),n=$("#navNext"),f=fwd();
  b.hidden=S.step===0;b.disabled=!canBack();
  b.textContent=S.step===1?"◀ Sign out":"◀ Back";
  n.textContent=f.label;n.disabled=!f.ok;n.className="btn "+f.cls;
  const stepText=S.step===9&&R().isFinal?(G&&G.over?"Final Results":"Graduation"):S.step===9&&roundDone()&&milestoneTitle()?milestoneTitle():STEPS[S.step];
  const wait7=(currentTrialView&&currentTrialView.waitHint)||"Finish the trial first";
  const sm=G&&ME?G.roundSummary(ME):null;
  const wait8=!accDone()&&sm&&sm.accusation.done?"Waiting for the Glitch Report timer":"Finish the accusation and gift window";
  $("#navMid").textContent=f.ok||S.step===9?stepText:({2:"Type a name to continue",3:"Pick a style and place all 15 points",6:"Open Floor ends when the timer runs out",7:wait7,8:wait8}[S.step]||stepText);
}

/* ---------- chrome ---------- */
const TIMER_LABELS={
  intermission:"Intermission",openFloor:"Open Floor",
  sop:"The Trial",splitBrief:"The Trial",mirrorLobby:"The Trial",mirrorReveal:"The Trial",mirrorShowtime:"The Trial",writing:"The Trial",
  glitchReport:"Glitch Report",giftWindow:"Gift Window",statsUpdate:"Stats Update",graduation:"Graduation"
};
function chrome(){
  const inGame=S.step>=5;
  setRain(S.step===0?1:S.step===1?.18:.06);
  document.body.classList.toggle("menucur",S.step<=2);
  $("#topbar").hidden=S.step===0;
  $("#whoName").textContent=shownName();
  $("#boardBtn").hidden=!(G&&S.step>=5);   /* Progress board: from the Level 1 briefing on */
  $("#fsBtn").hidden=S.step<4;   /* Full screen: every game screen, from the lobby on */
  $("#where").textContent=inGame?`Level ${R().n} · ${R().name}`:STEPS[S.step];
  $("#stage").classList.toggle("boxed",S.step>=3);
  $("#steps").hidden=S.step<=1||(S.step===4&&!S.arrived);
  const stepLabel=S.step===9&&R().isFinal?(G&&G.over?"Results":"Graduation"):S.step===9&&roundDone()&&milestoneTitle()?milestoneTitle():STEPS[S.step];
  $("#steps").innerHTML=STEPS.map((t,i)=>`<li class="${i===S.step?"on":i<S.step?"done":""}">${i===9&&R().isFinal?(G&&G.over?"Results":"Graduation"):i===9&&roundDone()&&milestoneTitle()?milestoneTitle():t}</li>`).join("");
  $("#fac").innerHTML=`<span class="label">Host script · ${stepLabel}</span><ul>${facLines(S.step,R().n).map(l=>`<li>${esc(l)}</li>`).join("")}</ul>`;
  const cin=S.step===4&&!S.arrived;
  drawTimer(false);
  const h=$("#hud");
  if(!ME||S.step<4||cin){h.hidden=true}else{h.hidden=false;
  h.innerHTML=A.map(a=>{const v=ME.attrs[a.k];return `<div class="attr ${isBonus(a.k)?"bonus":""}"><div class="top"><span>${a.n}</span><span class="v ${v<0?"neg":""}">${v}/${maxOf(a.k)}</span></div><span class="trk"><i style="width:${Math.max(0,v)/maxOf(a.k)*100}%"></i></span></div>`}).join("")+
  `<div class="side"><div class="row" style="justify-content:space-between;gap:6px"><span class="label">Hearts</span><span class="hearts">${Array.from({length:EP.Hearts.CAP},(_,i)=>HEART(i<ME.hearts.count)).join("")}</span></div><div class="row" style="justify-content:space-between;gap:6px"><span class="label">Glitches</span><span class="label" id="hudGlitches" style="color:${ME.glitches?"var(--pink)":"var(--muted)"}">${ME.glitches}/${EP.Player.STUCK_AT}</span></div><div class="row" style="justify-content:space-between;gap:6px"><span class="label">Status</span>${flag(status())}</div><div class="row" style="justify-content:space-between;gap:6px"><span class="label">Anomalies</span><span class="label" style="color:var(--pink)">${anomaliesFound()}/${CLUES.length}</span></div></div>`;}
  updateNav();
}
/* The Wardrobe name box edits S.draft. S.name changes only on Save. */
function go(n){S.panel=false;if(n!==2)S.wardFrom=null;if(n===2&&S.step!==2)S.draft=S.name;S.step=n;S.maxStep=Math.max(S.maxStep,n);$(".wrap").scrollTo({top:0});render()}

/* ---------- views ---------- */
const V=[];
V[0]=()=>`<div class="login"><div class="login-inner">
  <div class="logo" aria-label="Exit_ProtocoL"><span class="w1">EXIT_</span><span class="w2">PROTOCO<button class="glitch-L ${S.pendingL||(G&&ME&&G.anomaliesFor(ME).includes("L"))?"found":""}" id="theL" aria-label="Letter L">L</button></span></div>
  <div class="boot"><span>&gt; loading employee_profile ....... ok</span><span>&gt; assigning cohort CYCLE_60 ...... ok</span><span>&gt; checking exit_conditions ....... <span class="s">NOT FOUND</span></span></div>
  <div class="idcard"><div class="strip"><b>Employee access</b><span>i.c.stars only</span></div>
  <form id="signForm" novalidate>
    <div class="field"><label for="em">i.c.stars email</label><input type="email" id="em" autocomplete="email" placeholder="you@icstars.org" value="${esc(S.email)}"></div>
    <div class="field"><label for="jc">Join code</label><input type="text" id="jc" autocomplete="off" placeholder="FROM YOUR HOST" value="${esc(S.code)}" style="text-transform:uppercase"></div>
    <div class="err" id="signErr" role="alert"></div>
    <button class="btn red" type="submit">Clock in</button>
    <div class="row" style="justify-content:space-between"><span class="label">Demo code: CYCLE60</span><span class="barcode" style="width:120px"></span></div>
  </form></div></div></div>`;

function screenContent(){
  if(S.menu==="howto")return `<span class="title">How to Play</span><div class="rule"></div><p class="hint">Meet your instructors. Press Next on each one.</p>${dialogsHTML()}${packet()}`;
  if(S.menu==="memos")return `<span class="title">Memos</span><div class="rule"></div><div style="display:grid;gap:10px">${MEMOS.map(([f,t])=>`<div class="memo"><span class="label">${f}</span><p>${esc(t)}</p></div>`).join("")}</div>`;
  if(S.menu==="badge")return `<span class="title">My Badge</span><div class="rule"></div>${badgeCard()}`;
  return `<span class="rec">LIVE · FLOOR 60</span><span class="title">The Office</span><div class="rule"></div><div class="mapwrap fog">${minimapSVG(false)}</div><p class="hint">Floor 60 of 7 floors. You won't see the whole floor until you walk it. Rooms marked LVL stay locked until later levels. Press <b>Play</b> to design your character and take the elevator up.</p>`;
}
function badgeCard(){const idn=String(((S.name.length*37)+S.email.length*11)%900+100),ps=G&&ME?G.playerState(ME):null,lv=ps?ps.level:0,dn=ps?ps.levelsDone:0,hasId=G&&ME&&G.anomaliesFor(ME).includes("id");
  return `<div class="badgecard"><div class="bc-pic">${avatarSVG(S.av,{label:"Badge photo"})}</div><div class="bc-data">
   <span class="wide"><span class="k">Employee ID</span><br><button class="idline ${hasId?"found":""}" id="idline" style="color:#13294b">060-${idn} · <span class="flick">ATTEMPT 02</span></button></span>
   <span class="wide"><span class="k">Display name</span><br><span class="v">${esc(shownName())}</span></span>
   <span><span class="k">Team</span><br><span class="v">Kestrel</span></span><span><span class="k">Cohort</span><br><span class="v">Cycle 60</span></span>
   <span><span class="k">Level</span><br><span class="v">${lv}</span></span><span><span class="k">XP · ${dn} of 7 levels</span><div class="xp"><i style="width:${Math.round(dn/7*100)}%"></i></div></span>
  </div></div><div class="row" style="justify-content:center"><button class="btn outline" id="toWardrobe">Change look</button><button class="btn outline" id="toName">Change name</button></div>`}
function packet(){return `<div style="display:grid;gap:12px">
  <div class="memo"><span class="label">Onboarding packet · Cycle 60</span><p>You've been given a second chance: a 14-week tech internship. Everything here looks normal. Learn fast, support your team and pass each review. Complete all 7 phases and pass your final <b>Performance Review</b> to exit. Interns who don't qualify are kept on for another contract.</p>
  <p style="font-family:var(--code);font-size:1.2rem;color:var(--red2)">&gt; note: exit_conditions could not be located. Continue anyway.</p></div>
  <div class="cols"><div class="panel"><span class="chip b">5 attributes</span><p>Focus, Collaboration, Initiative, Grit and Composure. Each review tests one and costs points from it.</p></div>
  <div class="panel"><span class="chip r">3 hearts</span><p>They cover you when an attribute runs short. Refill 1 per round.</p></div>
  <div class="panel"><span class="chip p">Glitches</span><p>Below 0 and you glitch. A teammate's gift can save you. Glitch twice and you're stuck.</p></div>
  <div class="panel"><span class="chip g">To exit</span><p>By Level 7: ${EP.Player.GRAD_TOTAL}+ total points, every attribute ${EP.Player.GRAD_MIN}+, not stuck.</p></div></div>
  <div class="panel"><span class="label">Work style extras</span><div class="cols"><div><b>Skim (Contrarian)</b><p class="hint">+1 point for each round you sabotage and nobody catches you. Up to ${EP.Player.SKIM_MAX} per game.</p></div><div><b>Cash Out (Independent)</b><p class="hint">Once per game at Stats Update, with full hearts: trade ${EP.Player.CASHOUT_COST} hearts for 1 point.</p></div><div><b>Heart loss (Cooperative)</b><p class="hint">When a teammate's glitch locks in, each Cooperative on the team loses 1 heart.</p></div><div><b>Gifts to Independents</b><p class="hint">Independents cannot accept gifts. A gift to one comes back to you as a decline, and your hearts return.</p></div></div></div>
  <div class="panel tw"><table class="levels"><thead><tr><th>Level</th><th>Phase</th><th>Tests</th><th>Cost</th></tr></thead><tbody>
  ${ROUNDS.map(r=>`<tr><td class="n">${r.n}</td><td>${r.name}</td><td>${r.a?"Revealed at briefing":"Final review"}</td><td class="n">${r.n===1?r.c:r.c?"?":"0"}</td></tr>`).join("")}
  </tbody></table></div></div>`}
V[1]=()=>`<div class="client">
  <div class="frame side-menu">
    <div class="mlogo"><span class="a">EXIT_</span><span class="b">PROTOCOL</span></div>
    <div class="menu-box">
      <button class="big red" id="play"><span class="art">${avatarSVG(S.av,{head:true,label:""})}</span>Play</button>
      <button class="big" id="howTo"><span class="art">${IC.clip}</span>How to play</button>
      <button class="big" id="wardrobe"><span class="art">${IC.hanger}</span>Wardrobe</button>
    </div>
    <div class="menu-box">
      <button class="small" data-menu="map" aria-pressed="${S.menu==="map"}">${IC.map}Office map</button>
      <button class="small" data-menu="memos" aria-pressed="${S.menu==="memos"}">${IC.memo}Memos</button>
      <button class="small" data-menu="badge" aria-pressed="${S.menu==="badge"}">${IC.badge}My badge</button>
      <button class="small" disabled aria-label="Settings, coming soon">${IC.wrench}<span>Settings <span class="soon">Coming soon</span></span></button>
    </div>
    <span class="ver">v0.6 · cycle_60 · build 060-02</span>
  </div>
  <div class="screen">${screenContent()}</div></div>`;

function swRow(key,list,label){return `<span class="label">${label}</span><div class="swg">${list.map((c,i)=>`<button class="sw" data-k="${key}" data-i="${i}" style="background:${c}" aria-label="${label} ${i+1}" aria-pressed="${S.av[key]===i}"></button>`).join("")}</div>`}
function itRow(key,list,label,head,legs){return `<span class="label">${label}</span><div class="itg">${list.map((o,i)=>`<button class="it" data-k="${key}" data-i="${i}" aria-pressed="${S.av[key]===i}">${avatarSVG({...S.av,[key]:i},{head,legs,label:o})}${o}</button>`).join("")}</div>`}
V[2]=()=>{const t=S.tab,a=S.av;let left="",nm="",tag="Equipped";
  if(t==="body"){left=`<h3>Character</h3>${itRow("body",BODY,"Pick one",false)}${swRow("skin",SKIN,"Skin tone")}`;nm=BODY[a.body]}
  else if(t==="hair"){left=`<h3>Hair</h3>${itRow("hair",HAIR,"Style",true)}${swRow("hairC",HAIRC,"Hair color")}`;nm=HAIR[a.hair]}
  else if(t==="outfit"){left=`<h3>Outfit</h3>${itRow("topS",TOP,"Top",false)}${swRow("top",CLOTH,"Top color")}${itRow("botS",BOT,"Bottoms",false,true)}${swRow("bot",BOTC,"Bottom color")}`;nm=TOP[a.topS]+" + "+BOT[a.botS]}
  else if(t==="acc"){left=`<h3>Accessories</h3>${itRow("hat",HAT,"Hats",true)}${itRow("extra",EXTRA,"Extras",true)}${swRow("acc",CLOTH,"Hat, wrap and accessory color")}`;nm=HAT[a.hat]==="None"?EXTRA[a.extra]:HAT[a.hat];if(HAT[a.hat]==="None"&&EXTRA[a.extra]==="None")tag="Nothing equipped"}
  else{left=`<h3>Tool</h3><p class="hint">Carry one office tool. Abilities are being playtested by the team.</p><div class="toolg">${TOOLS.map((x,i)=>`<button class="tl" data-k="tool" data-i="${i}" aria-pressed="${a.tool===i}" style="--r:${x.r}"><span class="ta">${pix(x.m,x.p)}</span><span><b>${x.n}</b><span class="rar">${x.rar}</span><span class="ab">${x.ab}</span><span class="td">${x.d}</span></span></button>`).join("")}</div>`;nm=TOOLS[a.tool].n}
  return `<div class="wardrobe">
  <div class="wtabs" role="tablist"><button class="xclose" id="closeW" aria-label="Back to menu">✕</button>${WTABS.map(([k,l])=>`<button class="wt" role="tab" data-tab="${k}" aria-selected="${t===k}" aria-label="${l}">${tabIcon(k)}<span>${l}</span></button>`).join("")}<button class="btn soft sm" id="rand" style="margin-left:auto">Randomize</button></div>
  <div class="wbody">
    <div class="wleft">${left}</div>
    <div class="wright"><div class="fig">${avatarSVG(a,{label:"Your character"})}</div><span class="eqname">${esc(nm)}</span><span class="eqtag">${tag}</span>
      <span class="toolchip">${pix(TOOLS[a.tool].m,TOOLS[a.tool].p,4)}${TOOLS[a.tool].n}</span>
      <div class="namebar"><label for="nm" class="label" style="color:var(--sky)">Display name</label><input type="text" id="nm" maxlength="16" value="${esc(S.draft)}" placeholder="2–16 characters"><span class="namemsg" id="nmMsg">Letters, numbers and spaces only. No real names.</span></div>
    </div>
  </div></div>`};

V[3]=()=>{const left=spendLeft(),P=EP.Player,CT=EP.CharacterType;return `<div><span class="chip p">Secret</span><h2 style="margin-top:8px">Pick your work style</h2><p class="hint" style="margin-top:6px">Only you and the host see this. Other players only see your character, name, team and status.</p></div>
<div class="types">${Object.entries(TYPES).map(([k,t])=>`<button class="type" data-type="${k}" aria-pressed="${S.type===k}" ${S.maxStep>=5?"disabled":""}><h3>${t.n}</h3><span style="opacity:.9">${t.blurb}</span>
  <span class="row" style="gap:6px">${t.bonus.map(b=>`<span class="tag b">+${P.BOOST} ${AN[b]}</span>`).join("")}<span class="tag p">${AN[t.pen]} max ${CT.PEN_MAX}</span></span>
  <span style="opacity:.9;font-size:.92rem"><b>Secret path · ${t.path}:</b> ${t.pathDesc}</span></button>`).join("")}</div>
${S.type?`<div class="row" style="justify-content:space-between"><h3>Spend your points</h3><span class="counter" style="color:${left?"var(--gold)":"var(--ok)"}">${left} of ${P.SPEND} left</span></div>
<p class="hint">Every attribute starts at ${P.START_EACH}. Bonus attributes get +${P.BOOST} after you confirm. Max is ${CT.MAX} (your weak attribute caps at ${CT.PEN_MAX}).</p>
<div class="buy">${A.map(a=>{const v=P.START_EACH+S.spend[a.k];return `<div class="brow"><span class="nm">${a.n}${isBonus(a.k)?`<span class="tag b">+${P.BOOST} bonus</span>`:""}${T().pen===a.k?`<span class="tag p">max ${CT.PEN_MAX}</span>`:""}</span>
  <span class="step"><button class="minus" data-dec="${a.k}" aria-label="Lower ${a.n}" ${!P.canLower(S.spend,a.k)?"disabled":""}>−</button><span class="val">${v}</span><button class="plus" data-inc="${a.k}" aria-label="Raise ${a.n}" ${!P.canRaise(S.type,S.spend,a.k)?"disabled":""}>+</button></span>
  <span class="fin">final ${P.startValue(S.type,S.spend,a.k)}</span></div>`}).join("")}</div>`:""}`};

function personRow(p,me){return `<div class="person"><span class="who">${avatarSVG(p.av,{head:true,label:p.n})}${esc(p.n)}${me?' <span class="tag m">you</span>':""}</span>${flag(p.st||"Active")}</div>`}
V[4]=()=>{const t=T();if(!S.arrived)return elevatorScene();return `<div class="row" style="justify-content:space-between"><div><span class="chip b">Lobby · Code ${esc(S.code)}</span><h2 style="margin-top:8px">Floor 60 · Find your team</h2></div><span class="hint">Your team is waiting in All Skate. Explore while the intermission runs.</span></div>
${worldHTML("lobby")}
<div class="cols">
  <div class="panel"><span class="label">Team Kestrel</span><div class="roster">${personRow({n:S.name,av:S.av,st:status()},true)}${TEAM.map(p=>personRow({...p,st:MATE(p.n).boardStatus()})).join("")}</div></div>
  <div class="panel"><span class="label">Secret path · ${t.path} <span class="tag s">${t.n}</span></span><p>${t.pathDesc}</p><span class="hint">Progress ${ME.pathProgress} / ${t.goal}. Only you can see this.</span></div>
  ${G&&G.level===7?`<div class="panel"><span class="label">Graduation check</span>${gradChecks()}</div>`:""}
</div>`};
/* Trial scores on screen: whole numbers, 0 to max. The rules keep the exact value for ranking. */
const shownScore=(x,max=EP.Trial.MAX_BASE)=>Math.min(max,Math.max(0,Math.round(x)));
function gradChecks(){const c=ME.gradChecks(),GT=EP.Player.GRAD_TOTAL,GM=EP.Player.GRAD_MIN;
  return `<div class="check"><span class="${c.totalOk?"y":"x"}">${c.totalOk?"✓":"✗"}</span><span>Total points ${c.total} (need ${GT}+)</span></div><div class="check"><span class="${c.lowestOk?"y":"x"}">${c.lowestOk?"✓":"✗"}</span><span>Lowest attribute ${c.lowest} (need ${GM}+)</span></div><div class="check"><span class="${c.glitchesOk?"y":"x"}">${c.glitchesOk?"✓":"✗"}</span><span>Glitches ${c.glitches} (stuck at ${EP.Player.STUCK_AT})</span></div>`}

V[5]=()=>{const b=BRIEFINGS[R().n]||BRIEFINGS[1],tm=(G&&ME?G.teamOf(ME):null)||MYTEAM;return `<div><span class="chip r">${esc(b.header)}</span><h2 style="margin-top:8px">${esc(b.title)}</h2></div>
<div class="memo"><span class="label">Interoffice memo</span><p><b>To:</b> ${esc(S.name)}${tm?`, ${esc(tm.name)}`:""}</p><p>${esc(b.memo)}</p></div>
${R().attr?`<div class="cols"><div class="panel"><span class="label">This trial tests</span><h3>${AN[R().attr]}</h3></div><div class="panel"><span class="label">Cost for every player</span><h3>${R().cost} points</h3></div><div class="panel"><span class="label">Your ${AN[R().attr]}</span><h3>${ME.attrs[R().attr]}${isBonus(R().attr)?' <span class="tag b">bonus</span>':""}</h3><span class="hint">${ME.coversFromPoints(R().attr,R().cost)?"You can cover this.":"You'll need hearts to cover this."}</span></div></div>`
:`<div class="cols"><div class="panel"><span class="label">This review checks</span><h3>All 5 attributes</h3></div><div class="panel"><span class="label">Cost for every player</span><h3>0 points</h3></div><div class="panel"><span class="label">Final points</span><h3>+${EP.Game.POINTS.final} points</h3><span class="hint">${ME.isStuck()?"You are Stuck (spectator).":ME.graduates()?"You currently meet the graduation numbers.":"Place your final points on the next screen."}</span></div></div>`}
<div class="cols"><div class="panel"><span class="label">Real phase</span><span>${esc(b.phase)}</span></div><div class="panel"><span class="label">Workshops</span><span>${esc(b.workshops)}</span></div></div>`};

V[6]=()=>`<div class="row" style="justify-content:space-between"><div><span class="chip b">Open Floor</span><h2 style="margin-top:8px">Walk the office</h2></div>${floorOpen()?`<span class="counter" id="floorTmr">${fmt(G?G.secondsLeft()||0:0)}</span>`:""}<span class="hint">${!floorOpen()?"Open Floor is over. Press Ready for trial to continue.":"Kitchen = gift a teammate · Breakout Room = sabotage (Contrarians) · High Tea = network with a guest · Ghosts = whispers"}</span></div>
${worldHTML("floor")}`;

function sabotageAlertHTML(){const rs=R(),hit=rs.drainOn;return hit?`<div class="toast"><b>&gt; ALERT:</b> someone on your team sabotaged you. ${AN[rs.attr]} −${hit}. Remember this at the all-hands.</div>`:""}
function trialResultHTML(maxScore,rank,note){
  const rs=R(),mine=rank.find(x=>x.isMine);
  return `<div class="result"><b style="color:${rs.teamWon?"var(--ok)":"var(--bad)"}">Team ${rs.teamWon?"WIN":"LOSS"}. Score ${shownScore(mine?mine.score:0,maxScore)} of ${maxScore}.</b>${note?`<span class="hint">${note}</span>`:""}<span class="hint">Ranking: ${rank.map(x=>`${x.place}. ${esc(x.teamName)} (${shownScore(x.score,maxScore)})`).join(" · ")}. Top ${EP.Trial.winners(rank.length)} of ${rank.length} teams win.</span><span class="hint">Every player now pays ${rs.cost} ${AN[rs.attr]}. Press <b>All-hands</b> for the meeting.</span></div>`;
}
function trialSopScreen(){
  if(!S.sop.pile.length)S.sop.pile=shuffle([...SOP,DECOY]);
  const rs=R(),s=S.sop,built=G.sopBoard(MYTEAM),submitted=s.submitted||rs.sopSubmitted,locked=trialDone()||submitted,res=rs.sopResult||{right:0,endlessOut:false},rank=rs.ranking||[];
  const html=`<div><span class="chip r">The Trial · ${AN[rs.attr]}</span><h2 style="margin-top:8px">Write the coffee SOP</h2></div>
${sabotageAlertHTML()}
<p class="hint">Tap the steps in order. Leave out anything that doesn't belong. Tap a placed step to send it back. Score: 1 point per step in the right place, +1 for leaving out the step that doesn't belong (0 to 7). The top half of teams win.</p>
<div class="sop"><div><span class="label">Available steps</span><div class="pile">${sopPile().map((t,i)=>`<button class="scard" data-pile="${i}" ${locked?"disabled":""}><span class="num">·</span><span>${esc(t)}</span></button>`).join("")||'<span class="hint">All steps placed.</span>'}</div></div>
<div><span class="label">Team SOP</span><div class="built">${built.map((t,i)=>`<button class="scard ${trialDone()?(SOP[i]===t?"right":"wrong"):""}" data-built="${i}" ${locked?"disabled":""}><span class="num">${i+1}.</span><span>${esc(t)}</span></button>`).join("")||'<span class="hint">Nothing yet.</span>'}</div></div></div>
${trialDone()?trialResultHTML(EP.Trial.SopTrial.MAX_SCORE,rank,`${res.right} of 6 steps in place${!built.length?", no steps placed":res.endlessOut?", extra step left out":", extra step included"}${rs.sopTimedOut?", time ran out":""}. Your team's ${AN[rs.attr]} can move the score a little.`)
:submitted?`<p class="hint" id="sopWait">SOP saved. Waiting for the trial timer to finish.</p>`
:`<div class="row"><button class="btn green" id="check" ${G.canSubmitSop(ME)?"":"disabled"}>Submit SOP</button><button class="btn soft" id="reset">Start over</button></div>`}`;
  const bind=()=>{
    const b=()=>G.sopBoard(MYTEAM);   /* any teammate edits the shared board in Game */
    $$("[data-pile]").forEach(btn=>sopPress(btn,()=>{const t=sopPile()[+btn.dataset.pile];if(G.setSopBoard(ME,[...b(),t]).ok)render()}));
    $$("[data-built]").forEach(btn=>sopPress(btn,()=>{const t=b()[+btn.dataset.built];if(G.setSopBoard(ME,b().filter(x=>x!==t)).ok){s.pile=[...s.pile.filter(x=>x!==t),t];render()}}));
    on("#check",checkSop);on("#reset",()=>{if(G.setSopBoard(ME,[]).ok){s.pile=shuffle([...SOP,DECOY]);render()}});
  };
  return {html,bind,waitHint:submitted?"Waiting for the trial timer to finish":"Submit your SOP first"};
}
function trialSplitBriefScreen(){
  const view=SplitBriefView.screen({
    game:G,me:ME,team:MYTEAM,state:S.trialUI,
    header:()=>`<div><span class="chip r">The Trial · ${AN[R().attr]}</span><h2 style="margin-top:8px">${esc(R().name)}: ${esc(R().trialName)}</h2></div>${sabotageAlertHTML()}`,
    costHint:()=>`Every player now pays ${R().cost} ${AN[R().attr]}. Press <b>All-hands</b> for the meeting.`,
    onRender:render,
  });
  return {html:view.html,bind:view.bind?()=>view.bind(document):null,tick:view.tick||null,waitHint:view.waitHint};
}
function trialAutoScreen(){
  const rank=R().ranking||[];
  const html=`<div><span class="chip r">The Trial · ${AN[R().attr]}</span><h2 style="margin-top:8px">${esc(R().name)}: ${esc(R().trialName)}</h2></div>
${sabotageAlertHTML()}
${trialDone()?trialResultHTML(EP.Trial.MAX_BASE,rank,"AutoTrial placeholder: random 0 to 7 score plus light stat influence.")
:`<div class="panel"><span class="label">Placeholder trial</span><p>For now, ${esc(R().trialName)} ranks teams in random order (0 to 7) plus light ${AN[R().attr]} influence. Top half win.</p><div class="row"><button class="btn green" id="runAuto">Run trial</button></div></div>`}`;
  const bind=()=>{on("#runAuto",()=>{if(!trialDone()){G.runTrial();render()}})};
  return {html,bind,waitHint:"Run the trial first"};
}
function trialMirrorScreen(){
  const view=MirrorView.screen({
    game:G,me:ME,team:MYTEAM,state:S.trialUI,
    attrName:AN[R().attr],
    sabotageAlert:sabotageAlertHTML(),
    costHint:()=>`Every player now pays ${R().cost} ${AN[R().attr]}. Press <b>All-hands</b> for the meeting.`,
    avatarFor:p=>p===ME?S.av:(TEAM.find(x=>x.n===p.name)||{}).av||null,
    onRender:render,
  });
  return {html:view.html,bind:view.bind?()=>view.bind(document):null,tick:view.tick||null,cleanup:view.cleanup||null,waitHint:view.waitHint};
}
function trialJudgedScreen(){
  const view=JudgedView.screen({
    game:G,me:ME,team:MYTEAM,state:S.trialUI,
    header:()=>`<div><span class="chip r">The Trial · ${AN[R().attr]}</span><h2 style="margin-top:8px">${esc(R().name)}: ${esc(R().trialName)}</h2></div>${sabotageAlertHTML()}`,
    costHint:()=>`Every player now pays ${R().cost} ${AN[R().attr]}. Press <b>All-hands</b> for the meeting.`,
    onRender:render,
  });
  return {html:view.html,bind:view.bind?()=>view.bind(document):null,waitHint:view.waitHint};
}
/* Trial screen lookup keyed by Round.trialKind.
   To add a new trial kind (such as a Level 3 mini-game): write one screen function that returns
   { html, bind, waitHint } and add one entry below matching that level's trialKind. */
const TRIAL_SCREENS={
  sop:trialSopScreen,
  splitBrief:trialSplitBriefScreen,
  mirror:trialMirrorScreen,
  auto:trialAutoScreen,
  judged:trialJudgedScreen,
};
let currentTrialView=null;
function trialView(){const fn=TRIAL_SCREENS[R().trialKind]||trialAutoScreen;return fn();}
V[7]=()=>currentTrialView?currentTrialView.html:"";

V[8]=()=>{const sm=R(),p=sm.trialPayment,a=sm.accusation,k=sm.attr,go=G.giftOptions(ME),anoms=G&&ME?G.anomaliesFor(ME):[];return `<div class="meeting">All-hands meeting</div>
<div class="report shake"><span class="h">&gt; GLITCH REPORT: irregularities detected in your environment</span>
<span>&gt; trial: ${esc(MYTEAM.name)} ${sm.teamWon?"WIN":"LOSS"} · cost paid: ${p?`${AN[k]} −${sm.cost}`:"none (Stuck)"}</span>
${sm.drainOn?`<span>&gt; sabotage before the trial: ${AN[k]} −${sm.drainOn}</span>`:""}
${p?`<span>&gt; your ${AN[k]} at the trial: ${p.before} → ${p.after}${p.heartsUsed?` (hearts used: ${p.heartsUsed}, ${ME.rate(k)} per point)`:""}${p.after<0?` · <b style="color:var(--pink)">GLITCHING</b>`:""}</span>`
:`<span>&gt; you are Stuck and paid no trial cost this round.</span>`}
${CLUES.filter(c=>c.level===sm.n).map(c=>anoms.includes(c.id)?`<div class="clue"><span class="tag s">${c.kind}</span><span><b>${c.where}.</b> ${esc(c.found)}</span></div>`:`<div class="clue"><span class="tag m">???</span><span>${esc(c.hint)}</span></div>`).join("")}
<span>&gt; please continue working normally.</span></div>
${accDone()?caughtNotices():""}
${accDone()&&ME.sabotagesThisRound?`<div class="toast">${ME.caughtThisRound?`<b>&gt; CAUGHT:</b> a teammate correctly accused you. This round does not count toward Exploit. You cannot sabotage on any team next round, or ever again while on this team.`:`<b>&gt; CLEAN:</b> nobody caught your sabotage. Exploit progress ${ME.pathProgress}/${T().goal}.`}</div>`:""}
<div class="panel"><span class="label">Accusation · one per player · teammates only</span>
${accDone()||a.done?`<p>${a.result===true?`<b style="color:var(--ok)">Correct.</b> ${esc(a.target)} sabotaged this round. You get +1 point at Stats Update.${T().ct.pathCounts(EP.CharacterType.PATH_EVENTS.correctAccusation)?` ${T().path} complete.`:""}`:a.result===false?`<b style="color:var(--bad)">Wrong.</b> ${esc(a.target)} didn't sabotage this round. ${a.safe?`Your Focus kept it from costing you anything.`:`You lost 1 point from your highest attribute.`}`:"You skipped your accusation."}</p>${!accDone()?`<p class="hint" id="accWait">Choice saved. Waiting for the Glitch Report timer to finish.</p>`:""}`
:ME.isStuck()?`<p>You are Stuck and cannot accuse.</p><div class="row"><button class="btn soft sm" id="skipAcc">Skip</button></div>`
:`<p><b>Suspect a teammate? Accuse or Skip.</b></p><div class="row"><select id="accSel" style="max-width:240px" aria-label="Accuse a teammate"><option value="">Choose a teammate…</option>${MYTEAM.mates(ME).map(q=>`<option>${esc(q.name)}</option>`).join("")}</select><button class="btn red sm" id="accuse">Accuse</button><button class="btn soft sm" id="skipAcc">Skip</button></div><span class="hint">Correct: +1 point. Wrong: you lose 1 point from your highest attribute.</span><span class="hint">The Glitch Report ends on its own in ${EP.Game.AUTO_ADVANCE_SECONDS.glitchReport} seconds. No answer counts as Skip.</span>`}</div>
${accDone()?`<div class="panel"><div class="row" style="justify-content:space-between"><span class="label">Gift window</span>${gwClosed()?flag(status()):`<span class="row" style="gap:8px"><span class="counter" id="gwTmr">${fmt(G?G.secondsLeft()||0:0)}</span><span class="hearts">${Array.from({length:EP.Hearts.CAP},(_,i)=>HEART(i<ME.hearts.count)).join("")}</span></span>`}</div>
  ${incomingGifts()}
  ${!gwClosed()?giftRoster():""}
  ${(go?go.sent:[]).map(m=>`<span class="okmsg">${esc(giftMsg(m))}</span>`).join("")}
  ${gwClosed()?`<p>${gwClosedText()}</p>`:`${gwOpenText()}<span class="hint">The gift window lasts ${EP.Game.STEP_SECONDS.giftWindow} seconds. Anything still below 0, or a missed check-in nobody saved, becomes a glitch when it closes.</span>`}
</div>`:""}`};

/* Gift window state for you. Never says "No glitch" while a glitch is pending or locked this round. */
function gwOpenText(){
  if(ME.attendancePending)return `<p><b style="color:var(--pink)">You missed the check-in. You are Glitching.</b> A teammate's gift can save you before the gift window closes.</p>`;
  if(ME.isGlitching())return `<p><b style="color:var(--pink)">You are Glitching.</b> A teammate's gift can save you before the gift window closes.</p>`;
  return ""}
function gwClosedText(){
  const n=`Glitches: ${ME.glitches}/${EP.Player.STUCK_AT}.`;
  if(ME.glitchedThisRound&&ME.attendanceGlitchThisRound)return `<b style="color:var(--pink)">Glitch locked in.</b> You missed the check-in and no gift saved you. Hearts set to 0. Your attributes are unchanged. ${n}`;
  if(ME.glitchedThisRound)return `<b style="color:var(--pink)">Glitch locked in.</b> Reboot: points taken evenly from your other attributes to bring it back to 1. Hearts set to 0. ${n}`;
  if(ME.isGlitchingAny())return `<b style="color:var(--pink)">You are Glitching.</b> ${n}`;
  return "Window closed. No glitch for you this round."}
/* Gift buttons for every teammate (Open Floor and gift window). Stuck players are spectators. */
const GIFT_RULE="They choose Accept or Decline. Accepted points go to their glitching attribute if they are Glitching, otherwise to their lowest attribute with room. You don't pick the attribute. If they decline, or don't answer before this step ends, your hearts come back.";
function giftRoster(){const go=G.giftOptions(ME);return `<p class="hint">${GIFT_RULE}</p><div class="roster">${(go?go.targets:[]).map(q=>`<div class="person"><span class="who">${avatarSVG(TEAM.find(x=>x.n===q.name).av,{head:true,label:q.name})}${esc(q.name)}</span><span class="row" style="gap:6px">${flag(q.status)}${!q.isStuck?q.amounts.map(a=>`<button class="btn green sm" data-gift="${esc(q.name)}" data-pts="${a.pts}" ${a.reason?`disabled title="${esc(a.reason)}"`:""}>Gift ${a.pts} (${a.cost} heart${a.cost>1?"s":""})</button>`).join(""):""}</span></div>`).join("")}</div>`}
const plural=(n,w)=>`${n} ${w}${n===1?"":"s"}`;
function giftMsg(g){
  /* An automatic refusal (Independent) reads exactly like a normal decline. Never mention the type. */
  if(g.status==="declined")return `${g.toName} declined your gift. Your hearts came back.`;
  if(g.status==="expired")return `${g.toName} didn't answer in time. Your hearts came back.`;
  if(g.status==="pending")return `Waiting for ${g.toName} to answer. If they don't answer before this step ends, your hearts come back.`;
  return `${g.toName} accepted your ${plural(g.pts,"point")} (−${plural(g.cost,"heart")}${g.discount?", 1 less thanks to your Collaboration":""}).${g.cancelled?` ${g.toName} is safe.`:""}${g.cancelled&&T().ct.pathCounts(EP.CharacterType.PATH_EVENTS.rescue)?` ${T().path} complete.`:""}${g.overflow?` ${plural(g.overflow,"point")} had nowhere to go. Your hearts for them came back.`:""}`}
function bindGifts(onMsg){$$("[data-gift]").forEach(b=>b.onclick=()=>{const q=MATE(b.dataset.gift),pts=+b.dataset.pts,r=G.gift(ME,q,pts);if(!r.ok)return;if(onMsg){const sent=G.giftOptions(ME).sent;const last=sent[sent.length-1];if(last)onMsg(giftMsg(last))}render()})}
/* Gifts sent to you: "Gift from [name]: Accept or Decline." */
function incomingGifts(){const go=G.giftOptions(ME);return (go?go.incoming:[]).map(x=>{const who=esc(x.fromName),n=plural(x.pts,"point");
  if(x.status==="pending")return `<div class="person"><span><b>Gift from ${who}</b>: ${n}. Accept or Decline.</span><span class="row" style="gap:6px"><button class="btn green sm" data-ans="${x.index}" data-yes="1">Accept</button><button class="btn soft sm" data-ans="${x.index}" data-yes="0">Decline</button></span></div>`;
  if(x.status==="accepted")return `<span class="okmsg">You accepted ${n} from ${who}.${x.target?` It went to your ${AN[x.target]}.`:""}</span>`;
  if(x.status==="declined")return `<span class="hint">You declined ${who}'s gift. It went back to them.</span>`;
  return `<span class="hint">${who}'s gift expired with no answer. It went back to them.</span>`}).join("")}
function bindIncoming(){$$("[data-ans]").forEach(b=>b.onclick=()=>{if(!G.answerGiftByIndex(ME,+b.dataset.ans,b.dataset.yes==="1").ok)return;render()})}
/* All-hands: as soon as accusations resolve, announce any teammate caught sabotaging. (If you were caught, your own notice shows instead.) */
function caughtNotices(){return R().caughtOn.map(q=>`<div class="toast"><b>&gt; CAUGHT:</b> ${esc(q.name)} was caught sabotaging. They cannot sabotage this team again.</div>`).join("")}
function placeLeft(){return ME?ME.placeLeft(ME.draft):0}
function nextLevelCard(level,detail){
  const nx=EP.Round.LEVELS[level]||null;
  return `<div class="locked" style="border-style:solid;border-color:var(--ok)"><div><span class="label">Next · Level ${nx?nx.n:""}</span><h3>${nx?esc(nx.name):""}</h3><span class="hint">${esc(detail)}</span></div><span class="tag" style="background:var(--ok)">READY</span></div>
  <div class="row"><button class="btn red" id="nextLevel">Start Level ${nx?nx.n:""} ▶</button><button class="btn blue" id="replay">Replay Level ${level}</button><button class="btn soft" id="restart">Back to sign-in</button></div>`;
}
function finalResultsScreen(){
  const res=G.results(),mine=res.find(r=>r.player===ME),t=T();
  const teams=[...G.teams].sort((a,b)=>b.trialWins-a.trialWins);
  return `<div><span class="chip ${mine.wins?"g":"r"}">Game over · Performance Review</span><h2 style="margin-top:8px">${mine.wins?"You exited Floor 60":"Contract renewed"}</h2><p class="hint" style="margin-top:6px">Result: <b>${esc(mine.ending)}</b></p></div>
  <div class="cols">
    <div class="panel"><span class="label">Your outcome</span><p><b>${esc(mine.ending)}</b></p><span class="hint">Hearts: ${ME.hearts.count}/${EP.Hearts.CAP} · Glitches: ${ME.glitches}/${EP.Player.STUCK_AT}</span>${flag(status())}${gradChecks()}</div>
    <div class="panel"><span class="label">Your 5 attributes</span>${A.map(a=>`<div class="row" style="justify-content:space-between"><span>${a.n}</span><b>${ME.attrs[a.k]}/${maxOf(a.k)}</b></div>`).join("")}<span class="hint">Total: ${ME.total()}</span></div>
    <div class="panel"><span class="label">Secret path · ${t.path}</span><span>${ME.pathDone?"Complete. This counts as a win.":`Progress ${ME.pathProgress} / ${t.goal}`}</span></div>
  </div>
  <div class="panel tw"><span class="label">Team standings</span><table class="levels"><thead><tr><th>Place</th><th>Team</th><th>Trial wins</th></tr></thead><tbody>${teams.map((tm,i)=>`<tr><td class="n">${i+1}</td><td>${esc(tm.name)}${tm===MYTEAM?" (you)":""}</td><td class="n">${tm.trialWins} / 6</td></tr>`).join("")}</tbody></table></div>
  <div class="panel tw"><span class="label">Cohort endings</span><table class="levels"><thead><tr><th>Intern</th><th>Team</th><th>Outcome</th></tr></thead><tbody>${res.map(r=>`<tr><td>${esc(r.player.name)}${r.player===ME?" (you)":""}</td><td>${esc(G.teamOf(r.player).name)}</td><td>${esc(r.ending)}</td></tr>`).join("")}</tbody></table></div>
  <div class="row"><button class="btn blue" id="replay">Play again</button><button class="btn soft" id="restart">Back to sign-in</button></div>`;
}
function milestoneCompleteScreen({title,levelCount,locked,nextDetail}){
  const res=G.teamTrialResults(MYTEAM);
  const rows=EP.Round.LEVELS.slice(0,levelCount).map(lv=>{
    const win=res[lv.n]!==undefined?!!res[lv.n]:(lv.n===R().n?!!MYTEAM.won:false);
    return `<div class="row" style="justify-content:space-between"><span>Level ${lv.n} · ${esc(lv.name)}</span><b style="color:${win?"var(--ok)":"var(--bad)"}">${win?"WIN":"LOSS"}</b></div>`;
  }).join("");
  const standings=G.teamStandings();
  const nx=EP.Round.LEVELS[levelCount];
  const nextCard=locked
    ?`<div class="locked"><div><span class="label">Next · Level ${nx.n}</span><h3>Level ${nx.n} locked</h3><span class="hint">${esc(nextDetail)}</span></div><span class="tag">LOCKED</span></div>
  <div class="row"><button class="btn blue" id="replay">Replay</button><button class="btn soft" id="restart">Back to sign-in</button></div>`
    :`<div class="locked" style="border-style:solid;border-color:var(--ok)"><div><span class="label">Next · Level ${nx.n}</span><h3>${esc(nx.name)}</h3><span class="hint">${esc(nextDetail)}</span></div><span class="tag" style="background:var(--ok)">READY</span></div>
  <div class="row"><button class="btn red" id="nextLevel">Start Level ${nx.n} ▶</button><button class="btn blue" id="replay">Replay</button><button class="btn soft" id="restart">Back to sign-in</button></div>`;
  return `<div><span class="chip g">${esc(title)}</span><h2 style="margin-top:8px">${esc(title)}, ${esc(S.name)}</h2></div>
  <div class="cols">
    <div class="panel"><span class="label">Your trial results</span>${rows}</div>
    <div class="panel"><span class="label">Your status</span><span class="hint">Hearts: ${ME.hearts.count}/${EP.Hearts.CAP} · Glitches: ${ME.glitches}/${EP.Player.STUCK_AT}</span>${flag(status())}</div>
    <div class="panel"><span class="label">Your 5 attributes</span>${A.map(a=>`<div class="row" style="justify-content:space-between"><span>${a.n}</span><b>${ME.attrs[a.k]}</b></div>`).join("")}<span class="hint">Total: ${ME.total()}</span></div>
  </div>
  <div class="panel"><span class="label">Your team</span><p><b>${esc(MYTEAM.name)}</b> · ${MYTEAM.trialWins} / ${levelCount} trial wins</p></div>
  <div class="panel tw"><span class="label">Team standings</span><table class="levels"><thead><tr><th>Place</th><th>Team</th><th>Trial wins</th></tr></thead><tbody>${standings.map(s=>`<tr><td class="n">${s.place}</td><td>${esc(s.team.name)}${s.team===MYTEAM?" (you)":""}</td><td class="n">${s.wins} / ${levelCount}</td></tr>`).join("")}</tbody></table></div>
  ${nextCard}`;
}
const END_SCREENS={
  1:()=>nextLevelCard(1,"Sep 8–25 · Trial cost 3 · Attribute revealed at the briefing"),
  2:()=>milestoneCompleteScreen({title:"Sprint 1 Complete",levelCount:2,locked:false,nextDetail:`Oct 1 · Trial cost ${EP.Round.LEVELS[2].cost} · Attribute revealed at the briefing`}),
  3:()=>milestoneCompleteScreen({title:"Presentation Day Complete",levelCount:3,locked:true,nextDetail:"Geek Week (Oct 5–9) · Coming next."}),
  4:()=>nextLevelCard(4,"Oct 5–30 · Trial cost 4 · Attribute revealed at the briefing"),
  5:()=>nextLevelCard(5,"Nov 2–27 · Trial cost 5 · Attribute revealed at the briefing"),
  6:()=>nextLevelCard(6,"Nov 30 – Dec 1 · Final Performance Review · Trial cost 0"),
  7:()=>finalResultsScreen(),
};
function pointBuyHTML(){return `<div class="buy">${A.map(a=>{const v=ME.attrs[a.k]+(ME.draft[a.k]||0);return `<div class="brow"><span class="nm">${a.n}${isBonus(a.k)?'<span class="tag b">bonus</span>':""}</span><span class="step"><button class="minus" data-pdec="${a.k}" aria-label="Remove from ${a.n}" ${!ME.canUnplace(ME.draft,a.k)?"disabled":""}>−</button><span class="val">${v}</span><button class="plus" data-pinc="${a.k}" aria-label="Add to ${a.n}" ${!ME.canPlace(ME.draft,a.k)?"disabled":""}>+</button></span><span class="fin">max ${maxOf(a.k)}</span></div>`}).join("")}</div>`}
V[9]=()=>{
  if(G&&G.over)return END_SCREENS[7]();
  if((R().n===2||R().n===3)&&roundDone())return END_SCREENS[R().n]();
  const left=placeLeft();const t=T();const got=ME.earned+ME.placedThisRound;const nx=EP.Round.LEVELS[R().n]||null;
  if(R().isFinal){
    return `<div><span class="chip g">Graduation</span><h2 style="margin-top:8px">Final Performance Review, ${esc(S.name)}</h2></div>
    <div class="result"><b>${ME.isStuck()?"You are Stuck and watch the final review.":ME.earned>0?`You have ${ME.earned} final point${ME.earned===1?"":"s"} to place.`:`Final points locked in (${ME.placedThisRound} placed).`}</b><span class="hint">Graduate with ${EP.Player.GRAD_TOTAL}+ total points, every attribute ${EP.Player.GRAD_MIN}+, and not Stuck (or a completed secret path).</span></div>
    ${ME.isStuck()||ME.earned===0?`<p class="hint" id="gradWait">${ME.placedThisRound>0?"Your final points are locked in. ":""}Waiting for the Graduation timer to finish.</p>`
    :`<div class="row" style="justify-content:space-between"><h3>Place your final points</h3><span class="counter" style="color:${left?"var(--gold)":"var(--ok)"}">${left} left</span></div>
    <p class="hint">Graduation ends when the 60-second timer runs out. Unplaced points go in automatically.</p>
    ${pointBuyHTML()}`}
    <div class="cols"><div class="panel"><span class="label">Graduation check</span>${gradChecks()}</div>
    <div class="panel"><span class="label">Status</span>${flag(status())}<span class="hint">${ME.idle?"Idle at results counts as Contract renewed unless a secret path is complete.":"Be active when results lock in to graduate."}</span></div>
    <div class="panel"><span class="label">Secret path · ${t.path}</span><span>${ME.pathDone?"Complete. This counts as a win.":`Progress ${ME.pathProgress} / ${t.goal}`}</span></div></div>`;
  }
return `<div><span class="chip g">Stats Update</span><h2 style="margin-top:8px">Level ${R().n} complete, ${esc(S.name)}</h2></div>
<div class="result"><b>You earned ${got} point${got===1?"":"s"}.</b><span class="hint">${[...R().earnings,...(ME.cashedOutThisRound?["Cash Out: +1"]:[])].map(esc).join(" · ")}</span></div>
${!roundDone()&&ME.canCashOut()?`<div class="panel"><span class="label">Cash Out · once per game</span><p>Spend 2 hearts for +1 point. Only works with full hearts.</p><button class="btn green sm" id="cashOut">Cash Out</button></div>`:""}
${roundDone()?"":ME.isStuck()?`<p class="hint" id="statsWait">You are Stuck this round and have no points to place. Waiting for the Stats Update timer to finish.</p>`
:ME.earned===0?`<p class="hint" id="statsWait">${ME.placedThisRound>0?"Points locked in.":"No points left to place."} Waiting for the Stats Update timer to finish.</p>`
:`<div class="row" style="justify-content:space-between"><h3>Place your points</h3><span class="counter" style="color:${left?"var(--gold)":"var(--ok)"}">${left} left</span></div>
<p class="hint">Place them now. The next trial's attribute stays hidden until the next briefing.${nx?(nx.cost?` Level ${nx.n} costs ${nx.cost}.`:` Level ${nx.n} has no trial cost.`):""}</p>
<p class="hint">Stats Update ends on its own when the timer at the top runs out. It started when the gift window closed. Points you have not placed go in automatically, the same way bots place theirs.</p>
${pointBuyHTML()}`}
<div class="cols"><div class="panel"><span class="label">Status</span>${flag(status())}<span class="hint">At risk means one of your attributes, even with the hearts that could cover it, could not pay a cost of ${EP.Player.AT_RISK_COST}. This ${EP.Player.AT_RISK_COST} is a fixed safety check for every level. It is not the next trial's cost.</span></div>
<div class="panel"><span class="label">Your abilities · only you see these</span>${G.playerState(ME).abilityLines.map(l=>`<span class="hint">${esc(l.text)}</span>`).join("")}</div>
<div class="panel"><span class="label">Secret path · ${t.path}</span><span>${ME.pathDone?"Complete. This counts as a win.":`Progress ${ME.pathProgress} / ${t.goal}`}</span></div></div>
${roundDone()?(END_SCREENS[R().n]||END_SCREENS[1])():""}`};

/* ================= ARRIVAL (elevator → ADMIN_0 → role lead → spawn) ================= */
function adminFig(){return `<g transform="translate(440 210)">
<rect x="34" y="200" width="18" height="70" rx="6" fill="#141922" stroke="#0b0e13" stroke-width="4"/><rect x="68" y="200" width="18" height="70" rx="6" fill="#141922" stroke="#0b0e13" stroke-width="4"/>
<rect x="8" y="110" width="22" height="80" rx="10" fill="#1d232e" stroke="#0b0e13" stroke-width="4"/><rect x="90" y="110" width="22" height="80" rx="10" fill="#1d232e" stroke="#0b0e13" stroke-width="4"/>
<rect x="24" y="100" width="72" height="110" rx="18" fill="#1d232e" stroke="#0b0e13" stroke-width="4"/><path d="M48 104 L60 150 L72 104" fill="#f2f5f8" stroke="#0b0e13" stroke-width="3"/><path d="M60 112 l-5 6 5 26 5 -26z" fill="#e0394d" stroke="#0b0e13" stroke-width="2"/>
<rect x="52" y="88" width="16" height="14" fill="#4a5568" stroke="#0b0e13" stroke-width="4"/>
<rect x="10" y="10" width="100" height="80" rx="16" fill="#e6ecf2" stroke="#0b0e13" stroke-width="5"/><rect x="20" y="20" width="80" height="60" rx="10" fill="#0d141c" stroke="#0b0e13" stroke-width="3"/>
<rect x="38" y="46" width="16" height="4" fill="#f2f5f8"/><rect x="66" y="46" width="16" height="4" fill="#f2f5f8"/><rect x="54" y="62" width="12" height="3" fill="#f2f5f8" opacity=".6"/></g>`}
/* While the type lead speaks, the lead stands in the doorway instead of ADMIN_0. */
function leadInDoor(){const d=DIALOGS[ROLE_BRIEF[S.type].lead];return d.draw("talk").replace("<svg ",'<svg x="400" y="230" width="200" height="240" ')}
function adminPortrait(){return `<svg viewBox="440 210 120 160">${adminFig()}</svg>`}
function elevatorScene(){const open=S.arr!=="elev",opening=open&&!S.doorsDone;
  return `<div class="cine"><svg viewBox="0 0 1000 600" class="cinesvg" role="img" aria-label="First-person view from inside an elevator">
  <defs><linearGradient id="lob" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1220"/><stop offset=".55" stop-color="#1b2540"/><stop offset="1" stop-color="#0b0e13"/></linearGradient>
  <radialGradient id="spot" cx=".5" cy=".75" r=".5"><stop offset="0" stop-color="rgba(255,236,190,.35)"/><stop offset="1" stop-color="rgba(255,236,190,0)"/></radialGradient></defs>
  <rect width="1000" height="600" fill="url(#lob)"/>
  ${[0,1,2,3,4,5,6,7].map(i=>`<path d="M500 330 L${-200+i*200} 600" stroke="#2a3448" stroke-width="2"/>`).join("")}
  ${[0,1,2,3].map(i=>`<path d="M${330-i*60} ${380+i*50} H${670+i*60}" stroke="#2a3448" stroke-width="2"/>`).join("")}
  <rect x="300" y="110" width="400" height="220" fill="#111827" stroke="#2a3448" stroke-width="3"/>
  ${[0,1,2,3,4].map(i=>`<rect x="${320+i*76}" y="130" width="60" height="70" fill="#0b0e13" stroke="#2a3448"/><rect x="${330+i*76}" y="140" width="40" height="${10+((i*7)%30)}" fill="#e0394d" opacity=".25"/>`).join("")}
  <text x="500" y="100" text-anchor="middle" font-family="Pixelify Sans,monospace" font-size="22" fill="#e0394d" opacity=".75">FLOOR 60 · ORIENTATION</text>
  <ellipse cx="500" cy="500" rx="200" ry="60" fill="url(#spot)"/>
  ${S.arr==="role"||S.arr==="spawn"?leadInDoor():`<g class="adm ${open?"in":""} ${opening?"opening":""}">${adminFig()}</g>`}
  <g class="door l ${open?"open":""} ${opening?"opening":""}"><rect x="180" y="60" width="320" height="480" fill="#8d97a6" stroke="#0b0e13" stroke-width="6"/><path d="M200 80 V520" stroke="#a9b2bf" stroke-width="4"/><rect x="470" y="260" width="12" height="80" rx="4" fill="#5b6577"/></g>
  <g class="door r ${open?"open":""} ${opening?"opening":""}"><rect x="500" y="60" width="320" height="480" fill="#8d97a6" stroke="#0b0e13" stroke-width="6"/><path d="M800 80 V520" stroke="#a9b2bf" stroke-width="4"/><rect x="518" y="260" width="12" height="80" rx="4" fill="#5b6577"/></g>
  <polygon points="0,0 180,60 180,540 0,600" fill="#5b6577" stroke="#0b0e13" stroke-width="6"/><polygon points="1000,0 820,60 820,540 1000,600" fill="#4a5568" stroke="#0b0e13" stroke-width="6"/>
  <polygon points="0,0 1000,0 820,60 180,60" fill="#2a3140" stroke="#0b0e13" stroke-width="6"/><rect x="380" y="16" width="240" height="14" rx="6" fill="#fffbe8" opacity=".9"/>
  <polygon points="0,600 180,540 820,540 1000,600" fill="#2a2f3a" stroke="#0b0e13" stroke-width="6"/>
  <rect x="440" y="20" width="120" height="34" rx="6" fill="#0b0e13"/><text id="flr" x="500" y="46" text-anchor="middle" font-family="Pixelify Sans,monospace" font-weight="700" font-size="24" fill="#e0394d">▲ ${open?"60":"01"}</text>
  <g transform="translate(880 250)"><rect x="-30" y="-10" width="64" height="150" rx="8" fill="#2a3140" stroke="#0b0e13" stroke-width="5"/>${[0,1,2,3,4,5].map(i=>`<circle cx="${i%2?16:-12}" cy="${14+Math.floor(i/2)*40}" r="10" fill="${i===5?"#e0394d":"#cbd3dc"}" stroke="#0b0e13" stroke-width="3"/>`).join("")}</g>
  </svg>
  ${S.arr==="elev"?`<div class="cinecap">Connecting<span class="dotsanim">...</span></div>`:""}
  ${S.arr==="admin"?vnBox("ADMIN_0","Host",adminPortrait(),ADMIN_LINES[S.arrLine],S.arrLine,ADMIN_LINES.length):""}
  ${S.arr==="role"?roleBrief():""}
  ${S.arr==="elev"||S.arr==="admin"?`<button class="btn soft sm cineskip" id="skipIntro">Skip intro ▶</button>`:""}
  ${S.arr==="spawn"?`<div class="spawn"><div class="spfig">${avatarSVG(S.av,{label:S.name})}</div><span class="sptxt">SPAWNING ${esc(S.name.toUpperCase())} · FLOOR 60</span></div>`:""}
  </div>`}
const ADMIN_LINES=[
  "Welcome to Floor 60. You don't remember the elevator ride. No one ever does.",
  "You agreed to all of this. You signed. You just don't remember signing.",
  "Out there, you are someone else. In here, you are an intern. The two of you will not meet.",
  "This is a 14-week internship. Seven floors. Every floor ends in a review, and every review costs you something.",
  "Pass all seven and the exit opens. Fail, and your contract is renewed. Indefinitely.",
  "You'll see things on this floor that aren't on the org chart. Don't follow them. Listen to them.",
  "You chose your work style. Your orientation lead will brief you now."];
const ROLE_BRIEF={
  coop:{lead:2,lines:["Hey, Cooperative! I'm Meep. On this floor you're the glue.","Your gifts cost only 1 heart per point. Gift any teammate during Open Floor or the gift window. A gift can pull a glitching teammate back to safety.","Watch out: you're slow to take Initiative. It caps at 4. And when a teammate's glitch locks in, you lose a heart too.","Your secret path is Lifeline. Cancel 1 teammate glitch with a gift and you win your own way, even if the floor goes badly."],face:"Collaboration +2 · Composure +2",weak:"Initiative caps at 4",watch:"A teammate's locked glitch costs you a heart."},
  indep:{lead:3,lines:["Signal received, Independent. I'm Projection.","You're strongest at Focus and Grit. You'll carry trials others can't.","Collaboration costs you more. 1 gift point costs 2 hearts, 2 points cost 3. And you can't accept gifts.","Your secret path is Auditor. Make 1 correct accusation yourself. Once per game, with full hearts, you can Cash Out 2 hearts for 1 point."],face:"Focus +2 · Grit +2",weak:"Collaboration caps at 4",watch:"Someone on your team may be sabotaging."},
  contra:{lead:1,lines:["So. You don't trust the system either. Good. I'm SYS-ADMIN 02.","From the Breakout Room you can sabotage a teammate. The first one each round costs 1 heart and drains 2 points.","At every all-hands, each teammate can accuse one person. Get caught and that round does not count. You cannot sabotage on any team next round, and never again on the team that caught you.","Your secret path is Exploit: 3 sabotage rounds nobody catches. Each uncaught round also pays +1 point, up to 2. Stay calm. Your Composure caps at 4."],face:"Initiative +2 · Grit +2",weak:"Composure caps at 4",watch:"Don't be the one who's always near the Breakout Room."}};
function vnBox(who,role,portrait,line,i,n,extra=""){return `<div class="vn"><div class="vnp">${portrait}</div><div class="vnt"><div class="vnh"><b>${who}</b><span class="chip b">${role}</span></div><p class="vnl">${esc(line)}</p>${extra}<div class="vnf"><span class="dots">${Array.from({length:n},(_,j)=>`<i class="${j<=i?"on":""}"></i>`).join("")}</span><span class="label">Press Continue</span></div></div></div>`}
function roleBrief(){const rb=ROLE_BRIEF[S.type],d=DIALOGS[rb.lead],t=T();
  const dossier=`<div class="dossier"><span><b>Strengths</b>${rb.face}</span><span><b>Weakness</b>${rb.weak}</span><span><b>Gifts</b>${giftCostText(t.ct)}</span><span><b>Secret path</b>${t.path}</span><span class="w"><b>Watch for</b>${rb.watch}</span></div>`;
  return vnBox(d.who,t.n+" briefing",`<div class="vnportrait">${d.draw("talk")}</div>`,rb.lines[S.arrLine],S.arrLine,rb.lines.length,S.arrLine===rb.lines.length-1?dossier:"")}
/* Skip intro skips the elevator and ADMIN_0 only. The work-style briefing is never skippable. */
function skipArrival(){elevTimers.forEach(clearTimeout);elevTimers=[];S.doorsDone=true;S.arr="role";S.arrLine=0;render()}
function arrivalAdvance(){
  if(S.arr==="elev"){S.arr="admin";S.arrLine=0;render();return}
  if(S.arr==="admin"){if(S.arrLine<ADMIN_LINES.length-1)S.arrLine++;else{S.arr="role";S.arrLine=0}render();return}
  if(S.arr==="role"){const n=ROLE_BRIEF[S.type].lines.length;if(S.arrLine<n-1)S.arrLine++;else{S.arr="spawn";render();setTimeout(()=>{if(S.arr==="spawn"){S.arrived=true;render()}},1800);return}render();return}
  if(S.arr==="spawn"){S.arrived=true;render()}
}
let elevTimers=[];
function runElevator(){elevTimers.forEach(clearTimeout);elevTimers=[];let f=1;const el=()=>$("#flr");
  const stepF=()=>{f+=Math.max(1,Math.round((60-f)/6));if(f>60)f=60;if(el())el().textContent="▲ "+String(f).padStart(2,"0");if(f<60)elevTimers.push(setTimeout(stepF,90));else elevTimers.push(setTimeout(()=>{if(S.step===4&&S.arr==="elev")arrivalAdvance()},700))};
  elevTimers.push(setTimeout(stepF,500))}

/* Escape closes any open popup, same as its X: room and ghost panels, and the whisper box. Works wherever focus is. */
addEventListener("keydown",e=>{if(e.key!=="Escape"&&e.key!=="Esc")return;const w=$("#whisper");if(!w.hidden)w.hidden=true;if(S.panel){S.panel=false;render()}});

/* ---------- render + bind ---------- */
function render(){
  stopWorld();
  if(currentTrialView&&currentTrialView.cleanup)currentTrialView.cleanup();
  currentTrialView=S.step===7?trialView():null;
  chrome();$("#stage").innerHTML=V[S.step]();bind();BOARD.refresh();
  document.body.classList.toggle("mapscreen",!!$("#world"));
  /* Map screens: the name bar and stat bar get their own rows above the scroll area, so nothing scrolls under them. */
  {const top=$("#topbar"),hud=$("#hud"),wrap=$(".wrap");if($("#world")){if(hud.parentNode!==document.body){document.body.insertBefore(top,wrap);document.body.insertBefore(hud,wrap)}}
   else if(hud.parentNode!==wrap){wrap.insertBefore(top,wrap.firstChild);wrap.insertBefore(hud,$("#steps"))}}
  if($("#world")){fitWorld();initWorld()}else W.fitFor=null;
  if(S.step===4&&!S.arrived&&S.arr==="elev")runElevator();
  if(S.step===4&&!S.arrived&&S.arr==="admin"&&!S.doorsDone)setTimeout(()=>{S.doorsDone=true},1600);
}
const on=(sel,fn)=>{const e=$(sel);if(e)e.onclick=fn};
function bind(){
  if(S.step===0){
    on("#theL",()=>{if(G&&ME){G.recordAnomaly(ME,"L");S.pendingL=false}else{S.pendingL=true}render()});
    $("#signForm").onsubmit=e=>{e.preventDefault();const emChk=EP.Game.checkEmail($("#em").value),jcChk=EP.Game.checkJoinCode($("#jc").value);S.email=emChk.value;S.code=jcChk.value;
      if(!emChk.ok){$("#signErr").textContent=emChk.reason;return}
      if(!jcChk.ok){$("#signErr").textContent=jcChk.reason;return}
      S.name=savedName(emChk.value)||S.name;go(1)};
  }
  if(S.step===1){
    on("#play",()=>go(2));on("#wardrobe",()=>go(2));
    on("#howTo",()=>{S.menu="howto";render()});
    $$("[data-dnext]").forEach(b=>b.onclick=()=>{const i=+b.dataset.dnext;DPOS[i]=(DPOS[i]+1)%DIALOGS[i].lines.length;render()});
    $$("[data-menu]").forEach(b=>b.onclick=()=>{S.menu=b.dataset.menu;render()});
    on("#toWardrobe",()=>{go(2);S.wardFrom="badge"});on("#toName",()=>{go(2);S.wardFrom="badge";setTimeout(()=>{const n=$("#nm");if(n)n.focus()},50)});
  }
  if(S.step===2){
    const nm=$("#nm");
    nm.addEventListener("input",()=>{const raw=nm.value,c=cleanName(raw);const msg=$("#nmMsg");if(c!==raw){const p=Math.max(0,nm.selectionStart-(raw.length-c.length));nm.value=c;try{nm.setSelectionRange(p,p)}catch(e){}msg.textContent="Letters, numbers and spaces only. Special characters were removed.";msg.classList.add("bad")}
      S.draft=c;updateNav()});
    nm.addEventListener("blur",()=>{S.draft=S.draft.trim();nm.value=S.draft});
    $$("[data-tab]").forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;render()});
    $$("[data-k]").forEach(b=>b.onclick=()=>{S.av[b.dataset.k]=+b.dataset.i;render()});
    on("#closeW",()=>go(1));
    on("#rand",()=>{const r=n=>Math.floor(Math.random()*n);S.av={body:r(2),skin:r(SKIN.length),hair:r(HAIR.length),hairC:r(HAIRC.length),top:r(CLOTH.length),topS:r(TOP.length),bot:r(BOTC.length),botS:r(BOT.length),hat:r(HAT.length),extra:r(EXTRA.length),acc:r(CLOTH.length),tool:r(TOOLS.length)};render()});
  }
  if(S.step===3){
    $$("[data-type]").forEach(b=>b.onclick=()=>{const t=b.dataset.type;if(t===S.type)return;
      if(S.type&&spendLeft()<EP.Player.SPEND&&!confirm("Switching resets your points. Continue?"))return;   /* confirm before wiping placed points */
      S.type=t;S.spend=Object.fromEntries(A.map(a=>[a.k,0]));render()});
    $$("[data-inc]").forEach(b=>b.onclick=()=>{const k=b.dataset.inc;if(EP.Player.canRaise(S.type,S.spend,k)){S.spend[k]++;render()}});
    $$("[data-dec]").forEach(b=>b.onclick=()=>{const k=b.dataset.dec;if(EP.Player.canLower(S.spend,k)){S.spend[k]--;render()}});
  }
  if(S.step===4)on("#skipIntro",skipArrival);
  if(S.step===4||S.step===6)on("#closeP",()=>{S.panel=false;render()});
  if(S.step===6){
    bindGifts(m=>{S.of.msg=m});bindIncoming();
    $$("[data-sab]").forEach(b=>b.onclick=()=>{const r=G.sabotage(ME,MATE(b.dataset.sab));S.of.msg=r.ok?`You drained ${r.target.name} by ${r.drain}. They won't know it was you.`:r.reason;render()});
  }
  if(S.step===7&&currentTrialView&&currentTrialView.bind)currentTrialView.bind();
  if(S.step===8){
    on("#accuse",()=>{const v=$("#accSel").value;if(!v)return;if(!G.accuse(ME,MATE(v)).ok)return;render()});
    on("#skipAcc",()=>{if(!G.skipAccusation(ME).ok)return;render()});
    bindGifts();bindIncoming();
  }
  if(S.step===9){
    $$("[data-pinc]").forEach(b=>b.onclick=()=>{if(G.draftPoint(ME,b.dataset.pinc,1).ok)render()});
    $$("[data-pdec]").forEach(b=>b.onclick=()=>{if(G.draftPoint(ME,b.dataset.pdec,-1).ok)render()});
    on("#cashOut",()=>{if(G.cashOut(ME).ok)render()});
    on("#nextLevel",startNextLevel);
    on("#replay",()=>{const keep={email:S.email,code:S.code,av:S.av,name:S.name,visited:{...S.visited}};/* rooms stay revealed on the Office Map *//* anomalies and the Glitch Report start over at 0 of 3 */endSession();S=fresh();Object.assign(S,keep);S.step=3;S.maxStep=3;render()});
    on("#restart",signOut);
  }
}
/* SOP cards: a mouse or pen press counts on button-down, so a fast click that slips off the card is never lost.
   The click that follows a press is ignored, so nothing counts twice. Keyboard (Enter/Space) and touch taps use click. */
let sopDownAt=-1e9;
function sopPress(b,fn){
  b.onpointerdown=e=>{if(e.pointerType==="touch"||e.button!==0||b.disabled)return;e.preventDefault();sopDownAt=performance.now();fn()};
  b.onclick=e=>{if(e.detail>0&&performance.now()-sopDownAt<1000)return;fn()}}
/* Lock in: Game places your draft and saves your picks. Stats Update or Graduation closes only when its timer runs out.
   If the timer runs out first, Game keeps your picks and places the rest by the bot rule. */
function lockPoints(){
  if(G.step!=="statsUpdate"&&G.step!=="graduation")return;
  if(!ME.isStuck()&&ME.earned>0&&!G.lockPoints(ME).ok)return;
  render();
}
/* Level 1: save the team's SOP board; Game scores it and ranks teams when the SOP timer runs out. */
function checkSop(){if(trialDone()||S.sop.submitted)return;if(!G.submitSop(ME).ok)return;S.sop.submitted=true;render()}
/* Available steps: the display order, minus the steps already on the board. */
function sopPile(){const b=G.sopBoard(MYTEAM);return S.sop.pile.filter(t=>!b.includes(t))}
function payCost(){
  if(G.didRun("payTrialCosts"))return;
  G.endTrial();   // pay the cost, then Trial > Glitch Report
}

/* red glitch cursor (menus only) */
const curRed=`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M4 2 L4 26 L10 20 L14 30 L19 28 L15 18 L24 18Z" fill="#e0394d" stroke="#0b0e13" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
const curGl=`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M6 2 L6 26 L12 20 L16 30 L21 28 L17 18 L26 18Z" fill="#ff4fa3" opacity=".8"/><path d="M2 2 L2 26 L8 20 L12 30 L17 28 L13 18 L22 18Z" fill="#38e6d6" opacity=".8"/><path d="M4 2 L4 26 L10 20 L14 30 L19 28 L15 18 L24 18Z" fill="#e0394d" stroke="#0b0e13" stroke-width="2.5" stroke-linejoin="round"/><rect x="0" y="12" width="28" height="3" fill="#ff4fa3"/></svg>`;
const curUri=x=>`url("data:image/svg+xml,${encodeURIComponent(x)}") 4 2`;
document.documentElement.style.setProperty("--cur-red",curUri(curRed));document.documentElement.style.setProperty("--cur-gl",curUri(curGl));
document.addEventListener("pointerdown",()=>{if(!document.body.classList.contains("menucur"))return;document.body.classList.add("curgl");setTimeout(()=>document.body.classList.remove("curgl"),220)});
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("button");if(b&&document.body.classList.contains("menucur")){b.classList.add("btngl");setTimeout(()=>b.classList.remove("btngl"),220)}});
$("#navBack").onclick=()=>{if(!canBack())return;if(S.step===1&&S.menu!=="map"){S.menu="map";render();return}if(S.step===1){signOut();return}go(S.step-1)};
$("#navNext").onclick=goForward;
/* Progress board: read-only, open at any time in the game. Data comes only from Game.board(). */
const BOARD=BoardView.mount(()=>G?G.board():null);
$("#boardBtn").onclick=()=>BOARD.open();
/* Full screen button: screen code in fullscreen-view.js. Esc exits and the label updates on its own. */
FullscreenView.mount($("#fsBtn"));
$("#facBtn").onclick=e=>{const v=e.currentTarget.getAttribute("aria-pressed")!=="true";e.currentTarget.setAttribute("aria-pressed",v);$("#fac").hidden=!v};
/* Host Script: only the host sees the button. Solo testing: Ctrl+Shift+H turns host view on or off. */
addEventListener("keydown",e=>{if(!(e.ctrlKey&&e.shiftKey&&(e.key==="H"||e.key==="h")))return;e.preventDefault();
  const b=$("#facBtn");b.hidden=!b.hidden;if(b.hidden){b.setAttribute("aria-pressed","false");$("#fac").hidden=true}});
/* Attendance popup: screen code in attendance-view.js. The rules live in rules/Attendance.js and rules/Game.js.
   Input only counts once a round exists. Pausing is decided in rules/Game.js. */
const ATT=AttendanceView.mount({game:()=>G,me:()=>ME,onChange:()=>render()});
/* Dev jump (Ctrl+Shift+1 to 7): remove or gate before Base44. */
var DEV_JUMP=true;
function devJumpLevel(e){
  if(!e.ctrlKey||!e.shiftKey||e.altKey||e.metaKey)return 0;
  const m=/^Digit([1-7])$/.exec(e.code||"");if(m)return +m[1];
  const k=/^([1-7])$/.exec(e.key||"");return k?+k[1]:0;
}
function devJump(n){
  if(!DEV_JUMP)return;
  if(!Number.isInteger(n)||n<1||n>EP.Round.LEVELS.length)return;
  elevTimers.forEach(clearTimeout);elevTimers=[];
  BOARD.close();ATT.close();
  const w=$("#whisper");if(w){clearTimeout(w._t);w.hidden=true}
  if(!S.code)S.code="CYCLE60";
  if(!S.name)S.name=S.draft&&S.draft.trim().length>=2?S.draft.trim():"Dev";
  if(!S.type){S.type="coop";S.spend=EP.Bots.typicalSpend("coop")}
  else if(spendLeft()!==0)S.spend=EP.Bots.typicalSpend(S.type);
  const startNew=!G||n<=G.level;
  if(startNew){endSession();S.pendingL=false;S.maxStep=5;newSession()}
  G.jumpToLevel(n);
  MYTEAM=G.teamOf(ME);
  resetRoundUI();
  S.arrived=true;S.doorsDone=true;S.arr="done";
  go(5);
}
addEventListener("keydown",e=>{if(!DEV_JUMP)return;const lv=devJumpLevel(e);if(!lv)return;e.preventDefault();devJump(lv)});
render();
