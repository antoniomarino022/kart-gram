# kart-gram — Design del gioco

Data: 2026-10-12
Ambito: **solo il gioco (client)**. Backend, pagamenti lato server e classifiche li sviluppa un collega, seguendo il contratto descritto nella sezione 5.

## 1. Concept

Gioco endless di **drift one-tap** in 3D per **Telegram Mini App**, giocato in **verticale**.
Il kart corre su una strada sospesa nel vuoto, con blocchi e oggetti low-poly "strani" che fluttuano intorno.
Lo stile visivo di riferimento è una camera alle spalle del kart, colori piatti e mondi sospesi nel vuoto.
La partita finisce quando il kart cade nel vuoto. Lo scopo è fare lo score più alto possibile.
Una partita dura in genere 45–90 secondi e il restart è istantaneo.

## 2. Gameplay

### Controllo
- Il kart avanza sempre da solo. La direzione la sceglie il giocatore, la strada non sterza mai il kart.
- **Metà sinistra dello schermo premuta:** il kart derapa e curva a sinistra.
- **Metà destra dello schermo premuta:** il kart derapa e curva a destra.
- **Rilasciato:** il kart va dritto, con la direzione che ha in quel momento.
- Con più dita conta l'ultima premuta; se la rilasci torna a valere quella ancora premuta.
- Su PC: click del mouse sulle due metà dello schermo, oppure ←/→ o A/D.
- La sterzata è morbida: la velocità di rotazione sale in ~0,1 s e si spegne in ~0,15 s al rilascio. Il muso gira prima della direzione di moto, quindi in curva il kart derapa di lato; l'aderenza è per metro percorso, così la derapata ha la stessa forma a ogni velocità. Su ghiaccio e olio l'aderenza è minore e il kart scivola di più.

### Strada
- È un nastro 3D generato all'infinito, a segmenti: rettilinei, curve a sinistra e a destra di angolo variabile, salite e discese, tratti stretti.
- Il generatore è **deterministico**: stesso seed, stessa strada (RNG `mulberry32`).
- Ogni ~1500 m si cambia **bioma**. Cambiano palette e oggetti fluttuanti decorativi, non la fisica.
  - Sky City
  - Desert Void
  - Ice
  - Neon Night

### Velocità e difficoltà
- La velocità base è 22 m/s e aumenta di 3 m/s a ogni bioma, fino a 40 m/s.
- La **combo** rende più veloci: +12% per ogni livello sopra x1 (x5 = +48%). Turbo e pedane boost si moltiplicano sopra. Un urto azzera la combo, quindi il kart rallenta.
- La velocità cambia in modo graduale: sale di 8 m/s² e scende di 24 m/s².
- Le curve hanno raggio tra 16 e 24 m. Superato il tetto la velocità del bioma resta ferma, ma le curve si fanno più strette (fino a 13 m) e gli ostacoli più fitti.

### Vite e fine partita
- Si parte con **3 vite**. Ogni urto con un ostacolo (cono, barriera, kart rivale) toglie una vita, rallenta e azzera la combo.
- A 0 vite il kart si **schianta**: frena fino a fermarsi in 0,6 s e la partita finisce.
- **Cadere dalla strada** (fuori dal bordo o in un buco) è sempre game over, con qualunque numero di vite.
- Il power-up **cuore** ridà una vita (massimo 3).

### Ostacoli
| Ostacolo | Effetto |
|---|---|
| Coni | Tolgono una vita, rallentano e azzerano la combo |
| Olio | Allunga il drift in corso |
| Ghiaccio | Meno aderenza: si gira più piano, si derapa di più e, rilasciando, il kart continua a girare ancora un po' |
| Barriere | Restringono la strada |
| Buchi | Se ci passi sopra cadi |
| Kart rivali lenti | Ostacolo mobile da sorpassare. Se lo urti perdi una vita, rallenti e azzeri la combo |

### Pedane boost
- Pedane boost: sezioni di strada colorate con frecce animate; passandoci sopra il kart accelera per 1,5 s.
- Di solito coprono metà strada (sinistra o destra), a volte tutta la larghezza. Bisogna sterzare dalla parte giusta per prenderle.
- Il colore è una tinta chiara della palette del bioma.

### Power-up
I power-up si raccolgono passandoci sopra e si attivano da soli.

