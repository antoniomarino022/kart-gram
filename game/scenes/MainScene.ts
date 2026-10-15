import Phaser from "phaser";
import {
  GAME_EVENTS,
  GAME_WIDTH,
  KART_CONFIG,
} from "@/game/config/kartConfig";
import type { HudEmitter, HudSnapshot, KartTheme } from "@/game/config/kartConfig";
import { KART_PHYSICS_EVENTS, KART_PHYSICS_PRESETS, SURFACES } from "@/game/config/kartPhysicsConfig";
import type { KartPhysicsPresetId, SurfaceParams } from "@/game/config/kartPhysicsConfig";
import { KartPhysics, PhysicsLoop } from "@/game/physics/KartPhysics";
import type { KartInput, KartPhysicsEvents, KartState, KartStepHost, WallCollision } from "@/game/physics/KartPhysics";
import { DampedValue } from "@/game/effects/DampedValue";
import { KartEffects } from "@/game/effects/KartEffects";
import type { KartDebugOverlay } from "@/game/debug/KartDebugOverlay"; // CHANGED: type-only, the overlay is loaded dynamically in dev.

const SEGMENT_COUNT = 9;
const SEGMENT_HEIGHT = 320;
const COIN_COUNT = 26;
const OBSTACLE_COUNT = 3; // few, so the run stays flowing.
const COIN_SPACING = 110; // px between coins of the weaving line.
const TRACK_CENTER_X = GAME_WIDTH / 2;
const TRACK_WIDTH = 430;
const KERB_WIDTH = 26;
const RUNOFF_WIDTH = 62;
// CHANGED: physics/world constants.
const KART_RADIUS = 26; // px; collision circle of the kart.
const OBSTACLE_RADIUS = 28; // px; collision circle of an obstacle.
const WALL_LIMIT = TRACK_WIDTH / 2 + RUNOFF_WIDTH - KART_RADIUS; // px from the track center to the wall contact.
const ZONE_COUNT = 5; // 4 boost pads + 1 oil patch.
const ZONE_HALF_WIDTH = 40;
const ZONE_HALF_HEIGHT = 48;
const CAMERA_KART_OFFSET_Y = 200; // px below the camera center where the kart sits at rest.
const IMPACT_FEEDBACK_MIN = 120; // px/s; weaker hits give no shake/haptics.
const PRESET_IDS: readonly KartPhysicsPresetId[] = ["ARCADE_TIGHT", "ARCADE_DRIFTY", "HEAVY_KART"];

type ControlSide = "left" | "right";
type ColliderObject =
  | Phaser.Physics.Arcade.Body
  | Phaser.Physics.Arcade.StaticBody
  | Phaser.Types.Physics.Arcade.GameObjectWithBody
  | Phaser.Tilemaps.Tile;

interface TrackSegment {
  graphics: Phaser.GameObjects.Graphics;
  y: number;
  curve: number;
  index: number;
}

function isPresetId(value: string | null): value is KartPhysicsPresetId {
  return value !== null && (PRESET_IDS as readonly string[]).includes(value);
}

