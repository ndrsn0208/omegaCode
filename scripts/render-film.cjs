// Optional artwork tool: uses the exact renderer shipped to the browser.
// Requires @napi-rs/canvas. Usage: node scripts/render-film.cjs /output/frames
const fs = require("node:fs");
const path = require("node:path");
const { createCanvas } = require("@napi-rs/canvas");
const O = require("../demo/omega.js");
const M = require("../demo/motion.js");
const fixture = require("../tests/fixtures/java-reference.json")[3];
const material = O.parseKeys(fixture.keyPack, fixture.privateKey);
const encryption = O.encrypt("HELLO, OMEGA!", material);
const traces = [encryption, O.decrypt(encryption.output, material)];
const output = path.resolve(process.argv[2] || ".artifacts/film");
fs.mkdirSync(output, { recursive: true });
const width = 960;
const height = 550;
const fps = 24;
const framesPerMode = fps * 15;
const canvas = createCanvas(width, height);
const context = canvas.getContext("2d");
const drawing = createCanvas(width - 80, 350);
const drawingContext = drawing.getContext("2d");
const palette = {
  ink: "#173c32", green: "#297456", gold: "#b27a41",
  soft: "#6a7b70", line: "#dce3d9", paper: "#f5f6f0",
};
let index = 0;
for (const trace of traces) {
  const scene = M.createScene(trace);
  for (let i = 0; i < framesPerMode; i++) {
    const progress = i / (framesPerMode - 1);
    context.fillStyle = palette.paper;
    context.fillRect(0, 0, width, height);
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = palette.ink;
    context.font = "36px Georgia";
    context.fillText("Ω", 40, 42);
    context.font = "12px Arial";
    context.fillText("O M E G A   C O D E", 81, 37);
    context.fillStyle = palette.soft;
    context.font = "11px Arial";
    context.fillText("CIPHER IN MOTION", 81, 55);
    context.textAlign = "right";
    context.fillText(trace.mode === "encrypt" ? "E N C R Y P T" : "D E C R Y P T", width - 40, 43);
    const frame = M.frameAt(scene, width - 80, 350, progress);
    M.draw(drawingContext, frame, palette);
    context.drawImage(drawing, 40, 84);
    context.textAlign = "center";
    context.fillStyle = palette.ink;
    context.font = "italic 24px Georgia";
    const title = trace.mode === "encrypt"
      ? (progress < .335 ? "Separate. Intertwine." : progress < .87 ? "A quiet transformation." : "A secret, on the other side.")
      : (progress < .17 ? "Rebuild the same matrix." : progress < .655 ? "Recover every character." : progress < .925 ? "Unravel the paths." : "Back to the beginning.");
    context.fillText(title, width / 2, 451);
    context.font = "12px Menlo";
    context.fillStyle = palette.soft;
    const detail = frame.active
      ? (frame.active.input > frame.active.key
        ? `${frame.active.input} > ${frame.active.key}   ·   unchanged`
        : `${frame.active.key} − ${frame.active.input} + 32 = ${frame.active.output}`)
      : (progress >= .925 ? `“${trace.output}”` : "The original 2017 algorithm. Every glyph keeps its identity.");
    context.fillText(detail, width / 2, 484);
    context.fillStyle = palette.line;
    context.fillRect(40, 519, width - 80, 2);
    context.fillStyle = palette.green;
    context.fillRect(40, 519, (width - 80) * progress, 2);
    fs.writeFileSync(path.join(output, `${String(index++).padStart(4, "0")}.png`), canvas.toBuffer("image/png"));
  }
}
fs.writeFileSync(path.join(output, "timing.json"), JSON.stringify({ fps, frames: index, frameDurationMs: 1000 / fps }));
console.log(`Rendered ${index} frames at ${fps} fps to ${output}.`);
