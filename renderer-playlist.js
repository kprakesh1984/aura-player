document.addEventListener("DOMContentLoaded", () => {
  const playlistUL = document.getElementById("playlist");
  // const addFilesBtnDetached = document.getElementById('addFilesBtnDetached'); // If you add this button

  let playlist = [];
  let currentTrackIndex = -1;
  let selectedIndices = [];
  let lastClickedIndex = -1;

  function renderPlaylist() {
    playlistUL.innerHTML = "";
    selectedIndices = selectedIndices.filter((idx) => idx < playlist.length); // Clean up

    if (playlist.length === 0) {
      const li = document.createElement("li");
      li.className = "playlist-drop-target";
      li.textContent =
        "Playlist is empty. Add songs from the main player or drag here.";
      playlistUL.appendChild(li);
      return;
    }

    playlist.forEach((track, index) => {
      const li = document.createElement("li");
      const trackNameSpan = document.createElement("span");
      trackNameSpan.className = "track-name-span";
      trackNameSpan.textContent = track.name;
      trackNameSpan.title = track.name;
      li.appendChild(trackNameSpan);

      li.dataset.index = index;

      if (index === currentTrackIndex) li.classList.add("playing");
      if (selectedIndices.includes(index)) li.classList.add("selected");

      li.addEventListener("click", (e) => handlePlaylistItemClick(e, index));
      li.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (!selectedIndices.includes(index)) {
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            selectedIndices = [index];
          } else {
            selectedIndices.push(index);
          }
          renderPlaylist();
        }
        window.playlistAPI.showContextMenu(index, [...selectedIndices]);
      });
      playlistUL.appendChild(li);
    });
  }

  function handlePlaylistItemClick(event, index) {
    const oldSelectedIndices = [...selectedIndices]; // For comparison if only selection changes
    if (event.shiftKey && lastClickedIndex !== -1) {
      selectedIndices = [];
      const start = Math.min(index, lastClickedIndex);
      const end = Math.max(index, lastClickedIndex);
      for (let i = start; i <= end; i++) {
        selectedIndices.push(i);
      }
    } else if (event.ctrlKey || event.metaKey) {
      const selectedIndexPosition = selectedIndices.indexOf(index);
      if (selectedIndexPosition > -1) {
        selectedIndices.splice(selectedIndexPosition, 1);
      } else {
        selectedIndices.push(index);
      }
    } else {
      // Simple click
      selectedIndices = [index];
      // Inform main player to play this track
      window.playlistAPI.sendActionToMain("play-track", { index });
      // currentTrackIndex will be updated via sync or full update
    }
    lastClickedIndex = index;

    // If only selection changed, re-render. If a play action was sent,
    // wait for sync to update currentTrackIndex and re-render.
    const selectionChanged =
      oldSelectedIndices.length !== selectedIndices.length ||
      oldSelectedIndices.some((idx) => !selectedIndices.includes(idx));
    if (
      selectionChanged &&
      !(event.ctrlKey || event.metaKey) &&
      !event.shiftKey
    ) {
      // If it was a simple click that triggered a play, the sync will handle render.
      // Otherwise, if selection changed without play, render now.
    } else if (selectionChanged) {
      renderPlaylist();
    }
  }

  // --- Drag and Drop for Detached Playlist ---
  const playlistArea = document.body; // Drop anywhere on playlist window
  playlistArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    playlistUL
      .querySelector(".playlist-drop-target")
      ?.classList.add("dragover");
    if (
      !playlistUL.querySelector(".playlist-drop-target") &&
      playlist.length > 0
    ) {
      playlistUL.classList.add("dragover"); // Add to whole list if not empty
    }
  });
  playlistArea.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    playlistUL
      .querySelector(".playlist-drop-target.dragover")
      ?.classList.remove("dragover");
    playlistUL.classList.remove("dragover");
  });

  playlistArea.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    playlistUL
      .querySelector(".playlist-drop-target.dragover")
      ?.classList.remove("dragover");
    playlistUL.classList.remove("dragover");

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const audioFilePaths = Array.from(files)
        .filter(
          (f) =>
            f.type.startsWith("audio/") ||
            /\.(mp3|wav|ogg|m4a|flac)$/i.test(f.name)
        )
        .map((f) => f.path);
      if (audioFilePaths.length > 0) {
        // Tell main process/player to add these files
        window.playlistAPI.sendActionToMain("add-files", {
          filePaths: audioFilePaths,
        });
        // The main player will update its list and then broadcast the new list
      }
    }
  });

  // Optional: Add files button in detached playlist
  // if (addFilesBtnDetached) {
  //     addFilesBtnDetached.addEventListener('click', async () => {
  //         const filePaths = await window.playlistAPI.openFiles();
  //         if (filePaths && filePaths.length > 0) {
  //             window.playlistAPI.sendActionToMain('add-files', { filePaths: filePaths });
  //         }
  //     });
  // }

  // --- IPC Event Handlers ---
  window.playlistAPI.onInitializePlaylist((initialPlaylist, initialIndex) => {
    console.log(
      "Detached Playlist Initializing:",
      initialPlaylist,
      initialIndex
    );
    playlist = initialPlaylist || [];
    currentTrackIndex = initialIndex === undefined ? -1 : initialIndex;
    selectedIndices = currentTrackIndex > -1 ? [currentTrackIndex] : [];
    lastClickedIndex = currentTrackIndex;
    renderPlaylist();
  });

  window.playlistAPI.onUpdatePlaylistData((updatedPlaylist, updatedIndex) => {
    console.log(
      "Detached Playlist Data Update:",
      updatedPlaylist,
      updatedIndex
    );
    playlist = updatedPlaylist || [];
    currentTrackIndex = updatedIndex === undefined ? -1 : updatedIndex;
    selectedIndices = selectedIndices.filter((idx) => idx < playlist.length); // Clean selection
    if (
      currentTrackIndex > -1 &&
      !selectedIndices.includes(currentTrackIndex)
    ) {
      // If current track changed and is not part of selection, make it selected.
      selectedIndices = [currentTrackIndex];
    }
    lastClickedIndex =
      currentTrackIndex > -1 ? currentTrackIndex : lastClickedIndex;
    renderPlaylist();
  });

  window.playlistAPI.onContextMenuCommand((command, data) => {
    if (command === "remove-tracks") {
      // Tell main player to remove these tracks
      // The main player will update its list and then broadcast the new list
      window.playlistAPI.sendActionToMain("remove-tracks", { indices: data });
    }
  });

  // Listen for sync actions that originated from main player but need to be reflected here
  // (e.g. main player skipped track, shuffled)
  window.playlistAPI.onSyncPlaylistAction((action, data) => {
    console.log("Sync Action Received in Detached Playlist:", action, data);
    switch (action) {
      case "play-track": // Main player started a track
        if (data && typeof data.index === "number") {
          currentTrackIndex = data.index;
          selectedIndices = [data.index];
          lastClickedIndex = data.index;
          renderPlaylist();
        }
        break;
      // case 'shuffle-toggle': // If shuffle is triggered from main player
      //     // The main player would send 'update-playlist-data' with the shuffled list
      //     break;
      // No need to handle 'remove-tracks' or 'add-files' here as they should trigger
      // a full 'update-playlist-data' from main once processed by main renderer.
    }
  });

  // Initial render in case data arrives very fast
  renderPlaylist();
});
