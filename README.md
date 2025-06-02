# 🎶 Symphonie Music Player 🎶

Your personal, lightweight music player for enjoying your local audio collection on Windows!

## ✨ Features
*   **Wide Format Support:** Plays a variety of audio formats including `.mp3`, `.flac`, `.ogg`, `.m4a`, `.wav`, and more.
*   **Clean Metadata Display:** Shows the song **Title** and **Contributing Artist(s)/Album Artist** if available in the track's metadata. Displays filename (without extension) as a fallback.
*   **Interactive Playlist:**
    *   Add individual or multiple files.
    *   Drag and drop files directly onto the player or playlist.
    *   See numbered tracks in the playlist for easy reference.
    *   Reorder tracks within the playlist using drag and drop.
    *   Remove single or multiple selected tracks via a context menu (right-click).
    *   Select all tracks in the playlist using **Ctrl+A**.
    *   Show or hide the playlist panel.
    *   Tooltips in the playlist show the full filename including extension.
*   **Standard Playback Controls:**
    *   Play / Pause
    *   Next / Previous Track
    *   Stop
    *   Seek Bar for easy navigation within a track.
    *   Volume Control (slider and mute button).
    *   Fast Forward (10 seconds).
*   **Shuffle Mode:** Randomize your playlist playback.
*   **User-Friendly Interface:** Simple and intuitive design.
*   **Persistent Settings:** Remembers your last volume and whether the playlist was visible.
*    Visualizer for song playing with enable/disable option

## 🖥️ Supported Operating Systems

*   Primarily designed and tested for **Windows 10** and **Windows 11**.
*   It *may* work on older Windows versions (like Windows 8.1), but this is not guaranteed or officially supported due to underlying technology (Chromium/Electron) updates. Windows 7 is not supported by recent Electron versions.

## 🚀 Installation / Getting Started

**[Option 1: If you provide an Installer (e.g., using electron-builder)]**

1.  Download the installer: `Symphonie-Setup-vx.x.x.exe` (replace `vx.x.x` with the actual version).
2.  Run the installer and follow the on-screen instructions.
3.  Launch Symphonie from the Start Menu or Desktop shortcut.

**[Option 2: If you provide a Portable Version (e.g., a .zip file with the .exe)]**

1.  Download the archive: `Symphonie-vx.x.x.zip` (replace `vx.x.x` with the actual version).
2.  Extract the contents of the `.zip` file to a folder on your computer.
3.  Run `Symphonie.exe` from the extracted folder.

**Important Note for Windows Users:**
Since this application is not signed with a commercial developer certificate, Windows SmartScreen or other antivirus software might display a warning when you first try to run the installer or the executable. This is normal for unsigned applications.
*   For an installer or `.exe`, you might need to click "More info" and then "Run anyway".

## 🎵 How to Use

1.  **Launch Symphonie.**
2.  **Add Music:**
    *   Click the "**+ Add Files**" button to open a file dialog and select your audio files.
    *   Alternatively, **drag and drop** audio files directly from your file explorer onto the main player window or onto the playlist area (if visible).
3.  **Playback:**
    *   Use the standard playback controls (Play/Pause, Next, Previous, Stop) at the bottom.
    *   Click on the seek bar to jump to a specific part of the song.
    *   Adjust the volume using the volume slider or click the volume icon to mute/unmute.
    *   Click the fast forward button to skip ahead 10 seconds.
4.  **Playlist:**
    *   Click "**Show Playlist**" / "**Hide Playlist**" to toggle the playlist panel.
    *   Double-click a track in the playlist to play it.
    *   Click a track to select it. Use Ctrl+Click (or Cmd+Click) for multiple selections, or Shift+Click for range selection.
    *   Press **Ctrl+A** (or Cmd+A) while the playlist area is active to select all tracks.
    *   Right-click on a selected track (or group of selected tracks) to open the context menu and choose "Remove Song(s)".
    *   Drag and drop tracks within the playlist to reorder them.
    *   Click the **Shuffle** button (<i class="fas fa-random"></i> icon) to toggle shuffle mode.

## ⚠️ Known Issues / Limitations

*   Metadata display (Title/Artist) is dependent on the quality and presence of tags within your audio files. If tags are missing or incorrect, the player will show the filename (without extension).
*   (Add any other minor issues you are aware of).

## 🎉 Enjoy Your Music!

I hope you enjoy using Symphonie! If you have any feedback, feel free to share it.

---

**Developer Notes (Optional - you might remove this for a friend-only release or put it in a separate file if sharing source):**
*   Built with Electron.js.
*   Uses `music-metadata` for tag parsing.
*   Uses `electron-store` for simple settings persistence.
