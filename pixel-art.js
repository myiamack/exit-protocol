/* ================= PIXEL INTERN ENGINE & SVG ART ================= */
const E="#0b0e13";
const st=`stroke="${E}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"`;
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

function shade(h,f){const n=parseInt(h.slice(1),16);const r=Math.min(255,Math.round(((n>>16)&255)*f)),g=Math.min(255,Math.round(((n>>8)&255)*f)),b=Math.min(255,Math.round((n&255)*f));return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}

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
  R(4,5,8,7,sk);R(5,4,6,1,sk);if(a.body===1){set(4,11,null);set(11,11,null)}else{set(4,11,skd);set(11,11,skd)}R(5,11,6,1,sk);
  /* face */
  R(6,8,1,2,E);R(9,8,1,2,E);set(6,8,"#2a3240");set(9,8,"#2a3240");
  set(7,11,shade(sk,.7));set(8,11,shade(sk,.7));
  if(a.blush!==false){set(5,10,"#e88a8a");set(10,10,"#e88a8a")}
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
 {n:"Coffee Mug",rar:"Common",r:"var(--common)",ab:"Recharge",d:"Refill 1 heart, even above the round's refill.",uses:"1 use",m:["...g..g...","....g..g..",".kkkkkkk..",".kwwwwwwkk",".kbbbbbbk.k",".kwwwwwwk.k",".kwwwwwwkk.",".kwwwwwwk..","..kkkkkk..",".........."],p:{k:E,w:"#f2f5f8",b:"#7a4d2a",g:"#9aa6b8"}},
 {n:"Sticky Note",rar:"Common",r:"var(--common)",ab:"Reminder",d:"Peek at next level's trial attribute before you place your points.",uses:"2 uses",m:["kkkkkkkkk.","kyyyyyyyk.","kyddddyyk.","kyyyyyyyk.","kydddyyyk.","kyyyyyyyk.","kyyyyykkk.","kyyyyykk..","kkkkkkk...",".........."],p:{k:E,y:"#f5e04a",d:"#a8941f"}},
 {n:"Stapler",rar:"Rare",r:"var(--rare)",ab:"Lock down",d:"Staple one attribute for a round. Sabotage can't drain it.",uses:"1 use",m:["..........","..kkkkkkk.",".krrrrrrwk","krrrrrrrrk","kkkkkkkkkk","kssssssssk","kkkkkkkkkk",".........."],p:{k:E,r:"#d8323f",w:"#fff",s:"#7f8fa1"}},
 {n:"Desk Plant",rar:"Rare",r:"var(--rare)",ab:"Breathe",d:"Add 10 seconds to your team's gift window.",uses:"2 uses",m:["...k..k...","..kgk.kgk.","..kgkkggk.","...kggk...","....kk....","..kkkkkk..","..kccccck.","...kccck..","...kkkkk..",".........."],p:{k:E,g:"#4fe08a",c:"#e2706a"}},
 {n:"Rubber Duck",rar:"Epic",r:"var(--epic)",ab:"Debug",d:"Your team's next wrong accusation costs nothing.",uses:"1 use",m:["....kkk...","...kyyyk..","...kyeykok","...kyyykkk","kk.kyyyk..","kykkyyyykk","kyyyyyyyyk",".kyyyyyyk.","..kkkkkk..",".........."],p:{k:E,y:"#f5e04a",e:E,o:"#f2852a"}},
 {n:"USB Backup",rar:"Legendary",r:"var(--legend)",ab:"Restore point",d:"Your first glitch reboots without losing your hearts.",uses:"1 use",m:["..........","kkkkkkk...","kbbbbbkkkk","kbcbbbkssk","kbbbbbkskk","kbbbbbkssk","kbbbbbkkkk","kkkkkkk...",".........."],p:{k:E,b:"#2f5fe0",c:"#5ff2ff",s:"#cbd3dc"}}];
const WTABS=[["body","Character"],["hair","Hair"],["outfit","Outfit"],["acc","Accessories"],["tool","Tool"]];

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
