const { contextBridge, ipcRenderer } = require('electron');

let latestSnapshot = [];

function setLatestSnapshot(snapshot) {
    latestSnapshot = Array.isArray(snapshot) ? snapshot : [];
}

ipcRenderer.on('gamepad:snapshot', (_event, snapshot) => {
    setLatestSnapshot(snapshot);
});

ipcRenderer.invoke('gamepad:snapshot')
    .then(setLatestSnapshot)
    .catch(error => {
        console.warn('[gamepad] Failed to load initial native snapshot.', error);
    });

contextBridge.exposeInMainWorld('nativeGamepads', {
    snapshot: () => latestSnapshot
});
