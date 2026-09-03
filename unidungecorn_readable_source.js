// ===== UniDungeCorn — a unicorn & rainbow roguelike =====
const cv = document.getElementById('c'), gx = cv.getContext('2d');
const TS = 16, MW = 110, MH = 60; // tile size, dungeon logical size
let VW = 40, VH = 24; // viewport tiles, recomputed to fit the window
function fitCanvas() {
  VW = Math.max(34, Math.min(MW, Math.floor(innerWidth / TS)));
  VH = Math.max(22, Math.min(MH, Math.floor((innerHeight - 78) / TS)));
  cv.width = VW * TS; cv.height = VH * TS + 78;
}
fitCanvas();
addEventListener('resize', fitCanvas);
document.addEventListener('fullscreenchange', fitCanvas);
function toggleFullscreen() {
  if (!document.fullscreenElement) { try { cv.requestFullscreen(); } catch (e) {} }
  else document.exitFullscreen();
}

// ---- minimap (cached, redrawn only once per turn) ----
function ft(px, b) { gx.font = (b ? 'bold ' : '') + px + 'px monospace'; }
const SI = 'sine', TR = 'triangle', SA = 'sawtooth', SQ = 'square';
const mmC = document.createElement('canvas'), mmG = mmC.getContext('2d');
function mmDraw() {
  mmC.width = MW * 3; mmC.height = MH * 3;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!seen[y][x]) continue;
    const t = map[y][x];
    mmG.fillStyle = t === '#' ? '#443355' : t === '>' ? Y : '#2a2a44';
    mmG.fillRect(x * 3, y * 3, 3, 3);
  }
}

// ---- audio ----
let actx, muted = false;
function ac() { return actx || (actx = new (window.AudioContext || window.webkitAudioContext)()); }
function beep(freq, dur, type, pan, vol) {
  if (muted) return;
  try {
    const c = ac(), o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner();
    o.type = type || SI; o.frequency.value = freq;
    p.pan.value = pan || 0;
    g.gain.value = vol || 0.12;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(p); p.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  } catch (e) {}
}
let musicTimer = null, musicStep = 0;
function startMusic() {
  clearInterval(musicTimer);
  musicTimer = setInterval(() => {
    if (muted || state !== 'play') return;
    const scale = [0, 2, 4, 7, 9, 12, 16];
    const base = 220 + floor * 6;
    const n = scale[musicStep % scale.length];
    beep(base * Math.pow(2, n / 12), 0.5, TR, 0, 0.035);
    musicStep++;
  }, 480);
}

