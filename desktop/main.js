// Version Windows (Electron) : ouvre l'application web embarquée dans une fenêtre.
// Les fichiers sont servis par le protocole app:// pour que les modules JavaScript,
// IndexedDB et les envois vers Google fonctionnent comme dans un navigateur.

const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const WEB = path.join(__dirname, '..', 'web');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

// Une seule fenêtre à la fois, pour ne pas écrire deux fois dans la même base locale.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let fenetre;

function creerFenetre() {
  fenetre = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 360,
    minHeight: 500,
    title: 'FSH Terrain',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#f6f8f7',
    webPreferences: { contextIsolation: true, sandbox: true },
  });

  // Les liens vers Google Drive s'ouvrent dans le navigateur habituel.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  fenetre.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://')) {
      event.preventDefault();
      if (url.startsWith('https://')) shell.openExternal(url);
    }
  });

  fenetre.loadURL('app://fsh/index.html');
}

app.on('second-instance', () => {
  if (fenetre) {
    if (fenetre.isMinimized()) fenetre.restore();
    fenetre.focus();
  }
});

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const fichier = path.normalize(path.join(WEB, decodeURIComponent(pathname)));
    if (!fichier.startsWith(WEB + path.sep)) {
      return new Response('Accès refusé', { status: 403 });
    }
    return net.fetch(pathToFileURL(fichier).toString());
  });

  Menu.setApplicationMenu(null);
  creerFenetre();
});

app.on('window-all-closed', () => app.quit());
