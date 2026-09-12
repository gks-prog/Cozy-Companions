const { app, BrowserWindow, Menu, Tray, ipcMain, screen, nativeImage, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');

const WINDOW_SIZE = 320;
const PET_SIZE = 238;
let petWindow;
let tray;
let globalHook;
let cursorTimer;
let lastTypingPulse = 0;
let lastCursorPoint;
let saveTimer;
let settings = {};

const PETS = new Set(['puppy', 'kitten']);
const COATS = new Set(['brown', 'golden', 'cocoa', 'ash', 'cream']);

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    petWindow?.showInactive();
    petWindow?.webContents.send('wake-up');
  });
}

const defaults = {
  pet: null,
  petName: '',
  coat: 'brown',
  affection: 50,
  energy: 100,
  reactionsPaused: false,
  launchAtLogin: true,
  windowPosition: null
};

function settingsPath() {
  return path.join(app.getPath('userData'), 'pet-memory.json');
}

function loadSettings() {
  try {
    settings = { ...defaults, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) };
  } catch {
    settings = { ...defaults };
  }
  settings.pet = PETS.has(settings.pet) ? settings.pet : null;
  settings.petName = sanitizeName(settings.petName, settings.pet);
  settings.coat = COATS.has(settings.coat) ? settings.coat : 'brown';
  settings.affection = Math.max(0, Math.min(100, Number(settings.affection) || 50));
}