// ---- palette (rainbow, changes every 4 floors) ----
const RAINBOW = ['#ff2d55', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#5e5ce6', '#bf5af2'];
const Y = '#ffd60a', RD = '#ff2d55', PK = '#ff6fae', PU = '#bf5af2', BG = '#0b0b14';
function hue() { return RAINBOW[Math.floor((floor - 1) / 4) % RAINBOW.length]; }

// ---- playable classes ----
const CLASSES = [
  { name: 'Alicorn Warrior', hp: 20, atk: 4, def: 3, spd: 1, col: '#f5f5f5', desc: 'Sturdy and resilient. Shrugs off hits with ease.' },
  { name: 'Shadow Pony', hp: 15, atk: 5, def: 1, crit: 0.25, col: PK, desc: '25% crit chance, double damage. Fragile but deadly.' },
  { name: 'Star Mage', hp: 12, atk: 3, def: 0, ranged: true, col: '#8e6fff', desc: 'Ranged spell (F), range 4, needs line of sight.' },
];

// ---- game state ----
let state = 'splash', selClass = 0;
let map, seen, vis, rooms, floor, turn, msgLog, player, enemies, items, traps, particles = [], shake = 0, record;

function newGame(ci) {
  const c = CLASSES[ci];
  player = { x: 0, y: 0, hp: c.hp, mhp: c.hp, atk: c.atk, def: c.def, cls: c, potions: 0, lastRegen: 0 };
  floor = 0; turn = 0; msgLog = []; record = +localStorage.getItem('udc_record') || 0;
  particles = []; shake = 0;
  descend();
  computeFOV();
  state = 'play'; startMusic();
  log('You awaken in the Grey Kingdom. Bring back the colors!');
}

function log(t) { msgLog.push(t); if (msgLog.length > 40) msgLog.shift(); }

// ---- dungeon generation ----
function descend() {
  floor++;
  map = Array.from({ length: MH }, () => Array(MW).fill('#'));
  seen = Array.from({ length: MH }, () => Array(MW).fill(false));
  vis = Array.from({ length: MH }, () => Array(MW).fill(false));
  rooms = []; enemies = []; items = []; traps = [];
  const nrooms = 9 + Math.floor(Math.random() * 6);
  let attempts = 0;
  for (let i = 0; i < nrooms && attempts < 400; i++) {
    const w = 4 + Math.floor(Math.random() * 5), h = 3 + Math.floor(Math.random() * 4);
    const x = 1 + Math.floor(Math.random() * (MW - w - 2)), y = 1 + Math.floor(Math.random() * (MH - h - 2));
    const r = { x, y, w, h };
    let overlap = rooms.some(o => x < o.x + o.w + 1 && x + w + 1 > o.x && y < o.y + o.h + 1 && y + h + 1 > o.y);
    if (overlap) { i--; attempts++; continue; }
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) map[yy][xx] = '.';
    if (rooms.length) {
      const p = rooms[rooms.length - 1], cx1 = p.x + (p.w >> 1), cy1 = p.y + (p.h >> 1);
      const cx2 = x + (w >> 1), cy2 = y + (h >> 1);
      if (Math.random() < 0.5) { corr(cx1, cx2, cy1, 1); corr(cy1, cy2, cx2, 0); }
      else { corr(cy1, cy2, cx1, 0); corr(cx1, cx2, cy2, 1); }
    }
    rooms.push(r);
  }
  const start = rooms[0], end = rooms[rooms.length - 1];
  player.x = start.x + (start.w >> 1); player.y = start.y + (start.h >> 1);
  const sx = end.x + (end.w >> 1), sy = end.y + (end.h >> 1);
  map[sy][sx] = '>';
  // populate rooms
  rooms.forEach((r, i) => {
    if (i === 0) return;
    const cx = r.x + (r.w >> 1), cy = r.y + (r.h >> 1);
    if (i !== rooms.length - 1 && Math.random() < 0.42) traps.push({ x: cx + (Math.random() < .5 ? -1 : 1), y: cy });
    if (Math.random() < 0.55) spawnEnemy(r);
    if (Math.random() < 0.4) spawnItem(r);
  });
}
function corr(a, b, fix, horiz) { for (let v = Math.min(a, b); v <= Math.max(a, b); v++) { if (horiz) map[fix][v] = '.'; else map[v][fix] = '.'; } }

function spawnEnemy(r) {
  const x = r.x + Math.floor(Math.random() * r.w), y = r.y + Math.floor(Math.random() * r.h);
  const isBoss = floor % 5 === 0 && !enemies.some(e => e.boss);
  let type;
  if (isBoss) type = 'boss';
  else {
    const pool = floor >= 2 ? ['shadow', 'cloud', 'troll'] : ['shadow', 'cloud'];
    type = pool[Math.floor(Math.random() * pool.length)];
  }
  const scale = 1 + (floor - 1) * 0.22;
  const base = { shadow: { hp: 6, atk: 2, def: 0, gl: 's', col: '#7a5cff' },
    cloud: { hp: 4, atk: 1, def: 0, gl: 'c', col: '#b8c4d0' },
    troll: { hp: 10, atk: 3, def: 1, gl: 't', col: '#3a6fa0' },
    boss: { hp: 30, atk: 6, def: 3, gl: 'K', col: RD } }[type];
  enemies.push({
    x, y, type, gl: base.gl, col: base.col,
    hp: Math.round(base.hp * scale * (isBoss ? 2.6 : 1)),
    mhp: Math.round(base.hp * scale * (isBoss ? 2.6 : 1)),
    atk: Math.round(base.atk * scale * (isBoss ? 1.9 : 1)),
    def: Math.round(base.def * scale),
    boss: isBoss, hits: 0, alive: true,
    range: isBoss ? 8 : 5,
  });
}
function spawnItem(r) {
  const x = r.x + Math.floor(Math.random() * r.w), y = r.y + Math.floor(Math.random() * r.h);
  const roll = Math.random();
  let it;
  if (roll < 0.5) it = { x, y, gl: '!', col: PK, kind: 'potion' };
  else if (roll < 0.75) it = { x, y, gl: '/', col: Y, kind: 'weapon', bonus: 1 + Math.floor(Math.random() * 3) };
  else if (roll < 0.94) it = { x, y, gl: '[', col: '#0a84ff', kind: 'armor', bonus: 1 + Math.floor(Math.random() * 2) };
  else it = { x, y, gl: '*', col: PU, kind: 'gem' };
  items.push(it);
}

