"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getBackend, type CatalogItem, type Profile, type RevivePay } from "@/backend";
import { payRevive } from "@/backend/purchase";
import { Game } from "@/game/Game";
import { CONFIG } from "@/game/core/config";
import { finalScore, NO_UPGRADES, type GameEvent, type UpgradeLevels } from "@/game/core/sim";
import { ALL_MODEL_NAMES, type Loadout } from "@/game/render/GameRenderer";
import { loadModels, type ModelLibrary } from "@/game/render/models";
import { getTelegramUser, initTelegram } from "@/telegram/webapp";
import { errorText } from "./errors";
import { GameOver, type RunSummary } from "./GameOver";
import { Garage } from "./Garage";
import { Hud } from "./Hud";
import { Spinner } from "./kit";
import { Leaderboard } from "./Leaderboard";
import { createPopupBus, ScorePopups } from "./ScorePopups";
import { buildLoadout, loadoutKey } from "./loadout";
import { Menu } from "./Menu";
import { Shop } from "./Shop";
import { createProfileTracker } from "./profileSync";
import { hapticsEnabled, uiHaptic } from "./settings";
import { Toast, useToast } from "./Toast";
import { uiPalette, uiVars } from "./uiPalette";

type ScreenId = "menu" | "playing" | "gameover" | "garage" | "shop" | "leaderboard";

/** Seed fisso della scena di sfondo nei menu. */
const DEMO_SEED = 20261012;

interface Run {
  runId: string;
  /** startRun fallito: si gioca con un seed locale e la partita non viene inviata */
  unsaved: boolean;
  /** haptic "nuovo record" già dato in questa partita */
  recordFired: boolean;
}

interface Ready {
  profile: Profile;
  catalog: CatalogItem[];
  /** false se il catalogo non è arrivato: garage e shop disabilitati, loadout di default */
  catalogOk: boolean;
  models: ModelLibrary;
}

