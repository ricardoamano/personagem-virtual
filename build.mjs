// Junta tudo (codigo + three.js) em UM unico arquivo HTML que funciona offline.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  target: 'es2020',
});

const js = result.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>');
const html = readFileSync('src/index.html', 'utf8').replace(
  '<!--BUNDLE-->',
  () => `<script>${js}</script>`,
);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/personagem-virtual.html', html);
console.log(`OK: dist/personagem-virtual.html (${(html.length / 1024).toFixed(0)} KB)`);
