const HEART = "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.6 1.2 5.4 3.2 1.8-2 3.2-3.2 5.4-3.2 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z";

/**
 * Vite rimaste: cuori pieni nel colore primario del bioma, vuoti come sagome scure traslucide.
 * La key cambia quando un cuore cambia stato, così riparte l'animazione "pop" (solo CSS).
 */
export function Hearts({ lives, max = 3 }: { lives: number; max?: number }) {
  return (
    <div className="flex gap-1" role="img" aria-label={`Vite: ${lives} su ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const full = i < lives;
        return (
          <svg key={`${i}-${full}`} width="26" height="26" viewBox="0 0 24 24" aria-hidden className="animate-heart">
            <path
              d={HEART}
              fill={full ? "var(--ui-primary)" : "var(--ui-surface)"}
              stroke={full ? "none" : "rgba(255,255,255,0.45)"}
              strokeWidth="1.6"
            />
          </svg>
        );
      })}
    </div>
  );
}
