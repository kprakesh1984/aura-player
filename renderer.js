   document.addEventListener('DOMContentLoaded', () => {
    console.log("Renderer DOMContentLoaded: Script starting.");

    // DOM Element References
    const audioPlayer = document.getElementById('audioPlayer');
    const songNameDisplay = document.getElementById('songName');
    const songNameContainer = document.querySelector('.song-name-container');
    const mainPlayerPanel = document.getElementById('mainPlayerPanel');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playIcon = '<i class="fas fa-play"></i>';
    const pauseIcon = '<i class="fas fa-pause"></i>';
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const stopBtn = document.getElementById('stopBtn');
    const shuffleBtn = document.getElementById('shuffleBtn');
    const fastForwardBtn = document.getElementById('fastForwardBtn');
    const seekBar = document.getElementById('seekBar');
    const currentTimeDisplay = document.getElementById('currentTime');
    const durationDisplay = document.getElementById('duration');
    const volumeIcon = document.getElementById('volumeIcon');
    const volumeSlider = document.getElementById('volumeSlider');
    const addFilesBtn = document.getElementById('addFilesBtn');
    const playlistContainer = document.getElementById('playlistContainer');
    const playlistUL = document.getElementById('playlist');
    const playlistToggleBtn = document.getElementById('playlistToggleBtn');
    const closePlaylistPanelBtn = document.getElementById('closePlaylistPanelBtn');

    if (!audioPlayer || !songNameDisplay || !songNameContainer || !mainPlayerPanel || !playPauseBtn || !prevBtn || !nextBtn || !stopBtn || !shuffleBtn || !fastForwardBtn || !seekBar || !currentTimeDisplay || !durationDisplay || !volumeIcon || !volumeSlider || !addFilesBtn || !playlistContainer || !playlistUL || !playlistToggleBtn || !closePlaylistPanelBtn) {
        console.error("CRITICAL ERROR: One or more essential DOM elements not found.");
    }

    // State Variables
    let playlist = [];
    let currentTrackIndex = -1;
    let isShuffleActive = false;
    let originalPlaylistOrder = [];
    let selectedIndices = [];
    let lastClickedIndex = -1;
    let currentlyPlayingInfo = null;
    let songScrollTimeout = null;
    let isPlayerExplicitlyStopped = true;
    const PLACEHOLDER_SONG_NAME = "---";

    // --- Helper Functions ---
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) seconds = 0; const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return `${m}:${s < 10 ? '0' : ''}${s}`; }
    function getFileName(filePath) { if (!filePath) return 'Unknown Song'; return filePath.split(/[\\/]/).pop() || 'Unknown Song'; }
    function updateVolumeSliderFill() { if (volumeSlider && audioPlayer) { const p = audioPlayer.muted ? 0 : audioPlayer.volume * 100; volumeSlider.style.setProperty('--volume-percent', `${p}%`); } }
    function updateVolumeIcon() { if (!volumeIcon || !audioPlayer) return; volumeIcon.classList.remove('fa-volume-mute', 'fa-volume-off', 'fa-volume-down', 'fa-volume-up'); if (audioPlayer.muted || audioPlayer.volume === 0) { volumeIcon.classList.add('fa-volume-mute'); volumeIcon.title = "Unmute"; } else if (audioPlayer.volume < 0.01) { volumeIcon.classList.add('fa-volume-off'); volumeIcon.title = "Mute"; } else if (audioPlayer.volume <= 0.5) { volumeIcon.classList.add('fa-volume-down'); volumeIcon.title = "Mute"; } else { volumeIcon.classList.add('fa-volume-up'); volumeIcon.title = "Mute"; } }
    async function getAudioDuration(filePath) { return new Promise((resolve) => { const tA = new Audio(); tA.preload = 'metadata'; tA.src = filePath; let r = false; const rWN = (reason = "unknown") => { if (!r) { r = true; tA.onerror = null; tA.onloadedmetadata = null; tA.oncanplaythrough = null; tA.src = ""; resolve(null); } }; tA.onloadedmetadata = () => { if (!r) { r = true; tA.onerror = null; tA.oncanplaythrough = null; const d = tA.duration; tA.src = ""; resolve(isNaN(d) ? null : d); } }; tA.onerror = (e) => { console.error(`Meta err ${getFileName(filePath)}:`, e.target.error?.code, e.target.error?.message); rWN("audio_element_error"); }; setTimeout(() => { if (!r) { rWN("timeout"); } }, 7000); }); }
    
    function checkAndApplySongNameScrolling() {
        if (!songNameDisplay || !songNameContainer) return;
        if (songScrollTimeout) { clearTimeout(songScrollTimeout); songScrollTimeout = null; }
        songNameDisplay.classList.remove('scrolling-active');
        songNameDisplay.style.paddingLeft = ''; 
        const isPlaceholderActive = songNameContainer.classList.contains('placeholder-text');

        if (isPlaceholderActive) {
            songNameDisplay.style.textOverflow = 'clip'; 
            songNameDisplay.style.overflow = 'visible'; 
            return; 
        } else {
            songNameDisplay.style.textOverflow = 'ellipsis';
            songNameDisplay.style.overflow = 'hidden';
        }
        void songNameDisplay.offsetWidth; 
        const isOverflowing = songNameDisplay.scrollWidth > songNameContainer.clientWidth;
        if (isOverflowing) {
            songScrollTimeout = setTimeout(() => {
                if (songNameDisplay.scrollWidth > songNameContainer.clientWidth && !songNameContainer.classList.contains('placeholder-text')) {
                    songNameDisplay.style.textOverflow = 'clip';
                    songNameDisplay.classList.add('scrolling-active');
                } else {
                    songNameDisplay.classList.remove('scrolling-active');
                    songNameDisplay.style.textOverflow = 'ellipsis';
                }
            }, 2000);
        } else {
            songNameDisplay.classList.remove('scrolling-active');
            songNameDisplay.style.textOverflow = 'ellipsis';
        }
    }

    function updateSongDisplay(text) {
        if (songNameDisplay && songNameContainer) {
            const displayText = (text === "None" || text === null || text === undefined || text.trim() === "" || text.trim() === PLACEHOLDER_SONG_NAME) ? PLACEHOLDER_SONG_NAME : text;
            songNameDisplay.textContent = displayText;
            songNameDisplay.title = (displayText === PLACEHOLDER_SONG_NAME) ? "No song playing" : text;
            if (displayText === PLACEHOLDER_SONG_NAME || text.startsWith("Error:")) {
                songNameContainer.classList.add('placeholder-text');
            } else {
                songNameContainer.classList.remove('placeholder-text');
            }
            checkAndApplySongNameScrolling();
        }
    }

    // --- Audio Player Event Handlers ---
    if (audioPlayer) {
        audioPlayer.addEventListener('loadedmetadata', () => { if (durationDisplay && seekBar && currentlyPlayingInfo) { durationDisplay.textContent = formatTime(audioPlayer.duration); seekBar.max = audioPlayer.duration; if (currentlyPlayingInfo.path === audioPlayer.src && (currentlyPlayingInfo.durationRaw == null || isNaN(currentlyPlayingInfo.durationRaw))) { currentlyPlayingInfo.durationRaw = audioPlayer.duration; currentlyPlayingInfo.durationFormatted = formatTime(audioPlayer.duration);}}});
        audioPlayer.addEventListener('timeupdate', () => { if (currentTimeDisplay && seekBar && audioPlayer.duration) { currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime); seekBar.value = audioPlayer.currentTime; } });
        audioPlayer.addEventListener('play', () => { if (audioPlayer.src && audioPlayer.src !== '' && !audioPlayer.src.endsWith('index.html')) { isPlayerExplicitlyStopped = false; } if (playPauseBtn) playPauseBtn.innerHTML = pauseIcon; });
        audioPlayer.addEventListener('pause', () => { if (playPauseBtn) playPauseBtn.innerHTML = playIcon; });
        audioPlayer.addEventListener('ended', () => { currentlyPlayingInfo = null; isPlayerExplicitlyStopped = true; if (audioPlayer) audioPlayer.src = ''; playNextTrackLogic(); });
        audioPlayer.addEventListener('error', (e) => { const erroredSrc = e.target.src; const cpiPathBeforeError = currentlyPlayingInfo?.path; currentlyPlayingInfo = null; isPlayerExplicitlyStopped = true; if (audioPlayer && audioPlayer.src === erroredSrc && audioPlayer.src !== '') { audioPlayer.src = ''; audioPlayer.load(); } if (songNameDisplay) { const trackName = playlist.find(t => t.path === cpiPathBeforeError)?.name || (erroredSrc ? getFileName(erroredSrc) : "track"); updateSongDisplay(`Error: Could not play (${trackName || 'Unknown'})`); }});
        audioPlayer.addEventListener('volumechange', () => { updateVolumeSliderFill(); updateVolumeIcon(); if (window.electronAPI && typeof window.electronAPI.saveVolume === 'function') { window.electronAPI.saveVolume(audioPlayer.volume); } });
    }

    // --- UI Control Event Handlers ---
    if (playPauseBtn) { playPauseBtn.addEventListener('click', () => { if (audioPlayer) { if (audioPlayer.paused) { const hasValidSrcAndInfo = audioPlayer.src && audioPlayer.src !== '' && !audioPlayer.src.endsWith('index.html') && currentlyPlayingInfo; if (isPlayerExplicitlyStopped && !hasValidSrcAndInfo) { if (playlist.length > 0) { let indexToPlay = (currentTrackIndex !== -1 && currentTrackIndex < playlist.length) ? currentTrackIndex : 0; if (playlist[indexToPlay]) { playTrack(indexToPlay, "playPauseBtn_stopped_emptySrc_playlistHasItems"); } } } else if (hasValidSrcAndInfo) { audioPlayer.play().catch(e => { updateSongDisplay("Error: Could not play.");}); } else if (playlist.length > 0) { let indexToPlay = (currentTrackIndex !== -1 && currentTrackIndex < playlist.length) ? currentTrackIndex : 0; if (playlist[indexToPlay]) { playTrack(indexToPlay, "playPauseBtn_paused_emptySrc_playlistHasItems"); } } } else { audioPlayer.pause(); } } }); }
    if (stopBtn) { stopBtn.addEventListener('click', () => { isPlayerExplicitlyStopped = true; if (audioPlayer) { audioPlayer.pause(); audioPlayer.removeAttribute('src'); audioPlayer.load(); audioPlayer.currentTime = 0; } currentlyPlayingInfo = null; updateSongDisplay(PLACEHOLDER_SONG_NAME); if (durationDisplay && seekBar) { durationDisplay.textContent = formatTime(0); if (seekBar) { seekBar.value = 0; seekBar.max = 0; } } if (playPauseBtn) { playPauseBtn.innerHTML = playIcon; } renderPlaylist(); }); }
    if (fastForwardBtn) { fastForwardBtn.addEventListener('click', () => { if (audioPlayer && audioPlayer.src && !isNaN(audioPlayer.duration) && audioPlayer.readyState >= 2) { audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 10); } }); }
    if (seekBar) { seekBar.addEventListener('input', () => { if (audioPlayer && audioPlayer.src && !isNaN(audioPlayer.duration) && audioPlayer.readyState >= 2) { audioPlayer.currentTime = parseFloat(seekBar.value); } }); }
    if (volumeSlider) { volumeSlider.addEventListener('input', () => { if (audioPlayer) { audioPlayer.muted = false; audioPlayer.volume = parseFloat(volumeSlider.value); } }); }
    if (volumeIcon) { volumeIcon.addEventListener('click', () => { if (audioPlayer) { audioPlayer.muted = !audioPlayer.muted; if (!audioPlayer.muted && audioPlayer.volume === 0) { const dUV = 0.1; audioPlayer.volume = dUV; if (volumeSlider) volumeSlider.value = dUV.toString(); } updateVolumeIcon(); updateVolumeSliderFill(); } }); }

    // --- Playlist Logic Functions ---
    function renderPlaylist() {
        if (!playlistUL) return;
        playlistUL.innerHTML = ''; 
        selectedIndices = selectedIndices.filter(idx => idx < playlist.length);

        if (playlist.length === 0) {
            // Playlist is empty. CSS with :empty selector handles visual placeholder.
            // No <li> is added here explicitly by JS for the placeholder message.
            // If a drop target element is absolutely needed for JS events even when empty,
            // a transparent, minimal <li> could be added here.
            // For now, relying on CSS for ":empty" state.
            return;
        }

        playlist.forEach((track, index) => {
            const li = document.createElement('li'); const tNS = document.createElement('span'); tNS.className = 'track-name-span'; tNS.textContent = track.name; tNS.title = track.name; li.appendChild(tNS);
            const dS = document.createElement('span'); dS.className = 'track-duration-span'; dS.textContent = track.durationFormatted || "--:--"; li.appendChild(dS);
            li.dataset.index = index; li.classList.remove('playing-actual', 'selected-ui', 'selected');
            if (currentlyPlayingInfo && currentlyPlayingInfo.path === track.path && !audioPlayer.paused && !audioPlayer.ended && !isPlayerExplicitlyStopped) { li.classList.add('playing-actual'); }
            if (index === currentTrackIndex) { li.classList.add('selected-ui'); }
            if (selectedIndices.includes(index)) { li.classList.add('selected'); }
            li.addEventListener('click', (e) => { if (e.shiftKey && lastClickedIndex !== -1) { selectedIndices = []; const s = Math.min(index, lastClickedIndex), en = Math.max(index, lastClickedIndex); for (let i = s; i <= en; i++) if (!selectedIndices.includes(i)) selectedIndices.push(i); } else if (e.ctrlKey || e.metaKey) { const p = selectedIndices.indexOf(index); if (p > -1) selectedIndices.splice(p, 1); else selectedIndices.push(index); } else { selectedIndices = [index]; } currentTrackIndex = index; lastClickedIndex = index; renderPlaylist(); });
            li.addEventListener('dblclick', () => { currentTrackIndex = index; selectedIndices = [index]; playTrack(index, "playlistItemDblClick"); });
            li.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!selectedIndices.includes(index)) { if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {selectedIndices = [index]; currentTrackIndex = index; lastClickedIndex = index;} else {selectedIndices.push(index);} renderPlaylist(); } if (window.electronAPI && typeof window.electronAPI.showPlaylistContextMenu === 'function') { window.electronAPI.showPlaylistContextMenu(index, [...selectedIndices]); } });
            playlistUL.appendChild(li);
        });
    }
    async function addFilesToPlaylist(filePaths, playFirstNew = false) { const oldPlaylistLength = playlist.length; let firstNewTrackActualIndexInPlaylist = -1; const originalSongNameOnDisplay = songNameDisplay ? songNameDisplay.textContent : PLACEHOLDER_SONG_NAME; updateSongDisplay("Loading songs..."); for (let i = 0; i < filePaths.length; i++) { const path = filePaths[i]; const name = getFileName(path); if (songNameDisplay && filePaths.length > 1) updateSongDisplay(`Loading: ${name} (${i+1}/${filePaths.length})`); const durationRaw = await getAudioDuration(path); const durationFormatted = durationRaw != null && !isNaN(durationRaw) ? formatTime(durationRaw) : "--:--"; const newTrack = { path, name, durationRaw, durationFormatted }; playlist.push(newTrack); if (isShuffleActive && originalPlaylistOrder) { originalPlaylistOrder.push({ ...newTrack }); } if (firstNewTrackActualIndexInPlaylist === -1) { firstNewTrackActualIndexInPlaylist = playlist.length - 1; } } if (songNameDisplay) { if (currentlyPlayingInfo) { updateSongDisplay(currentlyPlayingInfo.name); } else if ((playFirstNew || oldPlaylistLength === 0) && firstNewTrackActualIndexInPlaylist !== -1 && playlist[firstNewTrackActualIndexInPlaylist]) { updateSongDisplay(playlist[firstNewTrackActualIndexInPlaylist].name); } else { updateSongDisplay(originalSongNameOnDisplay === "Loading songs..." ? PLACEHOLDER_SONG_NAME : originalSongNameOnDisplay); } } renderPlaylist(); if ((playFirstNew || oldPlaylistLength === 0) && firstNewTrackActualIndexInPlaylist !== -1) { playTrack(firstNewTrackActualIndexInPlaylist, "addFilesToPlaylist_playFirstNew"); } }
    function playTrack(index, calledFrom = "unknown") { if (!audioPlayer || !songNameDisplay) { return; } currentTrackIndex = index; if (index >= 0 && index < playlist.length) { selectedIndices = [index]; lastClickedIndex = index; const trackToLoad = playlist[index]; if (trackToLoad && typeof trackToLoad.path === 'string' && trackToLoad.path.trim() !== '') { const needsNewSrc = currentlyPlayingInfo?.path !== trackToLoad.path || isPlayerExplicitlyStopped || audioPlayer.error || audioPlayer.ended || !audioPlayer.src || audioPlayer.src === '' || audioPlayer.src.endsWith('index.html') || audioPlayer.src === window.location.href + "#"; if (needsNewSrc) { audioPlayer.src = trackToLoad.path; currentlyPlayingInfo = { ...trackToLoad }; updateSongDisplay(trackToLoad.name); const playPromise = audioPlayer.play(); if (playPromise !== undefined) { playPromise.then(() => {isPlayerExplicitlyStopped = false;}).catch(e => { updateSongDisplay(`Error: (${trackToLoad.name || 'track'})`); currentlyPlayingInfo = null; isPlayerExplicitlyStopped = true; if(audioPlayer) { audioPlayer.src = ''; audioPlayer.load(); } }); } else { isPlayerExplicitlyStopped = true; } } else { updateSongDisplay(trackToLoad.name); if (audioPlayer.paused) { audioPlayer.play().catch(e => {isPlayerExplicitlyStopped = true; }); } } } else { if (!currentlyPlayingInfo) { updateSongDisplay(`Error: Invalid track data.`); } } } else { if (isPlayerExplicitlyStopped || (!audioPlayer.src || audioPlayer.src === '' || audioPlayer.src.endsWith('index.html') || audioPlayer.src === window.location.href + "#") ) { if (audioPlayer) { audioPlayer.pause(); audioPlayer.removeAttribute('src'); audioPlayer.load(); } currentlyPlayingInfo = null; updateSongDisplay(PLACEHOLDER_SONG_NAME); if (durationDisplay && seekBar) { durationDisplay.textContent = formatTime(0); seekBar.value = 0; seekBar.max = 0; } currentTrackIndex = -1; isPlayerExplicitlyStopped = true; } } renderPlaylist(); }
    function removeTracks(indicesToRemove) { if (!indicesToRemove || indicesToRemove.length === 0) return; indicesToRemove.sort((a, b) => b - a); let newUiCurrentIndex = currentTrackIndex; indicesToRemove.forEach(indexToRemove => { if (indexToRemove < 0 || indexToRemove >= playlist.length) return; const removedTrack = playlist.splice(indexToRemove, 1)[0]; if (isShuffleActive && originalPlaylistOrder) { const oI = originalPlaylistOrder.findIndex(t => t.path === removedTrack?.path); if (oI > -1) originalPlaylistOrder.splice(oI, 1); } if (indexToRemove === newUiCurrentIndex) {} else if (indexToRemove < newUiCurrentIndex) { newUiCurrentIndex--; } }); if (playlist.length === 0) { currentTrackIndex = -1; } else { currentTrackIndex = Math.min(newUiCurrentIndex, playlist.length - 1); if (currentTrackIndex < 0) currentTrackIndex = 0; } selectedIndices = (currentTrackIndex !== -1) ? [currentTrackIndex] : []; lastClickedIndex = currentTrackIndex; if (currentlyPlayingInfo && songNameDisplay) { updateSongDisplay(currentlyPlayingInfo.name); } else if (playlist.length > 0 && currentTrackIndex !== -1 && songNameDisplay) { updateSongDisplay(playlist[currentTrackIndex].name); } else if (songNameDisplay) { updateSongDisplay(PLACEHOLDER_SONG_NAME); if (audioPlayer && (!audioPlayer.src || audioPlayer.src === '') && !currentlyPlayingInfo) { if (durationDisplay && seekBar) { durationDisplay.textContent = formatTime(0); seekBar.value = 0; seekBar.max = 0; } } } renderPlaylist(); }
    function playNextTrackLogic() { if (playlist.length === 0) { if (audioPlayer) { audioPlayer.pause(); audioPlayer.removeAttribute('src'); audioPlayer.load(); } currentlyPlayingInfo = null; isPlayerExplicitlyStopped = true; updateSongDisplay(PLACEHOLDER_SONG_NAME); if (durationDisplay && seekBar) { durationDisplay.textContent = formatTime(0); seekBar.value = 0; seekBar.max = 0; } currentTrackIndex = -1; renderPlaylist(); return; } let newIndex = currentTrackIndex + 1; if (newIndex >= playlist.length) { newIndex = 0; } playTrack(newIndex, "playNextTrackLogic"); }
    function playPrevTrackLogic() { if (playlist.length === 0) { if (audioPlayer) { audioPlayer.pause(); audioPlayer.removeAttribute('src'); audioPlayer.load(); } currentlyPlayingInfo = null; isPlayerExplicitlyStopped = true; updateSongDisplay(PLACEHOLDER_SONG_NAME); if (durationDisplay && seekBar) { durationDisplay.textContent = formatTime(0); seekBar.value = 0; seekBar.max = 0; } currentTrackIndex = -1; renderPlaylist(); return; } let newIndex = currentTrackIndex - 1; if (newIndex < 0) { newIndex = playlist.length - 1; } playTrack(newIndex, "playPrevTrackLogic"); }
    function updateShuffleButtonUI() { if (!shuffleBtn) return; shuffleBtn.classList.toggle('shuffle-active', isShuffleActive); shuffleBtn.innerHTML = `<i class="fas fa-random"></i>`; shuffleBtn.title = isShuffleActive ? "Shuffle: On" : "Shuffle: Off"; }
    function shuffleCurrentPlaylist() { if (playlist.length < 2) return; const cPIS = currentlyPlayingInfo ? {...currentlyPlayingInfo} : null; if (!originalPlaylistOrder || originalPlaylistOrder.length === 0 || playlist.some((track, i) => track.path !== originalPlaylistOrder[i]?.path) ) { originalPlaylistOrder = playlist.map(track => ({ ...track })); } for (let i = playlist.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [playlist[i], playlist[j]] = [playlist[j], playlist[i]]; } if (cPIS) { currentTrackIndex = playlist.findIndex(track => track.path === cPIS.path); if (currentTrackIndex === -1 && playlist.length > 0) { currentTrackIndex = 0; } } else if (playlist.length > 0) { currentTrackIndex = 0; } else { currentTrackIndex = -1; } selectedIndices = currentTrackIndex > -1 ? [currentTrackIndex] : []; lastClickedIndex = currentTrackIndex; }
    function unshufflePlaylist() { if (originalPlaylistOrder && originalPlaylistOrder.length > 0) { const cPIS = currentlyPlayingInfo ? {...currentlyPlayingInfo} : null; playlist = originalPlaylistOrder.map(track => ({ ...track })); if (cPIS) { currentTrackIndex = playlist.findIndex(track => track.path === cPIS.path); if (currentTrackIndex === -1 && playlist.length > 0) currentTrackIndex = 0; } else if (playlist.length > 0) { currentTrackIndex = 0; } else { currentTrackIndex = -1; } selectedIndices = currentTrackIndex > -1 ? [currentTrackIndex] : []; lastClickedIndex = currentTrackIndex; } }

    // --- Event Listeners ---
    if (prevBtn) prevBtn.addEventListener('click', playPrevTrackLogic);
    if (nextBtn) nextBtn.addEventListener('click', playNextTrackLogic);
    if (shuffleBtn) { shuffleBtn.addEventListener('click', () => { isShuffleActive = !isShuffleActive; if (isShuffleActive) { shuffleCurrentPlaylist(); } else { unshufflePlaylist(); } updateShuffleButtonUI(); renderPlaylist(); }); }
    if (addFilesBtn) { addFilesBtn.addEventListener('click', async () => { try { if (window.electronAPI && typeof window.electronAPI.openFiles === 'function') { const filePaths = await window.electronAPI.openFiles(); if (filePaths && filePaths.length > 0) { await addFilesToPlaylist(filePaths, playlist.length === 0); } } else { console.error("window.electronAPI.openFiles is not available."); } } catch (error) { console.error("Error in addFilesBtn click handler:", error); } }); }
    function updatePlaylistToggleBtnTextDOM() { if (!playlistToggleBtn || !playlistContainer) { return; } const isHidden = playlistContainer.classList.contains('hidden'); playlistToggleBtn.innerHTML = `<i class="fas fa-list-ul"></i> ${isHidden ? 'Show' : 'Hide'} Playlist`; playlistToggleBtn.title = `${isHidden ? 'Show' : 'Hide'} Playlist`; }
    function setPlaylistUIVisibilityDOM(isVisible) { if (!playlistContainer) { return; } if (isVisible) { playlistContainer.classList.remove('hidden'); if(mainPlayerPanel) mainPlayerPanel.classList.add('with-playlist');} else { playlistContainer.classList.add('hidden'); if(mainPlayerPanel) mainPlayerPanel.classList.remove('with-playlist');} updatePlaylistToggleBtnTextDOM(); }
    function toggleDockedPlaylistDOM() { if (!playlistContainer) { return; } const isCurrentlyHidden = playlistContainer.classList.contains('hidden'); const showPlaylist = isCurrentlyHidden; const currentBodyWidth = document.body.offsetWidth; setPlaylistUIVisibilityDOM(showPlaylist); if (window.electronAPI && typeof window.electronAPI.resizeMainWindowAndSaveVisibility === 'function') { const heightOption = showPlaylist ? 'player_with_playlist' : 'player_only'; window.electronAPI.resizeMainWindowAndSaveVisibility(currentBodyWidth, heightOption, showPlaylist); } else { console.error("window.electronAPI.resizeMainWindowAndSaveVisibility is not available."); } }
    if (playlistToggleBtn) playlistToggleBtn.addEventListener('click', toggleDockedPlaylistDOM);
    if (closePlaylistPanelBtn) closePlaylistPanelBtn.addEventListener('click', () => { if (playlistContainer && !playlistContainer.classList.contains('hidden')) { toggleDockedPlaylistDOM(); } });
    const dropZoneElement = document.body; if (dropZoneElement) { dropZoneElement.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); if (playlistContainer && !playlistContainer.classList.contains('hidden')) { playlistContainer.classList.add('dragover-active'); if (playlistUL && playlistUL.querySelector('.playlist-drop-target')) { playlistUL.querySelector('.playlist-drop-target').classList.add('dragover'); } } else { if (mainPlayerPanel) mainPlayerPanel.classList.add('dragover-body'); } }); dropZoneElement.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); if (playlistContainer) playlistContainer.classList.remove('dragover-active'); if (playlistUL && playlistUL.querySelector('.playlist-drop-target.dragover')) { playlistUL.querySelector('.playlist-drop-target.dragover').classList.remove('dragover'); } if (mainPlayerPanel) mainPlayerPanel.classList.remove('dragover-body'); }); dropZoneElement.addEventListener('drop', async (e) => { e.preventDefault(); e.stopPropagation(); if (playlistContainer) playlistContainer.classList.remove('dragover-active'); if (playlistUL && playlistUL.querySelector('.playlist-drop-target.dragover')) { playlistUL.querySelector('.playlist-drop-target.dragover').classList.remove('dragover'); } if (mainPlayerPanel) mainPlayerPanel.classList.remove('dragover-body'); const files = e.dataTransfer.files; if (files && files.length > 0) { const audioFilePaths = Array.from(files).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)).map(f => f.path); if (audioFilePaths.length > 0) { await addFilesToPlaylist(audioFilePaths, playlist.length === 0); } } }); }
    
    // --- IPC Event Handlers ---
    if (window.electronAPI && typeof window.electronAPI.onContextMenuCommand === 'function') { window.electronAPI.onContextMenuCommand((command, data) => { if (command === 'remove-tracks') removeTracks(data); }); }
    if (window.electronAPI && typeof window.electronAPI.onSetInitialPlaylistVisibility === 'function') { window.electronAPI.onSetInitialPlaylistVisibility((isVisible) => setPlaylistUIVisibilityDOM(isVisible)); }
    if (window.electronAPI && typeof window.electronAPI.onSetInitialVolume === 'function') { window.electronAPI.onSetInitialVolume((initialVolume) => { if (audioPlayer && typeof initialVolume === 'number') audioPlayer.volume = initialVolume; if (volumeSlider && typeof initialVolume === 'number') volumeSlider.value = initialVolume.toString(); }); }
    if (window.electronAPI && typeof window.electronAPI.onOpenFileInPlayer === 'function') { window.electronAPI.onOpenFileInPlayer(async (filePath) => { if (filePath && typeof filePath === 'string') { const trackExistsIndex = playlist.findIndex(track => track.path === filePath); if (trackExistsIndex !== -1) { isPlayerExplicitlyStopped = false; playTrack(trackExistsIndex, "onOpenFileInPlayer_existing"); } else { if(songNameDisplay && playlist.length === 0) updateSongDisplay(`Loading: ${getFileName(filePath)}`); const name = getFileName(filePath); const durationRaw = await getAudioDuration(filePath); const durationFormatted = durationRaw != null && !isNaN(durationRaw) ? formatTime(durationRaw) : "--:--"; const newTrack = { path: filePath, name, durationRaw, durationFormatted }; playlist.push(newTrack); renderPlaylist(); const newTrackIndex = playlist.length - 1; isPlayerExplicitlyStopped = false; playTrack(newTrackIndex, "onOpenFileInPlayer_new"); } } }); } else { console.warn("Renderer: window.electronAPI.onOpenFileInPlayer not available."); }

    // --- Initial Setup ---
    renderPlaylist(); 
    updatePlaylistToggleBtnTextDOM(); 
    updateShuffleButtonUI(); 
    setTimeout(() => {
        if (audioPlayer && volumeSlider && typeof audioPlayer.volume === 'number' && typeof volumeSlider.value === 'string') { if (audioPlayer.volume.toFixed(2) !== parseFloat(volumeSlider.value).toFixed(2)) { if (volumeSlider) volumeSlider.value = audioPlayer.volume.toString(); } }
        updateVolumeSliderFill(); updateVolumeIcon();
        updateSongDisplay(songNameDisplay.textContent || PLACEHOLDER_SONG_NAME);
    }, 100);
});