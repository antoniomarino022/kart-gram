export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Kart-Gram REST API",
    version: "2.0.0",
    description: `API Backend ufficiale per **Kart-Gram** (Telegram Mini App e Dashboard Amministrativa).

### Autenticazione
- **Game API (\`/api/game/*\`)**: Autenticate tramite header \`Authorization: tma <initData>\` contenente l'hash crittografico firmato da Telegram.
- **Admin API (\`/api/admin/*\`)**: Autenticate tramite sessione Better Auth (cookie o token admin) riservate al ruolo amministratore.`,
  },
  servers: [
    {
      url: "/",
      description: "Server corrente (Relativo)",
    },
  ],
  tags: [
    { name: "Game", description: "API di gioco per Telegram Mini App" },
    { name: "Admin", description: "API amministrative per la gestione di catalogo e giocatori" },
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
        summary: "Acquista con monete",
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
    "/api/game/runs": {
      post: {
        tags: ["Game"],
        summary: "Inizia una nuova partita",
        responses: {
          200: { description: "Restituisce runId e seed crittografico generato dal server" },
        },
      },
    },
    "/api/game/runs/{id}/finish": {
      post: {
        tags: ["Game"],
        summary: "Conclude la partita e valida il punteggio",
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
        summary: "Revive in-game",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Revive applicato con successo" },
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
          403: { description: "Solo amministratori" },
        },
      },
    },
    "/api/admin/players": {
      get: {
        tags: ["Admin"],
        summary: "Elenco giocatori con ricerca e paginazione",
        responses: {
          200: { description: "Elenco giocatori" },
        },
      },
    },
    "/api/admin/stats": {
      get: {
        tags: ["Admin"],
        summary: "Panoramica statistiche dashboard",
        responses: {
          200: { description: "Metriche e statistiche generali" },
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
