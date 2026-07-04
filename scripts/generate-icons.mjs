// Generate extension icons from SVG via headless Chromium
// Usage: node scripts/generate-icons.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'icons');

// Modern glossy SVG for 48px and 128px — filled circle + white loop arrows, glossy highlight
const SVG_GLASS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <!-- Main circle gradient: vibrant red with depth -->
    <radialGradient id="bgGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%"   stop-color="#FF3333"/>
      <stop offset="45%"  stop-color="#FF0000"/>
      <stop offset="80%"  stop-color="#CC0000"/>
      <stop offset="100%" stop-color="#990000"/>
    </radialGradient>

    <!-- Glossy specular highlight (top-left) -->
    <radialGradient id="gloss" cx="30%" cy="30%" r="55%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="50%"  stop-color="#ffffff" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>

    <!-- Subtle inner shadow for depth -->
    <filter id="innerShadow">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur"/>
      <feOffset dx="0" dy="1" result="offset"/>
      <feComposite in="SourceGraphic" in2="offset" operator="over"/>
    </filter>

    <!-- Drop shadow -->
    <filter id="shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="2.5" stdDeviation="3.5" flood-color="#990000" flood-opacity="0.3"/>
    </filter>

    <!-- Bottom reflection highlight -->
    <radialGradient id="bottomGlow" cx="50%" cy="90%" r="50%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Filled circle base with shadow -->
  <circle cx="64" cy="64" r="56" fill="url(#bgGrad)" filter="url(#shadow)"/>

  <!-- Bottom glow reflection -->
  <circle cx="64" cy="64" r="56" fill="url(#bottomGlow)"/>

  <!-- Glossy highlight overlay -->
  <circle cx="64" cy="64" r="56" fill="url(#gloss)"/>

  <!-- Subtle inner ring highlight -->
  <circle cx="64" cy="64" r="52" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1"/>

  <!-- Loop arrows (white, clean modern design) -->
  <g transform="translate(64,64)"
     fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <!-- Top arc -->
    <path d="M-16,-2 A20,20 0 0,1 16,-2"/>
    <!-- Top arrowhead -->
    <polyline points="-20,-2 -10,4 -4,-4"/>
    <!-- Bottom arc -->
    <path d="M16,8 A20,20 0 0,1 -16,8"/>
    <!-- Bottom arrowhead -->
    <polyline points="20,8 10,0 4,8"/>
  </g>
</svg>`;

// Sharp simplified SVG for 16px — filled circle + white loop arrows, no background
const SVG_SHARP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
  <defs>
    <radialGradient id="g16" cx="35%" cy="35%" r="65%">
      <stop offset="0%"   stop-color="#FF3333"/>
      <stop offset="50%"  stop-color="#FF0000"/>
      <stop offset="100%" stop-color="#CC0000"/>
    </radialGradient>
  </defs>

  <!-- Filled circle -->
  <circle cx="8" cy="8" r="7" fill="url(#g16)"/>

  <!-- Glossy top-left highlight dot -->
  <circle cx="5.5" cy="5.5" r="2.5" fill="#ffffff" fill-opacity="0.25"/>

  <!-- Arrows inside -->
  <g transform="translate(8,8)"
     fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <!-- Top arc -->
    <path d="M-4,-0.2 A4.5,4.5 0 0,1 4,-0.2"/>
    <!-- Top arrowhead -->
    <polyline points="-5.5,-0.2 -2.5,1.2 -0.5,-1.2" stroke-width="1.3"/>
    <!-- Bottom arc -->
    <path d="M4,2 A4.5,4.5 0 0,1 -4,2"/>
    <!-- Bottom arrowhead -->
    <polyline points="5.5,2 2.5,0 0.5,2" stroke-width="1.3"/>
  </g>
</svg>`;

const ICONS = [
  { size: 16, svg: SVG_SHARP },
  { size: 48, svg: SVG_GLASS },
  { size: 128, svg: SVG_GLASS },
];

async function main() {
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const { size, svg } of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!DOCTYPE html>
<html><head><style>
  body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; overflow: hidden; }
  img { width: ${size}px; height: ${size}px; image-rendering: auto; display: block; }
</style></head>
<body>
  <img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" width="${size}" height="${size}" alt="" />
</body></html>`);

    const path = resolve(OUT, `icon-${size}.png`);
    await page.screenshot({ path, type: 'png', clip: { x: 0, y: 0, width: size, height: size } });
    console.log(`✓ icon-${size}.png (${size}×${size})`);
  }

  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
