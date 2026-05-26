# Girogirotondo Desktop

App Electron per Windows, Mac e Linux.

## Setup sviluppo

```bash
cd desktop
npm install
npm start          # avvia in sviluppo
```

## Build installer

```bash
npm install

# Windows → genera .exe installer in dist-electron/
npm run build:win

# Mac → genera .dmg in dist-electron/
npm run build:mac

# Linux → genera .AppImage e .deb in dist-electron/
npm run build:linux

# Tutte le piattaforme
npm run build:all
```

## Icone richieste (da generare)

- `icon.png`  → 512×512 PNG (Linux + generatore automatico)
- `icon.ico`  → Windows (auto-generato da electron-builder)
- `icon.icns` → macOS (auto-generato da electron-builder)

Copia il file `assets/icon.png` dalla cartella mobile:
```bash
cp ../mobile/assets/icon.png ./icon.png
```

## Distribuzione

### Windows
Il file `dist-electron/Girogirotondo Setup 1.0.0.exe` è l'installer.
Gli utenti lo scaricano, lo eseguono, e l'app appare nel menu Start.

### Mac
Il file `dist-electron/Girogirotondo-1.0.0.dmg` è il pacchetto.
Gli utenti aprono il DMG e trascinano l'icona in Applicazioni.

### Linux
Il file `dist-electron/Girogirotondo-1.0.0.AppImage` è eseguibile direttamente.
