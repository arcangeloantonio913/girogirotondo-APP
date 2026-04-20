import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { register as registerSW } from "@/serviceWorkerRegistration";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Registra il Service Worker custom (public/sw.js).
// Abilita: "Aggiungi alla schermata Home", cache offline, caricamento istantaneo.
// Il SW usa skipWaiting + clientsClaim per aggiornarsi automaticamente ad ogni deploy.
registerSW();
