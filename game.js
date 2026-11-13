(function(){
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
const A=[{k:"focus",n:"Focus"},{k:"initiative",n:"Initiative"},{k:"collab",n:"Collaboration"},{k:"composure",n:"Composure"},{k:"grit",n:"Grit"}];
const AN=Object.fromEntries(A.map(a=>[a.k,a.n]));
/* Rule data lives in rules/*.js. These tables only add display text. */
const TYPE_TEXT={
  coop:{blurb:"You lift the team. Strong at working with others and staying calm. Slower to jump in first.",pathDesc:"Cancel 1 teammate glitch with a gift in the gift window."},
  indep:{blurb:"You lock in and push through. Strong focus and grit. Teamwork costs you more.",pathDesc:"Make 1 correct accusation yourself."},
  contra:{blurb:"You question the system. Quick to act and hard to stop. Easier to rattle. Can sabotage.",pathDesc:"Get through 3 sabotage rounds without being caught."}};
const TYPES=Object.fromEntries(Object.entries(EP.Player.TYPES).map(([k,r])=>[k,{...r,n:r.name,...TYPE_TEXT[k]}]));
const ROUNDS=EP.Round.LEVELS.map(l=>({n:l.n,name:l.name,a:l.attr,c:l.cost}));
const E="#0b0e13";
const st=`stroke="${E}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"`;
/* ================= PIXEL INTERN ENGINE ================= */
const SKIN=["#ffe0c8","#f6cba8","#e8b48c","#d8a072","#c68c5e","#ad7448","#94603a","#7c4d2e","#653c23","#4e2d1a"];
const HAIRC=["#16100c","#3b2416","#6b4226","#a0522d","#d9a35b","#f1dfb0","#a9a9b3","#d8323f","#7b3fd4","#2f5fe0"];
const CLOTH=["#d8323f","#2f5fe0","#f2b84b","#1f8a3b","#ec5fc0","#7b3fd4","#f2f5f8","#3e4650","#38c6d6","#f2852a"];
const BOTC=["#2a2f3a","#13294b","#4a5f8a","#6b4a2e","#e6dccb","#d8323f"];
const BODY=["Masculine","Feminine"];
const HAIR=["Short","Buzz","Curly","Afro","Puffs","Bob","Long","Ponytail","Bun","Braids","Head wrap","None"];
const TOP=["Tee","Blazer","Hoodie","Cardigan","Polo"];
const BOT=["Pants","Skirt","Shorts"];
const HAT=["None","Cap","Beanie","Headphones","Bow","Crown","Hard hat"];
const EXTRA=["None","Glasses","Lashes","Earrings","Lanyard","Freckles"];
const GW=16,GH=27,OY=2; // grid with outline margin

function sprite(a,o={}){
  const g=Array.from({length:GH},()=>Array(GW).fill(null));
  const set=(x,y,c)=>{y+=OY;if(x>=0&&x<GW&&y>=0&&y<GH)g[y][x]=c};
  const R=(x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)set(x+i,y+j,c)};
  const sk=SKIN[a.skin],skd=shade(sk,.85),hc=HAIRC[a.hairC],hcd=shade(hc,.7),hcl=shade(hc,1.35),cl=CLOTH[a.top],cld=shade(cl,.78),bc=BOTC[a.bot],bcd=shade(bc,.75),ac=CLOTH[a.acc];
  const hair=HAIR[a.hair],top=TOP[a.topS],bot=BOT[a.botS],hat=HAT[a.hat],ex=EXTRA[a.extra];
  /* back hair */
  if(hair==="Afro"){R(5,1,6,1,hc);R(3,2,10,1,hc);R(2,3,12,6,hc);R(3,9,10,1,hc)}
  if(hair==="Long"){R(3,4,10,2,hc);R(3,6,1,10,hc);R(12,6,1,10,hc);R(4,11,8,1,hcd)}
  if(hair==="Bob"){R(3,4,10,2,hc);R(3,6,1,5,hc);R(12,6,1,5,hc)}
  if(hair==="Ponytail"){R(12,5,2,7,hc);R(13,11,1,2,hcd)}
  if(hair==="Bun"){R(6,1,4,2,hc);R(7,0,2,1,hc)}
  if(hair==="Puffs"){R(1,2,4,3,hc);R(2,1,2,1,hc);R(2,5,2,1,hc);R(11,2,4,3,hc);R(12,1,2,1,hc);R(12,5,2,1,hc)}
  if(hair==="Braids"){for(let y=6;y<18;y++){set(3,y,y%2?hc:hcd);set(12,y,y%2?hc:hcd)}set(3,18,ac);set(12,18,ac)}
  if(hair==="Head wrap"){R(3,3,10,3,ac);R(3,6,2,6,ac);R(11,6,2,6,ac);R(3,12,10,2,shade(ac,.8))}
  /* legs / bottoms */
  /* Skirt: A-line flaring to a wide hem. Shorts: two leg openings with a gap. Pants: full-length legs. */
  if(bot==="Skirt"){R(4,19,8,1,bc);R(3,20,10,1,bc);R(2,21,12,1,bcd);R(5,22,2,1,sk);R(9,22,2,1,sk)}
  else if(bot==="Shorts"){R(5,19,6,1,bc);R(4,20,3,1,bc);R(9,20,3,1,bc);R(5,21,2,2,sk);R(9,21,2,2,sk)}
  else{R(5,19,3,4,bc);R(8,19,3,4,bc);R(7,19,2,1,bcd)}
  R(4,23,4,1,"#1b1f27");R(8,23,4,1,"#1b1f27");set(4,23,"#3a3f4a");set(11,23,"#3a3f4a");
  /* torso + arms */
  if(a.body===1){/* fitted cut: shoulders, waist, hips */
    R(4,13,8,1,cl);R(5,14,6,4,cl);R(4,18,8,1,cld);R(4,14,1,4,cld);R(11,14,1,4,cld);set(3,18,sk);set(12,18,sk);
  }else{R(4,13,8,6,cl);R(4,18,8,1,cld);R(3,13,1,5,cld);R(12,13,1,5,cld);set(3,18,sk);set(12,18,sk)}
  if(top==="Blazer"){R(6,13,4,4,"#f2f5f8");R(7,13,2,4,a.top===0?CLOTH[1]:CLOTH[0]);set(6,13,cl);set(9,13,cl);set(7,17,cl);set(8,17,cl);set(5,15,cld);set(10,15,cld)}
  if(top==="Hoodie"){R(5,12,6,1,cld);set(6,14,"#fff");set(6,15,"#fff");set(9,14,"#fff");set(9,15,"#fff");R(5,17,6,1,cld)}
  if(top==="Cardigan"){R(6,13,4,5,"#f2f5f8");set(5,14,cld);set(5,16,cld);set(10,14,cld);set(10,16,cld)}
  if(top==="Polo"){R(6,13,1,1,"#f2f5f8");R(9,13,1,1,"#f2f5f8");set(7,14,cld);set(7,15,cld)}
  if(ex==="Lanyard"){set(5,13,ac);set(6,14,ac);set(10,13,ac);set(9,14,ac);R(7,15,2,2,"#fff")}
  /* neck + head */
  R(7,12,2,1,skd);
  R(4,5,8,7,sk);R(5,4,6,1,sk);R(5,12-0,6,0,sk);if(a.body===1){set(4,11,null);set(11,11,null)}else{set(4,11,skd);set(11,11,skd)}R(5,11,6,1,sk);
  /* face */
  R(6,8,1,2,E);R(9,8,1,2,E);set(6,8,"#2a3240");set(9,8,"#2a3240");
  set(7,11,shade(sk,.7));set(8,11,shade(sk,.7));
  if(a.blush!==false){set(5,10,shade(sk,.9).replace(/./,"#")&&"#e88a8a");set(10,10,"#e88a8a")}
  if(ex==="Glasses"){const fr="#2a3240";R(5,7,3,1,fr);R(8,7,3,1,fr);[5,7,8,10].forEach(x=>{set(x,8,fr)});set(6,8,"#cfe8ff");set(9,8,"#cfe8ff");set(6,9,E);set(9,9,E)}
  if(ex==="Lashes"){set(5,7,E);set(10,7,E);set(7,11,"#c0394d");set(8,11,"#c0394d")}
  if(ex==="Earrings"){set(3,10,"#f2b84b");set(12,10,"#f2b84b")}
  if(ex==="Freckles"){set(5,10,shade(sk,.72));set(10,10,shade(sk,.72));set(6,10,shade(sk,.8))}
  /* front hair */
  const cap=()=>{R(5,3,6,1,hc);R(4,4,8,1,hc);set(4,5,hc);set(11,5,hc);R(5,5,3,1,hc);set(5,3,hcl)};
  if(hair==="Short"){cap();set(4,6,hc);set(11,6,hc)}
  if(hair==="Buzz"){R(4,4,8,1,hcd);set(4,5,hcd);set(11,5,hcd)}
  if(hair==="Curly"){R(4,3,8,2,hc);set(5,2,hc);set(7,2,hc);set(9,2,hc);set(4,5,hc);set(11,5,hc);set(6,5,hc);set(8,5,hc);set(10,5,hc);set(7,3,hcl);set(10,3,hcl)}
  if(hair==="Afro"){R(4,4,8,1,hc);set(4,5,hc);set(11,5,hc);set(6,2,hcl);set(9,3,hcl)}
  if(["Puffs","Bob","Long","Ponytail","Bun","Braids"].includes(hair)){cap();if(hair!=="Ponytail"&&hair!=="Bun"&&hair!=="Puffs"){set(4,6,hc);set(11,6,hc)}}
  if(hair==="Bob"||hair==="Long"){R(4,5,1,4,hc);R(11,5,1,4,hc)}
  if(hair==="Head wrap"){R(4,4,8,2,ac);set(5,4,shade(ac,1.3));set(9,3,shade(ac,1.2))}
  /* hats */
  if(hat==="Cap"){R(4,2,8,3,ac);R(11,4,3,1,shade(ac,.7));set(7,2,shade(ac,1.3))}
  if(hat==="Beanie"){R(4,1,8,3,ac);R(4,4,8,1,shade(ac,.7));R(7,0,2,1,shade(ac,.7))}
  if(hat==="Headphones"){R(4,2,8,1,E);set(3,3,E);set(12,3,E);R(3,6,1,4,ac);R(12,6,1,4,ac);R(2,7,1,2,shade(ac,.7));R(13,7,1,2,shade(ac,.7))}
  if(hat==="Bow"){R(10,2,3,2,ac);set(11,2,shade(ac,.7));set(11,3,shade(ac,.7));set(13,2,ac);set(9,3,ac)}
  if(hat==="Crown"){R(5,2,6,2,"#f2b84b");set(5,1,"#f2b84b");set(7,1,"#f2b84b");set(8,1,"#f2b84b");set(10,1,"#f2b84b");set(7,3,"#d8323f")}
  if(hat==="Hard hat"){R(5,1,6,3,"#f2b84b");R(3,4,10,1,"#d29a2a");set(6,1,"#ffe08a")}
  /* outline pass */
  const out=g.map(r=>r.slice());
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){if(g[y][x])continue;const n=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>g[y+dy]&&g[y+dy][x+dx]);if(n)out[y][x]=E}
  /* render */
  const s=o.cell||10;let r="";
  const holo=o.holo,glitch=o.glitch;
  out.forEach((row,y)=>row.forEach((c,x)=>{if(!c)return;let xx=x;if(glitch&&(y===10||y===16||y===17))xx+=(y===16?2:-1);
    const hc=o.holoC||"#5ff2ff";let fill=c,op="";if(holo){if(c===E)fill=hc;else op=` opacity="${o.ghost?.16:.38}"`}
    else if(glitch&&y===10&&c!==E)fill="#ff4fa3";
    r+=`<rect x="${xx*s}" y="${y*s}" width="${s+.4}" height="${s+.4}" fill="${fill}"${op}/>`}));
  if(holo)for(let y=0;y<GH;y+=2)r+=`<rect x="0" y="${y*s}" width="${GW*s}" height="${s*.4}" fill="${o.holoC||"#5ff2ff"}" opacity=".12"/>`;
  if(glitch)r+=`<rect x="0" y="${14*s}" width="${GW*s}" height="${s*.6}" fill="#38e6d6" opacity=".7"/>`;
  const vb=o.head?`${2*s} 0 ${12*s} ${14*s}`:o.legs?`${2*s} ${18*s} ${12*s} ${9*s}`:`0 0 ${GW*s} ${GH*s}`;
  return `<svg viewBox="${vb}" shape-rendering="crispEdges" role="img" aria-label="${o.label||"Pixel intern"}"${o.attrs||""}>${r}</svg>`;
}
function pix(map,pal,s=6){let r="";map.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch===".")return;r+=`<rect x="${x*s}" y="${y*s}" width="${s+.3}" height="${s+.3}" fill="${pal[ch]}"/>`}));const w=map[0].length*s,h=map.length*s;return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${r}</svg>`}
const TOOLS=[
 {n:"Coffee Mug",rar:"Common",r:"var(--common)",ab:"Recharge",d:"Refill 1 backup heart, even above the round's refill.",uses:"1 use",m:["...g..g...","....g..g..",".kkkkkkk..",".kwwwwwwkk",".kbbbbbbk.k",".kwwwwwwk.k",".kwwwwwwkk.",".kwwwwwwk..","..kkkkkk..",".........."],p:{k:E,w:"#f2f5f8",b:"#7a4d2a",g:"#9aa6b8"}},
 {n:"Sticky Note",rar:"Common",r:"var(--common)",ab:"Reminder",d:"Peek at next level's trial attribute before you place your points.",uses:"2 uses",m:["kkkkkkkkk.","kyyyyyyyk.","kyddddyyk.","kyyyyyyyk.","kydddyyyk.","kyyyyyyyk.","kyyyyykkk.","kyyyyykk..","kkkkkkk...",".........."],p:{k:E,y:"#f5e04a",d:"#a8941f"}},
 {n:"Stapler",rar:"Rare",r:"var(--rare)",ab:"Lock down",d:"Staple one attribute for a round. Sabotage can't drain it.",uses:"1 use",m:["..........","..kkkkkkk.",".krrrrrrwk","krrrrrrrrk","kkkkkkkkkk","kssssssssk","kkkkkkkkkk",".........."],p:{k:E,r:"#d8323f",w:"#fff",s:"#7f8fa1"}},
 {n:"Desk Plant",rar:"Rare",r:"var(--rare)",ab:"Breathe",d:"Add 10 seconds to your team's gift window.",uses:"2 uses",m:["...k..k...","..kgk.kgk.","..kgkkggk.","...kggk...","....kk....","..kkkkkk..","..kccccck.","...kccck..","...kkkkk..",".........."],p:{k:E,g:"#4fe08a",c:"#e2706a"}},
 {n:"Rubber Duck",rar:"Epic",r:"var(--epic)",ab:"Debug",d:"Your team's next wrong accusation costs nothing.",uses:"1 use",m:["....kkk...","...kyyyk..","...kyeykok","...kyyykkk","kk.kyyyk..","kykkyyyykk","kyyyyyyyyk",".kyyyyyyk.","..kkkkkk..",".........."],p:{k:E,y:"#f5e04a",e:E,o:"#f2852a"}},
 {n:"USB Backup",rar:"Legendary",r:"var(--legend)",ab:"Restore point",d:"Your first glitch reboots without losing your backup hearts.",uses:"1 use",m:["..........","kkkkkkk...","kbbbbbkkkk","kbcbbbkssk","kbbbbbkskk","kbbbbbkssk","kbbbbbkkkk","kkkkkkk...",".........."],p:{k:E,b:"#2f5fe0",c:"#5ff2ff",s:"#cbd3dc"}}];
const TEAM=[{n:"Juno",av:{body:1,skin:2,hair:7,hairC:3,top:1,topS:3,bot:0,botS:0,hat:4,extra:2,acc:0,tool:0}},{n:"Dex",av:{body:0,skin:8,hair:0,hairC:0,top:6,topS:2,bot:1,botS:0,hat:3,extra:0,acc:0,tool:3}},{n:"Mara",av:{body:0,skin:5,hair:9,hairC:1,top:2,topS:4,bot:0,botS:0,hat:0,extra:4,acc:1,tool:2}}];
const WTABS=[["body","Character"],["hair","Hair"],["outfit","Outfit"],["acc","Accessories"],["tool","Tool"]];
const GHOSTS=[
 {n:"USER_???",a:{body:0,skin:3,hair:0,hairC:6,top:7,topS:0,bot:0,botS:0,hat:0,extra:4,acc:6},line:"Did you read your badge? Read it again."},
 {n:"ATTEMPT_01",a:{body:1,skin:6,hair:6,hairC:6,top:7,topS:3,bot:0,botS:1,hat:0,extra:0,acc:6},line:"The coffee step that never ends... leave it out."},
 {n:"NULL",a:{body:0,skin:1,hair:8,hairC:6,top:7,topS:2,bot:0,botS:0,hat:3,extra:0,acc:7},line:"Someone on Team Wren keeps slipping into the Breakout Room."}];
const GSPOTS=[[110,170],[190,120],[300,150],[500,140],[400,215],[650,160],[720,210],[130,440],[200,380],[330,430],[470,440],[630,450],[710,380]];
const OTHERS=[{t:"Team Wren",p:["Rook","Ivy","Sol","Kai"]},{t:"Team Finch",p:["Tess","Omar","Bea","Lin"]},{t:"Team Heron",p:["Nia","Theo","Ruth","Ash"]}];
const SOP=["Fill the reservoir with cold water","Place a paper filter in the basket","Add 2 tablespoons of ground coffee per cup","Close the lid and press Start","Wait until brewing finishes","Pour into a mug and serve"];
const DECOY="Repeat step 1 until performance is satisfactory";
const CLUES=[
  {id:"L",kind:"ERROR",where:"Sign-in screen",found:"The title ends in a capital L. Systems don't make typos by accident.",hint:"Something on the very first screen was spelled wrong."},
  {id:"id",kind:"WATCHER",where:"Your badge",found:"Your intern ID says ATTEMPT 02. You have been here before.",hint:"Your badge flickered. Did you read it closely?"},
  {id:"loop",kind:"LOOP",where:"SOP trial",found:"One SOP step told you to repeat forever. You left it out.",hint:"One step in the procedure didn't belong."}];
/* Anomalies: the 3 CLUES above are the only ones that count. Ghosts give hints only. */
const anomaliesFound=()=>CLUES.filter(c=>S.found[c.id]).length;
const STEPS=["Sign in","Menu","Wardrobe","Work style","Arrival","Briefing","Open Floor","Trial","Glitch Report","Stats Update"];
const FAC=[
  ["Players sign in with their i.c.stars email and the join code you give them.","Do NOT mention a simulation. If anyone asks about the capital L, say: \"Please report any issues to IT.\""],
  ["Tell everyone to press PLAY. How to Play is the onboarding packet; give the room 3 minutes with it."],
  ["About 5 minutes in the wardrobe. Names: letters, numbers and spaces only. No real names."],
  ["Work style is secret. Remind players: never tell anyone your type or your numbers.","Everyone ends with 24 total points and 3 backup hearts."],
  ["Intermission in All Skate. Teams of 4. Move players between teams if needed, then start Level 1."],
  ["Reveal: Boot Up tests Grit. Every player pays 2 Grit after the trial."],
  ["Open Floor: players walk the office. Breakout Room = sabotage a teammate (Contrarians). High Tea = network with a guest for a hint. All Skate = reflect and plan. Conference Room has the emergency button. Kitchen = gift any teammate (also in the gift window).","Live game: ~3 minutes. Demo timer: 90 seconds."],
  ["Teams play the SOP challenge (coffee). In the live game you mark each team Win or Loss."],
  ["All-hands meeting in the Conference Room. Each player may accuse one teammate.","Then open the 30-second gift window. Glitches lock in when it closes."],
  ["Win = 4 points, Loss = 2, glitched = 1. Bonuses: correct accusation +1, Skim, Cash Out. Players place points before the next trial is revealed. Backup refills by 1."]];
const MEMOS=[["From: Management","Performance reviews are mandatory. Exit is not guaranteed."],["From: IT","We are aware of a typo on the sign-in screen. It is not a typo."],["From: Facilities","The Kitchen coffee machine has been restocked. Again. And again. And again."]];

/* ---------- state ---------- */
const fresh=()=>({step:0,maxStep:0,menu:"map",email:"",code:"",found:{},
  av:{body:1,skin:7,hair:4,hairC:0,top:0,topS:1,bot:1,botS:1,hat:0,extra:3,acc:4,tool:4},name:"",draft:"",tab:"body",
  type:null,base:{focus:1,initiative:1,collab:1,composure:1,grit:1},
  inter:{left:90},room:"studio",arrived:false,arr:"elev",arrLine:0,doorsDone:false,pos:{x:100,y:710},visited:{elevator:true},panel:false,wroom:"elevator",nearGhost:0,
  of:{left:90,applied:false,msg:""},mmHidden:false,prog:{level:0,done:0},/* badge: highest level reached, levels completed */
  sop:{pile:[],built:[],checked:false,score:0,decoyOut:false,inTime:true,left:60},
  win:null,pay:null,paid:false,acc:{target:"",done:false,result:null},gw:{left:20,started:false,closed:false,received:[],sent:[]},
  earnLines:[],cashed:false,got:0,place:{},done:false,timer:null});
let S=fresh();

/* ---------- rules engine session ----------
   G is the Game object from rules/Game.js. It owns every rule number.
   ME is your Player. S above only holds screen state. */
let G=null,ME=null,MYTEAM=null;
const RNG=Math.random;
const MATE=n=>G&&G.players.find(p=>p.name===n);
function newSession(){
  ME=new EP.Player({id:0,name:S.name,type:S.type,spend:Object.fromEntries(A.map(a=>[a.k,S.base[a.k]-1]))});
  // 16 players: 8 Cooperative, 5 Independent, 3 Contrarian. You take one slot of your type.
  const pool=[...Array(8).fill("coop"),...Array(5).fill("indep"),...Array(3).fill("contra")];
  pool.splice(pool.indexOf(S.type),1);
  const types=shuffle(pool);let id=1;
  const mk=n=>EP.Bots.makePlayer(id++,n,types.pop());
  MYTEAM=new EP.Team({id:0,name:"Team Kestrel",members:[ME,...TEAM.map(p=>mk(p.n))]});
  const others=OTHERS.map((o,i)=>new EP.Team({id:i+1,name:o.t,members:o.p.map(mk)}));
  G=new EP.Game({teams:[MYTEAM,...others],rng:RNG});
}
function endSession(){G=null;ME=null;MYTEAM=null}
/* Sign out keeps only the display name, saved under the email. Look, tool and progress reset.
   The name comes back on the next sign-in with the same email. */
const NAMES={};
const nameKey=em=>String(em||"").trim().toLowerCase();
function savedName(em){const k=nameKey(em);if(NAMES[k])return NAMES[k];try{return (JSON.parse(localStorage.getItem("ep.names")||"{}"))[k]||""}catch(e){return ""}}
function saveName(em,name){const k=nameKey(em);if(!k||!name)return;NAMES[k]=name;try{const all=JSON.parse(localStorage.getItem("ep.names")||"{}");all[k]=name;localStorage.setItem("ep.names",JSON.stringify(all))}catch(e){}}
function signOut(){saveName(S.email,S.name);endSession();S=fresh();render()}
function startLevel(){if(!G.round)G.startNextRound();S.prog.level=Math.max(S.prog.level,G.level);go(5)}
const R=()=>G&&G.round?G.round:new EP.Round(1);

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const aOrAn=w=>(/^[aeiou]/i.test(w)?"an ":"a ")+w;   // "an Independent", "a Contrarian"
const shownName=()=>S.name||"Guest";   // one name source for the top bar and My Badge
const T=()=>TYPES[S.type];
const isBonus=k=>S.type&&T().bonus.includes(k);
const maxOf=k=>S.type&&T().pen===k?4:10;
const baseMax=k=>maxOf(k)-(isBonus(k)?2:0);
const spent=()=>Object.values(S.base).reduce((a,b)=>a+b,0)-5;
const total=()=>ME.total();
const fmt=x=>Math.floor(Math.max(0,x)/60)+":"+String(Math.max(0,x)%60).padStart(2,"0");
function shade(h,f){const n=parseInt(h.slice(1),16);const r=Math.min(255,Math.round(((n>>16)&255)*f)),g=Math.min(255,Math.round(((n>>8)&255)*f)),b=Math.min(255,Math.round((n&255)*f));return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}
function cleanName(v){return v.replace(/[^A-Za-z0-9 ]/g,"").replace(/\s{2,}/g," ").replace(/^\s+/,"").slice(0,16)}
const status=()=>ME?ME.flag():"OK";
const flag=s=>`<span class="flag ${s==="At risk"?"risk":s}">${s}</span>`;
const HEART=on=>`<svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 20.5 3.2 12A5.3 5.3 0 0 1 12 4.6 5.3 5.3 0 0 1 20.8 12Z" fill="${on?"#e0394d":"#3a1520"}" stroke="#0b0e13" stroke-width="2.4" stroke-linejoin="round"/>${on?'<path d="M7 8.5a2.5 2.5 0 0 1 3-1.5" stroke="#ffb3bd" stroke-width="1.8" fill="none" stroke-linecap="round"/>':""}</svg>`;
function stopTimer(){clearInterval(S.timer);S.timer=null}
function tick(key,obj,done){stopTimer();const draw=()=>{const e=$("#tmr");if(e){e.textContent=fmt(obj[key]);e.classList.toggle("low",obj[key]<=10)}};draw();
  S.timer=setInterval(()=>{obj[key]--;draw();if(obj[key]<=0){stopTimer();done()}},1000)}

