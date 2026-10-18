import { describe, expect, it } from "vitest";
import type { Profile } from "@/types/game";
import { createProfileTracker } from "./profileSync";

const prof = (coins: number) => ({ coins }) as Profile;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("createProfileTracker", () => {
  it("ignores a response older than the one already applied", async () => {
    const applied: number[] = [];
    const track = createProfileTracker((p) => applied.push(p.coins));
    const older = deferred<Profile>(), newer = deferred<Profile>();
    const a = track(older.promise), b = track(newer.promise);
    newer.resolve(prof(2));
    await b;
    older.resolve(prof(1));
    expect(await a).toEqual(prof(1)); // il chiamante riceve comunque il suo valore
    expect(applied).toEqual([2]);
  });

  it("applies responses in order and skips null", async () => {
    const applied: number[] = [];
    const track = createProfileTracker((p) => applied.push(p.coins));
    await track(Promise.resolve(prof(1)));
    await track(Promise.resolve(null));
    await track(Promise.resolve(prof(3)));
    expect(applied).toEqual([1, 3]);
  });
});
