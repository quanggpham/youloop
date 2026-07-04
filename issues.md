# Issues — Code Review (2026-07-01)

## Fixed (2026-07-02)

### #1 CRITICAL — `esbuild.config.mjs`: popup.html not copied in watch/dev mode ✅
`cpSync('src/popup/index.html', 'dist/popup.html')` only ran in the `else` branch (non-watch build). When `npm run dev`, popup.html was never copied to dist → popup shows 404.

**Fix:** Moved `cpSync` to run after the if/else block so it executes in both build and watch modes.

### #2 MEDIUM — Dead code: `clientXToRatio` in `timeline-ui.ts` ✅
Already removed in prior refactor. No action needed.

### #3 MEDIUM — `init()` could be double-called when `SET_ENABLED(true)` arrives while extension is already active ✅
Already fixed: `cleanup()` is called before `init()` in the `SET_ENABLED` handler.

### #4 LOW — `.ytp-right-controls` uses `document.querySelector` instead of scoped query ✅
Changed `document.querySelector('.ytp-right-controls')` → `container.querySelector('.ytp-right-controls')` to avoid picking the wrong element if multiple YouTube players exist on the page.