/* ---------- character = Pixel Intern (sprite engine above) ---------- */
function avatarSVG(a,o={}){return sprite(a,{head:o.head,legs:o.legs,label:o.label,holo:o.holo,ghost:o.ghost,holoC:o.holoC,cell:10,attrs:(o.extra||"")+(o.style?` style="${o.style}"`:"")})}
/* ---------- instructors ---------- */
function screenhead(c,scr,face){const F={happy:`<path d="M44 34 l5 -5 l5 5 M66 34 l5 -5 l5 5" stroke="${scr}" stroke-width="4" fill="none"/><rect x="50" y="43" width="20" height="3" fill="${scr}"/>`,
  talk:`<rect x="45" y="27" width="8" height="8" fill="${scr}"/><rect x="67" y="27" width="8" height="8" fill="${scr}"/><rect x="52" y="41" width="16" height="7" fill="${scr}"/>`,
  sly:`<rect x="43" y="31" width="12" height="3" fill="${scr}"/><rect x="65" y="31" width="12" height="3" fill="${scr}"/><path d="M50 45 h14 l4 -4" stroke="${scr}" stroke-width="3" fill="none"/>`,
  glitch:`<rect x="34" y="22" width="22" height="6" fill="#ff5b6e"/><rect x="58" y="30" width="30" height="4" fill="#6aa8ff"/><rect x="40" y="40" width="40" height="4" fill="${scr}"/>`}[face];
  return `<svg viewBox="-6 -6 132 150"><rect x="38" y="110" width="17" height="26" rx="7" fill="#2a2f3a" ${st}/><rect x="65" y="110" width="17" height="26" rx="7" fill="#2a2f3a" ${st}/>
<rect x="16" y="72" width="16" height="38" rx="8" fill="${shade(c,.75)}" ${st}/><rect x="88" y="72" width="16" height="38" rx="8" fill="${shade(c,.75)}" ${st}/>
<rect x="28" y="64" width="64" height="58" rx="20" fill="${c}" ${st}/><path d="M60 72 l-6 6 l6 26 l6 -26z" fill="#fff" ${st}/>
<rect x="18" y="4" width="84" height="58" rx="14" fill="#e6ecf2" ${st}/><rect x="27" y="12" width="66" height="42" rx="9" fill="#13202b" stroke="${E}" stroke-width="3"/>${F}</svg>`}
function meeple(c,face){const mouth=face==="talk"?`<ellipse cx="60" cy="38" rx="5" ry="3.5" fill="${E}"/>`:`<path d="M54 36 q6 4 12 0" stroke="${E}" stroke-width="3" fill="none"/>`;
  return `<svg viewBox="0 0 120 145"><path d="M60 10 a20 20 0 0 1 20 20 a20 20 0 0 1 -9 16 Q98 50 108 62 Q112 70 102 74 L86 74 L98 124 Q100 134 90 134 H70 L60 108 L50 134 H30 Q20 134 22 124 L34 74 L18 74 Q8 70 12 62 Q22 50 49 46 a20 20 0 0 1 -9 -16 a20 20 0 0 1 20 -20Z" fill="${c}" ${st}/>
<path d="M60 52 l-6 6 l6 24 l6 -24z" fill="#fff" stroke="${E}" stroke-width="3" stroke-linejoin="round"/><circle cx="53" cy="28" r="3.4" fill="${E}"/><circle cx="67" cy="28" r="3.4" fill="${E}"/>${mouth}
<path d="M40 14 Q60 -4 80 14 L76 20 Q60 10 44 20Z" fill="${shade(c,.6)}" ${st}/></svg>`}
function holoTeacher(face){const c="#5ff2ff",g=face==="glitch";return `<svg viewBox="0 0 120 150"><defs><linearGradient id="htg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".5"/><stop offset="1" stop-color="${c}" stop-opacity=".05"/></linearGradient></defs>
<ellipse cx="60" cy="140" rx="40" ry="8" fill="none" stroke="${c}" stroke-width="3"/><ellipse cx="60" cy="140" rx="26" ry="5" fill="${c}" opacity=".4"/>
<g fill="url(#htg)" stroke="${c}" stroke-width="2.5"${g?' transform="translate(4 0) skewX(-6)"':""}><ellipse cx="60" cy="42" rx="20" ry="24"/><path d="M60 18 V66 M40 42 H80 M44 28 Q60 36 76 28 M44 56 Q60 50 76 56" fill="none"/>
<path d="M22 118 Q24 82 60 76 Q96 82 98 118Z"/><path d="M40 82 L60 118 L80 82 M30 100 H90" fill="none"/></g>
<rect x="44" y="36" width="32" height="8" rx="3" fill="${c}"/>${face==="talk"?'<rect x="54" y="54" width="12" height="3" fill="#5ff2ff"/>':""}
${[0,1,2,3,4,5,6,7].map(i=>`<rect x="20" y="${20+i*13}" width="80" height="1.5" fill="${c}" opacity=".25"/>`).join("")}${g?'<rect x="14" y="60" width="92" height="5" fill="#ff4fa3"/>':""}</svg>`}
const DIALOGS=[
 {who:"SYS-ADMIN 01",role:"Glitches",tag:"System",draw:f=>screenhead("#2f5fe0","#5ff2ff",f),lines:[
   "Welcome back, intern. I'm here to explain how your performance is tracked.",
   "Every review costs points from one attribute. If an attribute drops below zero, you start glitching.",
   "During the gift window, a teammate can send points to pull you back to safety.",
   "If the window closes and you're still below zero, the glitch locks in. Glitch twice and you're stuck. Like m— like m— l1k3 m3."],glitchAt:3},
 {who:"SYS-ADMIN 02",role:"Contrarian",tag:"Secret",draw:f=>screenhead("#d8323f","#ff5b6e",f==="talk"?"sly":f),lines:[
   "Some interns don't trust the system. We call them Contrarians.",
   "A Contrarian can sabotage a teammate: the first one each round costs 1 heart and drains 2 points from the target.",
   "At the all-hands, every intern can accuse one teammate. Guess right and you earn a point. Guess wrong and you lose one.",
   "Three sabotage rounds nobody catches, and the Contrarian wins their own way. Not that I'd know anything about that."],glitchAt:-1},
 {who:"TEAM LEAD MEEP",role:"Cooperative",tag:"Teamwork",draw:f=>meeple("#1f8a3b",f),lines:[
   "Hey! I'm here for the Cooperatives: the interns who win by lifting each other up.",
   "You're strongest at Collaboration and Composure. Your gifts only cost 1 heart per point.",
   "Your secret path is called Lifeline: save 1 teammate from glitching with a gift-window gift.",
   "Nobody exits alone in here. Watch your team's status flags, and send help before the window closes."],glitchAt:-1},
 {who:"PROJECTION_IND",role:"Independent",tag:"Solo",draw:f=>holoTeacher(f),lines:[
   "Signal received. I'm here for the Independents: interns who lock in and push through on their own.",
   "You're strongest at Focus and Grit. Collaboration costs you more, so your gifts cost extra hearts.",
   "Your secret path is called Auditor: make 1 correct accusation yourself.",
   "Trust the data, not the noise. Watch who stays quiet when points go missing."],glitchAt:-1}];
