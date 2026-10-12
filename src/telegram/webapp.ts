type InvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name: string } };
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  requestFullscreen?(): void;
  isVersionAtLeast?(v: string): boolean;
  setHeaderColor?(c: string): void;
  HapticFeedback?: {
    impactOccurred(s: "light" | "medium" | "heavy"): void;
    notificationOccurred(t: "success" | "error" | "warning"): void;
  };
  openInvoice(url: string, cb: (status: InvoiceStatus) => void): void;
  onEvent?(e: string, cb: () => void): void;
  offEvent?(e: string, cb: () => void): void;
  isActive?: boolean;
}

const tg = (): TgWebApp | null => {
  if (typeof window === "undefined") return null;
  const w = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  return w && w.initData ? w : null;
};

export const isTelegram = () => tg() !== null;

export function initTelegram() {
  const w = tg();
  if (!w) return;
  w.ready();
  w.expand();
  w.disableVerticalSwipes?.();
  if (w.isVersionAtLeast?.("8.0")) w.requestFullscreen?.();
}

export const getInitData = () => tg()?.initData ?? "";
export const getTelegramUser = () => tg()?.initDataUnsafe.user ?? null;

export function haptic(kind: "light" | "medium" | "heavy" | "success" | "error") {
  const h = tg()?.HapticFeedback;
  if (!h) return;
  if (kind === "success" || kind === "error") h.notificationOccurred(kind);
  else h.impactOccurred(kind);
}

export function openInvoice(link: string): Promise<InvoiceStatus> {
  const w = tg();
  if (!w) return Promise.resolve("failed");
  return new Promise((resolve) => w.openInvoice(link, resolve));
}

export function onVisibilityChange(cb: (visible: boolean) => void) {
  const handler = () => cb(document.visibilityState === "visible");
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}
