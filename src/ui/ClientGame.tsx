"use client";

import dynamic from "next/dynamic";

// three.js, localStorage e Telegram esistono solo nel browser: niente prerender
const GameApp = dynamic(() => import("./GameApp"), {
  ssr: false,
  loading: () => (
    <div className="ui-root flex h-full w-full items-center justify-center bg-[#3f93e0] text-2xl font-extrabold">
      Caricamento…
    </div>
  ),
});

export default function ClientGame() {
  return <GameApp />;
}