const DPOS=DIALOGS.map(()=>0);
function dialogsHTML(){return `<div class="dialogs">${DIALOGS.map((d,i)=>{const p=DPOS[i],gl=p===d.glitchAt;return `<article class="dlg" data-d="${i}"><div class="top"><b>${d.who}</b><span class="chip ${i===1?"p":i===2?"g":i===3?"b":"r"}">${d.tag}</span></div>
<div class="body"><div class="portrait ${gl?"glitching":""}">${d.draw(gl?"glitch":"talk")}</div><div class="speech ${gl?"corrupt":""}">${d.lines[p]}</div></div>
<div class="foot"><span class="dots">${d.lines.map((_,j)=>`<i class="${j<=p?"on":""}"></i>`).join("")}</span><span class="label">${d.role}</span><button class="btn blue sm" data-dnext="${i}">${p===d.lines.length-1?"Replay":"Next ▶"}</button></div></article>`}).join("")}</div>`}

/* ---------- office floor map (top-down) ---------- */
const ROOMS={
  break:{n:"Break Room",pts:"40,90 90,40 230,40 230,250 40,250",lx:135,ly:238,fill:"url(#wood)"},
  studio:{n:"The Studio",pts:"290,30 510,30 550,70 550,250 250,250 250,70",lx:400,ly:238,fill:"url(#checker)"},
  server:{n:"Server Room",pts:"570,40 710,40 760,90 760,250 570,250",lx:665,ly:238,fill:"url(#grid)"},
  wellness:{n:"Wellness Room",pts:"40,320 230,320 230,520 90,520 40,470",lx:135,ly:510,fill:"#9cc7a6"},
  conf:{n:"Conference Room",pts:"250,320 550,320 550,520 250,520",lx:400,ly:510,fill:"#55729e"},
  mentor:{n:"Mentor Office",pts:"570,320 760,320 760,470 710,520 570,520",lx:665,ly:510,fill:"#b3aca0"}};
const SPOTS={break:[[150,190],[190,150],[110,160]],studio:[[400,108],[345,162],[455,162],[400,236]],server:[[690,170],[700,120]],wellness:[[150,420],[110,450]],conf:[[400,350],[340,470]],mentor:[[630,420],[700,400]]};
function furniture(){
  const E="#0b0e13",st=`stroke="${E}" stroke-width="4" stroke-linejoin="round"`;
  let f="";
  // break room
  f+=`<rect x="96" y="44" width="130" height="26" rx="4" fill="#d9dee5" ${st}/><rect x="110" y="46" width="22" height="20" rx="3" fill="#3e4650" ${st}/><circle cx="121" cy="56" r="4" fill="#e0394d"/><rect x="194" y="44" width="30" height="44" rx="4" fill="#f2f5f8" ${st}/><path d="M198 66 h22" stroke="${E}" stroke-width="3"/>
  <rect x="46" y="130" width="30" height="64" rx="4" fill="#d8323f" ${st}/><rect x="51" y="136" width="20" height="34" rx="2" fill="#13202b"/><g fill="#f5e04a"><rect x="54" y="140" width="5" height="5"/><rect x="62" y="140" width="5" height="5"/><rect x="54" y="149" width="5" height="5"/><rect x="62" y="158" width="5" height="5"/></g>
  <circle cx="150" cy="168" r="24" fill="#e6ecf2" ${st}/><path d="M118 168 a32 32 0 0 1 64 0" fill="none" stroke="#2f5fe0" stroke-width="9"/><path d="M118 168 a32 32 0 0 1 64 0" fill="none" stroke="${E}" stroke-width="2"/>`;
  // studio: round tables + all-hands button
  [[310,95],[490,95],[310,200],[490,200],[400,150]].forEach(([x,y],i)=>{f+=`<circle cx="${x}" cy="${y}" r="${i===4?30:24}" fill="#3f6fc6" ${st}/><path d="M${x-34} ${y} a34 34 0 0 1 68 0 M${x+34} ${y+6} a34 34 0 0 1 -68 0" fill="none" stroke="#2f4f8f" stroke-width="9" stroke-dasharray="20 8"/>`});
  f+=`<rect x="388" y="138" width="24" height="24" rx="4" fill="#f2b84b" ${st}/><circle cx="400" cy="150" r="7" fill="#e0394d" stroke="${E}" stroke-width="3"/><text x="400" y="176" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="10" fill="#fff" letter-spacing="1">ALL-HANDS</text>
  <rect x="300" y="34" width="200" height="10" rx="3" fill="#7fb8ec" ${st}/>`;
  // server room: racks + panels + wires
  f+=`${[0,1,2].map(i=>`<rect x="${586+i*30}" y="70" width="24" height="120" rx="3" fill="#2a2f3a" ${st}/>${[0,1,2,3,4,5].map(j=>`<circle cx="${592+i*30}" cy="${82+j*18}" r="2.5" fill="${(i+j)%3?"#4fe08a":"#e0394d"}"/>`).join("")}`).join("")}
  <rect x="690" y="58" width="40" height="44" rx="4" fill="#cbd3dc" ${st}/><path d="M710 66 l-8 14 h8 l-4 12 l12 -16 h-8 l4 -10z" fill="#f2b84b" stroke="${E}" stroke-width="2"/>
  <path d="M610 190 C640 230 700 180 720 104" fill="none" stroke="#e0394d" stroke-width="5"/><path d="M640 190 C660 220 730 200 714 104" fill="none" stroke="#f5e04a" stroke-width="5"/><path d="M670 190 C690 214 740 170 726 104" fill="none" stroke="#2f5fe0" stroke-width="5"/><path d="M600 192 C620 230 680 236 740 220" fill="none" stroke="${E}" stroke-width="5"/>`;
  // wellness: mats, plants, beanbag
  f+=`<rect x="70" y="350" width="34" height="70" rx="8" fill="#ec5fc0" ${st}/><rect x="114" y="350" width="34" height="70" rx="8" fill="#38e6d6" ${st}/><ellipse cx="190" cy="470" rx="26" ry="20" fill="#d8323f" ${st}/>
  ${[[200,352],[64,456]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="14" fill="#1f8a3b" ${st}/><circle cx="${x}" cy="${y}" r="6" fill="#5fe04a"/>`).join("")}`;
  // conference: long table, chairs, wall screen
  f+=`<rect x="320" y="324" width="160" height="12" rx="3" fill="#13294b" ${st}/><rect x="300" y="380" width="200" height="74" rx="30" fill="#a8743f" ${st}/>
  ${[320,360,400,440,480].map(x=>`<rect x="${x-10}" y="364" width="20" height="14" rx="5" fill="#3e4650" stroke="${E}" stroke-width="3"/><rect x="${x-10}" y="456" width="20" height="14" rx="5" fill="#3e4650" stroke="${E}" stroke-width="3"/>`).join("")}`;
  // mentor office: L desk, monitors, bookshelf
  f+=`<path d="M600 400 H700 V430 H630 V480 H600Z" fill="#8a5a33" ${st}/><rect x="612" y="404" width="26" height="18" rx="3" fill="#13202b" stroke="${E}" stroke-width="3"/><rect x="648" y="404" width="26" height="18" rx="3" fill="#13202b" stroke="${E}" stroke-width="3"/><rect x="615" y="407" width="20" height="12" fill="#6aa8ff" opacity=".7"/><rect x="651" y="407" width="20" height="12" fill="#6aa8ff" opacity=".7"/>
  <circle cx="660" cy="450" r="12" fill="#2a2f3a" ${st}/><rect x="580" y="326" width="120" height="20" rx="3" fill="#7a4d2a" ${st}/>${[0,1,2,3,4,5,6].map(i=>`<rect x="${586+i*16}" y="329" width="10" height="14" fill="${["#d8323f","#2f5fe0","#f2b84b","#1f8a3b","#ec5fc0","#38e6d6","#f2852a"][i]}"/>`).join("")}`;
  return f;
}
function officeMap(o={}){
  const E="#0b0e13";const mk=(o.markers||[]);
  return `<svg viewBox="0 0 800 560" role="img" aria-label="Office floor map">
  <defs>
    <pattern id="checker" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="28" height="28" fill="#d9d2c3"/><rect width="14" height="14" fill="#c9c1b0"/><rect x="14" y="14" width="14" height="14" fill="#c9c1b0"/></pattern>
    <pattern id="wood" width="40" height="16" patternUnits="userSpaceOnUse"><rect width="40" height="16" fill="#c9a77a"/><path d="M0 15.5 H40 M20 0 V16" stroke="#a9875a" stroke-width="1.5"/></pattern>
    <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#5d636b"/><path d="M0 21.5 H22 M21.5 0 V22" stroke="#4a5058" stroke-width="1.5"/></pattern>
    <pattern id="hall" width="36" height="36" patternUnits="userSpaceOnUse"><rect width="36" height="36" fill="#8d939a"/><path d="M0 35 H36 M35 0 V36" stroke="#7a8087" stroke-width="2" stroke-dasharray="6 4"/></pattern>
  </defs>
  <rect width="800" height="560" fill="#1a1f27"/>
  <rect x="24" y="22" width="752" height="514" rx="20" fill="#3a4048" stroke="${E}" stroke-width="6"/>
  <rect x="40" y="252" width="720" height="66" fill="url(#hall)"/>
  ${Object.entries(ROOMS).map(([k,r])=>`<g class="room ${o.click?"click":""} ${o.here===k?"here":""}" data-room="${k}"><polygon class="floor" points="${r.pts}" fill="${r.fill}" stroke="${E}" stroke-width="6" stroke-linejoin="round"/></g>`).join("")}
  ${[[115,247],[380,247],[640,247],[115,317],[380,317],[640,317]].map(([x,y])=>`<rect x="${x}" y="${y-4}" width="56" height="8" fill="#8d939a"/>`).join("")}
  <g pointer-events="none">${furniture()}</g>
  ${Object.entries(ROOMS).map(([k,r])=>`<text x="${r.lx}" y="${r.ly}" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="17" letter-spacing="2" fill="rgba(11,14,19,.55)" pointer-events="none">${r.n.toUpperCase()}</text>`).join("")}
  <text x="400" y="292" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="16" letter-spacing="6" fill="rgba(11,14,19,.35)">HALLWAY · FLOOR 60</text>
  ${(o.ghosts?GHOSTS:[]).map((g,i)=>`<g class="gwalk" data-ghost="${i}" opacity="0" transform="translate(${GSPOTS[i*4][0]} ${GSPOTS[i*4][1]})" style="cursor:pointer"><rect x="-24" y="-72" width="48" height="90" fill="transparent"/>${avatarSVG(g.a,{label:g.n,holo:true,ghost:true,holoC:"#e9ecff",extra:' x="-22" y="-66" width="44" height="74"'})}<text x="0" y="18" text-anchor="middle" font-family="Pixelify Sans,monospace" font-weight="700" font-size="12" fill="#e9ecff" stroke="#0b0e13" stroke-width="3" paint-order="stroke">${g.n}</text></g>`).join("")}
  ${mk.map(m=>`<g pointer-events="none">${avatarSVG(m.av,{label:m.n,holo:m.holo,extra:` x="${m.x-24}" y="${m.y-74}" width="48" height="81"`})}<text x="${m.x}" y="${m.y+20}" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="13" fill="${m.me?"#f2b84b":"#fff"}" stroke="#0b0e13" stroke-width="3" paint-order="stroke">${esc(m.n)}</text></g>`).join("")}
  </svg>`;
}
function teamMarkers(room){const s=SPOTS[room]||SPOTS.studio;const me={x:s[0][0],y:s[0][1],av:S.av,n:S.name||"You",me:true};
  const st=SPOTS.studio;return [me,...TEAM.map((p,i)=>({x:(room==="studio"?st[i+1]:st[i])[0],y:(room==="studio"?st[i+1]:st[i])[1],av:p.av,n:p.n}))]}

/* ---------- icons ---------- */
const IC={
  memo:`<svg viewBox="0 0 32 32"><path d="M4 13 L18 7 V25 L4 19Z" fill="#e0394d" stroke="#0b0e13" stroke-width="2.5" stroke-linejoin="round"/><rect x="18" y="11" width="6" height="10" rx="2" fill="#dfe7ef" stroke="#0b0e13" stroke-width="2.5"/><path d="M8 19 L10 27 H14 L12 19" fill="#dfe7ef" stroke="#0b0e13" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  badge:`<svg viewBox="0 0 32 32"><rect x="3" y="7" width="26" height="19" rx="3" fill="#a8d8ff" stroke="#0b0e13" stroke-width="2.5"/><circle cx="11" cy="15" r="3.5" fill="#e0394d" stroke="#0b0e13" stroke-width="2"/><path d="M17 13 h8 M17 18 h6" stroke="#0b0e13" stroke-width="2.5"/></svg>`,
  wrench:`<svg viewBox="0 0 32 32"><path d="M20 4 a7 7 0 0 0 -6 10 L5 23 a3 3 0 0 0 4 4 l9 -9 a7 7 0 0 0 10 -6 l-4 4 -4 -1 -1 -4z" fill="#cbd3dc" stroke="#0b0e13" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  map:`<svg viewBox="0 0 32 32"><path d="M3 7 L11 4 L21 7 L29 4 V25 L21 28 L11 25 L3 28Z" fill="#f2b84b" stroke="#0b0e13" stroke-width="2.5" stroke-linejoin="round"/><path d="M11 4 V25 M21 7 V28" stroke="#0b0e13" stroke-width="2.5"/></svg>`,
  clip:`<svg viewBox="0 0 64 60"><rect x="12" y="8" width="40" height="50" rx="5" fill="#a8743f" stroke="#0b0e13" stroke-width="4"/><rect x="18" y="16" width="28" height="36" fill="#fff" stroke="#0b0e13" stroke-width="3"/><rect x="24" y="4" width="16" height="10" rx="3" fill="#cbd3dc" stroke="#0b0e13" stroke-width="3.5"/><path d="M23 26 h18 M23 33 h18 M23 40 h12" stroke="#2f5fe0" stroke-width="3.5"/></svg>`,
  hanger:`<svg viewBox="0 0 64 60"><path d="M32 18 q0 -8 6 -8 q6 0 6 6 q0 5 -10 8 L6 40 H58 Z" fill="none" stroke="#0b0e13" stroke-width="5" stroke-linejoin="round"/><path d="M18 40 L22 56 H42 L46 40Z" fill="#e0394d" stroke="#0b0e13" stroke-width="4" stroke-linejoin="round"/><path d="M32 40 l-4 4 4 10 4 -10z" fill="#f2b84b" stroke="#0b0e13" stroke-width="2.5"/></svg>`};
function tabIcon(k){
  const a={...S.av};
  if(k==="body")return avatarSVG({...a,hat:0},{label:"Character"});
  if(k==="hair")return avatarSVG({...a,hat:0},{head:true,label:"Hair"});
  if(k==="outfit")return avatarSVG(a,{label:"Outfit"});
  if(k==="acc")return avatarSVG({...a,hat:a.hat||2},{head:true,label:"Accessories"});
  return pix(TOOLS[a.tool].m,TOOLS[a.tool].p);
}

/* ---------- navigation ---------- */
function canBack(){if(S.step===0)return false;if(S.maxStep>=5&&S.step<=4)return false;return true}
function fwd(){
  switch(S.step){
    case 0:return{label:"Clock in ▶",ok:true,cls:"red"};
    case 1:return{label:"Play ▶",ok:true,cls:"red"};
    case 2:return{label:"Save look ▶",ok:S.draft.trim().length>=2,cls:"green"};
    case 3:return{label:"Confirm stats ▶",ok:!!S.type&&spent()===15,cls:"red"};
    case 4:return S.arrived?{label:"Start Level 1 ▶",ok:true,cls:"red"}:{label:S.arr==="elev"?"Skip intro ▶":"Continue ▶",ok:S.arr!=="spawn",cls:"blue"};
    case 5:return{label:"Open the floor ▶",ok:true,cls:"red"};
    case 6:return{label:"Ready for trial ▶",ok:true,cls:"red"};
    case 7:return{label:"All-hands ▶",ok:S.sop.checked,cls:"red"};
    case 8:return{label:"Stats Update ▶",ok:S.gw.closed,cls:"red"};
    case 9:return{label:S.done?"Level 2 locked":"Lock in points",ok:!S.done&&placeLeft()===0,cls:S.done?"soft":"green"};
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
    case 6:applyOpenFloorEnd();go(7);return;
    case 7:payCost();go(8);return;
    case 9:lockPoints();return;
    default:go(S.step+1);
  }
}
function updateNav(){
  const b=$("#navBack"),n=$("#navNext"),f=fwd();
  b.hidden=S.step===0;b.disabled=!canBack();
  b.textContent=S.step===1?"◀ Sign out":"◀ Back";
  n.textContent=f.label;n.disabled=!f.ok;n.className="btn "+f.cls;
  $("#navMid").textContent=f.ok||S.step===9?STEPS[S.step]:({2:"Type a name to continue",3:"Pick a style and place all 15 points",7:"Submit your SOP first",8:"Finish the accusation and gift window"}[S.step]||STEPS[S.step]);
}

/* ---------- chrome ---------- */
const BANNER={4:"Intermission",6:"Open Floor",7:"The Trial"};
function chrome(){
  const inGame=S.step>=5;
  setRain(S.step===0?1:S.step===1?.18:.06);
  document.body.classList.toggle("menucur",S.step<=2);
  $("#topbar").hidden=S.step===0;
  $("#whoName").textContent=shownName();
  $("#where").textContent=inGame?"Level 1 · Boot Up":STEPS[S.step];
  $("#stage").classList.toggle("boxed",S.step>=3);
  $("#steps").hidden=S.step<=1||(S.step===4&&!S.arrived);
  $("#steps").innerHTML=STEPS.map((t,i)=>`<li class="${i===S.step?"on":i<S.step?"done":""}">${t}</li>`).join("");
  $("#fac").innerHTML=`<span class="label">Host script · ${STEPS[S.step]}</span><ul>${FAC[S.step].map(l=>`<li>${esc(l)}</li>`).join("")}</ul>`;
  const bl=S.step===8&&S.acc.done&&!S.gw.closed?"Gift Window":BANNER[S.step];
  const cin=S.step===4&&!S.arrived;
  const showB=!cin&&!!bl&&!(S.step===4&&S.maxStep>=5)&&!(S.step===7&&S.sop.checked)&&!(S.step===6&&S.of.applied);
  $("#banner").hidden=!showB;if(showB)$("#bannerT").textContent=bl;
  const h=$("#hud");
  if(!ME||S.step<4||cin){h.hidden=true}else{h.hidden=false;
  h.innerHTML=A.map(a=>{const v=ME.attrs[a.k];return `<div class="attr ${isBonus(a.k)?"bonus":""}"><div class="top"><span>${a.n}</span><span class="v ${v<0?"neg":""}">${v}/${maxOf(a.k)}</span></div><span class="trk"><i style="width:${Math.max(0,v)/maxOf(a.k)*100}%"></i></span></div>`}).join("")+
  `<div class="side"><div class="row" style="justify-content:space-between;gap:6px"><span class="label">Backup</span><span class="hearts">${[0,1,2].map(i=>HEART(i<ME.backup)).join("")}</span></div><div class="row" style="justify-content:space-between;gap:6px"><span class="label">Status</span>${flag(status())}</div><div class="row" style="justify-content:space-between;gap:6px"><span class="label">Anomalies</span><span class="label" style="color:var(--pink)">${anomaliesFound()}/${CLUES.length}</span></div></div>`;}
  updateNav();
}
/* The Wardrobe name box edits S.draft. S.name changes only on Save. */
function go(n){stopTimer();S.panel=false;if(n!==2)S.wardFrom=null;if(n===2&&S.step!==2)S.draft=S.name;S.step=n;S.maxStep=Math.max(S.maxStep,n);$(".wrap").scrollTo({top:0});render()}
/* Fit the map inside the scroll area above the bottom bar, and scroll it fully into view once per screen. */
/* On map screens the attribute bar sticks to the top (class "mapscreen"), so the map gets the space below it. */
function fitWorld(){const wrap=$(".wrap"),w=$("#world"),hud=$("#hud");if(!wrap||!w)return;
  const hudH=hud&&!hud.hidden?hud.offsetHeight+14:0;
  w.style.height=Math.max(300,Math.min(640,wrap.clientHeight-hudH-28))+"px";
  if(W.fitFor===S.step)return;W.fitFor=S.step;
  const need=w.offsetTop+w.offsetHeight+14-wrap.clientHeight;if(need>wrap.scrollTop)wrap.scrollTo({top:need})}

/* ---------- views ---------- */
const V=[];
V[0]=()=>`<div class="login"><div class="login-inner">
  <div class="logo" aria-label="Exit_ProtocoL"><span class="w1">EXIT_</span><span class="w2">PROTOCO<button class="glitch-L ${S.found.L?"found":""}" id="theL" aria-label="Letter L">L</button></span></div>
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
function badgeCard(){const idn=String(((S.name.length*37)+S.email.length*11)%900+100);
  return `<div class="badgecard"><div class="bc-pic">${avatarSVG(S.av,{label:"Badge photo"})}</div><div class="bc-data">
   <span class="wide"><span class="k">Employee ID</span><br><button class="idline ${S.found.id?"found":""}" id="idline" style="color:#13294b">060-${idn} · <span class="flick">ATTEMPT 02</span></button></span>
   <span class="wide"><span class="k">Display name</span><br><span class="v">${esc(shownName())}</span></span>
   <span><span class="k">Team</span><br><span class="v">Kestrel</span></span><span><span class="k">Cohort</span><br><span class="v">Cycle 60</span></span>
   <span><span class="k">Level</span><br><span class="v">${S.prog.level}</span></span><span><span class="k">XP · ${S.prog.done} of 7 levels</span><div class="xp"><i style="width:${Math.round(S.prog.done/7*100)}%"></i></div></span>
  </div></div><div class="row" style="justify-content:center"><button class="btn outline" id="toWardrobe">Change look</button><button class="btn outline" id="toName">Change name</button></div>`}
