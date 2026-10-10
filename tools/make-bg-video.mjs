// Gera assets/consultorio.mp4 (loop de 12 s) a partir do cenario SVG animado.
// Uso (precisa de playwright-core e ffmpeg):  node tools/make-bg-video.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { officeSVG } from '../src/backgrounds.js';

const FPS = 24;
const SECONDS = 12;
const tmp = process.env.FRAMES_DIR || '/tmp/consultorio-frames';
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.setContent(`<body style="margin:0">${officeSVG(true).replace('<svg ', '<svg id="s" width="1920" height="1080" ')}</body>`);
await page.evaluate(() => document.getElementById('s').pauseAnimations());
const total = FPS * SECONDS; // o ultimo quadro nao repete o primeiro: o loop fecha sem emenda
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => document.getElementById('s').setCurrentTime(t), i / FPS);
  await page.screenshot({ path: `${tmp}/f${String(i).padStart(4, '0')}.png` });
}
await browser.close();
mkdirSync('assets', { recursive: true });
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', `${tmp}/f%04d.png`,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', 'assets/consultorio.mp4']);
console.log('OK: assets/consultorio.mp4');
