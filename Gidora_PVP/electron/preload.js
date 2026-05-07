const { contextBridge, ipcRenderer } = require('electron');

let latestSnapshot = [];
let latestStatus = {
    source: 'browser-fallback',
    enabled: false,
    connectedCount: 0,
    deviceLabels: [],
    lastError: null
};

function setLatestSnapshot(snapshot) {
    latestSnapshot = Array.isArray(snapshot) ? snapshot : [];
}

function setLatestStatus(status) {
    if (status && typeof status === 'object') latestStatus = status;
}

ipcRenderer.on('gamepad:snapshot', (_event, snapshot) => {
    setLatestSnapshot(snapshot);
});
ipcRenderer.on('gamepad:status', (_event, status) => {
    setLatestStatus(status);
});

ipcRenderer.invoke('gamepad:snapshot')
    .then(setLatestSnapshot)
    .catch(error => {
        console.warn('[gamepad] Failed to load initial native snapshot.', error);
    });
ipcRenderer.invoke('gamepad:status')
    .then(setLatestStatus)
    .catch(error => {
        console.warn('[gamepad] Failed to load initial native status.', error);
    });

contextBridge.exposeInMainWorld('nativeGamepads', {
    snapshot: () => latestSnapshot,
    status: () => latestStatus
});
