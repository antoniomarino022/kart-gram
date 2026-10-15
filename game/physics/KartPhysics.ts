import type { DriftState, KartPhysicsConfig, SurfaceParams, SurfaceId } from "../config/kartPhysicsConfig";

export type { DriftState, SurfaceParams } from "../config/kartPhysicsConfig";

export interface KartInput {
  throttle: number;
  brake: number;
  steer: number;
  drift: boolean;
  autoDrift: boolean;
}

export interface KartState {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  rotation: number;
  prevRotation: number;
  vx: number;
  vy: number;
  steer: number;
  driftState: DriftState;
  driftDirection: -1 | 0 | 1;
  steerHoldTime: number;
  driftCharge: number;
  driftTier: 0 | 1 | 2 | 3;
  boostTimeLeft: number;
  boostDuration: number;
  boostMultiplier: number;
  stunTime: number;
  speed: number;
  forwardSpeed: number;
  lateralSpeed: number;
  slipAngle: number;
  currentGrip: number;
  isBoosting: boolean;
  surfaceId: SurfaceId;
  lastImpactStrength: number;
  cameraLookAheadX: number;
  cameraLookAheadY: number;
  cameraZoom: number;
}

export interface KartPhysicsEvents {
  driftStart: boolean;
  driftTier: 0 | 1 | 2 | 3;
  boostStart: 0 | 1 | 2 | 3;
  boostEnd: boolean;
}

export interface WallCollision {
  nx: number;
  ny: number;
  penetration: number;
}

const EPSILON = 0.000001;
const HALF_PI = Math.PI / 2;
const LATERAL_FLOOR_DECEL = 18; // px/s^2; keeps tiny residual slide from lingering forever.
const STEER_GATE_SPEED = 40; // px/s; below this the steering authority fades linearly to 0.
const DRIFT_ENTRY_STEER = 0.2; // steer needed (with drift button) to pick a drift direction.
const DRIFT_HOLD_STEER = 0.35; // same-direction steer needed to keep an auto-drift alive.

export class KartPhysics {
  readonly events: KartPhysicsEvents = {
    driftStart: false,
    driftTier: 0,
    boostStart: 0,
    boostEnd: false,
  };

  constructor(readonly config: KartPhysicsConfig) {}

  createState(x: number, y: number, rotation: number): KartState {
    return {
      x,
      y,
      prevX: x,
      prevY: y,
      rotation,
      prevRotation: rotation,
      vx: 0,
      vy: 0,
      steer: 0,
      driftState: "GRIP",
      driftDirection: 0,
      steerHoldTime: 0,
      driftCharge: 0,
      driftTier: 0,
      boostTimeLeft: 0,
      boostDuration: 0,
      boostMultiplier: 1,
      stunTime: 0,
      speed: 0,
      forwardSpeed: 0,
      lateralSpeed: 0,
      slipAngle: 0,
      currentGrip: this.config.gripPeak,
      isBoosting: false,
      surfaceId: "asphalt",
      lastImpactStrength: 0,
      cameraLookAheadX: 0,
      cameraLookAheadY: 0,
      cameraZoom: 1,
    };
  }

  copyState(target: KartState, source: KartState): void {
    target.x = source.x;
    target.y = source.y;
    target.prevX = source.prevX;
    target.prevY = source.prevY;
    target.rotation = source.rotation;
    target.prevRotation = source.prevRotation;
    target.vx = source.vx;
    target.vy = source.vy;
    target.steer = source.steer;
    target.driftState = source.driftState;
    target.driftDirection = source.driftDirection;
    target.steerHoldTime = source.steerHoldTime;
    target.driftCharge = source.driftCharge;
    target.driftTier = source.driftTier;
    target.boostTimeLeft = source.boostTimeLeft;
    target.boostDuration = source.boostDuration;
    target.boostMultiplier = source.boostMultiplier;
    target.stunTime = source.stunTime;
    target.speed = source.speed;
    target.forwardSpeed = source.forwardSpeed;
    target.lateralSpeed = source.lateralSpeed;
    target.slipAngle = source.slipAngle;
    target.currentGrip = source.currentGrip;
    target.isBoosting = source.isBoosting;
    target.surfaceId = source.surfaceId;
    target.lastImpactStrength = source.lastImpactStrength;
    target.cameraLookAheadX = source.cameraLookAheadX;
    target.cameraLookAheadY = source.cameraLookAheadY;
    target.cameraZoom = source.cameraZoom;
  }

