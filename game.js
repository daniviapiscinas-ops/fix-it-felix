// ============================================================
//  Fix-It Felix Jr.  —  game.js
//  Pixel-art renderer · Touch controls · Mobile-first
// ============================================================

(function () {
  'use strict';

  // ── Canvas setup ──────────────────────────────────────────
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

  // ── Game constants (computed after resize) ────────────────
  const ROWS = 5, COLS = 4;
  let BLD_X, BLD_Y, BLD_W, BLD_H;
  let WIN_W, WIN_H, WIN_PAD_X, WIN_PAD_Y, FLOOR_H;
  let RALPH_Y;

  function layoutGame() {
    const margin = W * 0.06;
    BLD_X = margin;
    BLD_W = W - margin * 2;
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

  // ── Palette ───────────────────────────────────────────────
  const P = {
    sky1:'#0a0a1a', sky2:'#0f0f2e',
    star:'#ffffff',
    cloud:'#c8d6e5',
    bldWall:'#8b4513', bldWallD:'#6b3410', bldWallH:'#a0522d',
    bldEdge:'#5d2f0a',
    ledge:'#bdc3c7', ledgeD:'#95a5a6', ledgeH:'#dfe6e9',
    winFrame:'#2c3e50', winFrameH:'#34495e',
    winGlass:'#74b9ff', winGlassD:'#0984e3', winGlassH:'#a4d4ff',
    winBroken:'#2d2d2d', winCrack:'#555',
    winFixed:'#00b894',
    brickRed:'#e74c3c', brickRedD:'#c0392b', brickRedH:'#ff6b6b',
    brickMortar:'#d4c5b0',
    felixSkin:'#ffeaa7', felixSkinD:'#fdcb6e',
    felixHat:'#e74c3c', felixHatB:'#c0392b',
    felixBody:'#3498db', felixBodyD:'#2980b9',
    felixOverall:'#f39c12', felixOverallD:'#d68910',
    felixBoot:'#2d3436',
    hammerHead:'#b2bec3', hammerHandle:'#795548',
    gold:'#f1c40f', goldD:'#d4ac0d',
    ralphSkin:'#e8a87c', ralphSkinD:'#d4956a',
    ralphShirt:'#e74c3c', ralphShirtD:'#c0392b',
    ralphPant:'#795548', ralphPantD:'#6d4c41',
    ralphHair:'#3d2b1f',
    sparkle:'#fff9c4',
    smoke:'#636e72',
    ground:'#4a3728', groundD:'#3d2b1f', groundH:'#5d4037',
    dirt:'#6d4c41',
    nightSky1:'#1a1a2e', nightSky2:'#16213e',
    moon:'#ffeaa7',
  };

  // ── Pixel drawing helpers ──────────────────────────────────
  function px(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
  }

  function pxLine(x1, y1, x2, y2, color, lw = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // ── Game state ────────────────────────────────────────────
  let state = 'start';
  let score = 0, lives = 3, level = 1;
  let frameCount = 0;
  let windows = [], bricks = [], particles = [], sparkles = [];
  let throwTimer = 0, windowBreakTimer = 0;
  let levelCompleteTimer = 0;
  let screenShake = 0;
  let stars = [];

  let felix = {
    x:0, y:0, row:4, col:0, dir:1,
    repairing:false, repairTimer:0,
    invincible:0, walkAnim:0,
    jumpY:0, jumping:false, jumpTimer:0,
    repairFlash:0
  };

  let ralph = {
    x:0, throwAnim:0, throwTimer:0,
    armRaise:0, angry:0
  };

  // ── Stars ─────────────────────────────────────────────────
  function initStars() {
    stars = [];
    for (let i = 0; i < 60; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * (BLD_Y),
        r: Math.random() * 1.5 + 0.3,
        twinkle: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.03
      });
    }
  }

  // ── Window positions ──────────────────────────────────────
  function winRect(row, col) {
    const x = BLD_X + WIN_PAD_X + col * (WIN_W + WIN_PAD_X);
    const y = BLD_Y + WIN_PAD_Y + row * FLOOR_H;
    return { x, y, w: WIN_W, h: WIN_H };
  }

  // ── Felix position (stands below his window) ──────────────
  function felixTarget(row, col) {
    const r = winRect(row, col);
    const fh = WIN_H * 1.1;
    return {
      x: r.x + r.w / 2 - (fh * 0.4),
      y: r.y + r.h
    };
  }

  // ── Init windows ─────────────────────────────────────────
  function initWindows() {
    windows = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        windows.push({ row:r, col:c, broken:false, repaired:false, repairing:false, flashTimer:0 });
  }

  function breakRandom(n = 1) {
    const intact = windows.filter(w => !w.broken);
    for (let i = 0; i < n && intact.length > 0; i++) {
      const idx = Math.floor(Math.random() * intact.length);
      const w = intact.splice(idx, 1)[0];
      w.broken = true;
      const r = winRect(w.row, w.col);
      spawnSmoke(r.x + r.w / 2, r.y + r.h / 2, 6);
    }
  }

  function allFixed() {
    return windows.every(w => !w.broken);
  }

  // ── Reset ─────────────────────────────────────────────────
  function resetFelix() {
    felix.row = 4; felix.col = 0;
    const pos = felixTarget(felix.row, felix.col);
    felix.x = pos.x; felix.y = pos.y;
    felix.repairing = false; felix.repairTimer = 0;
    felix.invincible = 0; felix.walkAnim = 0;
    felix.jumping = false; felix.jumpY = 0;
  }

  function startLevel() {
    state = 'playing';
    bricks = []; particles = []; sparkles = [];
    initWindows(); resetFelix();
    layoutGame(); initStars();
    const initialBreaks = 2 + level;
    breakRandom(Math.min(initialBreaks, ROWS * COLS - 2));
    throwTimer = 90;
    windowBreakTimer = 200;
    ralph.x = BLD_X + BLD_W / 2 - W * 0.06;
    ralph.armRaise = 0; ralph.angry = 0;
    document.getElementById('overlay').classList.add('hidden');
    updateHUD();
  }

  function startGame() {
    score = 0; lives = 3; level = 1;
    startLevel();
  }

  // ── HUD ──────────────────────────────────────────────────
  function updateHUD() {
    document.getElementById('scoreEl').textContent = String(score).padStart(6, '0');
    document.getElementById('levelEl').textContent = String(level).padStart(2, '0');
    const icons = document.getElementById('livesEl');
    icons.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('div');
      d.className = 'life-icon' + (i >= lives ? ' empty' : '');
      icons.appendChild(d);
    }
  }

  // ── Particles ─────────────────────────────────────────────
  function spawnParticles(x, y, color, n, power = 3) {
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() + 0.5) * power;
      particles.push({
        x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - power * 0.5,
        life: 30 + Math.random() * 20, maxLife: 50,
        color, size: 2 + Math.random() * 3, gravity: 0.18
      });
    }
  }

  function spawnSparkles(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      sparkles.push({
        x, y, vx: Math.cos(angle) * 2.5, vy: Math.sin(angle) * 2.5 - 1,
        life: 25, maxLife: 25, size: WIN_W * 0.07
      });
    }
  }

  function spawnSmoke(x, y, n = 4) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: x + (Math.random()-0.5)*8, y,
        vx: (Math.random()-0.5)*1.5, vy: -1-Math.random()*1.5,
        life: 40, maxLife: 40,
        color: P.smoke, size: 3+Math.random()*4, gravity: -0.02
      });
    }
  }

  // ── Brick throw ───────────────────────────────────────────
  function throwBrick() {
    ralph.armRaise = 1; ralph.angry = 60;
    const target = felixTarget(felix.row, felix.col);
    const bx = ralph.x + WIN_W * 0.3 + Math.random() * WIN_W * 0.4;
    const by = RALPH_Y + WIN_H * 0.5;
    const spd = 2.8 + level * 0.25;
    const dx = target.x - bx, dy = target.y - by;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    const vx = (dx / dist) * spd * (0.7 + Math.random() * 0.6);
    const vy = (dy / dist) * spd;
    bricks.push({
      x: bx, y: by, vx, vy: Math.min(vy, -0.5),
      rot: 0, rotV: (Math.random()-0.5) * 0.15,
      type: Math.floor(Math.random() * 3)
    });
  }

  // ── Felix actions ─────────────────────────────────────────
  function felixMove(dr, dc) {
    if (state !== 'playing' || felix.repairing || felix.jumping) return;
    const nr = felix.row + dr, nc = felix.col + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
    felix.row = nr; felix.col = nc;
    if (dc !== 0) felix.dir = dc;
    const pos = felixTarget(nr, nc);
    felix.x = pos.x; felix.y = pos.y;
    felix.walkAnim++;
  }

  function felixRepair() {
    if (state !== 'playing' || felix.repairing) return;
    const w = windows.find(ww => ww.row === felix.row && ww.col === felix.col);
    if (w && w.broken) {
      felix.repairing = true;
      felix.repairTimer = 45;
      w.repairing = true;
    }
  }

  // ── Pixel-art sprite renderers ────────────────────────────

  function drawBuilding() {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(BLD_X + 6, BLD_Y + 6, BLD_W, BLD_H);

    // Main wall with brick pattern
    px(BLD_X, BLD_Y, BLD_W, BLD_H, P.bldWall);

    // Brick pattern
    const brickW = BLD_W / 8, brickH = FLOOR_H / 3;
    for (let r = 0; r < BLD_H / brickH + 1; r++) {
      const offset = r % 2 === 0 ? 0 : brickW / 2;
      for (let c = -1; c < BLD_W / brickW + 1; c++) {
        const bx = BLD_X + c * brickW + offset;
        const by = BLD_Y + r * brickH;
        // Mortar lines
        ctx.strokeStyle = P.bldEdge;
        ctx.lineWidth = Math.max(1, SCALE * 0.6);
        ctx.strokeRect(bx + 0.5, by + 0.5, brickW - 1, brickH - 1);
        // Highlight top-left
        ctx.fillStyle = P.bldWallH;
        ctx.fillRect(bx + 1, by + 1, brickW * 0.4, 1);
        // Shadow bottom-right
        ctx.fillStyle = P.bldWallD;
        ctx.fillRect(bx + 1, by + brickH - 2, brickW - 2, 1);
      }
    }

    // Left/right edge shadow
    px(BLD_X, BLD_Y, SCALE * 1.5, BLD_H, P.bldEdge);
    px(BLD_X + BLD_W - SCALE * 1.5, BLD_Y, SCALE * 1.5, BLD_H, P.bldEdge);

    // Floor ledges
    for (let r = 0; r <= ROWS; r++) {
      const ly = BLD_Y + r * FLOOR_H;
      const lh = Math.max(3, SCALE * 1.5);
      px(BLD_X - SCALE, ly, BLD_W + SCALE * 2, lh, P.ledge);
      px(BLD_X - SCALE, ly, BLD_W + SCALE * 2, lh * 0.4, P.ledgeH);
      px(BLD_X - SCALE, ly + lh, BLD_W + SCALE * 2, lh * 0.5, P.ledgeD);
    }
  }

  function drawWindow(win) {
    const r = winRect(win.row, win.col);
    const { x, y, w, h } = r;
    const s = SCALE;

    if (win.broken) {
      // Frame
      px(x - s, y - s, w + s*2, h + s*2, P.winFrame);
      // Dark interior
      px(x, y, w, h, P.winBroken);
      // Crack lines
      ctx.strokeStyle = P.winCrack;
      ctx.lineWidth = Math.max(1, s * 0.6);
      ctx.beginPath(); ctx.moveTo(x + w*0.2, y + h*0.1); ctx.lineTo(x + w*0.7, y + h*0.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w*0.8, y + h*0.15); ctx.lineTo(x + w*0.3, y + h*0.85); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w*0.5, y); ctx.lineTo(x + w*0.3, y + h*0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w*0.1, y + h*0.6); ctx.lineTo(x + w*0.9, y + h*0.4); ctx.stroke();
      // Jagged glass shards
      ctx.fillStyle = '#3d4a5a44';
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w*0.35, y + h*0.3);
      ctx.lineTo(x + w*0.1, y + h*0.6); ctx.lineTo(x, y + h);
      ctx.closePath(); ctx.fill();
    } else {
      // Frame
      px(x - s, y - s, w + s*2, h + s*2, P.winFrame);
      px(x - s*0.5, y - s*0.5, w + s, h + s, P.winFrameH);

      // Glass panes (2x2 grid)
      const pw = (w - s*3) / 2, ph = (h - s*3) / 2;
      const panes = [
        [x + s, y + s], [x + s*2 + pw, y + s],
        [x + s, y + s*2 + ph], [x + s*2 + pw, y + s*2 + ph]
      ];
      for (const [px2, py2] of panes) {
        px(px2, py2, pw, ph, P.winGlass);
        // Reflection highlights
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(px2 + 2, py2 + 2, pw * 0.4, ph * 0.35);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(px2 + 2, py2 + 2, pw * 0.15, ph);
        // Bottom tint
        ctx.fillStyle = P.winGlassD + '55';
        ctx.fillRect(px2, py2 + ph * 0.7, pw, ph * 0.3);
      }

      // Curtain hint
      ctx.fillStyle = 'rgba(200,160,100,0.25)';
      ctx.fillRect(x + s, y + s, pw * 0.6, ph * 2 + s);
      ctx.fillRect(x + s*2 + pw + pw*0.4, y + s, pw * 0.6, ph * 2 + s);
    }

    // Repair glow
    if (win.repairing) {
      const prog = 1 - felix.repairTimer / 45;
      ctx.strokeStyle = P.gold;
      ctx.lineWidth = s * 1.5;
      ctx.strokeRect(x - s, y - s, w + s*2, h + s*2);
      // Progress arc
      ctx.strokeStyle = P.winFixed;
      ctx.lineWidth = s * 2;
      ctx.beginPath();
      ctx.arc(x + w/2, y + h/2, Math.min(w,h)*0.35, -Math.PI/2, -Math.PI/2 + prog * Math.PI * 2);
      ctx.stroke();
    }

    // Flash on repair complete
    if (win.flashTimer > 0) {
      ctx.fillStyle = `rgba(0,184,148,${win.flashTimer / 15 * 0.5})`;
      ctx.fillRect(x, y, w, h);
    }
  }

  function drawFelix() {
    const pos = felixTarget(felix.row, felix.col);
    const bx = Math.round(felix.x);
    const by = Math.round(felix.y + felix.jumpY);
    const s = SCALE;
    const d = felix.dir; // 1=right, -1=left
    const walk = Math.floor(felix.walkAnim / 2) % 4;
    const rep = felix.repairing;

    if (felix.invincible > 0 && Math.floor(frameCount / 4) % 2 === 0) return;

    const fh = WIN_H * 1.1;
    const fw = fh * 0.75;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(bx + fw/2, by + fh + 2, fw*0.4, s*0.8, 0, 0, Math.PI*2);
    ctx.fill();

    // Boots
    const bootW = fw * 0.25, bootH = fh * 0.15;
    px(bx + fw*0.05, by + fh - bootH, bootW, bootH, P.felixBoot);
    px(bx + fw*0.55, by + fh - bootH, bootW, bootH, P.felixBoot);
    // Boot shine
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(bx + fw*0.05 + 1, by + fh - bootH + 1, bootW*0.4, 1);

    // Legs / overalls
    const legH = fh * 0.28;
    px(bx + fw*0.08, by + fh - bootH - legH, fw*0.35, legH, P.felixOverall);
    px(bx + fw*0.55, by + fh - bootH - legH, fw*0.35, legH, P.felixOverall);
    // Walk anim
    if (!rep && (walk === 1 || walk === 3)) {
      ctx.fillStyle = P.felixOverallD;
      ctx.fillRect(bx + fw * (walk===1?0.08:0.55), by + fh - bootH - legH*0.6, fw*0.35, legH*0.35);
    }

    // Body (shirt)
    const bodyY = by + fh * 0.42;
    const bodyH = fh * 0.38;
    px(bx + fw*0.05, bodyY, fw*0.9, bodyH, P.felixBody);
    px(bx + fw*0.05, bodyY, fw*0.9, bodyH*0.3, P.felixBodyD);

    // Overall bib
    px(bx + fw*0.25, bodyY, fw*0.5, bodyH*0.7, P.felixOverall);
    // Overall straps
    px(bx + fw*0.2, bodyY - fh*0.05, fw*0.08, bodyH*0.3, P.felixOverall);
    px(bx + fw*0.72, bodyY - fh*0.05, fw*0.08, bodyH*0.3, P.felixOverall);

    // Arms
    const armY = bodyY + bodyH * 0.1;
    const armW = fw * 0.14, armH = bodyH * 0.55;
    if (rep && d > 0) {
      // Right arm raised for repair
      px(bx + fw*0.82, armY - armH*0.3, armW, armH*0.6, P.felixSkin);
      px(bx + fw*0.82, armY - armH*0.3, armW, armH*0.6, P.felixBody);
    } else if (rep && d < 0) {
      px(bx - fw*0.1, armY - armH*0.3, armW, armH*0.6, P.felixSkin);
      px(bx - fw*0.1, armY - armH*0.3, armW, armH*0.6, P.felixBody);
    } else {
      const armSwing = rep ? 0 : Math.sin(felix.walkAnim * 0.4) * 3;
      px(bx - fw*0.05, armY + armSwing, armW, armH, P.felixBody);
      px(bx + fw*0.85, armY - armSwing, armW, armH, P.felixBody);
    }

    // Head (skin)
    const headW = fw * 0.6, headH = fh * 0.25;
    const headX = bx + (fw - headW) / 2;
    const headY = by + fh * 0.14;
    px(headX, headY, headW, headH, P.felixSkin);
    // Cheek blush
    ctx.fillStyle = '#ffb8a0';
    ctx.fillRect(headX + 2, headY + headH*0.55, headW*0.18, headH*0.25);
    ctx.fillRect(headX + headW - headW*0.18 - 2, headY + headH*0.55, headW*0.18, headH*0.25);

    // Eyes
    const eyeY = headY + headH * 0.28;
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(headX + headW*0.18, eyeY, headW*0.2, headH*0.3);
    ctx.fillRect(headX + headW*0.62, eyeY, headW*0.2, headH*0.3);
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.fillRect(headX + headW*0.18 + 2, eyeY + 1, 2, 2);
    ctx.fillRect(headX + headW*0.62 + 2, eyeY + 1, 2, 2);
    // Smile
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = Math.max(1, s * 0.5);
    ctx.beginPath();
    ctx.arc(headX + headW/2, headY + headH*0.65, headW*0.2, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Hat
    const hatW = headW * 1.15, hatH = fh * 0.14;
    const hatX = headX - headW * 0.08;
    px(hatX, headY - hatH, hatW, hatH, P.felixHat);
    px(hatX - hatW*0.05, headY - hatH*0.35, hatW*1.1, hatH*0.35, P.felixHat);
    px(hatX, headY - hatH, hatW, hatH*0.3, P.felixHatB);
    // Hat shine
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(hatX + hatW*0.1, headY - hatH + 2, hatW*0.3, hatH*0.3);

    // Hammer
    if (rep) {
      const hammerDir = d;
      const hx = bx + (hammerDir > 0 ? fw * 1.0 : -fw * 0.5);
      const hy = bodyY - bodyH * 0.2;
      const repProg = felix.repairTimer / 45;
      const swingAngle = (1 - repProg) * (Math.PI * 0.6) * hammerDir;
      ctx.save();
      ctx.translate(hx + (hammerDir > 0 ? 0 : fw*0.4), hy + bodyH*0.3);
      ctx.rotate(swingAngle);
      // Handle
      px(-fw*0.05, -bodyH*0.5, fw*0.1, bodyH*0.55, P.hammerHandle);
      // Head
      px(-fw*0.2, -bodyH*0.6, fw*0.4, bodyH*0.22, P.hammerHead);
      px(-fw*0.2, -bodyH*0.6, fw*0.4, bodyH*0.08, P.ledgeH);
      ctx.restore();
    }
  }

  function drawRalph() {
    const x = Math.round(ralph.x);
    const y = Math.round(RALPH_Y);
    const s = SCALE;
    const rw = WIN_W * 0.8;
    const rh = WIN_H * 1.4;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + rw/2, y + rh + 3, rw*0.4, s*0.8, 0, 0, Math.PI*2);
    ctx.fill();

    // Boots
    const bw = rw * 0.3, bh = rh * 0.1;
    px(x + rw*0.06, y + rh - bh, bw, bh, P.felixBoot);
    px(x + rw*0.58, y + rh - bh, bw, bh, P.felixBoot);

    // Pants
    px(x + rw*0.1, y + rh*0.6, rw*0.35, rh*0.32, P.ralphPant);
    px(x + rw*0.55, y + rh*0.6, rw*0.35, rh*0.32, P.ralphPant);
    px(x, y + rh*0.58, rw, rh*0.06, P.ralphPantD);

    // Body
    const bodyY = y + rh * 0.25;
    const bodyH2 = rh * 0.38;
    px(x, bodyY, rw, bodyH2, P.ralphShirt);
    px(x, bodyY, rw, bodyH2*0.25, P.ralphShirtD);

    // Arms - one raised (throwing) based on armRaise
    const armW = rw * 0.2, armH = bodyH2 * 0.7;
    const throwAnim = ralph.armRaise > 0 ? Math.sin(ralph.armRaise * 0.3) : 0;
    // Left arm
    px(x - armW * 0.7, bodyY + bodyH2*0.1 + throwAnim*4, armW, armH, P.ralphShirt);
    // Right arm (throwing arm - raised)
    const raiseOff = ralph.armRaise > 0 ? -bodyH2*0.4 : 0;
    px(x + rw*0.8, bodyY + bodyH2*0.1 + raiseOff, armW, armH * (ralph.armRaise>0?0.6:1), P.ralphShirt);
    // Hands/fists
    circle(x - armW*0.2, bodyY + bodyH2*0.1 + armH + throwAnim*4, armW*0.5, P.ralphSkin);
    circle(x + rw*0.9, bodyY + bodyH2*0.1 + raiseOff + armH*(ralph.armRaise>0?0.6:1), armW*0.5, P.ralphSkin);

    // Head
    const hw = rw * 0.75, hh = rh * 0.28;
    const hx = x + (rw - hw) / 2;
    const hy = y + rh * 0.0;
    px(hx, hy, hw, hh, P.ralphSkin);
    px(hx, hy, hw, hh*0.3, P.ralphSkinD);

    // Hair (dark messy)
    px(hx, hy, hw, hh*0.25, P.ralphHair);
    ctx.fillStyle = P.ralphHair;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(hx + i*(hw/5), hy - hh*0.12, hw/5 * 0.8, hh * 0.15);
    }

    // Eyes - angry/normal
    const eyeY2 = hy + hh * 0.35;
    const angry = ralph.angry > 0;
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(hx + hw*0.15, eyeY2, hw*0.25, hh*0.25);
    ctx.fillRect(hx + hw*0.6, eyeY2, hw*0.25, hh*0.25);
    if (angry) {
      // Angry eyebrows
      ctx.strokeStyle = P.ralphHair;
      ctx.lineWidth = Math.max(2, s * 0.8);
      ctx.beginPath(); ctx.moveTo(hx + hw*0.12, eyeY2 - hh*0.1); ctx.lineTo(hx + hw*0.4, eyeY2 - hh*0.02); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx + hw*0.88, eyeY2 - hh*0.1); ctx.lineTo(hx + hw*0.6, eyeY2 - hh*0.02); ctx.stroke();
    }
    // Mouth
    if (ralph.angry > 0) {
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = Math.max(1, s * 0.5);
      ctx.beginPath();
      ctx.arc(hx + hw/2, hy + hh*0.78, hw*0.18, Math.PI, Math.PI*2 - 0.1);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = Math.max(1, s * 0.5);
      ctx.beginPath(); ctx.moveTo(hx + hw*0.3, hy + hh*0.75); ctx.lineTo(hx + hw*0.7, hy + hh*0.75); ctx.stroke();
    }

    // Brick in hand when throwing
    if (ralph.armRaise > 20) {
      const brickX = x + rw * 0.85;
      const brickY2 = bodyY + bodyH2*0.1 + raiseOff - rh*0.1;
      drawBrickAt(brickX, brickY2, rw*0.2, rh*0.13, 0, 0);
    }
  }

  function drawBrickAt(x, y, w, h, rot, type) {
    ctx.save();
    ctx.translate(x + w/2, y + h/2);
    ctx.rotate(rot);
    const colors = [
      [P.brickRed, P.brickRedD, P.brickRedH],
      [P.bldWall, P.bldWallD, P.bldWallH],
      ['#7f8c8d', '#636e72', '#95a5a6']
    ];
    const [c, cd, ch] = colors[type % 3];
    px(-w/2, -h/2, w, h, c);
    px(-w/2, -h/2, w, h*0.3, ch);
    px(-w/2, h/2 - h*0.25, w, h*0.25, cd);
    // Mortar lines
    ctx.strokeStyle = P.brickMortar + '88';
    ctx.lineWidth = 1;
    ctx.strokeRect(-w/2 + 0.5, -h/2 + 0.5, w - 1, h - 1);
    ctx.beginPath(); ctx.moveTo(0, -h/2); ctx.lineTo(0, h/2); ctx.stroke();
    ctx.restore();
  }

  function drawBricks() {
    const bw = WIN_W * 0.3, bh = WIN_H * 0.22;
    for (const b of bricks) {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.save();
      ctx.translate(b.x + bw/2 + 4, b.y + bh/2 + 4);
      ctx.rotate(b.rot);
      ctx.fillRect(-bw/2, -bh/2, bw, bh);
      ctx.restore();
      drawBrickAt(b.x, b.y, bw, bh, b.rot, b.type);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size/2), Math.round(p.y - p.size/2), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const sp of sparkles) {
      const a = sp.life / sp.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = P.gold;
      // Draw star shape
      const sz = sp.size * a;
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(sp.life * 0.2);
      ctx.fillRect(-sz/2, -sz/2, sz, sz);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawBackground() {
    // Night sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, BLD_Y);
    grad.addColorStop(0, P.sky1);
    grad.addColorStop(1, P.sky2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Moon
    const moonX = W * 0.82, moonY = H * 0.08, moonR = W * 0.045;
    circle(moonX, moonY, moonR, P.moon);
    circle(moonX + moonR*0.35, moonY - moonR*0.15, moonR*0.7, P.sky1);

    // Stars with twinkle
    for (const st of stars) {
      st.twinkle += st.speed;
      const a = 0.5 + Math.sin(st.twinkle) * 0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = P.star;
      ctx.fillRect(Math.round(st.x), Math.round(st.y), Math.ceil(st.r), Math.ceil(st.r));
    }
    ctx.globalAlpha = 1;

    // Distant city silhouette
    ctx.fillStyle = '#0d0d20';
    const cw = W / 10;
    for (let i = 0; i < 10; i++) {
      const ch2 = 20 + Math.sin(i * 1.7) * 15 + Math.cos(i * 2.3) * 10;
      ctx.fillRect(i * cw - 2, BLD_Y - ch2, cw + 2, ch2);
    }

    // Ground
    px(0, BLD_Y + BLD_H, W, H - (BLD_Y + BLD_H), P.ground);
    px(0, BLD_Y + BLD_H, W, 4, P.groundH);
    px(0, BLD_Y + BLD_H + 4, W, 6, P.groundD);
    // Ground details
    for (let i = 0; i < W; i += 30) {
      ctx.fillStyle = P.dirt;
      ctx.fillRect(i, BLD_Y + BLD_H + 2, 2, 2);
    }
  }

  function drawScore() {
    if (state !== 'playing') return;
    // Already shown in HUD
  }

  function drawWinBanner() {
    if (state !== 'levelcomplete') return;
    const t = 1 - levelCompleteTimer / 100;
    ctx.globalAlpha = Math.min(1, t * 3);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, H/2 - 50, W, 100);
    ctx.fillStyle = P.gold;
    ctx.font = `bold ${Math.round(W * 0.07)}px 'Courier New'`;
    ctx.textAlign = 'center';
    ctx.fillText('¡NIVEL COMPLETADO!', W/2, H/2 + 10);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // ── Main render ───────────────────────────────────────────
  function drawFrame() {
    ctx.save();
    if (screenShake > 0) {
      const dx = (Math.random()-0.5)*screenShake;
      const dy = (Math.random()-0.5)*screenShake;
      ctx.translate(dx, dy);
      screenShake = Math.max(0, screenShake - 0.5);
    }
    drawBackground();
    drawBuilding();
    for (const w of windows) drawWindow(w);
    drawRalph();
    drawBricks();
    drawFelix();
    drawParticles();
    drawWinBanner();
    ctx.restore();
  }

  // ── Update ────────────────────────────────────────────────
  function update() {
    frameCount++;

    if (state === 'playing') {
      // Ralph arm animation
      if (ralph.armRaise > 0) ralph.armRaise--;
      if (ralph.angry > 0) ralph.angry--;

      // Throw timer
      throwTimer--;
      if (throwTimer <= 0) {
        throwBrick();
        throwTimer = Math.max(35, 100 - level * 10);
      }

      // Random window break
      windowBreakTimer--;
      if (windowBreakTimer <= 0) {
        if (Math.random() < 0.4 + level * 0.05) breakRandom(1);
        windowBreakTimer = Math.max(80, 200 - level * 15);
      }

      // Repair progress
      if (felix.repairing) {
        felix.repairTimer--;
        if (felix.repairTimer <= 0) {
          felix.repairing = false;
          const w = windows.find(ww => ww.row === felix.row && ww.col === felix.col);
          if (w && w.broken) {
            w.broken = false; w.repairing = false;
            w.flashTimer = 15;
            const r = winRect(w.row, w.col);
            spawnSparkles(r.x + r.w/2, r.y + r.h/2);
            spawnParticles(r.x + r.w/2, r.y + r.h/2, P.gold, 10, 2.5);
            score += 50 * level;
            updateHUD();
          }
        }
      }

      // Brick physics
      for (const b of bricks) {
        b.x += b.vx; b.y += b.vy;
        b.vy += 0.12 + level * 0.01;
        b.rot += b.rotV;
      }
      bricks = bricks.filter(b => b.y < H + 40);

      // Invincibility
      if (felix.invincible > 0) felix.invincible--;

      // Brick collision
      if (felix.invincible === 0) {
        const bw = WIN_W * 0.3, bh = WIN_H * 0.22;
        const fh = WIN_H * 1.1, fw = WIN_H * 1.1 * 0.75;
        const hitbox = { x: felix.x + fw*0.1, y: felix.y, w: fw*0.8, h: fh };
        for (let i = bricks.length - 1; i >= 0; i--) {
          const b = bricks[i];
          if (b.x < hitbox.x + hitbox.w && b.x + bw > hitbox.x &&
              b.y < hitbox.y + hitbox.h && b.y + bh > hitbox.y) {
            bricks.splice(i, 1);
            lives--;
            screenShake = 8;
            spawnParticles(felix.x + fw/2, felix.y + fh/2, '#e74c3c', 20, 4);
            spawnSmoke(felix.x + fw/2, felix.y + fh/2, 8);
            felix.invincible = 90;
            felix.repairing = false;
            const w2 = windows.find(ww => ww.row === felix.row && ww.col === felix.col);
            if (w2) w2.repairing = false;
            updateHUD();
            if (lives <= 0) {
              state = 'gameover';
              showOverlay('gameover');
            }
            break;
          }
        }
      }

      // Particles
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.life--;
        p.vx *= 0.96;
      }
      particles = particles.filter(p => p.life > 0);
      for (const sp of sparkles) {
        sp.x += sp.vx; sp.y += sp.vy; sp.vy += 0.08; sp.life--;
      }
      sparkles = sparkles.filter(sp => sp.life > 0);
      for (const w of windows) { if (w.flashTimer > 0) w.flashTimer--; }

      // Win check
      if (allFixed()) {
        state = 'levelcomplete';
        levelCompleteTimer = 100;
        score += 200 * level;
        updateHUD();
      }
    }

    if (state === 'levelcomplete') {
      levelCompleteTimer--;
      for (let i = 0; i < 3; i++) {
        spawnParticles(
          Math.random() * W, Math.random() * H * 0.5,
          [P.gold, '#e74c3c', '#74b9ff', '#00b894'][Math.floor(Math.random()*4)],
          2, 2
        );
      }
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
      }
      particles = particles.filter(p => p.life > 0);
      if (levelCompleteTimer <= 0) {
        level++;
        startLevel();
      }
    }
  }

  // ── Overlay ───────────────────────────────────────────────
  function showOverlay(type) {
    const ov = document.getElementById('overlay');
    ov.classList.remove('hidden');
    ov.innerHTML = '';

    if (type === 'start') {
      ov.innerHTML = `
        <div style="font-size:36px;animation:spin 2s linear infinite;display:inline-block;">✦</div>
        <div class="overlay-title">FIX-IT FELIX JR.</div>
        <div class="overlay-sub">
          Repara las ventanas con el martillo dorado<br>
          ¡Esquiva los ladrillos de Ralph!
        </div>
        <div class="overlay-sub" style="font-size:11px;color:#666;">
          ← → Mover · ↑ ↓ Subir/Bajar piso · 🔨 Reparar
        </div>
        <button class="overlay-btn" id="startBtn">▶ INICIAR JUEGO</button>
      `;
      document.getElementById('startBtn').onclick = startGame;
    } else if (type === 'gameover') {
      ov.innerHTML = `
        <div style="font-size:42px;">💀</div>
        <div class="overlay-title" style="color:#e74c3c;text-shadow:0 0 20px #e74c3c,2px 2px 0 #8e1111;">GAME OVER</div>
        <div class="overlay-score">Puntos: ${String(score).padStart(6,'0')}</div>
        <div class="overlay-sub">Nivel alcanzado: ${level}</div>
        <button class="overlay-btn" id="startBtn">↺ REINICIAR</button>
      `;
      document.getElementById('startBtn').onclick = startGame;
    }
  }

  // ── Input handling ─────────────────────────────────────────
  const keys = {};
  document.addEventListener('keydown', e => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
    if (keys[e.code]) return;
    keys[e.code] = true;
    if (state === 'playing') {
      if (e.code === 'ArrowLeft')  felixMove(0, -1);
      if (e.code === 'ArrowRight') felixMove(0,  1);
      if (e.code === 'ArrowUp')    felixMove(-1, 0);
      if (e.code === 'ArrowDown')  felixMove( 1, 0);
      if (e.code === 'Space')      felixRepair();
    }
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });

  function setupBtn(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    let held = false;
    const down = () => { if (!held) { held = true; el.classList.add('pressed'); fn(); } };
    const up   = () => { held = false; el.classList.remove('pressed'); };
    el.addEventListener('touchstart', e => { e.preventDefault(); down(); }, { passive: false });
    el.addEventListener('touchend',   e => { e.preventDefault(); up();   }, { passive: false });
    el.addEventListener('mousedown',  down);
    el.addEventListener('mouseup',    up);
  }

  setupBtn('btnLeft',  () => { if (state==='playing') felixMove(0,-1); });
  setupBtn('btnRight', () => { if (state==='playing') felixMove(0, 1); });
  setupBtn('btnUp',    () => { if (state==='playing') felixMove(-1,0); });
  setupBtn('btnDown',  () => { if (state==='playing') felixMove( 1,0); });
  setupBtn('repair-btn', () => { if (state==='playing') felixRepair(); });

  // ── Game loop ─────────────────────────────────────────────
  function loop() {
    update();
    drawFrame();
    requestAnimationFrame(loop);
  }

  // ── Boot ──────────────────────────────────────────────────
  resize();
  layoutGame();
  initStars();
  showOverlay('start');
  loop();

})();
