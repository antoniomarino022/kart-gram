export const KART_PHYSICS_EVENTS = {
  driftStart: "kart:physics:drift-start",
  driftTier: "kart:physics:drift-tier",
  boostStart: "kart:physics:boost-start",
  boostEnd: "kart:physics:boost-end",
} as const;

export type KartPhysicsEventName = keyof typeof KART_PHYSICS_EVENTS;
export type DriftState = "GRIP" | "DRIFT_CHARGING" | "BOOST";
export type SurfaceId = "asphalt" | "grass" | "ice" | "boostPad";
export type KartPhysicsPresetId = "ARCADE_TIGHT" | "ARCADE_DRIFTY" | "HEAVY_KART";

export interface SurfaceParams {
  id: SurfaceId;
  gripMultiplier: number;
  dragMultiplier: number;
  maxSpeedMultiplier: number;
  boostMultiplier: number;
}

export interface KartPhysicsConfig {
  fixedDt: number; // seconds; lower is more stable and costs more CPU.
  maxSubSteps: number; // steps/frame; higher tolerates stalls but costs more CPU.
  maxSpeed: number; // px/s; higher raises normal top speed.
  reverseMaxSpeed: number; // px/s; higher allows faster reverse.
  acceleration: number; // px/s^2; higher improves launch punch.
  brakeForce: number; // px/s^2; higher stops faster before reversing.
  reverseAcceleration: number; // px/s^2; higher reverses more assertively.
  rollingDrag: number; // 1/s; higher slows coasting.
  aeroDrag: number; // 1/px; higher reins in high speed harder.
  steerRate: number; // rad/s; higher turns harder at mid speed.
  steerAtLowSpeed: number; // 0..1; lower prevents spinning in place.
  steerAtTopSpeed: number; // 0..1; lower stabilizes high speed.
  steerResponseRise: number; // 1/s; higher reaches requested steer faster.
  steerResponseFall: number; // 1/s; higher recenters faster.
  gripPeak: number; // 1/s; higher kills lateral slide faster at small slip.
  slipThreshold: number; // rad; higher delays sliding/drift.
  gripFalloff: number; // 0..1; higher loses more grip past threshold.
  driftMinSpeed: number; // px/s; lower permits earlier drifts.
  driftGripMultiplier: number; // 0..1; lower makes longer slides.
  driftTurnMultiplier: number; // multiplier; higher tightens drift arcs.
  driftSteerModulation: number; // 0..1; higher allows more arc correction.
  driftAutoSteerThreshold: number; // 0..1 input; lower triggers touch auto-drift sooner.
  driftChargeRate: number; // tier units/s; higher charges boost faster.
  driftSlipCharge: number; // tier units/s; higher rewards bigger slip.
  driftTier1: number; // charge; lower grants tier 1 sooner.
  driftTier2: number; // charge; lower grants tier 2 sooner.
  driftTier3: number; // charge; lower grants tier 3 sooner.
  boostDurationTier1: number; // seconds; higher extends mini boost.
  boostDurationTier2: number; // seconds; higher extends medium boost.
  boostDurationTier3: number; // seconds; higher extends big boost.
  boostSpeedMultiplierTier1: number; // multiplier; higher boosts harder.
  boostSpeedMultiplierTier2: number; // multiplier; higher boosts harder.
  boostSpeedMultiplierTier3: number; // multiplier; higher boosts harder.
  boostDecay: number; // 1/s; higher decays boost override faster.
  counterSteerAssist: number; // 0..1; higher helps recover slides.
  collisionRestitution: number; // 0..1; higher bounces more off walls.
  collisionTangentKeep: number; // 0..1; higher preserves wall-slide speed.
  impactStunPerSpeed: number; // s/(px/s); higher locks steering longer on impact.
  maxImpactStun: number; // seconds; caps steering lock.
  steerPeakSpeed: number; // 0..1 of maxSpeed; speed where steering is strongest.
  driftAutoHoldTime: number; // seconds; higher delays touch auto-drift entry.
  boostThrust: number; // px/s^2; higher makes boost kick harder.
  padThrust: number; // px/s^2; higher makes boost pads kick harder.
  cameraLookAhead: number; // px at max speed; higher looks further ahead.
  cameraZoomOut: number; // zoom delta; higher zooms out more at speed.
  cameraSmoothTime: number; // seconds; higher makes the camera lag more.
}