  step(state: KartState, input: KartInput, surface: SurfaceParams, dt: number): KartState {
    this.resetEvents();
    state.prevX = state.x;
    state.prevY = state.y;
    state.prevRotation = state.rotation;
    state.lastImpactStrength = 0;
    state.surfaceId = surface.id;

    const forwardX = Math.sin(state.rotation);
    const forwardY = -Math.cos(state.rotation);
    const rightX = Math.cos(state.rotation);
    const rightY = Math.sin(state.rotation);

    let forwardSpeed = state.vx * forwardX + state.vy * forwardY;
    let lateralSpeed = state.vx * rightX + state.vy * rightY;
    const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
    const maxSpeed = this.getEffectiveMaxSpeed(state, surface);
    const speed01 = clamp(Math.abs(forwardSpeed) / this.config.maxSpeed, 0, 1);

    // Smoothed steering: rise/fall rates avoid binary jerkiness on touch input.
    const targetSteer = clamp(input.steer, -1, 1);
    const steerRate = Math.abs(targetSteer) > Math.abs(state.steer) ? this.config.steerResponseRise : this.config.steerResponseFall;
    state.steer = moveToward(state.steer, targetSteer, steerRate * dt);

    const slipAngle = speed > 8 ? Math.atan2(lateralSpeed, Math.abs(forwardSpeed) + 40) : 0;
    state.slipAngle = slipAngle;
    this.updateDriftState(state, input, slipAngle, speed, dt);

    // Forward axis: acceleration falls off steeply near max speed (1 - r^3).
    const throttle = clamp(input.throttle, 0, 1);
    const brake = clamp(input.brake, 0, 1);
    const speedLimitRatio = clamp(Math.abs(forwardSpeed) / Math.max(maxSpeed, 1), 0, 1);
    const accelCurve = 1 - speedLimitRatio * speedLimitRatio * speedLimitRatio;

    if (throttle > 0) {
      forwardSpeed += this.config.acceleration * accelCurve * throttle * dt;
    }
    if (brake > 0) {
      const braking = forwardSpeed > 12 ? this.config.brakeForce : this.config.reverseAcceleration;
      forwardSpeed -= braking * brake * dt;
    }
    if (state.driftState === "BOOST") {
      forwardSpeed += this.config.boostThrust * dt;
    }
    if (surface.boostMultiplier > 1) {
      forwardSpeed += this.config.padThrust * dt;
    }

    // Rolling (linear) + air (quadratic) drag.
    const drag = (this.config.rollingDrag * forwardSpeed + this.config.aeroDrag * forwardSpeed * Math.abs(forwardSpeed)) * surface.dragMultiplier;
    forwardSpeed -= drag * dt;

    if (forwardSpeed > maxSpeed) {
      forwardSpeed = moveToward(forwardSpeed, maxSpeed, this.config.boostDecay * maxSpeed * dt);
    } else if (forwardSpeed < -this.config.reverseMaxSpeed) {
      forwardSpeed = -this.config.reverseMaxSpeed;
    }

    // Lateral axis: slip-dependent grip (peaks at small slip, drops past threshold).
    const absSlip = Math.abs(slipAngle);
    let grip = this.computeGrip(absSlip) * surface.gripMultiplier;
    if (state.driftState === "DRIFT_CHARGING") {
      grip *= this.config.driftGripMultiplier;
    }
    state.currentGrip = grip;
    lateralSpeed = moveToward(lateralSpeed, 0, grip * Math.abs(lateralSpeed) * dt + LATERAL_FLOOR_DECEL * dt);

    // Heading change: speed-gated (exactly zero at standstill), peak at mid speed.
    const steerLock = state.stunTime > 0 ? 0 : 1;
    const steerCurve = this.computeSteerCurve(speed01);
    const driftTurn = state.driftState === "DRIFT_CHARGING" ? this.config.driftTurnMultiplier : 1;
    const direction = forwardSpeed < -8 ? -1 : 1;
    const speedGate = clamp(Math.abs(forwardSpeed) / STEER_GATE_SPEED, 0, 1);
    let steer = state.steer;
    if (state.driftState === "DRIFT_CHARGING" && state.driftDirection !== 0) {
      const modulation = this.config.driftSteerModulation;
      steer = state.driftDirection * (1 - modulation) + steer * modulation;
      steer += -Math.sign(lateralSpeed) * this.config.counterSteerAssist * 0.24;
      steer = clamp(steer, -1, 1);
    }
    state.rotation = wrapAngle(state.rotation + steer * this.config.steerRate * steerCurve * driftTurn * direction * steerLock * speedGate * dt);

    if (state.stunTime > 0) {
      state.stunTime = Math.max(0, state.stunTime - dt);
    }

    // Recompose with the PRE-rotation basis: the world velocity is preserved while the
    // heading turns, so a lateral component (slip) emerges and grip has real work to do.
    state.vx = forwardX * forwardSpeed + rightX * lateralSpeed;
    state.vy = forwardY * forwardSpeed + rightY * lateralSpeed;

    // Travel per fixed step stays below ~8px at top speed (collision code uses a swept test).
    state.x += state.vx * dt;
    state.y += state.vy * dt;

    this.refreshDerived(state, surface.id);
    return state;
  }