// CHANGED: implements KartStepHost so the fixed-step loop calls us without per-frame closures.
export class MainScene extends Phaser.Scene implements KartStepHost {
  private kart!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<"w" | "a" | "s" | "d" | "space" | "shift", Phaser.Input.Keyboard.Key>;
  private hudEmitter!: HudEmitter;
  private theme!: KartTheme;
  private segments: TrackSegment[] = [];
  private coins!: Phaser.Physics.Arcade.Group;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private activePointers = new Map<number, ControlSide>();
  private leftPointerCount = 0;
  private rightPointerCount = 0;
  private score = 0;
  private coinTotal = 0;
  private elapsedMs = 0;
  private hudAccumulator = 0;
  private isGameOver = false;
  private readonly hudSnapshot: HudSnapshot = { score: 0, coins: 0, elapsedMs: 0, speed: 0, isGameOver: false };
  // CHANGED: physics layer state (all reused, nothing allocated per frame).
  private kartPhysics!: KartPhysics;
  private loop!: PhysicsLoop;
  private kartState!: KartState;
  private readonly kartInput: KartInput = { throttle: 0, brake: 0, steer: 0, drift: false, autoDrift: false };
  private readonly collision: WallCollision = { nx: 0, ny: 0, penetration: 0 };
  private effects!: KartEffects;
  private readonly camX = new DampedValue(0);
  private readonly camY = new DampedValue(0);
  private readonly camZoom = new DampedValue(1);
  private obstacleList: Phaser.Physics.Arcade.Sprite[] = [];
  private zoneSprites: Phaser.GameObjects.Image[] = [];
  private zoneSurfaces: SurfaceParams[] = [];
  private frameImpact = 0;
  private recycleBottom = 0;
  private nextCoinY = 0;
  private coinPhase = 0;
  private presetId: KartPhysicsPresetId = "ARCADE_TIGHT";
  private debugEnabled = false;
  private debugOverlay: KartDebugOverlay | null = null;
  private presetKeys: Phaser.Input.Keyboard.Key[] = [];
  private isShutdown = false;

  constructor() {
    super("MainScene");
  }

  create(): void {
    this.segments = [];
    this.activePointers.clear();
    this.leftPointerCount = 0;
    this.rightPointerCount = 0;
    this.score = 0;
    this.coinTotal = 0;
    this.elapsedMs = 0;
    this.hudAccumulator = 0;
    this.isGameOver = false;
    this.isShutdown = false;
    this.frameImpact = 0;
    this.obstacleList = [];
    this.zoneSprites = [];
    this.zoneSurfaces = [];
    this.presetKeys = [];
    this.hudEmitter = this.registry.get("hudEmitter") as HudEmitter;
    this.theme = this.registry.get("kartTheme") as KartTheme;
    this.createTextures();
    this.createTrack();
    this.createKart();
    this.spawnCoins();
    this.spawnObstacles();
    this.spawnZones();
    this.effects = new KartEffects(this);
    this.effects.reset(this.kartState.x, this.kartState.y);
    this.setupInput();
    this.setupLifecycleEvents();
    this.setupDevTools();
    this.snapCamera();
    this.emitHud(true);
  }

  // CHANGED: fixed-step physics, interpolated rendering, camera, effects.
  update(_time: number, delta: number): void {
    if (this.isGameOver) {
      return;
    }

    const dt = delta / 1000;
    this.elapsedMs += delta;
    this.frameImpact = 0;
    this.handleDevKeys();
    this.loop.advance(dt, this.kartState, this);

    const renderX = this.loop.renderX;
    const renderY = this.loop.renderY;
    const renderRotation = this.loop.renderRotation;
    this.kart.setPosition(renderX, renderY);
    this.kart.setRotation(renderRotation);
    this.effects.update(this.kartState, renderX, renderY, renderRotation, dt);
    this.updateCamera(dt);
    this.reactToImpact();
    this.recycleWorld();
    this.checkGameOver();
    this.emitHud(false);
    this.debugOverlay?.update(this.kartState, renderX, renderY, this.game.loop.actualFps, this.presetId, this.loop.stepsLastFrame);
  }

