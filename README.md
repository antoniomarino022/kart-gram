# kart-gram

Gioco endless di drift con i kart, giocabile come **Telegram Mini App**.
Tieni premuto a sinistra o a destra dello schermo per derapare da quella parte, rilascia per andare dritto. Se cadi nel vuoto la partita finisce.
Lo scopo è fare lo score più alto possibile.

- **Frontend / gioco** (questo team): Next.js 16 + React 19 + three.js + Tailwind 4
- **Backend** (API, pagamenti Telegram Stars, classifiche): lo sviluppa un collega e rispetta il contratto in `src/backend/types.ts`

## Avvio

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_BACKEND=mock per lavorare senza backend
npm run dev
```

Apri http://localhost:3000. Per provarlo dentro Telegram serve un URL HTTPS pubblico, per esempio un tunnel con `cloudflared`.

Comandi:
- **Telefono:** tieni premuto sulla metà sinistra dello schermo per curvare a sinistra, sulla metà destra per curvare a destra. Rilascia per andare dritto.
- **PC:** click sinistro tenuto premuto sulle due metà dello schermo, oppure **←/→** o **A/D**.
- Il bottone ❚❚ in alto a destra mette in pausa. Il gioco va in pausa da solo anche quando l'app passa in background.
- Il bottone in alto a destra nel menu accende o spegne la vibrazione.

## Come si gioca

Il kart va avanti da solo e va dritto finché non sterzi: la strada non lo guida. Quando arriva una curva tieni premuto dalla parte giusta (sinistra o destra) e il kart derapa da quella parte. Rilascia per andare dritto. Se esci dalla strada cadi nel vuoto e la partita finisce subito. Hai 3 vite, mostrate come cuori in alto a sinistra: ogni urto con un ostacolo ne toglie una e a 0 il kart si schianta. A fine partita il game over dice se sei caduto o se il kart è distrutto.

- **Score:** distanza, derapate lunghe, linea perfetta (vicino al bordo interno della curva) e near-miss con gli ostacoli. La **combo** (fino a 5×) moltiplica i punti e si azzera se colpisci un ostacolo.
- **Monete:** raccoglile sulla strada e spendile nel **Garage** per kart, vernici, ruote, scie e potenziamenti.
- **Pedane boost:** tratti di strada colorati con frecce animate. Passandoci sopra il kart accelera per 1,5 s. Spesso coprono solo metà strada: sterza dalla parte giusta per prenderle.
- **Velocità:** cresce a ogni bioma e con la combo (fino a +48% a x5). Un urto azzera la combo e rallenta.
- **Power-up:** turbo, scudo (assorbe un urto), magnete, strada larga, slow-mo, x2 e cuore (+1 vita) si attivano da soli quando li prendi.
- **Revive:** una volta per partita puoi continuare con 500 monete, 5 ⭐ o un revive già comprato.
- **Shop:** starter pack, pacchetti di monete e cosmetici esclusivi in Stelle.

## Variabili d'ambiente

| Variabile | Valori | Descrizione |
|---|---|---|
| `NEXT_PUBLIC_BACKEND` | `mock` \| `remote` | `mock` salva tutto in `localStorage` (sviluppo), `remote` usa le API reali (produzione) |
| `NEXT_PUBLIC_API_URL` | URL | Base URL delle API, usata solo con `remote` |
| `NEXT_PUBLIC_MOCK_COINS` | numero | Solo `mock`: monete iniziali |

Con `mock` gli acquisti in Stelle sono **gratuiti**: l'oggetto viene sbloccato subito, senza pagamento. Per azzerare i dati del mock basta svuotare il `localStorage` del sito (DevTools → Application).

## Struttura

```
kart-gram/
├── public/
│   ├── models/            # Modelli 3D .glb (glTF 2.0), sostituibili file per file
│   ├── textures/          # Texture del mondo 3D (asfalto, cielo, insegne)
│   ├── ui/                # Grafiche della UI: bottoni, icone, sfondi, logo
│   └── fonts/             # Font custom (woff2)
├── scripts/
│   └── generate-models.mjs # Genera i modelli segnaposto (box, cilindri) in public/models/
├── docs/
│   └── superpowers/specs/ # Documenti di design
└── src/
    ├── app/               # Next.js App Router: solo layout e pagina che monta il gioco
    ├── game/
    │   ├── core/          # Logica pura in TypeScript, senza DOM né three.js:
    │   │                  #   RNG con seed, generazione strada, fisica del drift,
    │   │                  #   collisioni, ostacoli, power-up, score e combo
    │   ├── render/        # three.js: scena, camera alle spalle, biomi, caricamento modelli
    │   ├── input/         # Gestione del touch (premi / rilascia)
    │   └── config.ts      # Parametri di bilanciamento (velocità, punteggi, durate)
    ├── ui/                # Componenti React: menu, HUD, garage, shop, game over
    ├── backend/           # Contratto verso il backend
    │   ├── types.ts       #   tipi e interfaccia (quella che implementa il collega)
    │   ├── mock.ts        #   implementazione finta con localStorage
    │   ├── remote.ts      #   implementazione con chiamate HTTP a NEXT_PUBLIC_API_URL
    │   └── index.ts       #   sceglie mock o remote in base a NEXT_PUBLIC_BACKEND
    └── telegram/          # Wrapper dell'SDK WebApp: initData, haptics, openInvoice, fullscreen