  resolveWallCollision(state: KartState, collision: WallCollision): void {
    const nx = collision.nx;
    const ny = collision.ny;
    const normalLength = Math.sqrt(nx * nx + ny * ny);
    if (normalLength <= EPSILON) {
      return;
    }

    const invNormalLength = 1 / normalLength;
    const unx = nx * invNormalLength;
    const uny = ny * invNormalLength;
    const tx = -uny;
    const ty = unx;
    const normalSpeed = state.vx * unx + state.vy * uny;
    const tangentSpeed = state.vx * tx + state.vy * ty;
    const impact = Math.max(0, -normalSpeed);

    state.x += unx * Math.max(0, collision.penetration);
    state.y += uny * Math.max(0, collision.penetration);

    const reflectedNormal = normalSpeed < 0 ? -normalSpeed * this.config.collisionRestitution : normalSpeed;
    state.vx = unx * reflectedNormal + tx * tangentSpeed * this.config.collisionTangentKeep;
    state.vy = uny * reflectedNormal + ty * tangentSpeed * this.config.collisionTangentKeep;
    state.stunTime = Math.max(state.stunTime, Math.min(this.config.maxImpactStun, impact * this.config.impactStunPerSpeed));
    state.lastImpactStrength = impact;
    this.refreshDerived(state, state.surfaceId);
  }

  private updateDriftState(state: KartState, input: KartInput, slipAngle: number, speed: number, dt: number): void {
    if (state.driftState === "BOOST") {
      state.boostTimeLeft = Math.max(0, state.boostTimeLeft - dt);
      state.boostMultiplier = 1 + (state.boostMultiplier - 1) * Math.exp(-this.config.boostDecay * dt);
      if (state.boostTimeLeft <= 0 || state.boostMultiplier < 1.01) {
        state.driftState = "GRIP";
        state.boostMultiplier = 1;
        state.boostDuration = 0;
        state.isBoosting = false;
        this.events.boostEnd = true;
      }
      return;
    }

    const canDrift = speed >= this.config.driftMinSpeed;
    const absSteer = Math.abs(input.steer);

    // Sustained hard steering at high slip (touch auto-drift) needs a short hold to trigger.
    if (input.autoDrift && absSteer >= this.config.driftAutoSteerThreshold && Math.abs(slipAngle) > this.config.slipThreshold) {
      state.steerHoldTime += dt;
    } else if (state.driftState === "GRIP") {
      state.steerHoldTime = 0;
    }

    if (state.driftState === "GRIP") {
      const wantsDrift = (input.drift && absSteer > DRIFT_ENTRY_STEER) || state.steerHoldTime >= this.config.driftAutoHoldTime;
      if (canDrift && wantsDrift) {
        state.driftState = "DRIFT_CHARGING";
        state.driftDirection = input.steer < 0 ? -1 : 1;
        state.driftCharge = 0;
        state.driftTier = 0;
        this.events.driftStart = true;
      }
      return;
    }

    // DRIFT_CHARGING: stay while held (button, or auto-drift steering the same way).
    const holdsAuto = input.autoDrift && input.steer * state.driftDirection > DRIFT_HOLD_STEER;
    if (speed < this.config.driftMinSpeed * 0.6 || !(input.drift || holdsAuto)) {
      state.steerHoldTime = 0;
      this.releaseDrift(state);
      return;
    }

    const previousTier = state.driftTier;
    state.driftCharge += (this.config.driftChargeRate + Math.min(1.4, Math.abs(slipAngle)) * this.config.driftSlipCharge) * dt;
    state.driftTier = this.getTier(state.driftCharge);
    if (state.driftTier > previousTier) {
      this.events.driftTier = state.driftTier;
    }
  }

  private releaseDrift(state: KartState): void {
    const tier = state.driftTier;
    state.driftCharge = 0;
    state.driftTier = 0;
    state.driftDirection = 0;
    if (tier === 0) {
      state.driftState = "GRIP";
      return;
    }

    state.driftState = "BOOST";
    state.boostDuration = this.getBoostDuration(tier);
    state.boostTimeLeft = state.boostDuration;
    state.boostMultiplier = this.getBoostMultiplier(tier);
    state.isBoosting = true;
    this.events.boostStart = tier;
  }

  private computeGrip(absSlip: number): number {
    if (absSlip <= this.config.slipThreshold) {
      return this.config.gripPeak;
    }

    const over = Math.min(1, (absSlip - this.config.slipThreshold) / Math.max(HALF_PI - this.config.slipThreshold, EPSILON));
    return this.config.gripPeak * (1 - over * this.config.gripFalloff);
  }

