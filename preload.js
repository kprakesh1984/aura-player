const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // File Operations
  openFiles: () => ipcRenderer.invoke("dialog:openFiles"),

  // Playlist Context Menu
  showPlaylistContextMenu: (trackIndex, selectedIndices) =>
    ipcRenderer.send("show-playlist-context-menu", trackIndex, selectedIndices),
  onContextMenuCommand: (callback) =>
    ipcRenderer.on("context-menu-command", (_event, command, data) =>
      callback(command, data)
    ),

  // Window Management and Playlist State Persistence
  resizeMainWindowAndSaveVisibility: (width, heightOption, isPlaylistVisible) =>
    ipcRenderer.send(
      "set-main-window-size-and-visibility",
      width,
      heightOption,
      isPlaylistVisible
    ),
  onSetInitialPlaylistVisibility: (callback) =>
    ipcRenderer.on("set-initial-playlist-visibility", (_event, isVisible) =>
      callback(isVisible)
    ),

  // Volume State Persistence
  saveVolume: (volume) => ipcRenderer.send("save-volume-state", volume),
  onSetInitialVolume: (callback) =>
    ipcRenderer.on("set-initial-volume", (_event, volume) => callback(volume)),

  // File Association Opening
  onOpenFileInPlayer: (callback) =>
    ipcRenderer.on("open-file-in-player", (_event, filePath) =>
      callback(filePath)
    ),
});
