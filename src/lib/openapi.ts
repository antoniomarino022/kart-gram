/**
 * Specifica OpenAPI 3.0.3 completa di tutte le route REST di Kart-Gram
 * (Game API, Admin API e Telegram Webhook), servita da `GET /api/docs`.
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Kart-Gram REST API",
    version: "2.0.0",
    description: `API Backend ufficiale per **Kart-Gram** (Telegram Mini App e Dashboard Amministrativa).

### Autenticazione
- **Game API (\`/api/game/*\`)**: Autenticate tramite header \`Authorization: tma <initData>\` contenente l'hash crittografico firmato da Telegram.
- **Admin API (\`/api/admin/*\`)**: Autenticate tramite sessione Better Auth (cookie di sessione) riservate al ruolo \`admin\`.`,
  },
  servers: [
    {
      url: "/",
      description: "Server corrente (Relativo)",
    },
  ],
  tags: [
    { name: "Game", description: "API di gioco per Telegram Mini App" },
    { name: "Admin", description: "API amministrative per la gestione di catalogo, giocatori e pagamenti" },
    { name: "Telegram", description: "Webhook e integrazione bot Telegram" },
  ],
  paths: {
    "/api/game/profile": {
      get: {
        tags: ["Game"],
        summary: "Profilo del giocatore",
        description: "Restituisce lo stato del giocatore (monete, record, oggetti posseduti, equipaggiamento, livelli upgrade e revive).",
        responses: {
          200: { description: "Profilo recuperato con successo" },
          401: { description: "Telegram initData non valido" },
        },
      },
    },
    "/api/game/catalog": {
      get: {
        tags: ["Game"],
        summary: "Catalogo negozio e garage",
        description: "Restituisce tutti gli oggetti attivi (kart, vernici, ruote, scie, pacchetti monete e starter pack).",
        responses: {
          200: { description: "Catalogo recuperato con successo" },
        },
      },
    },
    "/api/game/equip": {
      post: {
        tags: ["Game"],
        summary: "Equipaggia un oggetto",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  slot: { type: "string", enum: ["kart", "paint", "wheels", "trail"] },
                  itemId: { type: "string" },
                },
                required: ["slot", "itemId"],
              },
            },
          },
        },
        responses: {
          200: { description: "Oggetto equipaggiato con successo" },
          400: { description: "Oggetto non posseduto o slot non valido" },
        },
      },
    },
    "/api/game/shop/coins": {
      post: {
        tags: ["Game"],
        summary: "Acquista un oggetto con le monete",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { itemId: { type: "string" } },
                required: ["itemId"],
              },
            },
          },
        },
        responses: {
          200: { description: "Oggetto acquistato con successo" },
          400: { description: "Monete insufficienti o oggetto già posseduto" },
        },
      },
    },
    "/api/game/shop/stars-invoice": {
      post: {
        tags: ["Game"],
        summary: "Crea fattura Telegram Stars",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { itemId: { type: "string" } },
                required: ["itemId"],
              },
            },
          },
        },
        responses: {
          200: { description: "Link fattura Telegram creato" },
        },
      },
    },
    "/api/game/upgrades": {
      post: {
        tags: ["Game"],
        summary: "Potenzia un upgrade (turbo, magnet, slowmo, x2)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  upgradeId: { type: "string", enum: ["turbo", "magnet", "slowmo", "x2"] },
                },
                required: ["upgradeId"],
              },
            },
          },
        },
        responses: {
          200: { description: "Potenziamento migliorato con successo" },
          400: { description: "Monete insufficienti o livello massimo già raggiunto" },
        },
      },
    },
    "/api/game/runs": {
      post: {
        tags: ["Game"],
        summary: "Inizia una nuova partita",
        responses: {
          200: { description: "Restituisce runId, seed crittografico, upgrades e wheels" },
        },
      },
    },
    "/api/game/runs/{id}/finish": {
      post: {
        tags: ["Game"],
        summary: "Conclude la partita e valida il punteggio con replay server-side",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Partita rigiocata dal server e punteggio validato" },
          409: { description: "Partita già chiusa o scaduta" },
        },
      },
    },
    "/api/game/runs/{id}/revive": {
      post: {
        tags: ["Game"],
        summary: "Revive in-game (monete, Stelle o revive posseduto)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Revive applicato o link fattura Stelle restituito" },
        },
      },
    },
    "/api/game/leaderboard": {
      get: {
        tags: ["Game"],
        summary: "Classifica globale o settimanale",
        parameters: [
          { name: "scope", in: "query", schema: { type: "string", enum: ["global", "weekly"], default: "global" } },
        ],
        responses: {
          200: { description: "Top 50 giocatori recuperata" },
        },
      },
    },
    "/api/admin/stats": {
      get: {
        tags: ["Admin"],
        summary: "Panoramica statistiche dashboard",
        responses: {
          200: { description: "Metriche giocatori, partite, Stelle e best score" },
        },
      },
    },
    "/api/admin/payments": {
      get: {
        tags: ["Admin"],
        summary: "Storico paginato transazioni Telegram Stars",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        ],
        responses: {
          200: { description: "Elenco pagamenti in Stelle" },
        },
      },
    },
    "/api/admin/items": {
      get: {
        tags: ["Admin"],
        summary: "Elenco completo oggetti catalogo (anche disattivati)",
        responses: {
          200: { description: "Elenco catalogo" },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "Crea un nuovo oggetto a catalogo",
        responses: {
          201: { description: "Oggetto creato" },
          409: { description: "ID oggetto già esistente" },
        },
      },
    },
    "/api/admin/items/{id}": {
      patch: {
        tags: ["Admin"],
        summary: "Aggiorna un oggetto del catalogo",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Oggetto aggiornato" },
          404: { description: "Oggetto non trovato" },
        },
      },
      delete: {
        tags: ["Admin"],
        summary: "Elimina un oggetto dal catalogo (se mai acquistato/assegnato)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Oggetto eliminato" },
          409: { description: "Oggetto già posseduto o pagato: disattivarlo invece di eliminarlo" },
        },
      },
    },
    "/api/admin/players": {
      get: {
        tags: ["Admin"],
        summary: "Elenco giocatori con ricerca e paginazione",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        ],
        responses: {
          200: { description: "Elenco giocatori" },
        },
      },
    },
    "/api/admin/players/{id}": {
      get: {
        tags: ["Admin"],
        summary: "Dettaglio completo di un giocatore",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "Dossier giocatore (profilo, inventario, upgrade, partite, pagamenti, transazioni)" },
          404: { description: "Giocatore non trovato" },
        },
      },
      patch: {
        tags: ["Admin"],
        summary: "Modifica dati giocatore (monete, revive, record, nome, ban)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "Giocatore aggiornato" },
          404: { description: "Giocatore non trovato" },
        },
      },
    },
    "/api/admin/players/{id}/items": {
      post: {
        tags: ["Admin"],
        summary: "Regala/assegna un oggetto del catalogo al giocatore",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "Oggetto assegnato e dossier aggiornato" },
        },
      },
    },
    "/api/admin/players/{id}/items/{itemId}": {
      delete: {
        tags: ["Admin"],
        summary: "Revoca un oggetto dall'inventario del giocatore",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          { name: "itemId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Oggetto revocato e dossier aggiornato" },
        },
      },
    },
    "/api/telegram": {
      post: {
        tags: ["Telegram"],
        summary: "Webhook per update Telegram Bot",
        responses: {
          200: { description: "Update gestito con successo" },
          401: { description: "Secret token errato" },
        },
      },
    },
  },
};
