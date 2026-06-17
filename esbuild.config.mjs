import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [
    { in: 'src/content/index.ts', out: 'content' },
    { in: 'src/sw/index.ts', out: 'sw' },
  ],
  bundle: true,
  outdir: 'dist',
  target: 'es2022',
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
  minify: false,
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('Build complete.');
}
