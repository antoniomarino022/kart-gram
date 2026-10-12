import { describe, expect, it, vi } from "vitest";
import { createRemoteBackend } from "./remote";
import { BackendError } from "./types";

const make = (fetchFn: typeof fetch) =>
  createRemoteBackend({ baseUrl: "https://api.test/", getInitData: () => "INIT", fetchFn });

describe("remote backend", () => {
  it("sends method, URL, auth header and JSON body", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const r = await make(fetchFn as unknown as typeof fetch).revive("a b", "coins");
    expect(r).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/runs/a%20b/revive");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("tma INIT");
    expect(init.body).toBe(JSON.stringify({ pay: "coins" }));
  });

  it("GET has no body and builds the query string", async () => {
    const fetchFn = vi.fn(async () => new Response("[]", { status: 200 }));
    await make(fetchFn as unknown as typeof fetch).getLeaderboard("weekly");
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/leaderboard?scope=weekly");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("throws BackendError with status on non-2xx", async () => {
    const fetchFn = vi.fn(async () => new Response("no coins", { status: 402 }));
    const err = await make(fetchFn as unknown as typeof fetch).getProfile().catch((e) => e);
    expect(err).toBeInstanceOf(BackendError);
    expect(err.status).toBe(402);
    expect(err.message).toBe("no coins");
  });
});
