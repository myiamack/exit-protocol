/* ================= OFFICE PREVIEW MAP & WALKABLE FLOOR 60 ================= */
const GHOSTS=[
 {n:"USER_???",a:{body:0,skin:3,hair:0,hairC:6,top:7,topS:0,bot:0,botS:0,hat:0,extra:4,acc:6}},
 {n:"ATTEMPT_01",a:{body:1,skin:6,hair:6,hairC:6,top:7,topS:3,bot:0,botS:1,hat:0,extra:0,acc:6}},
 {n:"NULL",a:{body:0,skin:1,hair:8,hairC:6,top:7,topS:2,bot:0,botS:0,hat:3,extra:0,acc:7}}];
const GSPOTS=[[110,170],[190,120],[300,150],[500,140],[400,215],[650,160],[720,210],[130,440],[200,380],[330,430],[470,440],[630,450],[710,380]];

/* ================= THE WALKABLE FLOOR (real room names; layout is a placeholder until the blueprint) ================= */
const WW=2300,WH=1420,PR=16;
const ELEV={id:"elevator",n:"Elevator",x:30,y:620,w:160,h:180};
const HALL={x:470,y:650,w:1680,h:120};
const SIDE={x:1840,y:740,w:100,h:580};
const WROOMS=[
 {id:"reception",n:"Reception",pts:[[170,560],[470,560],[520,610],[520,860],[170,860]],fill:"#d7d2c8",lab:[330,600],spots:[[300,760],[440,760]],open:true},
 {id:"kitchen",n:"Kitchen",pts:[[540,300],[760,300],[760,200],[920,200],[920,600],[540,600]],fill:"url(#wtile)",lab:[730,575],doors:[{x:660,y:560,w:160,h:130,side:"n"}],spots:[[640,450],[840,300]]},
 {id:"allskate",n:"All Skate",pts:[[1040,120],[1440,120],[1540,220],[1540,600],[960,600],[960,200]],fill:"url(#wcarpet)",lab:[1250,575],doors:[{x:1160,y:560,w:180,h:130,side:"n"},{x:1528,y:410,w:84,h:130,side:"e"}],spots:[[1040,300],[1460,300],[1200,300]]},
 {id:"hightea",n:"High Tea",pts:[[1600,280],[1900,280],[1980,360],[1980,600],[1600,600]],fill:"url(#wwood)",lab:[1790,575],doors:[{x:1700,y:560,w:160,h:130,side:"n"}],spots:[[1780,410],[1900,520]]},
 {id:"wellness",n:"Wellness Room",pts:[[540,820],[880,820],[880,1120],[620,1120],[540,1040]],fill:"#9cc7a6",lab:[720,860],doors:[{x:630,y:730,w:160,h:130,side:"s"}],spots:[[640,1040],[800,1060]]},
 {id:"conf",n:"Conference Room",pts:[[930,820],[1460,820],[1460,1150],[1410,1200],[980,1200],[930,1150]],fill:"#55729e",lab:[1195,860],doors:[{x:1115,y:730,w:160,h:130,side:"s"}],spots:[[980,1120],[1420,1050]]},
 {id:"breakout",n:"Breakout Room",pts:[[1510,820],[1790,820],[1750,1080],[1510,1080]],fill:"url(#wgrid)",lab:[1640,860],doors:[{x:1550,y:730,w:160,h:130,side:"s"}],spots:[[1700,1020],[1700,960]]}];
const LOCKS=[{lvl:3,x:1840,y:1300,w:100,dir:"h",label:"ACCESS · LVL 3"},{lvl:4,x:2130,y:650,h:120,dir:"v",label:"LVL 4"}];
const RNAME=Object.fromEntries([...WROOMS.map(r=>[r.id,r.n]),["hall","Hallway"],["elevator","Elevator"],["side","East Corridor"]]);
function inPoly(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [xi,yi]=p[i],[xj,yj]=p[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c}return c}
const inRect=(x,y,r)=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h;
function walkable(x,y){if(inRect(x,y,ELEV)||inRect(x,y,HALL)||inRect(x,y,SIDE))return true;for(const r of WROOMS){if(inPoly(x,y,r.pts))return true;if((r.doors||[]).some(d=>inRect(x,y,d)))return true}return false}
/* Furniture the character cannot walk through: [x,y,w,h], matching the drawings in wFurniture().
   Tables, desks, counters, shelves and couches block. Chairs, stools, beanbags and plants do not,
   so rooms stay open to walk. Wall-mounted items (screens, whiteboard, welcome sign) are not listed. */
