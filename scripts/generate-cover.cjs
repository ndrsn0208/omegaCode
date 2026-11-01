const fs = require("node:fs");
const path = require("node:path");
const O = require("../demo/omega.js");
const fixture = require("../tests/fixtures/java-reference.json")[3];
const material = O.parseKeys(fixture.keyPack, fixture.privateKey);
const selected = 22;
const row = material.indexes[selected];
const cell = 4.6;
const x = 905;
const y = 34;
let cells = "";
for (let r = 0; r < 64; r++) {
  for (let c = 0; c < 64; c++) {
    const active = c === selected || r === row;
    const alpha = active ? 0.6 : (0.1 + (material.matrix[r][c] - 32) / 94 * 0.3);
    cells += `<rect x="${(x + c * cell).toFixed(1)}" y="${(y + r * cell).toFixed(1)}" width="3.7" height="3.7" fill="${active ? "#a9d9b9" : "#a0b9ad"}" opacity="${alpha.toFixed(2)}"/>\n`;
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="364" viewBox="0 0 1280 364" role="img" aria-labelledby="title desc">
<title id="title">Omega Code</title>
<desc id="desc">A 2017 cryptography experiment, made visible. The original key matrix is rendered on the right.</desc>
<rect width="1280" height="364" rx="18" fill="#14201b"/>
<g font-family="system-ui, -apple-system, Segoe UI, sans-serif">
<text x="58" y="55" fill="#a9baae" font-size="14" letter-spacing="3">2017 / AN EXPERIMENT REVISITED</text>
<text x="56" y="154" fill="#d9ede1" font-size="94" font-weight="500">Ω</text>
<text x="158" y="150" fill="#f0f5f1" font-size="65" font-weight="500" letter-spacing="-2">OMEGA CODE</text>
<text x="61" y="216" fill="#d4e4d9" font-size="28">An old cipher. A continuous piece of motion.</text>
<path d="M61 249 H787" stroke="#344b3e" stroke-width="1"/>
<text x="61" y="293" fill="#abcbb5" font-size="14" letter-spacing="2">SHUFFLE</text>
<text x="197" y="293" fill="#709780" font-size="18">→</text>
<text x="240" y="293" fill="#abcbb5" font-size="14" letter-spacing="2">SUBSTITUTE</text>
<text x="415" y="293" fill="#709780" font-size="18">→</text>
<text x="458" y="293" fill="#abcbb5" font-size="14" letter-spacing="2">REVERSE</text>
<text x="907" y="347" fill="#a9baae" font-size="11" letter-spacing="1.8">64 × 64 / THE ORIGINAL MATRIX</text>
</g>
${cells}
</svg>
`;
const output = path.join(__dirname, "..", "docs", "assets");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "cover.svg"), svg);
console.log("Generated docs/assets/cover.svg from the original Java fixture.");
