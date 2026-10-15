"use client";

import { useEffect, useRef, useState } from "react";
import { GAME_EVENTS, GAME_HEIGHT, GAME_WIDTH } from "@/game/config/kartConfig";
import type { HudEmitter, HudSnapshot, KartTheme } from "@/game/config/kartConfig";
import { useTelegramWebApp } from "@/hooks/useTelegramWebApp";

const INITIAL_HUD: HudSnapshot = {
  score: 0,
  coins: 0,
  elapsedMs: 0,
  speed: 0,
  isGameOver: false,
};

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function KartGameContainer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const emitterRef = useRef<HudEmitter | null>(null);
  const themeRef = useRef<KartTheme | null>(null);
  const { webApp, theme, stableHeight } = useTelegramWebApp();
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  useEffect(() => {
    themeRef.current = theme;
    const registry = gameRef.current?.registry;
    registry?.set("kartTheme", theme);
    const scene = gameRef.current?.scene.getScene("MainScene");
    scene?.events.emit("kart:theme", theme);
  }, [theme]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || gameRef.current) {
      return;
    }

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let removeHudListener: (() => void) | null = null;
    let removeRestartListener: (() => void) | null = null;
    let game: import("phaser").Game | null = null;

    const setupGame = async (): Promise<void> => {
      const Phaser = await import("phaser");
      const { MainScene } = await import("@/game/scenes/MainScene");

      if (disposed || gameRef.current) {
        return;
      }

      const emitter = new Phaser.Events.EventEmitter();
      emitterRef.current = emitter;
      removeHudListener = (): void => {
        emitter.off(GAME_EVENTS.hud, setHud);
      };
      emitter.on(GAME_EVENTS.hud, setHud);

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: container,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: themeRef.current?.background ?? theme.background,
        physics: {
          default: "arcade",
          arcade: { debug: false },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          zoom: Math.min(window.devicePixelRatio || 1, 2),
        },
        scene: [MainScene],
      };

      game = new Phaser.Game(config);
      game.registry.set("hudEmitter", emitter);
      game.registry.set("kartTheme", themeRef.current ?? theme);
      game.registry.set("telegramWebApp", webApp);
      gameRef.current = game;

      const resizeGame = (): void => {
        void container.getBoundingClientRect();
        game?.scale.refresh();
      };

      resizeObserver = new ResizeObserver(resizeGame);
      resizeObserver.observe(container);
      resizeGame();

      removeRestartListener = (): void => {
        emitter.off(GAME_EVENTS.restart);
      };
    };

    void setupGame();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      removeHudListener?.();
      removeRestartListener?.();
      emitterRef.current?.removeAllListeners();
      emitterRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      game = null;
    };
  }, [theme, webApp]);

  const restart = (): void => {
    emitterRef.current?.emit(GAME_EVENTS.restart);
  };

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-[var(--telegram-bg)] text-[var(--telegram-text)]"
      style={{
        height: stableHeight ? `${stableHeight}px` : "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div ref={containerRef} className="absolute inset-0 touch-none select-none" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 text-sm font-semibold">
        <div className="rounded-md bg-[color-mix(in_srgb,var(--telegram-panel)_86%,black)] px-3 py-2 shadow-lg">
          <div>Score {hud.score}</div>
          <div>Coins {hud.coins}</div>
        </div>
        <div className="rounded-md bg-[color-mix(in_srgb,var(--telegram-panel)_86%,black)] px-3 py-2 text-right shadow-lg">
          <div>{formatTime(hud.elapsedMs)}</div>
          <div>{Math.round(hud.speed)} km/h</div>
        </div>
      </div>
      {hud.isGameOver ? (
        <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-black/55 p-6">
          <div className="w-full max-w-xs rounded-lg bg-[var(--telegram-panel)] p-5 text-center shadow-2xl">
            <h1 className="text-2xl font-bold">Race complete</h1>
            <p className="mt-2 text-sm opacity-85">
              Score {hud.score} · Coins {hud.coins} · {formatTime(hud.elapsedMs)}
            </p>
            <button
              type="button"
              onClick={restart}
              className="mt-5 w-full rounded-md bg-[var(--telegram-button)] px-4 py-3 font-bold text-[var(--telegram-button-text)]"
            >
              Restart
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
