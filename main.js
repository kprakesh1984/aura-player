const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store'); // Using require() for electron-store v7
const fs = require('fs'); // For file system checks

// Initialize electron-store with defaults
const store = new Store({
    defaults: {
        playlistVisible: false,
        lastVolume: 1.0
    }
});

let mainWindow;
let filesToOpenOnReady = []; // Queue for files if app isn't ready yet

// Define constants for window dimensions and content heights
const MAIN_PLAYER_CONTENT_HEIGHT =  288;
const DOCKED_PLAYLIST_AREA_HEIGHT = 250;
const PLAYER_FIXED_WIDTH = 380;

// --- Function to handle opening a file path (used by second-instance and open-file events) ---
function handleOpenFile(filePath) {
    console.log(`Main: handleOpenFile - START. Received path: "${filePath}"`);
    if (!filePath || typeof filePath !== 'string') {
        console.warn('Main: handleOpenFile - Invalid or no filePath. Aborting.');
        return;
    }
    const supportedExtensions = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac'];
    const fileExt = path.extname(filePath).toLowerCase();
    if (!supportedExtensions.includes(fileExt)) {
        console.log(`Main: handleOpenFile - Path "${filePath}" (ext: ${fileExt}) is not a supported audio file type. Ignoring.`);
        return;
    }
    try {
        if (!fs.existsSync(filePath) || !fs.lstatSync(filePath).isFile()) {
            console.warn(`Main: handleOpenFile - Path "${filePath}" does not exist or is not a file. Ignoring.`);
            return;
        }
    } catch (err) {
        console.error(`Main: handleOpenFile - Error checking file status for "${filePath}":`, err);
        return;
    }

    // If window exists and webContents are loaded and NOT loading, send IPC
    if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed() &&
        !mainWindow.webContents.isDestroyed() && !mainWindow.webContents.isLoading()) {
        
        console.log('Main: handleOpenFile - Sending "open-file-in-player" IPC directly for:', filePath);
        mainWindow.webContents.send('open-file-in-player', filePath);
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    } else {
        // If webContents ARE loading, or window not fully ready, queue it.
        // The did-finish-load handler will pick up anything from filesToOpenOnReady initially.
        console.log('Main: handleOpenFile - mainWindow not fully ready or webContents loading, queueing file:', filePath);
        if (!filesToOpenOnReady.includes(filePath)) {
            filesToOpenOnReady.push(filePath);
        }
    }
    console.log(`Main: handleOpenFile - END for "${filePath}"`);
}