  private createTextures(): void {
    const g = this.add.graphics();
    g.fillStyle(0xef4444).fillRoundedRect(0, 0, 54, 86, 14);
    g.fillStyle(0x111827).fillRoundedRect(10, 14, 34, 28, 6);
    g.fillStyle(0xfacc15).fillRect(8, 66, 38, 8);
    g.fillStyle(0x020617).fillRect(-5, 12, 10, 20).fillRect(49, 12, 10, 20).fillRect(-5, 54, 10, 20).fillRect(49, 54, 10, 20);
    g.generateTexture("kart", 64, 92);
    g.clear();
    g.fillStyle(0xfacc15).fillCircle(18, 18, 18);
    g.lineStyle(4, 0xfef08a).strokeCircle(18, 18, 12);
    g.generateTexture("coin", 36, 36);
    g.clear();
    g.fillStyle(0x94a3b8).fillRoundedRect(0, 0, 64, 42, 8);
    g.fillStyle(0x475569).fillRoundedRect(8, 8, 48, 26, 6);
    g.generateTexture("obstacle", 64, 42);
    g.clear();
    g.fillStyle(0x111827, 1).fillRect(0, 0, 10, 26);
    g.generateTexture("skid", 10, 26);
    g.clear();
    g.fillStyle(0xffffff).fillCircle(5, 5, 5);
    g.generateTexture("spark", 10, 10);
    g.clear();
    g.fillStyle(0x0ea5e9, 0.85).fillRoundedRect(0, 0, 80, 96, 10);
    g.fillStyle(0xf8fafc, 0.9).fillTriangle(40, 14, 62, 44, 18, 44).fillTriangle(40, 48, 62, 78, 18, 78);
    g.generateTexture("pad", 80, 96);
    g.clear();
    g.fillStyle(0x0b1220, 0.8).fillEllipse(40, 48, 78, 94);
    g.fillStyle(0x38bdf8, 0.35).fillEllipse(34, 40, 36, 44);
    g.generateTexture("oil", 80, 96);
    g.destroy();
  }

  // CHANGED: segments live in world space (segment index m covers y = m*SEGMENT_HEIGHT .. +SEGMENT_HEIGHT).
  private createTrack(): void {
    this.cameras.main.setBackgroundColor(this.theme.background);
    for (let i = 0; i < SEGMENT_COUNT; i += 1) {
      const index = i - (SEGMENT_COUNT - 2);
      const graphics = this.add.graphics();
      const curve = this.getCircuitCurve(index);
      this.drawTrackSegment(graphics, curve, index);
      graphics.setY(index * SEGMENT_HEIGHT);
      this.segments.push({ graphics, y: index * SEGMENT_HEIGHT, curve, index });
    }
  }

  private drawTrackSegment(graphics: Phaser.GameObjects.Graphics, curve: number, index: number): void {
    const nextCurve = this.getCircuitCurve(index + 1);
    const topCenter = TRACK_CENTER_X + curve;
    const bottomCenter = TRACK_CENTER_X + nextCurve;
    const roadLeftTop = topCenter - TRACK_WIDTH / 2;
    const roadRightTop = topCenter + TRACK_WIDTH / 2;
    const roadLeftBottom = bottomCenter - TRACK_WIDTH / 2;
    const roadRightBottom = bottomCenter + TRACK_WIDTH / 2;
    const kerbPhase = index % 2;

    graphics.clear();
    graphics.fillStyle(0x2f7d32).fillRect(-240, -2, GAME_WIDTH + 480, SEGMENT_HEIGHT + 4); // CHANGED: wider, the camera zooms out at speed.

    graphics.fillStyle(0x6b7280, 0.7);
    graphics.fillPoints([
      new Phaser.Math.Vector2(roadLeftTop - RUNOFF_WIDTH, -2),
      new Phaser.Math.Vector2(roadLeftTop - KERB_WIDTH, -2),
      new Phaser.Math.Vector2(roadLeftBottom - KERB_WIDTH, SEGMENT_HEIGHT + 2),
      new Phaser.Math.Vector2(roadLeftBottom - RUNOFF_WIDTH, SEGMENT_HEIGHT + 2),
    ]);
    graphics.fillPoints([
      new Phaser.Math.Vector2(roadRightTop + KERB_WIDTH, -2),
      new Phaser.Math.Vector2(roadRightTop + RUNOFF_WIDTH, -2),
      new Phaser.Math.Vector2(roadRightBottom + RUNOFF_WIDTH, SEGMENT_HEIGHT + 2),
      new Phaser.Math.Vector2(roadRightBottom + KERB_WIDTH, SEGMENT_HEIGHT + 2),
    ]);

    this.drawKerb(graphics, roadLeftTop, roadLeftBottom, -KERB_WIDTH, kerbPhase);
    this.drawKerb(graphics, roadRightTop, roadRightBottom, KERB_WIDTH, kerbPhase);

    graphics.fillStyle(this.theme.road).fillPoints([
      new Phaser.Math.Vector2(roadLeftTop, -2),
      new Phaser.Math.Vector2(roadRightTop, -2),
      new Phaser.Math.Vector2(roadRightBottom, SEGMENT_HEIGHT + 2),
      new Phaser.Math.Vector2(roadLeftBottom, SEGMENT_HEIGHT + 2),
    ]);
    graphics.lineStyle(3, 0xf8fafc, 0.55);
    graphics.lineBetween(roadLeftTop + 18, 0, roadLeftBottom + 18, SEGMENT_HEIGHT);
    graphics.lineBetween(roadRightTop - 18, 0, roadRightBottom - 18, SEGMENT_HEIGHT);

    graphics.lineStyle(4, 0xf8fafc, 0.42);
    for (let y = 22; y < SEGMENT_HEIGHT; y += 72) {
      const t1 = y / SEGMENT_HEIGHT;
      const t2 = Math.min((y + 34) / SEGMENT_HEIGHT, 1);
      graphics.lineBetween(
        Phaser.Math.Linear(topCenter, bottomCenter, t1),
        y,
        Phaser.Math.Linear(topCenter, bottomCenter, t2),
        Math.min(y + 34, SEGMENT_HEIGHT),
      );
    }

    if (index % 7 === 0) {
      this.drawStartGrid(graphics, topCenter, bottomCenter);
    }
  }

