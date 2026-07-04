import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const releaseDir = resolve(root, 'release');
const zipPath = resolve(releaseDir, 'youloop.zip');

// 1. Build
console.log('🔨 Building...');
execFileSync('node', ['esbuild.config.mjs'], { cwd: root, stdio: 'inherit' });

// 2. Clean release dir
if (existsSync(releaseDir)) rmSync(releaseDir, { recursive: true });
mkdirSync(releaseDir, { recursive: true });

// 3. Files to include in ZIP
//    MUST be Chrome Web Store-compatible: no source maps, no tests, no node_modules
const files = [
  'manifest.json',
  'dist/content.js',
  'dist/popup.js',
  'dist/popup.html',
  'dist/sw.js',
  'privacy-policy.md',
  'assets/icons/icon-16.png',
  'assets/icons/icon-48.png',
  'assets/icons/icon-128.png',
];

console.log('📦 Adding to ZIP:');
for (const f of files) {
  console.log(`   ${f}`);
  const abs = resolve(root, f);
  if (!existsSync(abs)) throw new Error(`Missing file: ${f} — run npm run build first`);
}

// 4. Zip all files with relative paths using PowerShell Compress-Archive
//    We need relative paths so the ZIP doesn't have deep folder structures
const entryDir = resolve(releaseDir, 'youloop');

// Clean & recreate staging dir
if (existsSync(entryDir)) rmSync(entryDir, { recursive: true });
mkdirSync(entryDir, { recursive: true });

// Copy files to staging, preserving directory structure
execFileSync('powershell', [
  '-NoProfile',
  '-Command',
  `$root = '${root.replace(/'/g, "''")}'; $entryDir = '${entryDir.replace(/'/g, "''")}'; $files = @(${files.map(f => `'${f.replace(/'/g, "''")}'`).join(', ')}); foreach ($f in $files) { $src = Join-Path $root $f; $dst = Join-Path $entryDir $f; $dir = Split-Path $dst -Parent; if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }; Copy-Item $src $dst -Force }`,
], { cwd: root, stdio: 'inherit' });

// Create ZIP from staging dir
execFileSync('powershell', [
  '-NoProfile',
  '-Command',
  `Compress-Archive -Force -Path '${entryDir.replace(/'/g, "''")}/*' -DestinationPath '${zipPath.replace(/'/g, "''")}'`,
], { cwd: root, stdio: 'inherit' });

// Cleanup staging
rmSync(entryDir, { recursive: true });

// Show result
const size = statSync(zipPath).size;
const sizeKB = (size / 1024).toFixed(1);
console.log(`\n✅ Done!  youloop.zip (${sizeKB} KB)`);
console.log(`   ${zipPath}`);
