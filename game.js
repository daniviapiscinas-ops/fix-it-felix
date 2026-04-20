// ============================================================
//  Fix-It Felix Jr.  —  game.js  v2
//  + Dificultad progresiva suave
//  + Personajes en ventanas pidiendo ayuda
//  + Música chiptune Web Audio API
//  + SFX: martillo, ladrillo, vida perdida, nivel completado
// ============================================================

(function () {
  'use strict';

  const canvas = document.getElementById('gc');
  const ctx = canvas.getContext('2d');
  let W, H, SCALE;

  function resize() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const hudH = document.getElementById('hud').offsetHeight;
    const ctrlH = document.getElementById('controls').offsetHeight;
    W = rect.width;
    H = Math.max(rect.height - hudH - ctrlH, 200);
    canvas.width  = Math.round(W);
    canvas.height = Math.round(H);
    ctx.imageSmoothingEnabled = false;
    layoutGame();
  }
  window.addEventListener('resize', () => { resize(); if (state !== 'playing') drawFrame(); });

  const ROWS = 5, COLS = 4;
  let BLD_X, BLD_Y, BLD_W, BLD_H, WIN_W, WIN_H, WIN_PAD_X, WIN_PAD_Y, FLOOR_H, RALPH_Y;

  function layoutGame() {
    const margin = W * 0.06;
    BLD_X = margin; BLD_W = W - margin * 2;
    WIN_PAD_X = BLD_W * 0.04;
    WIN_W = (BLD_W - WIN_PAD_X * (COLS + 1)) / COLS;
    WIN_H = WIN_W * 0.75;
    WIN_PAD_Y = WIN_W * 0.12;
    FLOOR_H = WIN_H + WIN_PAD_Y * 2;
    BLD_H = FLOOR_H * ROWS + WIN_PAD_Y;
    BLD_Y = H - BLD_H - H * 0.05;
    RALPH_Y = BLD_Y - H * 0.08;
    SCALE = WIN_W / 48;
  }

  const P = {
    sky1:'#0a0a1a',sky2:'#0f0f2e',star:'#ffffff',
    bldWall:'#8b4513',bldWallD:'#6b3410',bldWallH:'#a0522d',bldEdge:'#5d2f0a',
    ledge:'#bdc3c7',ledgeD:'#95a5a6',ledgeH:'#dfe6e9',
    winFrame:'#2c3e50',winFrameH:'#34495e',
    winGlass:'#74b9ff',winGlassD:'#0984e3',
    winBroken:'#1a1a2a',winCrack:'#444',winFixed:'#00b894',
    brickRed:'#e74c3c',brickRedD:'#c0392b',brickRedH:'#ff6b6b',brickMortar:'#d4c5b0',
    felixSkin:'#ffeaa7',felixHat:'#e74c3c',felixHatB:'#c0392b',
    felixBody:'#3498db',felixBodyD:'#2980b9',felixOverall:'#f39c12',felixOverallD:'#d68910',felixBoot:'#2d3436',
    hammerHead:'#b2bec3',hammerHandle:'#795548',
    gold:'#f1c40f',
    ralphSkin:'#e8a87c',ralphSkinD:'#d4956a',
    ralphShirt:'#e74c3c',ralphShirtD:'#c0392b',ralphPant:'#795548',ralphPantD:'#6d4c41',ralphHair:'#3d2b1f',
    smoke:'#636e72',
    ground:'#4a3728',groundD:'#3d2b1f',groundH:'#5d4037',dirt:'#6d4c41',moon:'#ffeaa7',
    r1skin:'#ffd5b8',r2skin:'#c68642',r3skin:'#f1c27d',
    r1hair:'#3d2b1f',r2hair:'#f1c40f',r3hair:'#e74c3c',
    r1shirt:'#9b59b6',r2shirt:'#27ae60',r3shirt:'#e67e22',
  };

  // ── Progressive difficulty ────────────────────────────────
  function getDiff(lvl) {
    return {
      initBreaks:   Math.min(1 + Math.floor(lvl * 0.6), 8),
      throwInterval:Math.max(55, 180 - lvl * 14),
      breakInterval:Math.max(90, 280 - lvl * 18),
      brickSpeed:   Math.min(2.4 + lvl * 0.18, 5.5),
      repairTime:   Math.max(30, 62 - lvl * 2),
      breakCount:   lvl >= 7 ? 2 : 1,
      inaccuracy:   Math.max(0, (5 - lvl) * 0.15),
    };
  }

  // ── Audio (Web Audio API chiptune) ────────────────────────
  let audioCtx = null, musicPlaying = false, audioEnabled = false, musicTimeout = null;

  function getAC() {
    if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    return audioCtx;
  }

  function beep(freq, dur, type='square', vol=0.15, delay=0) {
    const ac = getAC(); if (!ac) return;
    try {
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = type; osc.frequency.value = freq;
      const t = ac.currentTime + delay;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t); osc.stop(t + dur + 0.01);
    } catch(e){}
  }

  const sfxHammer  = () => { beep(440,.04,'square',.2); beep(220,.08,'square',.15,.04); };
  const sfxRepaired= () => [523,659,784,1047].forEach((f,i)=>beep(f,.1,'square',.15,i*.07));
  const sfxBrick   = () => { beep(150,.06,'sawtooth',.2); beep(80,.12,'sawtooth',.15,.05); };
  const sfxHit     = () => { beep(200,.05,'sawtooth',.25); beep(120,.1,'sawtooth',.2,.04); beep(80,.15,'sawtooth',.15,.08); };
  const sfxLevelUp = () => [523,659,784,1047,1319].forEach((f,i)=>beep(f,.12,'square',.18,i*.1));
  const sfxGameOver= () => [440,392,349,294,247].forEach((f,i)=>beep(f,.18,'square',.2,i*.15));

  const BEAT = 60 / 140; // 140 BPM
  const MELODY = [
    [659,1],[784,1],[880,1],[784,1],[659,2],[523,2],
    [587,1],[698,1],[784,1],[698,1],[587,2],[494,2],
    [523,1],[659,1],[784,1],[880,1],[784,1],[659,1],[523,2],[392,2],
    [440,1],[523,1],[659,1],[523,1],[440,2],[392,2],
  ];
  const BASS = [
    [131,2],[165,2],[131,2],[165,2],[110,2],[138,2],[110,2],[138,2],
    [131,2],[165,2],[131,2],[165,2],[110,2],[138,2],[110,2],[138,2],
  ];

  function playBar(i) {
    const ac = getAC(); if (!ac || !musicPlaying) return;
    const [mf, mb] = MELODY[i % MELODY.length];
    const [bf, bb] = BASS[i % BASS.length];
    beep(mf, BEAT*mb*0.8, 'square', 0.09);
    beep(bf, BEAT*bb*0.8, 'triangle', 0.11);
    if (i%2===0) beep(8000,.02,'sawtooth',.04);
    if (i%4===0) beep(100,.05,'sine',.07);
    musicTimeout = setTimeout(()=>playBar(i+1), BEAT*Math.max(mb,bb)*1000);
  }
  function startMusic() { if(musicPlaying) return; musicPlaying=true; audioEnabled=true; playBar(0); }
  function stopMusic()  { musicPlaying=false; if(musicTimeout) clearTimeout(musicTimeout); }

  // ── Helpers ───────────────────────────────────────────────
  function px(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h)); }
  function circle(x,y,r,c){ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
  function winRect(r,c){ return {x:BLD_X+WIN_PAD_X+c*(WIN_W+WIN_PAD_X),y:BLD_Y+WIN_PAD_Y+r*FLOOR_H,w:WIN_W,h:WIN_H}; }
  function felixTarget(r,c){ const rr=winRect(r,c); const fh=WIN_H*1.1; return {x:rr.x+rr.w/2-fh*0.4,y:rr.y+rr.h}; }

  // ── State ─────────────────────────────────────────────────
  let state='start', score=0, lives=3, level=1, frameCount=0;
  let windows=[], bricks=[], particles=[], sparkles=[];
  let throwTimer=0, breakTimer=0, lvlTimer=0, screenShake=0;
  let stars=[], diff=getDiff(1);
  let felix={x:0,y:0,row:4,col:0,dir:1,repairing:false,repairTimer:0,invincible:0,walkAnim:0};
  let ralph={x:0,armRaise:0,angry:0};

  const RESCUE=[
    {skin:P.r1skin,hair:P.r1hair,shirt:P.r1shirt,wf:0.08},
    {skin:P.r2skin,hair:P.r2hair,shirt:P.r2shirt,wf:0.10},
    {skin:P.r3skin,hair:P.r3hair,shirt:P.r3shirt,wf:0.12},
  ];

  function initStars(){
    stars=[];
    for(let i=0;i<60;i++) stars.push({x:Math.random()*W,y:Math.random()*BLD_Y,r:Math.random()*1.5+0.3,t:Math.random()*Math.PI*2,s:0.02+Math.random()*0.03});
  }

  function initWindows(){
    windows=[];
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++)
      windows.push({row:r,col:c,broken:false,repairing:false,flashTimer:0,rt:Math.floor(Math.random()*3),wo:Math.random()*Math.PI*2});
  }

  function breakRandom(n=1){
    const intact=windows.filter(w=>!w.broken);
    for(let i=0;i<n&&intact.length>0;i++){
      const idx=Math.floor(Math.random()*intact.length);
      const w=intact.splice(idx,1)[0];
      w.broken=true;
      const r=winRect(w.row,w.col);
      spawnSmoke(r.x+r.w/2,r.y+r.h/2,6);
    }
  }

  function allFixed(){ return windows.every(w=>!w.broken); }

  function resetFelix(){
    felix.row=4; felix.col=0;
    const p=felixTarget(4,0); felix.x=p.x; felix.y=p.y;
    felix.repairing=false; felix.repairTimer=0; felix.invincible=0; felix.walkAnim=0;
  }

  function startLevel(){
    state='playing'; diff=getDiff(level);
    bricks=[];particles=[];sparkles=[];
    initWindows(); resetFelix(); layoutGame(); initStars();
    breakRandom(diff.initBreaks);
    throwTimer=diff.throwInterval+60; breakTimer=diff.breakInterval+120;
    ralph.x=BLD_X+BLD_W/2-W*0.06; ralph.armRaise=0; ralph.angry=0;
    document.getElementById('overlay').classList.add('hidden');
    updateHUD();
    if(!audioEnabled) startMusic();
  }

  function startGame(){ score=0;lives=3;level=1; startLevel(); startMusic(); }

  function updateHUD(){
    document.getElementById('scoreEl').textContent=String(score).padStart(6,'0');
    document.getElementById('levelEl').textContent=String(level).padStart(2,'0');
    const el=document.getElementById('livesEl'); el.innerHTML='';
    for(let i=0;i<3;i++){const d=document.createElement('div');d.className='life-icon'+(i>=lives?' empty':'');el.appendChild(d);}
  }

  function spawnParticles(x,y,color,n,power=3){
    for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=(Math.random()+0.5)*power;
      particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-power*0.5,life:30+Math.random()*20,maxLife:50,color,size:2+Math.random()*3,gravity:0.18});}
  }
  function spawnSparkles(x,y){
    for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;
      sparkles.push({x,y,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5-1,life:25,maxLife:25,size:WIN_W*0.07});}
  }
  function spawnSmoke(x,y,n=4){
    for(let i=0;i<n;i++) particles.push({x:x+(Math.random()-.5)*8,y,vx:(Math.random()-.5)*1.5,vy:-1-Math.random()*1.5,life:40,maxLife:40,color:P.smoke,size:3+Math.random()*4,gravity:-0.02});
  }

  function throwBrick(){
    ralph.armRaise=1; ralph.angry=60;
    const t=felixTarget(felix.row,felix.col);
    const bx=ralph.x+WIN_W*0.3+Math.random()*WIN_W*0.4, by=RALPH_Y+WIN_H*0.5;
    const spd=diff.brickSpeed, dx=t.x-bx, dy=t.y-by, dist=Math.sqrt(dx*dx+dy*dy)||1;
    const ia=diff.inaccuracy;
    bricks.push({x:bx,y:by,vx:(dx/dist)*spd*(0.7+Math.random()*0.6)+(Math.random()-.5)*ia,vy:Math.min((dy/dist)*spd+(Math.random()-.5)*ia,-0.5),rot:0,rotV:(Math.random()-.5)*0.15,type:Math.floor(Math.random()*3)});
    sfxBrick();
  }

  function felixMove(dr,dc){
    if(state!=='playing'||felix.repairing) return;
    const nr=felix.row+dr,nc=felix.col+dc;
    if(nr<0||nr>=ROWS||nc<0||nc>=COLS) return;
    felix.row=nr; felix.col=nc;
    if(dc!==0) felix.dir=dc;
    const p=felixTarget(nr,nc); felix.x=p.x; felix.y=p.y; felix.walkAnim++;
  }

  function felixRepair(){
    if(state!=='playing'||felix.repairing) return;
    const w=windows.find(ww=>ww.row===felix.row&&ww.col===felix.col);
    if(w&&w.broken){ felix.repairing=true; felix.repairTimer=diff.repairTime; w.repairing=true; sfxHammer(); }
  }

  // ── DRAW: Rescue character in broken window ───────────────
  function drawRescue(win) {
    const rr=winRect(win.row,win.col), {x,y,w,h}=rr;
    const T=RESCUE[win.rt];
    const wave=Math.sin(frameCount*T.wf+win.wo);
    const bob=Math.sin(frameCount*0.05+win.wo)*2;
    const cx=x+w*0.5, charY=y+h*0.18+bob;
    const headR=w*0.16, bodyH=h*0.38;

    // glow
    ctx.fillStyle='rgba(255,200,100,0.10)';
    ctx.beginPath(); ctx.ellipse(cx,charY+headR+bodyH*0.5,w*0.35,h*0.42,0,0,Math.PI*2); ctx.fill();

    // body
    px(cx-w*0.18, charY+headR*1.8, w*0.36, bodyH, T.shirt);

    // left arm static
    px(cx-w*0.28, charY+headR*2.0, w*0.1, bodyH*0.55, T.shirt);

    // right arm waving
    ctx.save();
    ctx.translate(cx+w*0.18, charY+headR*2.1);
    ctx.rotate(-(wave*0.6+0.3));
    px(0,0,w*0.1,bodyH*0.55,T.shirt);
    circle(w*0.05, bodyH*0.55, w*0.07, T.skin);
    ctx.restore();

    // head
    circle(cx, charY+headR, headR, T.skin);

    // hair
    ctx.fillStyle=T.hair;
    ctx.beginPath(); ctx.arc(cx,charY+headR*0.5,headR,Math.PI,0); ctx.fill();
    for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.arc(cx+i*headR*0.6,charY,headR*0.4,Math.PI,0); ctx.fill(); }

    // eyes
    const ey=charY+headR;
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.ellipse(cx-headR*0.42,ey,headR*0.22,headR*0.28,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+headR*0.42,ey,headR*0.22,headR*0.28,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2d3436';
    circle(cx-headR*0.42,ey,headR*0.14,'#2d3436');
    circle(cx+headR*0.42,ey,headR*0.14,'#2d3436');
    ctx.fillStyle='#fff';
    ctx.fillRect(cx-headR*0.48,ey-headR*0.1,headR*0.08,headR*0.1);
    ctx.fillRect(cx+headR*0.36,ey-headR*0.1,headR*0.08,headR*0.1);

    // worried eyebrows
    ctx.strokeStyle=T.hair; ctx.lineWidth=Math.max(1,SCALE*0.5);
    ctx.beginPath(); ctx.moveTo(cx-headR*0.62,ey-headR*0.42); ctx.lineTo(cx-headR*0.22,ey-headR*0.32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+headR*0.62,ey-headR*0.42); ctx.lineTo(cx+headR*0.22,ey-headR*0.32); ctx.stroke();

    // open mouth
    ctx.fillStyle='#c0392b';
    ctx.beginPath(); ctx.ellipse(cx,charY+headR*1.55,headR*0.28,headR*0.2,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2d3436';
    ctx.beginPath(); ctx.ellipse(cx,charY+headR*1.55,headR*0.15,headR*0.1,0,0,Math.PI*2); ctx.fill();

    // speech bubble on wave peak
    if(wave>0.55){
      const bx2=cx+w*0.15, by2=charY-headR*1.4, bw2=w*0.6, bh2=h*0.18;
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.roundRect(bx2,by2,bw2,bh2,[4]); ctx.fill();
      ctx.fillStyle='#fff'; ctx.beginPath();
      ctx.moveTo(bx2+6,by2+bh2); ctx.lineTo(bx2-4,by2+bh2+7); ctx.lineTo(bx2+14,by2+bh2); ctx.fill();
      ctx.fillStyle='#e74c3c';
      ctx.font=`bold ${Math.max(7,Math.round(bh2*0.62))}px 'Courier New'`;
      ctx.textAlign='center';
      ctx.fillText('¡AYUDA!',bx2+bw2/2,by2+bh2*0.72);
      ctx.textAlign='left';
    }

    // sweat drop
    circle(cx+headR*0.82,charY+headR*0.7,headR*0.1,'#74b9ff');
  }

  // ── DRAW: Building ─────────────────────────────────────────
  function drawBuilding(){
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(BLD_X+6,BLD_Y+6,BLD_W,BLD_H);
    px(BLD_X,BLD_Y,BLD_W,BLD_H,P.bldWall);
    const bW=BLD_W/8,bH=FLOOR_H/3;
    for(let r=0;r<BLD_H/bH+1;r++){
      const off=r%2===0?0:bW/2;
      for(let c=-1;c<BLD_W/bW+1;c++){
        const bx=BLD_X+c*bW+off,by2=BLD_Y+r*bH;
        ctx.strokeStyle=P.bldEdge; ctx.lineWidth=Math.max(1,SCALE*0.6);
        ctx.strokeRect(bx+.5,by2+.5,bW-1,bH-1);
        ctx.fillStyle=P.bldWallH; ctx.fillRect(bx+1,by2+1,bW*0.4,1);
        ctx.fillStyle=P.bldWallD; ctx.fillRect(bx+1,by2+bH-2,bW-2,1);
      }
    }
    px(BLD_X,BLD_Y,SCALE*1.5,BLD_H,P.bldEdge);
    px(BLD_X+BLD_W-SCALE*1.5,BLD_Y,SCALE*1.5,BLD_H,P.bldEdge);
    for(let r=0;r<=ROWS;r++){
      const ly=BLD_Y+r*FLOOR_H,lh=Math.max(3,SCALE*1.5);
      px(BLD_X-SCALE,ly,BLD_W+SCALE*2,lh,P.ledge);
      px(BLD_X-SCALE,ly,BLD_W+SCALE*2,lh*0.4,P.ledgeH);
      px(BLD_X-SCALE,ly+lh,BLD_W+SCALE*2,lh*0.5,P.ledgeD);
    }
  }

  // ── DRAW: Window ───────────────────────────────────────────
  function drawWindow(win){
    const rr=winRect(win.row,win.col),{x,y,w,h}=rr,s=SCALE;
    if(win.broken){
      px(x-s,y-s,w+s*2,h+s*2,P.winFrame);
      px(x,y,w,h,P.winBroken);
      ctx.strokeStyle=P.winCrack; ctx.lineWidth=Math.max(1,s*0.6);
      [[0.2,0.1,0.7,0.9],[0.8,0.15,0.3,0.85],[0.5,0,0.3,0.5],[0.1,0.6,0.9,0.4]].forEach(([x1,y1,x2,y2])=>{
        ctx.beginPath(); ctx.moveTo(x+w*x1,y+h*y1); ctx.lineTo(x+w*x2,y+h*y2); ctx.stroke();
      });
      ctx.fillStyle='#3d4a5a33';
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+w*0.35,y+h*0.3);
      ctx.lineTo(x+w*0.1,y+h*0.6); ctx.lineTo(x,y+h); ctx.closePath(); ctx.fill();
      drawRescue(win);
    } else {
      px(x-s,y-s,w+s*2,h+s*2,P.winFrame);
      px(x-s*0.5,y-s*0.5,w+s,h+s,P.winFrameH);
      const pw=(w-s*3)/2,ph=(h-s*3)/2;
      [[x+s,y+s],[x+s*2+pw,y+s],[x+s,y+s*2+ph],[x+s*2+pw,y+s*2+ph]].forEach(([px2,py2])=>{
        px(px2,py2,pw,ph,P.winGlass);
        ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.fillRect(px2+2,py2+2,pw*0.4,ph*0.35);
        ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(px2+2,py2+2,pw*0.15,ph);
        ctx.fillStyle=P.winGlassD+'55'; ctx.fillRect(px2,py2+ph*0.7,pw,ph*0.3);
      });
      ctx.fillStyle='rgba(200,160,100,0.25)';
      ctx.fillRect(x+s,y+s,pw*0.6,ph*2+s); ctx.fillRect(x+s*2+pw+pw*0.4,y+s,pw*0.6,ph*2+s);
    }
    if(win.repairing){
      const prog=1-felix.repairTimer/diff.repairTime;
      ctx.strokeStyle=P.gold; ctx.lineWidth=s*1.5; ctx.strokeRect(x-s,y-s,w+s*2,h+s*2);
      ctx.strokeStyle=P.winFixed; ctx.lineWidth=s*2;
      ctx.beginPath(); ctx.arc(x+w/2,y+h/2,Math.min(w,h)*0.35,-Math.PI/2,-Math.PI/2+prog*Math.PI*2); ctx.stroke();
    }
    if(win.flashTimer>0){ ctx.fillStyle=`rgba(0,184,148,${win.flashTimer/15*0.5})`; ctx.fillRect(x,y,w,h); }
  }

  // ── DRAW: Felix ────────────────────────────────────────────
  function drawFelix(){
    const bx=Math.round(felix.x),by=Math.round(felix.y),s=SCALE,d=felix.dir;
    const walk=Math.floor(felix.walkAnim/2)%4,rep=felix.repairing;
    if(felix.invincible>0&&Math.floor(frameCount/4)%2===0) return;
    const fh=WIN_H*1.1,fw=fh*0.75;
    ctx.fillStyle='rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(bx+fw/2,by+fh+2,fw*0.4,s*0.8,0,0,Math.PI*2); ctx.fill();
    const bootW=fw*0.25,bootH=fh*0.15;
    px(bx+fw*0.05,by+fh-bootH,bootW,bootH,P.felixBoot);
    px(bx+fw*0.55,by+fh-bootH,bootW,bootH,P.felixBoot);
    const legH=fh*0.28;
    px(bx+fw*0.08,by+fh-bootH-legH,fw*0.35,legH,P.felixOverall);
    px(bx+fw*0.55,by+fh-bootH-legH,fw*0.35,legH,P.felixOverall);
    if(!rep&&(walk===1||walk===3)){ ctx.fillStyle=P.felixOverallD; ctx.fillRect(bx+fw*(walk===1?.08:.55),by+fh-bootH-legH*0.6,fw*0.35,legH*0.35); }
    const bodyY=by+fh*0.42,bodyH=fh*0.38;
    px(bx+fw*0.05,bodyY,fw*0.9,bodyH,P.felixBody);
    px(bx+fw*0.05,bodyY,fw*0.9,bodyH*0.3,P.felixBodyD);
    px(bx+fw*0.25,bodyY,fw*0.5,bodyH*0.7,P.felixOverall);
    px(bx+fw*0.2,bodyY-fh*0.05,fw*0.08,bodyH*0.3,P.felixOverall);
    px(bx+fw*0.72,bodyY-fh*0.05,fw*0.08,bodyH*0.3,P.felixOverall);
    const armY=bodyY+bodyH*0.1,armW=fw*0.14,armH=bodyH*0.55;
    if(rep&&d>0) px(bx+fw*0.82,armY-armH*0.3,armW,armH*0.6,P.felixBody);
    else if(rep&&d<0) px(bx-fw*0.1,armY-armH*0.3,armW,armH*0.6,P.felixBody);
    else { const sw=Math.sin(felix.walkAnim*0.4)*3; px(bx-fw*0.05,armY+sw,armW,armH,P.felixBody); px(bx+fw*0.85,armY-sw,armW,armH,P.felixBody); }
    const headW=fw*0.6,headH=fh*0.25,headX=bx+(fw-headW)/2,headY=by+fh*0.14;
    px(headX,headY,headW,headH,P.felixSkin);
    ctx.fillStyle='#ffb8a0';
    ctx.fillRect(headX+2,headY+headH*0.55,headW*0.18,headH*0.25);
    ctx.fillRect(headX+headW-headW*0.18-2,headY+headH*0.55,headW*0.18,headH*0.25);
    const ey=headY+headH*0.28;
    ctx.fillStyle='#2d3436'; ctx.fillRect(headX+headW*0.18,ey,headW*0.2,headH*0.3); ctx.fillRect(headX+headW*0.62,ey,headW*0.2,headH*0.3);
    ctx.fillStyle='#fff'; ctx.fillRect(headX+headW*0.18+2,ey+1,2,2); ctx.fillRect(headX+headW*0.62+2,ey+1,2,2);
    ctx.strokeStyle='#c0392b'; ctx.lineWidth=Math.max(1,s*0.5);
    ctx.beginPath(); ctx.arc(headX+headW/2,headY+headH*0.65,headW*0.2,0.1,Math.PI-0.1); ctx.stroke();
    const hatW=headW*1.15,hatH=fh*0.14,hatX=headX-headW*0.08;
    px(hatX,headY-hatH,hatW,hatH,P.felixHat);
    px(hatX-hatW*0.05,headY-hatH*0.35,hatW*1.1,hatH*0.35,P.felixHat);
    px(hatX,headY-hatH,hatW,hatH*0.3,P.felixHatB);
    ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(hatX+hatW*0.1,headY-hatH+2,hatW*0.3,hatH*0.3);
    if(rep){
      ctx.save(); ctx.translate(bx+(d>0?fw*1.0:-fw*0.1),bodyY+bodyH*0.1);
      ctx.rotate((1-felix.repairTimer/diff.repairTime)*Math.PI*0.6*d);
      px(-fw*0.05,-bodyH*0.5,fw*0.1,bodyH*0.55,P.hammerHandle);
      px(-fw*0.2,-bodyH*0.6,fw*0.4,bodyH*0.22,P.hammerHead);
      ctx.restore();
    }
  }

  // ── DRAW: Ralph ────────────────────────────────────────────
  function drawRalph(){
    const x=Math.round(ralph.x),y=Math.round(RALPH_Y),rw=WIN_W*0.8,rh=WIN_H*1.4;
    ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x+rw/2,y+rh+3,rw*0.4,SCALE*0.8,0,0,Math.PI*2); ctx.fill();
    px(x+rw*0.06,y+rh-rh*0.1,rw*0.3,rh*0.1,P.felixBoot); px(x+rw*0.58,y+rh-rh*0.1,rw*0.3,rh*0.1,P.felixBoot);
    px(x+rw*0.1,y+rh*0.6,rw*0.35,rh*0.32,P.ralphPant); px(x+rw*0.55,y+rh*0.6,rw*0.35,rh*0.32,P.ralphPant);
    px(x,y+rh*0.58,rw,rh*0.06,P.ralphPantD);
    const bY=y+rh*0.25,bH=rh*0.38;
    px(x,bY,rw,bH,P.ralphShirt); px(x,bY,rw,bH*0.25,P.ralphShirtD);
    const aW=rw*0.2,aH=bH*0.7,ta=ralph.armRaise>0?Math.sin(ralph.armRaise*0.3):0;
    px(x-aW*0.7,bY+bH*0.1+ta*4,aW,aH,P.ralphShirt);
    const ro=ralph.armRaise>0?-bH*0.4:0;
    px(x+rw*0.8,bY+bH*0.1+ro,aW,aH*(ralph.armRaise>0?.6:1),P.ralphShirt);
    circle(x-aW*0.2,bY+bH*0.1+aH+ta*4,aW*0.5,P.ralphSkin);
    circle(x+rw*0.9,bY+bH*0.1+ro+aH*(ralph.armRaise>0?.6:1),aW*0.5,P.ralphSkin);
    const hw=rw*0.75,hh=rh*0.28,hx=x+(rw-hw)/2,hy=y;
    px(hx,hy,hw,hh,P.ralphSkin); px(hx,hy,hw,hh*0.3,P.ralphSkinD);
    px(hx,hy,hw,hh*0.25,P.ralphHair);
    ctx.fillStyle=P.ralphHair;
    for(let i=0;i<5;i++) ctx.fillRect(hx+i*(hw/5),hy-hh*0.12,hw/5*0.8,hh*0.15);
    const ey=hy+hh*0.35,an=ralph.angry>0;
    ctx.fillStyle='#2d3436'; ctx.fillRect(hx+hw*0.15,ey,hw*0.25,hh*0.25); ctx.fillRect(hx+hw*0.6,ey,hw*0.25,hh*0.25);
    if(an){ ctx.strokeStyle=P.ralphHair; ctx.lineWidth=Math.max(2,SCALE*0.8);
      ctx.beginPath(); ctx.moveTo(hx+hw*0.12,ey-hh*0.1); ctx.lineTo(hx+hw*0.4,ey-hh*0.02); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx+hw*0.88,ey-hh*0.1); ctx.lineTo(hx+hw*0.6,ey-hh*0.02); ctx.stroke(); }
    ctx.strokeStyle=an?'#c0392b':'#6d4c41'; ctx.lineWidth=Math.max(1,SCALE*0.5);
    ctx.beginPath();
    if(an) ctx.arc(hx+hw/2,hy+hh*0.78,hw*0.18,Math.PI,Math.PI*2-.1);
    else { ctx.moveTo(hx+hw*0.3,hy+hh*0.75); ctx.lineTo(hx+hw*0.7,hy+hh*0.75); }
    ctx.stroke();
    if(ralph.armRaise>20) drawBrickAt(x+rw*0.85,bY+bH*0.1+ro-rh*0.1,rw*0.2,rh*0.13,0,0);
  }

  function drawBrickAt(x,y,w,h,rot,type){
    ctx.save(); ctx.translate(x+w/2,y+h/2); ctx.rotate(rot);
    const cols=[[P.brickRed,P.brickRedD,P.brickRedH],[P.bldWall,P.bldWallD,P.bldWallH],['#7f8c8d','#636e72','#95a5a6']];
    const [c,cd,ch]=cols[type%3];
    px(-w/2,-h/2,w,h,c); px(-w/2,-h/2,w,h*0.3,ch); px(-w/2,h/2-h*0.25,w,h*0.25,cd);
    ctx.strokeStyle=P.brickMortar+'88'; ctx.lineWidth=1;
    ctx.strokeRect(-w/2+.5,-h/2+.5,w-1,h-1);
    ctx.beginPath(); ctx.moveTo(0,-h/2); ctx.lineTo(0,h/2); ctx.stroke();
    ctx.restore();
  }

  function drawBricks(){
    const bw=WIN_W*0.3,bh=WIN_H*0.22;
    for(const b of bricks){
      ctx.fillStyle='rgba(0,0,0,0.2)';
      ctx.save(); ctx.translate(b.x+bw/2+4,b.y+bh/2+4); ctx.rotate(b.rot); ctx.fillRect(-bw/2,-bh/2,bw,bh); ctx.restore();
      drawBrickAt(b.x,b.y,bw,bh,b.rot,b.type);
    }
  }

  function drawParticles(){
    for(const p of particles){ ctx.globalAlpha=p.life/p.maxLife; ctx.fillStyle=p.color; ctx.fillRect(Math.round(p.x-p.size/2),Math.round(p.y-p.size/2),p.size,p.size); }
    ctx.globalAlpha=1;
    for(const sp of sparkles){ const a=sp.life/sp.maxLife; ctx.globalAlpha=a; const sz=sp.size*a; ctx.fillStyle=P.gold; ctx.save(); ctx.translate(sp.x,sp.y); ctx.rotate(sp.life*0.2); ctx.fillRect(-sz/2,-sz/2,sz,sz); ctx.restore(); }
    ctx.globalAlpha=1;
  }

  function drawBackground(){
    const g=ctx.createLinearGradient(0,0,0,BLD_Y); g.addColorStop(0,P.sky1); g.addColorStop(1,P.sky2);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    circle(W*0.82,H*0.08,W*0.045,P.moon); circle(W*0.82+W*0.045*0.35,H*0.08-W*0.045*0.15,W*0.045*0.7,P.sky1);
    for(const st of stars){ st.t+=st.s; ctx.globalAlpha=0.5+Math.sin(st.t)*0.5; ctx.fillStyle=P.star; ctx.fillRect(Math.round(st.x),Math.round(st.y),Math.ceil(st.r),Math.ceil(st.r)); }
    ctx.globalAlpha=1;
    ctx.fillStyle='#0d0d20'; const cw=W/10;
    for(let i=0;i<10;i++){ const ch=20+Math.sin(i*1.7)*15+Math.cos(i*2.3)*10; ctx.fillRect(i*cw-2,BLD_Y-ch,cw+2,ch); }
    px(0,BLD_Y+BLD_H,W,H-(BLD_Y+BLD_H),P.ground);
    px(0,BLD_Y+BLD_H,W,4,P.groundH); px(0,BLD_Y+BLD_H+4,W,6,P.groundD);
    for(let i=0;i<W;i+=30){ ctx.fillStyle=P.dirt; ctx.fillRect(i,BLD_Y+BLD_H+2,2,2); }
  }

  function drawFrame(){
    ctx.save();
    if(screenShake>0){ ctx.translate((Math.random()-.5)*screenShake,(Math.random()-.5)*screenShake); screenShake=Math.max(0,screenShake-.5); }
    drawBackground(); drawBuilding();
    for(const w of windows) drawWindow(w);
    drawRalph(); drawBricks(); drawFelix(); drawParticles();
    if(state==='levelcomplete'){
      const t=1-lvlTimer/120;
      ctx.globalAlpha=Math.min(1,t*3);
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,H/2-55,W,110);
      ctx.fillStyle=P.gold; ctx.font=`bold ${Math.round(W*0.07)}px 'Courier New'`; ctx.textAlign='center';
      ctx.fillText('¡NIVEL COMPLETADO!',W/2,H/2-10);
      ctx.fillStyle='#fff'; ctx.font=`${Math.round(W*0.04)}px 'Courier New'`;
      ctx.fillText(`Nivel ${level+1} — ¡Más difícil!`,W/2,H/2+20);
      ctx.globalAlpha=1; ctx.textAlign='left';
    }
    // Level label (first 3s)
    if(state==='playing'&&frameCount<180){
      const a=Math.max(0,1-frameCount/180);
      ctx.globalAlpha=a; ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(W/2-90,8,180,32);
      ctx.fillStyle=P.gold; ctx.font=`bold ${Math.round(W*0.036)}px 'Courier New'`; ctx.textAlign='center';
      const lbl=level<=2?'¡FÁCIL!':level<=4?'NORMAL':level<=6?'DIFÍCIL':'¡EXPERTO!';
      ctx.fillText(`NIVEL ${level} · ${lbl}`,W/2,28); ctx.globalAlpha=1; ctx.textAlign='left';
    }
    ctx.restore();
  }

  // ── Update ────────────────────────────────────────────────
  function update(){
    frameCount++;
    if(state==='playing'){
      if(ralph.armRaise>0) ralph.armRaise--; if(ralph.angry>0) ralph.angry--;
      if(--throwTimer<=0){ throwBrick(); throwTimer=diff.throwInterval; }
      if(--breakTimer<=0){ if(Math.random()<0.45) breakRandom(diff.breakCount); breakTimer=diff.breakInterval; }
      if(felix.repairing&&--felix.repairTimer<=0){
        felix.repairing=false;
        const w=windows.find(ww=>ww.row===felix.row&&ww.col===felix.col);
        if(w&&w.broken){ w.broken=false;w.repairing=false;w.flashTimer=15;
          const r=winRect(w.row,w.col); spawnSparkles(r.x+r.w/2,r.y+r.h/2); spawnParticles(r.x+r.w/2,r.y+r.h/2,P.gold,10,2.5);
          score+=50*level; updateHUD(); sfxRepaired(); }
      }
      const bw=WIN_W*0.3,bh=WIN_H*0.22;
      for(const b of bricks){ b.x+=b.vx;b.y+=b.vy;b.vy+=0.12;b.rot+=b.rotV; }
      bricks=bricks.filter(b=>b.y<H+40);
      if(felix.invincible>0) felix.invincible--;
      if(felix.invincible===0){
        const fh=WIN_H*1.1,fw=fh*0.75;
        for(let i=bricks.length-1;i>=0;i--){
          const b=bricks[i];
          if(b.x<felix.x+fw*0.9&&b.x+bw>felix.x+fw*0.1&&b.y<felix.y+fh&&b.y+bh>felix.y){
            bricks.splice(i,1); lives--; screenShake=8;
            spawnParticles(felix.x+fw/2,felix.y+fh/2,'#e74c3c',20,4); spawnSmoke(felix.x+fw/2,felix.y+fh/2,8);
            felix.invincible=90; felix.repairing=false;
            const w2=windows.find(ww=>ww.row===felix.row&&ww.col===felix.col); if(w2) w2.repairing=false;
            updateHUD(); sfxHit();
            if(lives<=0){ state='gameover'; stopMusic(); sfxGameOver(); showOverlay('gameover'); }
            break;
          }
        }
      }
      for(const p of particles){ p.x+=p.vx;p.y+=p.vy;p.vy+=p.gravity;p.life--;p.vx*=0.96; }
      particles=particles.filter(p=>p.life>0);
      for(const sp of sparkles){ sp.x+=sp.vx;sp.y+=sp.vy;sp.vy+=0.08;sp.life--; }
      sparkles=sparkles.filter(sp=>sp.life>0);
      for(const w of windows){ if(w.flashTimer>0) w.flashTimer--; }
      if(allFixed()){ state='levelcomplete'; lvlTimer=120; score+=200*level; updateHUD(); sfxLevelUp(); stopMusic(); }
    }
    if(state==='levelcomplete'){
      lvlTimer--;
      for(let i=0;i<3;i++) spawnParticles(Math.random()*W,Math.random()*H*0.5,[P.gold,'#e74c3c','#74b9ff','#00b894'][Math.floor(Math.random()*4)],2,2);
      for(const p of particles){ p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.life--; } particles=particles.filter(p=>p.life>0);
      if(lvlTimer<=0){ level++; startLevel(); startMusic(); }
    }
  }

  function showOverlay(type){
    const ov=document.getElementById('overlay'); ov.classList.remove('hidden');
    if(type==='gameover'){
      ov.innerHTML=`<div style="font-size:42px;">💀</div><div class="overlay-title" style="color:#e74c3c;text-shadow:0 0 20px #e74c3c,2px 2px 0 #8e1111;">GAME OVER</div><div class="overlay-score">Puntos: ${String(score).padStart(6,'0')}</div><div class="overlay-sub">Nivel alcanzado: ${level}</div><button class="overlay-btn" id="startBtn">↺ REINICIAR</button>`;
      document.getElementById('startBtn').onclick=startGame;
    }
  }

  const keys={};
  document.addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
    if(keys[e.code]) return; keys[e.code]=true;
    if(state==='playing'){
      if(e.code==='ArrowLeft')  felixMove(0,-1);
      if(e.code==='ArrowRight') felixMove(0, 1);
      if(e.code==='ArrowUp')    felixMove(-1,0);
      if(e.code==='ArrowDown')  felixMove( 1,0);
      if(e.code==='Space')      felixRepair();
    }
  });
  document.addEventListener('keyup',e=>{ keys[e.code]=false; });

  function setupBtn(id,fn){
    const el=document.getElementById(id); if(!el) return;
    let held=false;
    const down=()=>{ if(!held){ held=true; el.classList.add('pressed'); fn(); } };
    const up=()=>{ held=false; el.classList.remove('pressed'); };
    el.addEventListener('touchstart',e=>{ e.preventDefault(); down(); },{passive:false});
    el.addEventListener('touchend',  e=>{ e.preventDefault(); up();   },{passive:false});
    el.addEventListener('mousedown', down); el.addEventListener('mouseup', up);
  }
  setupBtn('btnLeft',  ()=>{ if(state==='playing') felixMove(0,-1); });
  setupBtn('btnRight', ()=>{ if(state==='playing') felixMove(0, 1); });
  setupBtn('btnUp',    ()=>{ if(state==='playing') felixMove(-1,0); });
  setupBtn('btnDown',  ()=>{ if(state==='playing') felixMove( 1,0); });
  setupBtn('repair-btn',()=>{ if(state==='playing') felixRepair(); });

  document.getElementById('startBtn')?.addEventListener('click', startGame);

  function loop(){ update(); drawFrame(); requestAnimationFrame(loop); }
  resize(); layoutGame(); initStars(); loop();

})();