| Power-up | Effetto | Durata base |
|---|---|---|
| Turbo | Più veloce e invincibile agli ostacoli | 3 s |
| Scudo | Assorbe un urto con un ostacolo: niente vita persa, niente rallentamento, la combo resta. Non salva dalle cadute | Fino al primo uso |
| Magnete | Attira le monete | 6 s |
| Strada larga | Allarga temporaneamente la strada | 5 s |
| Slow-mo | Rallenta il tempo | 3 s |
| x2 Score | Raddoppia lo score | 6 s |
| Cuore | +1 vita (massimo 3). Più raro degli altri power-up | Subito |

### Score
- Si guadagnano punti in quattro modi:
  - **distanza** percorsa;
  - **drift**: un bonus che cresce con la durata del drift e con l'angolo di derapata;
  - **linea perfetta**: un bonus per passare vicino al bordo interno della curva;
  - **near-miss**: un bonus per sfiorare un ostacolo senza toccarlo.
- Tutti i punti vengono moltiplicati dalla **combo**, che va da x1 a x5. La combo sale con drift, linee perfette e near-miss, e si azzera quando si colpisce un ostacolo.
- Le **monete** si raccolgono sulla strada e servono per cosmetici e potenziamenti.

### Revive
- Massimo **1 per partita**. Si paga con 500 monete oppure 5 ⭐. Il revive riporta il kart al centro della strada con 3 vite.
- La partita con revive viene inviata con `revived: true`. Il backend decide se tenerla fuori dalle classifiche.

### HUD e feedback
- In alto a sinistra: best, score e cuori delle vite. In alto a destra: combo, pausa e monete. Gli indicatori dei power-up attivi (e del boost) sono sotto.
- I colori della UI seguono il bioma (giallo, arancio, ciano, rosa); menu, garage e shop usano quelli di Sky City.
- Alla prima partita le due metà dello schermo mostrano per ~3 s "◀ SINISTRA" / "DESTRA ▶".
- Il game over dice il motivo: "Sei caduto" o "Kart distrutto" (vite finite).
- Effetti grafici su urti (detriti e lampo), raccolte, near-miss, boost e alta velocità (linee di velocità), con un piccolo colpo di camera.
- Vibrazione tramite l'HapticFeedback di Telegram, disattivabile dal menu:
  - inizio di un drift, power-up, scudo usato e boost (leggera);
  - collisione (media); caduta e schianto (forte);
  - game over (errore) e nuovo record (successo).

### Fuori dalla prima versione
Missioni, season pass, Daily Run e sfide tra amici. Il seed le rende possibili più avanti.

## 3. Architettura tecnica

- **Stack:** Next.js 16 (App Router, una sola pagina), React 19, Tailwind 4, **three.js vanilla**, TypeScript.
- **`src/game/core`:** TypeScript puro, che non importa né three.js né React né il DOM.
  - Simulazione a **timestep fisso** di 1/60 s.
  - La funzione `step(state, input)` è deterministica.
  - La stessa coppia di seed e input produce sempre lo stesso score. È questo che permette al backend di rigiocare la partita per l'anti-cheat.
- **`src/game/render`:**
  - Legge lo stato e lo disegna con three.js.
  - Camera alle spalle del kart.
  - Biomi e oggetti decorativi fluttuanti.
  - Il pixel ratio è limitato a 2.
- **`src/game/input`:** traduce touch, mouse e tastiera in una sterzata `steer`: `+1` sinistra, `-1` destra, `0` dritto. Registra la lista `[tick, steer]` delle volte in cui l'input cambia.
- **Loop:** gira con `requestAnimationFrame` usando un accumulatore, fuori da React.
  - Il delta tra un frame e l'altro è troncato a 250 ms, così il ritorno dal background non fa saltare la simulazione.
  - Quando l'app va in background la partita va in pausa.
- **`src/ui`:** React gestisce solo le schermate: menu, HUD, garage, shop, pausa e game over. Il motore comunica con la UI tramite eventi (`score`, `coin`, `powerup`, `gameover`). La UI non fa mai `setState` 60 volte al secondo.
- **`src/telegram`:** wrapper di `window.Telegram.WebApp`. All'avvio chiama:
  - `ready()`
  - `expand()`
  - `disableVerticalSwipes()`
  - `requestFullscreen()`, solo se disponibile
  - più `HapticFeedback` e `openInvoice`.

  Fuori da Telegram, cioè da PC, ogni funzione diventa un'operazione vuota che non fa nulla.

