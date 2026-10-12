# kart-gram

Gioco endless di drift con i kart, giocabile come **Telegram Mini App**.
Si gioca con un dito solo: tieni premuto per derapare in curva, rilasci per raddrizzare. Se cadi nel vuoto la partita finisce.
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
│   └── generate-models    # Genera i modelli segnaposto (box, cilindri) in public/models/
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

I modelli in `public/models/` sono segnaposto generati da `scripts/generate-models`.
Per sostituirne uno basta salvare un nuovo `.glb` **con lo stesso nome**.
Convenzioni: 1 unità = 1 metro, asse Y verso l'alto, il kart guarda verso **-Z**, origine alla base del modello.