function packet(){return `<div style="display:grid;gap:12px">
  <div class="memo"><span class="label">Onboarding packet · Cycle 60</span><p>You've been given a second chance: a 14-week tech internship. Everything here looks normal. Learn fast, support your team and pass each review. Complete all 7 phases and pass your final <b>Performance Review</b> to exit. Interns who don't qualify are kept on for another contract.</p>
  <p style="font-family:var(--code);font-size:1.2rem;color:var(--red2)">&gt; note: exit_conditions could not be located. Continue anyway.</p></div>
  <div class="cols"><div class="panel"><span class="chip b">5 attributes</span><p>Focus, Initiative, Collaboration, Composure and Grit. Each review tests one and costs points from it.</p></div>
  <div class="panel"><span class="chip r">3 backup hearts</span><p>They cover you when an attribute runs short. Refill 1 per round.</p></div>
  <div class="panel"><span class="chip p">Glitches</span><p>Below 0 and you glitch. A teammate's gift can save you. Glitch twice and you're stuck.</p></div>
  <div class="panel"><span class="chip g">To exit</span><p>By Level 7: ${EP.Player.GRAD_TOTAL}+ total points, every attribute ${EP.Player.GRAD_MIN}+, not stuck.</p></div></div>
  <div class="panel"><span class="label">Work style extras</span><div class="cols"><div><b>Skim (Contrarian)</b><p class="hint">+1 point for each round you sabotage and nobody catches you. Up to ${EP.Player.SKIM_MAX} per game.</p></div><div><b>Cash Out (Independent)</b><p class="hint">Once per game at Stats Update, with full backup: trade ${EP.Player.CASHOUT_COST} backup hearts for 1 point.</p></div><div><b>Heart loss (Cooperative)</b><p class="hint">When a teammate's glitch locks in, each Cooperative on the team loses 1 backup heart.</p></div><div><b>Gifts to Independents</b><p class="hint">Independents cannot accept gifts. A gift to one comes back to you as a decline, and your hearts return.</p></div></div></div>
  <div class="panel tw"><table class="levels"><thead><tr><th>Level</th><th>Phase</th><th>Tests</th><th>Cost</th></tr></thead><tbody>
  ${ROUNDS.map(r=>`<tr><td class="n">${r.n}</td><td>${r.name}</td><td>${r.a?(r.n===1?AN[r.a]:"Revealed at briefing"):"Final review"}</td><td class="n">${r.n===1?r.c:r.c?"?":"0"}</td></tr>`).join("")}
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

V[3]=()=>{const left=15-spent();return `<div><span class="chip p">Secret</span><h2 style="margin-top:8px">Pick your work style</h2><p class="hint" style="margin-top:6px">Only you and the host see this. Other players only see your character, name, team and status.</p></div>
<div class="types">${Object.entries(TYPES).map(([k,t])=>`<button class="type" data-type="${k}" aria-pressed="${S.type===k}" ${S.maxStep>=5?"disabled":""}><h3>${t.n}</h3><span style="opacity:.9">${t.blurb}</span>
  <span class="row" style="gap:6px">${t.bonus.map(b=>`<span class="tag b">+2 ${AN[b]}</span>`).join("")}<span class="tag p">${AN[t.pen]} max 4</span></span>
  <span style="opacity:.9;font-size:.92rem"><b>Secret path · ${t.path}:</b> ${t.pathDesc}</span></button>`).join("")}</div>
${S.type?`<div class="row" style="justify-content:space-between"><h3>Spend your points</h3><span class="counter" style="color:${left?"var(--gold)":"var(--ok)"}">${left} of 15 left</span></div>
<p class="hint">Every attribute starts at 1. Bonus attributes get +2 after you confirm. Max is 10 (your weak attribute caps at 4).</p>
<div class="buy">${A.map(a=>{const v=S.base[a.k];return `<div class="brow"><span class="nm">${a.n}${isBonus(a.k)?'<span class="tag b">+2 bonus</span>':""}${T().pen===a.k?'<span class="tag p">max 4</span>':""}</span>
  <span class="step"><button class="minus" data-dec="${a.k}" aria-label="Lower ${a.n}" ${v<=1?"disabled":""}>−</button><span class="val">${v}</span><button class="plus" data-inc="${a.k}" aria-label="Raise ${a.n}" ${(v>=baseMax(a.k)||!left)?"disabled":""}>+</button></span>
  <span class="fin">final ${v+(isBonus(a.k)?2:0)}</span></div>`}).join("")}</div>`:""}`};

function personRow(p,me){return `<div class="person"><span class="who">${avatarSVG(p.av,{head:true,label:p.n})}${esc(p.n)}${me?' <span class="tag m">you</span>':""}</span>${flag(p.st||"OK")}</div>`}
V[4]=()=>{const t=T();if(!S.arrived)return elevatorScene();return `<div class="row" style="justify-content:space-between"><div><span class="chip b">Lobby · Code ${esc(S.code)}</span><h2 style="margin-top:8px">Floor 60 · Find your team</h2></div><span class="hint">Your team is waiting in All Skate. Explore while the intermission runs.</span></div>
${worldHTML("lobby")}
<div class="cols">
  <div class="panel"><span class="label">Team Kestrel</span><div class="roster">${personRow({n:S.name,av:S.av,st:status()},true)}${TEAM.map(p=>personRow({...p,st:MATE(p.n).flag()})).join("")}</div></div>
  <div class="panel"><span class="label">Secret path · ${t.path} <span class="tag s">${t.n}</span></span><p>${t.pathDesc}</p><span class="hint">Progress ${ME.pathProgress} / ${t.goal}. Only you can see this.</span></div>
  <div class="panel"><span class="label">Graduation check (Level 7)</span>${gradChecks()}</div>
</div>`};
function gradChecks(){const tot=total(),low=ME.lowest(),GT=EP.Player.GRAD_TOTAL,GM=EP.Player.GRAD_MIN;
  return `<div class="check"><span class="${tot>=GT?"y":"x"}">${tot>=GT?"✓":"✗"}</span><span>Total points ${tot} (need ${GT}+)</span></div><div class="check"><span class="${low>=GM?"y":"x"}">${low>=GM?"✓":"✗"}</span><span>Lowest attribute ${low} (need ${GM}+)</span></div><div class="check"><span class="${ME.glitches<2?"y":"x"}">${ME.glitches<2?"✓":"✗"}</span><span>Glitches ${ME.glitches} (stuck at 2)</span></div>`}

V[5]=()=>`<div><span class="chip r">System Briefing · Level 1</span><h2 style="margin-top:8px">Boot Up: Team Week</h2></div>
<div class="memo"><span class="label">Interoffice memo</span><p><b>To:</b> ${esc(S.name)}, Team Kestrel</p><p>Your first client, a national medical supply company, has sent a Request for Proposal. Before Sprint 1 starts on Sep 8, your team must show it can take the lead: write a Standard Operating Procedure everyone can follow.</p></div>
<div class="cols"><div class="panel"><span class="label">This trial tests</span><h3>${AN[R().attr]}</h3></div><div class="panel"><span class="label">Cost for every player</span><h3>${R().cost} points</h3></div><div class="panel"><span class="label">Your ${AN[R().attr]}</span><h3>${ME.attrs[R().attr]}${isBonus(R().attr)?' <span class="tag b">bonus</span>':""}</h3><span class="hint">${ME.attrs[R().attr]>=R().cost?"You can cover this.":"You'll need backup hearts to cover this."}</span></div></div>
<div class="cols"><div class="panel"><span class="label">Real phase</span><span>Weeks 1–2: Team Week, teams formed, Medline RFP, SOP challenge</span></div><div class="panel"><span class="label">Workshops</span><span>LW2A Know Your Lens · LW2B Team Agreement · BW2B · W2B</span></div></div>`;

function roomPanel(){const t=T();const lockd=S.of.applied||S.step!==6;const r=S.room;
  if(r==="kitchen")return `<div class="panel"><span class="label">Kitchen · Gifts</span><p>Gift any teammate here during Open Floor, or in the gift window after the trial.</p><p class="hint">Your cost as ${aOrAn(t.n)}: ${S.type==="indep"?"1 point costs 2 hearts, 2 points cost 3. You cannot accept gifts.":"1 heart per point."}</p>${lockd?`<p class="hint">${GIFT_RULE}</p>`:incomingGifts()+giftRoster()}${!lockd&&S.of.msg?`<span class="okmsg">${esc(S.of.msg)}</span>`:""}</div>`;
  if(r==="breakout"){if(S.type!=="contra"||lockd)return `<div class="panel"><span class="label">Breakout Room</span><p>The whiteboard has been wiped, badly. The room feels like someone just left.</p></div>`;
    const cost=EP.Sabotage.cost(ME);
    return `<div class="panel"><span class="label">Breakout Room · Sabotage a teammate (Contrarian only)</span><p class="hint">This one costs ${cost} heart${cost>1?"s":""}. Drains 2 from the target's ${AN[R().attr]} (1 if their Composure is 6+). Each extra sabotage this round costs 2.</p><div class="roster">${MYTEAM.mates(ME).map(p=>{const why=EP.Sabotage.check(ME,p,MYTEAM);return `<div class="person"><span class="who">${avatarSVG(TEAM.find(x=>x.n===p.name).av,{head:true,label:p.name})}${esc(p.name)}</span><span class="row" style="gap:6px">${flag(p.flag())}<button class="btn red sm" data-sab="${esc(p.name)}" ${why?`disabled title="${esc(why)}"`:""}>Sabotage</button></span></div>`}).join("")}</div>${S.of.msg?`<span class="okmsg">${esc(S.of.msg)}</span>`:""}${ME.sabotageLocked?`<span class="hint">You were caught. No more sabotage this game.</span>`:""}</div>`}
  if(r==="hightea")return `<div class="panel"><span class="label">High Tea · Network with a guest</span><p class="hint">Today's guest is a program sponsor who once sat where you're sitting. You pour the tea and introduce yourself.</p><div class="memo"><p>"When I wrote my first SOP, I put in a step that never ended. A good procedure has no step that sends you in circles. If a step never ends, it doesn't belong."</p></div><p class="hint">Guests share stories, not answers. Prep 3:30 · Tea 4:00 · Debrief 5:00.</p></div>`;
  if(r==="wellness")return `<div class="panel"><span class="label">Wellness Room</span><p>Quiet in here. Take a breath before the trial. (No game effect yet.)</p></div>`;
  if(r==="conf")return `<div class="panel"><span class="label">Conference Room · Emergency button</span><p>${S.step===8?"The all-hands meeting is in session.":"The button is locked. It lights up after the trial, when the all-hands meeting is called."}</p></div>`;
  if(r==="reception")return `<div class="panel"><span class="label">Reception · Check in</span><p>The front desk prints your badge again. <b>ATTEMPT 02</b>. You only remember one.</p><span class="okmsg">Anomaly logged: WATCHER.</span></div>`;
  return `<div class="panel"><span class="label">All Skate · Reflect and plan</span><p>The cohort gathers here to look back on the week, look ahead at assignments and plan the day. Your team is ready to plan the trial. ${S.type==="contra"?"Slip into the Breakout Room to sabotage a teammate. ":""}Gift a teammate in the Kitchen now, or in the gift window after the trial. A guest is waiting in High Tea.</p><div class="roster">${TEAM.map(p=>personRow({...p,st:MATE(p.n).flag()})).join("")}</div></div>`;
}
V[6]=()=>`<div class="row" style="justify-content:space-between"><div><span class="chip b">Open Floor</span><h2 style="margin-top:8px">Walk the office</h2></div><span class="hint">${S.of.applied?"Open Floor is over. Press Ready for trial to continue.":"Kitchen = gift a teammate · Breakout Room = sabotage (Contrarians) · High Tea = network with a guest · Ghosts = whispers"}</span></div>
${worldHTML("floor")}`;

