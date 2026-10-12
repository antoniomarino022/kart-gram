import { DT } from "./core/config";
import type { PowerupKind } from "./core/items";
import { createGame, finalScore, revive, step, type GameEvent, type GameState, type Steer, type UpgradeLevels } from "./core/sim";
import { attachInput } from "./input/pointer";
import { InputRecorder } from "./inputRecorder";
import { GameRenderer, type KartPose, type Loadout } from "./render/GameRenderer";
import type { ModelLibrary } from "./render/models";
import { haptic, onVisibilityChange } from "@/telegram/webapp";

export interface HudSnapshot {
  score: number;
  combo: number;
  coins: number;
  /** m/s */
  speed: number;
  powerups: Record<PowerupKind, number>;
  drifting: boolean;
  biome: number;
  /** Secondi di boost (pedane) rimasti. */
  boostTimer: number;
}

const HAPTICS: Partial<Record<GameEvent["type"], Parameters<typeof haptic>[0]>> = {
  hit: "medium",
  fall: "heavy",
  powerup: "light",
  shieldUsed: "light",
  gameover: "error",
  boost: "light",
};

const copyPose = (k: KartPose, out: KartPose) => {
  out.x = k.x; out.y = k.y; out.angle = k.angle; out.elevation = k.elevation;
  return out;
};

/**
 * Loop di gioco fuori da React: timestep fisso, registrazione input per il replay, eventi e haptics.
 *
 * Il canvas va riusato tra una partita e l'altra (un solo contesto WebGL): la UI tiene montato un unico
 * `<canvas>` e crea un nuovo Game sullo stesso elemento dopo `destroy()` del precedente. Creare canvas nuovi
 * a ogni partita accumula contesti WebGL, che i browser mobili limitano.
 */
export class Game {
  readonly state: GameState;
  private recorder = new InputRecorder();
  private renderer: GameRenderer;
  private onEvent: (e: GameEvent) => void;
  private canvas: HTMLCanvasElement;
  private prevPose: KartPose;

  private steer: Steer = 0;
  private _paused = false;
  private activeMs = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private started = false;
  private destroyed = false;
  /** In pausa si disegna solo quando serve (entrata in pausa, resize). */
  private needsFrame = true;
  private cleanups: (() => void)[] = [];

  constructor(opts: { canvas: HTMLCanvasElement; models: ModelLibrary; loadout: Loadout; seed: number; upgrades: UpgradeLevels; onEvent: (e: GameEvent) => void }) {
    this.canvas = opts.canvas;
    this.onEvent = opts.onEvent;
    this.state = createGame(opts.seed, opts.upgrades);
    this.prevPose = copyPose(this.state.kart, { x: 0, y: 0, angle: 0, elevation: 0 });
    this.renderer = new GameRenderer(opts.canvas, opts.models, opts.loadout);
  }

  /** input changes as [tick, steer], ready for RunResult.inputs */
  get inputs() { return this.recorder.inputs; }
  /** active (unpaused) play time */
  get durationMs() { return Math.round(this.activeMs); }
  get paused() { return this._paused; }

  start() {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.cleanups.push(attachInput(this.canvas, (s) => { this.steer = s; }));
    this.cleanups.push(onVisibilityChange((visible) => { if (!visible) this.pause(); }));
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => { this.renderer.resize(); this.needsFrame = true; });
      ro.observe(this.canvas);
      this.cleanups.push(() => ro.disconnect());
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  pause() { this._paused = true; this.needsFrame = true; }
  resume() { this._paused = false; }

  /** wraps sim revive */
  revive(): boolean {
    if (!revive(this.state)) return false;
    this.acc = 0;
    copyPose(this.state.kart, this.prevPose);
    return true;
  }

  hud(): HudSnapshot {
    const s = this.state;
    return {
      score: finalScore(s),
      combo: s.combo,
      coins: s.coins,
      speed: s.kart.speed,
      powerups: { ...s.powerups },
      drifting: s.kart.drifting,
      biome: s.biome,
      boostTimer: s.boostTimer,
    };
  }

  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const frameDt = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const st = this.state;

    if (!this._paused && st.phase !== "over") {
      this.activeMs += frameDt * 1000;
      this.acc += frameDt;
      while (this.acc >= DT) {
        this.recorder.record(st.tick, this.steer);
        copyPose(st.kart, this.prevPose);
        const wasDrifting = st.kart.drifting;
        step(st, this.steer);
        this.acc -= DT;
        if (!wasDrifting && st.kart.drifting) haptic("light");
        for (const e of st.events) {
          // lo scudo riporta il kart al centro: niente interpolazione dalla posa fuori strada
          if (e.type === "shieldUsed") copyPose(st.kart, this.prevPose);
          this.dispatch(e);
        }
        if (this.destroyed) return;
        if (this.over()) break;
      }
      if (this.over()) {
        this.acc = 0;
        copyPose(st.kart, this.prevPose);
      }
    }
    // in pausa si salta il render (salvo un frame dopo pausa/resize, con dt 0); a partita finita la scena continua ad animarsi
    if (this._paused && !this.needsFrame) return;
    this.needsFrame = false;
    this.renderer.render(st, this.prevPose, this.acc / DT, this._paused ? 0 : frameDt);
  };

  // funzione (non confronto diretto) perché step() cambia phase alle spalle del narrowing di TS
  private over() { return this.state.phase === "over"; }

  private dispatch(e: GameEvent) {
    const h = HAPTICS[e.type];
    if (h) haptic(h);
    try {
      this.onEvent(e);
    } catch (err) {
      console.error("[game] errore in onEvent", err);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.renderer.dispose();
  }
}
