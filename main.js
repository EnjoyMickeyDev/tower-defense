const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Настройка логирования
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;

// Путь к игре
function getGamePath() {
  const resourcesPath = process.resourcesPath || path.join(__dirname);
  
  // В режиме разработки
  if (!app.isPackaged) {
    return path.join(__dirname, 'game');
  }
  
  // В собранном приложении
  return path.join(resourcesPath, 'game');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // Открыть DevTools в режиме разработки
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

// Запуск игры
function launchGame() {
  const gamePath = getGamePath();
  
  // Определяем исполняемый файл в зависимости от платформы
  let executable;
  if (process.platform === 'win32') {
    executable = path.join(gamePath, 'TowerDefense.exe');
  } else if (process.platform === 'darwin') {
    executable = path.join(gamePath, 'TowerDefense.app', 'Contents', 'MacOS', 'TowerDefense');
  } else {
    executable = path.join(gamePath, 'TowerDefense.x86_64');
  }

  log.info('Запуск игры:', executable);

  if (!fs.existsSync(executable)) {
    log.error('Игра не найдена:', executable);
    mainWindow.webContents.send('game-error', 'Файл игры не найден. Попробуйте переустановить.');
    return;
  }

  const gameProcess = spawn(executable, [], {
    cwd: gamePath,
    detached: true,
    stdio: 'ignore'
  });

  gameProcess.unref();
  
  // Закрываем лаунчер после запуска игры
  setTimeout(() => {
    app.quit();
  }, 1000);
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
  log.info('Обновлений нет, текущая версия актуальна');
  sendToRenderer('update-status', { 
    status: 'not-available', 
    message: 'У вас последняя версия',
    version: app.getVersion()
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  log.info(`Загрузка: ${percent}%`);
  sendToRenderer('update-status', { 
    status: 'downloading', 
    message: `Загрузка обновления: ${percent}%`,
    progress: percent
  });
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Обновление загружено:', info.version);
  sendToRenderer('update-status', { 
    status: 'downloaded', 
    message: 'Обновление готово к установке',
    version: info.version
  });
});

autoUpdater.on('error', (error) => {
  log.error('Ошибка автообновления:', error);
  sendToRenderer('update-status', { 
    status: 'error', 
    message: 'Ошибка проверки обновлений'
  });
});

function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

// ==================== IPC HANDLERS ====================

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-updates', async () => {
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (error) {
    log.error('Ошибка проверки обновлений:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('launch-game', () => {
  launchGame();
});

ipcMain.handle('close-app', () => {
  app.quit();
});

ipcMain.handle('minimize-app', () => {
  mainWindow.minimize();
});

// ==================== APP LIFECYCLE ====================

app.whenReady().then(() => {
  createWindow();
  
  // Проверяем обновления при запуске
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 2000);
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