// ---- line of sight (Bresenham) ----
function losClear(x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
  while (true) {
    if (x0 === x1 && y0 === y1) return true;
    if (map[y0] && map[y0][x0] === '#' && !(x0 === x1 && y0 === y1)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function computeFOV() {
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) vis[y][x] = false;
  const R = 8;
  for (let y = Math.max(0, player.y - R); y <= Math.min(MH - 1, player.y + R); y++)
    for (let x = Math.max(0, player.x - R); x <= Math.min(MW - 1, player.x + R); x++) {
      const d = Math.hypot(x - player.x, y - player.y);
      if (d <= R && losClear(player.x, player.y, x, y)) { vis[y][x] = true; seen[y][x] = true; }
    }
  mmDraw();
}

// ---- particles / feedback ----
function burst(x, y, col, n) {
  for (let i = 0; i < (n || 8); i++) {
    const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.8;
    particles.push({ x: x * TS + TS / 2, y: y * TS + TS / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 46, mlife: 46, col });
  }
}
function pan(ex) { return Math.max(-1, Math.min(1, (ex - player.x) / 8)); }
// free-floating particle/shake animation, independent of turns
let lastT = 0;
function tickFX(ts) {
  if (!lastT) lastT = ts;
  const dt = Math.min(2, (ts - lastT) / 16.7); lastT = ts;
  particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.99; p.vy = p.vy * 0.99 - 0.015 * dt; p.life -= dt; });
  particles = particles.filter(p => p.life > 0);
  if (shake > 0) { shake *= Math.pow(0.86, dt); if (shake < 0.15) shake = 0; }
  draw();
  requestAnimationFrame(tickFX);
}

// ---- actions ----
function tryMove(dx, dy) {
  if (state !== 'play') return;
  const nx = player.x + dx, ny = player.y + dy;
  const en = enemies.find(e => e.alive && e.x === nx && e.y === ny);
  if (en) { attack(player, en); endTurn(); return; }
  if (map[ny] && map[ny][nx] !== '#') {
    player.x = nx; player.y = ny;
    const trap = traps.find(t => t.x === nx && t.y === ny && !t.sprung);
    if (trap) {
      trap.sprung = true;
      if (Math.random() < 0.5) {
        const dmg = 4 + Math.floor(Math.random() * 7);
        player.hp -= dmg; shake = 8; burst(player.x, player.y, '#7a5cff', 10);
        log('☁ A dark cloud engulfs you! -' + dmg + ' HP');
        beep(120, 0.3, SA, 0, 0.15);
      } else {
        let ok = false, tries = 0;
        while (!ok && tries++ < 60) {
          const r = rooms[Math.floor(Math.random() * rooms.length)];
          const tx = r.x + Math.floor(Math.random() * r.w), ty = r.y + Math.floor(Math.random() * r.h);
          if (map[ty][tx] === '.') { player.x = tx; player.y = ty; ok = true; }
        }
        log('🌀 An unstable portal sucks you elsewhere!');
        beep(400, 0.3, SI, 0, 0.15);
      }
    }
    if (map[ny][nx] === '>') { floorClear(); }
    const it = items.find(i => i.x === nx && i.y === ny);
    if (it) pickup(it);
    endTurn();
  }
}
function pickup(it) {
  items.splice(items.indexOf(it), 1);
  if (it.kind === 'potion') {
    if (player.potions < 3) { player.potions++; log('🧪 You pick up a Rainbow Potion.'); }
    else log('Backpack full, potion wasted.');
  } else if (it.kind === 'weapon') { player.atk += it.bonus; log('🦄 Your Enchanted Horn grows stronger! (+' + it.bonus + ' ATK)'); }
  else if (it.kind === 'armor') { player.def += it.bonus; log('✨ Your Shining Mane sparkles! (+' + it.bonus + ' DEF)'); }
  else { player.atk++; player.def++; player.mhp += 3; player.hp += 3; log('🔮 Rainbow Crystal absorbed! All stats +1'); }
  beep(700, 0.15, SI, 0, 0.1);
}
function floorClear() {
  descend();
  computeFOV();
  log('⬇ You descend to floor ' + floor + '. The greyness fades a little...');
  beep(300, 0.4, TR, 0, 0.1);
}
function attack(a, b) {
  const isPlayer = a === player;
  let dmg = Math.max(1, a.atk - (b.def || 0));
  if (isPlayer && a.cls.crit && Math.random() < a.cls.crit) { dmg *= 2; log('💥 Critical hit!'); }
  b.hp -= dmg;
  burst(b.x, b.y, Y, 6);
  beep(isPlayer ? 500 : 200, 0.12, SQ, pan(isPlayer ? b.x : a.x), 0.1);
  if (isPlayer) log('You hit ' + enemyName(b) + ' (-' + dmg + ')');
  else { shake = 6; burst(player.x, player.y, RD, 8); log(enemyName(b) + ' hits you (-' + dmg + ')'); navigator.vibrate && navigator.vibrate(60); }
  if (b.hp <= 0 && !isPlayer) { die(); }
  if (isPlayer && b.hp <= 0) {
    b.alive = false; enemies.splice(enemies.indexOf(b), 1);
    log('☠ ' + enemyName(b) + ' defeated!');
    burst(b.x, b.y, b.boss ? Y : '#fff', b.boss ? 24 : 10);
    beep(650, 0.25, TR, pan(b.x), 0.12);
  }
}
function enemyName(e) { return { shadow: 'an Envious Shadow', cloud: 'a Grey Cloud', troll: 'a Storm Troll', boss: 'the Storm King' }[e.type]; }

