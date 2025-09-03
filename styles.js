// Inject all CSS (formatted and commented for readability)
(function () {
  const css = `
/* ---------------------------------------------------------
   Theme tokens
--------------------------------------------------------- */
:root {
  --bg: #0b0f14;
  --panel: #111820;
  --ink: #e8eef6;
  --muted: #a8b3c7;
  --accent: #66e3a1;
  --dot: #22c55e;

  --laneH: 260px;
  --castleSize: 56px; /* variable castle emoji size */
}

/* ---------------------------------------------------------
   Base layout
--------------------------------------------------------- */
* {
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter,
    "Apple Color Emoji", "Segoe UI Emoji";
}

/* ---------------------------------------------------------
   Portrait lock (mobile)
--------------------------------------------------------- */
#rotateOverlay {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: #0b0f14;
  z-index: 9999;
  color: #e8eef6;
}

#rotateOverlay .rotatePanel {
  text-align: center;
}

#rotateOverlay .big {
  font-size: 64px;
  margin-bottom: 8px;
}

@media (orientation: portrait) {
  #rotateOverlay { display: flex; }
}

/* ---------------------------------------------------------
   HUD (single row, compact)
--------------------------------------------------------- */
#hud {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 8px clamp(8px, 2vw, 14px);
}

.castleBadge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--panel);
  padding: 6px 10px;
  border-radius: 14px;
  box-shadow: inset 0 0 0 1px #1b2531;
}

.castleBadge .emoji {
  font-size: 22px;
}

.hpDots {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--dot);
  white-space: nowrap;
}

.actives {
  display: flex;
  gap: 6px;
  min-height: 38px;
  align-items: center;
  overflow: hidden;
}

.activeType {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--panel);
  box-shadow: inset 0 0 0 1px #1b2531;
}

.activeType .emoji {
  font-size: 20px;
}

.activeType .prog {
  position: absolute;
  bottom: -4px;
  left: 4px;
  right: 4px;
  height: 4px;
  background: #14202c;
  border-radius: 99px;
  overflow: hidden;
}

.activeType .prog .fill {
  height: 100%;
  background: linear-gradient(90deg, #7ee3ef, var(--accent));
}

/* ---------------------------------------------------------
   Card slot (highlighted while active)
--------------------------------------------------------- */
@keyframes glowCard {
  0%   { box-shadow: 0 0 0 2px #2dd4bf, 0 0 14px #2dd4bf66; }
  100% { box-shadow: 0 0 0 2px #7ee3ef, 0 0 20px #7ee3ef66; }
}

.cardSlim {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  min-height: 64px;
  background: #0f1722;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px #2a3a52;
  padding: 8px 10px;
}

.cardSlim.active {
  animation: glowCard 1s ease-in-out infinite alternate;
}

.cardSlim .big {
  font-size: 48px;
  line-height: 1;
}

.cardSlim .btn {
  appearance: none;
  border: 0;
  border-radius: 10px;
  padding: 10px 12px;
  font-weight: 800;
  cursor: pointer;
  background: linear-gradient(90deg, #7ee3ef, var(--accent));
  color: #0b121a;
}

.cardSlim .btn.ghost {
  background: #162233;
  color: #d6e3f7;
  box-shadow: inset 0 0 0 1px #243245;
}

.placeholder {
  color: var(--muted);
  font-size: 12px;
}

/* ---------------------------------------------------------
   Arena + scenery (clear horizon)
--------------------------------------------------------- */
#arenaWrap {
  display: flex;
  justify-content: center;
  padding: 6px clamp(8px, 2vw, 16px) 14px;
}

#arena {
  position: relative;
  width: min(1100px, 98vw);
  height: var(--laneH);
  border-radius: 18px;
  background: #0c1522;
  box-shadow: inset 0 0 0 1px #182434, 0 20px 60px rgba(0,0,0,.35);
  overflow: hidden;
}

#sky {
  position: absolute;
  left: 0; right: 0; top: 0;
  height: 50%;
  background: linear-gradient(180deg, #67b7ff 0%, #8cc8ff 70%, #b9dcff 100%);
  z-index: 5;
}

#ground {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 50%;
  background: #79dd79; /* solid light green */
  z-index: 5;
}

#horizonLine {
  position: absolute;
  left: 0; right: 0; top: 50%;
  height: 2px;
  background: #dff7d7;
  z-index: 6;
}

#sun {
  position: absolute;
  top: 8px;
  left: 12px;
  font-size: 24px;
  filter: drop-shadow(0 2px 0 rgba(0,0,0,.2));
}

#clouds {
  position: absolute;
  inset: 0;
  pointer-events: none;
  
}

.cloud {
  position: absolute;
  font-size: 22px;
  opacity: .9;
  animation: drift linear infinite;
  font-size: 50px;
}

@keyframes drift {
  from { transform: translateX(-10%); }
  to   { transform: translateX(110%); }
}

#trees {
  position: absolute;
  left: 0; right: 0; bottom: 6px;
  height: 24px;
  pointer-events: none;
}

.tree {
  position: absolute;
  bottom: 0;
  font-size: 16px;
  transform-origin: bottom;
  filter: drop-shadow(0 2px 0 rgba(0,0,0,.3));
  font-size: 50px;
}

/* Lanes */
.lane {
  position: absolute;
  left: 0; right: 0;
  height: 50%;
  pointer-events: none;
  z-index: 10;
}

.lane.air    { top: 0; }
.lane.ground { bottom: 0; }

/* ---------------------------------------------------------
   Castles
--------------------------------------------------------- */
/* ---------------------------------------------------------
   Castles (edge glow, no button background)
--------------------------------------------------------- */
.castle {
  position: absolute;
  top: 8px; bottom: 8px;
  width: 80px;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: var(--castleSize);
  border-radius: 14px;
  z-index: 25;

  /* no button look */
  background: transparent;
  box-shadow: none;
  transition: box-shadow .35s ease; /* smooth color change */
}

.castle.left  { left: 0;  right: auto; }
.castle.right { right: 0; left:  auto; }

/* Glow on the edges using a pseudo-element (outer + inner light) */
.castle::after {
  content: "";
  position: absolute;
  inset: 6px;                /* distance from edges */
  border-radius: 14px;
  pointer-events: none;

  /* variables set by JS per-HP */
  box-shadow:
    0 0 0 2px var(--castleGlow, #22c55e),                /* crisp outline */
    0 0 24px 6px var(--castleGlowSoft, rgba(34,197,94,.45)), /* outer glow */
    inset 0 0 22px 4px var(--castleGlowSoft, rgba(34,197,94,.35)); /* inner rim */
  transition: box-shadow .35s ease;
}


/* ---------------------------------------------------------
   Units, projectiles, FX
--------------------------------------------------------- */
.unit {
  position: absolute;
  bottom: calc(50% - 35px);
  transform: translate3d(0,0,0);
  will-change: transform;
  filter: drop-shadow(0 2px 0 rgba(0,0,0,.45));
  z-index: 12;
}

.unit.air {
  bottom: calc(100% - 78px);
}

.unit .rider {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  opacity: .9;
  filter: drop-shadow(0 1px 0 rgba(0,0,0,.45));
}

.unit .emoji {
  display: block;
  transform-origin: center;
}

.unit .hp {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: -16px;
  font-size: 12px;
  color: var(--dot);
  text-shadow: 0 1px 0 rgba(0,0,0,.8);
}

.unit.hit .emoji {
  animation: hitBlink .2s linear 1;
}

@keyframes hitBlink {
  0%   { filter: brightness(2); }
  100% { filter: none; }
}

.dmgSplash {
  position: absolute;
  font-size: 13px;
  color: #ff6b6b;
  font-weight: 800;
  transform: translate(-50%, -20px);
  opacity: 0;
  animation: pop .5s ease-out forwards;
}

@keyframes pop {
  0%   { opacity: 0; transform: translate(-50%, 0); }
  20%  { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -22px); }
}

.projectile {
  position: absolute;
  font-size: 16px;
  pointer-events: none;
  filter: drop-shadow(0 2px 0 rgba(0,0,0,.4));
  z-index: 14;
}

.aoeFx {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0, #fff0 70%);
  box-shadow: 0 0 32px 8px rgba(255,255,255,.2);
  animation: aoe .35s ease-out forwards;
  z-index: 13;
}

@keyframes aoe {
  from { transform: translate(-50%,-50%) scale(0.3); opacity: .9; }
  to   { transform: translate(-50%,-50%) scale(1.7); opacity: 0; }
}

/* ---------------------------------------------------------
   Footer / overlay
--------------------------------------------------------- */
#controls {
  padding: 6px clamp(8px, 2vw, 16px) 14px;
}

.legend {
  color: #c9d6ea;
  font-size: 12px;
}

.legend .row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: center;
  margin: 6px 0;
}

.turnTimer {
  height: 6px;
  background: #13212f;
  border-radius: 99px;
  overflow: hidden;
}

.turnTimer .bar {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #7ee3ef, var(--accent));
  transition: width .15s linear;
}

.btn { cursor: pointer; }

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(5,10,16,.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;      /* ⬅️ clé : plus haut que tout le reste */
}

.overlay.hidden { display: none; }

.overlay .panel {
  background: var(--panel);
  border-radius: 18px;
  padding: 22px;
  text-align: center;
  box-shadow:
    0 20px 60px rgba(0,0,0,.45),
    inset 0 0 0 1px #1b2531;
}

.endText {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 14px;
}


/* Simple tooltip (exclude castles so it doesn't override castle ::after) */
.tooltip[data-title]:not(.castle) { 
  position: relative; 
}

.tooltip[data-title]:not(.castle):hover::after {
  content: attr(data-title);
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translate(-50%, -8px);
  background: #09121b;
  color: #cfe1fb;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 12px;
  white-space: pre;
  box-shadow: 0 0 0 1px #1a2838;
}
adow: 0 0 0 1px #1a2838;
}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
