const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let gamepadBridge = null;
let latestGamepadSnapshot = [];

function broadcastGamepads(snapshot) {
    latestGamepadSnapshot = Array.isArray(snapshot) ? snapshot : [];
    BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('gamepad:snapshot', latestGamepadSnapshot);
        }
    });
}

function startGamepadBridge() {
    if (process.argv.includes('--no-gamepad-bridge')) {
        console.warn('[gamepad] SDL bridge disabled by --no-gamepad-bridge.');
        return;
    }

    try {
        const { createGamepadBridge } = require('./gamepad-bridge');
        gamepadBridge = createGamepadBridge({
            mappingsPath: path.join(__dirname, 'gamecontrollerdb.txt'),
            onSnapshot: broadcastGamepads,
            pollIntervalMs: 16
        });
        gamepadBridge.start();
        broadcastGamepads(gamepadBridge.snapshot());
    } catch (error) {
        console.error('[gamepad] Failed to start SDL bridge. Falling back to Browser Gamepad API.', error);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        backgroundColor: '#000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('gamepad:snapshot', latestGamepadSnapshot);
        if (process.env.GIDORA_ELECTRON_SMOKE_TEST === '1') {
            setTimeout(() => app.quit(), 500);
        }
    });
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
}

ipcMain.handle('gamepad:snapshot', () => latestGamepadSnapshot);

app.whenReady().then(() => {
    startGamepadBridge();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('before-quit', () => {
    if (gamepadBridge) gamepadBridge.stop();
});

app.on('window-all-closed', () => {
    app.quit();
});
