const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let gamepadBridge = null;
let latestGamepadSnapshot = [];
let latestGamepadStatus = {
    source: 'browser-fallback',
    enabled: false,
    connectedCount: 0,
    deviceLabels: [],
    lastError: null
};
let lastLoggedDeviceSignature = '';

function writeGamepadLog(message, extra = null) {
    const line = [
        new Date().toISOString(),
        message,
        extra ? JSON.stringify(extra) : ''
    ].filter(Boolean).join(' ');
    console.log(line);

    try {
        const logPath = path.join(app.getPath('userData'), 'gamepad-bridge.log');
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.appendFileSync(logPath, `${line}\n`);
    } catch (error) {
        console.warn('[gamepad] Failed to write log file.', error);
    }
}

function broadcastGamepads(snapshot) {
    latestGamepadSnapshot = Array.isArray(snapshot) ? snapshot : [];
    const connected = latestGamepadSnapshot.filter(gp => gp && gp.connected !== false);
    latestGamepadStatus = {
        source: connected.length > 0 ? 'sdl-native' : 'browser-fallback',
        enabled: !!gamepadBridge,
        connectedCount: connected.length,
        deviceLabels: connected.map(gp => gp.label || gp.id || `Gamepad ${gp.index + 1}`),
        lastError: null
    };

    const signature = `${latestGamepadStatus.connectedCount}:${latestGamepadStatus.deviceLabels.join('|')}`;
    if (signature !== lastLoggedDeviceSignature) {
        lastLoggedDeviceSignature = signature;
        writeGamepadLog('[gamepad] Snapshot updated.', latestGamepadStatus);
    }

    BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('gamepad:snapshot', latestGamepadSnapshot);
            win.webContents.send('gamepad:status', latestGamepadStatus);
        }
    });
}

function startGamepadBridge() {
    if (process.argv.includes('--no-gamepad-bridge')) {
        latestGamepadStatus = {
            source: 'browser-fallback',
            enabled: false,
            connectedCount: 0,
            deviceLabels: [],
            lastError: '--no-gamepad-bridge'
        };
        writeGamepadLog('[gamepad] SDL bridge disabled by --no-gamepad-bridge.');
        return;
    }

    try {
        const { createGamepadBridge } = require('./gamepad-bridge');
        writeGamepadLog('[gamepad] Starting SDL bridge.', {
            appPath: app.getAppPath(),
            resourcesPath: process.resourcesPath,
            arch: process.arch,
            electron: process.versions.electron,
            node: process.versions.node
        });
        gamepadBridge = createGamepadBridge({
            mappingsPath: path.join(__dirname, 'gamecontrollerdb.txt'),
            onSnapshot: broadcastGamepads,
            pollIntervalMs: 16,
            logger: {
                info: (message, extra) => writeGamepadLog(message, extra),
                warn: (message, extra) => writeGamepadLog(message, extra),
                error: (message, extra) => writeGamepadLog(message, extra)
            }
        });
        gamepadBridge.start();
        broadcastGamepads(gamepadBridge.snapshot());
    } catch (error) {
        latestGamepadStatus = {
            source: 'browser-fallback',
            enabled: false,
            connectedCount: 0,
            deviceLabels: [],
            lastError: error && error.stack ? error.stack : String(error)
        };
        writeGamepadLog('[gamepad] Failed to start SDL bridge. Falling back to Browser Gamepad API.', {
            error: latestGamepadStatus.lastError
        });
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
        mainWindow.webContents.send('gamepad:status', latestGamepadStatus);
        if (process.env.GIDORA_ELECTRON_SMOKE_TEST === '1') {
            setTimeout(() => app.quit(), 500);
        }
    });
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
}

ipcMain.handle('gamepad:snapshot', () => latestGamepadSnapshot);
ipcMain.handle('gamepad:status', () => latestGamepadStatus);

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
