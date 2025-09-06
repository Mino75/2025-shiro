/* Castles Clash — readable build with English comments

   Highlights:
   - Global speed scaler affects movement, attack rates, projectile speed, and production.
   - 10s "double chance" draw: 1st card -> Play/Discard; if Discard, immediate 2nd card.
     If a slot is free, the 2nd card auto-plays; if full, you can replace a specific slot or Discard.
   - AI parity: after each player resolution, AI ensures the same number of active unit types.
   - Units stop while attacking; pick exactly one target; if exactly two, pick randomly.
   - Jumpers (moveType="jump") skip the first enemy once, then stick to the next.
   - Ground-to-air projectiles visually spawn higher (toward the sky).
   - Right-side units are flipped horizontally; the rider is flipped too.
   - Castles: 🏰 left, 🏯 right; background color shifts green→orange→red with HP.
*/

(function () {
  /* -------------------------------------------------------
     Constants (independent of the DOM)
  ------------------------------------------------------- */
  const GLOBAL_SPEED = 0.2;         // <1 slower, >1 faster (affects everything)
  const CASTLE_W = 80;
  const TURN_MS = 5000;            // 10 seconds per "chance"
  const PROJ_SPEED_BASE = 320;
  const LEFT = "left";
  const RIGHT = "right";
  const LAYERS = { GROUND: "ground", AIR: "air" };
  const MELEE_RANGE = 28;           // pixels
  //const ATTACK_STOP_MS = 260;       // stop briefly while attacking
  const MAX_ACTIVE_TYPES = 6;
  // Global scaling helpers
  const scaleSpeed = (v) => v * GLOBAL_SPEED;
  const scaleTime = (ms) => ms / GLOBAL_SPEED;
  const PROJ_SPEED = scaleSpeed(PROJ_SPEED_BASE);
  const PROJECTILE_SIZE_PX = 7;  // global projectile emoji size (pixels)
  // --- Rider & equipment sizing/offsets (easy to tweak) ---
  const RIDER_TO_MOUNT_RATIO  = 0.75; // rider font size = unit.size * this
  const EQUIP_TO_RIDER_RATIO  = 0.50; // equip font size = riderFont * this (50%)

  const RIDER_OFFSET_Y_PX     = 0;   // vertical nudge for rider on the mount
  const EQUIP_OFFSET_FWD_PX   = 0;    // +x toward facing, -x away (px)
  const EQUIP_OFFSET_UP_PX    = 0;    // +y down, -y up (px)

  // --- Mid-feature config (data-driven) ---
  const MID_FEATURES = [
    { emoji: "🗻", weight: 1, min: 40, max: 72, scale: 1.5 },
    { emoji: "🌋", weight: 1, min: 40, max: 72, scale: 1.5 },
  ]
  // responsive sizing; size ≈ ARENA_W * factor, then clamped by per-item min/max
  const MIDFEATURE_SIZE_FACTOR = 1 / 14;
  // push feature *down* below the horizon so ground hides that slice
  const MIDFEATURE_SINK_PX = 6;     // increase to hide more behind horizon
  // optional random size jitter for variety (0.0 = off)
  const MIDFEATURE_JITTER = 0.0;    // e.g. 0.1 gives ±10%

      // --- Clouds (data-driven) ---
    const CLOUD_TYPES = [
      { emoji: "☁️",  weight: 3 },
      { emoji: "🌧️", weight: 1 },
    ];
    const CLOUD_COUNT        = (w) => Math.round(Math.min(10, Math.max(4, w / 160)));
    const CLOUD_SIZE_RANGE   = [36, 56];   // px
    const CLOUD_TOP_RANGE    = [8, 70];    // px from top of #sky
    const CLOUD_SPEED_RANGE  = [18, 30];   // seconds

    // --- Meadow (data-driven) ---
    const MEADOW_ITEMS = [
      { emoji: "🌼", weight: 3, scale: [0.75, 1.15] },
      { emoji: "🌾", weight: 2, scale: [0.85, 1.20] },
    ];
    const MEADOW_COUNT         = (w) => Math.round(Math.min(36, Math.max(12, w / 35)));
    const MEADOW_BOTTOM_RANGE  = [4, 16];     // px above ground bottom
    const MEADOW_ROTATION_DEG  = [-6, 6];     // random tilt
    const MEADOW_OPACITY_RANGE = [0.85, 1];
    const MEADOW_SIDE_MARGIN   = 16;          // keep away from arena edges


  /* -------------------------------------------------------
     Units roster and balance (per your roles)
  ------------------------------------------------------- */

  // Quick helper to make Fibonacci-like "points" literal
  const P = (n) => n;

// ---------- ROSTER (one object per line; same order) ----------
const UNIT_TYPES = [
  // --- Tanks (melee, very low damage, HP = castle 18) ---
  { key:"sauropod", emoji:"🦕", size:60, hp:P(21), dmg:P(1), atkMs:620, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:100,  moveType:"advance", locomotion:"walk", production:2000,  mounted:false },
  { key:"phoenix",  emoji:"🐦‍🔥", size:40, hp:P(21), dmg:P(1), atkMs:620,  range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:100,  moveType:"advance", locomotion:"fly",  production:2000,  mounted:false },

  // --- Unique Attacker (melee DMG 8) ---
  { key:"rex",      emoji:"🦖",  size:40, hp:P(5), dmg:P(13), atkMs:100, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:200,  moveType:"advance", locomotion:"walk", production:3000,  mounted:false  },

  // --- Rushers (very fast move + fast production, low HP) ---
  { key:"horse",    emoji:"🏇",  size:30, hp:P(3), dmg:P(3), atkMs:380, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:350, moveType:"advance", locomotion:"walk", production:300,   mounted:true  },
  { key:"zebra",    emoji:"🦓",  size:30, hp:P(3), dmg:P(3), atkMs:380, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:350, moveType:"advance", locomotion:"walk", production:300,   mounted:true  },
  { key:"eagle",    emoji:"🦅",  size:26, hp:P(2), dmg:P(3), atkMs:500, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:350, moveType:"jump",    locomotion:"fly",  production:300, mounted:false },
  { key:"bat",    emoji:"🦇",  size:26, hp:P(2), dmg:P(3), atkMs:500, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:300, moveType:"jump",    locomotion:"fly",  production:300, mounted:false },

  // --- Submerger Melee ---
  { key:"merman",   emoji:"🧜‍♂️", size:28, hp:P(5), dmg:P(5),  atkMs:650, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:140, moveType:"advance", locomotion:"walk", production:200, mounted:false },
  { key:"bee",      emoji:"🐝",  size:30, hp:P(5), dmg:P(5),  atkMs:520, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:140, moveType:"advance", locomotion:"fly",  production:250, mounted:true  },

  // --- starter melee  ---
  { key:"ant",      emoji:"🐜",  size:22, hp:P(5), dmg:P(3), atkMs:360, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:160, moveType:"advance", locomotion:"walk", production:800, mounted:true  },
  { key:"caterpillar",      emoji:"🐛", size:22, hp:P(5), dmg:P(3), atkMs:360, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:160, moveType:"advance", locomotion:"walk", production:800, mounted:true  },

  // cavalry archer
  { key:"stag",     emoji:"🦌", size:22, hp:P(5), dmg:P(5),  atkMs:300, range:180,        projectile:"•",   blast:0, moveSpeed:200, moveType:"advance", locomotion:"walk", production:2800, mounted:true  },
  { key:"camel",     emoji:"🐫", size:22, hp:P(5), dmg:P(5),  atkMs:300, range:180,        projectile:"•",   blast:0, moveSpeed:200, moveType:"advance", locomotion:"walk", production:2800, mounted:true  },
  { key:"mosquito", emoji:"🦟", size:27, hp:P(5), dmg:P(5),  atkMs:300, range:180,        projectile:"•",   blast:0, moveSpeed:200, moveType:"advance", locomotion:"fly", production:2800, mounted:true  },

  //jumper
  { key:"kangaroo", emoji:"🦘",  size:25, hp:P(5), dmg:P(3), atkMs:420, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:165, moveType:"jump",    locomotion:"walk", production:1400, mounted:true  },
  { key:"cricket",  emoji:"🦗",  size:25, hp:P(5), dmg:P(3), atkMs:420, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:165, moveType:"jump",    locomotion:"walk", production:1400, mounted:true  },

  // --- mounted, balanced melee ---
  { key:"tiger",    emoji:"🐅",  size:35, hp:P(8), dmg:P(8), atkMs:400, range:MELEE_RANGE, projectile:null, blast:0, moveSpeed:120, moveType:"advance", locomotion:"walk", production:3200, mounted:false  },
  { key:"ram",   emoji:"🐏",  size:25, hp:P(8), dmg:P(5), atkMs:400, range:MELEE_RANGE, projectile:null, blast:0,  moveSpeed:120, moveType:"advance", locomotion:"walk", production:3200, mounted:true },
  
  // Blaster
  { key:"butterfly",   emoji:"🦋", size:26, hp:P(5), dmg:P(8), atkMs:480, range:180,        projectile:"•",  blast:100,  moveSpeed:120, moveType:"advance", locomotion:"walk", production:2200, mounted:false },
  { key:"squid",    emoji:"🐙", size:26, hp:P(5), dmg:P(8), atkMs:480, range:180,        projectile:"•",  blast:100,  moveSpeed:120, moveType:"advance", locomotion:"walk", production:2200, mounted:false },
  { key:"mammoth",  emoji:"🦣",  size:36, hp:P(8), dmg:P(8), atkMs:400, range:MELEE_RANGE, projectile:null, blast:100, moveSpeed:500,  moveType:"advance", locomotion:"walk", production:1800, mounted:true  },
  { key:"rhino",  emoji:"🦏",  size:36, hp:P(8), dmg:P(8), atkMs:400, range:MELEE_RANGE, projectile:null, blast:100, moveSpeed:500,  moveType:"advance", locomotion:"walk", production:1800, mounted:true  },

  // --- RANGED NUKE (ranged, short range, very long production) ---
  { key:"ghost",    emoji:"👻",  size:28, hp:P(1), dmg:P(21),  atkMs:650, range:170, projectile:"⭐", blast:0, moveSpeed:220, moveType:"advance", locomotion:"walk", production:9000, mounted:false },
  { key:"alien",    emoji:"👾",  size:28, hp:P(1), dmg:P(21),  atkMs:700, range:140, projectile:"🌀",  blast:0, moveSpeed:250, moveType:"advance", locomotion:"fly",  production:9000, mounted:false },

  // --- Unique Short-range medium (ranged) ---
  { key:"penguin",  emoji:"🐧",  size:22, hp:P(3), dmg:P(3), atkMs:75, range:100,  projectile:"❄️", blast:0,  moveSpeed:100,  moveType:"advance", locomotion:"walk", production:2000, mounted:false },

  // --- Long-range snipers (medium damage, slow attack) ---
  { key:"fairy",    emoji:"🧚",  size:24, hp:P(3), dmg:P(5), atkMs:1200, range:600, projectile:"⚡",  blast:0,  moveSpeed:25, moveType:"advance", locomotion:"fly",  production:3000, mounted:false },
  { key:"mermaid",  emoji:"🧜‍♀️", size:28, hp:P(4), dmg:P(5), atkMs:1200, range:600, projectile:"💧",  blast:0,  moveSpeed:25,  moveType:"advance", locomotion:"walk", production:3200, mounted:false },

  // --- heavy attacker (very high HP, DMG 13, medium range, slow move, very slow prod) ---
  { key:"dragon",   emoji:"🐉",  size:45, hp:P(13), dmg:P(13), atkMs:500, range:260,        projectile:"🔥",  blast:50, moveSpeed:60,  moveType:"advance", locomotion:"walk",  production:12000, mounted:false  },

];


  // Precompute scaled timings and speeds
  for (const t of UNIT_TYPES) {
    t.atkMsScaled = scaleTime(t.atkMs);
    t.productionScaled = scaleTime(t.production);
    t.moveSpeedScaled = scaleSpeed(t.moveSpeed);
  }

  const TYPE_BY_KEY = Object.fromEntries(UNIT_TYPES.map(t => [t.key, t]));

  /* -------------------------------------------------------
     Game state
  ------------------------------------------------------- */
  const state = {
    running: true,
    lastTime: 0,

    units: [],         // live units
    projectiles: [],   // live projectiles
    producers: {       // active "types" producing auto-units
      left: [],        // [{ typeKey, nextSpawn }]
      right: []
    },

    castles: {
      left:  { hp: 18 },
      right: { hp: 18 }
    },

    // Player draw (double chance)
    timers: {
      leftStage: 0,    // 0 none, 1 first card, 2 second card
      leftKey: null
    }
  };

  /* -------------------------------------------------------
     DOM references (filled in init())
  ------------------------------------------------------- */
  let arena;
  let leftHpEl, rightHpEl;
  let leftActivesEl, rightActivesEl;
  let statusText, cardSlot, timerBar;
  let endOverlay, endText, restartBtn;
  let leftCastleEl, rightCastleEl;

  const ARENA_W = () => arena.getBoundingClientRect().width;
  const LEFT_SPAWN_X = () => CASTLE_W + 14;
  const RIGHT_SPAWN_X = () => ARENA_W() - CASTLE_W - 14;

  /* -------------------------------------------------------
     Utilities
  ------------------------------------------------------- */
  const newId = (() => { let n = 0; return () => (++n).toString(36); })();

  const hpDots = (n) => "●".repeat(Math.max(0, n));

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const now = () => performance.now();

  function emitSplash(x, y, text = "−", color = "#ff6b6b") {
    const el = document.createElement("div");
    el.className = "dmgSplash";
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    arena.appendChild(el);
    setTimeout(() => el.remove(), 550);
  }

  function emitAOE(x, y) {
    const el = document.createElement("div");
    el.className = "aoeFx";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    arena.appendChild(el);
    setTimeout(() => el.remove(), 380);
  }

  /* -------------------------------------------------------
     Scenery
  ------------------------------------------------------- */

function pickWeighted(items) {
  const total = items.reduce((s, it) => s + (it.weight || 1), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= (it.weight || 1);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}


function makeClouds() {
  const host = document.getElementById("clouds");
  if (!host) return;
  host.innerHTML = "";

  const w = ARENA_W();
  const n = CLOUD_COUNT(w);

  for (let i = 0; i < n; i++) {
    const spec = pickWeighted(CLOUD_TYPES);

    const c = document.createElement("div");
    c.className = "cloud";
    c.textContent = spec.emoji;

    const top = CLOUD_TOP_RANGE[0] + Math.random() * (CLOUD_TOP_RANGE[1] - CLOUD_TOP_RANGE[0]);
    c.style.top = `${top}px`;

    const size = CLOUD_SIZE_RANGE[0] + Math.random() * (CLOUD_SIZE_RANGE[1] - CLOUD_SIZE_RANGE[0]);
    c.style.fontSize = `${size}px`;

    c.style.left = `${Math.random() * w}px`;

    const dur = CLOUD_SPEED_RANGE[0] + Math.random() * (CLOUD_SPEED_RANGE[1] - CLOUD_SPEED_RANGE[0]);
    c.style.animationDuration = `${dur}s`;
    c.style.animationDelay = `${-Math.random() * dur}s`;

    host.appendChild(c);
  }
}



function makeMidFeature() {
  // draw into the SKY so the ground can occlude the sunk portion
  const sky = document.getElementById("sky");
  if (!sky) return;

  // clear previous feature (idempotent on resize)
  const old = document.getElementById("midFeatureSprite");
  if (old) old.remove();

  // pick which feature to show
  const cfg = pickWeighted(MID_FEATURES);

  // compute responsive size with optional jitter, then clamp
  const base = Math.floor(ARENA_W() * MIDFEATURE_SIZE_FACTOR);
  const jitter = base * MIDFEATURE_JITTER * (Math.random() * 2 - 1);
  const size = Math.max(cfg.min ?? 36, Math.min(cfg.max ?? 72, base + jitter));

  // build element
  const el = document.createElement("div");
  el.id = "midFeatureSprite";
  el.textContent = cfg.emoji;
  el.style.position = "absolute";
  el.style.left = "50%";
  el.style.bottom = "0";                        // bottom of SKY == horizon
  el.style.transform =
    `translateX(-50%) translateY(${MIDFEATURE_SINK_PX}px) scale(${cfg.scale ?? 1})`;
  el.style.lineHeight = "1";
  el.style.fontSize = `${size}px`;
  el.style.opacity = "0.95";
  // No z-index needed: #ground is after #sky so it will cover the sunk slice

  sky.appendChild(el);
}





function makeMeadow() {
  const host = document.getElementById("meadow");
  if (!host) return;
  host.innerHTML = "";

  const w = ARENA_W();
  const n = MEADOW_COUNT(w);

  for (let i = 0; i < n; i++) {
    const spec = pickWeighted(MEADOW_ITEMS);

    const el = document.createElement("div");
    el.className = "flora";
    el.textContent = spec.emoji;
    el.style.position = "absolute";

    el.style.left = `${MEADOW_SIDE_MARGIN + Math.random() * (w - 2 * MEADOW_SIDE_MARGIN)}px`;

    const bot = MEADOW_BOTTOM_RANGE[0] + Math.random() * (MEADOW_BOTTOM_RANGE[1] - MEADOW_BOTTOM_RANGE[0]);
    el.style.bottom = `${bot}px`;

    const scRange = spec.scale || [0.9, 1.1];
    const sc = scRange[0] + Math.random() * (scRange[1] - scRange[0]);
    const rot = MEADOW_ROTATION_DEG[0] + Math.random() * (MEADOW_ROTATION_DEG[1] - MEADOW_ROTATION_DEG[0]);
    el.style.transform = `scale(${sc}) rotate(${rot}deg)`;

    const op = MEADOW_OPACITY_RANGE[0] + Math.random() * (MEADOW_OPACITY_RANGE[1] - MEADOW_OPACITY_RANGE[0]);
    el.style.opacity = `${op}`;

    host.appendChild(el);
  }
}


  function makeTrees() {
    const host = document.getElementById("trees");
    if (!host) return;

    host.innerHTML = "";
    const n = 18;
    const w = ARENA_W();

    for (let i = 0; i < n; i++) {
      const t = document.createElement("div");
      t.className = "tree";
      t.textContent = "🌲";
      t.style.left = `${Math.random() * (w - 60) + 30}px`;
      t.style.transform = `scale(${0.8 + Math.random() * 0.7})`;
      host.appendChild(t);
    }
  }

  /* -------------------------------------------------------
     Castles
  ------------------------------------------------------- */
function castleGlowColors(hp) {
  const p = hp / 18; // 1 → green, 0.5 → orange, 0 → red
  const green  = [ 20,160, 80];
  const orange = [200,140, 40];
  const red    = [200, 60, 60];
  const mix = (a,b,t) => [
    Math.round(a[0] + (b[0]-a[0])*t),
    Math.round(a[1] + (b[1]-a[1])*t),
    Math.round(a[2] + (b[2]-a[2])*t)
  ];
  const col = p > 0.5 ? mix(green, orange, (1-p)*2) : mix(orange, red, (0.5-p)*-2);
  const solid = `rgb(${col[0]}, ${col[1]}, ${col[2]})`;
  const soft  = `rgba(${col[0]}, ${col[1]}, ${col[2]}, .45)`;
  return { solid, soft };
}


  function renderCastleHp() {
    leftHpEl.textContent = hpDots(state.castles.left.hp);
    rightHpEl.textContent = hpDots(state.castles.right.hp);
const glL = castleGlowColors(state.castles.left.hp);
leftCastleEl.style.setProperty('--castleGlow', glL.solid);
leftCastleEl.style.setProperty('--castleGlowSoft', glL.soft);

const glR = castleGlowColors(state.castles.right.hp);
rightCastleEl.style.setProperty('--castleGlow', glR.solid);
rightCastleEl.style.setProperty('--castleGlowSoft', glR.soft);
  }

  /* -------------------------------------------------------
     Active types UI
  ------------------------------------------------------- */
function renderActives(side) {
  const host = side === LEFT ? leftActivesEl : rightActivesEl;
  host.innerHTML = "";

  state.producers[side].forEach((p) => {
    const t = TYPE_BY_KEY[p.typeKey];

    const wrap = document.createElement("div");
    wrap.className = "activeType tooltip";
    wrap.setAttribute(
      "data-title",
`${t.emoji} ${t.key}
HP:${t.hp} DMG:${t.dmg} RNG:${t.range}
PROD:${(t.productionScaled / 1000).toFixed(1)}s`
    );

    const face = document.createElement("div");
    face.className = "emoji";
    face.textContent = t.emoji;

    const prog = document.createElement("div");
    prog.className = "prog";
    const fill = document.createElement("div");
    fill.className = "fill";
    prog.appendChild(fill);

    // NEW: numeric cooldown
    const cd = document.createElement("div");
    cd.className = "cd";

    wrap.appendChild(face);
    wrap.appendChild(prog);
    wrap.appendChild(cd);
    host.appendChild(wrap);

    const remaining = Math.max(0, p.nextSpawn - now());
    const pct = 100 - clamp((remaining / t.productionScaled) * 100, 0, 100);
    fill.style.width = `${pct}%`;

    // label text
    cd.textContent = remaining <= 120 ? "ready" : `${(remaining / 1000).toFixed(1)}s`;
  });
}

/* -------------------------------------------------------
     Producers and spawning
------------------------------------------------------- */
function spawnUnit(side, typeKey) {
  const t = TYPE_BY_KEY[typeKey];

  const u = {
    id: newId(),
    side,
    x: side === LEFT ? LEFT_SPAWN_X() : RIGHT_SPAWN_X(),
    layer: t.locomotion === "fly" ? LAYERS.AIR : LAYERS.GROUND,
    hp: t.hp,
    typeKey,
    nextAtk: 0,
    jumpPhase: 0,
    attackLockUntil: 0,   // harmless if unused
    skippedFirst: false,

    // --- per-unit, independent stats copied from template ---
    dmg:             t.dmg,
    range:           t.range,
    blast:           t.blast || 0,
    moveSpeedScaled: t.moveSpeedScaled,
    atkMsScaled:     t.atkMsScaled,
    hpMax:           t.hp,
    isRanged:        !!t.projectile,
    projectileGlyph: t.projectile || null,
    moveType:        t.moveType,
    spawnAt:         now()
  };

  const el = document.createElement("div");
  el.className = `unit ${u.layer}`;
  el.style.zIndex = u.layer === LAYERS.AIR ? 12 : 10;

  const hpEl = document.createElement("div");
  hpEl.className = "hp";
  hpEl.textContent = hpDots(u.hp);

  
  // Rider (🧎🏻) if mounted; flip the rider for the right side
  if (t.mounted) {
    const rider = document.createElement("div");
    rider.className = "rider";
    rider.textContent = "🧎🏻";

    // Size the rider relative to the mount size (t.size)
    const riderFont = Math.max(12, t.size * RIDER_TO_MOUNT_RATIO);
    rider.style.fontSize = `${riderFont}px`;
    rider.style.position = "absolute";
    rider.style.left = "50%";                 // anchor at unit center
    rider.style.top = `${RIDER_OFFSET_Y_PX}px`;
    rider.style.transform = `translateX(-50%) ${side===LEFT ? 'scaleX(-1)' : 'scaleX(1)'}`;
    rider.style.lineHeight = "1";

    // --- Equip icon (centered on rider) ---
    const equip = document.createElement("div");
    equip.className = "equip";
    equip.textContent = t.projectile ? "🏹" : "🛡️"; // ranged vs melee
    equip.style.position = "absolute";
    equip.style.left = "50%";
    equip.style.top = "50%";
    equip.style.fontSize = `${Math.round(riderFont * EQUIP_TO_RIDER_RATIO)}px`;
    equip.style.lineHeight = "1";
    equip.style.pointerEvents = "none";
    equip.style.zIndex = "2";

    // Center perfectly, then nudge forward & up if desired; flip nudge with side
    const fwd = (side === LEFT ? 1 : -1) * EQUIP_OFFSET_FWD_PX;
    equip.style.transform =
      `translate(-50%, -50%) translate(${fwd}px, ${EQUIP_OFFSET_UP_PX}px) ` +
      `${side===LEFT ? 'scaleX(-1)' : 'scaleX(1)'}`;

    rider.appendChild(equip);
    el.appendChild(rider);
  }


  // Unit emoji; flip right-side units so they face left (visual)
  const face = document.createElement("div");
  face.className = "emoji";
  face.style.fontSize = `${t.size}px`;
  face.textContent = t.emoji;
  face.style.transform = side===LEFT ? 'scaleX(-1)' : 'scaleX(1)';

  el.appendChild(hpEl);
  el.appendChild(face);
  arena.appendChild(el);

  u.el = el;
  u.hpEl = hpEl;
  u.faceEl = face;

  state.units.push(u);
  positionUnitEl(u);
  return u;
}

//position unit

  function positionUnitEl(u) {
    u.el.style.left = `${u.x}px`;
  }

  function addProducer(side, typeKey) {
    // Keep types unique per side
    if (state.producers[side].some((p) => p.typeKey === typeKey)) return false;
    if (state.producers[side].length >= MAX_ACTIVE_TYPES) return false;

    state.producers[side].push({ typeKey, nextSpawn: now() + 50 });
    renderActives(side);
    return true;
  }

  function replaceProducerSlot(side, index, newKey) {
    const arr = state.producers[side];
    if (!arr[index]) return false;

    const exists = arr.findIndex((p) => p.typeKey === newKey);
    if (exists !== -1 && exists !== index) return false;

    arr[index] = { typeKey: newKey, nextSpawn: now() + 50 };
    renderActives(side);
    return true;
  }

  function tickProducers() {
    [LEFT, RIGHT].forEach((side) => {
      for (const p of state.producers[side]) {
        const t = TYPE_BY_KEY[p.typeKey];
        if (now() >= p.nextSpawn) {
          spawnUnit(side, p.typeKey);
          p.nextSpawn = now() + t.productionScaled;
        }
      }
      renderActives(side);
    });
  }

  /* -------------------------------------------------------
     Combat & movement
  ------------------------------------------------------- */


function canTarget(att, tar) {
  // Castle: always targetable by anyone
  if (tar.isCastle) return true;

  // Melee: same-layer only
  if (!att.isRanged) {
    return att.layer === tar.layer; // ground melee -> ground; air melee -> air
  }

  // Ranged:
  if (att.layer === LAYERS.GROUND) {
    // ground ranged can hit ground or air
    return tar.layer === LAYERS.GROUND || tar.layer === LAYERS.AIR;
  } else {
    // air ranged can ONLY hit air (and castle handled above)
    return tar.layer === LAYERS.AIR;
  }
}


// facing ennemies
function enemiesFor(u) {
  return state.units.filter((v) => v && v.side !== u.side);
}

const facingOK = (att, tar) =>
  !!tar && (att.side === LEFT ? tar.x >= att.x : tar.x <= att.x);

const inRange = (att, tar, range) =>
  !!tar && facingOK(att, tar) && Math.abs(att.x - tar.x) <= range;



// put above Combat & movement helpers
function safeDistX(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.abs((a.x || 0) - (b.x || 0));
}
const distX = safeDistX; // keep old name working

// try attack 
   

function tryAttack(u) {
  if (now() < u.nextAtk) return;

  const range = u.isRanged ? u.range : MELEE_RANGE;

  // Collect candidates that are targetable & in range (forward-only via inRange)
  const candidates = enemiesFor(u)
    .filter((e) => canTarget(u, e) && inRange(u, e, range))
    .sort((a, b) => distX(u, a) - distX(u, b));

  // Jumpers skip the first enemy once
  if (u.moveType === "jump" && !u.skippedFirst && candidates.length) {
    u.skippedFirst = true;
    return;
  }

  // Choose exactly one target (closest, or random if exactly two)
  let target = null;
  if (candidates.length === 2) {
    target = candidates[Math.floor(Math.random() * 2)];
  } else if (candidates.length > 0) {
    target = candidates[0];
  }

  // Ranged: if nothing else, try the enemy castle
  if (!target && u.isRanged) {
    const castleX = u.side === LEFT ? ARENA_W() - CASTLE_W / 2 : CASTLE_W / 2;
    const dummy = {
      x: castleX,
      layer: LAYERS.GROUND,     // used only for visuals below
      isCastle: true,
      castleSide: u.side === LEFT ? RIGHT : LEFT
    };
    if (inRange(u, dummy, range)) target = dummy;
  }

  if (!target) return;

  // Perform attack
  if (u.isRanged) {
    shoot(u, target);
  } else {
    dealDamage(u, target, u.dmg, u.blast, true);
  }

  // Cooldown until next swing/shot (per-unit)
  u.nextAtk = now() + u.atkMsScaled;
}



   
// shoot
function shoot(u, target) {
  // Decide projectile lane:
  // - If target is AIR → sky lane
  // - Else if attacker is AIR → sky lane
  // - Else → ground lane
  const yPx =
    target.layer === LAYERS.AIR ? 52 : (u.layer === LAYERS.AIR ? 52 : 140);

  const pr = {
    id: newId(),
    side: u.side,
    x: u.x,
    yPx,
    speed: u.side === LEFT ? PROJ_SPEED : -PROJ_SPEED,
    dmg: u.dmg,
    blast: u.blast || 0,
    el: document.createElement("div"),

    // Tag which lane this projectile can damage:
    // - Against castle: no lane filter (castle is always hittable)
    // - Otherwise: match the target's layer so ground-ranged→air uses air-only, etc.
    targetLayer: target.isCastle ? null : (target.layer || LAYERS.GROUND),

    isForCastle: !!target.isCastle,
    castleSide: target.castleSide
  };

  pr.el.className = "projectile";
  pr.el.textContent = u.projectileGlyph || "•";
  pr.el.style.left = `${pr.x}px`;
  pr.el.style.top = `${pr.yPx}px`;
  pr.el.style.fontSize = `${PROJECTILE_SIZE_PX}px`;

  arena.appendChild(pr.el);
  state.projectiles.push(pr);
}

// hit

 function onProjectileHit(pr) {
  if (pr.isForCastle) {
    castleDamage(pr.castleSide, pr.dmg);
    emitSplash(pr.x, pr.yPx, `−${pr.dmg}`);
    if (pr.blast > 0) emitAOE(pr.x, pr.yPx);
    return;
  }

  const units = state.units.slice(); // snapshot for stable iteration

  const hits = units.filter(
    (e) =>
      e &&
      e.side !== pr.side &&
      (!pr.targetLayer || e.layer === pr.targetLayer) &&
      Math.abs(e.x - pr.x) < 16
  );

  if (hits.length === 0) return;

  if (pr.blast > 0) {
    emitAOE(pr.x, pr.yPx);
    units.forEach((e) => {
      if (
        e &&
        e.side !== pr.side &&
        (!pr.targetLayer || e.layer === pr.targetLayer) &&
        Math.abs(e.x - pr.x) <= pr.blast
      ) {
        dealDamageRaw(e, pr.dmg);
      }
    });
  } else {
    dealDamageRaw(hits[0], pr.dmg);
  }
}

// REPLACE (your existing signature kept)
function dealDamage(attacker, target, dmg, blast, isMelee = false) {
  if (target.isCastle) {
    castleDamage(target.castleSide, dmg);
    emitSplash(attacker.x, TYPE_BY_KEY[attacker.typeKey].locomotion === "fly" ? 52 : 140, `−${dmg}`);
    if (blast > 0) emitAOE(attacker.x, TYPE_BY_KEY[attacker.typeKey].locomotion === "fly" ? 52 : 140);
    return;
  }

  if (blast > 0) {
    const lane = target.layer;
    emitAOE(target.x, lane === LAYERS.AIR ? 52 : 140);
    // snapshot so removals during splash don’t break iteration
    const units = state.units.slice();
    units.forEach((e) => {
      if (
        e &&
        e.side !== attacker.side &&
        e.layer === lane &&
        Math.abs(e.x - target.x) <= blast
      ) {
        dealDamageRaw(e, dmg);
      }
    });
  } else {
    dealDamageRaw(target, dmg);
  }

  if (isMelee) {
    target.el.classList.add("hit");
    setTimeout(() => target.el && target.el.classList.remove("hit"), 120);
  }
}


  function dealDamageRaw(u, dmg) {
    if (!u || !u.el) return;
    u.hp -= dmg;
    u.hpEl.textContent = hpDots(u.hp);
    emitSplash(u.x, u.layer === LAYERS.AIR ? 52 : 140, `−${dmg}`);
    if (u.hp <= 0) destroyUnit(u);
  }

  function destroyUnit(u) {
    const i = state.units.findIndex((x) => x.id === u.id);
    if (i >= 0) state.units.splice(i, 1);
    if (u.el && u.el.remove) u.el.remove();
  }

  /* -------------------------------------------------------
     Castle collisions & victory
  ------------------------------------------------------- */
  function castleDamage(side, dmg) {
    const c = state.castles[side];
    c.hp = Math.max(0, c.hp - dmg);
    renderCastleHp();
    if (c.hp <= 0) {
      endGame(side === LEFT ? RIGHT : LEFT);
    }
  }

  function checkCastleBreach(u) {
    if (u.side === LEFT && u.x >= ARENA_W() - CASTLE_W) {
      castleDamage(RIGHT, TYPE_BY_KEY[u.typeKey].dmg);
      destroyUnit(u);
      return true;
    }
    if (u.side === RIGHT && u.x <= CASTLE_W) {
      castleDamage(LEFT, TYPE_BY_KEY[u.typeKey].dmg);
      destroyUnit(u);
      return true;
    }
    return false;
  }

  /* -------------------------------------------------------
     Movement & projectile updates
  ------------------------------------------------------- */
function moveUnit(u, dt) {
  // Hold position if any valid target is in forward range
  const range = u.isRanged ? u.range : MELEE_RANGE;
  const hasEnemy = enemiesFor(u).some(e => canTarget(u, e) && inRange(u, e, range));
  if (hasEnemy) return;

  // Move with per-unit speed
  let dx = u.moveSpeedScaled * dt * (u.side === LEFT ? +1 : -1);

  // Simple "hop" motion for jumpers
  if (u.moveType === "jump") {
    u.jumpPhase += dt * GLOBAL_SPEED;
    const phase = (Math.sin(u.jumpPhase * 8) + 1) * 0.5;
    dx *= phase < 0.8 ? 0.5 : 2.0;
  }

  u.x += dx;
  positionUnitEl(u);
}
//move projectiles
   
  function moveProjectiles(dt) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const pr = state.projectiles[i];

      pr.x += pr.speed * dt;
      pr.el.style.left = `${pr.x}px`;

      const outLeft = pr.x < 0;
      const outRight = pr.x > ARENA_W();
      if (outLeft || outRight) {
        pr.el.remove();
        state.projectiles.splice(i, 1);
        continue;
      }

      const enemyCastleZone =
        pr.side === LEFT ? ARENA_W() - CASTLE_W : CASTLE_W;

      if (pr.isForCastle) {
        const hitCastle =
          (pr.side === LEFT && pr.x >= enemyCastleZone) ||
          (pr.side === RIGHT && pr.x <= enemyCastleZone);
        if (hitCastle) {
          onProjectileHit(pr);
          pr.el.remove();
          state.projectiles.splice(i, 1);
        }
      } else {
              const candidate = state.units.find(
                (e) =>
                  e &&
                  e.side !== pr.side &&
                  Math.abs(e.x - pr.x) < 10 &&
                  (!pr.targetLayer || e.layer === pr.targetLayer)
              );

        if (candidate) {
          onProjectileHit(pr);
          pr.el.remove();
          state.projectiles.splice(i, 1);
        }
      }
    }
  }

  /* -------------------------------------------------------
     Draws / Card flow (double chance) + AI parity
  ------------------------------------------------------- */
  // Units currently in production on either side
function inProductionKeys() {
  const s = new Set();
  state.producers.left.forEach(p => s.add(p.typeKey));
  state.producers.right.forEach(p => s.add(p.typeKey));
  return s;
}

// All unit keys that are NOT currently in production (plus any extra excludes)
function availableUnitKeys(extraExcludes = []) {
  const taken = inProductionKeys();
  extraExcludes.forEach(k => taken.add(k));
  return UNIT_TYPES.map(t => t.key).filter(k => !taken.has(k));
}
  
function randomUnitKey(exclude = []) {
  // Only propose from keys not already producing on either side
  const avail = availableUnitKeys(exclude);

  // If somehow exhausted (shouldn’t happen with your roster), fall back to full pool
  const pool = avail.length ? avail : UNIT_TYPES.map(t => t.key);

  return pool[Math.floor(Math.random() * pool.length)];
}

  function setCardActiveUI(active) {
    cardSlot.classList.toggle("active", !!active);
  }

  function showReplaceUI(typeKey) {
    const t = TYPE_BY_KEY[typeKey];
    const alreadyIdx = state.producers.left.findIndex((p) => p.typeKey === typeKey);

    const label = document.createElement("div");
    label.style.fontSize = "12px";
    label.style.opacity = "0.85";
    label.textContent = "Replace a slot:";

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.gap = "6px";
    wrap.style.alignItems = "center";

    state.producers.left.forEach((p, i) => {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = TYPE_BY_KEY[p.typeKey].emoji;
      b.title = `Slot ${i + 1}: ${p.typeKey}`;

      // Keep uniqueness: if the new type already exists in a different slot, disable others
      if (alreadyIdx !== -1 && alreadyIdx !== i) {
        b.className = "btn ghost";
        b.disabled = true;
      }

      b.onclick = () => {
        const ok = replaceProducerSlot(LEFT, i, typeKey);
        statusText.textContent = ok
          ? `Replaced slot ${i + 1} → ${t.emoji}`
          : `Cannot replace (duplicate).`;
        finishCard(true);
      };

      wrap.appendChild(b);
    });

    const rej = document.createElement("button");
    rej.className = "btn ghost";
    rej.textContent = "❌";
    rej.onclick = () => {
      statusText.textContent = `Discarded ${t.emoji}`;
      finishCard(true);
    };

    cardSlot.appendChild(label);
    cardSlot.appendChild(wrap);
    cardSlot.appendChild(rej);
  }

  function clearCard() {
    cardSlot.innerHTML =
      '<div class="placeholder">Draw every 10s — Play or ❌</div>';
    timerBar.style.width = "0%";
    setCardActiveUI(false);
  }

  // triggerParity = true ensures the AI syncs its active count to the player
  function finishCard(triggerParity = false) {
    state.timers.leftKey = null;
    state.timers.leftStage = 0;
    clearCard();
    if (triggerParity) enforceParity();
    setTimeout(() => drawFirst(LEFT), TURN_MS);
  }

  function showCardPlayer(typeKey, stage) {
    setCardActiveUI(true);

    const t = TYPE_BY_KEY[typeKey];
    cardSlot.innerHTML = "";

    const big = document.createElement("div");
    big.className = "big";
    big.textContent = t.emoji;
    cardSlot.appendChild(big);

    // If 2nd chance and a free slot exists, auto-play immediately
    if (stage === 2 && state.producers.left.length < MAX_ACTIVE_TYPES) {
      const ok = addProducer(LEFT, typeKey);
      statusText.textContent = ok
        ? `2nd card auto-played ${t.emoji}`
        : `Could not add ${t.emoji}`;
      finishCard(true);
      return;
    }

    const canAdd =
      state.producers.left.length < MAX_ACTIVE_TYPES &&
      !state.producers.left.some((p) => p.typeKey === typeKey);

    if (canAdd) {
      const play = document.createElement("button");
      play.className = "btn";
      play.textContent = "Play";
      play.onclick = () => {
        const ok = addProducer(LEFT, typeKey);
        statusText.textContent = ok ? `Activated ${t.emoji}` : `Cannot add.`;
        finishCard(true);
      };

      const rej = document.createElement("button");
      rej.className = "btn ghost";
      rej.textContent = "❌";
      rej.onclick = () => {
        if (stage === 1) {
          // Move to the second chance immediately
          state.timers.leftStage = 2;
          state.timers.leftKey = randomUnitKey(
            state.producers.left.map((p) => p.typeKey)
          );
          showCardPlayer(state.timers.leftKey, 2);
          runTimerBar(TURN_MS);
        } else {
          statusText.textContent = `2nd card discarded`;
          finishCard(true);
        }
      };

      cardSlot.appendChild(play);
      cardSlot.appendChild(rej);
    } else {
      // Full: show slot replacement UI or allow discard
      showReplaceUI(typeKey);
    }

    runTimerBar(TURN_MS);
  }

  function runTimerBar(ms) {
    const start = now();
    const tick = () => {
      if (!state.timers.leftKey) {
        timerBar.style.width = "0%";
        return;
      }
      const p = clamp((now() - start) / ms, 0, 1);
      timerBar.style.width = `${(1 - p) * 100}%`;
      if (p < 1 && state.running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function drawFirst(side) {
    if (!state.running) return;

    const avoid = state.producers[side].map((p) => p.typeKey);
    const key = randomUnitKey(avoid);

    if (side === LEFT) {
      state.timers.leftStage = 1;
      state.timers.leftKey = key;
      showCardPlayer(key, 1);

      // Auto-trigger second chance if the first expires
      setTimeout(() => {
        if (state.timers.leftKey === key && state.timers.leftStage === 1) {
          state.timers.leftStage = 2;
          state.timers.leftKey = randomUnitKey(
            state.producers.left.map((p) => p.typeKey)
          );
          showCardPlayer(state.timers.leftKey, 2);
        }
      }, TURN_MS);
    }
  }

  // Keep AI with the same number of active types as the player
  function enforceParity() {
    const target = state.producers.left.length;
    while (state.producers.right.length < target) {
      const avoid = state.producers.right.map((p) => p.typeKey);
      const key = randomUnitKey(avoid);
      if (!addProducer(RIGHT, key)) {
        const idx = Math.floor(Math.random() * state.producers.right.length);
        replaceProducerSlot(RIGHT, idx, key);
      }
    }
  }

  /* -------------------------------------------------------
     Game loop / end
  ------------------------------------------------------- */
function pruneUnits() {
  state.units = state.units.filter((u) => u && u.el);
}

function loop() {
  if (!state.running) return;
  pruneUnits(); // <-- add this

  const t = performance.now();
  const dt = clamp((t - state.lastTime) / 1000, 0, 0.05);
  state.lastTime = t;

  tickProducers();

  for (let i = state.units.length - 1; i >= 0; i--) {
    const u = state.units[i];
    if (!u || !u.el) continue;
    if (checkCastleBreach(u)) continue;
    moveUnit(u, dt);
    tryAttack(u);
  }

  moveProjectiles(dt);
  requestAnimationFrame(loop);
}

  function endGame(winnerSide) {
    state.running = false;
    endText.textContent =
      (winnerSide === LEFT ? "🏰 Left" : "🏯 Right") + " wins!";
    endOverlay.classList.remove("hidden");
  }

  /* -------------------------------------------------------
     Init
  ------------------------------------------------------- */
  function init() {
    // Grab DOM nodes now (safe with defer or DOMContentLoaded)
    arena = document.getElementById("arena");
    leftHpEl = document.getElementById("leftHp");
    rightHpEl = document.getElementById("rightHp");
    leftActivesEl = document.getElementById("leftActives");
    rightActivesEl = document.getElementById("rightActives");
    statusText = document.getElementById("statusText");
    cardSlot = document.getElementById("cardSlot");
    timerBar = document.getElementById("turnTimerBar");
    endOverlay = document.getElementById("endOverlay");
    endText = document.getElementById("endText");
    restartBtn = document.getElementById("restartBtn");
    leftCastleEl = document.getElementById("leftCastle");
    rightCastleEl = document.getElementById("rightCastle");

    if (restartBtn) {
      restartBtn.addEventListener("click", () => location.reload());
    }

    // Responsive castle size
    const w = ARENA_W();
    const castleSize = Math.max(42, Math.min(64, Math.floor(w / 22)));
    document.documentElement.style.setProperty(
      "--castleSize",
      castleSize + "px"
    );

    // Scenery
    makeClouds();
    makeTrees();
    makeMidFeature();
    makeMeadow();
    window.addEventListener("resize", () => {
    makeClouds();
    makeTrees();
    makeMidFeature();
    makeMeadow();
    });

    // HP / initial UI
    renderCastleHp();

    // Start conditions:
    state.lastTime = performance.now();

    // Start symmetric: both have one active to begin with (medium melee)
    addProducer(LEFT, "ant");
    addProducer(RIGHT, "caterpillar");

    // First draw for the player; AI parity will keep up afterwards
    drawFirst(LEFT);

    // Run loop
    requestAnimationFrame(loop);



  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();


