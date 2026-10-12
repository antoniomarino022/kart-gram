import { DEFAULT_CATALOG, DEFAULT_EQUIPPED, MAX_UPGRADE_LEVEL, REVIVE_PRICE, UPGRADE_COSTS } from "./catalog";
import { BackendError, type Backend, type CatalogItem, type Profile, type Slot } from "./types";

const KEY = "kartgram.mock.v1";
const SLOTS: string[] = ["kart", "paint", "wheels", "trail"];
const FAKE_NAMES = ["Luca", "Giulia", "Marco", "Sara", "Ale", "Fede", "Chiara", "Paolo", "Marta"];

interface State { profile: Profile; runs: Record<string, { seed: number }> }

const bad = (msg: string) => new BackendError(400, msg);

export function createMockBackend(opts: {
  storage: Pick<Storage, "getItem" | "setItem">;
  startCoins: number;
  now?: () => number;
}): Backend {
  const now = opts.now ?? Date.now;

  const fresh = (): State => ({
    profile: {
      userId: "local",
      name: "Tu",
      coins: opts.startCoins,
      bestScore: 0,
      owned: DEFAULT_CATALOG.filter((i) => i.priceCoins === 0).map((i) => i.id),
      equipped: { ...DEFAULT_EQUIPPED },
      upgrades: { turbo: 0, magnet: 0, slowmo: 0, x2: 0 },
      revives: 0,
    },
    runs: {},
  });

  function load(): State {
    const raw = opts.storage.getItem(KEY);
    if (raw) {
      try { return JSON.parse(raw) as State; } catch { /* dati corrotti: riparto da zero */ }
    }
    return fresh();
  }
  const save = (s: State) => opts.storage.setItem(KEY, JSON.stringify(s));

  /** Carica, applica la mutazione, salva e restituisce una copia del profilo. */
  function mutate(fn: (p: Profile, s: State) => void): Profile {
    const s = load();
    fn(s.profile, s);
    save(s);
    return structuredClone(s.profile);
  }

  const findItem = (id: string): CatalogItem => {
    const item = DEFAULT_CATALOG.find((i) => i.id === id);
    if (!item) throw bad("Oggetto sconosciuto");
    return item;
  };

  function grant(p: Profile, item: CatalogItem) {
    if (item.kind === "coin_pack") {
      p.coins += item.coins ?? 0;
    } else if (item.kind === "starter_pack") {
      p.coins += item.coins ?? 0;
      p.revives += item.revives ?? 0;
      p.owned.push(item.id); // segna lo starter pack come già comprato
      for (const g of item.grants ?? []) if (!p.owned.includes(g)) p.owned.push(g);
    } else {
      p.owned.push(item.id);
    }
  }

  return {
    async getProfile() {
      const s = load();
      save(s);
      return structuredClone(s.profile);
    },

    async getCatalog() {
      return structuredClone(DEFAULT_CATALOG);
    },

    async startRun() {
      const seed = Math.floor(Math.random() * 2 ** 31);
      const runId = "mock-" + seed + "-" + now();
      const s = load();
      s.runs[runId] = { seed };
      save(s);
      return { runId, seed };
    },

    async finishRun(r) {
      let newBest = false;
      const profile = mutate((p) => {
        p.coins += r.coins;
        newBest = r.score > p.bestScore;
        if (newBest) p.bestScore = r.score;
      });
      return { newBest, coinsEarned: r.coins, profile };
    },

    async revive(_runId, pay) {
      if (pay === "stars") return { ok: true };
      const s = load();
      const p = s.profile;
      if (pay === "coins") {
        if (p.coins < REVIVE_PRICE.coins) return { ok: false };
        p.coins -= REVIVE_PRICE.coins;
      } else {
        if (p.revives <= 0) return { ok: false };
        p.revives -= 1;
      }
      save(s);
      return { ok: true };
    },

    async equip(slot: Slot, itemId) {
      return mutate((p) => {
        const item = findItem(itemId);
        if (!SLOTS.includes(slot) || item.kind !== slot) throw bad("Oggetto non adatto a questo slot");
        if (!p.owned.includes(itemId)) throw bad("Oggetto non posseduto");
        p.equipped[slot] = itemId;
      });
    },

    async buyWithCoins(itemId) {
      return mutate((p) => {
        const item = findItem(itemId);
        if (item.priceCoins === undefined) throw bad("Oggetto non acquistabile con le monete");
        if (p.owned.includes(itemId)) throw bad("Oggetto già posseduto");
        if (p.coins < item.priceCoins) throw bad("Monete insufficienti");
        p.coins -= item.priceCoins;
        grant(p, item);
      });
    },

    async createStarsInvoice(itemId) {
      mutate((p) => {
        const item = findItem(itemId);
        if (item.priceStars === undefined) throw bad("Oggetto non acquistabile con le Stelle");
        if (item.kind !== "coin_pack" && p.owned.includes(itemId)) throw bad("Oggetto già posseduto");
        grant(p, item);
      });
      return { invoiceLink: "mock://paid/" + itemId };
    },

    async buyUpgrade(upgradeId) {
      return mutate((p) => {
        if (!(upgradeId in p.upgrades)) throw bad("Potenziamento sconosciuto");
        const level = p.upgrades[upgradeId];
        if (level >= MAX_UPGRADE_LEVEL) throw bad("Potenziamento già al livello massimo");
        const cost = UPGRADE_COSTS[level];
        if (p.coins < cost) throw bad("Monete insufficienti");
        p.coins -= cost;
        p.upgrades[upgradeId] = level + 1;
      });
    },

    async getLeaderboard() {
      const p = load().profile;
      const entries = FAKE_NAMES.map((name, i) => ({ userId: "fake-" + i, name, score: 15000 - i * 1500 }));
      entries.push({ userId: p.userId, name: p.name, score: p.bestScore });
      entries.sort((a, b) => b.score - a.score);
      return entries.map((e, i) => ({ rank: i + 1, ...e }));
    },
  };
}
