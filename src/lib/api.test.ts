import { describe, expect, it, vi } from "vitest";
import { requestApi } from "@/lib/api";
import { ApiError } from "@/types/game";

describe("client API", () => {
  it("sends method, URL, auth header and JSON body", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await requestApi(
      "POST",
      `/runs/${encodeURIComponent("a b")}/revive`,
      { pay: "coins" },
      fetchFn as unknown as typeof fetch,
    );
    expect(res).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/game/runs/a%20b/revive");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^tma /);
    expect(init.body).toBe(JSON.stringify({ pay: "coins" }));
  });

  it("GET has no body and builds the query string", async () => {
    const fetchFn = vi.fn(async () => new Response("[]", { status: 200 }));
    await requestApi("GET", "/leaderboard?scope=weekly", undefined, fetchFn as unknown as typeof fetch);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/game/leaderboard?scope=weekly");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("throws ApiError with status on non-2xx", async () => {
    const fetchFn = vi.fn(async () => new Response("no coins", { status: 402 }));
    const err = (await requestApi("GET", "/profile", undefined, fetchFn as unknown as typeof fetch).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(402);
    expect(err.message).toBe("no coins");
  });
});