V[7]=()=>{const s=S.sop;const hit=G.round.sabotages.filter(x=>x.target===ME).reduce((n,x)=>n+x.drain,0);return `<div><span class="chip r">The Trial · ${AN[R().attr]}</span><h2 style="margin-top:8px">Write the coffee SOP</h2></div>
${hit?`<div class="toast"><b>&gt; ALERT:</b> someone on your team sabotaged you. ${AN[R().attr]} −${hit}. Remember this at the all-hands.</div>`:""}
<p class="hint">Tap the steps in order. Leave out anything that doesn't belong. Tap a placed step to send it back. Your team wins with 5+ correct and nothing extra.</p>
<div class="sop"><div><span class="label">Available steps</span><div class="pile">${s.pile.map((t,i)=>`<button class="scard" data-pile="${i}" ${s.checked?"disabled":""}><span class="num">·</span><span>${esc(t)}</span></button>`).join("")||'<span class="hint">All steps placed.</span>'}</div></div>
<div><span class="label">Team SOP</span><div class="built">${s.built.map((t,i)=>`<button class="scard ${s.checked?(SOP[i]===t?"right":"wrong"):""}" data-built="${i}" ${s.checked?"disabled":""}><span class="num">${i+1}.</span><span>${esc(t)}</span></button>`).join("")||'<span class="hint">Nothing yet.</span>'}</div></div></div>
${s.checked?`<div class="result"><b style="color:${S.win?"var(--ok)":"var(--bad)"}">Team ${S.win?"WIN":"LOSS"}: ${s.score} of 6 correct${!s.built.length?", no steps placed":s.decoyOut?", decoy left out":", decoy included"}${s.inTime?"":", time ran out"}.</b><span class="hint">Every player now pays ${R().cost} ${AN[R().attr]}. Press <b>All-hands</b> for the meeting.</span></div>`
:`<div class="row"><button class="btn green" id="check" ${s.built.length?"":"disabled"}>Submit SOP</button><button class="btn soft" id="reset">Start over</button></div>`}`};

V[8]=()=>{const p=S.pay,g=S.gw,a=S.acc,k=R().attr;return `<div class="meeting">All-hands meeting</div>
<div class="report shake"><span class="h">&gt; GLITCH REPORT: irregularities detected in your environment</span>
<span>&gt; trial: Team Kestrel ${S.win?"WIN":"LOSS"} · cost paid: ${AN[k]} −${R().cost}</span>
<span>&gt; your ${AN[k]}: ${p.before} → ${p.after}${p.backupUsed?` (backup hearts used: ${p.backupUsed})`:""}${p.after<0?` · <b style="color:var(--pink)">GLITCHING</b>`:""}</span>
${CLUES.map(c=>S.found[c.id]?`<div class="clue"><span class="tag s">${c.kind}</span><span><b>${c.where}.</b> ${esc(c.found)}</span></div>`:`<div class="clue"><span class="tag m">???</span><span>${esc(c.hint)}</span></div>`).join("")}
<span>&gt; please continue working normally.</span></div>
${a.done?caughtNotices():""}
${a.done&&ME.sabotagesThisRound?`<div class="toast">${ME.caughtThisRound?`<b>&gt; CAUGHT:</b> a teammate correctly accused you. No more sabotage this game, and Exploit is lost.`:`<b>&gt; CLEAN:</b> nobody caught your sabotage. Exploit progress ${ME.pathProgress}/${T().goal}.`}</div>`:""}
<div class="panel"><span class="label">Accusation · one per player · teammates only</span>
${a.done?`<p>${a.result===true?`<b style="color:var(--ok)">Correct.</b> ${esc(a.target)} sabotaged this round. You get +1 point at Stats Update.${S.type==="indep"?" Auditor complete.":""}`:a.result===false?`<b style="color:var(--bad)">Wrong.</b> ${esc(a.target)} didn't sabotage this round. You lost 1 point from your highest attribute.`:"You skipped your accusation."}</p>`
:`<p><b>Suspect a teammate? Accuse or Skip.</b></p><div class="row"><select id="accSel" style="max-width:240px" aria-label="Accuse a teammate"><option value="">Choose a teammate…</option>${MYTEAM.mates(ME).map(q=>`<option ${a.target===q.name?"selected":""}>${esc(q.name)}</option>`).join("")}</select><button class="btn red sm" id="accuse">Accuse</button><button class="btn soft sm" id="skipAcc">Skip</button></div><span class="hint">Correct: +1 point. Wrong: you lose 1 point from your highest attribute.</span>`}</div>
${a.done?`<div class="panel"><div class="row" style="justify-content:space-between"><span class="label">Gift window</span>${g.closed?flag(status()):`<span class="hearts">${[0,1,2].map(i=>HEART(i<ME.backup)).join("")}</span>`}</div>
  ${incomingGifts()}
  ${!g.closed?giftRoster():""}
  ${g.sent.map(m=>`<span class="okmsg">${esc(m)}</span>`).join("")}
  ${g.closed?`<p>${ME.glitchedThisRound?`<b style="color:var(--pink)">Glitch locked in.</b> Reboot: points taken evenly from your other attributes to bring it back to 1. Backup hearts set to 0. Glitches: ${ME.glitches}/2.`:"Window closed. No glitch for you this round."}</p>`:`<span class="hint">30 seconds in the live game (20 in this demo). Anything still below 0 when it closes becomes a glitch.</span>`}
</div>`:""}`};

/* Gift buttons for every teammate (Open Floor and gift window). Stuck players are spectators. */
const GIFT_RULE="They choose Accept or Decline. Accepted points go to their glitching attribute if they are Glitching, otherwise to their lowest attribute with room. You don't pick the attribute. If they decline, or don't answer before this step ends, your hearts come back.";
function giftRoster(){return `<p class="hint">${GIFT_RULE}</p><div class="roster">${MYTEAM.mates(ME).map(q=>`<div class="person"><span class="who">${avatarSVG(TEAM.find(x=>x.n===q.name).av,{head:true,label:q.name})}${esc(q.name)}</span><span class="row" style="gap:6px">${flag(q.flag())}${!q.isStuck()?[1,2].map(n=>{const c=EP.Gift.cost(ME,n),why=EP.Gift.check(ME,q,MYTEAM,n);return `<button class="btn green sm" data-gift="${esc(q.name)}" data-pts="${n}" ${why?`disabled title="${esc(why)}"`:""}>Gift ${n} (${c} heart${c>1?"s":""})</button>`}).join(""):""}</span></div>`).join("")}</div>`}
const plural=(n,w)=>`${n} ${w}${n===1?"":"s"}`;
function giftMsg(q,pts,g){
  /* An automatic refusal (Independent) reads exactly like a normal decline. Never mention the type. */
  if(g.status==="refused"||g.status==="declined")return `${q.name} declined your gift. Your hearts came back.`;
  if(g.status==="pending")return `Waiting for ${q.name} to answer. If they don't answer before this step ends, your hearts come back.`;
  return `${q.name} accepted your ${plural(pts,"point")} (−${plural(g.cost,"heart")}).${g.cancelled?` ${q.name} is safe.`:""}${g.cancelled&&S.type==="coop"?" Lifeline complete.":""}${g.overflow?` ${plural(g.overflow,"point")} had nowhere to go and came back to you.`:""}`}
function bindGifts(onMsg){$$("[data-gift]").forEach(b=>b.onclick=()=>{const q=MATE(b.dataset.gift),pts=+b.dataset.pts,r=G.gift(ME,q,pts);if(!r.ok)return;EP.Bots.answer(G,r.gift,RNG);onMsg(giftMsg(q,pts,r.gift));keepTimer()})}
/* Gifts sent to you: "Gift from [name]: Accept or Decline." */
function incomingGifts(){return G.round.gifts.map((x,i)=>{if(x.receiver!==ME||x.status==="refused")return "";const who=esc(x.giver.name),n=plural(x.pts,"point");
  if(x.status==="pending")return `<div class="person"><span><b>Gift from ${who}</b>: ${n}. Accept or Decline.</span><span class="row" style="gap:6px"><button class="btn green sm" data-ans="${i}" data-yes="1">Accept</button><button class="btn soft sm" data-ans="${i}" data-yes="0">Decline</button></span></div>`;
  if(x.status==="accepted")return `<span class="okmsg">You accepted ${n} from ${who}.${x.target?` It went to your ${AN[x.target]}.`:""}</span>`;
  if(x.status==="declined")return `<span class="hint">You declined ${who}'s gift. It went back to them.</span>`;
  return `<span class="hint">${who}'s gift expired with no answer. It went back to them.</span>`}).join("")}
function bindIncoming(){$$("[data-ans]").forEach(b=>b.onclick=()=>{const gft=G.round.gifts[+b.dataset.ans];if(!G.answerGift(gft,b.dataset.yes==="1").ok)return;keepTimer()})}
/* All-hands: as soon as accusations resolve, announce any teammate caught sabotaging. (If you were caught, your own notice shows instead.) */
function caughtNotices(){const caught=[...new Set(G.round.accusations.filter(x=>x.correct&&MYTEAM.has(x.target)&&x.target!==ME).map(x=>x.target))];
  return caught.map(q=>`<div class="toast"><b>&gt; CAUGHT:</b> ${esc(q.name)} was caught sabotaging. No more sabotage for them this game.</div>`).join("")}
function placeLeft(){return (ME?ME.earned:0)-Object.values(S.place).reduce((a,b)=>a+b,0)}
V[9]=()=>{const left=placeLeft();const t=T();const got=S.done?S.got:ME.earned;const nx=EP.Round.LEVELS[R().n]||null;
return `<div><span class="chip g">Stats Update</span><h2 style="margin-top:8px">Level ${R().n} complete, ${esc(S.name)}</h2></div>
<div class="result"><b>You earned ${got} point${got===1?"":"s"}.</b><span class="hint">${[...S.earnLines,...(S.cashed?["Cash Out: +1"]:[])].map(esc).join(" · ")}</span></div>
${!S.done&&ME.canCashOut()?`<div class="panel"><span class="label">Cash Out · once per game</span><p>Spend 2 backup hearts for +1 point. Only works with full backup.</p><button class="btn green sm" id="cashOut">Cash Out</button></div>`:""}
${S.done?"":`<div class="row" style="justify-content:space-between"><h3>Place your points</h3><span class="counter" style="color:${left?"var(--gold)":"var(--ok)"}">${left} left</span></div>
<p class="hint">Place them now. The next trial's attribute stays hidden until the next briefing.${nx?` Level ${nx.n} costs ${nx.cost}.`:""}</p>
<div class="buy">${A.map(a=>{const v=ME.attrs[a.k]+(S.place[a.k]||0);return `<div class="brow"><span class="nm">${a.n}${isBonus(a.k)?'<span class="tag b">bonus</span>':""}</span><span class="step"><button class="minus" data-pdec="${a.k}" aria-label="Remove from ${a.n}" ${!(S.place[a.k])?"disabled":""}>−</button><span class="val">${v}</span><button class="plus" data-pinc="${a.k}" aria-label="Add to ${a.n}" ${(!left||v>=maxOf(a.k))?"disabled":""}>+</button></span><span class="fin">max ${maxOf(a.k)}</span></div>`}).join("")}</div>`}
<div class="cols"><div class="panel"><span class="label">Status</span>${flag(status())}<span class="hint">At risk means one of your attributes, even with the backup hearts that could cover it, could not pay a cost of ${EP.Player.AT_RISK_COST}. This ${EP.Player.AT_RISK_COST} is a fixed safety check for every level. It is not the next trial's cost.</span></div>
${R().n===7?`<div class="panel"><span class="label">Graduation check</span>${gradChecks()}</div>`:""}
<div class="panel"><span class="label">Secret path · ${t.path}</span><span>${ME.pathDone?"Complete. This counts as a win.":ME.pathLost?"Exploit path lost (caught).":`Progress ${ME.pathProgress} / ${t.goal}`}</span></div></div>
${S.done?`<div class="locked"><div><span class="label">Next · Level ${nx?nx.n:""}</span><h3>${nx?nx.name:""}</h3><span class="hint">Sep 8–25 · Trial cost ${nx?nx.cost:""} · Attribute revealed at the briefing</span></div><span class="tag m">LOCKED</span></div><div class="row"><button class="btn blue" id="replay">Replay Level 1</button><button class="btn soft" id="restart">Back to sign-in</button></div>`:""}`};

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
  ${S.arr!=="spawn"?`<button class="btn soft sm cineskip" id="skipIntro">Skip intro ▶</button>`:""}
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
  indep:{lead:3,lines:["Signal received, Independent. I'm Projection.","You're strongest at Focus and Grit. You'll carry trials others can't.","Collaboration costs you more. 1 gift point costs 2 hearts, 2 points cost 3. And you can't accept gifts.","Your secret path is Auditor. Make 1 correct accusation yourself. Once per game, with full backup, you can Cash Out 2 hearts for 1 point."],face:"Focus +2 · Grit +2",weak:"Collaboration caps at 4",watch:"Someone on your team may be sabotaging."},
  contra:{lead:1,lines:["So. You don't trust the system either. Good. I'm SYS-ADMIN 02.","From the Breakout Room you can sabotage a teammate. The first one each round costs 1 heart and drains 2 points.","At every all-hands, each teammate can accuse one person. Get caught and you can't sabotage again, and Exploit is lost.","Your secret path is Exploit: 3 sabotage rounds nobody catches. Each uncaught round also pays +1 point, up to 2. Stay calm. Your Composure caps at 4."],face:"Initiative +2 · Grit +2",weak:"Composure caps at 4",watch:"Don't be the one who's always near the Breakout Room."}};