// --- Single Instance Lock ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log("Main: Another instance detected. Quitting this new (secondary) instance.");
    app.quit();
} else {
    // This is the primary instance.
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        console.log("Main: 'second-instance' event triggered on PRIMARY instance. Full CommandLine:", commandLine);
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            console.log("Main: Focused existing mainWindow.");
        }

        let filePath = null;
        for (let i = 1; i < commandLine.length; i++) { // Start from 1 to skip exe path
            const arg = commandLine[i];
            console.log(`Main (second-instance): Checking arg [${i}]: "${arg}"`);
            if (!arg.startsWith('--') && arg !== '.') {
                const supportedExtensions = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac'];
                const ext = path.extname(arg).toLowerCase();
                if (supportedExtensions.includes(ext)) {
                    // Basic check on extension, more robust checks in handleOpenFile
                    filePath = arg;
                    console.log(`Main (second-instance): Potential file path found: "${filePath}"`);
                    break; 
                }
            }
        }

        if (filePath) {
            console.log('Main: second-instance successfully determined file to open:', filePath);
            handleOpenFile(filePath); // This will queue if necessary or send IPC
        } else {
            console.warn('Main: second-instance - no valid audio file path found in commandLine:', commandLine);
        }
    });

    // --- App Lifecycle (only for the primary instance) ---
    app.whenReady().then(() => {
        console.log("Main: App is ready (primary instance).");
        createMainWindow();

        app.on('open-file', (event, filePath) => { // macOS specific
            event.preventDefault();
            console.log('Main: app.on("open-file") (macOS) detected file:', filePath);
            handleOpenFile(filePath);
        });

        app.on('activate', () => { // macOS specific
            if (BrowserWindow.getAllWindows().length === 0) {
                createMainWindow();
            }
        });
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
} // End of the `else` block for `if (!gotTheLock)`

function createMainWindow() {
    console.log("Main: createMainWindow called.");
    const lastPlaylistVisibleState = store.get('playlistVisible');
    const lastVolumeState = store.get('lastVolume');
    let initialWindowHeight = MAIN_PLAYER_CONTENT_HEIGHT;
    if (lastPlaylistVisibleState === true) initialWindowHeight += DOCKED_PLAYLIST_AREA_HEIGHT;

    mainWindow = new BrowserWindow({
        width: PLAYER_FIXED_WIDTH,
        height: initialWindowHeight,
        resizable: false,
        minWidth: PLAYER_FIXED_WIDTH,
        maxWidth: PLAYER_FIXED_WIDTH,
        minHeight: initialWindowHeight,
        maxHeight: initialWindowHeight,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: !app.isPackaged // Open DevTools if not packaged
        },
        show: false,
        icon: path.join(__dirname,'assets','icons','icon.ico')
    });

    mainWindow.loadFile('index.html');
    // if (!app.isPackaged) { mainWindow.webContents.openDevTools(); } // For debugging startup

    mainWindow.setMenu(null);

    mainWindow.webContents.on('did-finish-load', () => {
        console.log("Main: mainWindow 'did-finish-load'.");
        if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
            // Send initial states to renderer
            console.log("Main (did-finish-load): Sending initial states to renderer.");
            mainWindow.webContents.send('set-initial-playlist-visibility', lastPlaylistVisibleState);
            mainWindow.webContents.send('set-initial-volume', lastVolumeState);

            // Collect all files to open: from existing queue + initial launch arguments
            let filesToProcessNow = [...filesToOpenOnReady];
            filesToOpenOnReady = []; // Clear the global queue as we are processing them now

            const args = process.defaultApp ? process.argv.slice(2) : process.argv.slice(1);
            console.log("Main (did-finish-load): Raw process.argv for initial launch:", process.argv);
            console.log("Main (did-finish-load): Sliced arguments to check:", args);
            const filePathFromArg = args.find(arg => {
                if (!arg.startsWith('--') && arg !== '.') {
                    const supportedExtensions = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac'];
                    const ext = path.extname(arg).toLowerCase();
                    return supportedExtensions.includes(ext);
                }
                return false;
            });

            if (filePathFromArg) {
                console.log('Main (did-finish-load): Initial launch argument detected file:', filePathFromArg);
                if (!filesToProcessNow.includes(filePathFromArg)) {
                    filesToProcessNow.push(filePathFromArg);
                }
            }
            
            if (filesToProcessNow.length > 0) {
                console.log('Main (did-finish-load): Processing files to open via direct IPC send:', filesToProcessNow);
                filesToProcessNow.forEach(fp => {
                    // At this point (did-finish-load), webContents should be ready to receive IPC.
                    // We directly send, bypassing handleOpenFile's isLoading check for these initial files.
                    console.log('Main (did-finish-load): Directly sending "open-file-in-player" for:', fp);
                    // Perform the file existence and type check here before sending
                    const supportedExtensions = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac'];
                    const fileExt = path.extname(fp).toLowerCase();
                    let isValidFile = false;
                    if (supportedExtensions.includes(fileExt)) {
                        try {
                            if (fs.existsSync(fp) && fs.lstatSync(fp).isFile()) {
                                isValidFile = true;
                            } else {
                                console.warn(`Main (did-finish-load): Path "${fp}" does not exist or is not a file. Not sending.`);
                            }
                        } catch (err) {
                             console.error(`Main (did-finish-load): Error checking file status for "${fp}":`, err);
                        }
                    } else {
                        console.log(`Main (did-finish-load): Path "${fp}" (ext: ${fileExt}) is not supported. Not sending.`);
                    }

                    if (isValidFile) {
                        mainWindow.webContents.send('open-file-in-player', fp);
                    }
                });
                 if (mainWindow.isMinimized()) mainWindow.restore(); // Bring window to front if launched with file
                 mainWindow.focus();
            }
        }
    });

    mainWindow.once('ready-to-show', () => {
        console.log("Main: mainWindow 'ready-to-show'.");
        mainWindow.show();
        // File processing and initial IPC sends are now primarily in 'did-finish-load'
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// --- IPC Handlers ---
ipcMain.handle('dialog:openFiles', async () => {
    console.log("Main IPC: 'dialog:openFiles' called.");
    if (!mainWindow) { console.error("Main IPC Error: 'dialog:openFiles' called but mainWindow is not defined."); return []; }
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Audio Files', extensions: ['mp3', 'm4a', 'aac', 'ogg', 'wav', 'flac'] }]
        });
        if (canceled || !filePaths || filePaths.length === 0) { console.log("Main IPC: File open dialog was cancelled or no files selected."); return []; }
        console.log("Main IPC: Files selected from dialog:", filePaths); return filePaths;
    } catch (error) { console.error("Main IPC Error in showOpenDialog for 'dialog:openFiles':", error); return []; }
});

ipcMain.on('show-playlist-context-menu', (event, trackIndex, selectedIndices) => {
    console.log("Main IPC: 'show-playlist-context-menu' called.");
    const senderWindow = BrowserWindow.fromWebContents(event.sender); if (!senderWindow) return;
    const numSelected = selectedIndices.length; const label = numSelected > 1 ? `Remove ${numSelected} Selected Songs` : 'Remove Song';
    const template = [{ label: label, click: () => { event.sender.send('context-menu-command', 'remove-tracks', selectedIndices); } }];
    const menu = Menu.buildFromTemplate(template); menu.popup({ window: senderWindow });
});

ipcMain.on('set-main-window-size-and-visibility', (event, newWidthIgnored, heightOption, isPlaylistNowVisible) => {
    console.log("Main IPC: 'set-main-window-size-and-visibility' called. HeightOpt:", heightOption, "Visible:", isPlaylistNowVisible);
    if (mainWindow) {
        let targetContentHeight;
        if (heightOption === 'player_with_playlist') { targetContentHeight = MAIN_PLAYER_CONTENT_HEIGHT + DOCKED_PLAYLIST_AREA_HEIGHT; }
        else { targetContentHeight = MAIN_PLAYER_CONTENT_HEIGHT; }
        mainWindow.setMinimumSize(PLAYER_FIXED_WIDTH, targetContentHeight);
        mainWindow.setMaximumSize(PLAYER_FIXED_WIDTH, targetContentHeight);
        mainWindow.setSize(PLAYER_FIXED_WIDTH, targetContentHeight, false);
        store.set('playlistVisible', isPlaylistNowVisible);
    }
});

ipcMain.on('save-volume-state', (event, volume) => {
    if (typeof volume === 'number' && volume >= 0 && volume <= 1) { store.set('lastVolume', volume); }
    else { console.warn('Main IPC Warning: Invalid volume received to save:', volume); }
});