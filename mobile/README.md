# Girogirotondo App — React Native (Expo)

## Setup

```bash
cd mobile
npm install
```

## Avvia in sviluppo

```bash
npx expo start
```

Poi scansiona il QR code con **Expo Go** (scaricalo dall'App Store / Play Store).

## Build APK Android (test)

```bash
npx eas build --platform android --profile preview
```

## Build per store

```bash
# Android Play Store
npx eas build --platform android --profile production

# iOS App Store
npx eas build --platform ios --profile production
```

## Struttura

```
mobile/
├── App.tsx                    # Entry point
├── src/
│   ├── lib/
│   │   ├── api.ts             # Client API Axios
│   │   └── AuthContext.tsx    # Autenticazione con SecureStore
│   ├── navigation/            # React Navigation
│   ├── screens/
│   │   ├── auth/              # Login
│   │   ├── parent/            # Schermate genitori
│   │   ├── teacher/           # Schermate maestre
│   │   └── admin/             # Schermate admin
│   └── components/            # Componenti riutilizzabili
```
