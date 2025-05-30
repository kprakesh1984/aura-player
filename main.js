// main.js
const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const Store = require("electron-store");
const fs = require("fs");

const store = new Store({
  defaults: {
    playlistVisible: false,
    lastVolume: 1.0,
  },
});

let mainWindow;
let filesToOpenOnReady = [];

// Define constants for window dimensions and content heights
const ORIGINAL_MAIN_PLAYER_CONTENT_HEIGHT = 288; // Original height before adding more top padding
const EXTRA_TOP_PADDING_MAIN_PLAYER = 10; // The amount of extra padding added to .main-player in CSS

const MAIN_PLAYER_CONTENT_HEIGHT =
  ORIGINAL_MAIN_PLAYER_CONTENT_HEIGHT + EXTRA_TOP_PADDING_MAIN_PLAYER; // Now 298px
const DOCKED_PLAYLIST_AREA_HEIGHT = 250; // Height of the playlist area itself
const PLAYER_FIXED_WIDTH = 380;

function handleOpenFile(filePath) {
  console.log(`Main: handleOpenFile - START. Received path: "${filePath}"`);
  if (!filePath || typeof filePath !== "string") {
    console.warn("Main: handleOpenFile - Invalid or no filePath. Aborting.");
    return;
  }
  const supportedExtensions = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"];
  const fileExt = path.extname(filePath).toLowerCase();
  if (!supportedExtensions.includes(fileExt)) {
    console.log(
      `Main: Path "${filePath}" (ext: ${fileExt}) is not supported. Ignoring.`
    );
    return;
  }
  try {
    if (!fs.existsSync(filePath) || !fs.lstatSync(filePath).isFile()) {
      console.warn(
        `Main: Path "${filePath}" does not exist or is not a file. Ignoring.`
      );
      return;
    }
  } catch (err) {
    console.error(`Main: Error checking file status for "${filePath}":`, err);
    return;
  }

  if (
    mainWindow &&
    mainWindow.webContents &&
    !mainWindow.isDestroyed() &&
    !mainWindow.webContents.isDestroyed() &&
    !mainWindow.webContents.isLoading()
  ) {
    console.log(
      'Main: Sending "open-file-in-player" IPC directly for:',
      filePath
    );
    mainWindow.webContents.send("open-file-in-player", filePath);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    console.log(
      "Main: mainWindow not fully ready or webContents loading, queueing file:",
      filePath
    );
    if (!filesToOpenOnReady.includes(filePath))
      filesToOpenOnReady.push(filePath);
  }
  console.log(`Main: handleOpenFile - END for "${filePath}"`);
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log(
    "Main: Another instance detected. Quitting this new (secondary) instance."
  );
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    console.log("Main: 'second-instance' event. CommandLine:", commandLine);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    let filePath = null;
    for (let i = 1; i < commandLine.length; i++) {
      const arg = commandLine[i];
      if (!arg.startsWith("--") && arg !== ".") {
        const supportedExtensions = [
          ".mp3",
          ".m4a",
          ".aac",
          ".wav",
          ".ogg",
          ".flac",
        ];
        if (supportedExtensions.includes(path.extname(arg).toLowerCase())) {
          filePath = arg;
          break;
        }
      }
    }
    if (filePath) handleOpenFile(filePath);
    else
      console.warn("Main: second-instance - no valid audio file path found.");
  });

  app.whenReady().then(() => {
    console.log("Main: App is ready.");
    createMainWindow();
    app.on("open-file", (event, filePath) => {
      event.preventDefault();
      handleOpenFile(filePath);
    });
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

function createMainWindow() {
  console.log("Main: createMainWindow called.");
  const lastPlaylistVisibleState = store.get("playlistVisible");
  const lastVolumeState = store.get("lastVolume");
  let initialWindowHeight = MAIN_PLAYER_CONTENT_HEIGHT; // Use the updated constant
  if (lastPlaylistVisibleState === true) {
    initialWindowHeight += DOCKED_PLAYLIST_AREA_HEIGHT;
  }
  console.log(
    "Main: Initial playlist visible:",
    lastPlaylistVisibleState,
    "Initial window height:",
    initialWindowHeight
  );

  mainWindow = new BrowserWindow({
    width: PLAYER_FIXED_WIDTH,
    height: initialWindowHeight,
    resizable: false,
    minWidth: PLAYER_FIXED_WIDTH,
    maxWidth: PLAYER_FIXED_WIDTH,
    minHeight: initialWindowHeight,
    maxHeight: initialWindowHeight,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
    show: false,
    icon: path.join(__dirname, "assets", "icons", "icon.ico"),
  });

  mainWindow.loadFile("index.html");
  mainWindow.setMenu(null);

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Main: mainWindow 'did-finish-load'.");
    if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
      console.log(
        "Main (did-finish-load): Sending initial states. PlaylistVisible:",
        lastPlaylistVisibleState,
        "Volume:",
        lastVolumeState
      );
      mainWindow.webContents.send(
        "set-initial-playlist-visibility",
        lastPlaylistVisibleState
      );
      mainWindow.webContents.send("set-initial-volume", lastVolumeState);

      let filesToProcessNow = [...filesToOpenOnReady];
      filesToOpenOnReady = [];
      const args = process.defaultApp
        ? process.argv.slice(2)
        : process.argv.slice(1);
      const filePathFromArg = args.find((arg) => {
        if (!arg.startsWith("--") && arg !== ".") {
          const supportedExtensions = [
            ".mp3",
            ".m4a",
            ".aac",
            ".wav",
            ".ogg",
            ".flac",
          ];
          return supportedExtensions.includes(path.extname(arg).toLowerCase());
        }
        return false;
      });
      if (filePathFromArg) {
        if (!filesToProcessNow.includes(filePathFromArg))
          filesToProcessNow.push(filePathFromArg);
      }
      if (filesToProcessNow.length > 0) {
        filesToProcessNow.forEach((fp) => {
          const supportedExtensions = [
            ".mp3",
            ".m4a",
            ".aac",
            ".wav",
            ".ogg",
            ".flac",
          ];
          const fileExt = path.extname(fp).toLowerCase();
          let isValidFile = false;
          if (supportedExtensions.includes(fileExt)) {
            try {
              if (fs.existsSync(fp) && fs.lstatSync(fp).isFile())
                isValidFile = true;
              else
                console.warn(
                  `Main (did-finish-load): Path "${fp}" invalid. Not sending.`
                );
            } catch (err) {
              console.error(
                `Main (did-finish-load): Error checking "${fp}":`,
                err
              );
            }
          } else
            console.log(
              `Main (did-finish-load): Path "${fp}" (ext: ${fileExt}) not supported.`
            );
          if (isValidFile)
            mainWindow.webContents.send("open-file-in-player", fp);
        });
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  });

  mainWindow.once("ready-to-show", () => {
    console.log("Main: mainWindow 'ready-to-show'.");
    mainWindow.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// --- IPC Handlers ---
ipcMain.handle("dialog:openFiles", async () => {
  console.log("Main IPC: 'dialog:openFiles' called.");
  if (!mainWindow) {
    console.error("Main IPC Error: 'dialog:openFiles' - mainWindow undefined.");
    return [];
  }
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Audio Files",
          extensions: ["mp3", "m4a", "aac", "ogg", "wav", "flac"],
        },
      ],
    });
    if (canceled || !filePaths || filePaths.length === 0) return [];
    return filePaths;
  } catch (error) {
    console.error("Main IPC Error in showOpenDialog:", error);
    return [];
  }
});

