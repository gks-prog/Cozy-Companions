const { app, BrowserWindow, Menu, Tray, ipcMain, screen, nativeImage, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');

const WINDOW_SIZE = 320;
const PET_SIZE = 190;
let petWindow;
let tray;
let globalHook;
let cursorTimer;
let lastTypingPulse = 0;
let lastCursorPoint;
let saveTimer;
let focusTimer;
let waterTimer;
let stretchTimer;
let typingSide = 'right';
let settings = {};

const PETS = new Set(['puppy', 'kitten']);
const STYLES = new Set(['pixel', 'classic']);
const PATTERNS = new Set(['mask', 'tuxedo', 'socks', 'spots', 'calico', 'tabby', 'solid']);

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
  style: 'pixel',
  pattern: 'mask',
  baseColor: '#f4eadb',
  patchColor: '#9b6548',
  eyeColor: '#d89b35',
  affection: 50,
  energy: 100,
  reactionsPaused: false,
  waterReminders: false,
  stretchReminders: false,
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
  const legacyPatches = { brown:'#9b6548', golden:'#d4943d', cocoa:'#594039', ash:'#888987', cream:'#d3ad82' };
  if (!settings.patchColor && settings.coat) settings.patchColor = legacyPatches[settings.coat];
  settings.style = STYLES.has(settings.style) ? settings.style : 'pixel';
  settings.pattern = PATTERNS.has(settings.pattern) ? settings.pattern : 'mask';
  settings.baseColor = sanitizeHex(settings.baseColor, '#f4eadb');
  settings.patchColor = sanitizeHex(settings.patchColor, '#9b6548');
  settings.eyeColor = sanitizeHex(settings.eyeColor, '#d89b35');
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

function sanitizeHex(value, fallback) {
  const text = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
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
    { label: 'Customize pet…', click: () => petWindow?.webContents.send('open-settings') },
    {
      label: 'Pattern',
      submenu: [
        ['mask','Face mask'], ['tuxedo','Tuxedo'], ['socks','Socks'],
        ['spots','Spots'], ['calico','Calico'], ['tabby','Tabby'], ['solid','Solid']
      ].map(([value, label]) => ({
        label, type: 'radio', checked: settings.pattern === value,
        click: () => updateProfile({ pattern: value, style: 'pixel' })
      }))
    },
    {
      label: 'Art style',
      submenu: [
        { label:'Pixel', type:'radio', checked:settings.style === 'pixel', click:() => updateProfile({ style:'pixel' }) },
        { label:'Classic', type:'radio', checked:settings.style === 'classic', click:() => updateProfile({ style:'classic' }) }
      ]
    },
    { type: 'separator' },
    { label: 'Start 25-minute focus', click: startFocusSession },
    {
      label: 'Water reminders (45 min)', type: 'checkbox', checked: settings.waterReminders,
      click: item => updateProfile({ waterReminders: item.checked })
    },
    {
      label: 'Stretch reminders (60 min)', type: 'checkbox', checked: settings.stretchReminders,
      click: item => updateProfile({ stretchReminders: item.checked })
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
  if (STYLES.has(next.style)) settings.style = next.style;
  if (PATTERNS.has(next.pattern)) settings.pattern = next.pattern;
  if (Object.hasOwn(next, 'baseColor')) settings.baseColor = sanitizeHex(next.baseColor, settings.baseColor);
  if (Object.hasOwn(next, 'patchColor')) settings.patchColor = sanitizeHex(next.patchColor, settings.patchColor);
  if (Object.hasOwn(next, 'eyeColor')) settings.eyeColor = sanitizeHex(next.eyeColor, settings.eyeColor);
  if (typeof next.reactionsPaused === 'boolean') settings.reactionsPaused = next.reactionsPaused;
  if (typeof next.waterReminders === 'boolean') settings.waterReminders = next.waterReminders;
  if (typeof next.stretchReminders === 'boolean') settings.stretchReminders = next.stretchReminders;
  if (typeof next.launchAtLogin === 'boolean') {
    settings.launchAtLogin = next.launchAtLogin;
    app.setLoginItemSettings({ openAtLogin: next.launchAtLogin });
  }
  saveSettings();
  refreshTrayMenu();
  tray?.setToolTip(`${settings.petName} · Cozy Companions`);
  petWindow?.webContents.send('settings-changed', { ...settings });
  refreshWellnessTimers();
  return { ...settings };
}

function sendReminder(kind) {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.webContents.send('wellness-reminder', kind);
}

function startFocusSession() {
  clearTimeout(focusTimer);
  petWindow?.webContents.send('wellness-reminder', 'Focus started — I’ll watch the clock!');
  focusTimer = setTimeout(() => sendReminder('focus'), 25 * 60 * 1000);
}

function refreshWellnessTimers() {
  clearInterval(waterTimer);
  clearInterval(stretchTimer);
  waterTimer = settings.waterReminders ? setInterval(() => sendReminder('water'), 45 * 60 * 1000) : null;
  stretchTimer = settings.stretchReminders ? setInterval(() => sendReminder('stretch'), 60 * 60 * 1000) : null;
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
        typingSide = typingSide === 'left' ? 'right' : 'left';
        petWindow.webContents.send('typing-pulse', { side: typingSide });
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
    refreshWellnessTimers();
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  });
}

// Keeping a listener registered prevents Windows from quitting when the pet
// window is temporarily recreated; the tray remains the application's owner.
app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  if (cursorTimer) clearInterval(cursorTimer);
  if (saveTimer) clearTimeout(saveTimer);
  if (focusTimer) clearTimeout(focusTimer);
  if (waterTimer) clearInterval(waterTimer);
  if (stretchTimer) clearInterval(stretchTimer);
  try { globalHook?.stop(); } catch {}
  saveSettings();
});

app.on('activate', () => {
  if (!petWindow) createWindow();
});
