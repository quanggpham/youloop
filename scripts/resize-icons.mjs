// High-quality icon resize using Playwright + Sharp (install: npm install --save-dev sharp)
// Usage: node scripts/resize-icons.mjs
// Falls back to canvas-based resize if sharp is not available (still good quality)
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'icons');
const SRC = resolve(OUT, 'icon.png');

const ICONS = [
  { size: 16, name: 'icon-16.png' },
  { size: 48, name: 'icon-48.png' },
  { size: 128, name: 'icon-128.png' },
];

async function main() {
  if (!existsSync(SRC)) {
    console.error(`Source not found: ${SRC}`);
    process.exit(1);
  }

  // Try sharp first (best quality)
  let sharp;
  try {
    sharp = await import('sharp');  // dynamic import for ESM
    sharp = sharp.default;
  } catch {
    console.log('Sharp not available, falling back to Playwright canvas scaling...');
  }

  if (sharp) {
    // ── High-quality resize with sharp ──
    for (const { size, name } of ICONS) {
      const outPath = resolve(OUT, name);
      // For 16x16, resize from 48x48 to get better detail via step-down
      const workingSize = size === 16 ? 64 : size; // 16px icon: resize to 64 first, then 16 for better detail preservation

      let pipeline = sharp(SRC)
        .resize(workingSize, workingSize, {
          kernel: 'lanczos3',
          fit: 'cover',
          position: 'center',
        });

      // For 16px, do a two-step resize for best quality
      if (size === 16) {
        const intermediate = await pipeline.png().toBuffer();
        pipeline = sharp(intermediate).resize(16, 16, { kernel: 'lanczos3' });
      }

      await pipeline.png().toFile(outPath);
      console.log(`✓ ${name} (${size}×${size}) [sharp+lanczos3]`);
    }
    console.log('Done.');
    return;
  }

  // ── Fallback: Playwright with canvas 2D for better quality ──
  const { chromium } = await import('playwright');
  const imgPath = SRC.replace(/\\/g, '/');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const { size, name } of ICONS) {
    // Use 2x canvas for higher quality downscaling
    const canvasSize = size * 2;
    await page.setViewportSize({ width: canvasSize, height: canvasSize });
    await page.setContent(`<!DOCTYPE html>
<html><head><style>
  body { margin: 0; padding: 0; width: ${canvasSize}px; height: ${canvasSize}px; overflow: hidden; }
  canvas { width: ${canvasSize}px; height: ${canvasSize}px; display: block; }
</style></head>
<body>
  <canvas id="c" width="${size}" height="${size}"></canvas>
  <script>
    const img = new Image();
    img.onload = () => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
    };
    img.src = 'file:///${imgPath}';
  </script>
</body></html>`);

    await page.waitForSelector('canvas');
    await page.waitForTimeout(500);

    const outPath = resolve(OUT, name);
    await page.screenshot({ path: outPath, type: 'png', clip: { x: 0, y: 0, width: canvasSize, height: canvasSize } });

    const stats = (await import('node:fs')).statSync(outPath);
    console.log(`✓ ${name} (${size}×${size}) [canvas 2x] — ${(stats.size / 1024).toFixed(1)}KB`);
  }

  await browser.close();
  console.log('Done. For best quality, install sharp: npm install --save-dev sharp');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
