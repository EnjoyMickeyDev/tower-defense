const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  // Получение версии
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Обновления
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  // Игра
  launchGame: () => ipcRenderer.invoke('launch-game'),
  
  // Окно
  closeApp: () => ipcRenderer.invoke('close-app'),
  minimizeApp: () => ipcRenderer.invoke('minimize-app'),
  
  // Подписка на события
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },
  
  onGameError: (callback) => {
    ipcRenderer.on('game-error', (event, message) => callback(message));
  }
});
