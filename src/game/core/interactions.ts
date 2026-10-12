import { CONFIG } from "./config";
import { isSolid, itemPosition, type Item, type PowerupKind } from "./items";
import type { GameState } from "./sim";
import { sampleAt } from "./track";

/** Interazioni del kart con la strada e gli oggetti: superfici, pedane, raccolte, urti, cadute e schianti. */

export function multiplier(st: GameState) {
  return st.combo * (st.powerups.x2 > 0 ? 2 : 1);
}

/** Cadere è sempre game over (lo scudo protegge solo dagli urti; resta il revive a pagamento). */
export function startFall(st: GameState) {
  st.phase = "falling";
  st.endReason = "fall";
  st.fallTimer = CONFIG.fallDuration;
  st.kart.drifting = false;
  st.kart.yawRate = 0;
  st.driftTime = 0;
  st.driftPoints = 0;
  st.events.push({ type: "fall" });
}

/** Vite finite: il kart frena fino a fermarsi in crashDuration, poi game over. */
export function startCrash(st: GameState) {
  st.phase = "crashing";
  st.endReason = "crash";
  st.fallTimer = CONFIG.crashDuration;
  st.kart.drifting = false;
  st.driftTime = 0;
  st.driftPoints = 0;
  st.events.push({ type: "crash" });
}

function activatePowerup(st: GameState, kind: PowerupKind) {
  st.events.push({ type: "powerup", kind });
  if (kind === "heart") {
    st.lives = Math.min(CONFIG.lives, st.lives + 1);
    st.events.push({ type: "lifeGained", lives: st.lives });
    return;
  }
  if (kind === "shield") st.powerups.shield = 1;
  else if (kind === "wide") st.powerups.wide = CONFIG.powerupBase.wide;
  else st.powerups[kind] = CONFIG.powerupBase[kind] + st.upgrades[kind] * CONFIG.upgradePerLevel[kind];
}

/** Il kart è sulla pedana: dentro il tratto e (se la pedana è mezza strada) dalla parte giusta. */
function onBoostPad(st: GameState, it: Item) {
  const k = st.kart;
  if (k.s < it.s || k.s > it.s + it.length) return false;
  if (it.lateral === 0) return true;
  const half = sampleAt(st.track, k.s).width / 2;
  return Math.sign(k.lateral) === Math.sign(it.lateral) && Math.abs(k.lateral) >= CONFIG.boost.minInside && Math.abs(k.lateral) <= half;
}

export function surface(st: GameState) {
  const k = st.kart;
  let ice = false, oil = false;
  for (const it of st.track.items) {
    if (it.consumed) continue;
    if (it.kind === "boost") {
      if (onBoostPad(st, it)) {
        st.boostTimer = CONFIG.boost.duration;
        if (!it.entered) { it.entered = true; st.events.push({ type: "boost" }); }
      }
    } else if (it.kind === "ice" && k.s >= it.s && k.s <= it.s + it.length) ice = true;
    else if (it.kind === "oil" && Math.abs(it.s - k.s) < 3) {
      const p = itemPosition(st.track, it);
      if (Math.hypot(p.x - k.x, p.y - k.y) < it.radius) oil = true;
    }
  }
  return { ice, oil };
}

export function handleItems(st: GameState, dt: number) {
  const k = st.kart;
  const protectedNow = st.powerups.turbo > 0 || st.invulnTimer > 0;
  for (const it of st.track.items) {
    if (it.kind === "rival" && !it.consumed && it.s - k.s < 120) it.s += it.speed * dt;
    if (it.consumed || it.passed) continue;
    const ds = it.s - k.s;
    if (ds < -2) {
      it.passed = true;
      if (isSolid(it) && it.minDist < it.radius + CONFIG.kartHalfWidth + CONFIG.nearMissMargin) {
        st.score += CONFIG.score.nearMiss * multiplier(st);
        st.comboPoints++;
        st.events.push({ type: "nearMiss" });
      }
      continue;
    }
    const reach = it.kind === "coin" && st.powerups.magnet > 0 ? CONFIG.magnetRadius + 1 : 3;
    if (ds > reach || it.kind === "ice" || it.kind === "oil" || it.kind === "boost") continue;
    const p = itemPosition(st.track, it);
    const dist = Math.hypot(p.x - k.x, p.y - k.y);

    if (it.kind === "coin") {
      const r = st.powerups.magnet > 0 ? CONFIG.magnetRadius : it.radius + CONFIG.pickupRadius;
      if (dist < r) { it.consumed = true; st.coins++; st.events.push({ type: "coin" }); }
    } else if (it.kind === "powerup") {
      if (dist < it.radius + CONFIG.pickupRadius) { it.consumed = true; activatePowerup(st, it.powerup!); }
    } else if (it.kind === "hole") {
      if (dist < it.radius && !protectedNow) { startFall(st); if (st.phase !== "running") return; }
    } else {
      it.minDist = Math.min(it.minDist, dist);
      if (dist < it.radius + CONFIG.kartHalfWidth) {
        it.consumed = true;
        if (protectedNow) st.events.push({ type: "smash" });
        else if (st.powerups.shield > 0) {
          // lo scudo assorbe un urto: niente rallentamento né perdita della combo
          st.powerups.shield = 0;
          st.events.push({ type: "shieldUsed" });
        } else {
          st.slowTimer = CONFIG.hitSlowdown.duration;
          st.comboPoints = 0;
          st.lives--;
          st.events.push({ type: "hit" }, { type: "lifeLost", lives: st.lives });
          if (st.lives <= 0) { startCrash(st); return; }
        }
      }
    }
  }
  st.track.items = st.track.items.filter((it) => it.s > k.s - 40);
}