function saveSettings() {
  try {
    const target = settingsPath();
    const temporary = `${target}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(settings, null, 2));
    fs.renameSync(temporary, target);
  } catch (error) {
    console.error('Could not save pet memory:', error.message);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSettings, 250);
}

function sanitizeName(value, petType = settings.pet) {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 18);
  if (cleaned) return cleaned;
  return petType === 'kitten' ? 'Mochi' : petType === 'puppy' ? 'Milo' : '';
}

function safeInitialPosition() {
  if (settings.windowPosition) {
    const point = { x: settings.windowPosition.x + 20, y: settings.windowPosition.y + 20 };
    const display = screen.getDisplayNearestPoint(point);
    const area = display.workArea;
    if (point.x >= area.x && point.x < area.x + area.width && point.y >= area.y && point.y < area.y + area.height) {
      return settings.windowPosition;
    }
  }
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: area.x + area.width - WINDOW_SIZE - 24,
    y: area.y + area.height - WINDOW_SIZE - 12
  };
}

function clampToDisplays(x, y) {
  const center = { x: x + WINDOW_SIZE / 2, y: y + WINDOW_SIZE / 2 };
  const area = screen.getDisplayNearestPoint(center).workArea;
  return {
    x: Math.max(area.x - WINDOW_SIZE + 54, Math.min(x, area.x + area.width - 54)),
    y: Math.max(area.y - WINDOW_SIZE + 54, Math.min(y, area.y + area.height - 54))
  };
}

function createWindow() {
  const position = safeInitialPosition();
  petWindow = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    x: position.x,
    y: position.y,
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  petWindow.setAlwaysOnTop(true, 'floating');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  petWindow.loadFile(path.join(__dirname, 'index.html'));
  petWindow.once('ready-to-show', () => petWindow.showInactive());
  petWindow.on('moved', rememberPosition);
  petWindow.on('closed', () => { petWindow = null; });

  cursorTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const point = screen.getCursorScreenPoint();
    if (lastCursorPoint && point.x === lastCursorPoint.x && point.y === lastCursorPoint.y) return;
    lastCursorPoint = point;
    const bounds = petWindow.getBounds();
    petWindow.webContents.send('cursor-position', {
      x: point.x - bounds.x,
      y: point.y - bounds.y,
      screenX: point.x,
      screenY: point.y
    });
  }, 34);
}

function rememberPosition() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const bounds = petWindow.getBounds();
  settings.windowPosition = { x: bounds.x, y: bounds.y };
  scheduleSave();
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png')).resize({ width: 20, height: 20 });
  tray = new Tray(icon);
  tray.setToolTip(settings.petName ? `${settings.petName} · Cozy Companions` : 'Cozy Companions');
  refreshTrayMenu();
  tray.on('double-click', () => petWindow?.webContents.send('open-selector'));
}

function refreshTrayMenu() {
  const menu = Menu.buildFromTemplate([
    { label: settings.petName ? `${settings.petName} · ${settings.affection}% bond` : 'Choose your companion', enabled: false },
    {
      label: 'Puppy', type: 'radio', checked: settings.pet === 'puppy',
      click: () => choosePet('puppy')
    },
    {
      label: 'Kitten', type: 'radio', checked: settings.pet === 'kitten',
      click: () => choosePet('kitten')
    },
    { type: 'separator' },
    { label: 'Customize name & coat…', click: () => petWindow?.webContents.send('open-settings') },
    {
      label: 'Coat colour',
      submenu: [
        ['brown', 'White & brown'], ['golden', 'White & golden'], ['cocoa', 'White & cocoa'],
        ['ash', 'White & ash'], ['cream', 'Cream & caramel']
      ].map(([value, label]) => ({
        label, type: 'radio', checked: settings.coat === value,
        click: () => updateProfile({ coat: value })
      }))
    },
    { type: 'separator' },
    {
      label: 'Pause reactions', type: 'checkbox', checked: settings.reactionsPaused,
      click: item => {
        settings.reactionsPaused = item.checked;
        saveSettings();
        petWindow?.webContents.send('settings-changed', settings);
      }
    },
    {
      label: 'Start with Windows', type: 'checkbox', checked: settings.launchAtLogin,
      click: item => {
        settings.launchAtLogin = item.checked;
        app.setLoginItemSettings({ openAtLogin: item.checked });
        saveSettings();
      }
    },
    { label: 'Show pet chooser', click: () => petWindow?.webContents.send('open-selector') },
    {
      label: 'Reset affection', click: () => {
        settings.affection = 50;
        saveSettings();
        petWindow?.webContents.send('settings-changed', settings);
      }
    },
    { type: 'separator' },
    { label: 'Quit Cozy Companions', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
}

function choosePet(pet) {
  settings.pet = pet;
  settings.petName = sanitizeName(settings.petName, pet);
  saveSettings();
  refreshTrayMenu();
  tray?.setToolTip(`${settings.petName} · Cozy Companions`);
  petWindow?.webContents.send('pet-selected', { ...settings });
}

function updateProfile(next = {}) {
  if (PETS.has(next.pet)) settings.pet = next.pet;
  if (Object.hasOwn(next, 'petName')) settings.petName = sanitizeName(next.petName, settings.pet);
  if (COATS.has(next.coat)) settings.coat = next.coat;
  if (typeof next.reactionsPaused === 'boolean') settings.reactionsPaused = next.reactionsPaused;
  if (typeof next.launchAtLogin === 'boolean') {
    settings.launchAtLogin = next.launchAtLogin;
    app.setLoginItemSettings({ openAtLogin: next.launchAtLogin });
  }
  saveSettings();
  refreshTrayMenu();
  tray?.setToolTip(`${settings.petName} · Cozy Companions`);
  petWindow?.webContents.send('settings-changed', { ...settings });
  return { ...settings };
}

function startGlobalInput() {
  try {
    const { uIOhook } = require('uiohook-napi');
    globalHook = uIOhook;
    globalHook.on('keydown', () => {
      if (settings.reactionsPaused || !petWindow || petWindow.isDestroyed()) return;
      const now = Date.now();
      if (now - lastTypingPulse >= 75) {
        lastTypingPulse = now;
        petWindow.webContents.send('typing-pulse');
      }
      // Deliberately discard the key code. Only anonymous activity is used.
    });
    globalHook.start();
  } catch (error) {
    console.warn('Global typing reactions unavailable:', error.message);
  }

  powerMonitor.on('resume', () => petWindow?.webContents.send('wake-up'));
  powerMonitor.on('unlock-screen', () => petWindow?.webContents.send('wake-up'));
}

ipcMain.handle('get-settings', () => ({ ...settings, petSize: PET_SIZE }));
ipcMain.on('select-pet', (_event, pet) => {
  if (pet === 'puppy' || pet === 'kitten') choosePet(pet);
});
ipcMain.handle('update-profile', (_event, next) => updateProfile(next));
ipcMain.on('set-click-through', (_event, value) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.setIgnoreMouseEvents(Boolean(value), { forward: true });
});
ipcMain.on('move-window', (_event, position) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const next = clampToDisplays(Math.round(position.x), Math.round(position.y));
  petWindow.setPosition(next.x, next.y, false);
});
ipcMain.on('affection', (_event, delta) => {
  settings.affection = Math.max(0, Math.min(100, settings.affection + Number(delta || 0)));
  saveSettings();
  refreshTrayMenu();
});
ipcMain.on('show-menu', () => tray?.popUpContextMenu());

if (hasSingleInstanceLock) {
  app.whenReady().then(() => {
    loadSettings();
    createWindow();
    createTray();
    startGlobalInput();
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  });
}

// Keeping a listener registered prevents Windows from quitting when the pet
// window is temporarily recreated; the tray remains the application's owner.
app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  if (cursorTimer) clearInterval(cursorTimer);
  if (saveTimer) clearTimeout(saveTimer);
  try { globalHook?.stop(); } catch {}
  saveSettings();
});

app.on('activate', () => {
  if (!petWindow) createWindow();
});
