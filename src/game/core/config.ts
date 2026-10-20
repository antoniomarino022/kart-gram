export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
/** Distanza (m) tra due campioni della strada. */
export const STEP = 1;

export const CONFIG = {
  biomeLength: 1500,
  /** Quanti metri di strada generare davanti al kart. */
  lookAhead: 300,
  /**
   * Velocità (m/s): base del bioma (+perBiome a bioma, fino a max), moltiplicata dalla combo (+comboBonus per livello sopra x1).
   * Il kart si avvicina alla velocità obiettivo con `accel` in salita e `decel` in discesa (m/s²).
   */
  speed: { base: 22, perBiome: 3, max: 40, comboBonus: 0.12, accel: 8, decel: 24 },
  /** Raggio di sterzata in drift: maxTurnRate = speed / turnRadius. Deve essere < curve.absMinRadius. */
  turnRadius: 9.5,
  /**
   * Sensazione di guida (src/game/core/kartPhysics.ts): tempi di risposta della velocità angolare (s) e aderenza
   * per metro percorso con cui la direzione di moto insegue il muso (ghiaccio e olio scivolano di più).
   */
  handling: { yawRiseTime: 0.11, yawFallTime: 0.17, iceYawFallTime: 0.4, gripPerMeter: 0.35, iceGrip: 0.35, oilGrip: 0.45 },
  iceGrip: 0.7,
  /**
   * Sensibilità dello sterzo per ruote (1 = base): moltiplica la velocità angolare massima e rallenta la risposta
   * (sterzo più dolce e preciso). turnRadius / valore deve restare < curve.absMinRadius. Ruote non elencate = 1.
   */
  wheelSteer: { wheel_basic: 1, wheel_sport: 0.8, wheel_offroad: 0.85, wheel_retro: 0.9 } as Record<string, number>,
  kartHalfWidth: 0.5,
  /** Margine (m) oltre il bordo, a kart già tutto fuori, prima di cadere: beneficio del dubbio sul lato. */
  fallGrace: 0.2,
  road: { width: 7, narrowWidth: 4.5, wideBonus: 3, startStraight: 60, narrowChance: 0.2, straightChance: 0.4 },
  curve: { minRadius: 16, absMinRadius: 13, maxRadius: 24, minAngle: Math.PI / 4, maxAngle: Math.PI / 2, headingLimit: 1.4 },
  spawn: { safeStart: 60, baseSpacing: 30, spacingPerBiome: 3, minSpacing: 12, coinChance: 0.6, powerupChance: 0.15, boostChance: 0 },
  fallDuration: 1,
  /** Vite: ogni urto con un ostacolo ne toglie una, a 0 il kart si schianta (crashDuration s) e la partita finisce. */
  lives: 3,
  crashDuration: 0.6,
  invulnAfterRevive: 2,
  hitSlowdown: { factor: 0.6, duration: 1 },
  turboSpeedFactor: 1.4,
  /** Pedane boost: lunghezza (m), quota a tutta larghezza, distanza minima dagli ostacoli (m), durata dell'effetto (s), moltiplicatore di velocità, quanto il kart deve stare dentro la metà (m). */
  boost: { length: 12, fullWidthChance: 0.25, duration: 1.5, speedFactor: 1.35, minInside: 0.2, clearance: 4 },
  slowmoTimeScale: 0.6,
  powerupBase: { turbo: 3, magnet: 6, wide: 5, slowmo: 3, x2: 6 },
  upgradePerLevel: { turbo: 0.5, magnet: 1, slowmo: 0.5, x2: 1 },
  magnetRadius: 6,
  pickupRadius: 1.0,
  nearMissMargin: 1.0,
  score: { perMeter: 1, driftPerSecond: 20, perfectLinePerSecond: 30, perfectLineEdge: 1.2, nearMiss: 50, minDrift: 0.5, slipRef: 0.3 },
  comboMax: 5,
  comboStep: 3,
  maxTicks: 60 * 60 * 30,
} as const;

/** Bioma dal quale la velocità smette di salire. */
export const SPEED_CAP_BIOME = Math.ceil((CONFIG.speed.max - CONFIG.speed.base) / CONFIG.speed.perBiome);
