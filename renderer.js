// renderer.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("Renderer DOMContentLoaded: Script starting.");

  // DOM Element References
  const audioPlayer = document.getElementById("audioPlayer");
  const songTitleDisplay = document.getElementById("songTitle");
  const songArtistDisplay = document.getElementById("songArtist");
  const nowPlayingDetailsContainer = document.querySelector(
    ".now-playing-details"
  );
  const mainPlayerPanel = document.getElementById("mainPlayerPanel");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const playIcon = '<i class="fas fa-play"></i>';
  const pauseIcon = '<i class="fas fa-pause"></i>';
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const stopBtn = document.getElementById("stopBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const fastForwardBtn = document.getElementById("fastForwardBtn");
  const seekBar = document.getElementById("seekBar");
  const currentTimeDisplay = document.getElementById("currentTime");
  const durationDisplay = document.getElementById("duration");
  const volumeIcon = document.getElementById("volumeIcon");
  const volumeSlider = document.getElementById("volumeSlider");
  const addFilesBtn = document.getElementById("addFilesBtn");
  const playlistContainer = document.getElementById("playlistContainer");
  const playlistUL = document.getElementById("playlist");
  const playlistToggleBtn = document.getElementById("playlistToggleBtn");
  const closePlaylistPanelBtn = document.getElementById(
    "closePlaylistPanelBtn"
  );
  const visualizerCanvas = document.getElementById("audioVisualizerCanvas");
  let canvasCtx;
  // const eqToggleBtn = document.getElementById("eqToggleBtn"); // REMOVED
  // const eqIndicator = document.getElementById("eqIndicator"); // REMOVED
  const vizToggleBtn = document.getElementById("vizToggleBtn");

  // Critical check
  if (
    !audioPlayer ||
    !mainPlayerPanel ||
    !playPauseBtn ||
    !playlistUL ||
    !visualizerCanvas
  ) {
    console.error(
      "CRITICAL ERROR: Core DOM elements missing, player cannot function."
    );
    if (mainPlayerPanel)
      mainPlayerPanel.innerHTML =
        "<p style='color:red; text-align:center; padding:20px;'>Player Error: Essential components missing.</p>";
    return;
  }
  if (!songTitleDisplay)
    console.warn("Warning: songTitleDisplay element not found.");
  if (!vizToggleBtn) console.warn("Warning: vizToggleBtn element not found.");

  // State Variables
  let playlist = [];
  let currentTrackIndex = -1;
  let isShuffleActive = false;
  let originalPlaylistOrder = [];
  let selectedIndices = [];
  let lastClickedIndex = -1;
  let currentlyPlayingInfo = null;
  let isPlayerExplicitlyStopped = true;
  const PLACEHOLDER_TITLE = "--- Symphonie ---";
  const PLACEHOLDER_ARTIST = "";
  let draggedItemIndex = null;
  let dropTargetIndex = null;
  const PLAYER_FIXED_WIDTH = 380;
  // let isEqActive = false; // REMOVED
  let isVisualizerActive = true;

  // Web Audio API variables
  let audioContext;
  let analyser;
  let sourceNode;
  let visualizerDataArray;
  let visualizerBufferLength;
  let visualizerAnimationId;

  // --- Helper Functions --- (Same as before)
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }
  function getFileName(filePath, includeExtension = false) {
    if (!filePath) return "Unknown Song";
    const fullFileName = filePath.split(/[\\/]/).pop() || "Unknown Song";
    if (includeExtension) return fullFileName;
    const lastDot = fullFileName.lastIndexOf(".");
    if (lastDot === -1 || lastDot === 0) return fullFileName;
    return fullFileName.substring(0, lastDot);
  }
  function updateVolumeSliderFill() {
    if (volumeSlider && audioPlayer) {
      const p = audioPlayer.muted ? 0 : audioPlayer.volume * 100;
      volumeSlider.style.setProperty("--volume-percent", `${p}%`);
    }
  }
  function updateVolumeIcon() {
    if (!volumeIcon || !audioPlayer) return;
    volumeIcon.classList.remove(
      "fa-volume-mute",
      "fa-volume-off",
      "fa-volume-down",
      "fa-volume-up"
    );
    if (audioPlayer.muted || audioPlayer.volume === 0) {
      volumeIcon.classList.add("fa-volume-mute");
      volumeIcon.title = "Unmute";
    } else if (audioPlayer.volume < 0.01) {
      volumeIcon.classList.add("fa-volume-off");
      volumeIcon.title = "Mute";
    } else if (audioPlayer.volume <= 0.5) {
      volumeIcon.classList.add("fa-volume-down");
      volumeIcon.title = "Mute";
    } else {
      volumeIcon.classList.add("fa-volume-up");
      volumeIcon.title = "Mute";
    }
  }
  async function getAudioDuration(filePath) {
    const filename = getFileName(filePath, true);
    console.warn(
      `Renderer: Using SLOW getAudioDuration fallback for ${filename}`
    );
    const fallbackStartTime = performance.now();
    return new Promise((resolve) => {
      const tempAudio = new Audio();
      tempAudio.preload = "metadata";
      tempAudio.src = filePath;
      let resolved = false;
      const resolveWithNull = (reason = "unknown") => {
        if (!resolved) {
          resolved = true;
          tempAudio.onerror = null;
          tempAudio.onloadedmetadata = null;
          tempAudio.src = "";
          const fallbackEndTime = performance.now();
          console.error(
            `getAudioDuration fallback for ${filename} failed in ${(
              fallbackEndTime - fallbackStartTime
            ).toFixed(2)}ms. Reason: ${reason}`
          );
          resolve(null);
        }
      };
      tempAudio.onloadedmetadata = () => {
        if (!resolved) {
          resolved = true;
          tempAudio.onerror = null;
          const d = tempAudio.duration;
          tempAudio.src = "";
          const fallbackEndTime = performance.now();
          console.log(
            `getAudioDuration fallback for ${filename} took ${(
              fallbackEndTime - fallbackStartTime
            ).toFixed(2)}ms. Found: ${d}`
          );
          resolve(isNaN(d) ? null : d);
        }
      };
      tempAudio.onerror = (e) =>
        resolveWithNull(`audio_element_error: ${e.target.error?.message}`);
      setTimeout(() => {
        if (!resolved) resolveWithNull("timeout");
      }, 7000);
    });
  }
  async function fetchTrackMetadata(filePath) {
    const nameWithoutExt = getFileName(filePath, false);
    if (
      window.electronAPI &&
      typeof window.electronAPI.getMetadata === "function"
    ) {
      try {
        const metadataFromMain = await window.electronAPI.getMetadata(filePath);
        if (metadataFromMain) {
          return {
            title: metadataFromMain.title || nameWithoutExt,
            artist: metadataFromMain.artist || "",
            album: metadataFromMain.album || "",
            duration: metadataFromMain.duration,
          };
        }
      } catch (error) {
        console.error(
          `Renderer: Error fetching metadata for ${filePath} via electronAPI:`,
          error
        );
      }
    }
    return { title: nameWithoutExt, artist: "", album: "", duration: null };
  }
  function checkAndApplyScrolling(textElement, containerElement) {
    if (!textElement || !containerElement) return;
    let timeoutId = parseInt(textElement.dataset.scrollTimeoutId, 10);
    if (timeoutId) {
      clearTimeout(timeoutId);
      textElement.dataset.scrollTimeoutId = "";
    }
    textElement.classList.remove("scrolling-active");
    const isPlaceholderParent =
      nowPlayingDetailsContainer &&
      nowPlayingDetailsContainer.classList.contains("placeholder-text");
    if (
      (isPlaceholderParent && textElement.textContent === PLACEHOLDER_TITLE) ||
      (isPlaceholderParent &&
        textElement.id === "songArtist" &&
        textElement.textContent === PLACEHOLDER_ARTIST)
    ) {
      textElement.style.textOverflow = "clip";
      textElement.style.overflow = "visible";
      return;
    } else {
      textElement.style.textOverflow = "ellipsis";
      textElement.style.overflow = "hidden";
    }
    void textElement.offsetWidth;
    const isOverflowing =
      textElement.scrollWidth > containerElement.clientWidth;
    if (isOverflowing) {
      textElement.dataset.scrollTimeoutId = setTimeout(() => {
        if (
          textElement.scrollWidth > containerElement.clientWidth &&
          nowPlayingDetailsContainer &&
          !nowPlayingDetailsContainer.classList.contains("placeholder-text")
        ) {
          textElement.style.textOverflow = "clip";
          textElement.classList.add("scrolling-active");
        } else {
          textElement.classList.remove("scrolling-active");
          textElement.style.textOverflow = "ellipsis";
        }
      }, 2000).toString();
    } else {
      textElement.classList.remove("scrolling-active");
      textElement.style.textOverflow = "ellipsis";
    }
  }
  function updateTrackInfoDisplay(title, artist) {
    if (songTitleDisplay && songArtistDisplay && nowPlayingDetailsContainer) {
      const displayTitle = title || PLACEHOLDER_TITLE;
      const displayArtist = artist || PLACEHOLDER_ARTIST;
      songTitleDisplay.textContent = displayTitle;
      songTitleDisplay.title =
        displayTitle === PLACEHOLDER_TITLE ? "No track loaded" : displayTitle;
      songArtistDisplay.textContent = displayArtist;
      songArtistDisplay.title = displayArtist;
      nowPlayingDetailsContainer.classList.toggle(
        "placeholder-text",
        displayTitle === PLACEHOLDER_TITLE
      );
      if (songTitleDisplay.parentElement)
        checkAndApplyScrolling(
          songTitleDisplay,
          songTitleDisplay.parentElement
        );
      if (songArtistDisplay.parentElement)
        checkAndApplyScrolling(
          songArtistDisplay,
          songArtistDisplay.parentElement
        );
    }
  }

  // --- Visualizer Functions ---
  function setupVisualizer() {
    if (!visualizerCanvas) {
      console.warn(
        "setupVisualizer: Canvas element not found, skipping visualizer."
      );
      return;
    }
    if (!canvasCtx) canvasCtx = visualizerCanvas.getContext("2d");
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.error("Web Audio API is not supported.", e);
        return;
      }
    }
    if (audioContext.state === "suspended") {
      audioContext
        .resume()
        .catch((e) =>
          console.error("Error resuming AudioContext on setup:", e)
        );
    }
    if (!analyser) analyser = audioContext.createAnalyser();
    if (!sourceNode || sourceNode.mediaElement !== audioPlayer) {
      try {
        if (sourceNode && typeof sourceNode.disconnect === "function")
          sourceNode.disconnect();
        sourceNode = audioContext.createMediaElementSource(audioPlayer);
        sourceNode.connect(analyser);
        analyser.connect(audioContext.destination);
      } catch (e) {
        console.error(
          "Error creating/connecting MediaElementSource for visualizer:",
          e
        );
        return;
      }
    }
    analyser.fftSize = 256;
    visualizerBufferLength = analyser.frequencyBinCount;
    visualizerDataArray = new Uint8Array(visualizerBufferLength);
    if (visualizerCanvas.clientWidth > 0 && visualizerCanvas.clientHeight > 0) {
      visualizerCanvas.width = visualizerCanvas.clientWidth;
      visualizerCanvas.height = visualizerCanvas.clientHeight;
    } else {
      visualizerCanvas.width = 300;
      visualizerCanvas.height = 50;
      console.warn("Visualizer canvas has no dimensions, defaulting.");
    }
    if (isVisualizerActive) {
      if (visualizerAnimationId) cancelAnimationFrame(visualizerAnimationId);
      drawVisualizer();
    } else {
      stopVisualizer();
    }
  }
  function drawVisualizer() {
    if (
      !isVisualizerActive ||
      !analyser ||
      !canvasCtx ||
      !visualizerDataArray
    ) {
      if (isVisualizerActive && !analyser && visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
        visualizerAnimationId = null;
      } else if (isVisualizerActive && visualizerAnimationId) {
        visualizerAnimationId = requestAnimationFrame(drawVisualizer);
      }
      return;
    }
    visualizerAnimationId = requestAnimationFrame(drawVisualizer);
    analyser.getByteTimeDomainData(visualizerDataArray);
    canvasCtx.fillStyle = "rgb(30, 30, 30)";
    canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "rgb(0, 220, 100)";
    canvasCtx.beginPath();
    const sliceWidth = (visualizerCanvas.width * 1.0) / visualizerBufferLength;
    let x = 0;
    for (let i = 0; i < visualizerBufferLength; i++) {
      const v = visualizerDataArray[i] / 128.0;
      const y = (v * visualizerCanvas.height) / 2;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
      x += sliceWidth;
    }
    canvasCtx.lineTo(visualizerCanvas.width, visualizerCanvas.height / 2);
    canvasCtx.stroke();
  }
  function stopVisualizer() {
    if (visualizerAnimationId) {
      cancelAnimationFrame(visualizerAnimationId);
      visualizerAnimationId = null;
    }
    if (canvasCtx && visualizerCanvas) {
      canvasCtx.fillStyle = "rgb(30, 30, 30)";
      canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    }
  }
  function toggleVisualizer() {
    isVisualizerActive = !isVisualizerActive;
    if (vizToggleBtn) {
      vizToggleBtn.classList.toggle("active", isVisualizerActive);
      vizToggleBtn.title = isVisualizerActive
        ? "Turn Visualizer Off"
        : "Turn Visualizer On";
    }
    if (isVisualizerActive) {
      if (audioContext && !audioPlayer.paused) setupVisualizer();
      else if (canvasCtx && visualizerCanvas) {
        canvasCtx.fillStyle = "rgb(30, 30, 30)";
        canvasCtx.fillRect(
          0,
          0,
          visualizerCanvas.width,
          visualizerCanvas.height
        );
      }
    } else {
      stopVisualizer();
    }
  }

  // --- Equalizer Functions REMOVED ---
  // function applyEqualizerSettings() { ... }
  // function toggleEqualizer() { ... }

  // --- Audio Player Event Handlers ---
  if (audioPlayer) {
    audioPlayer.addEventListener("loadedmetadata", () => {
      if (
        durationDisplay &&
        seekBar &&
        audioPlayer.duration &&
        !isNaN(audioPlayer.duration)
      ) {
        durationDisplay.textContent = formatTime(audioPlayer.duration);
        seekBar.max = audioPlayer.duration;
        if (
          currentlyPlayingInfo?.path === audioPlayer.src &&
          (currentlyPlayingInfo.durationRaw == null ||
            isNaN(currentlyPlayingInfo.durationRaw))
        ) {
          currentlyPlayingInfo.durationRaw = audioPlayer.duration;
          currentlyPlayingInfo.durationFormatted = formatTime(
            audioPlayer.duration
          );
        }
      } else if (durationDisplay && seekBar) {
        durationDisplay.textContent = formatTime(0);
        seekBar.max = 0;
      }
    });
    audioPlayer.addEventListener("timeupdate", () => {
      if (
        currentTimeDisplay &&
        seekBar &&
        audioPlayer.duration &&
        !isNaN(audioPlayer.duration)
      ) {
        currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime);
        seekBar.value = audioPlayer.currentTime;
      } else if (currentTimeDisplay && seekBar) {
        currentTimeDisplay.textContent = formatTime(0);
        if (seekBar.value !== "0") seekBar.value = 0;
      }
    });
    audioPlayer.addEventListener("play", () => {
      if (audioPlayer.src && !audioPlayer.src.endsWith("index.html"))
        isPlayerExplicitlyStopped = false;
      if (playPauseBtn) playPauseBtn.innerHTML = pauseIcon;
      renderPlaylist();
      if (audioContext && audioContext.state === "suspended") {
        audioContext
          .resume()
          .then(() => {
            if (isVisualizerActive)
              setupVisualizer(); /* if(isEqActive) applyEqualizerSettings(); REMOVED EQ */
          })
          .catch((e) => console.error("Error resuming AudioContext:", e));
      } else {
        if (isVisualizerActive)
          setupVisualizer(); /* if(isEqActive) applyEqualizerSettings(); REMOVED EQ */
      }
    });
    audioPlayer.addEventListener("pause", () => {
      if (playPauseBtn) playPauseBtn.innerHTML = playIcon;
      renderPlaylist();
    });
    audioPlayer.addEventListener("ended", () => {
      isPlayerExplicitlyStopped = true;
      if (audioPlayer) audioPlayer.src = "";
      if (isVisualizerActive) stopVisualizer();
      playNextTrackLogic();
    });
    audioPlayer.addEventListener("error", (e) => {
      const errSrc = e.target.src;
      const cpiErr = { ...(currentlyPlayingInfo || {}) };
      currentlyPlayingInfo = null;
      isPlayerExplicitlyStopped = true;
      if (audioPlayer && audioPlayer.src === errSrc && audioPlayer.src !== "") {
        audioPlayer.src = "";
        audioPlayer.load();
      }
      const errName =
        cpiErr?.title ||
        cpiErr?.name ||
        (errSrc ? getFileName(errSrc, true) : "track");
      updateTrackInfoDisplay(`Error: (${errName})`, "Could not play file");
      if (currentTimeDisplay) currentTimeDisplay.textContent = formatTime(0);
      if (durationDisplay) durationDisplay.textContent = formatTime(0);
      if (seekBar) {
        seekBar.value = 0;
        seekBar.max = 0;
      }
      if (isVisualizerActive) stopVisualizer();
      renderPlaylist();
    });
    audioPlayer.addEventListener("volumechange", () => {
      updateVolumeSliderFill();
      updateVolumeIcon();
      if (window.electronAPI?.saveVolume)
        window.electronAPI.saveVolume(audioPlayer.volume);
    });
  }

  // --- UI Control Event Handlers ---
  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
      if (!audioPlayer) return;
      if (audioPlayer.paused) {
        const validSrc =
          audioPlayer.src &&
          !audioPlayer.src.endsWith("index.html") &&
          currentlyPlayingInfo;
        if (isPlayerExplicitlyStopped && !validSrc) {
          if (playlist.length > 0) {
            let idx =
              currentTrackIndex !== -1 && currentTrackIndex < playlist.length
                ? currentTrackIndex
                : 0;
            if (playlist[idx]) playTrack(idx, "playPause_stopped");
          }
        } else if (validSrc) {
          audioPlayer
            .play()
            .catch((e) =>
              updateTrackInfoDisplay(
                "Error.",
                currentlyPlayingInfo?.artist || ""
              )
            );
        } else if (playlist.length > 0) {
          let idx =
            currentTrackIndex !== -1 && currentTrackIndex < playlist.length
              ? currentTrackIndex
              : 0;
          if (playlist[idx]) playTrack(idx, "playPause_noSrc");
        }
      } else {
        audioPlayer.pause();
      }
    });
  }
  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      isPlayerExplicitlyStopped = true;
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.removeAttribute("src");
        audioPlayer.load();
        audioPlayer.currentTime = 0;
      }
      currentlyPlayingInfo = null;
      updateTrackInfoDisplay(PLACEHOLDER_TITLE, PLACEHOLDER_ARTIST);
      if (durationDisplay) durationDisplay.textContent = formatTime(0);
      if (seekBar) {
        seekBar.value = 0;
        seekBar.max = 0;
      }
      if (currentTimeDisplay) currentTimeDisplay.textContent = formatTime(0);
      if (playPauseBtn) playPauseBtn.innerHTML = playIcon;
      currentTrackIndex = -1;
      if (isVisualizerActive) stopVisualizer();
      renderPlaylist();
    });
  }
  if (fastForwardBtn)
    fastForwardBtn.addEventListener("click", () => {
      if (
        audioPlayer?.src &&
        !isNaN(audioPlayer.duration) &&
        audioPlayer.readyState >= 2
      )
        audioPlayer.currentTime = Math.min(
          audioPlayer.duration,
          audioPlayer.currentTime + 10
        );
    });
  if (seekBar)
    seekBar.addEventListener("input", () => {
      if (
        audioPlayer?.src &&
        !isNaN(audioPlayer.duration) &&
        audioPlayer.readyState >= 2
      )
        audioPlayer.currentTime = parseFloat(seekBar.value);
    });
  if (volumeSlider)
    volumeSlider.addEventListener("input", () => {
      if (audioPlayer) {
        audioPlayer.muted = false;
        audioPlayer.volume = parseFloat(volumeSlider.value);
      }
    });
  if (volumeIcon)
    volumeIcon.addEventListener("click", () => {
      if (audioPlayer) {
        audioPlayer.muted = !audioPlayer.muted;
        if (!audioPlayer.muted && audioPlayer.volume === 0) {
          const dUV = 0.1;
          audioPlayer.volume = dUV;
          if (volumeSlider) volumeSlider.value = dUV.toString();
        }
      }
    });
  // REMOVED EQ Toggle Button Listener
  // if (eqToggleBtn) eqToggleBtn.addEventListener("click", toggleEqualizer);
  if (vizToggleBtn) vizToggleBtn.addEventListener("click", toggleVisualizer);

  // --- Playlist Logic Functions ---
  function renderPlaylist() {
    if (!playlistUL) return;
    const scrollTop = playlistUL.scrollTop;
    playlistUL.innerHTML = "";
    selectedIndices = selectedIndices.filter((idx) => idx < playlist.length);
    if (playlist.length === 0) {
      const li = document.createElement("li");
      li.className = "playlist-drop-target";
      li.textContent = 'Drag & drop audio files here or use "Add Files"';
      playlistUL.appendChild(li);
      playlistUL.scrollTop = scrollTop;
      return;
    }
    playlist.forEach((track, index) => {
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.index = index;
      const tNS = document.createElement("span");
      tNS.className = "track-name-span";
      tNS.textContent = `${index + 1}. ${track.name}`;
      tNS.title = getFileName(track.path, true);
      li.appendChild(tNS);
      const dS = document.createElement("span");
      dS.className = "track-duration-span";
      dS.textContent = track.durationFormatted || "--:--";
      li.appendChild(dS);
      li.classList.remove(
        "playing-actual",
        "selected-ui",
        "selected",
        "drop-target-above",
        "drop-target-below"
      );
      if (
        currentlyPlayingInfo?.path === track.path &&
        !audioPlayer.paused &&
        !audioPlayer.ended &&
        !isPlayerExplicitlyStopped
      )
        li.classList.add("playing-actual");
      if (index === currentTrackIndex) li.classList.add("selected-ui");
      if (selectedIndices.includes(index)) li.classList.add("selected");
      li.addEventListener("click", (e) => {
        if (e.shiftKey && lastClickedIndex !== -1) {
          selectedIndices = [];
          const s = Math.min(index, lastClickedIndex),
            en = Math.max(index, lastClickedIndex);
          for (let i = s; i <= en; i++)
            if (!selectedIndices.includes(i)) selectedIndices.push(i);
        } else if (e.ctrlKey || e.metaKey) {
          const p = selectedIndices.indexOf(index);
          if (p > -1) selectedIndices.splice(p, 1);
          else selectedIndices.push(index);
        } else {
          selectedIndices = [index];
        }
        currentTrackIndex = index;
        lastClickedIndex = index;
        renderPlaylist();
      });
      li.addEventListener("dblclick", () => {
        currentTrackIndex = index;
        selectedIndices = [index];
        playTrack(index, "dblclick");
      });
      li.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (!selectedIndices.includes(index)) {
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            selectedIndices = [index];
            currentTrackIndex = index;
            lastClickedIndex = index;
          } else {
            if (!selectedIndices.includes(index)) selectedIndices.push(index);
          }
          renderPlaylist();
        }
        if (window.electronAPI?.showPlaylistContextMenu)
          window.electronAPI.showPlaylistContextMenu(index, [
            ...selectedIndices,
          ]);
      });
      li.addEventListener("dragstart", (e) => {
        draggedItemIndex = index;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index.toString());
        if (e.target instanceof HTMLElement) e.target.style.opacity = "0.5";
      });
      li.addEventListener("dragend", (e) => {
        if (e.target instanceof HTMLElement) e.target.style.opacity = "1";
        playlistUL
          .querySelectorAll(".drop-target-above, .drop-target-below")
          .forEach((i) =>
            i.classList.remove("drop-target-above", "drop-target-below")
          );
        draggedItemIndex = null;
        dropTargetIndex = null;
      });
      playlistUL.appendChild(li);
    });
    playlistUL.scrollTop = scrollTop;
  }
  async function addFilesToPlaylist(
    filePaths,
    playFirstNew = false,
    insertAtIndex = -1
  ) {
    const oldLen = playlist.length;
    let firstNewIdxInPlaylist = -1;
    let newTracksAddedCount = 0;
    const originalDisplayTitle =
      songTitleDisplay?.textContent || PLACEHOLDER_TITLE;
    const originalDisplayArtist =
      songArtistDisplay?.textContent || PLACEHOLDER_ARTIST;
    const existingPathsInPlaylist = new Set(playlist.map((t) => t.path));
    updateTrackInfoDisplay("Loading songs...", "");
    let tempNewTracks = [];
    for (let i = 0; i < filePaths.length; i++) {
      const path = filePaths[i];
      if (existingPathsInPlaylist.has(path)) {
        continue;
      }
      const name = getFileName(path, false);
      if (filePaths.length > 1)
        updateTrackInfoDisplay(
          `Loading: ${name}`,
          `(${i + 1}/${filePaths.length})`
        );
      const metadataFromIPC = await fetchTrackMetadata(path);
      let durationRaw = metadataFromIPC.duration;
      let durationFormatted = "--:--";
      if (durationRaw == null || isNaN(durationRaw)) {
        console.warn(
          `Renderer: Duration for ${name} NOT VALID from IPC (value: ${durationRaw}). FALLING BACK to slow getAudioDuration.`
        );
        durationRaw = await getAudioDuration(path);
      }
      if (durationRaw != null && !isNaN(durationRaw)) {
        durationFormatted = formatTime(durationRaw);
      }
      const newTrack = {
        path,
        name,
        title: metadataFromIPC.title,
        artist: metadataFromIPC.artist,
        album: metadataFromIPC.album,
        durationRaw,
        durationFormatted,
      };
      tempNewTracks.push(newTrack);
      existingPathsInPlaylist.add(path);
      newTracksAddedCount++;
    }
    if (newTracksAddedCount > 0) {
      let actualInsertionPoint;
      if (insertAtIndex !== -1 && insertAtIndex <= playlist.length) {
        playlist.splice(insertAtIndex, 0, ...tempNewTracks);
        actualInsertionPoint = insertAtIndex;
        if (currentTrackIndex >= insertAtIndex)
          currentTrackIndex += newTracksAddedCount;
        selectedIndices = selectedIndices
          .map((idx) =>
            idx >= insertAtIndex ? idx + newTracksAddedCount : idx
          )
          .filter((idx) => idx < playlist.length);
        if (isShuffleActive && originalPlaylistOrder)
          originalPlaylistOrder.splice(
            insertAtIndex,
            0,
            ...tempNewTracks.map((t) => ({ ...t }))
          );
      } else {
        playlist.push(...tempNewTracks);
        actualInsertionPoint = oldLen;
        if (isShuffleActive && originalPlaylistOrder)
          tempNewTracks.forEach((nt) => {
            if (!originalPlaylistOrder.some((ot) => ot.path === nt.path))
              originalPlaylistOrder.push({ ...nt });
          });
      }
      if (firstNewIdxInPlaylist === -1 && tempNewTracks.length > 0)
        firstNewIdxInPlaylist = actualInsertionPoint;
    }
    if (currentlyPlayingInfo)
      updateTrackInfoDisplay(
        currentlyPlayingInfo.title || currentlyPlayingInfo.name,
        currentlyPlayingInfo.artist
      );
    else if (
      newTracksAddedCount > 0 &&
      (playFirstNew || oldLen === 0) &&
      firstNewIdxInPlaylist !== -1 &&
      playlist[firstNewIdxInPlaylist]
    ) {
      const firstTrack = playlist[firstNewIdxInPlaylist];
      updateTrackInfoDisplay(
        firstTrack.title || firstTrack.name,
        firstTrack.artist
      );
    } else if (originalDisplayTitle !== "Loading songs...")
      updateTrackInfoDisplay(originalDisplayTitle, originalDisplayArtist);
    else updateTrackInfoDisplay(PLACEHOLDER_TITLE, PLACEHOLDER_ARTIST);
    renderPlaylist();
    if (
      newTracksAddedCount > 0 &&
      (playFirstNew || oldLen === 0) &&
      firstNewIdxInPlaylist !== -1
    ) {
      playTrack(firstNewIdxInPlaylist, "addFilesToPlaylist_playFirstNew");
    }
  }
  function playTrack(index, calledFrom = "unknown") {
    console.log(`DEBUG: playTrack - ${calledFrom} index: ${index}`);
    if (!audioPlayer || !songTitleDisplay || !songArtistDisplay) return;
    if (index >= 0 && index < playlist.length) {
      currentTrackIndex = index;
      selectedIndices = [index];
      lastClickedIndex = index;
      const track = playlist[index];
      if (track?.path) {
        const needsNew =
          currentlyPlayingInfo?.path !== track.path ||
          isPlayerExplicitlyStopped ||
          audioPlayer.error ||
          audioPlayer.ended ||
          !audioPlayer.src ||
          audioPlayer.src.endsWith("index.html") ||
          audioPlayer.src === window.location.href + "#";
        if (needsNew) {
          audioPlayer.src = track.path;
          currentlyPlayingInfo = { ...track };
          updateTrackInfoDisplay(track.title || track.name, track.artist);
          if (currentTimeDisplay)
            currentTimeDisplay.textContent = formatTime(0);
          if (durationDisplay) durationDisplay.textContent = formatTime(0);
          if (seekBar) {
            seekBar.value = 0;
            seekBar.max = 0;
          }
          const pP = audioPlayer.play();
          if (pP)
            pP.then(() => {
              isPlayerExplicitlyStopped = false;
            }).catch((e) => {
              updateTrackInfoDisplay(
                `Error: (${track.title || track.name})`,
                "Playback failed"
              );
              currentlyPlayingInfo = null;
              isPlayerExplicitlyStopped = true;
              if (audioPlayer) {
                audioPlayer.src = "";
                audioPlayer.load();
              }
            });
          else isPlayerExplicitlyStopped = true;
        } else {
          updateTrackInfoDisplay(track.title || track.name, track.artist);
          if (audioPlayer.paused) {
            audioPlayer.play().catch((e) => (isPlayerExplicitlyStopped = true));
          }
        }
      } else {
        if (!currentlyPlayingInfo)
          updateTrackInfoDisplay("Error: Invalid track.", "");
      }
    } else {
      if (
        isPlayerExplicitlyStopped ||
        !audioPlayer.src ||
        audioPlayer.src.endsWith("index.html")
      ) {
        if (audioPlayer) {
          audioPlayer.pause();
          audioPlayer.removeAttribute("src");
          audioPlayer.load();
        }
        currentlyPlayingInfo = null;
        updateTrackInfoDisplay(PLACEHOLDER_TITLE, PLACEHOLDER_ARTIST);
        if (durationDisplay && seekBar) {
          durationDisplay.textContent = formatTime(0);
          seekBar.value = 0;
          seekBar.max = 0;
        }
        if (currentTimeDisplay) currentTimeDisplay.textContent = formatTime(0);
        currentTrackIndex = -1;
        isPlayerExplicitlyStopped = true;
        if (isVisualizerActive) stopVisualizer();
      }
    }
    renderPlaylist();
  }
  function removeTracks(indicesToRemove) {
    if (!indicesToRemove?.length) return;
    indicesToRemove.sort((a, b) => b - a);
    let newUiIdx = currentTrackIndex;
    let playingRemoved = false;
    indicesToRemove.forEach((idxR) => {
      if (idxR < 0 || idxR >= playlist.length) return;
      const rem = playlist.splice(idxR, 1)[0];
      if (rem && currentlyPlayingInfo?.path === rem.path) playingRemoved = true;
      if (isShuffleActive && originalPlaylistOrder) {
        const oI = originalPlaylistOrder.findIndex((t) => t.path === rem?.path);
        if (oI > -1) originalPlaylistOrder.splice(oI, 1);
      }
      if (idxR < newUiIdx) newUiIdx--;
    });
    if (playlist.length === 0) {
      currentTrackIndex = -1;
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.removeAttribute("src");
        audioPlayer.load();
        if (isVisualizerActive) stopVisualizer();
      }
      currentlyPlayingInfo = null;
      updateTrackInfoDisplay(PLACEHOLDER_TITLE, PLACEHOLDER_ARTIST);
      if (durationDisplay && seekBar) {
        durationDisplay.textContent = formatTime(0);
        seekBar.value = 0;
        seekBar.max = 0;
      }
      if (currentTimeDisplay) currentTimeDisplay.textContent = formatTime(0);
      isPlayerExplicitlyStopped = true;
    } else {
      currentTrackIndex = Math.max(0, Math.min(newUiIdx, playlist.length - 1));
      if (playingRemoved) {
        if (playlist[currentTrackIndex] && currentTrackIndex !== -1)
          playTrack(currentTrackIndex, "remove_playNext");
        else {
          if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.removeAttribute("src");
            audioPlayer.load();
            if (isVisualizerActive) stopVisualizer();
          }
          currentlyPlayingInfo = null;
          updateTrackInfoDisplay(PLACEHOLDER_TITLE, PLACEHOLDER_ARTIST);
          isPlayerExplicitlyStopped = true;
          currentTrackIndex = -1;
        }
      }
    }
    selectedIndices =
      currentTrackIndex !== -1 && playlist.length > 0
        ? [currentTrackIndex]
        : [];
    lastClickedIndex = currentTrackIndex;
    if (
      !currentlyPlayingInfo &&
      playlist.length > 0 &&
      currentTrackIndex !== -1 &&
      playlist[currentTrackIndex]
    ) {
      const curD = playlist[currentTrackIndex];
      updateTrackInfoDisplay(curD.title || curD.name, curD.artist);
    } else if (!currentlyPlayingInfo)
      updateTrackInfoDisplay(PLACEHOLDER_TITLE, PLACEHOLDER_ARTIST);
    renderPlaylist();
  }
  function playNextTrackLogic() {
    if (playlist.length === 0) {
      if (isVisualizerActive) stopVisualizer();
      return;
    }
    let newIdx = currentTrackIndex + 1;
    if (newIdx >= playlist.length) newIdx = 0;
    playTrack(newIdx, "nextLogic");
  }
  function playPrevTrackLogic() {
    if (playlist.length === 0) {
      if (isVisualizerActive) stopVisualizer();
      return;
    }
    let newIdx = currentTrackIndex - 1;
    if (newIdx < 0) newIdx = playlist.length - 1;
    playTrack(newIdx, "prevLogic");
  }
  function updateShuffleButtonUI() {
    if (!shuffleBtn) return;
    shuffleBtn.classList.toggle("shuffle-active", isShuffleActive);
    shuffleBtn.innerHTML = `<i class="fas fa-random"></i>`;
    shuffleBtn.title = isShuffleActive ? "Shuffle: On" : "Shuffle: Off";
  }
  function shuffleCurrentPlaylist() {
    if (playlist.length < 2) return;
    const cPIS = currentlyPlayingInfo ? { ...currentlyPlayingInfo } : null;
    if (
      !originalPlaylistOrder?.length ||
      playlist.some((t, i) => t.path !== originalPlaylistOrder[i]?.path)
    )
      originalPlaylistOrder = playlist.map((t) => ({ ...t }));
    for (let i = playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
    }
    if (cPIS) {
      currentTrackIndex = playlist.findIndex((t) => t.path === cPIS.path);
      if (currentTrackIndex === -1 && playlist.length > 0)
        currentTrackIndex = 0;
    } else if (playlist.length > 0) currentTrackIndex = 0;
    else currentTrackIndex = -1;
    selectedIndices = currentTrackIndex > -1 ? [currentTrackIndex] : [];
    lastClickedIndex = currentTrackIndex;
  }
  function unshufflePlaylist() {
    if (originalPlaylistOrder?.length) {
      const cPIS = currentlyPlayingInfo ? { ...currentlyPlayingInfo } : null;
      playlist = originalPlaylistOrder.map((t) => ({ ...t }));
      if (cPIS) {
        currentTrackIndex = playlist.findIndex((t) => t.path === cPIS.path);
        if (currentTrackIndex === -1 && playlist.length > 0)
          currentTrackIndex = 0;
      } else if (playlist.length > 0) currentTrackIndex = 0;
      else currentTrackIndex = -1;
      selectedIndices = currentTrackIndex > -1 ? [currentTrackIndex] : [];
      lastClickedIndex = currentTrackIndex;
      originalPlaylistOrder = [];
    }
  }

  // --- Event Listeners for Playback/File Controls ---
  if (prevBtn) prevBtn.addEventListener("click", playPrevTrackLogic);
  if (nextBtn) nextBtn.addEventListener("click", playNextTrackLogic);
  if (shuffleBtn)
    shuffleBtn.addEventListener("click", () => {
      isShuffleActive = !isShuffleActive;
      if (isShuffleActive) shuffleCurrentPlaylist();
      else unshufflePlaylist();
      updateShuffleButtonUI();
      renderPlaylist();
    });
  if (addFilesBtn)
    addFilesBtn.addEventListener("click", async () => {
      try {
        if (window.electronAPI?.openFiles) {
          const p = await window.electronAPI.openFiles();
          if (p?.length) await addFilesToPlaylist(p, playlist.length === 0, -1);
        } else console.error("API missing.");
      } catch (err) {
        console.error("Add files err:", err);
      }
    });

  // --- Playlist Toggle Logic ---
  function updatePlaylistToggleBtnTextDOM() {
    if (!playlistToggleBtn || !playlistContainer) return;
    const hidden = playlistContainer.classList.contains("hidden");
    playlistToggleBtn.innerHTML = `<i class="fas fa-list-ul"></i> ${
      hidden ? "Show" : "Hide"
    } Playlist`;
    playlistToggleBtn.title = `${hidden ? "Show" : "Hide"} Playlist`;
  }
  function setPlaylistUIVisibilityDOM(visible) {
    if (!playlistContainer || !mainPlayerPanel) return;
    if (visible) {
      playlistContainer.classList.remove("hidden");
      mainPlayerPanel.classList.add("with-playlist");
    } else {
      playlistContainer.classList.add("hidden");
      mainPlayerPanel.classList.remove("with-playlist");
    }
    updatePlaylistToggleBtnTextDOM();
  }
  function toggleDockedPlaylistDOM() {
    if (!playlistContainer) return;
    const show = playlistContainer.classList.contains("hidden");
    setPlaylistUIVisibilityDOM(show);
    if (window.electronAPI?.resizeMainWindowAndSaveVisibility) {
      const opt = show ? "player_with_playlist" : "player_only";
      window.electronAPI.resizeMainWindowAndSaveVisibility(
        PLAYER_FIXED_WIDTH,
        opt,
        show
      );
    } else console.error("Resize API missing.");
  }
  if (playlistToggleBtn)
    playlistToggleBtn.addEventListener("click", toggleDockedPlaylistDOM);
  if (closePlaylistPanelBtn)
    closePlaylistPanelBtn.addEventListener("click", () => {
      if (playlistContainer && !playlistContainer.classList.contains("hidden"))
        toggleDockedPlaylistDOM();
    });

  // --- DRAG AND DROP ---
  if (playlistUL) {
    playlistUL.addEventListener("dragenter", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.types.includes("Files"))
        playlistContainer.classList.add("dragover-active");
    });
    playlistUL.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.types.includes("Files")) {
        e.dataTransfer.dropEffect = "copy";
        if (playlistContainer)
          playlistContainer.classList.add("dragover-active");
      } else e.dataTransfer.dropEffect = "move";
      if (draggedItemIndex !== null) {
        const tLi = e.target.closest("li:not(.playlist-drop-target)");
        playlistUL
          .querySelectorAll(".drop-target-above,.drop-target-below")
          .forEach((i) =>
            i.classList.remove("drop-target-above", "drop-target-below")
          );
        if (tLi?.dataset.index !== undefined) {
          const tIdx = parseInt(tLi.dataset.index, 10);
          if (tIdx !== draggedItemIndex) {
            const r = tLi.getBoundingClientRect();
            if (e.clientY < r.top + r.height / 2) {
              tLi.classList.add("drop-target-above");
              dropTargetIndex = tIdx;
            } else {
              tLi.classList.add("drop-target-below");
              dropTargetIndex = tIdx + 1;
            }
          } else dropTargetIndex = null;
        } else {
          dropTargetIndex = playlist.length;
          const eP = playlistUL.querySelector(".playlist-drop-target");
          if (eP) eP.classList.add("dragover-active-direct");
        }
      }
    });
    playlistUL.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.relatedTarget && !playlistUL.contains(e.relatedTarget)) {
        if (playlistContainer)
          playlistContainer.classList.remove("dragover-active");
        playlistUL
          .querySelectorAll(
            ".drop-target-above,.drop-target-below,.playlist-drop-target.dragover-active-direct"
          )
          .forEach((i) =>
            i.classList.remove(
              "drop-target-above",
              "drop-target-below",
              "dragover-active-direct"
            )
          );
      }
    });
    playlistUL.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (playlistContainer)
        playlistContainer.classList.remove("dragover-active");
      playlistUL
        .querySelectorAll(
          ".drop-target-above,.drop-target-below,.playlist-drop-target.dragover-active-direct"
        )
        .forEach((i) =>
          i.classList.remove(
            "drop-target-above",
            "drop-target-below",
            "dragover-active-direct"
          )
        );
      if (draggedItemIndex !== null && dropTargetIndex !== null) {
        if (
          draggedItemIndex !== dropTargetIndex &&
          draggedItemIndex !== dropTargetIndex - 1
        ) {
          const item = playlist.splice(draggedItemIndex, 1)[0];
          const actualAt =
            draggedItemIndex < dropTargetIndex
              ? dropTargetIndex - 1
              : dropTargetIndex;
          playlist.splice(actualAt, 0, item);
          if (currentlyPlayingInfo) {
            const newPlayIdx = playlist.findIndex(
              (t) => t.path === currentlyPlayingInfo.path
            );
            if (newPlayIdx !== -1) currentTrackIndex = newPlayIdx;
            else {
              currentlyPlayingInfo = null;
              currentTrackIndex = -1;
            }
          } else if (playlist.length > 0)
            currentTrackIndex = actualAt < playlist.length ? actualAt : 0;
          else currentTrackIndex = -1;
          selectedIndices = [currentTrackIndex];
          lastClickedIndex = currentTrackIndex;
          if (
            isShuffleActive &&
            originalPlaylistOrder.length === playlist.length
          ) {
            const movedO = originalPlaylistOrder.splice(draggedItemIndex, 1)[0];
            originalPlaylistOrder.splice(actualAt, 0, movedO);
          }
          renderPlaylist();
        }
      } else {
        const files = e.dataTransfer.files;
        if (files?.length) {
          const audioP = Array.from(files)
            .filter(
              (f) =>
                f.type.startsWith("audio/") ||
                /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)
            )
            .map((f) => f.path);
          if (audioP.length > 0) {
            let insExtIdx = playlist.length;
            const dLi = e.target.closest("li:not(.playlist-drop-target)");
            if (dLi?.dataset.index !== undefined) {
              const tI = parseInt(dLi.dataset.index, 10);
              const r = dLi.getBoundingClientRect();
              if (e.clientY < r.top + r.height / 2) insExtIdx = tI;
              else insExtIdx = tI + 1;
            } else if (
              playlistUL.querySelector(".playlist-drop-target") &&
              playlist.length === 0
            )
              insExtIdx = 0;
            await addFilesToPlaylist(
              audioP,
              playlist.length === 0 && insExtIdx <= 0,
              insExtIdx
            );
          }
        }
      }
      draggedItemIndex = null;
      dropTargetIndex = null;
    });
  }
  const bodyDropZone = document.body;
  if (bodyDropZone && mainPlayerPanel) {
    bodyDropZone.addEventListener("dragover", (e) => {
      if (playlistUL.contains(e.target)) {
        if (mainPlayerPanel.classList.contains("dragover-body"))
          mainPlayerPanel.classList.remove("dragover-body");
        return;
      }
      if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        mainPlayerPanel.classList.add("dragover-body");
      } else if (draggedItemIndex !== null) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "none";
        if (mainPlayerPanel.classList.contains("dragover-body"))
          mainPlayerPanel.classList.remove("dragover-body");
      }
    });
    bodyDropZone.addEventListener("dragleave", (e) => {
      if (mainPlayerPanel.classList.contains("dragover-body")) {
        if (!e.relatedTarget || !mainPlayerPanel.contains(e.relatedTarget))
          mainPlayerPanel.classList.remove("dragover-body");
      }
    });
    bodyDropZone.addEventListener("drop", async (e) => {
      if (playlistUL.contains(e.target)) return;
      if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        e.stopPropagation();
        mainPlayerPanel.classList.remove("dragover-body");
        const files = e.dataTransfer.files;
        if (files?.length) {
          const audioP = Array.from(files)
            .filter(
              (f) =>
                f.type.startsWith("audio/") ||
                /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)
            )
            .map((f) => f.path);
          if (audioP.length > 0)
            await addFilesToPlaylist(audioP, playlist.length === 0, -1);
        }
      }
    });
  }

  // --- IPC Event Handlers ---
  if (window.electronAPI?.onContextMenuCommand)
    window.electronAPI.onContextMenuCommand((cmd, data) => {
      if (cmd === "remove-tracks") removeTracks(data);
    });
  if (window.electronAPI?.onSetInitialPlaylistVisibility)
    window.electronAPI.onSetInitialPlaylistVisibility((vis) =>
      setPlaylistUIVisibilityDOM(vis)
    );
  if (window.electronAPI?.onSetInitialVolume)
    window.electronAPI.onSetInitialVolume((vol) => {
      if (audioPlayer && typeof vol === "number") audioPlayer.volume = vol;
      if (volumeSlider && typeof vol === "number")
        volumeSlider.value = vol.toString();
      updateVolumeSliderFill();
      updateVolumeIcon();
    });
  if (window.electronAPI?.onOpenFileInPlayer) {
    window.electronAPI.onOpenFileInPlayer(async (filePath) => {
      if (filePath && typeof filePath === "string") {
        const trackExistsIdx = playlist.findIndex((t) => t.path === filePath);
        if (trackExistsIdx !== -1) {
          isPlayerExplicitlyStopped = false;
          playTrack(trackExistsIdx, "ipc_existing");
        } else {
          const name = getFileName(filePath, false);
          if (playlist.length === 0)
            updateTrackInfoDisplay(`Loading: ${name}`, "");
          const metadataFromIPC = await fetchTrackMetadata(filePath);
          let durationRaw = metadataFromIPC.duration;
          let durationFormatted = "--:--";
          if (durationRaw == null || isNaN(durationRaw)) {
            console.warn(
              `Renderer: Duration for ${name} (IPC open) NOT VALID from IPC (${durationRaw}). FALLING BACK.`
            );
            durationRaw = await getAudioDuration(filePath);
          }
          if (durationRaw != null && !isNaN(durationRaw))
            durationFormatted = formatTime(durationRaw);

          const newTrack = {
            path: filePath,
            name,
            title: metadataFromIPC.title,
            artist: metadataFromIPC.artist,
            album: metadataFromIPC.album,
            durationRaw,
            durationFormatted,
          };
          playlist.push(newTrack);
          renderPlaylist();
          const newIdx = playlist.length - 1;
          isPlayerExplicitlyStopped = false;
          playTrack(newIdx, "ipc_new");
        }
      }
    });
  } else console.warn("File open IPC missing.");

  // --- Select All (Ctrl+A / Cmd+A) for Playlist ---
  document.addEventListener("keydown", (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === "a" || event.key === "A")
    ) {
      if (
        playlistContainer &&
        !playlistContainer.classList.contains("hidden") &&
        playlist.length > 0
      ) {
        let targetIsSafeForSelectAll = true;
        if (document.activeElement) {
          const tagName = document.activeElement.tagName.toLowerCase();
          if (
            (tagName === "input" ||
              tagName === "textarea" ||
              tagName === "select") &&
            !(
              playlistUL.contains(document.activeElement) ||
              mainPlayerPanel.contains(document.activeElement)
            )
          ) {
            targetIsSafeForSelectAll = false;
          }
        }
        if (targetIsSafeForSelectAll) {
          event.preventDefault();
          selectedIndices = Array.from(
            { length: playlist.length },
            (_, i) => i
          );
          if (playlist.length > 0 && currentTrackIndex === -1)
            currentTrackIndex = 0;
          lastClickedIndex = currentTrackIndex !== -1 ? currentTrackIndex : 0;
          renderPlaylist();
        }
      }
    }
  });

  // --- Initial Setup ---
  renderPlaylist();
  updatePlaylistToggleBtnTextDOM();
  updateShuffleButtonUI();
  // Initialize EQ button REMOVED
  // if (eqToggleBtn && eqIndicator) { ... }
  if (vizToggleBtn) {
    // Initialize visualizer toggle button state
    vizToggleBtn.classList.toggle("active", isVisualizerActive);
    vizToggleBtn.title = isVisualizerActive
      ? "Turn Visualizer Off"
      : "Turn Visualizer On";
  }
  setTimeout(() => {
    if (
      audioPlayer &&
      volumeSlider &&
      typeof audioPlayer.volume === "number" &&
      typeof volumeSlider.value === "string"
    ) {
      if (
        audioPlayer.volume.toFixed(2) !==
        parseFloat(volumeSlider.value).toFixed(2)
      ) {
        if (volumeSlider) volumeSlider.value = audioPlayer.volume.toString();
      }
    }
    updateVolumeSliderFill();
    updateVolumeIcon();
    updateTrackInfoDisplay(PLACEHOLDER_TITLE, PLACEHOLDER_ARTIST);
    if (currentTimeDisplay) currentTimeDisplay.textContent = formatTime(0);
    if (durationDisplay) durationDisplay.textContent = formatTime(0);
    if (seekBar) {
      seekBar.value = 0;
      seekBar.max = 0;
    }
    if (visualizerCanvas) {
      if (!canvasCtx) canvasCtx = visualizerCanvas.getContext("2d");
      if (canvasCtx) {
        if (
          !isVisualizerActive ||
          (audioPlayer && audioPlayer.paused && isPlayerExplicitlyStopped)
        ) {
          stopVisualizer();
        }
      }
    }
  }, 100);
  console.log("Renderer: Script finished initialization.");
});
