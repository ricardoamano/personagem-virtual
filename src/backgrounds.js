// Fundos prontos. Sao imagens 2D (nao precisam ser 3D): ficam atras do personagem.

const O = '#2b4a52'; // cor do contorno (estilo cartoon)

function floorLines() {
  let s = '';
  const vpx = 960;
  const vpy = 300;
  const top = 700;
  const bottom = 1080;
  for (let xb = -1800; xb <= 3720; xb += 240) {
    const k = (top - vpy) / (bottom - vpy);
    const xt = vpx + (xb - vpx) * k;
    s += `<line x1="${xt.toFixed(1)}" y1="${top}" x2="${xb}" y2="${bottom}" stroke="#c3d4dc" stroke-width="3"/>`;
  }
  [730, 768, 812, 866, 934, 1022].forEach((y) => {
    s += `<line x1="0" y1="${y}" x2="1920" y2="${y}" stroke="#c3d4dc" stroke-width="3"/>`;
  });
  return s;
}

function books(x, y) {
  const colors = ['#e4572e', '#3d8bfd', '#f2c230', '#58a55c', '#8e6bbf', '#e4572e', '#3d8bfd'];
  const heights = [86, 104, 92, 110, 88, 98, 84];
  let s = '';
  let cx = x;
  colors.forEach((c, i) => {
    const w = 26 + (i % 3) * 6;
    s += `<rect x="${cx}" y="${y - heights[i]}" width="${w}" height="${heights[i]}" rx="4" fill="${c}" stroke="${O}" stroke-width="5"/>`;
    cx += w + 4;
  });
  return s;
}

export function officeSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
<defs>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3f4f5"/><stop offset="1" stop-color="#bfe3e6"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ec8f5"/><stop offset="1" stop-color="#dff3ff"/></linearGradient>
  <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <clipPath id="floorClip"><rect x="0" y="700" width="1920" height="380"/></clipPath>
</defs>

<!-- parede e chao -->
<rect width="1920" height="700" fill="url(#wall)"/>
<rect y="520" width="1920" height="180" fill="#a9d6db"/>
<rect y="508" width="1920" height="16" fill="#ffffff" stroke="${O}" stroke-width="4"/>
<rect y="700" width="1920" height="380" fill="#e6eef2"/>
<g clip-path="url(#floorClip)">${floorLines()}</g>
<rect y="684" width="1920" height="22" fill="#8fb7bd" stroke="${O}" stroke-width="5"/>

<!-- luz do teto -->
<rect x="540" y="0" width="840" height="34" rx="10" fill="#ffffff" stroke="${O}" stroke-width="5"/>
<polygon points="560,34 1360,34 1560,420 360,420" fill="url(#glow)" opacity=".35"/>

<!-- janela -->
<rect x="110" y="110" width="420" height="360" rx="18" fill="#ffffff" stroke="${O}" stroke-width="8"/>
<rect x="134" y="134" width="372" height="312" rx="8" fill="url(#sky)" stroke="${O}" stroke-width="5"/>
<ellipse cx="240" cy="230" rx="62" ry="26" fill="#fff"/><ellipse cx="290" cy="214" rx="44" ry="26" fill="#fff"/>
<ellipse cx="410" cy="320" rx="56" ry="22" fill="#fff"/><ellipse cx="452" cy="306" rx="34" ry="20" fill="#fff"/>
<rect x="314" y="134" width="12" height="312" fill="#fff" stroke="${O}" stroke-width="4"/>
<rect x="134" y="284" width="372" height="12" fill="#fff" stroke="${O}" stroke-width="4"/>
<rect x="96" y="466" width="448" height="26" rx="8" fill="#ffffff" stroke="${O}" stroke-width="6"/>

<!-- cartaz: tabela de visao -->
<rect x="640" y="120" width="190" height="270" rx="10" fill="#ffffff" stroke="${O}" stroke-width="7"/>
<g font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#243b43" text-anchor="middle">
  <text x="735" y="190" font-size="64">E</text>
  <text x="735" y="244" font-size="44">F P</text>
  <text x="735" y="288" font-size="32">T O Z</text>
  <text x="735" y="324" font-size="24">L P E D</text>
  <text x="735" y="354" font-size="17">P E C F D</text>
</g>

<!-- relogio -->
<circle cx="960" cy="170" r="62" fill="#ffffff" stroke="${O}" stroke-width="8"/>
<line x1="960" y1="170" x2="960" y2="126" stroke="${O}" stroke-width="7" stroke-linecap="round"/>
<line x1="960" y1="170" x2="992" y2="186" stroke="${O}" stroke-width="7" stroke-linecap="round"/>
<circle cx="960" cy="170" r="6" fill="#e4572e"/>

