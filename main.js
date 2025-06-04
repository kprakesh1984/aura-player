// main.js
const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const Store = require("electron-store");
const fs = require("fs"); // fs is crucial here

const store = new Store({
  defaults: {
    playlistVisible: false,
    lastVolume: 1.0,
  },
});

let mainWindow;
let filesToOpenOnReady = [];

// Define constants for window dimensions and content heights
const ORIGINAL_MAIN_PLAYER_CONTENT_HEIGHT = 288;
const EXTRA_TOP_PADDING_MAIN_PLAYER = 10;
const MAIN_PLAYER_CONTENT_HEIGHT =
  ORIGINAL_MAIN_PLAYER_CONTENT_HEIGHT + EXTRA_TOP_PADDING_MAIN_PLAYER;
const DOCKED_PLAYLIST_AREA_HEIGHT = 250;
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
  app.on("second-instance", (event, commandLine) => {
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
  let initialWindowHeight = MAIN_PLAYER_CONTENT_HEIGHT;
  if (lastPlaylistVisibleState === true)
    initialWindowHeight += DOCKED_PLAYLIST_AREA_HEIGHT;
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
    maxHeight: initialWindowHeight, // Will be adjusted by IPC
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
      const filePathFromArg = args.find(
        (arg) =>
          !arg.startsWith("--") &&
          arg !== "." &&
          [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"].includes(
            path.extname(arg).toLowerCase()
          )
      );
      if (filePathFromArg && !filesToProcessNow.includes(filePathFromArg))
        filesToProcessNow.push(filePathFromArg);
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
        { name: "All Files", extensions: ["*"] },
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
    const metadata = await parseFile(filePath, {
      duration: true,
      skipCovers: true,
      skipPostHeaders: true,
    });
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
      error.message
    );
    return null;
  }
});

// NEW IPC HANDLER for reading dropped folder contents
ipcMain.handle("read-dropped-folder", async (event, folderPath) => {
  console.log(`Main: Reading folder for audio files: ${folderPath}`);
  const supportedExtensions = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"];
  let audioFiles = [];

  // Recursive helper function to read directories
  const readDirectory = (dir) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // ---- RECURSIVE CALL ----
          readDirectory(fullPath); // Scan subdirectories
          // ---- END RECURSIVE ----
        } else if (
          entry.isFile() &&
          supportedExtensions.includes(path.extname(entry.name).toLowerCase())
        ) {
          audioFiles.push(fullPath);
        }
      }
    } catch (err) {
      console.error(`Main: Error reading directory ${dir}:`, err.message);
      // Continue if one subdirectory is unreadable, for example
    }
  };

  if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
    readDirectory(folderPath); // Start recursive read
  } else {
    console.warn(
      `Main: Dropped path is not a valid directory or does not exist: ${folderPath}`
    );
  }

  console.log(
    `Main: Found ${audioFiles.length} audio files in and under ${folderPath}.`
  );
  return audioFiles;
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
    if (mainWindow) {
      let targetWindowHeight; // Renamed from targetContentHeight for clarity
      if (heightOption === "player_with_playlist") {
        targetWindowHeight = PLAYER_FIXED_WIDTH + DOCKED_PLAYLIST_AREA_HEIGHT; // Using PLAYER_FIXED_WIDTH was a typo, should be player height
        // Corrected:
        targetWindowHeight =
          (store.get("playlistVisible")
            ? MAIN_PLAYER_CONTENT_HEIGHT
            : MAIN_PLAYER_CONTENT_HEIGHT - EXTRA_TOP_PADDING_MAIN_PLAYER) +
          DOCKED_PLAYLIST_AREA_HEIGHT;
        // Simpler and correct logic as per previous discussion for player height:
        targetWindowHeight =
          MAIN_PLAYER_CONTENT_HEIGHT + DOCKED_PLAYLIST_AREA_HEIGHT; // When playlist is shown
        if (!isPlaylistNowVisible) {
          // This block seems to be for when playlist is hidden.
          targetWindowHeight = MAIN_PLAYER_CONTENT_HEIGHT;
        }
      } else {
        // "player_only"
        targetWindowHeight = MAIN_PLAYER_CONTENT_HEIGHT;
      }

      // Let's simplify window height logic based on isPlaylistNowVisible directly
      if (isPlaylistNowVisible) {
        targetWindowHeight =
          MAIN_PLAYER_CONTENT_HEIGHT + DOCKED_PLAYLIST_AREA_HEIGHT;
        mainWindow.setMinimumSize(PLAYER_FIXED_WIDTH, targetWindowHeight);
        mainWindow.setMaximumSize(PLAYER_FIXED_WIDTH, targetWindowHeight);
      } else {
        targetWindowHeight = MAIN_PLAYER_CONTENT_HEIGHT;
        mainWindow.setMinimumSize(PLAYER_FIXED_WIDTH, targetWindowHeight);
        mainWindow.setMaximumSize(PLAYER_FIXED_WIDTH, targetWindowHeight);
      }

      console.log(
        "Main IPC: Calculated targetWindowHeight:",
        targetWindowHeight
      );
      mainWindow.setSize(PLAYER_FIXED_WIDTH, targetWindowHeight, false);
      store.set("playlistVisible", isPlaylistNowVisible);
    }
  }
);

ipcMain.on("save-volume-state", (event, volume) => {
  if (typeof volume === "number" && volume >= 0 && volume <= 1)
    store.set("lastVolume", volume);
});
