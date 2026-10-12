export function PauseOverlay({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#1b1035]/55 px-6 backdrop-blur-sm">
      <div className="panel animate-pop flex w-full max-w-xs flex-col gap-4 p-6 text-center">
        <h2 className="text-4xl font-black italic text-outline">PAUSA</h2>
        <button type="button" onClick={onResume} className="btn btn-green h-14 text-2xl">
          ▶ Continua
        </button>
        <button type="button" onClick={onExit} className="btn btn-gray text-lg">
          Esci
        </button>
        <p className="text-sm text-white/75">Uscendo la partita non viene salvata.</p>
      </div>
    </div>
  );
}
