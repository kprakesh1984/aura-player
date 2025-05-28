document.addEventListener("DOMContentLoaded", () => {
  console.log("Renderer DOMContentLoaded: Script starting.");

  // DOM Element References
  const audioPlayer = document.getElementById("audioPlayer");
  const songNameDisplay = document.getElementById("songName");
  const songNameContainer = document.querySelector(".song-name-container");
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

  if (
    !audioPlayer ||
    !songNameDisplay ||
    !songNameContainer ||
    !mainPlayerPanel ||
    !playPauseBtn ||
    !prevBtn ||
    !nextBtn ||
    !stopBtn ||
    !shuffleBtn ||
    !fastForwardBtn ||
    !seekBar ||
    !currentTimeDisplay ||
    !durationDisplay ||
    !volumeIcon ||
    !volumeSlider ||
    !addFilesBtn ||
    !playlistContainer ||
    !playlistUL ||
    !playlistToggleBtn ||
    !closePlaylistPanelBtn
  ) {
    console.error(
      "CRITICAL ERROR: One or more essential DOM elements not found."
    );
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
  let draggedItemIndex = null;
  let dropTargetIndex = null;

  // --- Helper Functions ---
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }
  function getFileName(filePath) {
    if (!filePath) return "Unknown Song";
    return filePath.split(/[\\/]/).pop() || "Unknown Song";
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
    /* ... same stable version ... */ return new Promise((resolve) => {
      const tA = new Audio();
      tA.preload = "metadata";
      tA.src = filePath;
      let r = false;
      const rWN = (reason = "unknown") => {
        if (!r) {
          r = true;
          tA.onerror = null;
          tA.onloadedmetadata = null;
          tA.oncanplaythrough = null;
          tA.src = "";
          resolve(null);
        }
      };
      tA.onloadedmetadata = () => {
        if (!r) {
          r = true;
          tA.onerror = null;
          tA.oncanplaythrough = null;
          const d = tA.duration;
          tA.src = "";
          resolve(isNaN(d) ? null : d);
        }
      };
      tA.onerror = (e) => {
        console.error(
          `Meta err ${getFileName(filePath)}:`,
          e.target.error?.code,
          e.target.error?.message
        );
        rWN("audio_element_error");
      };
      setTimeout(() => {
        if (!r) {
          rWN("timeout");
        }
      }, 7000);
    });
  }
  function checkAndApplySongNameScrolling() {
    if (!songNameDisplay || !songNameContainer) return;
    if (songScrollTimeout) {
      clearTimeout(songScrollTimeout);
      songScrollTimeout = null;
    }
    songNameDisplay.classList.remove("scrolling-active");
    songNameDisplay.style.paddingLeft = "";
    const iPA = songNameContainer.classList.contains("placeholder-text");
    if (iPA) {
      songNameDisplay.style.textOverflow = "clip";
      songNameDisplay.style.overflow = "visible";
      return;
    } else {
      songNameDisplay.style.textOverflow = "ellipsis";
      songNameDisplay.style.overflow = "hidden";
    }
    void songNameDisplay.offsetWidth;
    const iO = songNameDisplay.scrollWidth > songNameContainer.clientWidth;
    if (iO) {
      songScrollTimeout = setTimeout(() => {
        if (
          songNameDisplay.scrollWidth > songNameContainer.clientWidth &&
          !songNameContainer.classList.contains("placeholder-text")
        ) {
          songNameDisplay.style.textOverflow = "clip";
          songNameDisplay.classList.add("scrolling-active");
        } else {
          songNameDisplay.classList.remove("scrolling-active");
          songNameDisplay.style.textOverflow = "ellipsis";
        }
      }, 2000);
    } else {
      songNameDisplay.classList.remove("scrolling-active");
      songNameDisplay.style.textOverflow = "ellipsis";
    }
  }
  function updateSongDisplay(text) {
    if (songNameDisplay && songNameContainer) {
      const displayText =
        text === "None" ||
        text === null ||
        text === undefined ||
        text.trim() === "" ||
        text.trim() === PLACEHOLDER_SONG_NAME
          ? PLACEHOLDER_SONG_NAME
          : text;
      songNameDisplay.textContent = displayText;
      songNameDisplay.title =
        displayText === PLACEHOLDER_SONG_NAME ? "No song playing" : text;
      if (displayText === PLACEHOLDER_SONG_NAME || text.startsWith("Error:")) {
        songNameContainer.classList.add("placeholder-text");
      } else {
        songNameContainer.classList.remove("placeholder-text");
      }
      checkAndApplySongNameScrolling();
    }
  }

  // --- Audio Player Event Handlers ---
  if (audioPlayer) {
    audioPlayer.addEventListener("loadedmetadata", () => {
      if (durationDisplay && seekBar && currentlyPlayingInfo) {
        durationDisplay.textContent = formatTime(audioPlayer.duration);
        seekBar.max = audioPlayer.duration;
        if (
          currentlyPlayingInfo.path === audioPlayer.src &&
          (currentlyPlayingInfo.durationRaw == null ||
            isNaN(currentlyPlayingInfo.durationRaw))
        ) {
          currentlyPlayingInfo.durationRaw = audioPlayer.duration;
          currentlyPlayingInfo.durationFormatted = formatTime(
            audioPlayer.duration
          );
        }
      }
    });
    audioPlayer.addEventListener("timeupdate", () => {
      if (currentTimeDisplay && seekBar && audioPlayer.duration) {
        currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime);
        seekBar.value = audioPlayer.currentTime;
      }
    });
    audioPlayer.addEventListener("play", () => {
      if (
        audioPlayer.src &&
        audioPlayer.src !== "" &&
        !audioPlayer.src.endsWith("index.html")
      ) {
        isPlayerExplicitlyStopped = false;
      }
      if (playPauseBtn) playPauseBtn.innerHTML = pauseIcon;
      renderPlaylist();
    });
    audioPlayer.addEventListener("pause", () => {
      if (playPauseBtn) playPauseBtn.innerHTML = playIcon;
      renderPlaylist();
    });
    audioPlayer.addEventListener("ended", () => {
      currentlyPlayingInfo = null;
      isPlayerExplicitlyStopped = true;
      if (audioPlayer) audioPlayer.src = "";
      playNextTrackLogic();
    });
    audioPlayer.addEventListener("error", (e) => {
      const erroredSrc = e.target.src;
      const cpiPathBeforeError = currentlyPlayingInfo?.path;
      currentlyPlayingInfo = null;
      isPlayerExplicitlyStopped = true;
      if (
        audioPlayer &&
        audioPlayer.src === erroredSrc &&
        audioPlayer.src !== ""
      ) {
        audioPlayer.src = "";
        audioPlayer.load();
      }
      if (songNameDisplay) {
        const trackName =
          playlist.find((t) => t.path === cpiPathBeforeError)?.name ||
          (erroredSrc ? getFileName(erroredSrc) : "track");
        updateSongDisplay(`Error: Could not play (${trackName || "Unknown"})`);
      }
      renderPlaylist();
    });
    audioPlayer.addEventListener("volumechange", () => {
      updateVolumeSliderFill();
      updateVolumeIcon();
      if (
        window.electronAPI &&
        typeof window.electronAPI.saveVolume === "function"
      ) {
        window.electronAPI.saveVolume(audioPlayer.volume);
      }
    });
  }

  // --- UI Control Event Handlers ---
  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
      if (audioPlayer) {
        if (audioPlayer.paused) {
          const hasValidSrcAndInfo =
            audioPlayer.src &&
            audioPlayer.src !== "" &&
            !audioPlayer.src.endsWith("index.html") &&
            currentlyPlayingInfo;
          if (isPlayerExplicitlyStopped && !hasValidSrcAndInfo) {
            if (playlist.length > 0) {
              let indexToPlay =
                currentTrackIndex !== -1 && currentTrackIndex < playlist.length
                  ? currentTrackIndex
                  : 0;
              if (playlist[indexToPlay]) {
                playTrack(
                  indexToPlay,
                  "playPauseBtn_stopped_emptySrc_playlistHasItems"
                );
              }
            }
          } else if (hasValidSrcAndInfo) {
            audioPlayer.play().catch((e) => {
              updateSongDisplay("Error: Could not play.");
            });
          } else if (playlist.length > 0) {
            let indexToPlay =
              currentTrackIndex !== -1 && currentTrackIndex < playlist.length
                ? currentTrackIndex
                : 0;
            if (playlist[indexToPlay]) {
              playTrack(
                indexToPlay,
                "playPauseBtn_paused_emptySrc_playlistHasItems"
              );
            }
          }
        } else {
          audioPlayer.pause();
        }
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
      updateSongDisplay(PLACEHOLDER_SONG_NAME);
      if (durationDisplay && seekBar) {
        durationDisplay.textContent = formatTime(0);
        if (seekBar) {
          seekBar.value = 0;
          seekBar.max = 0;
        }
      }
      if (currentTimeDisplay) {
        currentTimeDisplay.textContent = formatTime(0);
      }
      if (playPauseBtn) {
        playPauseBtn.innerHTML = playIcon;
      }
      renderPlaylist();
    });
  }
  if (fastForwardBtn) {
    fastForwardBtn.addEventListener("click", () => {
      if (
        audioPlayer &&
        audioPlayer.src &&
        !isNaN(audioPlayer.duration) &&
        audioPlayer.readyState >= 2
      ) {
        audioPlayer.currentTime = Math.min(
          audioPlayer.duration,
          audioPlayer.currentTime + 10
        );
      }
    });
  }
  if (seekBar) {
    seekBar.addEventListener("input", () => {
      if (
        audioPlayer &&
        audioPlayer.src &&
        !isNaN(audioPlayer.duration) &&
        audioPlayer.readyState >= 2
      ) {
        audioPlayer.currentTime = parseFloat(seekBar.value);
      }
    });
  }
  if (volumeSlider) {
    volumeSlider.addEventListener("input", () => {
      if (audioPlayer) {
        audioPlayer.muted = false;
        audioPlayer.volume = parseFloat(volumeSlider.value);
      }
    });
  }
  if (volumeIcon) {
    volumeIcon.addEventListener("click", () => {
      if (audioPlayer) {
        audioPlayer.muted = !audioPlayer.muted;
        if (!audioPlayer.muted && audioPlayer.volume === 0) {
          const dUV = 0.1;
          audioPlayer.volume = dUV;
          if (volumeSlider) volumeSlider.value = dUV.toString();
        }
        updateVolumeIcon();
        updateVolumeSliderFill();
      }
    });
  }

  // --- Playlist Logic Functions ---
  function renderPlaylist() {
    if (!playlistUL) {
      console.error("renderPlaylist: playlistUL is null!");
      return;
    }
    const scrollTop = playlistUL.scrollTop;
    playlistUL.innerHTML = "";
    selectedIndices = selectedIndices.filter((idx) => idx < playlist.length);

    if (playlist.length === 0) {
      /* Below is not required as this will cause design issue */
      // const li = document.createElement("li");
      // li.className = "playlist-drop-target";
      // li.textContent = 'Drag songs here or use "Add Files"'; // RESTORED placeholder text
      // playlistUL.appendChild(li);
      // playlistUL.scrollTop = scrollTop;
      return;
    }

    playlist.forEach((track, index) => {
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.index = index;
      const tNS = document.createElement("span");
      tNS.className = "track-name-span";
      tNS.textContent = track.name;
      tNS.title = track.name;
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
        currentlyPlayingInfo &&
        currentlyPlayingInfo.path === track.path &&
        !audioPlayer.paused &&
        !audioPlayer.ended &&
        !isPlayerExplicitlyStopped
      ) {
        li.classList.add("playing-actual");
      }
      if (index === currentTrackIndex) {
        li.classList.add("selected-ui");
      }
      if (selectedIndices.includes(index)) {
        li.classList.add("selected");
      }
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
        playTrack(index, "playlistItemDblClick");
      });
      li.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (!selectedIndices.includes(index)) {
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            selectedIndices = [index];
            currentTrackIndex = index;
            lastClickedIndex = index;
          } else {
            selectedIndices.push(index);
          }
          renderPlaylist();
        }
        if (
          window.electronAPI &&
          typeof window.electronAPI.showPlaylistContextMenu === "function"
        ) {
          window.electronAPI.showPlaylistContextMenu(index, [
            ...selectedIndices,
          ]);
        }
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
          .querySelectorAll("li.drop-target-above, li.drop-target-below")
          .forEach((item) => {
            item.classList.remove("drop-target-above", "drop-target-below");
          });
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
    const oldPlaylistLength = playlist.length;
    let firstNewTrackActualIndexInPlaylist = -1;
    let newTracksAddedCount = 0;
    const originalSongNameOnDisplay = songNameDisplay
      ? songNameDisplay.textContent
      : PLACEHOLDER_SONG_NAME;
    const existingPathsInPlaylist = new Set(
      playlist.map((track) => track.path)
    );
    updateSongDisplay("Loading songs...");
    let tempNewTracks = [];
    for (let i = 0; i < filePaths.length; i++) {
      const path = filePaths[i];
      if (existingPathsInPlaylist.has(path)) {
        console.log(`DEBUG: Skipping duplicate: ${path}`);
        continue;
      }
      const name = getFileName(path);
      if (songNameDisplay && filePaths.length > 1)
        updateSongDisplay(`Loading: ${name} (${i + 1}/${filePaths.length})`);
      const durationRaw = await getAudioDuration(path);
      const durationFormatted =
        durationRaw != null && !isNaN(durationRaw)
          ? formatTime(durationRaw)
          : "--:--";
      const newTrack = { path, name, durationRaw, durationFormatted };
      tempNewTracks.push(newTrack);
      existingPathsInPlaylist.add(path);
      newTracksAddedCount++;
    }
    if (newTracksAddedCount > 0) {
      let actualInsertionPointForPlayback = -1;
      if (insertAtIndex !== -1 && insertAtIndex <= playlist.length) {
        playlist.splice(insertAtIndex, 0, ...tempNewTracks);
        actualInsertionPointForPlayback = insertAtIndex;
        if (currentTrackIndex >= insertAtIndex) {
          currentTrackIndex += newTracksAddedCount;
        }
        selectedIndices = selectedIndices
          .map((idx) =>
            idx >= insertAtIndex ? idx + newTracksAddedCount : idx
          )
          .filter((idx) => idx < playlist.length);
        if (isShuffleActive && originalPlaylistOrder) {
          originalPlaylistOrder.splice(
            insertAtIndex,
            0,
            ...tempNewTracks.map((t) => ({ ...t }))
          );
        }
      } else {
        playlist.push(...tempNewTracks);
        actualInsertionPointForPlayback = oldPlaylistLength;
        if (isShuffleActive && originalPlaylistOrder) {
          tempNewTracks.forEach((nt) => {
            if (!originalPlaylistOrder.some((ot) => ot.path === nt.path))
              originalPlaylistOrder.push({ ...nt });
          });
        }
      }
      if (firstNewTrackActualIndexInPlaylist === -1 && tempNewTracks.length > 0)
        firstNewTrackActualIndexInPlaylist = actualInsertionPointForPlayback;
    }
    if (songNameDisplay) {
      if (currentlyPlayingInfo) {
        updateSongDisplay(currentlyPlayingInfo.name);
      } else if (
        newTracksAddedCount > 0 &&
        (playFirstNew || oldPlaylistLength === 0) &&
        firstNewTrackActualIndexInPlaylist !== -1 &&
        playlist[firstNewTrackActualIndexInPlaylist]
      ) {
        updateSongDisplay(playlist[firstNewTrackActualIndexInPlaylist].name);
      } else if (originalSongNameOnDisplay !== "Loading songs...") {
        updateSongDisplay(originalSongNameOnDisplay);
      } else {
        updateSongDisplay(PLACEHOLDER_SONG_NAME);
      }
    }
    renderPlaylist();
    if (
      newTracksAddedCount > 0 &&
      (playFirstNew || oldPlaylistLength === 0) &&
      firstNewTrackActualIndexInPlaylist !== -1
    ) {
      playTrack(
        firstNewTrackActualIndexInPlaylist,
        "addFilesToPlaylist_playFirstNew"
      );
    } else if (newTracksAddedCount === 0 && filePaths.length > 0) {
      console.log("DEBUG: addFilesToPlaylist - All files were duplicates.");
    }
  }
  function playTrack(index, calledFrom = "unknown") {
    console.log(
      `DEBUG: playTrack - CALLED from "${calledFrom}" with index: ${index}`
    );
    if (!audioPlayer || !songNameDisplay) {
      return;
    }
    currentTrackIndex = index;
    if (index >= 0 && index < playlist.length) {
      selectedIndices = [index];
      lastClickedIndex = index;
      const trackToLoad = playlist[index];
      if (
        trackToLoad &&
        typeof trackToLoad.path === "string" &&
        trackToLoad.path.trim() !== ""
      ) {
        const needsNewSrc =
          currentlyPlayingInfo?.path !== trackToLoad.path ||
          isPlayerExplicitlyStopped ||
          audioPlayer.error ||
          audioPlayer.ended ||
          !audioPlayer.src ||
          audioPlayer.src === "" ||
          audioPlayer.src.endsWith("index.html") ||
          audioPlayer.src === window.location.href + "#";
        if (needsNewSrc) {
          audioPlayer.src = trackToLoad.path;
          currentlyPlayingInfo = { ...trackToLoad };
          updateSongDisplay(trackToLoad.name);
          const playPromise = audioPlayer.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                isPlayerExplicitlyStopped = false;
              })
              .catch((e) => {
                updateSongDisplay(`Error: (${trackToLoad.name || "track"})`);
                currentlyPlayingInfo = null;
                isPlayerExplicitlyStopped = true;
                if (audioPlayer) {
                  audioPlayer.src = "";
                  audioPlayer.load();
                }
              });
          } else {
            isPlayerExplicitlyStopped = true;
          }
        } else {
          updateSongDisplay(trackToLoad.name);
          if (audioPlayer.paused) {
            audioPlayer.play().catch((e) => {
              isPlayerExplicitlyStopped = true;
            });
          }
        }
      } else {
        if (!currentlyPlayingInfo) {
          updateSongDisplay(`Error: Invalid track data.`);
        }
      }
    } else {
      if (
        isPlayerExplicitlyStopped ||
        !audioPlayer.src ||
        audioPlayer.src === "" ||
        audioPlayer.src.endsWith("index.html") ||
        audioPlayer.src === window.location.href + "#"
      ) {
        if (audioPlayer) {
          audioPlayer.pause();
          audioPlayer.removeAttribute("src");
          audioPlayer.load();
        }
        currentlyPlayingInfo = null;
        updateSongDisplay(PLACEHOLDER_SONG_NAME);
        if (durationDisplay && seekBar) {
          durationDisplay.textContent = formatTime(0);
          seekBar.value = 0;
          seekBar.max = 0;
        }
        currentTrackIndex = -1;
        isPlayerExplicitlyStopped = true;
      }
    }
    renderPlaylist();
  }
  function removeTracks(indicesToRemove) {
    if (!indicesToRemove || indicesToRemove.length === 0) return;
    indicesToRemove.sort((a, b) => b - a);
    let newUiCurrentIndex = currentTrackIndex;
    let actualPlayingTrackWasRemovedFromList = false;
    indicesToRemove.forEach((indexToRemove) => {
      if (indexToRemove < 0 || indexToRemove >= playlist.length) return;
      const removedTrack = playlist.splice(indexToRemove, 1)[0];
      if (
        removedTrack &&
        currentlyPlayingInfo &&
        removedTrack.path === currentlyPlayingInfo.path
      )
        actualPlayingTrackWasRemovedFromList = true;
      if (isShuffleActive && originalPlaylistOrder) {
        const oI = originalPlaylistOrder.findIndex(
          (t) => t.path === removedTrack?.path
        );
        if (oI > -1) originalPlaylistOrder.splice(oI, 1);
      }
      if (indexToRemove === newUiCurrentIndex) {
      } else if (indexToRemove < newUiCurrentIndex) {
        newUiCurrentIndex--;
      }
    });
    if (playlist.length === 0) {
      currentTrackIndex = -1;
      if (actualPlayingTrackWasRemovedFromList || !currentlyPlayingInfo) {
        if (audioPlayer) {
          audioPlayer.pause();
          audioPlayer.removeAttribute("src");
          audioPlayer.load();
        }
        currentlyPlayingInfo = null;
        updateSongDisplay(PLACEHOLDER_SONG_NAME);
        if (durationDisplay && seekBar) {
          durationDisplay.textContent = formatTime(0);
          seekBar.value = 0;
          seekBar.max = 0;
        }
        isPlayerExplicitlyStopped = true;
      }
    } else {
      currentTrackIndex = Math.min(newUiCurrentIndex, playlist.length - 1);
      if (currentTrackIndex < 0) currentTrackIndex = 0;
      if (actualPlayingTrackWasRemovedFromList && !currentlyPlayingInfo) {
        playTrack(currentTrackIndex, "removeTracks_nextAfterRemovedPlaying");
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
      currentTrackIndex !== -1
    ) {
      updateSongDisplay(playlist[currentTrackIndex].name);
    } else if (!currentlyPlayingInfo) {
      updateSongDisplay(PLACEHOLDER_SONG_NAME);
    } else if (currentlyPlayingInfo && songNameDisplay) {
      updateSongDisplay(currentlyPlayingInfo.name);
    }
    renderPlaylist();
  }
  function playNextTrackLogic() {
    if (playlist.length === 0) {
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.removeAttribute("src");
        audioPlayer.load();
      }
      currentlyPlayingInfo = null;
      isPlayerExplicitlyStopped = true;
      updateSongDisplay(PLACEHOLDER_SONG_NAME);
      if (durationDisplay && seekBar) {
        durationDisplay.textContent = formatTime(0);
        seekBar.value = 0;
        seekBar.max = 0;
      }
      currentTrackIndex = -1;
      renderPlaylist();
      return;
    }
    let newIndex = currentTrackIndex + 1;
    if (newIndex >= playlist.length) {
      newIndex = 0;
    }
    playTrack(newIndex, "playNextTrackLogic");
  }
  function playPrevTrackLogic() {
    if (playlist.length === 0) {
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.removeAttribute("src");
        audioPlayer.load();
      }
      currentlyPlayingInfo = null;
      isPlayerExplicitlyStopped = true;
      updateSongDisplay(PLACEHOLDER_SONG_NAME);
      if (durationDisplay && seekBar) {
        durationDisplay.textContent = formatTime(0);
        seekBar.value = 0;
        seekBar.max = 0;
      }
      currentTrackIndex = -1;
      renderPlaylist();
      return;
    }
    let newIndex = currentTrackIndex - 1;
    if (newIndex < 0) {
      newIndex = playlist.length - 1;
    }
    playTrack(newIndex, "playPrevTrackLogic");
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
      !originalPlaylistOrder ||
      originalPlaylistOrder.length === 0 ||
      playlist.some((track, i) => track.path !== originalPlaylistOrder[i]?.path)
    ) {
      originalPlaylistOrder = playlist.map((track) => ({ ...track }));
    }
    for (let i = playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
    }
    if (cPIS) {
      currentTrackIndex = playlist.findIndex(
        (track) => track.path === cPIS.path
      );
      if (currentTrackIndex === -1 && playlist.length > 0) {
        currentTrackIndex = 0;
      }
    } else if (playlist.length > 0) {
      currentTrackIndex = 0;
    } else {
      currentTrackIndex = -1;
    }
    selectedIndices = currentTrackIndex > -1 ? [currentTrackIndex] : [];
    lastClickedIndex = currentTrackIndex;
  }
  function unshufflePlaylist() {
    if (originalPlaylistOrder && originalPlaylistOrder.length > 0) {
      const cPIS = currentlyPlayingInfo ? { ...currentlyPlayingInfo } : null;
      playlist = originalPlaylistOrder.map((track) => ({ ...track }));
      if (cPIS) {
        currentTrackIndex = playlist.findIndex(
          (track) => track.path === cPIS.path
        );
        if (currentTrackIndex === -1 && playlist.length > 0)
          currentTrackIndex = 0;
      } else if (playlist.length > 0) {
        currentTrackIndex = 0;
      } else {
        currentTrackIndex = -1;
      }
      selectedIndices = currentTrackIndex > -1 ? [currentTrackIndex] : [];
      lastClickedIndex = currentTrackIndex;
    }
  }

  // --- Event Listeners ---
  if (prevBtn) prevBtn.addEventListener("click", playPrevTrackLogic);
  if (nextBtn) nextBtn.addEventListener("click", playNextTrackLogic);
  if (shuffleBtn) {
    shuffleBtn.addEventListener("click", () => {
      isShuffleActive = !isShuffleActive;
      if (isShuffleActive) {
        shuffleCurrentPlaylist();
      } else {
        unshufflePlaylist();
      }
      updateShuffleButtonUI();
      renderPlaylist();
    });
  }
  if (addFilesBtn) {
    addFilesBtn.addEventListener("click", async () => {
      try {
        if (
          window.electronAPI &&
          typeof window.electronAPI.openFiles === "function"
        ) {
          const filePaths = await window.electronAPI.openFiles();
          if (filePaths && filePaths.length > 0) {
            await addFilesToPlaylist(filePaths, playlist.length === 0, -1);
          }
        } else {
          console.error("window.electronAPI.openFiles is not available.");
        }
      } catch (error) {
        console.error("Error in addFilesBtn click handler:", error);
      }
    });
  }
  function updatePlaylistToggleBtnTextDOM() {
    if (!playlistToggleBtn || !playlistContainer) {
      return;
    }
    const isHidden = playlistContainer.classList.contains("hidden");
    playlistToggleBtn.innerHTML = `<i class="fas fa-list-ul"></i> ${
      isHidden ? "Show" : "Hide"
    } Playlist`;
    playlistToggleBtn.title = `${isHidden ? "Show" : "Hide"} Playlist`;
  }
  function setPlaylistUIVisibilityDOM(isVisible) {
    if (!playlistContainer) {
      return;
    }
    if (isVisible) {
      playlistContainer.classList.remove("hidden");
      if (mainPlayerPanel) mainPlayerPanel.classList.add("with-playlist");
    } else {
      playlistContainer.classList.add("hidden");
      if (mainPlayerPanel) mainPlayerPanel.classList.remove("with-playlist");
    }
    updatePlaylistToggleBtnTextDOM();
  }
  function toggleDockedPlaylistDOM() {
    if (!playlistContainer) {
      return;
    }
    const isCurrentlyHidden = playlistContainer.classList.contains("hidden");
    const showPlaylist = isCurrentlyHidden;
    const currentBodyWidth = document.body.offsetWidth;
    setPlaylistUIVisibilityDOM(showPlaylist);
    if (
      window.electronAPI &&
      typeof window.electronAPI.resizeMainWindowAndSaveVisibility === "function"
    ) {
      const heightOption = showPlaylist
        ? "player_with_playlist"
        : "player_only";
      window.electronAPI.resizeMainWindowAndSaveVisibility(
        currentBodyWidth,
        heightOption,
        showPlaylist
      );
    } else {
      console.error(
        "window.electronAPI.resizeMainWindowAndSaveVisibility is not available."
      );
    }
  }
  if (playlistToggleBtn)
    playlistToggleBtn.addEventListener("click", toggleDockedPlaylistDOM);
  if (closePlaylistPanelBtn)
    closePlaylistPanelBtn.addEventListener("click", () => {
      if (
        playlistContainer &&
        !playlistContainer.classList.contains("hidden")
      ) {
        toggleDockedPlaylistDOM();
      }
    });

  // --- DRAG AND DROP ON PLAYLIST AREA (for reordering and external file drop) ---
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
      } else {
        e.dataTransfer.dropEffect = "move";
      }
      if (draggedItemIndex !== null) {
        const targetLi = e.target.closest("li:not(.playlist-drop-target)");
        playlistUL
          .querySelectorAll("li.drop-target-above, li.drop-target-below")
          .forEach((item) =>
            item.classList.remove("drop-target-above", "drop-target-below")
          );
        if (targetLi && targetLi.dataset.index !== undefined) {
          const targetLiIndex = parseInt(targetLi.dataset.index, 10);
          if (targetLiIndex !== draggedItemIndex) {
            const rect = targetLi.getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
              targetLi.classList.add("drop-target-above");
              dropTargetIndex = targetLiIndex;
            } else {
              targetLi.classList.add("drop-target-below");
              dropTargetIndex = targetLiIndex + 1;
            }
          } else {
            dropTargetIndex = null;
          }
        } else {
          dropTargetIndex = playlist.length;
          const emptyPlaceholder = playlistUL.querySelector(
            ".playlist-drop-target"
          );
          if (emptyPlaceholder)
            emptyPlaceholder.classList.add("dragover-active-direct");
        }
      }
    });
    playlistUL.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (playlistContainer)
        playlistContainer.classList.remove("dragover-active");
      const targetLi = e.target.closest("li"); // This might be null if leaving to outside children
      if (
        dragOverPlaylistLi &&
        (!e.relatedTarget || !playlistUL.contains(e.relatedTarget))
      ) {
        // Leaving UL
        dragOverPlaylistLi.classList.remove(
          "drop-target-above",
          "drop-target-below",
          "dragover-active-direct"
        );
        dragOverPlaylistLi = null;
        dropTargetIndex = null;
      } else if (
        dragOverPlaylistLi &&
        e.target === dragOverPlaylistLi &&
        e.relatedTarget &&
        !playlistUL.contains(e.relatedTarget)
      ) {
        // Leaving the specific LI to outside
        dragOverPlaylistLi.classList.remove(
          "drop-target-above",
          "drop-target-below",
          "dragover-active-direct"
        );
        dragOverPlaylistLi = null;
        dropTargetIndex = null;
      } else if (
        targetLi &&
        targetLi === dragOverPlaylistLi &&
        e.relatedTarget &&
        targetLi.contains(e.relatedTarget)
      ) {
        // Moving within the same li (e.g. over text inside it), do nothing yet.
      } else if (dragOverPlaylistLi && targetLi !== dragOverPlaylistLi) {
        // Moved from one li to another (or to empty space)
        dragOverPlaylistLi.classList.remove(
          "drop-target-above",
          "drop-target-below",
          "dragover-active-direct"
        );
        // dropTargetIndex would have been updated by new target's dragover
      }
    });
    playlistUL.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (playlistContainer)
        playlistContainer.classList.remove("dragover-active");
      playlistUL
        .querySelectorAll(
          "li.drop-target-above, li.drop-target-below, .playlist-drop-target.dragover-active-direct"
        )
        .forEach((item) =>
          item.classList.remove(
            "drop-target-above",
            "drop-target-below",
            "dragover-active-direct"
          )
        );

      if (draggedItemIndex !== null && dropTargetIndex !== null) {
        // Internal reorder
        console.log(
          "Internal reorder drop. Dragged:",
          draggedItemIndex,
          "Target:",
          dropTargetIndex
        );
        if (
          draggedItemIndex !== dropTargetIndex &&
          draggedItemIndex !== dropTargetIndex - 1
        ) {
          // Ensure not dropping onto itself
          const itemToMove = playlist.splice(draggedItemIndex, 1)[0];
          const actualInsertAt =
            draggedItemIndex < dropTargetIndex
              ? dropTargetIndex - 1
              : dropTargetIndex;
          playlist.splice(actualInsertAt, 0, itemToMove);
          if (currentlyPlayingInfo) {
            const newPlayingIdx = playlist.findIndex(
              (t) => t.path === currentlyPlayingInfo.path
            );
            if (newPlayingIdx !== -1) currentTrackIndex = newPlayingIdx;
            else {
              currentlyPlayingInfo = null;
              currentTrackIndex = -1;
            }
          } else if (playlist.length > 0) {
            currentTrackIndex =
              actualInsertAt < playlist.length ? actualInsertAt : 0;
          } else {
            currentTrackIndex = -1;
          }
          if (
            isShuffleActive &&
            originalPlaylistOrder.length === playlist.length
          ) {
            const movedOriginalItem = originalPlaylistOrder.splice(
              draggedItemIndex,
              1
            )[0];
            originalPlaylistOrder.splice(actualInsertAt, 0, movedOriginalItem);
          }
          renderPlaylist();
        }
      } else {
        // External file drop onto playlistUL
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          const audioFilePaths = Array.from(files)
            .filter(
              (f) =>
                f.type.startsWith("audio/") ||
                /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)
            )
            .map((f) => f.path);
          if (audioFilePaths.length > 0) {
            let insertAtIndexForExternal = playlist.length; // Default to append for external files
            const dropOnLi = e.target.closest("li:not(.playlist-drop-target)");
            if (dropOnLi && dropOnLi.dataset.index !== undefined) {
              const targetIdx = parseInt(dropOnLi.dataset.index, 10);
              const rect = dropOnLi.getBoundingClientRect();
              if (e.clientY < rect.top + rect.height / 2) {
                insertAtIndexForExternal = targetIdx;
              } else {
                insertAtIndexForExternal = targetIdx + 1;
              }
            } else if (
              playlistUL.querySelector(".playlist-drop-target") &&
              playlist.length === 0
            ) {
              insertAtIndexForExternal = 0;
            }
            await addFilesToPlaylist(
              audioFilePaths,
              playlist.length === 0 && insertAtIndexForExternal <= 0,
              insertAtIndexForExternal
            );
          }
        }
      }
      draggedItemIndex = null;
      dropTargetIndex = null;
    });
  }

  // Fallback body drop (appends to playlist)
  const bodyDropZone = document.body;
  if (bodyDropZone && bodyDropZone !== playlistUL) {
    bodyDropZone.addEventListener("dragover", (e) => {
      if (!playlistUL.contains(e.target) && !e.target.closest("#playlistUL")) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        if (mainPlayerPanel) mainPlayerPanel.classList.add("dragover-body");
      }
    });
    bodyDropZone.addEventListener("dragleave", (e) => {
      if (
        !playlistUL.contains(e.relatedTarget) &&
        !e.relatedTarget?.closest("#playlistUL")
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (mainPlayerPanel) mainPlayerPanel.classList.remove("dragover-body");
      }
    });
    bodyDropZone.addEventListener("drop", async (e) => {
      if (!playlistUL.contains(e.target) && !e.target.closest("#playlistUL")) {
        e.preventDefault();
        e.stopPropagation();
        if (mainPlayerPanel) mainPlayerPanel.classList.remove("dragover-body");
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          const audioFilePaths = Array.from(files)
            .filter(
              (f) =>
                f.type.startsWith("audio/") ||
                /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)
            )
            .map((f) => f.path);
          if (audioFilePaths.length > 0) {
            await addFilesToPlaylist(audioFilePaths, playlist.length === 0, -1);
          }
        }
      }
    });
  }

  // --- IPC Event Handlers ---
  if (
    window.electronAPI &&
    typeof window.electronAPI.onContextMenuCommand === "function"
  ) {
    window.electronAPI.onContextMenuCommand((command, data) => {
      if (command === "remove-tracks") removeTracks(data);
    });
  }
  if (
    window.electronAPI &&
    typeof window.electronAPI.onSetInitialPlaylistVisibility === "function"
  ) {
    window.electronAPI.onSetInitialPlaylistVisibility((isVisible) =>
      setPlaylistUIVisibilityDOM(isVisible)
    );
  }
  if (
    window.electronAPI &&
    typeof window.electronAPI.onSetInitialVolume === "function"
  ) {
    window.electronAPI.onSetInitialVolume((initialVolume) => {
      if (audioPlayer && typeof initialVolume === "number")
        audioPlayer.volume = initialVolume;
      if (volumeSlider && typeof initialVolume === "number")
        volumeSlider.value = initialVolume.toString();
    });
  }
  if (
    window.electronAPI &&
    typeof window.electronAPI.onOpenFileInPlayer === "function"
  ) {
    window.electronAPI.onOpenFileInPlayer(async (filePath) => {
      if (filePath && typeof filePath === "string") {
        const trackExistsIndex = playlist.findIndex(
          (track) => track.path === filePath
        );
        if (trackExistsIndex !== -1) {
          isPlayerExplicitlyStopped = false;
          playTrack(trackExistsIndex, "onOpenFileInPlayer_existing");
        } else {
          if (songNameDisplay && playlist.length === 0)
            updateSongDisplay(`Loading: ${getFileName(filePath)}`);
          const name = getFileName(filePath);
          const durationRaw = await getAudioDuration(filePath);
          const durationFormatted =
            durationRaw != null && !isNaN(durationRaw)
              ? formatTime(durationRaw)
              : "--:--";
          const newTrack = {
            path: filePath,
            name,
            durationRaw,
            durationFormatted,
          };
          playlist.push(newTrack);
          renderPlaylist();
          const newTrackIndex = playlist.length - 1;
          isPlayerExplicitlyStopped = false;
          playTrack(newTrackIndex, "onOpenFileInPlayer_new");
        }
      }
    });
  } else {
    console.warn(
      "Renderer: window.electronAPI.onOpenFileInPlayer not available."
    );
  }

  // --- Initial Setup ---
  renderPlaylist();
  updatePlaylistToggleBtnTextDOM();
  updateShuffleButtonUI();
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
    updateSongDisplay(songNameDisplay.textContent || PLACEHOLDER_SONG_NAME);
  }, 100);
});
