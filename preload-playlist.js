const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('playlistAPI', {
    // Receive initial data and updates
    onInitializePlaylist: (callback) => ipcRenderer.on('initialize-playlist', (_event, ...args) => callback(...args)),
    onUpdatePlaylistData: (callback) => ipcRenderer.on('update-playlist-data', (_event, ...args) => callback(...args)),

    // Send actions to main process (which will relay to main player window)
    sendActionToMain: (action, data) => ipcRenderer.send('playlist-action', action, data), // Generic action dispatcher

    // Context Menu
    showContextMenu: (trackIndex, selectedIndices) => ipcRenderer.send('show-playlist-context-menu', trackIndex, selectedIndices),
    onContextMenuCommand: (callback) => ipcRenderer.on('context-menu-command', (_event, ...args) => callback(...args)),

    // Sync actions from main player
    onSyncPlaylistAction: (callback) => ipcRenderer.on('sync-playlist-action', (_event, ...args) => callback(...args)),

    // File operations (if detached playlist can add files)
    openFiles: () => ipcRenderer.invoke('dialog:openFiles'), // Use the same main process handler

    // If detached playlist needs to inform main it's closing (though 'closed' event on BrowserWindow is primary)
    // notifyClose: () => ipcRenderer.send('playlist-window-is-closing'),
});