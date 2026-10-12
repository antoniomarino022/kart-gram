"use client";

import dynamic from "next/dynamic";

// three.js, localStorage e Telegram esistono solo nel browser: niente prerender
const GameApp = dynamic(() => import("./GameApp"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#5ab4e6] to-[#8fcff0] text-2xl font-black italic text-outline">
      Caricamento…
    </div>
  ),
});

export default function ClientGame() {
  return <GameApp />;
}
