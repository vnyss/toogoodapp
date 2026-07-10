const { app, BrowserWindow, shell, protocol, session, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

const isDev = process.env.NODE_ENV === 'development';

// Must run before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true },
  },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/truetype',
  '.map':  'application/json',
  '.txt':  'text/plain',
};

function createWindow() {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#000000',
    title: 'Too Good',
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL('http://localhost:8081');
  } else {
    win.loadURL('app://localhost/');
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    // Allow blob: URLs to open in a new Electron window (PDF print dialog)
    if (url.startsWith('blob:')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Auto-update (production only)
  if (!isDev) {
    setupAutoUpdater(win);
  }

  return win;
}

function setupAutoUpdater(win) {
  let autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (e) {
    dialog.showMessageBox(win, {
      type: 'error',
      title: 'Updater missing',
      message: 'electron-updater could not be loaded: ' + e.message,
    }).catch(() => {});
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Available — Too Good',
      message: `Version ${info.version} is available.`,
      detail: 'Downloading in the background. You will be notified when it is ready.',
      buttons: ['OK'],
    }).catch(() => {});
  });

  autoUpdater.on('update-not-available', () => {
    // Silently ignore — already on latest
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready — Too Good',
      message: 'A new version has been downloaded.',
      detail: 'Restart Too Good now to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(false, true);
    }).catch(() => {});
  });

  // Fail silently — network issues, firewalls etc. are not actionable by the user
  autoUpdater.on('error', () => {});

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);
}

app.whenReady().then(() => {
  // Grant camera/microphone permission automatically — needed for barcode scanner
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allow = ['media', 'camera', 'microphone', 'display-capture', 'notifications'];
    callback(allow.includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    const allow = ['media', 'camera', 'microphone', 'display-capture', 'notifications'];
    return allow.includes(permission);
  });

  const distPath = path.join(__dirname, '../dist');

  // Serve the Expo web build via a custom protocol.
  // Expo outputs absolute asset paths like /_expo/static/... which break
  // under file:// (resolves to filesystem root). This handler maps every
  // request to the dist/ folder, making all paths work correctly.
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = (pathname === '/' || pathname === '') ? '/index.html' : pathname;
    let filePath = path.join(distPath, rel);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distPath, 'index.html');
    }

    try {
      const data = fs.readFileSync(filePath);
      const ext  = path.extname(filePath).toLowerCase();
      return new Response(data, {
        status: 200,
        headers: { 'content-type': MIME[ext] || 'application/octet-stream' },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
