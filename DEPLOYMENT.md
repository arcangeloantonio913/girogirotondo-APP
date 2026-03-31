# Girogirotondo — Guida al Deploy in Produzione

Stack: **Next.js (Vercel)** + **FastAPI (Railway)** + **MongoDB Atlas** + **Firebase Auth**

---

## Pre-requisiti

- Account [GitHub](https://github.com) con il repo del progetto
- Account [Vercel](https://vercel.com) (gratuito)
- Account [Railway](https://railway.app) (gratuito fino a $5/mese)
- Cluster [MongoDB Atlas](https://cloud.mongodb.com) (gratuito M0)
- Progetto [Firebase](https://console.firebase.google.com) con Authentication abilitata
- Account [Sentry](https://sentry.io) (gratuito)

---

## 1. MongoDB Atlas

1. Vai su [MongoDB Atlas](https://cloud.mongodb.com) → crea un cluster M0 gratuito
2. **Database Access** → crea un utente con password sicura
3. **Network Access** → aggiungi `0.0.0.0/0` (Railway usa IP dinamici)
4. **Connect** → copia la URI del tipo:
   ```
   mongodb+srv://<user>:<password>@cluster.mongodb.net/girogirotondo?retryWrites=true&w=majority
   ```

---

## 2. Firebase

1. Console Firebase → Impostazioni progetto → **Account di servizio**
2. Clicca **Genera nuova chiave privata** → scarica il JSON
3. Estrai questi valori dal JSON:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
4. In Firebase Console → **Authentication** → abilita il provider **Email/Password**

---

## 3. Deploy Backend su Railway

1. Vai su [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Seleziona il repo e la cartella `backend/`
3. Railway rileva automaticamente il `railway.toml` e usa Nixpacks
4. Vai su **Variables** e aggiungi le seguenti:

```
MONGO_URL=mongodb+srv://...        ← da Atlas
DB_NAME=girogirotondo
JWT_SECRET=                         ← genera con: openssl rand -hex 32
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=
FIREBASE_STORAGE_BUCKET=
CORS_ORIGINS=https://tuo-progetto.vercel.app,http://localhost:3000
DEV_MODE=false
SENTRY_DSN=                         ← dal progetto Sentry (opzionale)
```

5. Copia l'URL pubblico del backend (es. `https://girogirotondo-backend.railway.app`)

---

## 4. Deploy Frontend su Vercel

1. Vai su [vercel.com](https://vercel.com) → **New Project** → importa il repo GitHub
2. **Root Directory**: imposta `frontend`
3. Framework viene auto-rilevato come **Next.js**
4. Vai su **Settings → Environment Variables** e aggiungi:

```
NEXT_PUBLIC_BACKEND_URL=https://girogirotondo-backend.railway.app
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tuo-progetto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_SENTRY_DSN=              ← opzionale
SENTRY_AUTH_TOKEN=                   ← opzionale, per source maps
SENTRY_ORG=                          ← opzionale
SENTRY_PROJECT=girogirotondo-frontend
```

5. **Deploy** — Vercel darà un URL tipo `https://girogirotondo.vercel.app`

---

## 5. Aggiorna CORS sul Backend

Torna su Railway → Variables → aggiorna `CORS_ORIGINS`:
```
CORS_ORIGINS=https://girogirotondo.vercel.app,http://localhost:3000
```

---

## 6. GitHub Actions (CI)

Aggiungi questi **Secrets** nel repo GitHub (Settings → Secrets → Actions):

```
NEXT_PUBLIC_BACKEND_URL
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_SENTRY_DSN
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
MONGO_URL_TEST              ← MongoDB URI del DB di test (opzionale)
JWT_SECRET
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL
```

---

## 7. Sentry (opzionale ma consigliato)

1. Crea un account su [sentry.io](https://sentry.io)
2. Crea due progetti: `girogirotondo-frontend` (Next.js) e `girogirotondo-backend` (Python)
3. Copia i DSN e aggiungili come variabili d'ambiente su Vercel e Railway

---

## 8. Verifica finale

Dopo il deploy controlla:

- [ ] `https://tuo-backend.railway.app/api/` risponde `{"message": "Girogirotondo API v2"}`
- [ ] Login funziona sulla dashboard Vercel
- [ ] Le notifiche di errore arrivano su Sentry
- [ ] MongoDB Atlas mostra connessioni attive
- [ ] CORS non dà errori nella console del browser

---

## Aggiornamenti futuri

Railway e Vercel si aggiornano automaticamente ad ogni push su `main`.
Il CI di GitHub Actions verifica build e lint prima del deploy.

Per rollback su Vercel: Deployments → seleziona un deploy precedente → **Promote to Production**.
Per rollback su Railway: Deployments → seleziona un deploy precedente → **Rollback**.


---

## 9. Icone PWA (importante per gli store)

Le icone placeholder in `frontend/public/` (logo192.png, logo512.png, apple-touch-icon.png) devono essere sostituite con il logo reale prima di pubblicare negli store. Basta sovrascrivere i file PNG mantenendo le stesse dimensioni:
- `logo192.png` → 192×192 px (Play Store + browser)
- `logo512.png` → 512×512 px (Play Store + browser)
- `apple-touch-icon.png` → 180×180 px (App Store / iOS Home Screen)

---

## 10. Pubblicazione Store tramite PWABuilder

Dopo che l'app è live su Vercel:

1. Vai su **[pwabuilder.com](https://www.pwabuilder.com)**
2. Inserisci l'URL dell'app Vercel (es. `https://girogirotondo.vercel.app`)
3. PWABuilder analizza il manifest e il service worker
4. Clicca **Package for Stores**

### Google Play Store (Android)
- Seleziona **Android** → scarica il file `.aab`
- Accedi a [Google Play Console](https://play.google.com/console) (account developer: $25 una tantum)
- Crea una nuova app → carica il `.aab` → compila scheda con descrizione, screenshot, icone
- Invia per revisione (1-3 giorni)

### Apple App Store (iOS)
- Seleziona **iOS** → scarica il pacchetto `.zip`
- Richiede **Mac + Xcode** (o un servizio cloud come MacStadium)
- Account Apple Developer: **$99/anno**
- Carica su App Store Connect → invia per revisione (1-7 giorni)

> ⚠️ Per iOS, Apple richiede che la PWA rispetti le [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/). Le app che sono solo "wrapper" di siti web vengono spesso rifiutate — assicurati che l'app offra valore nativo (notifiche push, offline mode, ecc.).

### GitHub Actions CI/CD — Secrets da aggiungere

Vai su GitHub → il tuo repo → Settings → Secrets → Actions e aggiungi:
```
REACT_APP_BACKEND_URL
REACT_APP_FIREBASE_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN
REACT_APP_FIREBASE_PROJECT_ID
REACT_APP_FIREBASE_STORAGE_BUCKET
REACT_APP_FIREBASE_MESSAGING_SENDER_ID
REACT_APP_FIREBASE_APP_ID
REACT_APP_SENTRY_DSN
MONGO_URL_TEST
JWT_SECRET
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL
```
