/* Castles Clash — tunable build
   Turn flow:
   - Each turn rolls 4 distinct units not already active: [P1,P2, A1,A2]
   - Player picks one of P1,P2 (no discard). If full, replace a slot for that chosen unit.
   - AI randomly picks one of A1,A2; if full, it replaces a slot.
*/

(function () {
  /* =======================================================
     CONFIG — tweak here to rebalance quickly
  ======================================================= */
  const CONFIG = {
    GLOBAL_SPEED: 0.2,            // <1 slower, >1 faster (affects most rates)
    TURN_MS: 8000,                // ms per turn (player choice window)
    AUTOPICK_PROB: 0.5,           // probability to auto-pick P1 vs P2 on timeout

    // Arena / castles
    CASTLE_W_PX: 80,              // castle collision width
    CASTLE_HP_BASE: 18,           // starting HP per castle
    CASTLE_CONTACT_DMG_MULT: 1.0, // melee contact dmg multiplier vs castle
    SPAWN_MARGIN_PX: 14,          // distance from castle face to spawn x

    // Movement / frame
    MAX_FRAME_DT: 0.05,           // clamp dt in seconds

    // Combat
    MELEE_RANGE_PX: 28,

    // Projectiles
    PROJ_SPEED_BASE: 320,
    PROJ_SIZE_PX: 7,
    PROJ_HIT_RADIUS_PX: 12,       // unify hit epsilon for projectiles
    PROJ_Y: { AIR: 52, GROUND: 140 }, // lane Y positions (px)

    // Jumpers (horizontal “hop” modulation)
    JUMP: {
      PHASE_SPEED: 8,             // frequency scalar
      DUTY_THRESHOLD: 0.8,        // 0..1 threshold between slow vs fast phase
      SLOW_MULT: 0.5,             // dx multiplier during slow part
      FAST_MULT: 2.5,             // dx multiplier during fast burst
      BASE_MULT: 1.5,             // overall dx multiplier for jumpers
      SKIP_ENEMIES_ONCE: 1        // how many first enemies to skip (0 = off)
    },

    // UI
    READY_LABEL_MS: 120,          // when cooldown shows "ready"
    MAX_ACTIVE_TYPES: 6,

    // Scenery tuning
    CLOUD_COUNT_MAX: 10,
    CLOUD_COUNT_MIN: 4,
    CLOUD_SIZE_RANGE: [36, 56],
    CLOUD_TOP_RANGE: [8, 70],
    CLOUD_SPEED_RANGE: [18, 30],
    TREE_COUNT: 18,
    MID_FEATURES: [
      { emoji: "🗻", weight: 1, min: 40, max: 72, scale: 1.5 },
    ],
    MIDFEATURE_SIZE_FACTOR: 1 / 14,
    MIDFEATURE_SINK_PX: 0,
    MIDFEATURE_JITTER: 0.0,
    MEADOW_ITEMS: [
      { emoji: "🌼", weight: 3, scale: [0.75, 1.15] },
      { emoji: "🌾", weight: 2, scale: [0.85, 1.20] },
    ],
    MEADOW_COUNT_MAX: 36,
    MEADOW_COUNT_MIN: 12,
    MEADOW_BOTTOM_RANGE: [4, 16],
    MEADOW_ROTATION_DEG: [-6, 6],
    MEADOW_OPACITY_RANGE: [0.85, 1],
    MEADOW_SIDE_MARGIN: 16,
  };

  /* -------------------------------------------------------
     Derived helpers from CONFIG
  ------------------------------------------------------- */
  const scaleSpeed = (v) => v * CONFIG.GLOBAL_SPEED;
  const scaleTime = (ms) => ms / CONFIG.GLOBAL_SPEED;

  const LEFT = "left";
  const RIGHT = "right";
  const LAYERS = { GROUND: "ground", AIR: "air" };

  /* =======================================================
     ROSTER
  ======================================================= */
  const P = (n) => n;
  const UNIT_TYPES = [
    // Tanks
    { key:"蜥脚类动物", emoji:"🦕", size:60, hp:P(21), dmg:P(1), atkMs:620, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:100,  moveType:"advance", locomotion:"walk", production:2000,  mounted:false },
    { key:"凤凰",  emoji:"🐦‍🔥", size:40, hp:P(21), dmg:P(1), atkMs:620, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:100,  moveType:"advance", locomotion:"fly",  production:2000,  mounted:false },

    // Unique Attacker
    { key:"рекс",      emoji:"🦖",  size:40, hp:P(5), dmg:P(13), atkMs:100, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:200,  moveType:"advance", locomotion:"walk", production:3000,  mounted:false  },

    // Rushers
    { key:"soavaly",    emoji:"🏇",  size:30, hp:P(3), dmg:P(3), atkMs:380, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:350, moveType:"advance", locomotion:"walk", production:300,   mounted:true  },
    { key:"zebra",    emoji:"🦓",  size:30, hp:P(3), dmg:P(3), atkMs:380, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:350, moveType:"advance", locomotion:"walk", production:300,   mounted:true  },
    { key:"voromahery",    emoji:"🦅",  size:26, hp:P(2), dmg:P(3), atkMs:500, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:350, moveType:"jump",    locomotion:"fly",  production:300, mounted:false },
    { key:"ramanavy",      emoji:"🦇",  size:26, hp:P(2), dmg:P(3), atkMs:500, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:300, moveType:"jump",    locomotion:"fly",  production:300, mounted:false },

    // Submerger Melee
    { key:"人魚",   emoji:"🧜‍♂️", size:28, hp:P(5), dmg:P(5),  atkMs:650, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:140, moveType:"advance", locomotion:"walk", production:200, mounted:false },
    { key:"蜂",      emoji:"🐝",  size:30, hp:P(5), dmg:P(5),  atkMs:520, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:140, moveType:"advance", locomotion:"fly",  production:250, mounted:true  },

    // Starter melee
    { key:"ant",         emoji:"🐜", size:22, hp:P(5), dmg:P(3), atkMs:360, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:160, moveType:"advance", locomotion:"walk", production:800,  mounted:true  },
    { key:"caterpillar", emoji:"🐛", size:22, hp:P(5), dmg:P(3), atkMs:360, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:160, moveType:"advance", locomotion:"walk", production:800,  mounted:true  },

    // cavalry archer
    { key:"stag",     emoji:"🦌", size:22, hp:P(5), dmg:P(5),  atkMs:300, range:180, projectile:"•", blast:0, moveSpeed:200, moveType:"advance", locomotion:"walk", production:2800, mounted:true  },
    { key:"camel",    emoji:"🐫", size:22, hp:P(5), dmg:P(5),  atkMs:300, range:180, projectile:"•", blast:0, moveSpeed:200, moveType:"advance", locomotion:"walk", production:2800, mounted:true  },
    { key:"mosquito", emoji:"🦟", size:27, hp:P(5), dmg:P(5),  atkMs:300, range:180, projectile:"•", blast:0, moveSpeed:200, moveType:"advance", locomotion:"fly",  production:2800, mounted:true  },

    // jumpers
    { key:"カンガルー", emoji:"🦘",  size:25, hp:P(5), dmg:P(3), atkMs:420, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:165, moveType:"jump", locomotion:"walk", production:1400, mounted:true  },
    { key:"クリケット",  emoji:"🦗",  size:25, hp:P(5), dmg:P(3), atkMs:420, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:165, moveType:"jump", locomotion:"walk", production:1400, mounted:true  },

    // mounted/balanced melee
    { key:"老虎",    emoji:"🐅",  size:35, hp:P(8), dmg:P(8), atkMs:400, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:120, moveType:"advance", locomotion:"walk", production:3200, mounted:false  },
    { key:"公羊",      emoji:"🐏",  size:25, hp:P(8), dmg:P(5), atkMs:400, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:0, moveSpeed:120, moveType:"advance", locomotion:"walk", production:3200, mounted:true },

    // Blaster
    { key:"butterfly", emoji:"🦋", size:26, hp:P(5), dmg:P(8), atkMs:480, range:180, projectile:"•",  blast:100, moveSpeed:120, moveType:"advance", locomotion:"walk", production:2200, mounted:false },
    { key:"squid",     emoji:"🐙", size:26, hp:P(5), dmg:P(8), atkMs:480, range:180, projectile:"•",  blast:100, moveSpeed:120, moveType:"advance", locomotion:"walk", production:2200, mounted:false },
    { key:"mammoth",   emoji:"🦣", size:36, hp:P(8), dmg:P(8), atkMs:400, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:100, moveSpeed:500, moveType:"advance", locomotion:"walk", production:1800, mounted:true  },
    { key:"rhino",     emoji:"🦏", size:36, hp:P(8), dmg:P(8), atkMs:400, range:CONFIG.MELEE_RANGE_PX, projectile:null, blast:100, moveSpeed:500, moveType:"advance", locomotion:"walk", production:1800, mounted:true  },

    // RANGED NUKE
    { key:"matoatoa",     emoji:"👻", size:28, hp:P(1), dmg:P(21), atkMs:650, range:170, projectile:"⭐", blast:0, moveSpeed:220, moveType:"advance", locomotion:"walk", production:9000, mounted:false },
    { key:"vahiny",     emoji:"👾", size:28, hp:P(1), dmg:P(21), atkMs:700, range:140, projectile:"🌀", blast:0, moveSpeed:250, moveType:"advance", locomotion:"fly",  production:9000, mounted:false },

    // Unique short-range medium
    { key:"пингвин",   emoji:"🐧", size:22, hp:P(3), dmg:P(3), atkMs:75, range:100,  projectile:"❄️", blast:0, moveSpeed:100, moveType:"advance", locomotion:"walk", production:2000, mounted:false },

    // Long-range snipers
    { key:"фея",     emoji:"🧚", size:24, hp:P(3), dmg:P(5), atkMs:1200, range:600, projectile:"⚡", blast:0, moveSpeed:25, moveType:"advance", locomotion:"fly",  production:3000, mounted:false },
    { key:"русалка",   emoji:"🧜‍♀️", size:28, hp:P(4), dmg:P(5), atkMs:1200, range:600, projectile:"💧", blast:0, moveSpeed:25, moveType:"advance", locomotion:"walk", production:3200, mounted:false },

    // heavy attacker
    { key:"龙",    emoji:"🐉", size:45, hp:P(13), dmg:P(13), atkMs:500, range:260, projectile:"🔥", blast:50, moveSpeed:60, moveType:"advance", locomotion:"walk", production:12000, mounted:false  },
  ];

  // precompute scaled speeds/timings
  for (const t of UNIT_TYPES) {
    t.atkMsScaled = scaleTime(t.atkMs);
    t.productionScaled = scaleTime(t.production);
    t.moveSpeedScaled = scaleSpeed(t.moveSpeed);
  }
  const TYPE_BY_KEY = Object.fromEntries(UNIT_TYPES.map(t => [t.key, t]));

  /* =======================================================
     STATE
  ======================================================= */
  const state = {
    running: true,
    lastTime: 0,
    units: [],
    projectiles: [],
    producers: { left: [], right: [] }, // [{ typeKey, nextSpawn }]
    castles: { left: { hp: CONFIG.CASTLE_HP_BASE }, right: { hp: CONFIG.CASTLE_HP_BASE } },
    timers: {
      quartet: null,       // [P1,P2,A1,A2]
      turnActive: false,
      turnStartedAt: 0
    }
  };

  /* =======================================================
     DOM
  ======================================================= */
  let arena, leftHpEl, rightHpEl, leftActivesEl, rightActivesEl;
  let statusText, cardSlot, timerBar, endOverlay, endText, restartBtn;
  let leftCastleEl, rightCastleEl;

  const ARENA_W = () => arena.getBoundingClientRect().width;
  const LEFT_SPAWN_X  = () => CONFIG.CASTLE_W_PX + CONFIG.SPAWN_MARGIN_PX;
  const RIGHT_SPAWN_X = () => ARENA_W() - CONFIG.CASTLE_W_PX - CONFIG.SPAWN_MARGIN_PX;

  /* =======================================================
     Utils
  ======================================================= */
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

  /* =======================================================
     Scenery
  ======================================================= */
  function pickWeighted(items) {
    const total = items.reduce((s, it) => s + (it.weight || 1), 0);
    let r = Math.random() * total;
    for (const it of items) {
      r -= (it.weight || 1);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }
  const CLOUD_COUNT = (w) =>
    Math.round(Math.min(CONFIG.CLOUD_COUNT_MAX, Math.max(CONFIG.CLOUD_COUNT_MIN, w / 160)));

  function makeClouds() {
    const host = document.getElementById("clouds");
    if (!host) return;
    host.innerHTML = "";
    const w = ARENA_W();
    const n = CLOUD_COUNT(w);

    for (let i = 0; i < n; i++) {
      const spec = pickWeighted([{ emoji:"☁️", weight:3 }, { emoji:"🌧️", weight:1 }]);

      const c = document.createElement("div");
      c.className = "cloud";
      c.textContent = spec.emoji;

      const top = CONFIG.CLOUD_TOP_RANGE[0] +
        Math.random() * (CONFIG.CLOUD_TOP_RANGE[1] - CONFIG.CLOUD_TOP_RANGE[0]);
      c.style.top = `${top}px`;

      const size = CONFIG.CLOUD_SIZE_RANGE[0] +
        Math.random() * (CONFIG.CLOUD_SIZE_RANGE[1] - CONFIG.CLOUD_SIZE_RANGE[0]);
      c.style.fontSize = `${size}px`;

      c.style.left = `${Math.random() * w}px`;

      const dur = CONFIG.CLOUD_SPEED_RANGE[0] +
        Math.random() * (CONFIG.CLOUD_SPEED_RANGE[1] - CONFIG.CLOUD_SPEED_RANGE[0]);
      c.style.animationDuration = `${dur}s`;
      c.style.animationDelay = `${-Math.random() * dur}s`;

      host.appendChild(c);
    }
  }

  function makeMidFeature() {
    const sky = document.getElementById("sky");
    if (!sky) return;

    const old = document.getElementById("midFeatureSprite");
    if (old) old.remove();

    const cfg = pickWeighted(CONFIG.MID_FEATURES);

    const base = Math.floor(ARENA_W() * CONFIG.MIDFEATURE_SIZE_FACTOR);
    const jitter = base * CONFIG.MIDFEATURE_JITTER * (Math.random() * 2 - 1);
    const size = Math.max(cfg.min ?? 36, Math.min(cfg.max ?? 72, base + jitter));

    const el = document.createElement("div");
    el.id = "midFeatureSprite";
    el.textContent = cfg.emoji;
    el.style.position = "absolute";
    el.style.left = "50%";
    el.style.bottom = "0";
    el.style.transform =
      `translateX(-50%) translateY(${CONFIG.MIDFEATURE_SINK_PX}px) scale(${cfg.scale ?? 1})`;
    el.style.lineHeight = "1";
    el.style.fontSize = `${size}px`;
    el.style.opacity = "0.95";

    sky.appendChild(el);
  }

  function makeMeadow() {
    const host = document.getElementById("meadow");
    if (!host) return;
    host.innerHTML = "";

    const w = ARENA_W();
    const n = Math.round(Math.min(CONFIG.MEADOW_COUNT_MAX, Math.max(CONFIG.MEADOW_COUNT_MIN, w / 35)));

    for (let i = 0; i < n; i++) {
      const spec = pickWeighted(CONFIG.MEADOW_ITEMS);

      const el = document.createElement("div");
      el.className = "flora";
      el.textContent = spec.emoji;
      el.style.position = "absolute";

      el.style.left =
        `${CONFIG.MEADOW_SIDE_MARGIN + Math.random() * (w - 2 * CONFIG.MEADOW_SIDE_MARGIN)}px`;

      const bot = CONFIG.MEADOW_BOTTOM_RANGE[0] +
        Math.random() * (CONFIG.MEADOW_BOTTOM_RANGE[1] - CONFIG.MEADOW_BOTTOM_RANGE[0]);
      el.style.bottom = `${bot}px`;

      const scRange = spec.scale || [0.9, 1.1];
      const sc = scRange[0] + Math.random() * (scRange[1] - scRange[0]);
      const rot = CONFIG.MEADOW_ROTATION_DEG[0] +
        Math.random() * (CONFIG.MEADOW_ROTATION_DEG[1] - CONFIG.MEADOW_ROTATION_DEG[0]);
      el.style.transform = `scale(${sc}) rotate(${rot}deg)`;

      const op = CONFIG.MEADOW_OPACITY_RANGE[0] +
        Math.random() * (CONFIG.MEADOW_OPACITY_RANGE[1] - CONFIG.MEADOW_OPACITY_RANGE[0]);
      el.style.opacity = `${op}`;

      host.appendChild(el);
    }
  }

  function makeTrees() {
    const host = document.getElementById("trees");
    if (!host) return;

    host.innerHTML = "";
    const n = CONFIG.TREE_COUNT;
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

  /* =======================================================
     Castles
  ======================================================= */
  function castleGlowColors(hp) {
    const p = hp / CONFIG.CASTLE_HP_BASE;
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

  /* =======================================================
     Active types UI
  ======================================================= */
  function renderActives(side) {
    const host = side === LEFT ? leftActivesEl : rightActivesEl;
    host.innerHTML = "";

    state.producers[side].forEach((p) => {
      const t = TYPE_BY_KEY[p.typeKey];

      const wrap = document.createElement("div");
      wrap.className = "activeType tooltip";
      wrap.setAttribute("data-title",
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

      const cd = document.createElement("div");
      cd.className = "cd";

      wrap.appendChild(face);
      wrap.appendChild(prog);
      wrap.appendChild(cd);
      host.appendChild(wrap);

      const remaining = Math.max(0, p.nextSpawn - now());
      const pct = 100 - clamp((remaining / t.productionScaled) * 100, 0, 100);
      fill.style.width = `${pct}%`;
      cd.textContent = remaining <= CONFIG.READY_LABEL_MS ? "ready" : `${(remaining / 1000).toFixed(1)}s`;
    });
  }

  /* =======================================================
     Producers & spawning
  ======================================================= */
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
      skipCount: 0,

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

    // Rider decoration on mounted units
    if (t.mounted) {
      const RIDER_TO_MOUNT_RATIO  = 0.75;
      const EQUIP_TO_RIDER_RATIO  = 0.50;
      const RIDER_OFFSET_Y_PX     = 0;
      const EQUIP_OFFSET_FWD_PX   = 0;
      const EQUIP_OFFSET_UP_PX    = 0;

      const rider = document.createElement("div");
      rider.className = "rider";
      rider.textContent = "🧎🏻";
      const riderFont = Math.max(12, t.size * RIDER_TO_MOUNT_RATIO);
      rider.style.fontSize = `${riderFont}px`;
      rider.style.position = "absolute";
      rider.style.left = "50%";
      rider.style.top = `${RIDER_OFFSET_Y_PX}px`;
      rider.style.transform = `translateX(-50%) ${side===LEFT ? 'scaleX(-1)' : 'scaleX(1)'}`;
      rider.style.lineHeight = "1";

      const equip = document.createElement("div");
      equip.className = "equip";
      equip.textContent = t.projectile ? "🏹" : "🛡️";
      equip.style.position = "absolute";
      equip.style.left = "50%";
      equip.style.top = "50%";
      equip.style.fontSize = `${Math.round(riderFont * EQUIP_TO_RIDER_RATIO)}px`;
      const fwd = (side === LEFT ? 1 : -1) * EQUIP_OFFSET_FWD_PX;
      equip.style.transform =
        `translate(-50%, -50%) translate(${fwd}px, ${EQUIP_OFFSET_UP_PX}px) ` +
        `${side===LEFT ? 'scaleX(-1)' : 'scaleX(1)'}`;
      equip.style.lineHeight = "1";
      equip.style.pointerEvents = "none";
      equip.style.zIndex = "2";

      rider.appendChild(equip);
      el.appendChild(rider);
    }

    const face = document.createElement("div");
    face.className = "emoji";
    face.style.fontSize = `${t.size}px`;
    face.textContent = t.emoji;
    face.style.transform = side===LEFT ? 'scaleX(-1)' : 'scaleX(1)';

    el.appendChild(hpEl);
    el.appendChild(face);
    arena.appendChild(el);

    u.el = el; u.hpEl = hpEl; u.faceEl = face;
    state.units.push(u);
    positionUnitEl(u);
    return u;
  }

  function positionUnitEl(u) { u.el.style.left = `${u.x}px`; }

  function addProducer(side, typeKey) {
    if (state.producers[side].some((p) => p.typeKey === typeKey)) return false;
    if (state.producers[side].length >= CONFIG.MAX_ACTIVE_TYPES) return false;
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

  /* =======================================================
     Combat & movement
  ======================================================= */
  function canTarget(att, tar) {
    if (tar.isCastle) return true;
    if (!att.isRanged) return att.layer === tar.layer;
    if (att.layer === LAYERS.GROUND) return tar.layer === LAYERS.GROUND || tar.layer === LAYERS.AIR;
    return tar.layer === LAYERS.AIR;
  }
  function enemiesFor(u)   { return state.units.filter((v) => v && v.side !== u.side); }
  const facingOK = (att, tar) => !!tar && (att.side === LEFT ? tar.x >= att.x : tar.x <= att.x);
  const inRange  = (att, tar, range) => !!tar && facingOK(att, tar) && Math.abs(att.x - tar.x) <= range;
  const distX    = (a, b) => Math.abs((a?.x || 0) - (b?.x || 0));

  function tryAttack(u) {
    if (now() < u.nextAtk) return;
    const range = u.isRanged ? u.range : CONFIG.MELEE_RANGE_PX;

    const candidates = enemiesFor(u)
      .filter((e) => canTarget(u, e) && inRange(u, e, range))
      .sort((a, b) => distX(u, a) - distX(u, b));

    if (u.moveType === "jump" && u.skipCount < CONFIG.JUMP.SKIP_ENEMIES_ONCE && candidates.length) {
      u.skipCount++;
      return;
    }

    let target = null;
    if (candidates.length === 2) target = candidates[Math.floor(Math.random() * 2)];
    else if (candidates.length > 0) target = candidates[0];

    if (!target && u.isRanged) {
      const castleX = u.side === LEFT ? ARENA_W() - CONFIG.CASTLE_W_PX / 2 : CONFIG.CASTLE_W_PX / 2;
      const dummy = { x: castleX, layer: LAYERS.GROUND, isCastle: true, castleSide: u.side === LEFT ? RIGHT : LEFT };
      if (inRange(u, dummy, range)) target = dummy;
    }
    if (!target) return;

    if (u.isRanged) shoot(u, target);
    else            dealDamage(u, target, u.dmg, u.blast, true);

    u.nextAtk = now() + u.atkMsScaled;
  }

  function shoot(u, target) {
    const yPx =
      (target.layer === LAYERS.AIR || u.layer === LAYERS.AIR)
        ? CONFIG.PROJ_Y.AIR
        : CONFIG.PROJ_Y.GROUND;

    const pr = {
      id: newId(),
      side: u.side,
      x: u.x,
      yPx,
      speed: u.side === LEFT ? scaleSpeed(CONFIG.PROJ_SPEED_BASE) : -scaleSpeed(CONFIG.PROJ_SPEED_BASE),
      dmg: u.dmg,
      blast: u.blast || 0,
      el: document.createElement("div"),
      targetLayer: target.isCastle ? null : (target.layer || LAYERS.GROUND),
      isForCastle: !!target.isCastle,
      castleSide: target.castleSide
    };

    pr.el.className = "projectile";
    pr.el.textContent = u.projectileGlyph || "•";
    pr.el.style.left = `${pr.x}px`;
    pr.el.style.top = `${pr.yPx}px`;
    pr.el.style.fontSize = `${CONFIG.PROJ_SIZE_PX}px`;

    arena.appendChild(pr.el);
    state.projectiles.push(pr);
  }

  function onProjectileHit(pr) {
    if (pr.isForCastle) {
      castleDamage(pr.castleSide, pr.dmg);
      emitSplash(pr.x, pr.yPx, `−${pr.dmg}`);
      if (pr.blast > 0) emitAOE(pr.x, pr.yPx);
      return;
    }

    const units = state.units.slice();
    const hits = units.filter(
      (e) =>
        e &&
        e.side !== pr.side &&
        (!pr.targetLayer || e.layer === pr.targetLayer) &&
        Math.abs(e.x - pr.x) < CONFIG.PROJ_HIT_RADIUS_PX
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

  function dealDamage(attacker, target, dmg, blast, isMelee = false) {
    if (target.isCastle) {
      const applied = Math.round(dmg * CONFIG.CASTLE_CONTACT_DMG_MULT);
      castleDamage(target.castleSide, applied);
      const laneY = TYPE_BY_KEY[attacker.typeKey].locomotion === "fly" ? CONFIG.PROJ_Y.AIR : CONFIG.PROJ_Y.GROUND;
      emitSplash(attacker.x, laneY, `−${applied}`);
      if (blast > 0) emitAOE(attacker.x, laneY);
      return;
    }

    if (blast > 0) {
      const lane = target.layer;
      emitAOE(target.x, lane === LAYERS.AIR ? CONFIG.PROJ_Y.AIR : CONFIG.PROJ_Y.GROUND);
      const units = state.units.slice();
      units.forEach((e) => {
        if (e && e.side !== attacker.side && e.layer === lane && Math.abs(e.x - target.x) <= blast) {
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
    const laneY = u.layer === LAYERS.AIR ? CONFIG.PROJ_Y.AIR : CONFIG.PROJ_Y.GROUND;
    emitSplash(u.x, laneY, `−${dmg}`);
    if (u.hp <= 0) destroyUnit(u);
  }

  function destroyUnit(u) {
    const i = state.units.findIndex((x) => x.id === u.id);
    if (i >= 0) state.units.splice(i, 1);
    if (u.el && u.el.remove) u.el.remove();
  }

  /* =======================================================
     Castle collisions & victory
  ======================================================= */
  function castleDamage(side, dmg) {
    const c = state.castles[side];
    c.hp = Math.max(0, c.hp - dmg);
    renderCastleHp();
    if (c.hp <= 0) endGame(side === LEFT ? RIGHT : LEFT);
  }

  function checkCastleBreach(u) {
    if (u.side === LEFT && u.x >= ARENA_W() - CONFIG.CASTLE_W_PX) {
      castleDamage(RIGHT, Math.round(TYPE_BY_KEY[u.typeKey].dmg * CONFIG.CASTLE_CONTACT_DMG_MULT));
      destroyUnit(u); return true;
    }
    if (u.side === RIGHT && u.x <= CONFIG.CASTLE_W_PX) {
      castleDamage(LEFT, Math.round(TYPE_BY_KEY[u.typeKey].dmg * CONFIG.CASTLE_CONTACT_DMG_MULT));
      destroyUnit(u); return true;
    }
    return false;
  }

  /* =======================================================
     Movement & projectile updates
  ======================================================= */
  function moveUnit(u, dt) {
    // Hold if enemy in (forward) range
    const range = u.isRanged ? u.range : CONFIG.MELEE_RANGE_PX;
    const hasEnemy = enemiesFor(u).some(e => canTarget(u, e) && inRange(u, e, range));
    if (hasEnemy) return;

    // Base dx
    let dx = u.moveSpeedScaled * dt * (u.side === LEFT ? +1 : -1);

    // Jump modulation
    if (u.moveType === "jump") {
      dx *= CONFIG.JUMP.BASE_MULT;
      u.jumpPhase += dt * CONFIG.GLOBAL_SPEED * CONFIG.JUMP.PHASE_SPEED;
      const phase01 = (Math.sin(u.jumpPhase) + 1) * 0.5;
      dx *= phase01 < CONFIG.JUMP.DUTY_THRESHOLD ? CONFIG.JUMP.SLOW_MULT : CONFIG.JUMP.FAST_MULT;
    }

    u.x += dx;
    positionUnitEl(u);
  }

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

      const enemyCastleZone = pr.side === LEFT ? ARENA_W() - CONFIG.CASTLE_W_PX : CONFIG.CASTLE_W_PX;

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
            Math.abs(e.x - pr.x) < CONFIG.PROJ_HIT_RADIUS_PX &&
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

  /* =======================================================
     Turn system (4-roll; P picks 1 of first 2; AI picks random of last 2)
  ======================================================= */
  function inProductionKeys() {
    const s = new Set();
    state.producers.left.forEach(p => s.add(p.typeKey));
    state.producers.right.forEach(p => s.add(p.typeKey));
    return s;
  }
  function availableUnitKeys(extraExcludes = []) {
    const taken = inProductionKeys();
    extraExcludes.forEach(k => taken.add(k));
    return UNIT_TYPES.map(t => t.key).filter(k => !taken.has(k));
  }
  function pickNDistinct(n, excludes = []) {
    const avail = availableUnitKeys(excludes);
    const pool = (avail.length >= n) ? avail : UNIT_TYPES.map(t => t.key);
    const res = [];
    const used = new Set(excludes);
    let guard = 0;
    while (res.length < n && guard++ < 500) {
      const k = pool[Math.floor(Math.random() * pool.length)];
      if (!used.has(k)) { used.add(k); res.push(k); }
      if (used.size >= UNIT_TYPES.length) break;
    }
    while (res.length < n) res.push(pool[Math.floor(Math.random() * pool.length)]);
    return res;
  }

  function setCardActiveUI(active) {
    cardSlot.classList.toggle("active", !!active);
  }
  function clearCard() {
    cardSlot.innerHTML = '<div class="placeholder">Every turn — pick 1 of 2</div>';
    timerBar.style.width = "0%";
    setCardActiveUI(false);
  }
  function runTimerBar(ms) {
    const start = now();
    const tick = () => {
      if (!state.timers.turnActive) { timerBar.style.width = "0%"; return; }
      const p = clamp((now() - start) / ms, 0, 1);
      timerBar.style.width = `${(1 - p) * 100}%`;
      if (p < 1 && state.running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function startNextTurn() {
    if (!state.running) return;

    const excludes = Array.from(inProductionKeys());
    const [p1, p2, a1, a2] = pickNDistinct(4, excludes);

    state.timers.quartet = [p1, p2, a1, a2];
    state.timers.turnActive = true;
    state.timers.turnStartedAt = now();

    showPlayerChoices(p1, p2);
    runTimerBar(CONFIG.TURN_MS);

    // Auto-pick
    setTimeout(() => {
      if (!state.running) return;
      const q = state.timers.quartet;
      if (state.timers.turnActive && q && q[0] === p1 && q[1] === p2) {
        const auto = Math.random() < CONFIG.AUTOPICK_PROB ? p1 : p2;
        resolvePlayerPick(auto, /*auto*/true);
      }
    }, CONFIG.TURN_MS);
  }

  function showPlayerChoices(k1, k2) {
    setCardActiveUI(true);
    cardSlot.innerHTML = "";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.alignItems = "center";
    row.style.justifyContent = "center";

    [k1, k2].forEach((k) => {
      const t = TYPE_BY_KEY[k];

      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.alignItems = "center";
      wrap.style.gap = "6px";

      const big = document.createElement("div");
      big.className = "big";
      big.textContent = t.emoji;

      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = `Choose ${t.key}`;
      btn.onclick = () => resolvePlayerPick(k, /*auto*/false);

      wrap.appendChild(big);
      wrap.appendChild(btn);
      row.appendChild(wrap);
    });

    cardSlot.appendChild(row);
  }

  function resolvePlayerPick(k, auto) {
    if (!state.timers.turnActive) return;

    const t = TYPE_BY_KEY[k];
    const canAdd =
      state.producers.left.length < CONFIG.MAX_ACTIVE_TYPES &&
      !state.producers.left.some(p => p.typeKey === k);

    if (canAdd) {
      const ok = addProducer(LEFT, k);
      statusText.textContent = ok
        ? (auto ? `Auto-picked ${t.emoji}` : `Activated ${t.emoji}`)
        : `Cannot add.`;
      resolveAIChoice();
    } else {
      // replacement UI for THIS unit only
      cardSlot.innerHTML = "";
      showReplaceUIForTurn(k);
      runTimerBar(CONFIG.TURN_MS);
    }
  }

  function showReplaceUIForTurn(typeKey) {
    const t = TYPE_BY_KEY[typeKey];
    const alreadyIdx = state.producers.left.findIndex(p => p.typeKey === typeKey);

    const label = document.createElement("div");
    label.style.fontSize = "12px";
    label.style.opacity = "0.85";
    label.textContent = "Choose a slot to replace:";

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.gap = "6px";
    wrap.style.alignItems = "center";

    state.producers.left.forEach((p, i) => {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = TYPE_BY_KEY[p.typeKey].emoji;
      b.title = `Slot ${i + 1}: ${p.typeKey}`;

      if (alreadyIdx !== -1 && alreadyIdx !== i) {
        b.className = "btn ghost";
        b.disabled = true; // enforce uniqueness
      }

      b.onclick = () => {
        const ok = replaceProducerSlot(LEFT, i, typeKey);
        statusText.textContent = ok
          ? `Replaced slot ${i + 1} → ${t.emoji}`
          : `Cannot replace.`;
        resolveAIChoice();
      };

      wrap.appendChild(b);
    });

    cardSlot.appendChild(label);
    cardSlot.appendChild(wrap);
  }

  function resolveAIChoice() {
    const q = state.timers.quartet;
    if (!q) return;

    const pick = Math.random() < 0.5 ? q[2] : q[3];
    const canAdd =
      state.producers.right.length < CONFIG.MAX_ACTIVE_TYPES &&
      !state.producers.right.some(p => p.typeKey === pick);

    if (canAdd) {
      addProducer(RIGHT, pick);
    } else {
      // prefer replacing a slot that is not already the pick
      let idxs = state.producers.right
        .map((p, i) => ({ p, i }))
        .filter(x => x.p.typeKey !== pick)
        .map(x => x.i);
      if (idxs.length === 0) idxs = state.producers.right.map((_, i) => i);
      const i = idxs[Math.floor(Math.random() * idxs.length)];
      replaceProducerSlot(RIGHT, i, pick);
    }

    finishTurn();
  }

  function finishTurn() {
    state.timers.turnActive = false;
    state.timers.quartet = null;
    clearCard();
    setTimeout(() => startNextTurn(), CONFIG.TURN_MS);
  }

  /* =======================================================
     Game loop / end
  ======================================================= */
  function pruneUnits() {
    state.units = state.units.filter((u) => u && u.el);
  }

  function loop() {
    if (!state.running) return;
    pruneUnits();

    const t = performance.now();
    const dt = clamp((t - state.lastTime) / 1000, 0, CONFIG.MAX_FRAME_DT);
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
    endText.textContent = (winnerSide === LEFT ? "🏰 Left" : "🏯 Right") + " wins!";
    endOverlay.classList.remove("hidden");
  }

  /* =======================================================
     Init
  ======================================================= */
  function init() {
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

    restartBtn?.addEventListener("click", () => location.reload());

    // Responsive castle size
    const w = ARENA_W();
    const castleSize = Math.max(42, Math.min(64, Math.floor(w / 22)));
    document.documentElement.style.setProperty("--castleSize", castleSize + "px");

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

    // Start conditions
    state.lastTime = performance.now();

    // Symmetric start (optional)
    addProducer(LEFT, "ant");
    addProducer(RIGHT, "caterpillar");

    // First turn + loop
    startNextTurn();
    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
