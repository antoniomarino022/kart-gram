"use client";

import { useEffect } from "react";

/**
 * Pagina Swagger UI interattiva per la documentazione API
 * Raggiungibile all'indirizzo: /docs
 */
export default function SwaggerDocsPage() {
  useEffect(() => {
    // 1. Carica il CSS di Swagger UI
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css";
    document.head.appendChild(link);

    // 2. Carica il bundle JS di Swagger UI
    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js";
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const win = window as unknown as {
        SwaggerUIBundle: (options: Record<string, unknown>) => void;
      };
      if (typeof win.SwaggerUIBundle === "function") {
        win.SwaggerUIBundle({
          url: "/api/docs",
          dom_id: "#swagger-ui",
          deepLinking: true,
          displayRequestDuration: true,
          docExpansion: "list",
          defaultModelsExpandDepth: 2,
          defaultModelExpandDepth: 2,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="bg-slate-900 text-white py-4 px-6 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">🏁 Kart-Gram API Documentation</h1>
          <p className="text-xs text-slate-400 mt-1">
            Swagger UI interattivo per frontend e dashboard
          </p>
        </div>
        <a
          href="/api/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded border border-slate-700 transition"
        >
          Visualizza OpenAPI Spec (JSON)
        </a>
      </div>
      <div id="swagger-ui" />
    </div>
  );
}