function castSpell() {
  if (!player.cls.ranged || state !== 'play') return;
  let best = null, bd = 99;
  enemies.forEach(e => {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d <= 4 && losClear(player.x, player.y, e.x, e.y) && d < bd) { bd = d; best = e; }
  });
  if (!best) { log('No target in range.'); return; }
  attack(player, best);
  burst(best.x, best.y, PU, 10);
  endTurn();
}
function drinkPotion() {
  if (state !== 'play' || player.potions <= 0) return;
  player.potions--;
  const heal = 4 + Math.floor(Math.random() * 4);
  player.hp = Math.min(player.mhp, player.hp + heal);
  log('🧪 You drink a potion. +' + heal + ' HP');
  beep(800, 0.2, SI, 0, 0.1);
  burst(player.x, player.y, PK, 10);
  endTurn();
}
function die() { }

function enemyTurn() {
  enemies.forEach(e => {
    if (!e.alive || e.hp <= 0) return;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    const flee = e.hp < e.mhp * 0.25 && !e.boss;
    if (flee) {
      const dx = e.x - player.x < 0 ? -1 : e.x - player.x > 0 ? 1 : 0;
      const dy = e.y - player.y < 0 ? -1 : e.y - player.y > 0 ? 1 : 0;
      moveEnemy(e, dx, dy); return;
    }
    if (d <= 1.5) {
      let dmg = Math.max(1, e.atk - player.def);
      e.hits = (e.hits || 0) + 1;
      if (e.type === 'troll' && e.hits % 3 === 0) { dmg = Math.round(dmg * 1.8); log('🌩 The Troll charges furiously!'); }
      player.hp -= dmg;
      shake = 6; burst(player.x, player.y, RD, 8);
      beep(180, 0.15, SA, pan(e.x), 0.12);
      log(enemyName(e) + ' hits you (-' + dmg + ')');
      navigator.vibrate && navigator.vibrate(60);
      if (player.hp <= 0) gameOver();
      return;
    }
    if (d <= e.range && losClear(e.x, e.y, player.x, player.y)) {
      let dx = Math.sign(player.x - e.x), dy = Math.sign(player.y - e.y);
      if (e.type === 'cloud' && Math.random() < 0.4) { dx = Math.floor(Math.random() * 3) - 1; dy = Math.floor(Math.random() * 3) - 1; }
      moveEnemy(e, dx, dy);
    }
  });
}
function moveEnemy(e, dx, dy) {
  const nx = e.x + dx, ny = e.y + dy;
  if (map[ny] && map[ny][nx] !== '#' && !(nx === player.x && ny === player.y) && !enemies.some(o => o !== e && o.alive && o.x === nx && o.y === ny)) {
    e.x = nx; e.y = ny;
  }
}
function endTurn() {
  turn++;
  if (turn - player.lastRegen >= 25 && player.hp > 0) { player.hp = Math.min(player.mhp, player.hp + 1); player.lastRegen = turn; }
  enemyTurn();
  if (player.hp <= 0) gameOver();
  computeFOV();
}
function gameOver() {
  state = 'dead'; clearInterval(musicTimer);
  const depth = floor;
  if (depth > record) { record = depth; localStorage.setItem('udc_record', record); }
  beep(100, 0.6, SA, 0, 0.15);
}

