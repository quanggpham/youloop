<p align="center">
  <img src="assets/icons/icon-128.png" alt="YouLoop" width="128" height="128">
</p>

<h1 align="center">YouLoop</h1>

<p align="center">Loop any segment of a YouTube video — seamlessly.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-red?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome" alt="Manifest V3">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
</p>

---

## ✨ Features

- **A↻B Loop** — set start (A) and end (B) points and loop them infinitely
- **Two ways to set points:**
  - Click **Set A** / **Set B** buttons to snap the current playback position
  - **Drag markers** on the progress bar for visual placement
- **Frame-accurate** — uses `requestAnimationFrame` for jitter-free loop transitions
- **Persistent per video** — loop points are saved locally and restored when you come back
- **YouTube-native UI** — controls blend into the player with matching colors
- **SPA-aware** — survives YouTube navigation without reloading
- **Embed support** — works on `youtube.com/embed/*` pages
- **100% local** — no data ever leaves your browser

## 🎬 How It Works

```
Progress Bar:  |██████████░░░░▓▓▓▓▓▓▓▓░░░░██████████|
                              A─────────────B
                            (1:30)         (3:45)
```

Set A and B anywhere on the timeline. The engine monitors playback every frame via `requestAnimationFrame`. When playback crosses B, it instantly seeks back to A — no stutter, no reloading.

## 📥 Installation

### Chrome Web Store *(coming soon)*

### Load from source

```bash
git clone https://github.com/quanggpham/youloop.git
cd youloop
npm install
npm run build
```

Then:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the project folder

## ⌨️ Usage

| Action | How |
|--------|-----|
| Set loop start (A) | Click **Set A** button, or drag left marker on progress bar |
| Set loop end (B) | Click **Set B** button, or drag right marker on progress bar |
| Toggle loop | Click **A↻B** button |
| Enable/disable extension | Click toolbar icon → toggle switch |

Keyboard shortcuts can be customized at `chrome://extensions/shortcuts`.

## 🛠️ Development

```bash
npm run dev        # Watch mode
npm run build      # Production build → dist/
npm test           # Unit tests (Vitest)
npm run test:e2e   # End-to-end tests (Playwright)
```

## 🏗️ Structure

```
src/
├── content/               # Injected into youtube.com
│   ├── index.ts           # Wiring & lifecycle
│   ├── loop-engine.ts     # rAF-based loop monitor
│   ├── timeline-ui.ts     # Buttons, markers, progress bar
│   ├── youtube-detector.ts # Watch/embed page detection
│   └── message-bus.ts     # chrome.runtime messaging
├── sw/                    # Service Worker
│   ├── index.ts           # Message routing
│   └── storage.ts         # chrome.storage.local CRUD
├── popup/                 # Toolbar popup
│   ├── index.html
│   └── index.ts
└── shared/
    └── types.ts           # Shared types & message protocol
```

Built with [esbuild](https://esbuild.github.io/) into a single bundle per entry point.

## 🔒 Privacy

YouLoop does **not** collect, transmit, or share any data. Loop points and settings are stored locally via `chrome.storage.local`. No analytics, no servers, no tracking.

See [privacy-policy.md](privacy-policy.md) for details.

## 📄 License

MIT © quangpham

---

<p align="center">
  <sub>
    <a href="https://ko-fi.com/dzungquangpham">☕ Buy me a coffee</a>
  </sub>
</p>
