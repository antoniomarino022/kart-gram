export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
/** Distanza (m) tra due campioni della strada. */
export const STEP = 1;

export const CONFIG = {
  biomeLength: 1500,
  /** Quanti metri di strada generare davanti al kart. */
  lookAhead: 300,
  speed: { base: 14, perBiome: 2, max: 26 },
  /** Raggio di sterzata in drift: turnRate = speed / turnRadius. Deve essere < curve.absMinRadius. */
  turnRadius: 8,
  /** rad/s: rilasciato, l'heading torna verso la tangente della strada. */
  relaxRate: 0.6,
  iceGrip: 0.7,
  /** Metri davanti in cui cercare la direzione della prossima curva. */
  curveLookAhead: 25,
  kartHalfWidth: 0.5,
  road: { width: 7, narrowWidth: 4.5, wideBonus: 3, startStraight: 60, narrowChance: 0.2, straightChance: 0.4 },
  curve: { minRadius: 12, absMinRadius: 9.5, maxRadius: 24, minAngle: Math.PI / 4, maxAngle: Math.PI / 2, headingLimit: 1.4 },
  spawn: { safeStart: 60, baseSpacing: 30, spacingPerBiome: 3, minSpacing: 12, coinChance: 0.6, powerupChance: 0.15 },
  fallDuration: 1,
  invulnAfterRescue: 1,
  invulnAfterRevive: 2,
  hitSlowdown: { factor: 0.6, duration: 1 },
  turboSpeedFactor: 1.4,
  slowmoTimeScale: 0.6,
  powerupBase: { turbo: 3, magnet: 6, wide: 5, slowmo: 3, x2: 6 },
  upgradePerLevel: { turbo: 0.5, magnet: 1, slowmo: 0.5, x2: 1 },
  magnetRadius: 6,
  pickupRadius: 1.0,
  nearMissMargin: 1.0,
  score: { perMeter: 1, driftPerSecond: 20, perfectLinePerSecond: 30, perfectLineEdge: 1.2, nearMiss: 50, minDrift: 0.5 },
  comboMax: 5,
  comboStep: 3,
  maxTicks: 60 * 60 * 30,
} as const;

/** Bioma dal quale la velocità smette di salire. */
export const SPEED_CAP_BIOME = Math.ceil((CONFIG.speed.max - CONFIG.speed.base) / CONFIG.speed.perBiome);
