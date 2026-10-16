export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Kart-Gram REST API",
    version: "1.0.0",
    description: `API Backend e gestione catalogo per **Kart-Gram** (Telegram Mini App e Dashboard Amministrativa).

### Autenticazione per le operazioni di scrittura (Admin)
I metodi di sola lettura (\`GET\`) sono pubblici.
I metodi di creazione, modifica ed eliminazione (\`POST\`, \`PUT\`, \`DELETE\`) richiedono privilegi di **Amministratore**.
Puoi autenticarti in due modi:
1. **Cookie di Sessione Better Auth**: Effettua prima il login tramite \`POST /api/auth/sign-in/email\`.
2. **Header Segreto**: Invia l'header \`x-admin-secret\` con il valore configurato nel backend.`,
  },
  servers: [
    {
      url: "/",
      description: "Server corrente (Relativo)",
    },
  ],
  tags: [
    { name: "Cars", description: "Gestione del parco auto da corsa" },
    { name: "Characters", description: "Gestione dei personaggi e piloti" },
    { name: "Maps", description: "Gestione dei circuiti e mappe di gioco" },
    { name: "Auth (Better Auth)", description: "Autenticazione per amministratori della Dashboard" },
  ],
  paths: {
    "/api/car": {
      get: {
        tags: ["Cars"],
        summary: "Lista di tutte le auto",
        description: "Restituisce l'elenco completo di tutte le auto configurate nel gioco.",
        responses: {
          200: {
            description: "Elenco auto recuperato con successo",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Car" },
                },
                example: [
                  {
                    id: 1,
                    name: "Speedy Kart",
                    carType: "speed",
                    speed: 120,
                    baseLives: 3,
                    unlockType: "FREE",
                    unlockValue: 0,
                    isActive: true,
                  },
                  {
                    id: 2,
                    name: "Thunder Bolt",
                    carType: "acceleration",
                    speed: 140,
                    baseLives: 4,
                    unlockType: "COINS",
                    unlockValue: 1000,
                    isActive: true,
                  },
                ],
              },
            },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      post: {
        tags: ["Cars"],
        summary: "Crea una nuova auto (Admin)",
        description: "Aggiunge una nuova auto al catalogo. Richiede privilegi di amministratore.",
        security: [{ BetterAuthCookie: [] }, { AdminSecretHeader: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateCarInput" },
              example: {
                name: "Rocket Flame",
                carType: "drift",
                speed: 150,
                baseLives: 3,
                unlockType: "COINS",
                unlockValue: 1500,
                isActive: true,
              },
            },
          },
        },
        responses: {
          201: {
            description: "Auto creata con successo",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Car" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          403: { $ref: "#/components/responses/ForbiddenError" },
          409: {
            description: "Auto già esistente con lo stesso nome",
            content: {
              "application/json": {
                example: { message: "Un'auto con questo nome esiste già" },
              },
            },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/car/{id}": {
      get: {
        tags: ["Cars"],
        summary: "Dettaglio di una singola auto",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
            example: 1,
            description: "ID numerico dell'auto",
          },
        ],
        responses: {
          200: {
            description: "Dettagli auto recuperati",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Car" },
              },
            },
          },
          400: {
            description: "ID non valido",
            content: { "application/json": { example: { message: "ID auto non valido" } } },
          },
          404: {
            description: "Auto non trovata",
            content: { "application/json": { example: { message: "Auto non trovata" } } },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      put: {
        tags: ["Cars"],
        summary: "Aggiorna un'auto (Admin)",
        description: "Modifica i campi di un'auto per ID. Richiede privilegi di amministratore.",
        security: [{ BetterAuthCookie: [] }, { AdminSecretHeader: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateCarInput" },
              example: {
                speed: 160,
                baseLives: 4,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Auto aggiornata con successo",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Car" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          403: { $ref: "#/components/responses/ForbiddenError" },
          404: {
            description: "Auto non trovata",
            content: { "application/json": { example: { message: "Auto non trovata" } } },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      delete: {
        tags: ["Cars"],
        summary: "Elimina un'auto (Admin)",
        description: "Elimina un'auto dal catalogo tramite ID. Richiede privilegi di amministratore.",
        security: [{ BetterAuthCookie: [] }, { AdminSecretHeader: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Auto eliminata con successo",
            content: {
              "application/json": {
                example: { message: "Auto eliminata" },
              },
            },
          },
          400: {
            description: "ID non valido",
            content: { "application/json": { example: { message: "ID auto non valido" } } },
          },
          403: { $ref: "#/components/responses/ForbiddenError" },
          404: {
            description: "Auto non trovata",
            content: { "application/json": { example: { message: "Auto non trovata" } } },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/character": {
      get: {
        tags: ["Characters"],
        summary: "Lista di tutti i personaggi",
        responses: {
          200: {
            description: "Elenco personaggi recuperato con successo",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Character" },
                },
                example: [
                  {
                    id: 1,
                    name: "Mario Racer",
                    subtype: "balanced",
                    bonusStat: "+10% coin bonus",
                    unlockType: "FREE",
                    unlockValue: 0,
                    isActive: true,
                  },
                ],
              },
            },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      post: {
        tags: ["Characters"],
        summary: "Crea un nuovo personaggio (Admin)",
        security: [{ BetterAuthCookie: [] }, { AdminSecretHeader: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateCharacterInput" },
              example: {
                name: "Cyber Luigi",
                subtype: "speed",
                bonusStat: "shield_start",
                unlockType: "STARS",
                unlockValue: 50,
                isActive: true,
              },
            },
          },
        },
        responses: {
          201: {
            description: "Personaggio creato con successo",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Character" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          403: { $ref: "#/components/responses/ForbiddenError" },
          409: {
            description: "Personaggio già esistente con lo stesso nome",
            content: {
              "application/json": {
                example: { message: "Un personaggio con questo nome esiste già" },
              },
            },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/character/{id}": {
      get: {
        tags: ["Characters"],
        summary: "Dettaglio di un singolo personaggio",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Dettaglio personaggio recuperato",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Character" },
              },
            },
          },
          404: {
            description: "Personaggio non trovato",
            content: { "application/json": { example: { message: "Personaggio non trovato" } } },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      put: {
        tags: ["Characters"],
        summary: "Aggiorna un personaggio (Admin)",
        security: [{ BetterAuthCookie: [] }, { AdminSecretHeader: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateCharacterInput" },
              example: {
                bonusStat: "+20% coin bonus",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Personaggio aggiornato con successo",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Character" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          403: { $ref: "#/components/responses/ForbiddenError" },
          404: {
            description: "Personaggio non trovato",
            content: { "application/json": { example: { message: "Personaggio non trovato" } } },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      delete: {
        tags: ["Characters"],
        summary: "Elimina un personaggio (Admin)",
        security: [{ BetterAuthCookie: [] }, { AdminSecretHeader: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Personaggio eliminato",
            content: { "application/json": { example: { message: "Personaggio eliminato" } } },
          },
          403: { $ref: "#/components/responses/ForbiddenError" },
          404: {
            description: "Personaggio non trovato",
            content: { "application/json": { example: { message: "Personaggio non trovato" } } },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/maps": {
      get: {
        tags: ["Maps"],
        summary: "Lista di tutte le mappe",
        responses: {
          200: {
            description: "Elenco mappe recuperato con successo",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Map" },
                },
                example: [
                  {
                    id: 1,
                    name: "Neon City Circuit",
                    mapType: "asphalt",
                    unlockType: "FREE",
                    unlockValue: 0,
                    isActive: true,
                  },
                ],
              },
            },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      post: {
        tags: ["Maps"],
        summary: "Crea una nuova mappa (Admin)",
        security: [{ BetterAuthCookie: [] }, { AdminSecretHeader: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateMapInput" },
              example: {
                name: "Volcano Valley",
                mapType: "lava",
                unlockType: "COINS",
                unlockValue: 2000,
                isActive: true,
              },
            },
          },
        },
        responses: {
          201: {
            description: "Mappa creata con successo",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Map" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          403: { $ref: "#/components/responses/ForbiddenError" },
          409: {
            description: "Mappa già esistente con lo stesso nome",
            content: { "application/json": { example: { message: "Una mappa con questo nome esiste già" } } },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/maps/{id}": {
      get: {
        tags: ["Maps"],
        summary: "Dettaglio di una singola mappa",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Dettaglio mappa recuperato",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Map" },
              },
            },
          },
          404: {
            description: "Mappa non trovata",
            content: { "application/json": { example: { message: "Mappa non trovata" } } },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      put: {
        tags: ["Maps"],
        summary: "Aggiorna una mappa (Admin)",
        security: [{ BetterAuthCookie: [] }, { AdminSecretHeader: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateMapInput" },
              example: {
                unlockValue: 2500,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Mappa aggiornata con successo",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Map" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          403: { $ref: "#/components/responses/ForbiddenError" },
          404: {
            description: "Mappa non trovata",
            content: { "application/json": { example: { message: "Mappa non trovata" } } },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      delete: {
        tags: ["Maps"],
        summary: "Elimina una mappa (Admin)",
        security: [{ BetterAuthCookie: [] }, { AdminSecretHeader: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Mappa eliminata",
            content: { "application/json": { example: { message: "Mappa eliminata" } } },
          },
          403: { $ref: "#/components/responses/ForbiddenError" },
          404: {
            description: "Mappa non trovata",
            content: { "application/json": { example: { message: "Mappa non trovata" } } },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/auth/sign-in/email": {
      post: {
        tags: ["Auth (Better Auth)"],
        summary: "Login Admin con Email e Password",
        description: "Autentica un amministratore e imposta il cookie di sessione per le chiamate successive.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "admin@kartgram.com" },
                  password: { type: "string", format: "password", example: "PasswordSicura123!" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login effettuato con successo",
            content: {
              "application/json": {
                example: {
                  user: {
                    id: "usr_123456",
                    name: "Admin Kart",
                    email: "admin@kartgram.com",
                    role: "admin",
                  },
                  session: {
                    id: "ses_123456",
                    expiresAt: "2026-10-23T15:00:00.000Z",
                  },
                },
              },
            },
          },
          400: { description: "Email o password errati" },
        },
      },
    },
    "/api/auth/sign-up/email": {
      post: {
        tags: ["Auth (Better Auth)"],
        summary: "Registrazione Admin con Email e Password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string", example: "Admin Kart" },
                  email: { type: "string", format: "email", example: "admin@kartgram.com" },
                  password: { type: "string", format: "password", example: "PasswordSicura123!" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Account registrato con successo" },
          400: { description: "Dati non validi o email già esistente" },
        },
      },
    },
    "/api/auth/get-session": {
      get: {
        tags: ["Auth (Better Auth)"],
        summary: "Recupera la sessione corrente",
        description: "Verifica se il client ha una sessione attiva (legge il cookie).",
        responses: {
          200: {
            description: "Sessione attiva",
            content: {
              "application/json": {
                example: {
                  user: {
                    id: "usr_123",
                    name: "Admin",
                    email: "admin@kartgram.com",
                    role: "admin",
                  },
                  session: {
                    id: "ses_123",
                    expiresAt: "2026-10-23T15:00:00.000Z",
                  },
                },
              },
            },
          },
          401: { description: "Nessuna sessione attiva" },
        },
      },
    },
    "/api/auth/sign-out": {
      post: {
        tags: ["Auth (Better Auth)"],
        summary: "Logout Admin",
        description: "Invalida la sessione ed elimina il cookie di autenticazione.",
        responses: {
          200: { description: "Disconnesso con successo" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BetterAuthCookie: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
        description: "Cookie di sessione automatico generato dopo il login Better Auth.",
      },
      AdminSecretHeader: {
        type: "apiKey",
        in: "header",
        name: "x-admin-secret",
        description: "Header segreto per test diretti o script backend.",
      },
    },
    responses: {
      ValidationError: {
        description: "Errore di validazione dei dati (Zod)",
        content: {
          "application/json": {
            example: {
              message: "Dati non validi",
              errors: {
                name: ["String must contain at least 1 character(s)"],
                speed: ["Expected number, received string"],
              },
            },
          },
        },
      },
      ForbiddenError: {
        description: "Permesso negato: l'utente non è amministratore",
        content: {
          "application/json": {
            example: { message: "Accesso negato: solo per amministratori" },
          },
        },
      },
      InternalError: {
        description: "Errore interno del server",
        content: {
          "application/json": {
            example: { message: "Errore interno del server" },
          },
        },
      },
    },
    schemas: {
      Car: {
        type: "object",
        required: ["id", "name", "speed", "baseLives", "unlockType", "unlockValue", "isActive"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Speedy Kart" },
          carType: { type: "string", nullable: true, example: "racing" },
          speed: { type: "integer", example: 120 },
          baseLives: { type: "integer", default: 3, example: 3 },
          unlockType: {
            type: "string",
            enum: ["FREE", "COINS", "STARS", "SHARES", "ADS"],
            example: "FREE",
          },
          unlockValue: { type: "integer", default: 0, example: 0 },
          isActive: { type: "boolean", default: true, example: true },
        },
      },
      CreateCarInput: {
        type: "object",
        required: ["name", "speed", "unlockType"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100, example: "Speedy Kart" },
          carType: { type: "string", nullable: true, maxLength: 50, example: "racing" },
          speed: { type: "integer", example: 120 },
          baseLives: { type: "integer", default: 3, example: 3 },
          unlockType: {
            type: "string",
            enum: ["FREE", "COINS", "STARS", "SHARES", "ADS"],
            example: "COINS",
          },
          unlockValue: { type: "integer", default: 0, example: 500 },
          isActive: { type: "boolean", default: true, example: true },
        },
      },
      UpdateCarInput: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          carType: { type: "string", nullable: true, maxLength: 50 },
          speed: { type: "integer" },
          baseLives: { type: "integer" },
          unlockType: { type: "string", enum: ["FREE", "COINS", "STARS", "SHARES", "ADS"] },
          unlockValue: { type: "integer" },
          isActive: { type: "boolean" },
        },
      },

      Character: {
        type: "object",
        required: ["id", "name", "unlockType", "unlockValue", "isActive"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Mario Racer" },
          subtype: { type: "string", nullable: true, example: "balanced" },
          bonusStat: { type: "string", nullable: true, example: "+10% coins" },
          unlockType: {
            type: "string",
            enum: ["FREE", "COINS", "STARS", "SHARES", "ADS"],
            example: "FREE",
          },
          unlockValue: { type: "integer", default: 0, example: 0 },
          isActive: { type: "boolean", default: true, example: true },
        },
      },
      CreateCharacterInput: {
        type: "object",
        required: ["name", "unlockType"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100, example: "Luigi Kart" },
          subtype: { type: "string", nullable: true, maxLength: 50, example: "drift" },
          bonusStat: { type: "string", nullable: true, maxLength: 100, example: "shield_start" },
          unlockType: {
            type: "string",
            enum: ["FREE", "COINS", "STARS", "SHARES", "ADS"],
            example: "STARS",
          },
          unlockValue: { type: "integer", default: 0, example: 25 },
          isActive: { type: "boolean", default: true, example: true },
        },
      },
      UpdateCharacterInput: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          subtype: { type: "string", nullable: true, maxLength: 50 },
          bonusStat: { type: "string", nullable: true, maxLength: 100 },
          unlockType: { type: "string", enum: ["FREE", "COINS", "STARS", "SHARES", "ADS"] },
          unlockValue: { type: "integer" },
          isActive: { type: "boolean" },
        },
      },

      Map: {
        type: "object",
        required: ["id", "name", "unlockType", "unlockValue", "isActive"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Neon Highway" },
          mapType: { type: "string", nullable: true, example: "cyberpunk" },
          unlockType: {
            type: "string",
            enum: ["FREE", "COINS", "STARS", "SHARES", "ADS"],
            example: "FREE",
          },
          unlockValue: { type: "integer", default: 0, example: 0 },
          isActive: { type: "boolean", default: true, example: true },
        },
      },
      CreateMapInput: {
        type: "object",
        required: ["name", "unlockType"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100, example: "Desert Oasis" },
          mapType: { type: "string", nullable: true, maxLength: 50, example: "desert" },
          unlockType: {
            type: "string",
            enum: ["FREE", "COINS", "STARS", "SHARES", "ADS"],
            example: "COINS",
          },
          unlockValue: { type: "integer", default: 0, example: 1200 },
          isActive: { type: "boolean", default: true, example: true },
        },
      },
      UpdateMapInput: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          mapType: { type: "string", nullable: true, maxLength: 50 },
          unlockType: { type: "string", enum: ["FREE", "COINS", "STARS", "SHARES", "ADS"] },
          unlockValue: { type: "integer" },
          isActive: { type: "boolean" },
        },
      },
    },
  },
};
