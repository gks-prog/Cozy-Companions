const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateProfile: profile => ipcRenderer.invoke('update-profile', profile),
  selectPet: pet => ipcRenderer.send('select-pet', pet),
  setClickThrough: value => ipcRenderer.send('set-click-through', value),
  moveWindow: position => ipcRenderer.send('move-window', position),
  addAffection: amount => ipcRenderer.send('affection', amount),
  showMenu: () => ipcRenderer.send('show-menu'),
  onCursor: callback => ipcRenderer.on('cursor-position', (_event, value) => callback(value)),
  onTyping: callback => ipcRenderer.on('typing-pulse', callback),
  onWake: callback => ipcRenderer.on('wake-up', callback),
  onSelectPet: callback => ipcRenderer.on('pet-selected', (_event, value) => callback(value)),
  onOpenSelector: callback => ipcRenderer.on('open-selector', callback),
  onOpenSettings: callback => ipcRenderer.on('open-settings', callback),
  onSettings: callback => ipcRenderer.on('settings-changed', (_event, value) => callback(value))
});