export interface KartPhysicsPreset {
  id: KartPhysicsPresetId;
  label: string;
  config: KartPhysicsConfig;
}

export const SURFACES: Record<SurfaceId, SurfaceParams> = {
  asphalt: { id: "asphalt", gripMultiplier: 1, dragMultiplier: 1, maxSpeedMultiplier: 1, boostMultiplier: 1 },
  grass: { id: "grass", gripMultiplier: 0.58, dragMultiplier: 1.75, maxSpeedMultiplier: 0.74, boostMultiplier: 1 },
  ice: { id: "ice", gripMultiplier: 0.32, dragMultiplier: 0.75, maxSpeedMultiplier: 0.92, boostMultiplier: 1 },
  boostPad: { id: "boostPad", gripMultiplier: 1.08, dragMultiplier: 0.92, maxSpeedMultiplier: 1.18, boostMultiplier: 1.25 },
} as const;

export const ARCADE_TIGHT: KartPhysicsConfig = {
  fixedDt: 1 / 120,
  maxSubSteps: 5,
  maxSpeed: 780,
  reverseMaxSpeed: 240,
  acceleration: 1700,
  brakeForce: 2450,
  reverseAcceleration: 1050,
  rollingDrag: 0.3,
  aeroDrag: 0.00012,
  steerRate: 3.9,
  steerAtLowSpeed: 0.12,
  steerAtTopSpeed: 0.74,
  steerResponseRise: 18,
  steerResponseFall: 24,
  gripPeak: 11.8,
  slipThreshold: 0.22,
  gripFalloff: 0.46,
  driftMinSpeed: 270,
  driftGripMultiplier: 0.56,
  driftTurnMultiplier: 1.38,
  driftSteerModulation: 0.34,
  driftAutoSteerThreshold: 0.92,
  driftChargeRate: 0.92,
  driftSlipCharge: 1.75,
  driftTier1: 0.72,
  driftTier2: 1.42,
  driftTier3: 2.18,
  boostDurationTier1: 0.45,
  boostDurationTier2: 0.72,
  boostDurationTier3: 1.05,
  boostSpeedMultiplierTier1: 1.12,
  boostSpeedMultiplierTier2: 1.22,
  boostSpeedMultiplierTier3: 1.34,
  boostDecay: 2.9,
  counterSteerAssist: 0.42,
  collisionRestitution: 0.18,
  collisionTangentKeep: 0.82,
  impactStunPerSpeed: 0.00018,
  maxImpactStun: 0.1,
  steerPeakSpeed: 0.45,
  driftAutoHoldTime: 0.18,
  boostThrust: 1400,
  padThrust: 2200,
  cameraLookAhead: 120,
  cameraZoomOut: 0.08,
  cameraSmoothTime: 0.16,
};

export const ARCADE_DRIFTY: KartPhysicsConfig = {
  ...ARCADE_TIGHT,
  maxSpeed: 800,
  steerRate: 4.15,
  gripPeak: 9.4,
  slipThreshold: 0.18,
  gripFalloff: 0.6,
  driftGripMultiplier: 0.44,
  driftTurnMultiplier: 1.55,
  driftChargeRate: 1.05,
  driftSlipCharge: 2.05,
  counterSteerAssist: 0.58,
};

export const HEAVY_KART: KartPhysicsConfig = {
  ...ARCADE_TIGHT,
  maxSpeed: 740,
  acceleration: 1400,
  brakeForce: 2200,
  steerRate: 3.35,
  steerResponseRise: 12,
  steerResponseFall: 16,
  gripPeak: 13.2,
  driftMinSpeed: 320,
  driftTurnMultiplier: 1.22,
  collisionTangentKeep: 0.88,
};

export const KART_PHYSICS_PRESETS: Record<KartPhysicsPresetId, KartPhysicsPreset> = {
  ARCADE_TIGHT: { id: "ARCADE_TIGHT", label: "Arcade Tight", config: ARCADE_TIGHT },
  ARCADE_DRIFTY: { id: "ARCADE_DRIFTY", label: "Arcade Drifty", config: ARCADE_DRIFTY },
  HEAVY_KART: { id: "HEAVY_KART", label: "Heavy Kart", config: HEAVY_KART },
};

export const KART_PHYSICS_CONFIG = ARCADE_TIGHT;