## 4. Asset

- **Modelli** in `public/models/*.glb` (glTF 2.0).
  - Sono generati come segnaposto da `scripts/generate-models`, usando box e cilindri.
  - Hanno nomi fissi: `kart_classic.glb`, `kart_bolt.glb`, `kart_brick.glb`, `kart_rocket.glb`, `wheel_*.glb`, `obstacle_cone.glb`, `obstacle_barrier.glb`, `rival_kart.glb`, `coin.glb`, `powerup_<nome>.glb`, `deco_<bioma>_<n>.glb`.
  - Convenzioni: 1 unità = 1 m, Y in alto, il kart guarda verso -Z, origine alla base.
  - Se un modello manca o non si carica, si usa una forma di fallback così il gioco non si rompe.
- **Grafiche UI** in `public/ui/`: SVG per icone, WebP per illustrazioni.
- **Texture** in `public/textures/`.
- **Font** in `public/fonts/`.
- Ogni grafica è referenziata con un nome fisso: per sostituirla basta cambiare il file. Il README tiene l'elenco aggiornato.

## 5. Contratto col backend

Il gioco parla col backend **solo** tramite `src/backend`. Il backend da usare si sceglie con `NEXT_PUBLIC_BACKEND`:
- `mock`: implementazione in `localStorage`. Le monete iniziali sono date da `NEXT_PUBLIC_MOCK_COINS`. Gli **acquisti in Stelle sono gratuiti**: l'oggetto viene sbloccato subito, senza pagamento.
- `remote`: chiamate HTTP a `NEXT_PUBLIC_API_URL`. Ogni richiesta porta `initData` di Telegram nell'header `Authorization: tma <initData>`.

```ts
type Slot = "kart" | "paint" | "wheels" | "trail";
type UpgradeId = "turbo" | "magnet" | "slowmo" | "x2";

interface Profile {
  userId: string;
  name: string;
  coins: number;
  bestScore: number;
  owned: string[];                          // id degli oggetti posseduti
  equipped: Record<Slot, string>;
  upgrades: Record<UpgradeId, number>;      // da 0 a 5
  revives: number;                          // revive già comprati e non ancora usati (es. dallo starter pack)
}

interface CatalogItem {
  id: string;
  kind: Slot | "coin_pack" | "starter_pack";
  name: string;
  priceCoins?: number;
  priceStars?: number;
  model?: string;                          // es. "kart_bolt.glb"
  color?: string;                          // per le vernici
  finish?: "flat" | "metal" | "neon";      // per le vernici
  coins?: number;                          // monete date da coin_pack / starter_pack
  revives?: number;                        // revive dati dallo starter_pack
  grants?: string[];                       // oggetti dati dallo starter_pack
}

interface RunResult {
  runId: string;
  score: number;
  distance: number;
  coins: number;
  durationMs: number;
  revived: boolean;
  inputs: [tick: number, steer: -1 | 0 | 1][];  // +1 sinistra, -1 destra, 0 dritto
}

interface LeaderboardEntry { rank: number; userId: string; name: string; score: number; }

interface Backend {
  getProfile(): Promise<Profile>;
  getCatalog(): Promise<CatalogItem[]>;
  startRun(): Promise<{ runId: string; seed: number }>;
  finishRun(r: RunResult): Promise<{ newBest: boolean; coinsEarned: number; profile: Profile }>;
  revive(runId: string, pay: "coins" | "stars" | "owned"): Promise<{ ok: boolean; invoiceLink?: string }>;
  equip(slot: Slot, itemId: string): Promise<Profile>;
  buyWithCoins(itemId: string): Promise<Profile>;
  createStarsInvoice(itemId: string): Promise<{ invoiceLink: string }>;
  buyUpgrade(upgradeId: UpgradeId): Promise<Profile>;
  getLeaderboard(scope: "global" | "weekly"): Promise<LeaderboardEntry[]>;
}
```

