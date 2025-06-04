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
// Assuming your .main-player's content (track-info, seek, controls, etc.) + its *other* vertical padding (bottom)
// and the *original* small top padding (e.g., 15px if 288 was based on that) sums up to roughly 288px.
// Let's say your BASE_PLAYER_SECTION_HEIGHT (content + original minimal padding) was 288px.
// And you previously added EXTRA_TOP_PADDING_MAIN_PLAYER = 10px (making padding 25px, total 298px).
// Now, if you want to add *another* 10px on top of that (making padding 35px).

const PREVIOUS_MAIN_PLAYER_CONTENT_HEIGHT = 298; // The value that was working before this specific request
const ADDITIONAL_SPACE_ABOVE_SONG_BOX = 10; // How much MORE space you want above the song box

const MAIN_PLAYER_CONTENT_HEIGHT =
  PREVIOUS_MAIN_PLAYER_CONTENT_HEIGHT + ADDITIONAL_SPACE_ABOVE_SONG_BOX; // e.g., 298 + 10 = 308px

const DOCKED_PLAYLIST_AREA_HEIGHT = 250;
const PLAYER_FIXED_WIDTH = 380;

function handleOpenFile(filePath) {
  // console.log(`Main: handleOpenFile - START. Received path: "${filePath}"`);
  if (!filePath || typeof filePath !== "string") {
    return;
  }
  const supportedExtensions = [
    ".mp3",
    ".m4a",
    ".aac",
    ".wav",
    ".ogg",
    ".flac",
    ".opus",
  ];
  const fileExt = path.extname(filePath).toLowerCase();
  if (!supportedExtensions.includes(fileExt)) {
    return;
  }
  try {
    if (!fs.existsSync(filePath) || !fs.lstatSync(filePath).isFile()) {
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
    mainWindow.webContents.send("open-file-in-player", filePath);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    if (!filesToOpenOnReady.includes(filePath))
      filesToOpenOnReady.push(filePath);
  }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine) => {
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
          ".opus",
        ];
        if (supportedExtensions.includes(path.extname(arg).toLowerCase())) {
          filePath = arg;
          break;
        }
      }
    }
    if (filePath) handleOpenFile(filePath);
  });
  app.whenReady().then(() => {
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

  let initialWindowHeight = MAIN_PLAYER_CONTENT_HEIGHT; // This is now the taller player-only height
  if (lastPlaylistVisibleState === true) {
    initialWindowHeight += DOCKED_PLAYLIST_AREA_HEIGHT;
  }
  console.log(
    "Main: Initial playlist visible:",
    lastPlaylistVisibleState,
    "Calculated initialWindowHeight:",
    initialWindowHeight
  );

  mainWindow = new BrowserWindow({
    width: PLAYER_FIXED_WIDTH,
    height: initialWindowHeight,
    resizable: false,
    minWidth: PLAYER_FIXED_WIDTH,
    maxWidth: PLAYER_FIXED_WIDTH,
    minHeight: MAIN_PLAYER_CONTENT_HEIGHT, // Min height is player only
    maxHeight: MAIN_PLAYER_CONTENT_HEIGHT + DOCKED_PLAYLIST_AREA_HEIGHT, // Max height includes playlist
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
          [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac", ".opus"].includes(
            path.extname(arg).toLowerCase()
          )
      );
      if (filePathFromArg && !filesToProcessNow.includes(filePathFromArg))
        filesToProcessNow.push(filePathFromArg);
      if (filesToProcessNow.length > 0) {
        filesToProcessNow.forEach((fp) => {
          if (
            [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac", ".opus"].includes(
              path.extname(fp).toLowerCase()
            )
          ) {
            try {
              if (fs.existsSync(fp) && fs.lstatSync(fp).isFile())
                mainWindow.webContents.send("open-file-in-player", fp);
            } catch (err) {
              console.error("Error checking file:", err);
            }
          }
        });
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => (mainWindow = null));
}

// --- IPC Handlers ---
ipcMain.handle("dialog:openFiles", async () => {
  if (!mainWindow) return [];
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Audio Files",
          extensions: ["mp3", "m4a", "aac", "ogg", "wav", "flac", ".opus"],
        },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (canceled || !filePaths || filePaths.length === 0) return [];
    return filePaths;
  } catch (error) {
    console.error("Dialog error:", error);
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
  const supportedExtensions = [
    ".mp3",
    ".m4a",
    ".aac",
    ".wav",
    ".ogg",
    ".flac",
    ".opus",
  ];
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
      let targetWindowHeight;
      if (isPlaylistNowVisible) {
        // If playlist is to be shown
        targetWindowHeight =
          MAIN_PLAYER_CONTENT_HEIGHT + DOCKED_PLAYLIST_AREA_HEIGHT;
        mainWindow.setMinimumSize(PLAYER_FIXED_WIDTH, targetWindowHeight); // Set min/max for the taller state
        mainWindow.setMaximumSize(PLAYER_FIXED_WIDTH, targetWindowHeight);
      } else {
        // Playlist is to be hidden
        targetWindowHeight = MAIN_PLAYER_CONTENT_HEIGHT;
        mainWindow.setMinimumSize(PLAYER_FIXED_WIDTH, targetWindowHeight); // Set min/max for the shorter state
        mainWindow.setMaximumSize(PLAYER_FIXED_WIDTH, targetWindowHeight);
      }
      console.log(
        "Main IPC: Calculated targetWindowHeight:",
        targetWindowHeight
      );
      mainWindow.setSize(PLAYER_FIXED_WIDTH, targetWindowHeight, false); // Set the actual size
      store.set("playlistVisible", isPlaylistNowVisible);
    }
  }
);

ipcMain.on("save-volume-state", (event, volume) => {
  if (typeof volume === "number" && volume >= 0 && volume <= 1)
    store.set("lastVolume", volume);
});