```

### Regole

- **`game/core` non importa mai three.js, React o il DOM.** Così è testabile e il backend può rigiocare una partita dal seed per l'anti-cheat.
- **React non aggiorna lo stato a 60 fps.** Il loop di gioco gira fuori da React e la UI riceve solo eventi (game over, monete, record).
- **Il gioco parla col backend solo tramite `src/backend`.** Nessuna `fetch` sparsa nel codice.
- **Pagamenti in Stars:** il client apre la fattura con `openInvoice(link)`. Gli oggetti li assegna **solo** il backend, dopo `successful_payment`.

## Grafiche

Il codice usa ogni grafica tramite un **nome di file fisso**. Per cambiare una grafica basta sostituire il file con uno nuovo **con lo stesso nome**, senza toccare il codice.
All'inizio i file sono segnaposto; l'elenco completo, con nome, dimensione e dove compare ogni file, verrà aggiunto qui man mano che vengono creati.

| Cartella | Formato consigliato | Note |
|---|---|---|
| `public/ui/` | **SVG** per icone e bottoni semplici, **WebP** per illustrazioni e sfondi | Prefisso per tipo: `btn_`, `icon_`, `bg_`, `powerup_` (es. `btn_play.webp`, `icon_coin.svg`) |
| `public/textures/` | WebP o PNG, lato in potenza di 2 (256, 512, 1024) | Tenerle piccole, il peso conta nella WebView di Telegram |
| `public/fonts/` | woff2 | Dichiarati in `src/app/globals.css` |

## Modelli 3D

I modelli in `public/models/` sono segnaposto generati da `scripts/generate-models.mjs` (`npm run models`).
Per sostituirne uno basta salvare un nuovo `.glb` **con lo stesso nome**.
Convenzioni: 1 unità = 1 metro, asse Y verso l'alto, il kart guarda verso **-Z**, origine alla base del modello.

Per rigenerare i segnaposto: `npm run models`.

- **I kart non hanno le ruote**: il gioco le aggancia dal modello `wheel_*` scelto, nei punti `(±0.55, 0.22, ±0.6)` (x, y, z).
- **Le mesh da ricolorare** (vernice del kart) devono usare un materiale chiamato esattamente `paint`.
- Ruote: cilindro con asse X, centrate nell'origine. Power-up e moneta: centrati nell'origine (il gioco li solleva e li fa ruotare). Kart, ostacoli e decorazioni: origine alla base.

| File | Cosa è | Dimensione circa |
|---|---|---|
| `kart_classic` | Kart base, corpo basso a scatola con sedile e volante | 1.0 × 0.7 × 1.6 m (larg. × alt. × lung.) |
| `kart_bolt` | Kart a cuneo con alettone posteriore | 1.1 × 0.65 × 2.1 m |
| `kart_brick` | Kart alto e squadrato | 1.05 × 1.0 × 1.55 m |
| `kart_rocket` | Kart lungo con propulsori dietro | 0.85 × 0.65 × 2.5 m |
| `wheel_basic` | Ruota standard | raggio 0.22, larghezza 0.20 m |
| `wheel_sport` | Ruota sottile con cerchio colorato | raggio 0.22, larghezza 0.18 m |
| `wheel_offroad` | Ruota larga e tassellata | raggio esterno 0.25, larghezza 0.28 m (agganciata a y = 0.22 affonda al massimo 0.03: accettabile) |
| `wheel_retro` | Ruota con fascia bianca | raggio 0.22, larghezza 0.23 m |
| `rival_kart` | Kart avversario grigio, con le ruote incluse (niente `paint`) | 1.3 × 0.85 × 1.65 m |
| `obstacle_cone` | Cono arancione con striscia bianca | raggio 0.35, altezza 0.7 m |
| `obstacle_barrier` | Barriera a strisce rosse e bianche | 3.0 × 0.9 × 0.4 m |
| `coin` | Moneta d'oro in piedi, rivolta verso Z | raggio 0.35, spessore 0.08 m |
| `powerup_turbo` | Doppio chevron arancione | 0.85 × 0.8 m |
| `powerup_shield` | Sfera schiacciata azzurra | 0.8 m |
| `powerup_magnet` | Calamita a U rossa | 0.8 m |
| `powerup_wide` | Piastra larga verde con frecce | 0.9 m |
| `powerup_slowmo` | Clessidra viola | 0.8 m |
| `powerup_x2` | Due cubi gialli | 0.8 m |
| `powerup_heart` | Cuore rosso (due sfere + cubo ruotato) | 0.8 m |
| `deco_city_1..3` | Torri blu | alte 14–19 m |
| `deco_desert_1..3` | Piramide, arco, cactus | alte 6–8.5 m (la piramide è larga 14 m) |
| `deco_ice_1..3` | Cristallo, cubi di neve, gruppo di cristalli | alte 4.7–9.2 m |
| `deco_neon_1..3` | Anelli, torre e cubo al neon magenta / ciano | alte 4–9 m, larghe fino a 9 m |

Olio, ghiaccio e buche non sono modelli: il gioco li disegna come decal piatti.
