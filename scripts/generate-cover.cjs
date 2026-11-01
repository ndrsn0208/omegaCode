const fs = require('node:fs');
const path = require('node:path');
const O = require('../demo/omega.js');
const material = O.makeMaterial(
  Array.from({ length: 128 }, (_, i) => 32 + (i * 29) % 95),
  Array.from({ length: 128 }, (_, i) => i === 0 ? 123 : (i * 17) % 128),
);
const records = O.mappings(O.encrypt('AAAA AAAA AAAA', material)).filter(r => r.input === 65).slice(0, 3);
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
let cells = '';
// The banner thumbnail samples the real 128×128 matrix at one cell per 4×4 block.
for (let row = 0; row < 32; row++) {
  for (let col = 0; col < 32; col++) {
    const alpha = .14 + (material.matrix[row * 4][col * 4] - 32) / 94 * .42;
    cells += `<rect x="${934 + col * 8}" y="${44 + row * 8}" width="6" height="6" fill="#28c7ef" opacity="${alpha.toFixed(2)}"/>\n`;
  }
}
let examples = '';
records.forEach((record, i) => {
  const x = 56 + i * 252;
  examples += `<text x="${x}" y="263" fill="#38d2f2" font-size="34">A</text><text x="${x + 49}" y="263" fill="#b8cada" font-size="30">→</text><text x="${x + 103}" y="263" fill="#ff9d4d" font-size="34">${xml(O.unitLabel(record.output))}</text><text x="${x}" y="304" fill="#b8cada" font-size="17">Input #${record.inputPosition} · M[${record.row},${record.column}]</text>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="364" viewBox="0 0 1280 364" role="img" aria-labelledby="title desc">
<title id="title">OmegaCode — 128 × 128 Cipher Visualizer</title><desc id="desc">The same input character maps through different matrix positions. Cyan inputs and orange outputs.</desc>
<rect width="1280" height="364" rx="16" fill="#091b2c"/>
<g font-family="system-ui, -apple-system, Segoe UI, sans-serif"><text x="56" y="103" fill="#edf7ff" font-size="60" font-weight="600">OmegaCode</text><text x="58" y="157" fill="#28c7ef" font-size="30">128 × 128 Cipher Visualizer</text><text x="58" y="199" fill="#b8cada" font-size="20">Same character. Position-dependent mapping.</text>${examples}<text x="935" y="333" fill="#b8cada" font-size="17">128 × 128 matrix preview</text></g>${cells}</svg>\n`;
const output = path.join(__dirname, '..', 'docs', 'assets');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'cover.svg'), svg);
console.log('Generated cyan/orange cover with actual 128×128 mappings.');
