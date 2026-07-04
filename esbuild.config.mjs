import * as esbuild from 'esbuild';
import { cpSync, renameSync, existsSync, mkdirSync } from 'node:fs';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [
    { in: 'src/content/index.ts', out: 'content' },
    { in: 'src/sw/index.ts', out: 'sw' },
    { in: 'src/popup/index.ts', out: 'popup' },
  ],
  bundle: true,
  outdir: 'dist',
  target: 'es2022',
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
  minify: false,
};

async function build() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('Build complete.');
  }
}

await build();

// Copy popup HTML to dist/ — must run in both build and watch modes
// to ensure popup.html is always available
cpSync('src/popup/index.html', 'dist/popup.html');
