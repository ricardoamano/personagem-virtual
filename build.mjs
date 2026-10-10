// Junta tudo (codigo + three.js) em UM unico arquivo HTML que funciona offline.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  target: 'es2020',
});

const js = result.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>');
// arquivos embutidos (base64), para o HTML funcionar sozinho, sem internet e sem pastas
const embed = (id, path) =>
  existsSync(path) ? `<script type="text/plain" id="${id}">${readFileSync(path).toString('base64')}</script>\n` : '';
const assets = embed('glb-medico', 'assets/medico.glb') + embed('vid-consultorio', 'assets/consultorio.mp4') + embed('vid-consultorio-webm', 'assets/consultorio.webm');
const html = readFileSync('src/index.html', 'utf8').replace(
  '<!--BUNDLE-->',
  () => `${assets}<script>${js}</script>`,
);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/personagem-virtual.html', html);
console.log(`OK: dist/personagem-virtual.html (${(html.length / 1024).toFixed(0)} KB)`);
