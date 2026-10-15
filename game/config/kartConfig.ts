import type Phaser from "phaser";

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

// Vehicle tunables moved to game/config/kartPhysicsConfig.ts.
export const KART_CONFIG = {
  coinValue: 10,
  autoThrottle: true,
} as const;

export const GAME_EVENTS = {
  hud: "kart:hud",
  gameOver: "kart:game-over",
  restart: "kart:restart",
  pause: "kart:pause",
  resume: "kart:resume",
} as const;

export interface KartTheme {
  background: number;
  road: number;
  roadEdge: number;
  text: string;
  panel: string;
  button: string;
  buttonText: string;
}

export interface HudSnapshot {
  score: number;
  coins: number;
  elapsedMs: number;
  speed: number;
  isGameOver: boolean;
}

export type HudEmitter = Phaser.Events.EventEmitter;