ipcMain.handle("get-audio-metadata", async (event, filePath) => {
  try {
    const { parseFile } = await import("music-metadata");
    const metadata = await parseFile(filePath, { duration: true });
    console.log(
      `Main: Raw common metadata for ${path.basename(filePath)}:`,
      metadata.common
    );
    const common = metadata.common;
    let artistString = "";
    if (
      common.artists &&
      Array.isArray(common.artists) &&
      common.artists.length > 0
    )
      artistString = common.artists.join(", ");
    else if (
      common.artist &&
      typeof common.artist === "string" &&
      common.artist.trim() !== ""
    )
      artistString = common.artist;
    else if (
      common.albumartist &&
      typeof common.albumartist === "string" &&
      common.albumartist.trim() !== ""
    )
      artistString = common.albumartist;
    const title = common.title || "";
    const album = common.album || "";
    return {
      title,
      artist: artistString,
      album,
      duration: metadata.format.duration,
    };
  } catch (error) {
    console.error(
      `Main: Error parsing metadata for ${filePath}:`,
      error.message,
      error.stack
    );
    return null;
  }
});

ipcMain.on(
  "show-playlist-context-menu",
  (event, trackIndex, selectedIndices) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow) return;
    const numSelected = selectedIndices.length;
    const label =
      numSelected > 1 ? `Remove ${numSelected} Selected Songs` : "Remove Song";
    const menu = Menu.buildFromTemplate([
      {
        label,
        click: () =>
          event.sender.send(
            "context-menu-command",
            "remove-tracks",
            selectedIndices
          ),
      },
    ]);
    menu.popup({ window: senderWindow });
  }
);

ipcMain.on(
  "set-main-window-size-and-visibility",
  (event, newWidthIgnored, heightOption, isPlaylistNowVisible) => {
    console.log(
      "Main IPC: 'set-main-window-size-and-visibility'. HeightOpt:",
      heightOption,
      "Visible:",
      isPlaylistNowVisible
    );
    if (mainWindow) {
      let targetContentHeight;
      if (heightOption === "player_with_playlist") {
        targetContentHeight =
          MAIN_PLAYER_CONTENT_HEIGHT + DOCKED_PLAYLIST_AREA_HEIGHT;
      } else {
        targetContentHeight = MAIN_PLAYER_CONTENT_HEIGHT; // Use updated constant
      }
      console.log(
        "Main IPC: Calculated targetContentHeight:",
        targetContentHeight
      );
      mainWindow.setMinimumSize(PLAYER_FIXED_WIDTH, targetContentHeight);
      mainWindow.setMaximumSize(PLAYER_FIXED_WIDTH, targetContentHeight);
      mainWindow.setSize(PLAYER_FIXED_WIDTH, targetContentHeight, false);
      console.log(
        "Main IPC: Window resized. Storing playlistVisible:",
        isPlaylistNowVisible
      );
      store.set("playlistVisible", isPlaylistNowVisible);
    } else {
      console.error(
        "Main IPC: 'set-main-window-size-and-visibility' - mainWindow is null!"
      );
    }
  }
);

ipcMain.on("save-volume-state", (event, volume) => {
  if (typeof volume === "number" && volume >= 0 && volume <= 1)
    store.set("lastVolume", volume);
  else
    console.warn("Main IPC Warning: Invalid volume received to save:", volume);
});
