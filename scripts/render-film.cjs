// Optional artwork tool: uses the exact renderer shipped to the browser.
// Requires @napi-rs/canvas. Usage: node scripts/render-film.cjs /output/frames
const fs = require("node:fs");
const path = require("node:path");
const { createCanvas } = require("@napi-rs/canvas");
const O = require("../demo/omega.js");
const M = require("../demo/motion.js");
const material = O.makeMaterial(
  Array.from({ length: 128 }, (_, i) => 32 + (i * 29) % 95),
  Array.from({ length: 128 }, (_, i) => i === 0 ? 123 : (i * 17) % 128),
);
const encryption = O.encrypt("AAAA AAAA AAAA", material);
const traces = [encryption, O.decrypt(encryption.output, material)];
const output = path.resolve(process.argv[2] || ".artifacts/film");
fs.mkdirSync(output, { recursive: true });
const width = 960;
const height = 720;
const fps = 24;
const framesPerMode = fps * 15;
const canvas = createCanvas(width, height);
const context = canvas.getContext("2d");
const drawing = createCanvas(width - 80, 480);
const drawingContext = drawing.getContext("2d");
const palette = {
  ink: "#152d41", cyan: "#008daf", orange: "#c85c0b",
  soft: "#4e6577", line: "#d4e2ed", paper: "#f6f9fc",
};
let index = 0;
for (const trace of traces) {
  const scene = M.createScene(trace);
  scene.focusCode = trace.mode === "encrypt" ? 65 : null;
  const matrixSize = M.frameAt(scene, width - 80, 480, 0).layout.matrixSize;
  const matrixLayer = createCanvas(Math.ceil(matrixSize), Math.ceil(matrixSize));
  M.paintMatrix(matrixLayer.getContext("2d"), material, matrixSize, palette);
  for (let i = 0; i < framesPerMode; i++) {
    const progress = i / (framesPerMode - 1);
    context.fillStyle = palette.paper;
    context.fillRect(0, 0, width, height);
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = palette.ink;
    context.font = "36px Arial";
    context.fillText("Ω", 40, 42);
    context.font = "24px Arial";
    context.fillText("OmegaCode", 81, 37);
    context.fillStyle = palette.soft;
    context.font = "16px Arial";
    context.fillText("128 × 128 cipher visualizer", 81, 65);
    context.textAlign = "right";
    context.font = "20px Arial";
    context.fillText(trace.mode === "encrypt" ? "Encrypt" : "Decrypt", width - 40, 43);
    const frame = M.frameAt(scene, width - 80, 480, progress);
    M.draw(drawingContext, frame, palette, matrixLayer);
    context.drawImage(drawing, 40, 84);
    context.textAlign = "center";
    context.fillStyle = palette.ink;
    context.font = "24px Arial";
    const title = trace.mode === "encrypt"
      ? (progress < .335 ? "Shuffling repeated characters" : progress < .87 ? "Different positions, different lookups" : "Encryption complete")
      : (progress < .17 ? "Rebuilding the 128 × 128 matrix" : progress < .655 ? "Reversing substitution" : progress < .925 ? "Reversing the shuffle" : "Original text restored");
    context.fillText(title, width / 2, 600);
    context.font = "18px Menlo";
    context.fillStyle = palette.soft;
    const detail = frame.active
      ? (frame.active.input > frame.active.key
        ? `${frame.active.input} > ${frame.active.key}   ·   unchanged`
        : `${frame.active.key} − ${frame.active.input} + 32 = ${frame.active.output}`)
      : (progress >= .925 ? `“${trace.output}”` : "Cyan: input value   ·   Orange: output value");
    context.fillText(detail, width / 2, 638);
    context.font = "18px Arial";
    const examples = O.mappings(encryption).filter((r) => r.input === 65).slice(0, 3)
      .map((r) => `A #${r.inputPosition} → ${O.unitLabel(r.output)}`).join("    |    ");
    context.fillText(examples, width / 2, 675);
    context.fillStyle = palette.line;
    context.fillRect(40, 705, width - 80, 3);
    context.fillStyle = palette.cyan;
    context.fillRect(40, 705, (width - 80) * progress, 3);
    fs.writeFileSync(path.join(output, `${String(index++).padStart(4, "0")}.png`), canvas.toBuffer("image/png"));
  }
}
fs.writeFileSync(path.join(output, "timing.json"), JSON.stringify({ fps, frames: index, frameDurationMs: 1000 / fps }));
console.log(`Rendered ${index} frames at ${fps} fps to ${output}.`);
