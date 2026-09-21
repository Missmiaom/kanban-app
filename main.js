'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

const STORE_COLUMNS = ['Backlog', 'Todo', 'In Progress', 'In Review', 'Done'];

// Data file lives in the user's app data directory so state survives restarts.
let dataFile = null;

function ensureDataFile() {
  if (dataFile) return dataFile;
  const dir = app.getPath('userData');
  const fs = require('fs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  dataFile = path.join(dir, 'kanban-data.json');
  return dataFile;
}

function readData() {
  const fs = require('fs');
  const file = ensureDataFile();
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (parsed && Array.isArray(parsed.tasks)) return parsed;
    } catch (err) {
      console.error('Failed to parse kanban data, starting fresh.', err);
    }
  }
  return { tasks: [], nextId: 1 };
}

function writeData(data) {
  const fs = require('fs');
  const file = ensureDataFile();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Kanban',
    backgroundColor: '#f4f5f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// Storage IPC handlers
ipcMain.handle('store:load', () => readData());
ipcMain.handle('store:save', (_evt, data) => {
  writeData(data);
  return true;
});
ipcMain.handle('store:columns', () => STORE_COLUMNS);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});