### Replay anti-cheat
Il backend può rigiocare la partita con `simulate(seed, inputs, { upgrades, revived })` di `src/game/core/sim.ts`.
`inputs` contiene solo i cambi di sterzata: prima di ogni tick si applicano tutti gli input con `tick <= tick corrente`, e la sterzata resta quella fino al cambio successivo.
Il risultato deve dare lo stesso `score`.
`Math.sin`, `Math.cos`, `Math.atan2` e `Math.hypot` non sono identiche al bit tra motori JS diversi. Il backend deve rigiocare la partita su Node (V8, lo stesso motore di Chrome e Android WebView) e accettare una piccola tolleranza (per esempio |differenza| ≤ 1% dello score) invece di pretendere l'uguaglianza esatta, perché iOS (JavaScriptCore) può differire di minime quantità in virgola mobile.
Se la partita ha `revived: true`, il revive viene applicato in automatico la prima volta che la partita finisce: in quel momento il tick non avanza, quindi la simulazione resta deterministica.

### Endpoint HTTP usati da `remote`
Tutte le chiamate inviano l'header `Authorization: tma <initData>` e usano JSON.

| Metodo | Endpoint | Body | Risposta |
|---|---|---|---|
| GET | `/profile` | — | `Profile` |
| GET | `/catalog` | — | `CatalogItem[]` |
| POST | `/runs` | — | `{ runId, seed }` |
| POST | `/runs/{runId}/finish` | `RunResult` | `{ newBest, coinsEarned, profile }` |
| POST | `/runs/{runId}/revive` | `{ pay }` | `{ ok, invoiceLink? }` |
| POST | `/equip` | `{ slot, itemId }` | `Profile` |
| POST | `/shop/coins` | `{ itemId }` | `Profile` |
| POST | `/shop/stars-invoice` | `{ itemId }` | `{ invoiceLink }` |
| POST | `/upgrades` | `{ upgradeId }` | `Profile` |
| GET | `/leaderboard?scope=global\|weekly` | — | `LeaderboardEntry[]` |

### Flusso di acquisto in Stelle
1. Il client chiama `createStarsInvoice(itemId)`.
2. Apre il link con `Telegram.WebApp.openInvoice(link)`.
3. Se lo stato restituito è `paid`, il client chiama `getProfile()`.

L'assegnazione dell'oggetto la fa **solo il backend**, dopo `successful_payment`.
Nel mock i passaggi 2 e 3 vengono saltati e l'oggetto viene sbloccato subito.

### Errori e mancanza di connessione
Se `startRun` fallisce si gioca lo stesso: il client usa un seed locale e a fine partita mostra lo score con l'avviso "non salvato".
Se un'altra chiamata fallisce, compare un toast di errore. Se il catalogo non è disponibile lo shop è disabilitato.

## 6. Personalizzazione e catalogo (prezzi indicativi)

I prezzi definitivi li decide il catalogo del backend.

| Slot | Oggetti | Prezzo |
|---|---|---|
| Kart | Classic (default), Bolt, Brick, Rocket | Monete da 1.000 a 5.000. I rari costano 25 ⭐, i leggendari 75 o 150 ⭐ |
| Vernice | 8 colori, più metal e neon | 300 monete. I neon costano 15 ⭐ |
| Ruote | 4 modelli | 500 monete |
| Scia del drift | Fumo (default), Fiamme, Arcobaleno, Stelle | 800 monete. Le speciali costano 20–30 ⭐ |

**Potenziamenti.** Si comprano solo con monete e hanno 5 livelli. Il costo dei livelli è 200 → 500 → 1.000 → 2.000 → 4.000.
- Turbo: +0,5 s per livello.
- Magnete: +1 s per livello.
- Slow-mo: +0,5 s per livello.
- x2 Score: +1 s per livello.

Non esistono upgrade su velocità o aderenza: la guida è uguale per tutti.

**Altri oggetti in Stelle.**
- Starter pack da 49 ⭐, acquistabile una sola volta: un kart raro, 2.000 monete e 3 revive.
- Pacchetti di monete da 50, 250 e 500 ⭐.
- Revive da 5 ⭐.

## 7. Test

- **Vitest** su `src/game/core` e sul backend mock.
- Test chiave:
  - **golden replay**: lo stesso seed con gli stessi input produce lo stesso score;
  - la strada è sempre continua e percorribile;
  - la velocità non diminuisce mai;
  - funzionano collisioni, power-up e combo;
  - il mock gestisce profilo e acquisti.
- Rendering e UI si verificano a mano: da PC e poi su un telefono Android dentro Telegram, tramite un tunnel HTTPS.
