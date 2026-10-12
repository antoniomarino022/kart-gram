import { beforeEach, describe, expect, it } from "vitest";
import { createMockBackend } from "./mock";
import { REVIVE_PRICE, UPGRADE_COSTS } from "./catalog";

function memStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("mock backend", () => {
  let storage: ReturnType<typeof memStorage>;
  beforeEach(() => { storage = memStorage(); });
  const make = () => createMockBackend({ storage, startCoins: 5000 });

  it("creates a default profile with starting coins and default items", async () => {
    const p = await make().getProfile();
    expect(p.coins).toBe(5000);
    expect(p.owned).toEqual(expect.arrayContaining(["kart_classic", "paint_red", "wheel_basic", "trail_smoke"]));
    expect(p.equipped.kart).toBe("kart_classic");
    expect(p.bestScore).toBe(0);
  });

  it("persists across instances", async () => {
    await make().buyWithCoins("kart_bolt");
    expect((await make().getProfile()).owned).toContain("kart_bolt");
  });

  it("buys with coins, rejects when too poor or already owned", async () => {
    const b = make();
    const p = await b.buyWithCoins("kart_bolt");
    expect(p.coins).toBe(4000);
    await expect(b.buyWithCoins("kart_bolt")).rejects.toThrow();
    await b.buyWithCoins("kart_brick");
    await expect(b.buyWithCoins("paint_yellow")).resolves.toBeTruthy();
    await expect(b.buyWithCoins("kart_rocket")).rejects.toThrow(); // solo Stars
  });

  it("stars purchases are free and immediate in mock", async () => {
    const b = make();
    const { invoiceLink } = await b.createStarsInvoice("starter_pack");
    expect(invoiceLink.startsWith("mock://")).toBe(true);
    const p = await b.getProfile();
    expect(p.owned).toContain("kart_brick");
    expect(p.coins).toBe(7000);
    expect(p.revives).toBe(3);
  });

  it("equip requires ownership", async () => {
    const b = make();
    await expect(b.equip("kart", "kart_bolt")).rejects.toThrow();
    await b.buyWithCoins("kart_bolt");
    expect((await b.equip("kart", "kart_bolt")).equipped.kart).toBe("kart_bolt");
  });

  it("upgrades cost increasing coins up to level 5", async () => {
    const b = make();
    let p = await b.buyUpgrade("magnet");
    expect(p.upgrades.magnet).toBe(1);
    expect(p.coins).toBe(5000 - UPGRADE_COSTS[0]);
    p = await b.buyUpgrade("magnet");
    expect(p.coins).toBe(5000 - UPGRADE_COSTS[0] - UPGRADE_COSTS[1]);
  });

  it("run lifecycle: best score and coins", async () => {
    const b = make();
    const { runId, seed } = await b.startRun();
    expect(typeof seed).toBe("number");
    const r = await b.finishRun({ runId, score: 1234, distance: 900, coins: 12, durationMs: 60000, revived: false, inputs: [] });
    expect(r.newBest).toBe(true);
    expect(r.coinsEarned).toBe(12);
    expect(r.profile.bestScore).toBe(1234);
    expect(r.profile.coins).toBe(5012);
    const r2 = await b.finishRun({ runId: (await b.startRun()).runId, score: 10, distance: 5, coins: 0, durationMs: 1000, revived: false, inputs: [] });
    expect(r2.newBest).toBe(false);
  });

  it("revive: coins, owned, stars (free)", async () => {
    const b = make();
    const { runId } = await b.startRun();
    expect((await b.revive(runId, "coins")).ok).toBe(true);
    expect((await b.getProfile()).coins).toBe(5000 - REVIVE_PRICE.coins);
    expect((await b.revive(runId, "owned")).ok).toBe(false); // nessun revive posseduto
    expect((await b.revive(runId, "stars")).ok).toBe(true);
  });

  it("leaderboard includes the player", async () => {
    const b = make();
    const { runId } = await b.startRun();
    await b.finishRun({ runId, score: 999999, distance: 1, coins: 0, durationMs: 1, revived: false, inputs: [] });
    const lb = await b.getLeaderboard("global");
    expect(lb[0].score).toBe(999999);
    expect(lb.map((e) => e.rank)).toEqual(lb.map((_, i) => i + 1));
  });
});
