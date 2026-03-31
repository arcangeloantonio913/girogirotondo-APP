import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import "@/index.css";
import App from "@/App";
import { register as registerSW } from "@/serviceWorkerRegistration";

// Initialize Sentry — solo in produzione e se DSN è configurato
if (process.env.NODE_ENV === "production" && process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    tracesSampleRate: 0.2,
    environment: "production",
    sendDefaultPii: false, // GDPR: nessun dato personale inviato
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Registra il service worker per PWA (solo in produzione)
registerSW();