function vnBox(who,role,portrait,line,i,n,extra=""){return `<div class="vn"><div class="vnp">${portrait}</div><div class="vnt"><div class="vnh"><b>${who}</b><span class="chip b">${role}</span></div><p class="vnl">${esc(line)}</p>${extra}<div class="vnf"><span class="dots">${Array.from({length:n},(_,j)=>`<i class="${j<=i?"on":""}"></i>`).join("")}</span><span class="label">Press Continue</span></div></div></div>`}
function roleBrief(){const rb=ROLE_BRIEF[S.type],d=DIALOGS[rb.lead],t=T();
  const dossier=`<div class="dossier"><span><b>Strengths</b>${rb.face}</span><span><b>Weakness</b>${rb.weak}</span><span><b>Gifts</b>${S.type==="indep"?"1 point = 2 hearts, 2 = 3":"1 heart per point"}</span><span><b>Secret path</b>${t.path}</span><span class="w"><b>Watch for</b>${rb.watch}</span></div>`;
  return vnBox(d.who,t.n+" briefing",`<div class="vnportrait">${d.draw("talk")}</div>`,rb.lines[S.arrLine],S.arrLine,rb.lines.length,S.arrLine===rb.lines.length-1?dossier:"")}
/* Skip intro: skips the elevator animation, all dialogue and the spawn, straight to the floor. */
function skipArrival(){elevTimers.forEach(clearTimeout);elevTimers=[];S.doorsDone=true;S.arr="spawn";S.arrived=true;render()}
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

/* ================= THE WALKABLE FLOOR (real room names; layout is a placeholder until the blueprint) ================= */
const WW=2300,WH=1420,PR=16;
const ELEV={id:"elevator",n:"Elevator",x:30,y:620,w:160,h:180};
const HALL={x:470,y:650,w:1680,h:120};
const SIDE={x:1840,y:740,w:100,h:580};
const WROOMS=[
 {id:"reception",n:"Reception",pts:[[170,560],[470,560],[520,610],[520,860],[170,860]],fill:"#d7d2c8",lab:[330,600],spots:[[300,760],[420,700]],open:true},
 {id:"kitchen",n:"Kitchen",pts:[[540,300],[760,300],[760,200],[920,200],[920,600],[540,600]],fill:"url(#wtile)",lab:[730,575],doors:[{x:660,y:560,w:160,h:130,side:"n"}],spots:[[640,450],[840,300]]},
 {id:"allskate",n:"All Skate",pts:[[1040,120],[1440,120],[1540,220],[1540,600],[960,600],[960,200]],fill:"url(#wcarpet)",lab:[1250,575],doors:[{x:1160,y:560,w:180,h:130,side:"n"},{x:1528,y:410,w:84,h:130,side:"e"}],spots:[[1060,260],[1460,300],[1250,220]]},
 {id:"hightea",n:"High Tea",pts:[[1600,280],[1900,280],[1980,360],[1980,600],[1600,600]],fill:"url(#wwood)",lab:[1790,575],doors:[{x:1700,y:560,w:160,h:130,side:"n"}],spots:[[1680,380],[1900,460]]},
 {id:"wellness",n:"Wellness Room",pts:[[540,820],[880,820],[880,1120],[620,1120],[540,1040]],fill:"#9cc7a6",lab:[720,860],doors:[{x:630,y:730,w:160,h:130,side:"s"}],spots:[[640,980],[800,1060]]},
 {id:"conf",n:"Conference Room",pts:[[930,820],[1460,820],[1460,1150],[1410,1200],[980,1200],[930,1150]],fill:"#55729e",lab:[1195,860],doors:[{x:1115,y:730,w:160,h:130,side:"s"}],spots:[[980,1120],[1400,900]]},
 {id:"breakout",n:"Breakout Room",pts:[[1510,820],[1790,820],[1750,1080],[1510,1080]],fill:"url(#wgrid)",lab:[1640,860],doors:[{x:1550,y:730,w:160,h:130,side:"s"}],spots:[[1560,1020],[1700,960]]}];
const LOCKS=[{lvl:3,x:1840,y:1300,w:100,dir:"h",label:"ACCESS · LVL 3"},{lvl:4,x:2130,y:650,h:120,dir:"v",label:"LVL 4"}];
const RNAME=Object.fromEntries([...WROOMS.map(r=>[r.id,r.n]),["hall","Hallway"],["elevator","Elevator"],["side","East Corridor"]]);
function inPoly(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [xi,yi]=p[i],[xj,yj]=p[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c}return c}
const inRect=(x,y,r)=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h;
function walkable(x,y){if(inRect(x,y,ELEV)||inRect(x,y,HALL)||inRect(x,y,SIDE))return true;for(const r of WROOMS){if(inPoly(x,y,r.pts))return true;if((r.doors||[]).some(d=>inRect(x,y,d)))return true}return false}
/* Furniture the character cannot walk through: [x,y,w,h], matching the drawings in wFurniture().
   Wall-mounted items (screens, whiteboard, welcome sign) are not listed. */
const BLOCKS=[
  /* reception: curved desk, chairs, plant */ [220,690,70,42],[290,668,80,64],[370,690,70,42],[200,800,112,34],[460,800,40,40],
  /* kitchen: L counter, sink, stove top, fridge, table, stools, vending */ [560,320,180,20],[560,320,20,260],[620,330,40,22],[780,215,120,34],[860,260,48,90],[680,420,150,70],[689,499,142,22],[860,420,44,100],
  /* all skate: desks with chairs, beanbags */ ...[[1040,230],[1200,230],[1360,230],[1040,330],[1360,330],[1040,470],[1360,470]].map(([x,y])=>[x,y,120,66]),[1170,388,60,44],[1270,388,60,44],
  /* high tea: tables, chairs, bookshelf, tea counter */ [1648,358,84,84],[1838,388,84,84],[1610,384,36,32],[1734,384,36,32],[1672,322,36,32],[1800,414,36,32],[1924,414,36,32],[1862,352,36,32],[1620,296,140,26],[1800,300,150,44],
  /* wellness: couches, ottoman, plants */ [580,880,56,130],[656,880,56,130],[754,966,92,68],[826,836,48,48],[576,1056,48,48],
  /* conference: table and chair rows */ [1000,930,390,160],[1022,896,316,26],[1022,1098,316,26],
  /* breakout: round table, sofa */ [1586,916,88,88],[1530,1020,140,40]];