// ---- input ----
window.addEventListener('keydown', e => {
  if (state === 'splash') {
    if (e.key === 'ArrowUp' || e.key === 'w') selClass = (selClass + 2) % 3;
    if (e.key === 'ArrowDown' || e.key === 's') selClass = (selClass + 1) % 3;
    if (e.key === 'Enter' || e.key === ' ') newGame(selClass);
    return;
  }
  if (e.key === 'Enter') { toggleFullscreen(); return; }
  if (state === 'dead') { if (e.key === 'r' || e.key === 'R') { state = 'splash'; } return; }
  const k = e.key;
  if (k === 'm' || k === 'M') { muted = !muted; return; }
  if (k === 'e' || k === 'E') { drinkPotion(); return; }
  if (k === 'f' || k === 'F') { castSpell(); return; }
  const map2 = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  if (map2[k]) { tryMove(map2[k][0], map2[k][1]); }
});
cv.addEventListener('click', ev => {
  if (state === 'splash') {
    const r = cv.getBoundingClientRect(), my = (ev.clientY - r.top);
    for (let i = 0; i < 3; i++) if (my > 150 + i * 60 && my < 200 + i * 60) selClass = i;
  }
});

// ---- rendering ----
function draw() {
  gx.fillStyle = BG; gx.fillRect(0, 0, cv.width, cv.height);
  if (state === 'splash') return drawSplash();
  if (state === 'dead') return drawDead();
  const camX = Math.max(0, Math.min(MW - VW, player.x - (VW >> 1)));
  const camY = Math.max(0, Math.min(MH - VH, player.y - (VH >> 1)));
  gx.save();
  if (shake > 0) { gx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); }
  gx.translate(0, 20);
  const wallCol = hue();
  for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
    const mx = x + camX, my = y + camY;
    if (mx >= MW || my >= MH) continue;
    if (!seen[my][mx]) continue;
    const v = vis[my][mx];
    const t = map[my][mx];
    gx.globalAlpha = v ? 1 : 0.35;
    if (t === '#') { gx.fillStyle = v ? wallCol : '#332244'; gx.fillRect(x * TS, y * TS, TS, TS); gx.fillStyle = 'rgba(0,0,0,.35)'; gx.fillRect(x * TS, y * TS, TS, 3); }
    else { gx.fillStyle = v ? '#1c1c2c' : '#141420'; gx.fillRect(x * TS, y * TS, TS, TS); if (t === '>') { gx.fillStyle = Y; ft(14); gx.fillText('>', x * TS + 3, y * TS + 12); } }
  }
  gx.globalAlpha = 1;
  items.forEach(it => { if (vis[it.y] && vis[it.y][it.x]) { gx.fillStyle = it.col; ft(14); gx.fillText(it.gl, (it.x - camX) * TS + 3, (it.y - camY) * TS + 12); } });
  enemies.forEach(e => {
    if (!e.alive) return;
    if (vis[e.y] && vis[e.y][e.x]) {
      gx.fillStyle = e.col; ft(14,1); gx.fillText(e.gl, (e.x - camX) * TS + 3, (e.y - camY) * TS + 12);
      gx.fillStyle = '#300'; gx.fillRect((e.x - camX) * TS, (e.y - camY) * TS - 4, TS, 3);
      gx.fillStyle = '#f33'; gx.fillRect((e.x - camX) * TS, (e.y - camY) * TS - 4, TS * (e.hp / e.mhp), 3);
    } else {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < 9) {
        const ang = Math.atan2(e.y - player.y, e.x - player.x);
        const px = (player.x - camX) * TS + TS / 2 + Math.cos(ang) * 26, py = (player.y - camY) * TS + TS / 2 + Math.sin(ang) * 26;
        gx.fillStyle = 'rgba(255,60,60,' + (0.4 + 0.3 * Math.sin(turn)) + ')';
        gx.beginPath(); gx.arc(px, py, 3, 0, 7); gx.fill();
      }
    }
  });
  gx.fillStyle = player.cls.col; ft(15,1); gx.fillText('🦄', (player.x - camX) * TS - 1, (player.y - camY) * TS + 13);
  particles.forEach(p => { gx.fillStyle = p.col; gx.globalAlpha = Math.max(0, p.life / p.mlife); gx.fillRect(p.x - camX * TS, p.y - camY * TS, 3, 3); });
  gx.globalAlpha = 1;
  gx.restore();

  // HUD top
  gx.fillStyle = BG; gx.fillRect(0, 0, cv.width, 20);
  gx.fillStyle = hue(); ft(12,1);
  gx.fillText('UniDungeCorn  Floor ' + floor + '  Turn ' + turn, 6, 14);
  gx.fillStyle = PK; gx.fillText('HP ' + Math.max(0, player.hp) + '/' + player.mhp, cv.width * 0.4, 14);
  gx.fillStyle = Y; gx.fillText('ATK ' + player.atk + ' DEF ' + player.def + ' 🧪x' + player.potions, cv.width * 0.58, 14);

  // log bottom
  const ly = VH * TS + 20;
  gx.fillStyle = BG; gx.fillRect(0, ly, cv.width, 58);
  gx.fillStyle = '#ccc'; ft(11);
  msgLog.slice(-3).forEach((m, i) => gx.fillText(m, 6, ly + 16 + i * 14));

  // minimap
  const mmS = 3, mmX = cv.width - MW * mmS - 8, mmY = 24;
  gx.fillStyle = 'rgba(0,0,0,.5)'; gx.fillRect(mmX - 2, mmY - 2, MW * mmS + 4, MH * mmS + 4);
  gx.drawImage(mmC, mmX, mmY);
  gx.fillStyle = '#fff'; gx.fillRect(mmX + player.x * mmS, mmY + player.y * mmS, mmS, mmS);
}

