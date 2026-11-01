const test = require("node:test");
const assert = require("node:assert/strict");
const O = require("../demo/omega.js");
const M = require("../demo/motion.js");
const fixture = require("./fixtures/java-reference.json")[3];
const material = O.parseKeys(fixture.keyPack, fixture.privateKey);

test("each animated glyph arrives with the actual cipher or plaintext value", () => {
  for (const text of ["", "A", "HELLO, OMEGA!", "你好🐍", "abcXYZ ".repeat(30)]) {
    const encryption = O.encrypt(text, material);
    const decryption = O.decrypt(encryption.output, material);
    for (const trace of [encryption, decryption]) {
      const scene = M.createScene(trace);
      const frame = M.frameAt(scene, 1000, 410, 1);
      assert.equal(frame.entities.length, Math.min(32, trace.input.length));
      for (const entity of frame.entities) {
        const position = scene.ranks[3].allPositions[entity.id];
        assert.equal(entity.output, trace.output.charCodeAt(position));
        assert.equal(entity.changed, 1);
      }
    }
  }
});

test("motion is continuous across shuffle and substitution handovers", () => {
  const encryption = O.encrypt("HELLO, OMEGA!", material);
  for (const trace of [encryption, O.decrypt(encryption.output, material)]) {
    const scene = M.createScene(trace);
    for (const t of [.075, .32, .345, .63, .655, .925]) {
      const before = M.frameAt(scene, 1000, 410, t - 0.000001);
      const after = M.frameAt(scene, 1000, 410, t + 0.000001);
      for (let i = 0; i < scene.count; i++) {
        const a = before.entities[i].position;
        const b = after.entities[i].position;
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .1, `jump at t=${t}, glyph=${i}`);
      }
    }
  }
});

test("the full animation stays within mobile and desktop canvases", () => {
  const encryption = O.encrypt("abcdefghijklmnopqrstuvwxyz0123456789".repeat(7), material);
  for (const trace of [encryption, O.decrypt(encryption.output, material)]) {
    const scene = M.createScene(trace);
    for (const [width, height] of [[264, 610], [320, 610], [680, 360], [1120, 360]]) {
      for (let step = 0; step <= 100; step++) {
        const frame = M.frameAt(scene, width, height, step / 100);
        for (const entity of frame.entities) {
          const { x, y } = entity.position;
          assert.ok(Number.isFinite(x) && Number.isFinite(y));
          assert.ok(x >= 0 && x <= width && y >= 0 && y <= height,
            `${trace.mode}: outside ${width}×${height} at t=${step / 100}: ${x}, ${y}`);
        }
      }
    }
  }
});
