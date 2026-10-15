"use client";

import dynamic from "next/dynamic";

const KartGameContainer = dynamic(() => import("./KartGameContainer"), {
  ssr: false,
  loading: () => <div className="grid min-h-dvh place-items-center bg-black text-white">Loading kart...</div>,
});

export default function KartGame() {
  return <KartGameContainer />;
}