const blocked=(x,y)=>BLOCKS.some(([bx,by,bw,bh])=>x>bx&&x<bx+bw&&y>by&&y<by+bh);
function canStand(x,y){return [[0,0],[PR,0],[-PR,0],[0,PR],[0,-PR]].every(([dx,dy])=>walkable(x+dx,y+dy)&&!blocked(x+dx,y+dy))}
function roomAt(x,y){for(const r of WROOMS)if(inPoly(x,y,r.pts))return r.id;if(inRect(x,y,ELEV))return "elevator";if(inRect(x,y,SIDE)&&y>780)return "side";return "hall"}
const P=pts=>pts.map(p=>p.join(",")).join(" ");
function wFurniture(){const E="#0b0e13",st=`stroke="${E}" stroke-width="5" stroke-linejoin="round"`,st3=`stroke="${E}" stroke-width="3.5"`;let f="";
  /* reception */
  f+=`<path d="M220 700 Q330 640 440 700 L440 730 Q330 680 220 730Z" fill="#8a5a33" ${st}/><rect x="250" y="708" width="160" height="22" rx="4" fill="#13294b" ${st}/><text x="330" y="724" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="14" fill="#f2b84b" letter-spacing="2">WELCOME · CYCLE 60</text>
  ${[200,240,280].map(x=>`<rect x="${x}" y="800" width="32" height="34" rx="8" fill="#3a74ff" ${st3}/>`).join("")}<circle cx="480" cy="820" r="20" fill="#1f8a3b" ${st}/><circle cx="480" cy="820" r="8" fill="#5fe04a"/>`;
  /* kitchen */
  f+=`<path d="M560 320 H740 V340 H580 V580 H560Z" fill="#d9dee5" ${st}/><rect x="780" y="215" width="120" height="34" rx="4" fill="#d9dee5" ${st}/><rect x="796" y="220" width="34" height="24" rx="4" fill="#3e4650" ${st3}/><circle cx="813" cy="232" r="5" fill="#e0394d"/>
  <rect x="860" y="260" width="48" height="90" rx="6" fill="#f2f5f8" ${st}/><rect x="620" y="330" width="40" height="22" rx="4" fill="#9fb3c8" ${st3}/>
  <rect x="680" y="420" width="150" height="70" rx="12" fill="#a8743f" ${st}/>${[700,740,780,820].map(x=>`<circle cx="${x}" cy="510" r="11" fill="#e0394d" ${st3}/>`).join("")}<rect x="860" y="420" width="44" height="100" rx="6" fill="#2f5fe0" ${st}/><rect x="866" y="428" width="32" height="56" fill="#13202b"/>`;
  /* all skate: rows facing a big screen, center rug */
  f+=`<rect x="1080" y="134" width="320" height="18" rx="4" fill="#13294b" ${st}/><rect x="1090" y="138" width="300" height="10" fill="#6aa8ff" opacity=".6"/>
  <ellipse cx="1250" cy="400" rx="190" ry="110" fill="#e0394d" opacity=".25" ${st3}/>`+[[1040,230],[1200,230],[1360,230],[1040,330],[1360,330],[1040,470],[1360,470]].map(([x,y])=>`<rect x="${x}" y="${y}" width="120" height="44" rx="8" fill="#e6ecf2" ${st}/>${[0,1,2].map(i=>`<rect x="${x+12+i*36}" y="${y+50}" width="24" height="16" rx="5" fill="#3a74ff" ${st3}/>`).join("")}`).join("")+
  `<ellipse cx="1200" cy="410" rx="30" ry="22" fill="#f2b84b" ${st}/><ellipse cx="1300" cy="410" rx="30" ry="22" fill="#4fe08a" ${st}/>`;
  /* high tea */
  f+=[[1690,400],[1880,430]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="42" fill="#f2f5f8" ${st}/><circle cx="${x-12}" cy="${y-8}" r="7" fill="#fff" ${st3}/><circle cx="${x+14}" cy="${y+6}" r="7" fill="#fff" ${st3}/><path d="M${x-6} ${y+14} h14 l-2 10 h-10z" fill="#f2b84b" ${st3}/>${[[-62,0],[62,0],[0,-62]].map(([dx,dy])=>`<rect x="${x+dx-18}" y="${y+dy-16}" width="36" height="32" rx="12" fill="#a8172f" ${st3}/>`).join("")}`).join("")+
  `<rect x="1620" y="296" width="140" height="26" rx="4" fill="#7a4d2a" ${st}/><rect x="1800" y="300" width="150" height="44" rx="8" fill="#f2f5f8" ${st}/><path d="M1830 322 q0 -14 14 -14 q14 0 14 14 v6 h-28z" fill="#a8d8ff" stroke="#0b0e13" stroke-width="3"/><path d="M1858 316 l12 -6" stroke="#0b0e13" stroke-width="3"/>${[1885,1905,1925].map(x=>`<circle cx="${x}" cy="322" r="7" fill="#fff" stroke="#0b0e13" stroke-width="3"/>`).join("")}<text x="1875" y="296" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="13" fill="#3a2410">TEA · 4:00</text>`+[0,1,2,3,4,5,6].map(i=>`<rect x="${1628+i*18}" y="300" width="12" height="18" fill="${["#d8323f","#2f5fe0","#f2b84b","#1f8a3b","#ec5fc0","#38c6d6","#f2852a"][i]}"/>`).join("");
  /* wellness */
  f+=`<rect x="580" y="880" width="56" height="130" rx="12" fill="#ec5fc0" ${st}/><rect x="656" y="880" width="56" height="130" rx="12" fill="#38c6d6" ${st}/><ellipse cx="800" cy="1000" rx="46" ry="34" fill="#d8323f" ${st}/><circle cx="840" cy="880" r="40" fill="#fff5cc" opacity=".35"/>`+[[850,860],[600,1080]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="24" fill="#1f8a3b" ${st}/><circle cx="${x}" cy="${y}" r="10" fill="#5fe04a"/>`).join("");
  /* conference + emergency button */
  f+=`<rect x="1060" y="1176" width="270" height="16" rx="4" fill="#13294b" ${st}/><rect x="1000" y="930" width="390" height="160" rx="70" fill="#a8743f" ${st}/>`+[1040,1110,1180,1250,1320].map(x=>`<rect x="${x-18}" y="896" width="36" height="26" rx="8" fill="#3e4650" ${st3}/><rect x="${x-18}" y="1098" width="36" height="26" rx="8" fill="#3e4650" ${st3}/>`).join("")+
  `<g transform="translate(1195 1010)"><rect x="-34" y="-34" width="68" height="68" rx="8" fill="#f2b84b" ${st}/><path d="M-34 -14 L-14 -34 M-34 6 L6 -34 M-34 26 L26 -34 M-14 34 L34 -14 M6 34 L34 6" stroke="${E}" stroke-width="5"/><circle r="22" fill="#e0394d" stroke="${E}" stroke-width="5"/><circle r="10" fill="#ff7a88"/></g><text x="1195" y="1068" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="16" fill="#fff" letter-spacing="2">EMERGENCY</text>`;
  /* breakout */
  f+=`<rect x="1530" y="836" width="200" height="16" rx="4" fill="#f2f5f8" ${st}/><path d="M1550 842 q20 -6 40 0 t40 0" stroke="#3a74ff" stroke-width="3" fill="none"/><circle cx="1630" cy="960" r="44" fill="#e6ecf2" ${st}/><rect x="1530" y="1020" width="140" height="40" rx="12" fill="#7b3fd4" ${st}/>`;
  /* hallway details: ceiling lights, art, fountain */
  f+=[600,900,1200,1500,1800,2050].map(x=>`<rect x="${x-60}" y="${HALL.y+8}" width="120" height="8" rx="4" fill="#fffef5"/>`).join("")+[[980,656],[1560,656]].map(([x,y])=>`<rect x="${x}" y="${y-6}" width="60" height="10" fill="#13294b" stroke="${E}" stroke-width="2"/>`).join("")+
  `<rect x="1866" y="1180" width="48" height="10" rx="4" fill="#fffef5"/><rect x="1866" y="900" width="48" height="10" rx="4" fill="#fffef5"/>`;
  return f}
/* Doorways: open floor cut through the wall, thick frame posts, and a gold threshold strip at each end. */
function doorSVG(d){const E="#0b0e13",G="#f2b84b";
  if(d.side==="e")return `<rect x="${d.x+2}" y="${d.y}" width="${d.w-4}" height="${d.h}" fill="#eef1f3"/><path d="M${d.x+6} ${d.y} H${d.x+d.w-6} M${d.x+6} ${d.y+d.h} H${d.x+d.w-6}" stroke="${E}" stroke-width="8"/><rect x="${d.x+8}" y="${d.y+4}" width="6" height="${d.h-8}" fill="${G}"/><rect x="${d.x+d.w-14}" y="${d.y+4}" width="6" height="${d.h-8}" fill="${G}"/>`;
  const y=d.side==="n"?594:764;
  return `<rect x="${d.x}" y="${y}" width="${d.w}" height="62" fill="#eef1f3"/><path d="M${d.x} ${y+6} V${y+56} M${d.x+d.w} ${y+6} V${y+56}" stroke="${E}" stroke-width="8"/><rect x="${d.x+4}" y="${y+2}" width="${d.w-8}" height="6" fill="${G}"/><rect x="${d.x+4}" y="${y+54}" width="${d.w-8}" height="6" fill="${G}"/>`}
function worldSVG(){const E="#0b0e13";
  return `<svg id="wsvg" width="${WW}" height="${WH}" viewBox="0 0 ${WW} ${WH}" role="img" aria-label="Floor 60">
  <defs><pattern id="wcarpet" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#5b6b8a"/><path d="M0 20 H40 M20 0 V40" stroke="#52617e" stroke-width="2"/></pattern>
  <pattern id="wwood" width="60" height="24" patternUnits="userSpaceOnUse"><rect width="60" height="24" fill="#c9a77a"/><path d="M0 23 H60 M30 0 V24" stroke="#a9875a" stroke-width="2"/></pattern>
  <pattern id="wtile" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#e9e4da"/><rect width="20" height="20" fill="#dcd5c8"/><rect x="20" y="20" width="20" height="20" fill="#dcd5c8"/></pattern>
  <pattern id="wgrid" width="34" height="34" patternUnits="userSpaceOnUse"><rect width="34" height="34" fill="#8e8aa6"/><path d="M0 33 H34 M33 0 V34" stroke="#7d7994" stroke-width="2"/></pattern>
  <pattern id="whall" width="80" height="120" patternUnits="userSpaceOnUse"><rect width="80" height="120" fill="#eef1f3"/><path d="M79 0 V120" stroke="#dde2e6" stroke-width="2"/></pattern>
  <pattern id="whallv" width="120" height="80" patternUnits="userSpaceOnUse"><rect width="120" height="80" fill="#eef1f3"/><path d="M0 79 H120" stroke="#dde2e6" stroke-width="2"/></pattern></defs>
  <rect width="${WW}" height="${WH}" fill="#151a22"/>
  <path d="M10 560 H160 V520 H530 V160 H960 V80 H1560 V240 H2020 V610 H2190 V810 H1980 V1360 H1800 V1240 H1500 V1250 H900 V1160 H500 V860 H190 V840 H10Z" fill="#3a4048" stroke="${E}" stroke-width="10" stroke-linejoin="round"/>
  <rect x="${HALL.x}" y="${HALL.y}" width="${HALL.w}" height="${HALL.h}" fill="url(#whall)"/><rect x="${SIDE.x}" y="${SIDE.y}" width="${SIDE.w}" height="${SIDE.h}" fill="url(#whallv)"/>
  <rect x="${ELEV.x}" y="${ELEV.y}" width="${ELEV.w}" height="${ELEV.h}" fill="#dfe4e8" stroke="${E}" stroke-width="10"/><path d="M40 640 V780 M180 640 V780" stroke="#a9b2bf" stroke-width="6"/><rect x="60" y="600" width="100" height="18" rx="4" fill="#0b0e13"/><text x="110" y="614" text-anchor="middle" font-family="Pixelify Sans,monospace" font-weight="700" font-size="14" fill="#e0394d">▲ 60</text>
  ${WROOMS.map(r=>`<polygon points="${P(r.pts)}" fill="${r.fill}" stroke="${E}" stroke-width="12" stroke-linejoin="round"/>`).join("")}
  ${WROOMS.flatMap(r=>r.doors||[]).map(doorSVG).join("")}
  <rect x="466" y="656" width="60" height="108" fill="#eef1f3"/>
  ${LOCKS.map(l=>l.dir==="h"?`<rect x="${l.x}" y="${l.y}" width="${l.w}" height="22" fill="#3e4650" stroke="${E}" stroke-width="5"/><rect x="${l.x+l.w/2-6}" y="${l.y+4}" width="12" height="12" rx="3" fill="#e0394d"/><text x="${l.x+l.w/2}" y="${l.y-14}" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="18" fill="#e0394d">${l.label}</text>`:`<rect x="${l.x}" y="${l.y}" width="22" height="${l.h}" fill="#3e4650" stroke="${E}" stroke-width="5"/><rect x="${l.x+5}" y="${l.y+l.h/2-6}" width="12" height="12" rx="3" fill="#e0394d"/><text x="${l.x-12}" y="${l.y+l.h/2+6}" text-anchor="end" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="18" fill="#e0394d">${l.label}</text>`).join("")}
  <g>${wFurniture()}</g>
  ${WROOMS.map(r=>`<text x="${r.lab[0]}" y="${r.lab[1]}" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="28" letter-spacing="3" fill="rgba(11,14,19,.45)">${r.n.toUpperCase()}</text>`).join("")}
  <text x="1300" y="722" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="24" letter-spacing="12" fill="rgba(11,14,19,.16)">FLOOR 60</text>
  <g id="wnpcs">${TEAM.map((p,i)=>{const [x,y]=[[1150,410],[1350,410],[1250,520]][i];return `<g transform="translate(${x} ${y})">${avatarSVG(p.av,{label:p.n,extra:' x="-30" y="-100" width="60" height="101"'})}<text y="22" text-anchor="middle" font-family="Pixelify Sans,monospace" font-weight="700" font-size="16" fill="#fff" stroke="#0b0e13" stroke-width="4" paint-order="stroke">${p.n}</text></g>`}).join("")}
   <g transform="translate(1790 520)">${avatarSVG({body:1,skin:4,hair:8,hairC:6,top:7,topS:1,bot:0,botS:1,hat:0,extra:1,acc:2},{label:"Guest",extra:' x="-30" y="-100" width="60" height="101"'})}<text y="22" text-anchor="middle" font-family="Pixelify Sans,monospace" font-weight="700" font-size="15" fill="#f2b84b" stroke="#0b0e13" stroke-width="4" paint-order="stroke">Guest · Sponsor</text></g>
   <g transform="translate(1690 745)">${avatarSVG(PRESETS_ROOK,{label:"Rook",extra:' x="-30" y="-100" width="60" height="101"'})}<text y="22" text-anchor="middle" font-family="Pixelify Sans,monospace" font-weight="700" font-size="16" fill="#cbd3dc" stroke="#0b0e13" stroke-width="4" paint-order="stroke">Rook · Wren</text></g></g>
  <g id="wghosts">${GHOSTS.map((g,i)=>`<g class="wg" data-g="${i}" opacity="0" transform="translate(0 0)">${avatarSVG(g.a,{label:g.n,holo:true,ghost:true,holoC:"#e9ecff",extra:' x="-30" y="-100" width="60" height="101"'})}<text y="22" text-anchor="middle" font-family="Pixelify Sans,monospace" font-weight="700" font-size="15" fill="#e9ecff" stroke="#0b0e13" stroke-width="4" paint-order="stroke">${g.n}</text></g>`).join("")}</g>
  <g id="wme" transform="translate(${S.pos.x} ${S.pos.y})"><ellipse cx="0" cy="2" rx="26" ry="8" fill="rgba(0,0,0,.35)"/><g id="wmeinner">${avatarSVG(S.av,{label:S.name,holo:status()==="Glitching",extra:' x="-30" y="-100" width="60" height="101"'})}</g><text y="24" text-anchor="middle" font-family="Pixelify Sans,monospace" font-weight="700" font-size="17" fill="#f2b84b" stroke="#0b0e13" stroke-width="4" paint-order="stroke">${esc(S.name)}</text></g>
  </svg>`}
const PRESETS_ROOK={body:0,skin:9,hair:3,hairC:0,top:7,topS:1,bot:0,botS:0,hat:0,extra:1,acc:2};
function minimapSVG(full){const vis=k=>full||S.visited[k];
  return `<svg viewBox="0 0 ${WW} ${WH}" role="img" aria-label="Minimap"><rect width="${WW}" height="${WH}" rx="40" fill="#0b0e13"/>
  <rect x="${HALL.x}" y="${HALL.y}" width="${HALL.w}" height="${HALL.h}" fill="${vis("hall")?"#cfd6de":"#1d232e"}"/><rect x="${SIDE.x}" y="${SIDE.y}" width="${SIDE.w}" height="${SIDE.h}" fill="${vis("side")?"#cfd6de":"#1d232e"}"/><rect x="${ELEV.x}" y="${ELEV.y}" width="${ELEV.w}" height="${ELEV.h}" fill="#5b6577"/>
  ${WROOMS.map(r=>{const v=vis(r.id),cx=r.pts.reduce((a,p)=>a+p[0],0)/r.pts.length,cy=r.pts.reduce((a,p)=>a+p[1],0)/r.pts.length;return `<polygon points="${P(r.pts)}" fill="${v?"#a8d8ff":"#1d232e"}" stroke="#4a5568" stroke-width="14"/><text x="${cx}" y="${cy+28}" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="${v?70:110}" fill="${v?"#13294b":"#4a5568"}">${v?r.n.split(" ")[0].toUpperCase():"?"}</text>`}).join("")}
  ${LOCKS.map(l=>l.dir==="h"?`<rect x="${l.x}" y="${l.y-10}" width="${l.w}" height="40" fill="#e0394d"/>`:`<rect x="${l.x-10}" y="${l.y}" width="40" height="${l.h}" fill="#e0394d"/>`).join("")}
  ${full?"":`${S.visited.allskate?[[1150,410],[1350,410],[1250,520]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="26" fill="#3a74ff" stroke="#fff" stroke-width="6"/>`).join(""):""}<circle id="mmme" cx="${S.pos.x}" cy="${S.pos.y}" r="40" fill="#e0394d" stroke="#fff" stroke-width="10"/>`}</svg>`}
/* Minimap: M, a click or a tap hides or shows it. When hidden it shrinks to a small MAP tab. */
function mmapInner(){return S.mmHidden?`<span class="mmt">MAP ▸</span>`:`<span class="mmt">FLOOR 60 · hide</span>${minimapSVG(false)}`}
function toggleMinimap(){S.mmHidden=!S.mmHidden;const el=$("#mmap");if(!el)return;el.classList.toggle("min",S.mmHidden);el.innerHTML=mmapInner()}
function worldHTML(mode){return `<div class="world" id="world" data-mode="${mode}">
  <div class="wview" id="wview">${worldSVG()}</div>
  <div class="wroom" id="wroom">${esc(RNAME[S.wroom||"elevator"])}</div>
  <div class="minimap${S.mmHidden?" min":""}" id="mmap" role="button" tabindex="0" title="Show or hide the map (M)">${mmapInner()}</div>
  <div class="joy" id="joy" aria-label="Move: drag inside the circle, or use arrow keys / WASD"><div class="knob" id="knob"></div></div>
  <button class="usebtn" id="usebtn" disabled>USE</button>
  ${S.panel?`<div class="wpanel"><button class="xclose" id="closeP" aria-label="Close">✕</button>${S.panel==="ghost"?ghostPanel():roomPanel()}</div>`:""}
  <div class="wact" id="wact" hidden></div>
  <div class="whelp"><span class="kb">Move: arrow keys / WASD · Act: E · Map: M</span><span class="tc">Move: joystick · Act: USE</span></div>
  </div>`}
function ghostPanel(){const g=GHOSTS[S.nearGhost||0];return `<div class="panel" style="border-color:#e9ecff"><span class="label" style="color:#e9ecff">${g.n} · wandering ghost</span><p style="font-family:var(--px);color:#e9ecff">“${esc(g.line)}”</p><span class="hint">It flickers and is gone.</span></div>`}
let W={raf:0,vx:0,vy:0,keys:{},tapT:{},last:0,ghostT:0,ghostPos:[]};
const TAP_MS=110;   // one quick tap moves about 33px (300 px/s)
function stopWorld(){cancelAnimationFrame(W.raf);W.raf=0}
function initWorld(){
  stopWorld();const view=$("#wview"),svg=$("#wsvg"),me=$("#wme"),inner=$("#wmeinner"),joy=$("#joy"),knob=$("#knob"),use=$("#usebtn"),wact=$("#wact");if(!view)return;
  if(!W.ghostPos.length)W.ghostPos=GHOSTS.map(()=>({x:0,y:0,on:false}));
  const ghosts=$$(".wg");ghosts.forEach((g,i)=>{const p=W.ghostPos[i];g.setAttribute("transform",`translate(${p.x} ${p.y})`);g.setAttribute("opacity",p.on?".7":"0")});
  let dragging=false;
  const setKnob=(dx,dy)=>{knob.style.transform=`translate(${dx}px,${dy}px)`};
  joy.onpointerdown=e=>{dragging=true;joy.setPointerCapture(e.pointerId);move(e)};
  const move=e=>{if(!dragging)return;const r=joy.getBoundingClientRect();let dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);const m=Math.hypot(dx,dy),max=r.width/2-18;if(m>max){dx=dx/m*max;dy=dy/m*max}setKnob(dx,dy);W.vx=dx/max;W.vy=dy/max};
  joy.onpointermove=move;joy.onpointerup=joy.onpointercancel=()=>{dragging=false;W.vx=0;W.vy=0;setKnob(0,0)};
  use.onclick=doUse;$("#mmap").onclick=toggleMinimap;
  let bob=0,face=1;
  const frame=t=>{W.raf=requestAnimationFrame(frame);const dt=Math.min(.05,(t-(W.last||t))/1000);W.last=t;
    /* A key counts as held while down, and for at least TAP_MS after a quick tap, so one tap moves one step. */
    const held=n=>W.keys[n]||t-(W.tapT[n]??-1e9)<TAP_MS;
    let vx=W.vx,vy=W.vy;if(held("ArrowLeft")||held("a"))vx=-1;if(held("ArrowRight")||held("d"))vx=1;if(held("ArrowUp")||held("w"))vy=-1;if(held("ArrowDown")||held("s"))vy=1;
    const m=Math.hypot(vx,vy);if(m>1){vx/=m;vy/=m}const sp=300;
    if(m>.05){const nx=S.pos.x+vx*sp*dt,ny=S.pos.y+vy*sp*dt;const stuck=!canStand(S.pos.x,S.pos.y);   // if ever inside furniture, let the player walk out
      if(stuck||canStand(nx,S.pos.y))S.pos.x=nx;if(stuck||canStand(S.pos.x,ny))S.pos.y=ny;bob+=dt*14;if(Math.abs(vx)>.2)face=vx<0?-1:1}else bob=0;
    me.setAttribute("transform",`translate(${S.pos.x.toFixed(1)} ${S.pos.y.toFixed(1)})`);
    inner.setAttribute("transform",`translate(0 ${(-Math.abs(Math.sin(bob))*5).toFixed(1)}) scale(${face} 1)`);
    const vw=view.clientWidth,vh=view.clientHeight,sc=vw<640?.62:.9;
    const cx=Math.max(0,Math.min(WW*sc-vw,S.pos.x*sc-vw/2)),cy=Math.max(0,Math.min(WH*sc-vh,S.pos.y*sc-vh/2));
    svg.style.transform=`translate(${-cx}px,${-cy}px) scale(${sc})`;
    const mm=$("#mmme");if(mm){mm.setAttribute("cx",S.pos.x);mm.setAttribute("cy",S.pos.y)}
    const rid=roomAt(S.pos.x,S.pos.y);if(rid!==S.wroom){S.wroom=rid;S.visited[rid]=true;if(WROOMS.find(r=>r.id===rid))S.room=rid;const lab=$("#wroom");lab.textContent=RNAME[rid];lab.classList.remove("pop");void lab.offsetWidth;lab.classList.add("pop");$("#mmap").innerHTML=mmapInner()}
    /* ghosts */
    if(t-W.ghostT>2800){W.ghostT=t;W.ghostPos.forEach((p,i)=>{if(Math.random()<.5){p.on=!p.on;if(p.on){const r=WROOMS[Math.floor(Math.random()*WROOMS.length)],sp=r.spots[Math.floor(Math.random()*r.spots.length)];p.x=sp[0];p.y=sp[1]}ghosts[i].setAttribute("opacity",p.on?".7":"0");ghosts[i].setAttribute("transform",`translate(${p.x} ${p.y})`)}})}
    let near=-1;W.ghostPos.forEach((p,i)=>{if(p.on&&Math.hypot(p.x-S.pos.x,p.y-S.pos.y)<120)near=i});S.nearGhost=near>=0?near:S.nearGhost;W.near=near;
    /* Popups close when the player walks away: a room popup when leaving the room, others after moving ~140px. */
    if(S.panel&&S.panelAt){const at=S.panelAt,away=S.panel==="room"?S.wroom!==at.room:Math.hypot(S.pos.x-at.x,S.pos.y-at.y)>140;if(away){S.panel=false;S.panelAt=null;const el=$(".wpanel");if(el)el.remove()}}
    const act=useAction();use.textContent=act.label;use.disabled=!act.ok;use.className="usebtn "+(act.cls||"");
    const hint=act.ok?"Press E: "+act.label:"";if(wact&&wact.dataset.t!==hint){wact.dataset.t=hint;wact.textContent=hint;wact.hidden=!hint}
  };
  W.raf=requestAnimationFrame(frame);
}
function useAction(){const mode=S.step===6&&!S.of.applied?"floor":"lobby";
  if(W.near>=0)return{label:"Listen",ok:true,cls:"ghost",act:"ghost"};
  const r=S.wroom;
  if(r==="kitchen")return{label:"Look",ok:true,act:"room"};
  if(r==="breakout")return mode==="floor"&&S.type==="contra"&&!ME.sabotageLocked?{label:"Sabotage",ok:true,cls:"red",act:"room"}:{label:"Inspect",ok:true,act:"room"};
  if(r==="hightea")return{label:"Network",ok:true,cls:"green",act:"room"};
  if(r==="allskate")return{label:"Reflect",ok:true,act:"room"};
  if(r==="conf")return{label:"Button",ok:true,cls:"red",act:"room"};
  if(r==="reception")return{label:"Check in",ok:true,act:"room"};
  if(r==="wellness")return{label:"Breathe",ok:true,act:"room"};
  return{label:"USE",ok:false};
}
function doUse(){const a=useAction();if(!a.ok)return;if(a.act==="room"&&S.wroom==="reception")S.found.id=1;S.panel=a.act==="ghost"?"ghost":"room";S.panelAt={room:S.wroom,x:S.pos.x,y:S.pos.y};render()}
addEventListener("keydown",e=>{if(!$("#world")||e.target.tagName==="INPUT")return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","w","a","s","d"].includes(k)){if(!e.repeat&&!W.keys[k])W.tapT[k]=performance.now();W.keys[k]=true;e.preventDefault()}if(k==="e"){if(S.panel){S.panel=false;if(!useAction().ok){render();return}}doUse()}/* E with a popup open: close it, open the new interaction */if(k==="m"&&!e.repeat)toggleMinimap()});
/* Escape closes any open popup, same as its X: room and ghost panels, and the whisper box. Works wherever focus is. */
addEventListener("keydown",e=>{if(e.key!=="Escape"&&e.key!=="Esc")return;const w=$("#whisper");if(!w.hidden)w.hidden=true;if(S.panel){S.panel=false;render()}});
addEventListener("keyup",e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;W.keys[k]=false});

/* ---------- render + bind ---------- */
function render(){
  if(S.step===7&&!S.sop.pile.length&&!S.sop.built.length)S.sop.pile=shuffle([...SOP,DECOY]);
  stopWorld();chrome();$("#stage").innerHTML=V[S.step]();bind();
  document.body.classList.toggle("mapscreen",!!$("#world"));
  if($("#world")){fitWorld();initWorld()}else W.fitFor=null;
  if(S.step===4&&!S.arrived&&S.arr==="elev")runElevator();
  if(S.step===4&&!S.arrived&&S.arr==="admin"&&!S.doorsDone)setTimeout(()=>{S.doorsDone=true},1600);
}
const on=(sel,fn)=>{const e=$(sel);if(e)e.onclick=fn};
function bind(){
  if(S.step===0){
    on("#theL",()=>{S.found.L=1;render()});
    $("#signForm").onsubmit=e=>{e.preventDefault();const em=$("#em").value.trim(),jc=$("#jc").value.trim().toUpperCase();S.email=em;S.code=jc;
      if(!/^[^@\s]+@icstars\.org$/i.test(em)){$("#signErr").textContent="Use your i.c.stars email (ends in @icstars.org). This game is for the i.c.stars community only.";return}
      if(jc!=="CYCLE60"){$("#signErr").textContent="That join code doesn't match an open game. Check with your host.";return}
      S.name=savedName(em)||S.name;go(1)};
  }
  if(S.step===1){
    on("#play",()=>go(2));on("#wardrobe",()=>go(2));
    on("#howTo",()=>{S.menu="howto";render()});
    $$("[data-dnext]").forEach(b=>b.onclick=()=>{const i=+b.dataset.dnext;DPOS[i]=(DPOS[i]+1)%DIALOGS[i].lines.length;render()});
    $$("[data-menu]").forEach(b=>b.onclick=()=>{S.menu=b.dataset.menu;render()});
    on("#idline",()=>{S.found.id=1;render()});
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
    $$("[data-type]").forEach(b=>b.onclick=()=>{S.type=b.dataset.type;S.base={focus:1,initiative:1,collab:1,composure:1,grit:1};render()});
    $$("[data-inc]").forEach(b=>b.onclick=()=>{const k=b.dataset.inc;if(spent()<15&&S.base[k]<baseMax(k)){S.base[k]++;render()}});
    $$("[data-dec]").forEach(b=>b.onclick=()=>{const k=b.dataset.dec;if(S.base[k]>1){S.base[k]--;render()}});
  }
  if(S.step===4&&S.arrived&&S.maxStep<5)tick("left",S.inter,startLevel);
  if(S.step===4)on("#skipIntro",skipArrival);
  if(S.step===4||S.step===6)on("#closeP",()=>{S.panel=false;render()});
  if(S.step===6){
    if(!S.of.applied)$$(".room.click").forEach(g=>g.onclick=()=>{S.room=g.dataset.room;keepTimer()});
    bindGifts(m=>{S.of.msg=m});bindIncoming();
    $$("[data-sab]").forEach(b=>b.onclick=()=>{const r=G.sabotage(ME,MATE(b.dataset.sab));S.of.msg=r.ok?`You drained ${r.target.name} by ${r.drain}. They won't know it was you.`:r.reason;keepTimer()});
    if(!S.of.applied)tick("left",S.of,()=>{applyOpenFloorEnd();go(7)});
  }
  if(S.step===7){
    const s=S.sop;
    $$("[data-pile]").forEach(b=>sopPress(b,()=>{s.built.push(s.pile.splice(+b.dataset.pile,1)[0]);keepTimer()}));
    $$("[data-built]").forEach(b=>sopPress(b,()=>{s.pile.push(s.built.splice(+b.dataset.built,1)[0]);keepTimer()}));
    on("#check",checkSop);on("#reset",()=>{s.pile=shuffle([...SOP,DECOY]);s.built=[];keepTimer()});
    if(!s.checked)tick("left",s,()=>{s.inTime=false;checkSop()});
  }
  if(S.step===8){
    on("#accuse",()=>{const v=$("#accSel").value;if(!v)return;const r=G.accuse(ME,MATE(v));if(!r.ok)return;S.acc.target=v;S.acc.result=r.correct;endAccusations()});
    on("#skipAcc",()=>{S.acc.target="";S.acc.result=null;endAccusations()});
    bindGifts(m=>S.gw.sent.push(m));bindIncoming();
    if(S.acc.done&&!S.gw.closed)tick("left",S.gw,closeGW);
  }
  if(S.step===9){
    $$("[data-pinc]").forEach(b=>b.onclick=()=>{const k=b.dataset.pinc;S.place[k]=(S.place[k]||0)+1;render()});
    $$("[data-pdec]").forEach(b=>b.onclick=()=>{const k=b.dataset.pdec;S.place[k]--;render()});
    on("#cashOut",()=>{if(G.cashOut(ME).ok){S.cashed=true;render()}});
    on("#replay",()=>{const keep={email:S.email,code:S.code,av:S.av,name:S.name,prog:{...S.prog},visited:{...S.visited}};/* rooms stay revealed on the Office Map *//* anomalies and the Glitch Report start over at 0 of 3 */endSession();S=fresh();Object.assign(S,keep);S.step=3;S.maxStep=3;render()});
    on("#restart",signOut);
  }
}
/* SOP cards: a mouse or pen press counts on button-down, so a fast click that slips off the card is never lost.
   The click that follows a press is ignored, so nothing counts twice. Keyboard (Enter/Space) and touch taps use click. */
let sopDownAt=-1e9;
function sopPress(b,fn){
  b.onpointerdown=e=>{if(e.pointerType==="touch"||e.button!==0||b.disabled)return;e.preventDefault();sopDownAt=performance.now();fn()};
  b.onclick=e=>{if(e.detail>0&&performance.now()-sopDownAt<1000)return;fn()}}
function keepTimer(){const t=S.timer;S.timer=null;clearInterval(t);render()}
function lockPoints(){S.prog.done=Math.max(S.prog.done,R().n);S.got=ME.earned;ME.placePoints(S.place);S.place={};G.finishRound();S.done=true;render()}
function applyOpenFloorEnd(){
  if(S.of.applied)return;S.of.applied=true;
  EP.Bots.openFloor(G,RNG);   // bot Contrarians sabotage now
  G.advance();                // Open Floor > Trial
}
function checkSop(){stopTimer();const s=S.sop;s.checked=true;s.score=SOP.filter((t,i)=>s.built[i]===t).length;s.decoyOut=s.built.length>0&&!s.built.includes(DECOY);/* nothing placed: no LOOP */if(s.decoyOut)S.found.loop=1;S.win=s.score>=5&&s.decoyOut;render()}
function payCost(){
  if(S.paid)return;S.paid=true;
  G.setTrialResult(MYTEAM,S.win);EP.Bots.trial(G,RNG);   // other teams: engine result
  S.pay=G.payTrialCosts().get(ME);
  G.advance();                // Trial > Glitch Report
}
function endAccusations(){
  S.acc.done=true;
  EP.Bots.accusations(G,RNG);   // bots accuse
  G.endGlitchReport();          // Exploit credit
  G.advance();                  // Glitch Report > Gift window
  startGW();
}
function startGW(){
  S.gw.started=true;S.gw.left=20;
  EP.Bots.gifts(G,RNG);
  render();
}
function closeGW(){
  S.gw.closed=true;
  G.advance();                // Gift window > Lock-in
  G.lockIn();
  G.advance();                // Lock-in > Stats Update
  S.earnLines=G.computeEarnings().get(ME)||[];
  EP.Bots.statsUpdate(G);   // bots cash out and place points
  render();
}

/* red glitch cursor (menus only) */
const curRed=`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M4 2 L4 26 L10 20 L14 30 L19 28 L15 18 L24 18Z" fill="#e0394d" stroke="#0b0e13" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
const curGl=`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M6 2 L6 26 L12 20 L16 30 L21 28 L17 18 L26 18Z" fill="#ff4fa3" opacity=".8"/><path d="M2 2 L2 26 L8 20 L12 30 L17 28 L13 18 L22 18Z" fill="#38e6d6" opacity=".8"/><path d="M4 2 L4 26 L10 20 L14 30 L19 28 L15 18 L24 18Z" fill="#e0394d" stroke="#0b0e13" stroke-width="2.5" stroke-linejoin="round"/><rect x="0" y="12" width="28" height="3" fill="#ff4fa3"/></svg>`;
const curUri=x=>`url("data:image/svg+xml,${encodeURIComponent(x)}") 4 2`;
document.documentElement.style.setProperty("--cur-red",curUri(curRed));document.documentElement.style.setProperty("--cur-gl",curUri(curGl));
document.addEventListener("pointerdown",()=>{if(!document.body.classList.contains("menucur"))return;document.body.classList.add("curgl");setTimeout(()=>document.body.classList.remove("curgl"),220)});
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("button");if(b&&document.body.classList.contains("menucur")){b.classList.add("btngl");setTimeout(()=>b.classList.remove("btngl"),220)}});
/* wandering ghosts: fade in and out at random spots; tap one for a hint */
function ghostHop(){$$(".gwalk").forEach(el=>{if(Math.random()<.45)return;el.setAttribute("opacity","0");setTimeout(()=>{const [x,y]=GSPOTS[Math.floor(Math.random()*GSPOTS.length)];el.setAttribute("transform",`translate(${x} ${y})`);el.setAttribute("opacity",String(.5+Math.random()*.35))},900)})}
setInterval(ghostHop,2600);setTimeout(ghostHop,400);
document.addEventListener("click",e=>{const g=e.target.closest&&e.target.closest(".gwalk");if(!g||g.getAttribute("opacity")==="0")return;const gh=GHOSTS[+g.dataset.ghost];const w=$("#whisper");w.innerHTML=`<b>${gh.n}</b> whispers: “${esc(gh.line)}”`;w.hidden=false;clearTimeout(w._t);w._t=setTimeout(()=>w.hidden=true,6000)});
$("#navBack").onclick=()=>{if(!canBack())return;if(S.step===1&&S.menu!=="map"){S.menu="map";render();return}if(S.step===1){signOut();return}go(S.step-1)};
$("#navNext").onclick=goForward;
$("#facBtn").onclick=e=>{const v=e.currentTarget.getAttribute("aria-pressed")!=="true";e.currentTarget.setAttribute("aria-pressed",v);$("#fac").hidden=!v};
/* Host Script: only the host sees the button. Solo testing: Ctrl+Shift+H turns host view on or off. */
addEventListener("keydown",e=>{if(!(e.ctrlKey&&e.shiftKey&&(e.key==="H"||e.key==="h")))return;e.preventDefault();
  const b=$("#facBtn");b.hidden=!b.hidden;if(b.hidden){b.setAttribute("aria-pressed","false");$("#fac").hidden=true}});
render();
})();
