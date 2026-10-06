# Modifiche da applicare ad ANDROID quando l'app esce dalla revisione Google

> Regola operativa (06-10-2026, decisa da Antonio): l'app Android/Google Play è **in revisione** →
> per ora NON si fanno aggiornamenti lato Google (niente nuovi build/submit Android, niente OTA Android).
> Si aggiorna **solo Apple (iOS) + Web**. Ogni modifica mobile fatta nel frattempo va segnata qui e
> **applicata ad Android subito dopo l'approvazione Google** (OTA e/o nuovo build Android).
>
> NB: le modifiche **backend** (Railway) e **web** (Vercel) sono server-side e valgono già per tutte le
> piattaforme — non richiedono azione Android. Qui si tracciano solo le modifiche **dell'app mobile**.

## Da portare su Android (OTA e/o nuovo build) dopo l'OK Google

- [ ] **Push notifications native** — plugin `expo-notifications` + `getExpoPushTokenAsync(projectId)` + versione 1.0.3 (commit 1f08038). Android richiede inoltre **FCM** (`google-services.json` + chiave FCM v1 su EAS) + nuovo build Android.
- [ ] **Griglia ↔ Mensa coerenti** — 6 categorie identiche al menù (Merenda mattina/Primo/Secondo/Contorno/Frutta/Merenda pomeriggio) nelle schermate mobile maestra + genitore + dashboard (commit f1da35c). JS → via OTA Android.
- [ ] **Download foto** — (DA FARE) possibilità di scaricare le foto dalla galleria. Da verificare/implementare e poi portare su Android.
- [ ] (eventuali altre modifiche mobile successive: aggiungere qui)

## Già fatto lato iOS/Web in questa sessione (riferimento)
- iOS: build 1.0.3 Giro+DB creati e submittati ad App Store Connect (in attesa versione in review).
- iOS: OTA runtime 1.0.1/1.0.2/1.0.3 pubblicati (**solo --platform ios**) con foto/avvisi/griglia/dati-aggiornati.
- Backend (tutte le piattaforme): avvisi bacheca-sede, campi griglia contorno/merenda_pomeriggio, email "Scarica l'app" (testo + link store org DB).
