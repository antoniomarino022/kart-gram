export function PauseOverlay({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  return (
    <div className="scrim pointer-events-auto absolute inset-0 z-20 flex items-center justify-center px-6">
      <div className="animate-pop flex w-full max-w-[290px] flex-col gap-2 text-center">
        <h2 className="logo mb-3 text-7xl">Pausa</h2>
        <button type="button" onClick={onResume} className="btn btn-primary h-14 text-3xl font-black">
          Continua
        </button>
        <button type="button" onClick={onExit} className="btn btn-secondary h-[52px] text-2xl">
          Esci
        </button>
        <p className="box mt-2 px-3 py-1.5 text-sm">Uscendo la partita non viene salvata</p>
      </div>
    </div>
  );
}