export default function GameApp() {
  const [backend] = useState(getBackend);
  const [boot, setBoot] = useState<"loading" | "error" | "ready">("loading");
  const [data, setData] = useState<Ready | null>(null);
  const [screen, setScreen] = useState<ScreenId>("menu");
  const [game, setGame] = useState<Game | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const { toast, show, hide } = useToast();
  const [popups] = useState(createPopupBus);
  /** Bioma della partita in corso (colori della UI); i menu usano sempre il bioma 0. */
  const [runBiome, setRunBiome] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Game montato sul canvas (partita o scena di sfondo) e chiave del suo loadout. */
  const mounted = useRef<{ game: Game; key: string } | null>(null);
  const runRef = useRef<Run | null>(null);
  /** Record più recente: quello del profilo o lo score appena inviato (finishRun può non aver ancora risposto). */
  const bestRef = useRef(0);

  const profile = data?.profile;
  useEffect(() => { bestRef.current = Math.max(bestRef.current, profile?.bestScore ?? 0); }, [profile]);
  // tutte le risposte che contengono un profilo passano da qui: una risposta vecchia non sovrascrive una più nuova
  const [track] = useState(() => createProfileTracker((p: Profile) => setData((d) => (d ? { ...d, profile: p } : d))));

  const load = useCallback(() => {
    initTelegram();
    hapticsEnabled(); // carica la preferenza vibrazione nel gate prima della prima partita
    // il catalogo è facoltativo (spec: senza catalogo lo shop è disabilitato), il profilo no
    const catalog = backend.getCatalog().then(
      (c) => ({ catalog: c, catalogOk: true }),
      (err) => { console.warn("[app] catalogo non disponibile", err); return { catalog: [] as CatalogItem[], catalogOk: false }; },
    );
    Promise.all([track(backend.getProfile()), catalog, loadModels(ALL_MODEL_NAMES)]).then(
      ([profile, c, models]) => { setData({ profile, ...c, models }); setBoot("ready"); },
      (err) => { console.error("[app] caricamento fallito", err); setBoot("error"); },
    );
  }, [backend, track]);

  useEffect(load, [load]);

  // un solo canvas per tutta la vita dell'app: alla chiusura si distrugge l'ultimo Game
  useEffect(() => () => { mounted.current?.game.destroy(); mounted.current = null; }, []);

  /** Distrugge il Game corrente e ne crea uno nuovo sullo stesso canvas. */
  const mountGame = useCallback((opts: { loadout: Loadout; seed: number; upgrades: UpgradeLevels; wheels?: string; onEvent: (e: GameEvent) => void; demo: boolean }) => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return null;
    mounted.current?.game.destroy();
    const g = new Game({ canvas, models: data.models, loadout: opts.loadout, wheels: opts.wheels ?? data.profile.equipped.wheels, seed: opts.seed, upgrades: opts.upgrades, onEvent: opts.onEvent });
    mounted.current = { game: g, key: loadoutKey(opts.loadout) };
    g.start();
    if (opts.demo) g.pause(); // disegna un frame e poi resta ferma
    return g;
  }, [data]);

  // Nei menu lo sfondo è l'ultima partita (ferma) o una scena demo; se il loadout cambia (garage) la scena si rifà.
  const equipped = data?.profile.equipped;
  const catalog = data?.catalog;
  const loadout = useMemo(() => (equipped && catalog ? buildLoadout(equipped, catalog) : null), [equipped, catalog]);
  useEffect(() => {
    if (!loadout || screen === "playing" || screen === "gameover") return;
    const cur = mounted.current;
    if (cur && cur.key === loadoutKey(loadout)) { if (!cur.game.paused) cur.game.pause(); return; }
    mountGame({ loadout, seed: DEMO_SEED, upgrades: NO_UPGRADES, onEvent: () => {}, demo: true });
  }, [loadout, screen, mountGame]);

  const onGameOver = useCallback((g: Game) => {
    const st = g.state;
    const score = finalScore(st);
    const run = runRef.current;
    const newRecord = score > bestRef.current;
    // haptic una sola volta per partita, quando lo score supera il record
    if (run && newRecord && !run.recordFired) { run.recordFired = true; uiHaptic("success"); }
    setSummary({ score, coins: st.coins, distance: Math.floor(st.kart.s), revived: st.revived, newRecord, reason: st.endReason ?? "fall" });
    setScreen("gameover");
  }, []);

  const play = useCallback(async () => {
    if (!data || starting) return;
    setStarting(true);
    let runId: string, seed: number, unsaved = false;
    // il server rigioca la partita con upgrade e ruote fissati all'avvio: il client usa gli stessi
    let upgrades = data.profile.upgrades, wheels: string | undefined;
    try {
      const run = await backend.startRun();
      ({ runId, seed } = run);
      if (run.upgrades) upgrades = run.upgrades;
      wheels = run.wheels;
    } catch (err) {
      console.warn("[app] startRun fallito, partita locale", err);
      seed = Math.floor(Math.random() * 2 ** 31);
      runId = "local-" + Date.now();
      unsaved = true;
    }
    runRef.current = { runId, unsaved, recordFired: false };
    let g: Game | null = null;
    g = mountGame({
      loadout: buildLoadout(data.profile.equipped, data.catalog),
      seed,
      upgrades,
      wheels,
      onEvent: (e) => {
        if (e.type === "gameover" && g) onGameOver(g);
        else if (e.type === "driftEnd" && e.points >= 1) popups.push("drift", e.points);
        else if (e.type === "boost") popups.push("boost");
        else if (e.type === "nearMiss" && g) {
          // stesso calcolo della sim: base × combo, raddoppiato con x2
          const st = g.state;
          popups.push("nearMiss", CONFIG.score.nearMiss * st.combo * (st.powerups.x2 > 0 ? 2 : 1));
        }
      },
      demo: false,
    });
    setStarting(false);
    if (!g) return;
    setGame(g);
    setUnsaved(unsaved);
    setSummary(null);
    setRunBiome(0);
    setScreen("playing");
  }, [backend, data, starting, mountGame, onGameOver, popups]);

  /** Invia la partita finita (se salvabile) e aggiorna il profilo; non blocca la UI. */
  const finishRun = useCallback(() => {
    const run = runRef.current;
    runRef.current = null;
    if (!game || !run || run.unsaved) return;
    const st = game.state;
    bestRef.current = Math.max(bestRef.current, finalScore(st));
    track(backend.finishRun({
      runId: run.runId, score: finalScore(st), distance: Math.floor(st.kart.s), coins: st.coins,
      durationMs: game.durationMs, revived: st.revived, ticks: st.tick, inputs: game.inputs,
    }).then((r) => r.profile)).catch((err) => { console.warn("[app] finishRun fallito", err); show("Partita non salvata"); });
  }, [backend, game, track, show]);

  const revive = useCallback(async (pay: RevivePay) => {
    const run = runRef.current;
    if (!game || !run || busy) return;
    setBusy(true);
    const refresh = () => { track(backend.getProfile()).catch(() => {}); }; // monete o revive scalati
    try {
      if (!(await payRevive(backend, run.runId, pay))) {
        show("Pagamento non completato");
      } else if (game.revive()) {
        setScreen("playing");
        refresh();
      } else {
        // pagato ma la partita non si può riprendere (es. già rianimata): lo segnaliamo a parte
        show("Revive non riuscito: contatta il supporto se ti è stato addebitato");
        refresh();
      }
    } catch (err) {
      show(errorText(err));
      refresh();
    } finally {
      setBusy(false);
    }
  }, [backend, busy, game, track, show]);

  const toMenu = useCallback(() => { finishRun(); setGame(null); setScreen("menu"); }, [finishRun]);
  const retry = useCallback(() => { finishRun(); void play(); }, [finishRun, play]);
  /** Esci dalla pausa: la partita viene abbandonata senza salvarla. */
  const quit = useCallback(() => { runRef.current = null; setGame(null); setScreen("menu"); }, []);

  const tgName = getTelegramUser()?.first_name;

  // colori della UI dal bioma: cambiano solo quando cambia l'indice (la transizione è nel CSS)
  const uiBiome = screen === "playing" || screen === "gameover" ? runBiome : 0;
  const rootStyle = useMemo(() => uiVars(uiPalette(uiBiome)) as CSSProperties, [uiBiome]);

  return (
    <div className="ui-root absolute inset-0 overflow-hidden bg-[#3f93e0]" style={rootStyle}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" />

      {boot === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <h1 className="logo text-center text-8xl">
            <span className="block">KART</span>
            <span className="block">GRAM</span>
          </h1>
          <Spinner />
        </div>
      )}
      {boot === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="box px-4 py-3">
            <p className="text-3xl font-black">Impossibile caricare il gioco</p>
            <p className="mt-1 text-lg">Controlla la connessione e riprova</p>
          </div>
          <button type="button" className="btn btn-primary h-14 w-full max-w-[290px] text-3xl font-black" onClick={() => { setBoot("loading"); load(); }}>
            Riprova
          </button>
        </div>
      )}

      {boot === "ready" && data && profile && (
        <>
          {screen === "menu" && (
            <Menu profile={profile} name={tgName} starting={starting} shopAvailable={data.catalogOk} onPlay={play} onOpen={setScreen} />
          )}
          {screen === "playing" && game && <ScorePopups bus={popups} />}
          {screen === "playing" && game && (
            <Hud game={game} bestScore={profile.bestScore} upgrades={profile.upgrades} onExit={quit} onBiome={setRunBiome} />
          )}
          {screen === "gameover" && summary && (
            <GameOver
              run={summary}
              profile={profile}
              unsaved={unsaved}
              busy={busy || starting}
              onRevive={revive}
              onRetry={retry}
              onMenu={toMenu}
            />
          )}
          {screen === "garage" && (
            <Garage backend={backend} profile={profile} catalog={data.catalog} track={track} toast={show} onBack={() => setScreen("menu")} />
          )}
          {screen === "shop" && (
            <Shop backend={backend} profile={profile} catalog={data.catalog} track={track} toast={show} onBack={() => setScreen("menu")} />
          )}
          {screen === "leaderboard" && (
            <Leaderboard backend={backend} profile={profile} toast={show} onBack={() => setScreen("menu")} />
          )}
        </>
      )}

      <Toast toast={toast} onDone={hide} />
    </div>
  );
}