<!-- cruz medica -->
<rect x="1090" y="120" width="200" height="200" rx="16" fill="#ffffff" stroke="${O}" stroke-width="7"/>
<rect x="1164" y="152" width="52" height="136" rx="6" fill="#e4572e"/>
<rect x="1122" y="194" width="136" height="52" rx="6" fill="#e4572e"/>

<!-- diplomas -->
<rect x="1100" y="350" width="86" height="64" rx="6" fill="#fff8e4" stroke="${O}" stroke-width="6"/>
<rect x="1204" y="350" width="86" height="64" rx="6" fill="#fff8e4" stroke="${O}" stroke-width="6"/>
<line x1="1112" y1="372" x2="1174" y2="372" stroke="#b79b5a" stroke-width="5"/><line x1="1112" y1="390" x2="1160" y2="390" stroke="#b79b5a" stroke-width="5"/>
<line x1="1216" y1="372" x2="1278" y2="372" stroke="#b79b5a" stroke-width="5"/><line x1="1216" y1="390" x2="1264" y2="390" stroke="#b79b5a" stroke-width="5"/>

<!-- estante -->
<rect x="1420" y="230" width="400" height="18" rx="6" fill="#c89b6b" stroke="${O}" stroke-width="6"/>
${books(1440, 230)}
<rect x="1640" y="170" width="70" height="60" rx="10" fill="#e8f6ff" stroke="${O}" stroke-width="5"/>
<rect x="1650" y="156" width="50" height="18" rx="5" fill="#3d8bfd" stroke="${O}" stroke-width="4"/>
<circle cx="1760" cy="196" r="32" fill="#f4f1ea" stroke="${O}" stroke-width="5"/>
<rect x="1420" y="400" width="400" height="18" rx="6" fill="#c89b6b" stroke="${O}" stroke-width="6"/>
<rect x="1450" y="334" width="110" height="66" rx="8" fill="#ffffff" stroke="${O}" stroke-width="5"/>
<rect x="1470" y="352" width="70" height="14" rx="3" fill="#e4572e"/>
<rect x="1600" y="344" width="64" height="56" rx="8" fill="#f2c230" stroke="${O}" stroke-width="5"/>
<rect x="1700" y="340" width="90" height="60" rx="8" fill="#58a55c" stroke="${O}" stroke-width="5"/>

<!-- maca de exame (esquerda) -->
<rect x="90" y="610" width="12" height="90" fill="#9fb4bd" stroke="${O}" stroke-width="4"/>
<rect x="470" y="610" width="12" height="90" fill="#9fb4bd" stroke="${O}" stroke-width="4"/>
<rect x="70" y="540" width="430" height="74" rx="22" fill="#6aa6d6" stroke="${O}" stroke-width="7"/>
<rect x="70" y="520" width="430" height="34" rx="14" fill="#ffffff" stroke="${O}" stroke-width="6"/>
<rect x="70" y="486" width="130" height="44" rx="16" fill="#ffffff" stroke="${O}" stroke-width="6"/>

<!-- mesa (direita) -->
<rect x="1370" y="560" width="470" height="30" rx="8" fill="#c89b6b" stroke="${O}" stroke-width="7"/>
<rect x="1390" y="590" width="190" height="112" rx="6" fill="#b88655" stroke="${O}" stroke-width="6"/>
<rect x="1640" y="590" width="180" height="112" rx="6" fill="#b88655" stroke="${O}" stroke-width="6"/>
<line x1="1390" y1="646" x2="1580" y2="646" stroke="${O}" stroke-width="5"/>
<rect x="1470" y="440" width="190" height="118" rx="12" fill="#223a42" stroke="${O}" stroke-width="7"/>
<rect x="1484" y="454" width="162" height="88" rx="6" fill="#8fe0c1"/>
<polyline points="1492,500 1524,500 1536,468 1552,526 1566,490 1580,500 1638,500" fill="none" stroke="#1f6f57" stroke-width="6" stroke-linejoin="round"/>
<rect x="1546" y="558" width="40" height="8" fill="#223a42"/>
<rect x="1700" y="520" width="44" height="40" rx="8" fill="#ffffff" stroke="${O}" stroke-width="5"/>
<path d="M1744,530 q22,4 0,22" fill="none" stroke="${O}" stroke-width="5"/>

<!-- planta -->
<rect x="1812" y="610" width="70" height="90" rx="10" fill="#d9744a" stroke="${O}" stroke-width="6"/>
<ellipse cx="1846" cy="560" rx="22" ry="62" fill="#58a55c" stroke="${O}" stroke-width="5" transform="rotate(-24 1846 560)"/>
<ellipse cx="1846" cy="552" rx="22" ry="68" fill="#6bbd6f" stroke="${O}" stroke-width="5"/>
<ellipse cx="1846" cy="560" rx="22" ry="62" fill="#58a55c" stroke="${O}" stroke-width="5" transform="rotate(24 1846 560)"/>
</svg>`;
}

export function officeDataURL() {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(officeSVG())}`;
}
