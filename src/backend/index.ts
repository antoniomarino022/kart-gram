import { createMockBackend } from "./mock";
import { createRemoteBackend } from "./remote";
import type { Backend } from "./types";
import { getInitData } from "@/telegram/webapp";

let instance: Backend | null = null;

export function getBackend(): Backend {
  if (instance) return instance;
  instance = process.env.NEXT_PUBLIC_BACKEND === "remote"
    ? createRemoteBackend({ baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "", getInitData })
    : createMockBackend({ storage: window.localStorage, startCoins: Number(process.env.NEXT_PUBLIC_MOCK_COINS ?? 5000) });
  return instance;
}

export * from "./types";
