const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const O = require("../demo/omega.js");

const material = O.makeMaterial(
  Array.from({ length: 64 }, (_, i) => 32 + (i * 29) % 95),
  Array.from({ length: 64 }, (_, i) => i === 0 ? 42 : (i * 17) % 64),
);

test("a shuffle keeps character identity and follows the original odd/even order", () => {
  assert.equal(O.fromUnits(O.shuffle(O.toUnits("ABCDEF"), 1)), "BDFACE");
  assert.equal(O.fromUnits(O.shuffle(O.toUnits("ABCDE"), 1)), "BDACE");
  assert.equal(O.fromUnits(O.shuffle(O.toUnits("BDFACE"), 1, true)), "ABCDEF");
  assert.equal(O.fromUnits(O.shuffle(O.toUnits("BDACE"), 1, true)), "ABCDE");
});

test("fast-forward agrees with repeated shuffling, including odd and even lengths", () => {
  for (const length of [0, 1, 2, 3, 5, 6, 63, 64, 65, 127, 256]) {
    const input = Array.from({ length }, (_, i) => i);
    let repeated = [...input];
    for (let step = 0; step < 257; step++) {
      if ([0, 1, 2, 17, 128, 256].includes(step)) {
        assert.deepEqual(O.shuffle(input, step), repeated, `length=${length}, step=${step}`);
        assert.deepEqual(O.shuffle(repeated, step, true), input);
      }
      repeated = repeated.filter((_, i) => i % 2 === 1)
        .concat(repeated.filter((_, i) => i % 2 === 0));
    }
    assert.deepEqual(O.shuffle(O.shuffle(input, 6399), 6399, true), input);
  }
});

test("every printable ASCII character is recovered for every possible matrix key", () => {
  for (let key = 32; key <= 126; key++) {
    for (let char = 32; char <= 126; char++) {
      const encrypted = O.substitution(char, key);
      assert.ok(encrypted >= 32 && encrypted <= 126);
      assert.equal(O.substitution(encrypted, key), char);
    }
  }
  assert.equal(O.substitution(65, 100), 67);
  assert.equal(O.substitution(122, 100), 122);
});

test("round trips preserve empty, block-boundary, long, Unicode, and HTML-shaped text", () => {
  const printable = Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join("");
  const cases = [
    "", "A", "ABCDEF", "HELLO, OMEGA!", "a".repeat(63), "b".repeat(64),
    "c".repeat(65), printable.repeat(3), "你好，世界", "Omega 🐍🔐!",
    "<img src=x onerror=alert(1)>", "\ud800A\udfff",
  ];
  for (const text of cases) {
    const encrypted = O.encrypt(text, material);
    const parsed = O.parseKeys(material.keyPack, material.privateKey);
    const decrypted = O.decrypt(encrypted.output, parsed);
    assert.equal(encrypted.output.length, text.length);
    assert.equal(decrypted.output, text, JSON.stringify(text));
  }
});

test("pack serialization retains leading zeroes in internal index pairs", () => {
  const parsed = O.parseKeys(material.keyPack, material.privateKey);
  assert.deepEqual(parsed.columns, material.columns);
  assert.deepEqual(parsed.indexes, material.indexes);
  assert.deepEqual(parsed.matrix, material.matrix);
  assert.equal(parsed.indexNumber.length, 128);
  assert.equal(parsed.shuffleTimes, Number(material.indexes.join("").slice(0, 4)));
  assert.notEqual(material.shuffleDigits, material.indexNumber);
});

test("JSON decryption bundles preserve split UTF-16 surrogate units", () => {
  const encrypted = O.encrypt("🔐Hello🐍", material);
  const decoded = O.unpackBundle(O.packBundle(encrypted));
  assert.equal(decoded.text, encrypted.output);
  assert.equal(O.decrypt(decoded.text, decoded.material).output, encrypted.text);
  assert.throws(() => O.unpackBundle('{"format":"unknown"}'));
  assert.throws(() => O.unpackBundle("not JSON"));
});

test("malformed keys fail clearly, without silent BigInteger truncation", () => {
  assert.throws(() => O.parseKeys("0", material.privateKey));
  assert.throws(() => O.parseKeys(material.keyPack, ""));
  assert.throws(() => O.parseKeys((BigInt(material.keyPack) + 1n).toString(), material.privateKey), /整除/);
  assert.throws(() => O.parseKeys("9".repeat(321), material.privateKey));
  assert.throws(() => O.parseKeys(material.keyPack, "1".repeat(128)));
  assert.throws(() => O.makeMaterial(material.columns, Array(64).fill(0)));
});

test("the legacy control-character defect stays visible rather than being disguised", () => {
  const newline = 10;
  assert.notEqual(O.substitution(O.substitution(newline, 100), 100), newline);
});

test("raw inputs are not mutated by encryption or fast-forward", () => {
  const columns = [...material.columns];
  const indexes = [...material.indexes];
  const input = [65, 66, 67, 68, 69];
  O.shuffle(input, 1234);
  O.encrypt("immutable", material);
  assert.deepEqual(input, [65, 66, 67, 68, 69]);
  assert.deepEqual(material.columns, columns);
  assert.deepEqual(material.indexes, indexes);
});

const fixtureFile = path.join(__dirname, "fixtures", "java-reference.json");
const cases = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
for (const fixture of cases) {
  test(`original Java parity: ${fixture.name}`, () => {
    const parsed = O.parseKeys(fixture.keyPack, fixture.privateKey);
    assert.deepEqual(O.toUnits(O.encrypt(O.fromUnits(fixture.input), parsed).output), fixture.encrypted);
    assert.deepEqual(O.toUnits(O.decrypt(O.fromUnits(fixture.encrypted), parsed).output), fixture.decrypted);
  });
}