  private drawKerb(
    graphics: Phaser.GameObjects.Graphics,
    topEdge: number,
    bottomEdge: number,
    width: number,
    phase: number,
  ): void {
    const stripes = 8;
    for (let i = 0; i < stripes; i += 1) {
      const y1 = (i / stripes) * SEGMENT_HEIGHT;
      const y2 = ((i + 1) / stripes) * SEGMENT_HEIGHT;
      const t1 = y1 / SEGMENT_HEIGHT;
      const t2 = y2 / SEGMENT_HEIGHT;
      const edge1 = Phaser.Math.Linear(topEdge, bottomEdge, t1);
      const edge2 = Phaser.Math.Linear(topEdge, bottomEdge, t2);
      graphics.fillStyle((i + phase) % 2 === 0 ? 0xef4444 : 0xf8fafc);
      graphics.fillPoints([
        new Phaser.Math.Vector2(edge1, y1),
        new Phaser.Math.Vector2(edge1 + width, y1),
        new Phaser.Math.Vector2(edge2 + width, y2),
        new Phaser.Math.Vector2(edge2, y2),
      ]);
    }
  }

  private drawStartGrid(graphics: Phaser.GameObjects.Graphics, topCenter: number, bottomCenter: number): void {
    const y = 74;
    const center = Phaser.Math.Linear(topCenter, bottomCenter, y / SEGMENT_HEIGHT);
    const cellWidth = 34;
    const cellHeight = 22;
    for (let row = 0; row < 2; row += 1) {
      for (let col = -5; col < 5; col += 1) {
        graphics.fillStyle((row + col) % 2 === 0 ? 0xf8fafc : 0x111827);
        graphics.fillRect(center + col * cellWidth, y + row * cellHeight, cellWidth, cellHeight);
      }
    }
  }

  private getCircuitCurve(index: number): number {
    const pattern = [0, -72, -118, -48, 84, 132, 46, -96, -138, -20, 116, 70];
    return pattern[((index % pattern.length) + pattern.length) % pattern.length];
  }

  // CHANGED: closed form (no segment search), valid for any world y.
  private getTrackCenterAt(worldY: number): number {
    const m = Math.floor(worldY / SEGMENT_HEIGHT);
    const t = worldY / SEGMENT_HEIGHT - m;
    return TRACK_CENTER_X + this.getCircuitCurve(m) * (1 - t) + this.getCircuitCurve(m + 1) * t;
  }

  private getTrackSlopeAt(worldY: number): number {
    const m = Math.floor(worldY / SEGMENT_HEIGHT);
    return (this.getCircuitCurve(m + 1) - this.getCircuitCurve(m)) / SEGMENT_HEIGHT;
  }

