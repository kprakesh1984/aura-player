# 🎶 Symphonie Music Player 🎶

Your personal, lightweight music player for enjoying your local audio collection on **Windows** and **Linux**!

## ✨ Features

* **Wide Format Support:** Plays a variety of audio formats including `.mp3`, `.aac`, `.flac`, `.ogg`, `.m4a`, `.wav`, `.opus`, and more.
* **Clean Metadata Display:** Shows the song **Title** and **Contributing Artist(s)/Album Artist** if available in the track's metadata. Displays filename (without extension) as a fallback.
* **Interactive Playlist:**

  * Add individual or multiple files.
  * Drag and drop files/folders directly onto the player or playlist.
  * See numbered tracks in the playlist for easy reference.
  * Reorder tracks within the playlist using drag and drop.
  * Remove single or multiple selected tracks via a context menu (right-click).
  * Select all tracks in the playlist and delete using **Ctrl+A**.
  * Show or hide the playlist panel.
  * Tooltips in the playlist show the full filename including extension.
  * Visualizer which can be enabled and disabled.
* **Standard Playback Controls:**

  * Play / Pause
  * Next / Previous Track
  * Stop
  * Seek Bar for easy navigation within a track.
  * Volume Control (slider and mute button).
  * Fast Forward (10 seconds).
* **Shuffle Mode:** Randomize your playlist playback.
* **User-Friendly Interface:** Simple and intuitive design.
* **Persistent Settings:** Remembers your last volume and whether the playlist was visible.
* Visualizer for song playing with enable/disable option

## 💻 Supported Operating Systems

* Primarily designed and tested for **Windows 10**, **Windows 11**, and **Ubuntu 22.04/24.04+**.
* It *may* work on other Linux distributions, but only `.deb` and AppImage are officially provided for now.
* Older versions of Windows (like Windows 8.1) may work but are not officially supported. **Windows 7 is not supported.**

## 🚀 Installation / Getting Started (Windows)

**\[Installer]**

1. Download the installer: `Symphonie-Setup-vx.x.x.exe`.
2. Run the installer and follow the on-screen instructions.
3. Launch Symphonie from the Start Menu or Desktop shortcut.

> ⚠️ Since the app is unsigned, SmartScreen or antivirus may show a warning. Click "More info" > "Run anyway".

## 🐖 Installation / Getting Started (Linux - Ubuntu/Debian)

**Option 1: Using **\`\`** package**

1. Download the `.deb` file: `symphonie_1.0.8_amd64.deb`
2. Install it:

```bash
sudo dpkg -i symphonie_1.0.8_amd64.deb
sudo apt-get install -f  # Fix any missing dependencies
```

3. Launch the app:

```bash
symphonie
```

> If the above doesn’t work, launch manually with:

```bash
/opt/Symphonie/Symphonie

or

/opt/Symphonie/Symphonie 2>/dev/null (to supress warnings/errors)

```

**Option 2: Using AppImage (Works on most Linux distros)**

1. Download the file: `Symphonie-1.0.8.AppImage`
2. Make it executable:

```bash
chmod +x Symphonie-1.0.8.AppImage
```

3. Run the AppImage:

```bash
./Symphonie-1.0.8.AppImage
```

> 💡 The AppImage includes all dependencies. Recommended if you face any issues with `.deb`.

## 🎵 How to Use

1. **Launch Symphonie.**
2. **Add Music:**

   * Click the "**+ Add Files**" button to select your audio files.
   * Or **drag and drop** files/folders into the window.
3. **Playback:**

   * Use playback controls at the bottom.
   * Seek bar to jump to parts of the track.
   * Adjust volume or mute.
   * Fast forward by 10 seconds.
4. **Playlist:**

   * Toggle visibility, reorder, remove tracks.
   * Shuffle mode available.

## ⚠️ Known Issues / Limitations

* Metadata display relies on tags in audio files. If tags are missing, filename is shown.
* On Linux, some users may need to manually install `libasound2` and `libpulse0` if not already installed.

## 🎉 Enjoy Your Music!

I hope you enjoy using Symphonie! If you have any feedback, feel free to share it.

---

**Developer Notes (Optional):**

* Built with Electron.js
* Uses `music-metadata` for tag parsing
* Uses `electron-store` for settings persistence