  private computeSteerCurve(speed01: number): number {
    const low = this.config.steerAtLowSpeed;
    const top = this.config.steerAtTopSpeed;
    const peak = this.config.steerPeakSpeed;
    if (speed01 < peak) {
      const t = speed01 / peak;
      return low + (1 - low) * t * (2 - t);
    }
    return 1 + (top - 1) * ((speed01 - peak) / Math.max(1 - peak, EPSILON));
  }

  private getEffectiveMaxSpeed(state: KartState, surface: SurfaceParams): number {
    return this.config.maxSpeed * surface.maxSpeedMultiplier * Math.max(surface.boostMultiplier, state.boostMultiplier);
  }

  private getTier(charge: number): 0 | 1 | 2 | 3 {
    if (charge >= this.config.driftTier3) return 3;
    if (charge >= this.config.driftTier2) return 2;
    if (charge >= this.config.driftTier1) return 1;
    return 0;
  }

  private getBoostDuration(tier: 1 | 2 | 3): number {
    if (tier === 1) return this.config.boostDurationTier1;
    if (tier === 2) return this.config.boostDurationTier2;
    return this.config.boostDurationTier3;
  }

  private getBoostMultiplier(tier: 1 | 2 | 3): number {
    if (tier === 1) return this.config.boostSpeedMultiplierTier1;
    if (tier === 2) return this.config.boostSpeedMultiplierTier2;
    return this.config.boostSpeedMultiplierTier3;
  }

  private refreshDerived(state: KartState, surfaceId: SurfaceId): void {
    const forwardX = Math.sin(state.rotation);
    const forwardY = -Math.cos(state.rotation);
    const rightX = Math.cos(state.rotation);
    const rightY = Math.sin(state.rotation);
    state.forwardSpeed = state.vx * forwardX + state.vy * forwardY;
    state.lateralSpeed = state.vx * rightX + state.vy * rightY;
    state.speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
    state.slipAngle = state.speed > 8 ? Math.atan2(state.lateralSpeed, Math.abs(state.forwardSpeed) + 40) : 0;
    state.isBoosting = state.driftState === "BOOST";
    state.surfaceId = surfaceId;
    const speed01 = clamp(state.speed / Math.max(1, this.config.maxSpeed), 0, 1);
    state.cameraLookAheadX = forwardX * this.config.cameraLookAhead * speed01;
    state.cameraLookAheadY = forwardY * this.config.cameraLookAhead * speed01;
    state.cameraZoom = 1 - this.config.cameraZoomOut * speed01 - (state.isBoosting ? 0.025 : 0);
  }

  private resetEvents(): void {
    this.events.driftStart = false;
    this.events.driftTier = 0;
    this.events.boostStart = 0;
    this.events.boostEnd = false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta);
  return Math.max(target, current - maxDelta);
}

function wrapAngle(angle: number): number {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

export interface KartStepHost {
  readInput(): KartInput;
  getSurface(state: KartState): SurfaceParams;
  afterStep(state: KartState, events: KartPhysicsEvents): void;
}

/**
 * Fixed-timestep driver (accumulator + spiral-of-death clamp) with render interpolation.
 * The host is an interface implemented by the caller, so no closure is created per frame.
 */
export class PhysicsLoop {
  renderX = 0;
  renderY = 0;
  renderRotation = 0;
  alpha = 0;
  stepsLastFrame = 0;
  private accumulator = 0;

  constructor(public physics: KartPhysics) {}

  reset(state: KartState): void {
    this.accumulator = 0;
    this.alpha = 0;
    this.stepsLastFrame = 0;
    this.renderX = state.x;
    this.renderY = state.y;
    this.renderRotation = state.rotation;
  }

  advance(frameDt: number, state: KartState, host: KartStepHost): void {
    const fixedDt = this.physics.config.fixedDt;
    const maxSteps = this.physics.config.maxSubSteps;
    this.accumulator += Math.max(0, frameDt);

    let steps = 0;
    while (this.accumulator >= fixedDt && steps < maxSteps) {
      this.physics.step(state, host.readInput(), host.getSurface(state), fixedDt);
      host.afterStep(state, this.physics.events);
      this.accumulator -= fixedDt;
      steps += 1;
    }
    if (this.accumulator >= fixedDt) {
      this.accumulator = 0; // drop the backlog instead of spiralling.
    }

    this.stepsLastFrame = steps;
    this.alpha = this.accumulator / fixedDt;
    this.renderX = state.prevX + (state.x - state.prevX) * this.alpha;
    this.renderY = state.prevY + (state.y - state.prevY) * this.alpha;
    this.renderRotation = state.prevRotation + wrapAngle(state.rotation - state.prevRotation) * this.alpha;
  }
}