  // CHANGED: the kart is a world-space physics state; the sprite only mirrors it.
  private createKart(): void {
    this.kartPhysics = new KartPhysics(KART_PHYSICS_PRESETS[this.readPresetFromQuery()].config);
    this.loop = new PhysicsLoop(this.kartPhysics);
    this.kartState = this.kartPhysics.createState(TRACK_CENTER_X, 0, 0);
    this.loop.reset(this.kartState);
    this.kart = this.physics.add.sprite(this.kartState.x, this.kartState.y, "kart");
    this.kart.setDepth(2);
    this.kart.setDamping(false);
    this.kart.setCollideWorldBounds(false);
  }

  private readPresetFromQuery(): KartPhysicsPresetId {
    const requested = new URLSearchParams(window.location.search).get("preset");
    this.presetId = isPresetId(requested) ? requested : this.presetId;
    return this.presetId;
  }

  private setPreset(id: KartPhysicsPresetId): void {
    this.presetId = id;
    this.kartPhysics = new KartPhysics(KART_PHYSICS_PRESETS[id].config);
    this.loop.physics = this.kartPhysics;
  }

  private spawnCoins(): void {
    this.coins = this.physics.add.group({ maxSize: COIN_COUNT });
    this.nextCoinY = -120;
    this.coinPhase = 0;
    for (let i = 0; i < COIN_COUNT; i += 1) {
      const coin = this.createCollectible(this.coins, "coin");
      this.placeCoin(coin);
    }
    this.physics.add.overlap(this.kart, this.coins, this.collectCoin, undefined, this);
  }

  // CHANGED: obstacles are solid bodies resolved by KartPhysics (swept circle test), not overlaps.
  private spawnObstacles(): void {
    this.obstacles = this.physics.add.group({ maxSize: OBSTACLE_COUNT });
    for (let i = 0; i < OBSTACLE_COUNT; i += 1) {
      const obstacle = this.createCollectible(this.obstacles, "obstacle");
      this.resetCollectible(obstacle, -i * 900 - 900);
      this.obstacleList.push(obstacle);
    }
  }

  // CHANGED: mostly boost pads, one oil patch.
  private spawnZones(): void {
    for (let i = 0; i < ZONE_COUNT; i += 1) {
      const isPad = i !== 2;
      const zone = this.add.image(0, 0, isPad ? "pad" : "oil").setDepth(0.2);
      this.zoneSprites.push(zone);
      this.zoneSurfaces.push(isPad ? SURFACES.boostPad : SURFACES.ice);
      this.resetZone(i, -600 - i * 700);
    }
  }

  private resetZone(index: number, y: number): void {
    const center = this.getTrackCenterAt(y);
    const half = TRACK_WIDTH / 2 - 70;
    this.zoneSprites[index].setPosition(center + Phaser.Math.Between(-half, half), y);
  }

