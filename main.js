const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');

// Настройка логирования
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    frame: false,
    backgroundColor: '#0d47a1',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

// ==================== AUTO UPDATER ====================

autoUpdater.on('checking-for-update', () => {
  log.info('Проверка обновлений...');
  sendToRenderer('update-status', { status: 'checking', message: 'Проверка обновлений...' });
});

autoUpdater.on('update-available', (info) => {
  log.info('Доступно обновление:', info.version);
  sendToRenderer('update-status', { 
    status: 'available', 
    message: `Доступна версия ${info.version}`,
    version: info.version
  });
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Обновлений нет');
  sendToRenderer('update-status', { 
    status: 'not-available', 
    message: 'У вас последняя версия',
    version: app.getVersion()
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  sendToRenderer('update-status', { 
    status: 'downloading', 
    message: `Загрузка: ${percent}%`,
    progress: percent
  });
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Обновление загружено');
  sendToRenderer('update-status', { 
    status: 'downloaded', 
    message: 'Обновление готово',
    version: info.version
  });
});

autoUpdater.on('error', (error) => {
  log.error('Ошибка автообновления:', error);
  sendToRenderer('update-status', { 
    status: 'error', 
    message: 'Ошибка обновления'
  });
});

function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

// ==================== IPC HANDLERS ====================

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('check-updates', async () => {
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle('install-update', () => autoUpdater.quitAndInstall(false, true));
ipcMain.handle('close-app', () => app.quit());
ipcMain.handle('minimize-app', () => mainWindow.minimize());
ipcMain.handle('maximize-app', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

// ==================== DISCORD OAUTH ====================

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('tower-defense', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('tower-defense');
}

let discordResolve = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith('tower-defense://'));
    if (url) handleDiscordCallback(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function handleDiscordCallback(url) {
  try {
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const error = urlObj.searchParams.get('error');
    
    if (discordResolve) {
      if (error || !code) {
        discordResolve({ success: false, error: 'Авторизация отменена' });
      } else {
        fetch(`http://103.137.251.209/api/auth/discord/token?code=${code}`)
          .then(r => r.json())
          .then(data => {
            discordResolve(data);
            discordResolve = null;
          })
          .catch(() => {
            discordResolve({ success: false, error: 'Ошибка авторизации' });
            discordResolve = null;
          });
        return;
      }
      discordResolve = null;
    }
  } catch (e) {
    log.error('Discord callback error:', e);
  }
}

ipcMain.handle('discord-login', async () => {
  return new Promise((resolve) => {
    discordResolve = resolve;
    shell.openExternal('http://103.137.251.209/api/auth/discord?app=1');
    setTimeout(() => {
      if (discordResolve) {
        discordResolve({ success: false, error: 'Время истекло' });
        discordResolve = null;
      }
    }, 300000);
  });
});

// ==================== APP LIFECYCLE ====================

app.whenReady().then(() => {
  createWindow();
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  }
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
