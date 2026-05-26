const { app, BrowserWindow, Menu, shell, nativeImage } = require('electron');
const path = require('path');

// URL della webapp (stessa backend, stessa API)
const APP_URL = 'https://girogirotondowebapp.it';

// Dimensioni finestra — simula tablet/mobile in formato portrait
const WIN_WIDTH  = 420;
const WIN_HEIGHT = 820;

let mainWindow;

function createWindow() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));

  mainWindow = new BrowserWindow({
    width:  WIN_WIDTH,
    height: WIN_HEIGHT,
    minWidth:  380,
    minHeight: 700,
    maxWidth:  520,
    title: 'Girogirotondo',
    icon,
    backgroundColor: '#FFFDD0',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      // Emula user-agent mobile per una migliore esperienza
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 GirogirotondoDesktop/1.0',
    },
    // Centro la finestra nello schermo
    center: true,
    resizable: true,
    fullscreenable: true,
    // Aspetto nativo
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
  });

  // Carica la webapp
  mainWindow.loadURL(APP_URL);

  // Apri link esterni nel browser di sistema, non in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Menu semplice
  const menu = Menu.buildFromTemplate([
    {
      label: 'Girogirotondo',
      submenu: [
        { label: 'Ricarica',  accelerator: 'CmdOrCtrl+R',   click: () => mainWindow.reload() },
        { label: 'Home',      accelerator: 'CmdOrCtrl+H',   click: () => mainWindow.loadURL(APP_URL) },
        { type: 'separator' },
        { label: 'Esci',      accelerator: 'CmdOrCtrl+Q',   role: 'quit' },
      ],
    },
    {
      label: 'Visualizza',
      submenu: [
        { label: 'Schermo intero',  accelerator: 'F11',            role: 'togglefullscreen' },
        { label: 'Zoom +',          accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom -',          accelerator: 'CmdOrCtrl+-',    role: 'zoomOut' },
        { label: 'Zoom normale',    accelerator: 'CmdOrCtrl+0',    role: 'resetZoom' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Impedisce apertura di più istanze
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
