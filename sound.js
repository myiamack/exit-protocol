/* ================= SOUND (screen-only: sound playback, no game state) =================
   Everything is made with the Web Audio API, so there are no audio files to load or license.
   Browsers only allow sound after the first click or key press, so nothing plays before that.
   Sound.music(true/false)  mysterious background loop (think: a game of Clue)
   Sound.elevator(true/false)  elevator hum + light elevator music
   Sound.ding()  the doors-open "bing"
   Sound.glitch(strength)  glitch noise (0.3 = small click blip, 1 = full glitch)
   Sound.toggleMute() / Sound.muted */
const Sound=(()=>{
  let ctx=null,master=null,muted=false,wantMusic=false,wantElev=false;
  let musicBus=null,elevBus=null,schedT=null,nextNote=0,stepI=0,elevNodes=[];
  const AC=typeof window!=="undefined"&&(window.AudioContext||window.webkitAudioContext);
  function ensure(){
    if(ctx||!AC)return !!ctx;
    try{ctx=new AC()}catch(e){ctx=null;return false}
    master=ctx.createGain();master.gain.value=muted?0:.8;master.connect(ctx.destination);
    musicBus=ctx.createGain();musicBus.gain.value=0;musicBus.connect(master);
    elevBus=ctx.createGain();elevBus.gain.value=0;elevBus.connect(master);
    return true}
  function unlock(){if(!ensure())return;if(ctx.state==="suspended")ctx.resume();apply()}
  addEventListener("pointerdown",unlock);addEventListener("keydown",unlock);
  const hz=m=>440*Math.pow(2,(m-69)/12);
  function tone(bus,{f,t,d,type="sine",v=.2,a=.01,r=null,detune=0,filt=null}){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=f;o.detune.value=detune;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+(r||d));
    let out=o;if(filt){const fl=ctx.createBiquadFilter();fl.type="lowpass";fl.frequency.value=filt;o.connect(fl);out=fl}
    out.connect(g);g.connect(bus);o.start(t);o.stop(t+(r||d)+.05)}
  function fade(bus,to,sec){if(!bus)return;const t=ctx.currentTime;bus.gain.cancelScheduledValues(t);bus.gain.setValueAtTime(bus.gain.value,t);bus.gain.linearRampToValueAtTime(to,t+sec)}

  /* ---- background: a sneaky minor walk, soft pad, ticking clock (A minor, ~92 bpm) ---- */
  const BEAT=60/92/2;   // eighth notes
  const BASS=[45,null,48,null,52,null,51,null,50,null,48,null,47,null,null,null, 45,null,48,null,52,null,53,null,52,null,51,null,50,null,47,null];
  const MEL=[null,null,null,null,76,null,null,75,null,null,72,null,null,null,null,null, null,null,null,null,76,null,77,null,76,null,75,null,71,null,null,null];
  const PADS=[[57,60,64],[57,60,64],[53,57,60],[52,56,59]];   // Am, Am, F, E
  function schedule(){
    if(!ctx)return;
    while(nextNote<ctx.currentTime+.4){
      const i=stepI%32,t=nextNote;
      if(BASS[i])tone(musicBus,{f:hz(BASS[i]),t,d:BEAT*1.6,type:"triangle",v:.22,a:.005,filt:900});   // plucky walking bass
      if(MEL[i])tone(musicBus,{f:hz(MEL[i]),t,d:BEAT*2.5,type:"sine",v:.07,a:.02,detune:6});   // music-box melody
      if(i%2===0)tone(musicBus,{f:i%8===0?2200:1800,t,d:.03,type:"square",v:.012,a:.001});   // clock tick
      if(i%8===0){PADS[(i/8)|0].forEach(m=>tone(musicBus,{f:hz(m),t,d:BEAT*8,type:"sawtooth",v:.018,a:.6,r:BEAT*8,filt:700}))}
      nextNote+=BEAT;stepI++}
  }
  function startLoop(){if(schedT)return;nextNote=ctx.currentTime+.1;schedT=setInterval(schedule,100);schedule()}
  function stopLoop(){clearInterval(schedT);schedT=null}

  /* ---- elevator: low hum + a light bossa-style elevator tune ---- */
  const ELEV=[[67,71,74],[67,71,74],[64,67,71],[62,66,69]];   // Gmaj, Gmaj, Em, D
  let elevT=null,elevStep=0,elevNext=0;
  function elevSchedule(){
    while(elevNext<ctx.currentTime+.4){
      const t=elevNext,c=ELEV[((elevStep/4)|0)%4];
      if(elevStep%2===0)tone(elevBus,{f:hz(c[0]-24),t,d:.35,type:"triangle",v:.12});
      tone(elevBus,{f:hz(c[elevStep%3]+12),t,d:.25,type:"sine",v:.05,detune:-8});
      elevNext+=.24;elevStep++}
  }
  function elevStart(){
    const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type="sawtooth";o.frequency.value=48;f.type="lowpass";f.frequency.value=160;g.gain.value=.09;
    o.connect(f);f.connect(g);g.connect(elevBus);o.start();
    const wob=ctx.createOscillator(),wg=ctx.createGain();wob.frequency.value=.7;wg.gain.value=4;wob.connect(wg);wg.connect(o.frequency);wob.start();
    elevNodes=[o,wob];elevNext=ctx.currentTime+.15;elevStep=0;elevT=setInterval(elevSchedule,100);elevSchedule()}
  function elevStop(){clearInterval(elevT);elevT=null;const n=elevNodes;elevNodes=[];setTimeout(()=>n.forEach(x=>{try{x.stop()}catch(e){}}),700)}

  function apply(){
    if(!ctx||ctx.state!=="running")return;
    if(wantElev&&!elevT){elevStart();fade(elevBus,.9,.4)}
    if(!wantElev&&elevT){fade(elevBus,0,.5);elevStop()}
    const musicOn=wantMusic&&!wantElev;
    if(musicOn){startLoop();fade(musicBus,.55,1.5)}else{fade(musicBus,0,.6)}
  }
  return {
    music(on){wantMusic=!!on;if(ctx)apply()},
    elevator(on){if(wantElev===!!on)return;wantElev=!!on;if(ctx)apply()},
    ding(){if(!ensure()||ctx.state!=="running")return;const t=ctx.currentTime+.02;
      tone(master,{f:1318.5,t,d:1.4,v:.18,a:.003});tone(master,{f:2637,t,d:.6,v:.04,a:.003});
      tone(master,{f:1046.5,t:t+.42,d:1.8,v:.16,a:.003})},
    glitch(strength=1){if(!ensure()||ctx.state!=="running")return;const t=ctx.currentTime,len=.08+.32*strength;
      const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*len),ctx.sampleRate),d=buf.getChannelData(0);
      let hold=0,val=0;for(let i=0;i<d.length;i++){if(hold--<=0){val=Math.random()*2-1;hold=Math.floor(Math.random()*40)}d[i]=val*(Math.random()<.85?1:0)} // cosmetic-ok
      const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=buf;f.type="bandpass";f.frequency.value=1400;f.Q.value=.8;
      g.gain.setValueAtTime(.22*strength+.04,t);g.gain.exponentialRampToValueAtTime(.0001,t+len);src.connect(f);f.connect(g);g.connect(master);src.start(t);
      for(let k=0;k<Math.round(2+4*strength);k++)tone(master,{f:200+Math.random()*1600,t:t+k*len/6,d:.04,type:"square",v:.05*strength+.01,a:.001})}, // cosmetic-ok
    toggleMute(){muted=!muted;if(master)master.gain.setTargetAtTime(muted?0:.8,ctx.currentTime,.05);return muted},
    get muted(){return muted},
  };
})();