  // CHANGED: added drift keys (Space / Shift).
  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      shift: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
    };
    this.input.addPointer(2);
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
  }

  private setupLifecycleEvents(): void {
    const pause = (): void => {
      this.scene.pause();
    };
    const resume = (): void => {
      this.scene.resume();
    };
    const restart = (): void => {
      this.scene.restart();
    };
    const onVisibility = (): void => {
      if (document.hidden) pause();
      else resume();
    };
    const tg = this.registry.get("telegramWebApp") as TelegramWebApp | null;

    document.addEventListener("visibilitychange", onVisibility);
    tg?.onEvent("viewportChanged", pause);
    tg?.onEvent("deactivated", pause);
    this.hudEmitter.on(GAME_EVENTS.restart, restart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.isShutdown = true; // CHANGED
      this.debugOverlay?.destroy();
      this.debugOverlay = null;
      document.removeEventListener("visibilitychange", onVisibility);
      tg?.offEvent("viewportChanged", pause);
      tg?.offEvent("deactivated", pause);
      this.hudEmitter.off(GAME_EVENTS.restart, restart);
      this.input.off("pointerdown", this.onPointerDown, this);
      this.input.off("pointerup", this.onPointerUp, this);
      this.input.off("pointerupoutside", this.onPointerUp, this);
    });
  }

  // CHANGED: dev-only tooling. The NODE_ENV check is folded at build time, so the overlay chunk is dropped from production.
  private setupDevTools(): void {
    this.debugEnabled = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("debug") === "1";
    if (!this.debugEnabled) {
      return;
    }
    this.presetKeys = [
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    ];
    void import("@/game/debug/KartDebugOverlay").then(({ KartDebugOverlay: Overlay }) => {
      if (!this.isShutdown) {
        this.debugOverlay = new Overlay(this);
      }
    });
  }

  private handleDevKeys(): void {
    for (let i = 0; i < this.presetKeys.length; i += 1) {
      if (Phaser.Input.Keyboard.JustDown(this.presetKeys[i])) {
        this.setPreset(PRESET_IDS[i]);
      }
    }
  }

  // --- KartStepHost -------------------------------------------------------------------------

  readInput(): KartInput {
    const input = this.kartInput;
    const braking = this.cursors.down.isDown || this.keys.s.isDown;
    input.brake = braking ? 1 : 0;
    input.throttle = !braking && (KART_CONFIG.autoThrottle || this.cursors.up.isDown || this.keys.w.isDown) ? 1 : 0;
    input.steer = this.getSteerAxis();
    input.drift = this.keys.space.isDown || this.keys.shift.isDown;
    input.autoDrift = this.leftPointerCount + this.rightPointerCount > 0; // touch gets the auto-drift assist.
    return input;
  }

  getSurface(state: KartState): SurfaceParams {
    for (let i = 0; i < this.zoneSprites.length; i += 1) {
      const zone = this.zoneSprites[i];
      if (Math.abs(state.x - zone.x) < ZONE_HALF_WIDTH && Math.abs(state.y - zone.y) < ZONE_HALF_HEIGHT) {
        return this.zoneSurfaces[i];
      }
    }
    if (Math.abs(state.x - this.getTrackCenterAt(state.y)) > TRACK_WIDTH / 2) {
      return SURFACES.grass;
    }
    return SURFACES.asphalt;
  }

  afterStep(state: KartState, events: KartPhysicsEvents): void {
    const telegram = this.registry.get("telegramWebApp") as TelegramWebApp | null;
    if (events.driftStart) {
      this.hudEmitter.emit(KART_PHYSICS_EVENTS.driftStart);
    }
    if (events.driftTier > 0) {
      this.hudEmitter.emit(KART_PHYSICS_EVENTS.driftTier, events.driftTier);
      telegram?.HapticFeedback?.selectionChanged();
    }
    if (events.boostStart > 0) {
      this.hudEmitter.emit(KART_PHYSICS_EVENTS.boostStart, events.boostStart);
      telegram?.HapticFeedback?.impactOccurred("rigid");
    }
    if (events.boostEnd) {
      this.hudEmitter.emit(KART_PHYSICS_EVENTS.boostEnd);
    }
    this.collideWalls(state);
    this.collideObstacles(state);
  }

  // Half-plane test against the (curved) track walls: tunnel-proof at any speed.
  private collideWalls(state: KartState): void {
    const dx = state.x - this.getTrackCenterAt(state.y);
    const over = Math.abs(dx) - WALL_LIMIT;
    if (over <= 0) {
      return;
    }
    const slope = this.getTrackSlopeAt(state.y);
    const inv = 1 / Math.sqrt(1 + slope * slope);
    const side = dx > 0 ? 1 : -1;
    this.collision.nx = -side * inv;
    this.collision.ny = side * slope * inv;
    this.collision.penetration = over * inv;
    this.kartPhysics.resolveWallCollision(state, this.collision);
    this.frameImpact = Math.max(this.frameImpact, state.lastImpactStrength);
  }

  // Swept circle test (prev -> current position) so fast karts cannot skip an obstacle.
  private collideObstacles(state: KartState): void {
    const reach = KART_RADIUS + OBSTACLE_RADIUS;
    const sx = state.x - state.prevX;
    const sy = state.y - state.prevY;
    const len2 = sx * sx + sy * sy;
    for (let i = 0; i < this.obstacleList.length; i += 1) {
      const obstacle = this.obstacleList[i];
      if (!obstacle.active) {
        continue;
      }
      const ox = obstacle.x;
      const oy = obstacle.y;
      const t = len2 > 0.000001 ? Phaser.Math.Clamp(((ox - state.prevX) * sx + (oy - state.prevY) * sy) / len2, 0, 1) : 0;
      const cx = state.prevX + sx * t - ox;
      const cy = state.prevY + sy * t - oy;
      const dist2 = cx * cx + cy * cy;
      if (dist2 >= reach * reach) {
        continue;
      }
      const dist = Math.sqrt(dist2);
      let nx = 0;
      let ny = 1;
      if (dist > 0.0001) {
        nx = cx / dist;
        ny = cy / dist;
      } else if (len2 > 0.000001) {
        const len = Math.sqrt(len2);
        nx = -sx / len;
        ny = -sy / len;
      }
      state.x = ox + nx * reach;
      state.y = oy + ny * reach;
      this.collision.nx = nx;
      this.collision.ny = ny;
      this.collision.penetration = 0;
      this.kartPhysics.resolveWallCollision(state, this.collision);
      this.frameImpact = Math.max(this.frameImpact, state.lastImpactStrength);
    }
  }

  // --- Camera & feedback ----------------------------------------------------------------------

  private snapCamera(): void {
    const cam = this.cameras.main;
    this.camX.snap(TRACK_CENTER_X);
    this.camY.snap(this.kartState.y - CAMERA_KART_OFFSET_Y);
    this.camZoom.snap(1);
    cam.setZoom(1);
    cam.centerOn(this.camX.value, this.camY.value);
  }

  // Look-ahead + zoom-out scale with speed; velocity feed-forward cancels the follow lag.
  private updateCamera(dt: number): void {
    const state = this.kartState;
    const smooth = this.kartPhysics.config.cameraSmoothTime;
    const targetX = TRACK_CENTER_X + state.cameraLookAheadX * 0.3;
    const targetY = this.loop.renderY - CAMERA_KART_OFFSET_Y + state.vy * smooth + state.cameraLookAheadY;
    const cam = this.cameras.main;
    cam.setZoom(this.camZoom.update(state.cameraZoom, smooth, dt));
    cam.centerOn(this.camX.update(targetX, smooth, dt), this.camY.update(targetY, smooth, dt));
  }

  private reactToImpact(): void {
    const impact = this.frameImpact;
    if (impact < IMPACT_FEEDBACK_MIN) {
      return;
    }
    this.cameras.main.shake(130, Math.min(0.012, impact * 0.000014));
    (this.registry.get("telegramWebApp") as TelegramWebApp | null)?.HapticFeedback?.impactOccurred(impact > 420 ? "heavy" : "medium");
  }

  // --- World recycling -------------------------------------------------------------------------

  private recycleWorld(): void {
    const bottom = this.cameras.main.worldView.bottom;
    this.recycleBottom = bottom;
    for (let i = 0; i < this.segments.length; i += 1) {
      const segment = this.segments[i];
      if (segment.y > bottom) {
        segment.index -= SEGMENT_COUNT;
        segment.y = segment.index * SEGMENT_HEIGHT;
        segment.curve = this.getCircuitCurve(segment.index);
        this.drawTrackSegment(segment.graphics, segment.curve, segment.index);
        segment.graphics.setY(segment.y);
      }
    }
    this.coins.children.each(this.recycleCoin, this);
    this.obstacles.children.each(this.recycleObstacle, this);
    for (let i = 0; i < this.zoneSprites.length; i += 1) {
      if (this.zoneSprites[i].y > bottom + 80) {
        this.resetZone(i, this.kartState.y - Phaser.Math.Between(1100, 2000));
      }
    }
  }

  private recycleCoin(child: Phaser.GameObjects.GameObject): boolean {
    const coin = child as Phaser.Physics.Arcade.Sprite;
    if (coin.y > this.recycleBottom + 60) this.placeCoin(coin);
    return true;
  }

  private recycleObstacle(child: Phaser.GameObjects.GameObject): boolean {
    const obstacle = child as Phaser.Physics.Arcade.Sprite;
    if (obstacle.y > this.recycleBottom + 80) this.resetCollectible(obstacle, this.kartState.y - Phaser.Math.Between(1500, 2800));
    return true;
  }

  // Coins form a weaving line along the track: following it means driving smoothly.
  private placeCoin(coin: Phaser.Physics.Arcade.Sprite): void {
    this.nextCoinY = Math.min(this.nextCoinY, this.kartState.y - 400) - COIN_SPACING;
    this.coinPhase += 1;
    const y = this.nextCoinY;
    const x = this.getTrackCenterAt(y) + Math.sin(this.coinPhase * 0.28) * (TRACK_WIDTH / 2 - 90);
    coin.enableBody(true, x, y, true, true);
  }

  private createCollectible(group: Phaser.Physics.Arcade.Group, texture: string): Phaser.Physics.Arcade.Sprite {
    const sprite = this.physics.add.sprite(0, 0, texture);
    group.add(sprite);
    return sprite;
  }

  private resetCollectible(sprite: Phaser.Physics.Arcade.Sprite, y: number): void {
    const center = this.getTrackCenterAt(y);
    sprite.enableBody(true, Phaser.Math.Between(center - TRACK_WIDTH / 2 + 58, center + TRACK_WIDTH / 2 - 58), y, true, true);
  }

  private collectCoin(
    _kart: ColliderObject,
    coinObject: ColliderObject,
  ): void {
    const coin = coinObject as Phaser.Physics.Arcade.Sprite;
    coin.disableBody(true, true);
    this.coinTotal += 1;
    this.score += KART_CONFIG.coinValue;
    (this.registry.get("telegramWebApp") as TelegramWebApp | null)?.HapticFeedback?.selectionChanged();
    this.placeCoin(coin);
    this.emitHud(true);
  }

  private checkGameOver(): void {
    if (this.elapsedMs < 90000) {
      return;
    }
    this.isGameOver = true;
    this.physics.pause();
    this.emitHud(true);
    this.hudEmitter.emit(GAME_EVENTS.gameOver, this.hudSnapshot);
  }

  private emitHud(force: boolean): void {
    this.hudAccumulator += this.game.loop.delta;
    if (!force && this.hudAccumulator < 100) {
      return;
    }
    this.hudAccumulator = 0;
    this.hudSnapshot.score = this.score;
    this.hudSnapshot.coins = this.coinTotal;
    this.hudSnapshot.elapsedMs = this.elapsedMs;
    this.hudSnapshot.speed = this.kartState.speed * 0.24;
    this.hudSnapshot.isGameOver = this.isGameOver;
    this.hudEmitter.emit(GAME_EVENTS.hud, this.hudSnapshot);
  }

  private getSteerAxis(): number {
    let axis = 0;
    if (this.cursors.left.isDown || this.keys.a.isDown) axis -= 1;
    if (this.cursors.right.isDown || this.keys.d.isDown) axis += 1;
    if (this.leftPointerCount > 0) axis -= 1;
    if (this.rightPointerCount > 0) axis += 1;
    return Phaser.Math.Clamp(axis, -1, 1);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const side: ControlSide = pointer.x < this.scale.width / 2 ? "left" : "right";
    this.activePointers.set(pointer.id, side);
    if (side === "left") this.leftPointerCount += 1;
    else this.rightPointerCount += 1;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const side = this.activePointers.get(pointer.id);
    if (!side) {
      return;
    }
    if (side === "left") this.leftPointerCount = Math.max(0, this.leftPointerCount - 1);
    else this.rightPointerCount = Math.max(0, this.rightPointerCount - 1);
    this.activePointers.delete(pointer.id);
  }
}