function drawSplash() {
  gx.textAlign = 'center';
  const t = 'UniDungeCorn';
  for (let i = 0; i < t.length; i++) { gx.fillStyle = RAINBOW[i % RAINBOW.length]; ft(34,1); gx.fillText(t[i], cv.width / 2 - 150 + i * 26, 70); }
  gx.fillStyle = '#ccc'; ft(13);
  gx.fillText('A roguelike to bring color back to the Grey Kingdom.', cv.width / 2, 100);
  gx.fillText('WASD/Arrows move · E potion · F spell · M music · Enter fullscreen', cv.width / 2, 120);
  CLASSES.forEach((c, i) => {
    const y = 150 + i * 60, sel = i === selClass;
    gx.fillStyle = sel ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.04)';
    gx.fillRect(cv.width / 2 - 260, y - 26, 520, 50);
    gx.fillStyle = c.col; ft(16,1); gx.textAlign = 'left';
    gx.fillText((sel ? '🦄 ' : '   ') + c.name, cv.width / 2 - 240, y - 4);
    gx.fillStyle = '#aaa'; ft(11);
    gx.fillText(c.desc, cv.width / 2 - 240, y + 14);
    gx.fillStyle = '#888'; gx.fillText('HP ' + c.hp + '  ATK ' + c.atk + '  DEF ' + c.def, cv.width / 2 + 140, y - 4);
    gx.textAlign = 'center';
  });
  gx.fillStyle = Y; ft(13,1);
  gx.fillText('↑↓ select · Enter/Space to start', cv.width / 2, 355);
  const rec = +localStorage.getItem('udc_record') || 0;
  gx.fillStyle = '#8e6fff'; gx.fillText('Best: floor ' + rec, cv.width / 2, 378);
  gx.textAlign = 'left';
}
function drawDead() {
  gx.textAlign = 'center';
  gx.fillStyle = RD; ft(30,1); gx.fillText('The Greyness has swallowed you', cv.width / 2, 140);
  gx.fillStyle = '#fff'; ft(16);
  gx.fillText('You reached floor ' + floor + ' — Turns survived: ' + turn, cv.width / 2, 180);
  gx.fillStyle = Y; gx.fillText('Personal best: floor ' + record, cv.width / 2, 210);
  gx.fillStyle = '#aaa'; ft(13); gx.fillText('Press R to restart', cv.width / 2, 250);
  gx.textAlign = 'left';
}

requestAnimationFrame(tickFX);
