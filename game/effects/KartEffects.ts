import Phaser from "phaser";
import type { KartState } from "@/game/physics/KartPhysics";

const SKID_POOL = 160;
const SKID_LIFE = 3.2; // seconds
const SKID_SPACING = 9; // px travelled between mark pairs
const SKID_MIN_SLIP = 0.2; // rad
const SKID_MIN_SPEED = 120; // px/s
const SPARK_POOL = 56;
const SPARK_LIFE = 0.42; // seconds
const SPARK_RATE = 46; // sparks/s while drifting
const REAR_OFFSET = 30; // px behind the kart center
const WHEEL_OFFSET = 20; // px sideways from the kart center

const TIER_TINTS = [0xffffff, 0x60a5fa, 0xfb923c, 0xf472b6] as const;

/** Skid marks and drift sparks driven by slip data. Everything is pooled up front. */
export class KartEffects {
  private readonly skids: Phaser.GameObjects.Image[] = [];
  private readonly skidAge = new Float32Array(SKID_POOL);
  private readonly skidActive = new Uint8Array(SKID_POOL);
  private readonly sparks: Phaser.GameObjects.Image[] = [];
  private readonly sparkAge = new Float32Array(SPARK_POOL);
  private readonly sparkVx = new Float32Array(SPARK_POOL);
  private readonly sparkVy = new Float32Array(SPARK_POOL);
  private readonly sparkActive = new Uint8Array(SPARK_POOL);
  private skidCursor = 0;
  private sparkCursor = 0;
  private sparkBudget = 0;
  private distanceSinceSkid = 0;
  private lastX = 0;
  private lastY = 0;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < SKID_POOL; i += 1) {
      this.skids.push(scene.add.image(0, 0, "skid").setDepth(0.5).setVisible(false));
    }
    for (let i = 0; i < SPARK_POOL; i += 1) {
      this.sparks.push(scene.add.image(0, 0, "spark").setDepth(3).setVisible(false).setBlendMode(Phaser.BlendModes.ADD));
    }
  }

  reset(x: number, y: number): void {
    this.skidActive.fill(0);
    this.sparkActive.fill(0);
    for (let i = 0; i < SKID_POOL; i += 1) this.skids[i].setVisible(false);
    for (let i = 0; i < SPARK_POOL; i += 1) this.sparks[i].setVisible(false);
    this.lastX = x;
    this.lastY = y;
    this.distanceSinceSkid = 0;
  }

  update(state: KartState, x: number, y: number, rotation: number, dt: number): void {
    const forwardX = Math.sin(rotation);
    const forwardY = -Math.cos(rotation);
    const rightX = Math.cos(rotation);
    const rightY = Math.sin(rotation);
    const rearX = x - forwardX * REAR_OFFSET;
    const rearY = y - forwardY * REAR_OFFSET;
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    this.lastX = x;
    this.lastY = y;

    const sliding = state.speed > SKID_MIN_SPEED && (Math.abs(state.slipAngle) > SKID_MIN_SLIP || state.driftState === "DRIFT_CHARGING");
    if (sliding) {
      this.distanceSinceSkid += Math.sqrt(dx * dx + dy * dy);
      if (this.distanceSinceSkid >= SKID_SPACING) {
        this.distanceSinceSkid = 0;
        this.placeSkid(rearX - rightX * WHEEL_OFFSET, rearY - rightY * WHEEL_OFFSET, rotation);
        this.placeSkid(rearX + rightX * WHEEL_OFFSET, rearY + rightY * WHEEL_OFFSET, rotation);
      }
    }

    const emitting = state.driftState === "DRIFT_CHARGING" || state.isBoosting;
    if (emitting) {
      this.sparkBudget += SPARK_RATE * dt;
      while (this.sparkBudget >= 1) {
        this.sparkBudget -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        this.placeSpark(
          rearX + rightX * WHEEL_OFFSET * side,
          rearY + rightY * WHEEL_OFFSET * side,
          -forwardX * 90 + rightX * side * (40 + Math.random() * 90),
          -forwardY * 90 + rightY * side * (40 + Math.random() * 90),
          state.isBoosting ? 0xfde047 : TIER_TINTS[state.driftTier],
        );
      }
    } else {
      this.sparkBudget = 0;
    }

    for (let i = 0; i < SKID_POOL; i += 1) {
      if (this.skidActive[i] === 0) continue;
      this.skidAge[i] += dt;
      if (this.skidAge[i] >= SKID_LIFE) {
        this.skidActive[i] = 0;
        this.skids[i].setVisible(false);
      } else {
        this.skids[i].setAlpha((1 - this.skidAge[i] / SKID_LIFE) * 0.55);
      }
    }
    for (let i = 0; i < SPARK_POOL; i += 1) {
      if (this.sparkActive[i] === 0) continue;
      this.sparkAge[i] += dt;
      if (this.sparkAge[i] >= SPARK_LIFE) {
        this.sparkActive[i] = 0;
        this.sparks[i].setVisible(false);
      } else {
        const spark = this.sparks[i];
        spark.x += this.sparkVx[i] * dt;
        spark.y += this.sparkVy[i] * dt;
        spark.setAlpha(1 - this.sparkAge[i] / SPARK_LIFE);
      }
    }
  }

  private placeSkid(x: number, y: number, rotation: number): void {
    const i = this.skidCursor;
    this.skidCursor = (this.skidCursor + 1) % SKID_POOL;
    this.skidAge[i] = 0;
    this.skidActive[i] = 1;
    this.skids[i].setPosition(x, y).setRotation(rotation).setAlpha(0.55).setVisible(true);
  }

  private placeSpark(x: number, y: number, vx: number, vy: number, tint: number): void {
    const i = this.sparkCursor;
    this.sparkCursor = (this.sparkCursor + 1) % SPARK_POOL;
    this.sparkAge[i] = 0;
    this.sparkVx[i] = vx;
    this.sparkVy[i] = vy;
    this.sparkActive[i] = 1;
    this.sparks[i].setPosition(x, y).setTint(tint).setAlpha(1).setVisible(true);
  }
}