const BLOCKS=[
  /* reception: curved desk */ [220,690,70,42],[290,668,80,64],[370,690,70,42],
  /* kitchen: L counter, sink, stove top, fridge, table, vending */ [560,320,180,20],[560,320,20,260],[620,330,40,22],[780,215,120,34],[860,260,48,90],[680,420,150,70],[860,420,44,100],
  /* all skate: desks */ ...[[1040,230],[1200,230],[1360,230],[1040,330],[1360,330],[1040,470],[1360,470]].map(([x,y])=>[x,y,120,44]),
  /* high tea: tables, bookshelf, tea counter */ [1648,358,84,84],[1838,388,84,84],[1620,296,140,26],[1800,300,150,44],
  /* wellness: couches, ottoman */ [580,880,56,130],[656,880,56,130],[754,966,92,68],
  /* conference: table */ [1000,930,390,160],
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
/* Minimap room labels: short full names, squeezed to fit inside the room when needed. */
const MMLAB={reception:"RECEPTION",kitchen:"KITCHEN",allskate:"ALL SKATE",hightea:"HIGH TEA",wellness:"WELLNESS",conf:"CONFERENCE",breakout:"BREAKOUT"};
function mmFit(r){const xs=r.pts.map(p=>p[0]),room=Math.max(...xs)-Math.min(...xs),max=room*.72,est=MMLAB[r.id].length*70*.62;
  return est>max?` textLength="${Math.round(max)}" lengthAdjust="spacingAndGlyphs"`:""}
function minimapSVG(full){const vis=k=>full||S.visited[k];
  return `<svg viewBox="0 0 ${WW} ${WH}" role="img" aria-label="Minimap"><rect width="${WW}" height="${WH}" rx="40" fill="#0b0e13"/>
  <rect x="${HALL.x}" y="${HALL.y}" width="${HALL.w}" height="${HALL.h}" fill="${vis("hall")?"#cfd6de":"#1d232e"}"/><rect x="${SIDE.x}" y="${SIDE.y}" width="${SIDE.w}" height="${SIDE.h}" fill="${vis("side")?"#cfd6de":"#1d232e"}"/><rect x="${ELEV.x}" y="${ELEV.y}" width="${ELEV.w}" height="${ELEV.h}" fill="#5b6577"/>
  ${WROOMS.map(r=>{const v=vis(r.id),cx=r.pts.reduce((a,p)=>a+p[0],0)/r.pts.length,cy=r.pts.reduce((a,p)=>a+p[1],0)/r.pts.length;return `<polygon points="${P(r.pts)}" fill="${v?"#a8d8ff":"#1d232e"}" stroke="#4a5568" stroke-width="14"/><text x="${cx}" y="${cy+28}" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="${v?70:110}" fill="${v?"#13294b":"#4a5568"}"${v?mmFit(r):""}>${v?MMLAB[r.id]:"?"}</text>`}).join("")}
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
  ${S.panel?`<div class="wpanel"><button class="xclose" id="closeP" aria-label="Close">✕</button>${S.panel==="ghost"?ghostPanel():S.panel==="npc"?rookPanel():roomPanel()}</div>`:""}
  <div class="wact" id="wact" hidden></div>
  <div class="whelp"><span class="kb">Move: arrow keys / WASD · Act: E · Map: M</span><span class="tc">Move: joystick · Act: USE</span></div>
  </div>`}
function roomPanel(){const t=T();const lockd=!floorOpen()||S.step!==6;const r=S.room;
  if(r==="kitchen")return `<div class="panel"><span class="label">Kitchen · Gifts</span><p>Gift any teammate here during Open Floor, or in the gift window after the trial.</p><p class="hint">Your cost as ${aOrAn(t.n)}: ${giftCostText(t.ct)}.${t.ct.canAcceptGifts()?"":" You cannot accept gifts."}</p>${lockd?`<p class="hint">${GIFT_RULE}</p>`:incomingGifts()+giftRoster()}${!lockd&&S.of.msg?`<span class="okmsg">${esc(S.of.msg)}</span>`:""}</div>`;
  if(r==="breakout"){const sab=G&&ME?G.sabotageOptions(ME):null;if(!sab||!sab.canRole||lockd)return `<div class="panel"><span class="label">Breakout Room</span><p>The whiteboard has been wiped, badly. The room feels like someone just left.</p></div>`;
    return `<div class="panel"><span class="label">Breakout Room · Sabotage a teammate (Contrarian only)</span><p class="hint">This one costs ${sab.cost} heart${sab.cost>1?"s":""}. Drains 2 from the target's ${AN[sab.attr]} (their Composure gives a chance it is only 1). Each extra sabotage this round costs 2.</p><div class="roster">${sab.targets.map(p=>`<div class="person"><span class="who">${avatarSVG(TEAM.find(x=>x.n===p.name).av,{head:true,label:p.name})}${esc(p.name)}</span><span class="row" style="gap:6px">${flag(p.status)}<button class="btn red sm" data-sab="${esc(p.name)}" ${p.reason?`disabled title="${esc(p.reason)}"`:""}>Sabotage</button></span></div>`).join("")}</div>${S.of.msg?`<span class="okmsg">${esc(S.of.msg)}</span>`:""}${sab.blockedThisRound?`<span class="hint">Blocked: you were caught last round. No sabotage on any team this round.</span>`:sab.caughtByTeam?`<span class="hint">This team caught you. No sabotage while you are on it.</span>`:""}</div>`}
  if(r==="hightea"){return `<div class="panel"><span class="label">High Tea · Network with a guest</span><p class="hint">Today's guest is a program sponsor who once sat where you're sitting. You pour the tea and introduce yourself.</p><div class="memo"><p>"${esc(teaHint())}"</p></div><p class="hint">Guests share stories, not answers. Prep 3:30 · Tea 4:00 · Debrief 5:00.</p></div>`;}
  if(r==="wellness")return `<div class="panel"><span class="label">Wellness Room</span><p>Quiet in here. Take a breath before the trial. (No game effect yet.)</p></div>`;
  if(r==="conf")return `<div class="panel"><span class="label">Conference Room · Emergency button</span><p>${S.step===8?"The all-hands meeting is in session.":"The button is locked. It lights up after the trial, when the all-hands meeting is called."}</p></div>`;
  if(r==="reception")return `<div class="panel"><span class="label">Reception · Check in</span><p>The front desk prints your badge again. <b>ATTEMPT 02</b>. You only remember one.</p><span class="okmsg">Anomaly logged: WATCHER.</span></div>`;
  return `<div class="panel"><span class="label">All Skate · Reflect and plan</span><p>The cohort gathers here to look back on the week, look ahead at assignments and plan the day. Your team is ready to plan the trial. ${T().ct.canSabotage()?"Slip into the Breakout Room to sabotage a teammate. ":""}Gift a teammate in the Kitchen now, or in the gift window after the trial. A guest is waiting in High Tea.</p><div class="roster">${TEAM.map(p=>personRow({...p,st:MATE(p.n).boardStatus()})).join("")}</div></div>`;
}
/* Rook from Team Wren stands in the hallway. Walk up and press E to talk. */
const ROOK={x:1690,y:745};
function rookPanel(){return `<div class="panel"><span class="label">Rook · Team Wren</span><p>"Same trial as you this round. Good luck in there."</p><span class="hint">Other teams are on this floor too.</span></div>`}
function ghostPanel(){const g=GHOSTS[S.nearGhost||0];return `<div class="panel" style="border-color:#e9ecff"><span class="label" style="color:#e9ecff">${g.n} · wandering ghost</span><p style="font-family:var(--px);color:#e9ecff">“${esc(ghostHint(g.n))}”</p><span class="hint">It flickers and is gone.</span></div>`}
let W={raf:0,vx:0,vy:0,keys:{},tapT:{},last:0,ghostT:0,ghostPos:[]};
const TAP_MS=110;   // one quick tap moves about 33px (300 px/s)
function stopWorld(){cancelAnimationFrame(W.raf);W.raf=0}
/* Fit the map inside the scroll area above the bottom bar, and scroll it fully into view once per screen. */
/* On map screens the attribute bar sticks to the top (class "mapscreen"), so the map gets the space below it. */
function fitWorld(){const wrap=$(".wrap"),w=$("#world"),hud=$("#hud");if(!wrap||!w)return;
  const hudH=hud&&!hud.hidden&&wrap.contains(hud)?hud.offsetHeight+14:0;
  w.style.height=Math.max(300,Math.min(640,wrap.clientHeight-hudH-28))+"px";
  if(W.fitFor===S.step)return;W.fitFor=S.step;
  const need=w.offsetTop+w.offsetHeight+14-wrap.clientHeight;if(need>wrap.scrollTop)wrap.scrollTo({top:need})}
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
    if(t-W.ghostT>2800){W.ghostT=t;W.ghostPos.forEach((p,i)=>{if(Math.random()<.5){p.on=!p.on;if(p.on){const r=WROOMS[Math.floor(Math.random()*WROOMS.length)],sp=r.spots[Math.floor(Math.random()*r.spots.length)];p.x=sp[0];p.y=sp[1]}ghosts[i].setAttribute("opacity",p.on?".7":"0");ghosts[i].setAttribute("transform",`translate(${p.x} ${p.y})`)}})} // cosmetic-ok
    let near=-1;W.ghostPos.forEach((p,i)=>{if(p.on&&Math.hypot(p.x-S.pos.x,p.y-S.pos.y)<120)near=i});S.nearGhost=near>=0?near:S.nearGhost;W.near=near;
    /* Popups close when the player walks away: a room popup when leaving the room, others after moving ~140px. */
    if(S.panel&&S.panelAt){const at=S.panelAt,away=S.panel==="room"?S.wroom!==at.room:Math.hypot(S.pos.x-at.x,S.pos.y-at.y)>140;if(away){S.panel=false;S.panelAt=null;const el=$(".wpanel");if(el)el.remove()}}
    const act=useAction();use.textContent=act.label;use.disabled=!act.ok;use.className="usebtn "+(act.cls||"");
    const hint=act.ok?"Press E: "+act.label:"";if(wact&&wact.dataset.t!==hint){wact.dataset.t=hint;wact.textContent=hint;wact.hidden=!hint}
  };
  W.raf=requestAnimationFrame(frame);
}
function useAction(){const mode=S.step===6&&floorOpen()?"floor":"lobby";
  if(W.near>=0)return{label:"Listen",ok:true,cls:"ghost",act:"ghost"};
  if(Math.hypot(S.pos.x-ROOK.x,S.pos.y-ROOK.y)<90)return{label:"Talk",ok:true,act:"npc"};
  const r=S.wroom;
  if(r==="kitchen")return{label:"Look",ok:true,act:"room"};
  /* "Sabotage" only if a Sabotage button inside would work (same Game.sabotageOptions check). */
  if(r==="breakout"){const sab=mode==="floor"&&G&&ME?G.sabotageOptions(ME):null;return sab&&sab.canAny?{label:"Sabotage",ok:true,cls:"red",act:"room"}:{label:"Inspect",ok:true,act:"room"}}
  if(r==="hightea")return{label:"Network",ok:true,cls:"green",act:"room"};
  if(r==="allskate")return{label:"Reflect",ok:true,act:"room"};
  if(r==="conf")return{label:"Button",ok:true,cls:"red",act:"room"};
  if(r==="reception")return{label:"Check in",ok:true,act:"room"};
  if(r==="wellness")return{label:"Breathe",ok:true,act:"room"};
  return{label:"USE",ok:false};
}
function doUse(){const a=useAction();if(!a.ok)return;if(a.act==="room"&&S.wroom==="reception"&&G&&ME)G.recordAnomaly(ME,"id");S.panel=a.act==="ghost"||a.act==="npc"?a.act:"room";S.panelAt={room:S.wroom,x:S.pos.x,y:S.pos.y};render()}
addEventListener("keydown",e=>{if(!$("#world")||e.target.tagName==="INPUT"||BOARD.isOpen())return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","w","a","s","d"].includes(k)){if(!e.repeat&&!W.keys[k])W.tapT[k]=performance.now();W.keys[k]=true;e.preventDefault()}if(k==="e"){if(S.panel){S.panel=false;if(!useAction().ok){render();return}}doUse()}/* E with a popup open: close it, open the new interaction */if(k==="m"&&!e.repeat)toggleMinimap()});
addEventListener("keyup",e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;W.keys[k]=false});

/* legacy static-map whisper click handler */
document.addEventListener("click",e=>{const g=e.target.closest&&e.target.closest(".gwalk");if(!g||g.getAttribute("opacity")==="0")return;const gh=GHOSTS[+g.dataset.ghost];const w=$("#whisper");w.innerHTML=`<b>${gh.n}</b> whispers: “${esc(ghostHint(gh.n))}”`;w.hidden=false;clearTimeout(w._t);w._t=setTimeout(()=>w.hidden=true,6000)});
