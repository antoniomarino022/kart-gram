import Phaser from "phaser";
import type { KartPhysicsPresetId } from "@/game/config/kartPhysicsConfig";
import type { KartState } from "@/game/physics/KartPhysics";

/** Dev-only overlay. Imported dynamically from MainScene behind a NODE_ENV check, so it never ships. */
export class KartDebugOverlay {
  private readonly lines: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.lines = scene.add.graphics().setDepth(1000);
    this.text = scene
      .add.text(8, 96, "", { fontFamily: "monospace", fontSize: "18px", color: "#a7f3d0", backgroundColor: "#000000aa" })
      .setScrollFactor(0)
      .setDepth(1000);
  }

  update(state: KartState, x: number, y: number, fps: number, presetId: KartPhysicsPresetId, steps: number): void {
    const rotation = state.rotation;
    const fx = Math.sin(rotation);
    const fy = -Math.cos(rotation);
    const rx = Math.cos(rotation);
    const ry = Math.sin(rotation);
    const k = 0.25;

    this.lines.clear();
    this.lines.lineStyle(4, 0xffffff, 1).lineBetween(x, y, x + state.vx * k, y + state.vy * k);
    this.lines.lineStyle(4, 0x22c55e, 1).lineBetween(x, y, x + fx * state.forwardSpeed * k, y + fy * state.forwardSpeed * k);
    this.lines.lineStyle(4, 0xef4444, 1).lineBetween(x, y, x + rx * state.lateralSpeed * k, y + ry * state.lateralSpeed * k);

    this.text.setText(
      [
        `fps ${fps.toFixed(0)}  steps ${steps}  ${presetId}`,
        `speed ${state.speed.toFixed(0)}  fwd ${state.forwardSpeed.toFixed(0)}  lat ${state.lateralSpeed.toFixed(0)}`,
        `slip ${((state.slipAngle * 180) / Math.PI).toFixed(1)}deg  grip ${state.currentGrip.toFixed(2)}`,
        `${state.driftState} tier ${state.driftTier} charge ${state.driftCharge.toFixed(2)}`,
        `surface ${state.surfaceId}  impact ${state.lastImpactStrength.toFixed(0)}`,
      ].join("\n"),
    );
  }

  destroy(): void {
    this.lines.destroy();
    this.text.destroy();
  }
}
