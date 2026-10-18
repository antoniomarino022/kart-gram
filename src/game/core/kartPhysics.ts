import { CONFIG } from "./config";

/** Stato dinamico del kart che serve alla sterzata. */
export interface KartMotion {
  /** Direzione del muso (rad). */
  angle: number;
  /** Direzione in cui il kart si muove davvero (rad): insegue `angle` con l'aderenza, la differenza è la derapata. */
  moveAngle: number;
  /** Velocità angolare del muso (rad/s): insegue `sterzata × maxTurnRate` con una risposta morbida. */
  yawRate: number;
}

export const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Frazione di avvicinamento per un passo `dt` con costante di tempo `tau` (esponenziale, indipendente dal tick). */
const approach = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);

/** Sotto questa velocità angolare (rad/s), a sterzo rilasciato, il muso si ferma del tutto. */
const YAW_EPS = 0.01;

/**
 * Un tick di sterzata. `steer`: -1, 0 o 1 (già risolto per l'olio). Deterministico: solo aritmetica e Math.exp/atan2.
 * - la velocità angolare sale verso `steer × speed / turnRadius` in ~yawRiseTime e scende in ~yawFallTime (più lento sul ghiaccio);
 * - la direzione di moto insegue il muso con un'aderenza per metro percorso, così la derapata ha la stessa forma a ogni velocità.
 * `sensitivity` (ruote, 1 = base) riduce la velocità angolare massima e allunga il tempo di salita.
 */
export function steerKart(k: KartMotion, steer: number, speed: number, surface: { ice: boolean; oil: boolean }, dt: number, sensitivity = 1) {
  const h = CONFIG.handling;
  const maxRate = (speed / CONFIG.turnRadius) * (surface.ice ? CONFIG.iceGrip : 1) * sensitivity;
  const target = steer * maxRate;
  // in salita (o cambiando lato) risposta rapida, al rilascio un po' più dolce
  const rising = target !== 0 && (Math.sign(target) !== Math.sign(k.yawRate) || Math.abs(target) > Math.abs(k.yawRate));
  const tau = rising ? h.yawRiseTime / sensitivity : surface.ice ? h.iceYawFallTime : h.yawFallTime;
  k.yawRate += (target - k.yawRate) * approach(dt, tau);
  if (target === 0 && Math.abs(k.yawRate) < YAW_EPS) k.yawRate = 0;
  k.angle += k.yawRate * dt;

  const grip = h.gripPerMeter * speed * (surface.ice ? h.iceGrip : surface.oil ? h.oilGrip : 1);
  k.moveAngle += angleDiff(k.angle, k.moveAngle) * (1 - Math.exp(-grip * dt));
}

/** Angolo di derapata (muso − direzione di moto). */
export const slipAngle = (k: KartMotion) => angleDiff(k.angle, k.moveAngle);
