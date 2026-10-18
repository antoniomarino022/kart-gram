import { BackendError, type Backend } from "./types";

export function createRemoteBackend(opts: { baseUrl: string; getInitData: () => string; fetchFn?: typeof fetch }): Backend {
  const f: typeof fetch = opts.fetchFn ?? ((input, init) => fetch(input, init));
  async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await f(opts.baseUrl.replace(/\/$/, "") + path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `tma ${opts.getInitData()}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      // le API rispondono {"message": "..."}: al giocatore si mostra solo il messaggio
      const text = await res.text().catch(() => "");
      let message = text;
      try { message = (JSON.parse(text) as { message?: string }).message ?? text; } catch { /* testo semplice */ }
      throw new BackendError(res.status, message || res.statusText);
    }
    return res.json() as Promise<T>;
  }
  return {
    getProfile: () => call("GET", "/profile"),
    getCatalog: () => call("GET", "/catalog"),
    startRun: () => call("POST", "/runs"),
    finishRun: (r) => call("POST", `/runs/${encodeURIComponent(r.runId)}/finish`, r),
    revive: (runId, pay) => call("POST", `/runs/${encodeURIComponent(runId)}/revive`, { pay }),
    equip: (slot, itemId) => call("POST", "/equip", { slot, itemId }),
    buyWithCoins: (itemId) => call("POST", "/shop/coins", { itemId }),
    createStarsInvoice: (itemId) => call("POST", "/shop/stars-invoice", { itemId }),
    buyUpgrade: (upgradeId) => call("POST", "/upgrades", { upgradeId }),
    getLeaderboard: (scope) => call("GET", `/leaderboard?scope=${scope}`),
  };
}
