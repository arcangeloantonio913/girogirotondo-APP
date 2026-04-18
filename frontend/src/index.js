import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { unregister as unregisterSW } from "@/serviceWorkerRegistration";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Disattiva il service worker — un gestionale non ha bisogno di cache offline
// e il SW impedisce agli utenti di ricevere aggiornamenti automatici.
// Questa chiamata rimuove anche eventuali SW già installati nei browser dei clienti.
unregisterSW();
