const test = require("node:test");
const assert = require("node:assert/strict");
const O = require("../demo/omega.js");
const M = require("../demo/motion.js");

const material = O.makeMaterial(
  Array.from({ length: 128 }, (_, i) => 32 + (i * 29) % 95),
  Array.from({ length: 128 }, (_, i) => i === 0 ? 123 : (i * 17) % 128),
);

test("the extension uses all 128 rows and columns and lossless three-digit indexes", () => {
  assert.equal(material.width, 128);
  assert.equal(material.matrix.length, 128);
  assert.ok(material.matrix.every((row) => row.length === 128));
  assert.equal(material.indexNumber.length, 384);
  assert.equal(material.format, "omega-code-128-v1");
  assert.ok(material.indexes.includes(127));
  const parsed = O.parseKeys(material.keyPack, material.privateKey);
  assert.equal(parsed.width, 128);
  assert.deepEqual(parsed.indexes, material.indexes);
  assert.deepEqual(parsed.columns, material.columns);
  assert.deepEqual(parsed.matrix, material.matrix);
});

test("128-wide round trips preserve repeated letters, boundary lengths, and Unicode", () => {
  for (const text of ["", "A", "AAAA AAAA AAAA", "x".repeat(127), "x".repeat(128),
    "x".repeat(129), "A".repeat(256), "你好 🐍 AAAAA"]) {
    const encrypted = O.encrypt(text, material);
    assert.equal(O.decrypt(encrypted.output, material).output, text);
    const bundle = O.unpackBundle(O.packBundle(encrypted));
    assert.equal(bundle.material.width, 128);
    assert.equal(O.decrypt(bundle.text, bundle.material).output, text);
  }
});

test("repeated-character comparisons report real position-specific mappings", () => {
  const encrypted = O.encrypt("AAAAAAAAAAAA", material);
  const records = O.mappings(encrypted);
  assert.equal(records.length, 12);
  assert.equal(new Set(records.map((r) => r.input)).size, 1);
  assert.ok(new Set(records.map((r) => r.output)).size > 1);
  for (const record of records) {
    assert.equal(record.input, encrypted.text.charCodeAt(record.inputPosition));
    assert.equal(record.output, encrypted.output.charCodeAt(record.outputPosition));
    assert.equal(record.key, material.matrix[record.row][record.column]);
    assert.equal(record.output, O.substitution(record.input, record.key));
  }
  const decoded = O.decrypt(encrypted.output, material);
  for (const record of O.mappings(decoded)) {
    assert.equal(record.output, decoded.output.charCodeAt(record.outputPosition));
  }
});

test("the 128-wide schedule wraps at 128, not at the legacy 64-position boundary", () => {
  const records = O.mappings(O.encrypt("A".repeat(256), material));
  const byOutput = [...records].sort((a, b) => a.outputPosition - b.outputPosition);
  assert.equal(byOutput[64].column, 64);
  assert.equal(byOutput[127].column, 127);
  assert.equal(byOutput[128].column, 0);
});

test("the extension cannot be mislabeled as a legacy bundle", () => {
  const bundle = JSON.parse(O.packBundle(O.encrypt("AAAA", material)));
  bundle.format = "omega-code-2017";
  assert.throws(() => O.unpackBundle(JSON.stringify(bundle)), /do not match/);
  bundle.format = material.format;
  bundle.matrixSize = 64;
  assert.throws(() => O.unpackBundle(JSON.stringify(bundle)), /do not match/);
});

test("animation gates and final values use the actual 128-wide schedule", () => {
  const encrypted = O.encrypt("A".repeat(129), material);
  for (const trace of [encrypted, O.decrypt(encrypted.output, material)]) {
    const scene = M.createScene(trace);
    const frame = M.frameAt(scene, 1200, 560, 1);
    assert.ok(frame.entities.some((entity) => entity.column >= 64));
    for (const entity of frame.entities) {
      assert.equal(entity.column, entity.slot % 128);
      assert.equal(entity.key, material.matrix[entity.row][entity.column]);
      assert.equal(entity.output, trace.output.charCodeAt(scene.ranks[3].allPositions[entity.id]));
    }
  }
});
