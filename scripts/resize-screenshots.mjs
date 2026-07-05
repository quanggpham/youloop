// Quick resize any image to exact dimensions for Chrome Web Store
// Usage: node scripts/resize-screenshots.mjs <input-file> 1280 800
import sharp from 'sharp';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node scripts/resize-screenshots.mjs <input-file> <width> <height>');
  console.log('Example: node scripts/resize-screenshots.mjs screenshot.png 1280 800');
  process.exit(1);
}

const [input, w, h] = args;
const width = parseInt(w);
const height = parseInt(h);
const inputPath = resolve(input);
const ext = extname(inputPath);
const name = basename(inputPath, ext);
const outputPath = resolve(dirname(inputPath), `${name}-${width}x${height}${ext}`);

await sharp(inputPath)
  .resize(width, height, {
    kernel: 'lanczos3',
    fit: 'fill',          // stretch to exact size
  })
  .png()
  .toFile(outputPath);

console.log(`✅ ${outputPath}`);
console.log(`   ${width}×${height}`);
