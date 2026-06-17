# Smart Video Loop — UI Design Prompt for Claude Design

## Context

I'm building a Chrome extension called "Smart Video Loop" that lets users select a time range (A→B) on a YouTube video and loop that segment continuously. The UI is injected directly into YouTube's existing player controls area.

**Platform:** Chrome Extension, YouTube only
**Injection target:** `#movie_player` container on youtube.com/watch pages
**Accent color:** `#FF4081` (hot pink) — needs to contrast with YouTube's red (#FF0000)

---

## Design Requirements

### 1. Overall Style

- **Dark theme** — must blend seamlessly with YouTube's native dark player controls
- **Compact & minimal** — don't clutter the player. Buttons should be small, icon-heavy
- **Font:** Match YouTube's font stack: `'YouTube Sans', 'Roboto', Arial, sans-serif`
- **Background for controls bar:** `rgba(0, 0, 0, 0.4)` semi-transparent black, rounded corners
- **Z-index:** High enough to sit above YouTube's controls but below any overlays
- **All interactions should feel native** — hover states, active states, transitions

### 2. Control Bar (3 buttons + time display)

Position: Inserted near YouTube's native control bar (bottom of player).

Components:

**a) Toggle Loop Button**
- Label: `A↻B`
- Function: Toggles the loop ON/OFF
- **Inactive state:** Transparent background, white text, pink border (`1px solid #FF4081`)
- **Active state:** Pink background (`#FF4081`), dark text (`#000`), no border needed
- Hover: Slight brightness increase
- Tooltip on hover: "Toggle Loop (Ctrl+Shift+L)"

**b) Set A Button (Loop Start)**
- Label: `⏺ A` or just `A` with a small dot icon
- Function: Captures current video time as loop start point
- Style: Transparent background, white text, pink border
- Tooltip: "Set Loop Start (Ctrl+Shift+A)"

**c) Set B Button (Loop End)**
- Label: `⏹ B` or just `B` with a small square icon
- Function: Captures current video time as loop end point
- Style: Same as Set A
- Tooltip: "Set Loop End (Ctrl+Shift+B)"

**d) Time Display**
- Format: `1:30 — 3:45` (minutes:seconds — minutes:seconds)
- Style: Monospace font, pink color (`#FF4081`), bold, smaller than buttons
- Initial state (no loop set): `—:— — —:—`

**Layout:**
```
[A↻B]  [A]  [B]  1:30 — 3:45
```
All in a single horizontal row with 8px gaps between items.

### 3. Progress Bar Markers

Overlaid directly on YouTube's `.ytp-progress-bar` element.

**a) Start Marker (A)**
- 3px wide vertical bar spanning the full height of the progress bar
- Color: `#FF4081`
- Cursor: `ew-resize` (horizontal resize)
- Has a small circular handle at the top (6px diameter) for easier grabbing
- Draggable horizontally to adjust loop start

**b) End Marker (B)**
- Same as Start Marker but positioned further right
- Same drag behavior

**c) Loop Region Highlight**
- Semi-transparent pink overlay between A and B markers
- Color: `rgba(255, 64, 129, 0.25)`
- Spans from start marker to end marker
- z-index below markers so markers are always grabbable

**Marker interaction states:**
- Default: 3px wide, pink
- Hover: Width expands to 5px, cursor changes, slight glow effect
- Dragging: Width stays at 5px, opacity increases to full

### 4. Visual States

Show me designs for these states:

| State | Toggle Button | Set A/B Buttons | Time Display | Markers | Highlight |
|-------|--------------|-----------------|--------------|---------|-----------|
| **Empty** (no loop) | Inactive style | Visible | `—:— — —:—` | Hidden | Hidden |
| **Ready** (A & B set, not looping) | Inactive style | Visible | `1:30 — 3:45` | Visible | Visible |
| **Looping** | Active style (pink bg) | Visible | `1:30 — 3:45` | Visible | Visible |
| **Paused** (ad playing / user seeked out) | Active but dimmed | Visible | `1:30 — 3:45` | Visible, dimmed | Visible, dimmed |

### 5. Additional UI Elements

**a) Toast notification** (for errors like "Start and end cannot be equal")
- Appears briefly (3 seconds) then fades out
- Dark background, pink left border, white text
- Position: top-right of player container

**b) Warning indicator** (for very short loops < 1 second)
- Small yellow warning icon next to time display
- Tooltip: "Very short loop may cause stuttering"

---

## Deliverables I Need

1. **Component library** — each UI piece as a standalone component:
   - Loop control bar (all 4 items together)
   - Progress bar markers (start + end + region)
   - Toast notification
   - Warning indicator

2. **Mockup of the full player** — showing how everything looks together on a real YouTube player:
   - Show the empty state
   - Show the looping state

3. **Interaction specs** — hover, active, and transition animations for buttons and markers

4. **CSS variables/design tokens** — the design system tokens I should use in code:
   ```css
   --svl-accent: #FF4081;
   --svl-accent-dim: rgba(255, 64, 129, 0.25);
   --svl-bg-controls: rgba(0, 0, 0, 0.4);
   --svl-text: #FFFFFF;
   --svl-text-dim: #AAAAAA;
   --svl-marker-width: 3px;
   --svl-marker-width-hover: 5px;
   --svl-radius: 4px;
   --svl-font: 'YouTube Sans', 'Roboto', Arial, sans-serif;
   --svl-font-mono: 'Roboto Mono', monospace;
   ```

---

## Constraints

- **Must work within YouTube's DOM** — can't restructure YouTube's player, only inject into it
- **Must survive YouTube updates** — avoid depending on fragile CSS class names where possible
- **Must be responsive** — player width varies (theater mode, mini player, fullscreen)
- **Must handle RTL languages** (Arabic, Hebrew) if YouTube switches to RTL layout
- **Performance:** No heavy animations during active looping (60fps rAF already running)

---

## Reference

YouTube's current player control bar uses:
- Dark semi-transparent gradient at the bottom
- White icons with hover opacity changes
- Red progress bar (#FF0000)
- Compact icon buttons (~36px touch targets)
- Tooltips on hover with slight delay

Our pink accent `#FF4081` was chosen to clearly contrast with YouTube's red while still feeling energetic and video-appropriate.
