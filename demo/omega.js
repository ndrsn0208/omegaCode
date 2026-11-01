/* Legacy 64×64 cipher and the explicitly versioned 128×128 extension. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OmegaCipher = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const WIDTH = 64;
  const DEMO_WIDTH = 128;
  const MIN = 32;
  const MAX = 126;
  const fail = (message) => { throw new Error(message); };

  function toUnits(text) {
    if (typeof text !== "string") fail("Enter a text string.");
    return Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));
  }

  function fromUnits(units) {
    let result = "";
    for (let i = 0; i < units.length; i += 4096) {
      result += String.fromCharCode(...units.slice(i, i + 4096));
    }
    return result;
  }

  function makeMaterial(columns, indexes) {
    const width = columns?.length;
    if (!Array.isArray(columns) || ![WIDTH, DEMO_WIDTH].includes(width) ||
        !columns.every((v) => Number.isInteger(v) && v >= MIN && v <= MAX)) {
      fail("The private key must contain 64 or 128 character codes between 32 and 126.");
    }
    const indexDigits = width === WIDTH ? 2 : 3;
    const firstMinimum = 10 ** (indexDigits - 1);
    if (!Array.isArray(indexes) || indexes.length !== width ||
        !indexes.every((v) => Number.isInteger(v) && v >= 0 && v < width) ||
        indexes[0] < firstMinimum) {
      fail(`Provide ${width} indexes between 0 and ${width - 1}; the first must be at least ${firstMinimum}.`);
    }
    const base = [...columns];
    const shifts = [...indexes];
    const privateKey = base.join("");
    const indexNumber = shifts.map((v) => String(v).padStart(indexDigits, "0")).join("");
    const shuffleDigits = shifts.join("");
    const matrix = Array.from({ length: width }, (_, row) =>
      Array.from({ length: width }, (_, col) =>
        MIN + ((base[(row + shifts[col]) % width] - MIN + col) % 95)));
    return {
      width,
      indexDigits,
      format: width === WIDTH ? "omega-code-2017" : "omega-code-128-v1",
      columns: base,
      indexes: shifts,
      matrix,
      privateKey,
      indexNumber,
      keyPack: (BigInt(privateKey) * BigInt(indexNumber)).toString(),
      shuffleDigits,
      shuffleTimes: Number(shuffleDigits.slice(0, 4)),
      lookup: shifts.map((row, col) => matrix[row][col]),
    };
  }

  function generateMaterial(random = Math.random, width = WIDTH) {
    if (![WIDTH, DEMO_WIDTH].includes(width)) fail("Supported matrix sizes are 64 and 128.");
    const columns = [];
    const indexes = [];
    for (let i = 0; i < width; i++) {
      columns.push(Math.floor(random() * 95) + MIN);
      indexes.push(Math.floor(random() * width));
    }
    const firstMinimum = width === WIDTH ? 10 : 100;
    while (indexes[0] < firstMinimum) indexes[0] = Math.floor(random() * width);
    return makeMaterial(columns, indexes);
  }

  function parseKeys(keyPackInput, privateKeyInput) {
    if (typeof keyPackInput !== "string" || typeof privateKeyInput !== "string") {
      fail("Provide both the key pack and the private key.");
    }
    const key = privateKeyInput.trim();
    const pack = keyPackInput.trim();
    if (!/^[1-9]\d{127,383}$/.test(key)) fail("The private key must be a valid decimal character-code sequence.");
    if (!/^[1-9]\d{0,767}$/.test(pack)) fail("The key pack must be a positive decimal integer of at most 768 digits.");
    const columns = [];
    let offset = 0;
    while (offset < key.length && columns.length < DEMO_WIDTH) {
      const size = key[offset] === "1" ? 3 : 2;
      columns.push(Number(key.slice(offset, offset + size)));
      offset += size;
    }
    const width = columns.length;
    if (offset !== key.length || ![WIDTH, DEMO_WIDTH].includes(width)) {
      fail("The private key must decode to exactly 64 or 128 character codes.");
    }
    const indexDigits = width === WIDTH ? 2 : 3;
    if (pack.length > width * (3 + indexDigits)) fail("The key pack is too long for this matrix size.");
    const divisor = BigInt(key);
    const packed = BigInt(pack);
    if (packed % divisor !== 0n) {
      fail("The key pack is not divisible by the private key. Check that the keys belong together.");
    }
    const indexNumber = (packed / divisor).toString();
    if (indexNumber.length !== width * indexDigits) {
      fail(`The recovered indexes must contain ${width * indexDigits} digits for a ${width}×${width} matrix.`);
    }
    const indexes = Array.from({ length: width }, (_, i) =>
      Number(indexNumber.slice(i * indexDigits, (i + 1) * indexDigits)));
    return makeMaterial(columns, indexes);
  }

  // A power of the original permutation; whole cycles can be skipped exactly.
  function orderAt(length, rounds, inverse = false) {
    if (!Number.isInteger(length) || length < 0 ||
        !Number.isSafeInteger(rounds) || rounds < 0) {
      fail("Shuffle length and round count must be nonnegative integers.");
    }
    const half = Math.floor(length / 2);
    const permutation = Array.from({ length }, (_, i) => inverse
      ? (i % 2 === 0 ? half + Math.floor(i / 2) : Math.floor(i / 2))
      : (i < half ? 2 * i + 1 : 2 * (i - half)));
    const result = new Array(length);
    const visited = new Uint8Array(length);
    for (let start = 0; start < length; start++) {
      if (visited[start]) continue;
      const cycle = [];
      let current = start;
      do {
        cycle.push(current);
        visited[current] = 1;
        current = permutation[current];
      } while (current !== start);
      const shift = rounds % cycle.length;
      cycle.forEach((position, i) => {
        result[position] = cycle[(i + shift) % cycle.length];
      });
    }
    return result;
  }

  function shuffle(units, rounds, inverse = false) {
    return orderAt(units.length, rounds, inverse).map((i) => units[i]);
  }

  function substitution(unit, key) {
    return unit > key ? unit : key - unit + MIN;
  }

  function transform(units, material) {
    return units.map((unit, i) => substitution(unit, material.lookup[i % material.width]));
  }

  function encrypt(text, material = generateMaterial()) {
    const input = toUnits(text);
    const mixed = shuffle(input, material.shuffleTimes);
    const substituted = transform(mixed, material);
    return { mode: "encrypt", text, input, mixed, substituted,
      output: fromUnits(substituted), material };
  }

  function decrypt(text, material) {
    const input = toUnits(text);
    const substituted = transform(input, material);
    const mixed = shuffle(substituted, material.shuffleTimes, true);
    return { mode: "decrypt", text, input, substituted, mixed,
      output: fromUnits(mixed), material };
  }

  function packBundle(trace) {
    if (trace.mode !== "encrypt") fail("Create a decryption bundle from an encryption result.");
    // JSON escapes isolated UTF-16 surrogates, so even split emoji round-trip.
    return JSON.stringify({
      format: trace.material.format,
      matrixSize: trace.material.width,
      ciphertext: trace.output,
      keyPack: trace.material.keyPack,
      privateKey: trace.material.privateKey,
    }, null, 2);
  }

  function unpackBundle(text) {
    let bundle;
    try { bundle = JSON.parse(text); }
    catch { fail("The decryption bundle is not valid JSON."); }
    if (!bundle || !["omega-code-2017", "omega-code-128-v1"].includes(bundle.format) ||
        typeof bundle.ciphertext !== "string" ||
        typeof bundle.keyPack !== "string" || typeof bundle.privateKey !== "string") {
      fail("Paste a complete OmegaCode decryption bundle.");
    }
    const material = parseKeys(bundle.keyPack, bundle.privateKey);
    if (bundle.format !== material.format ||
        (bundle.matrixSize !== undefined && bundle.matrixSize !== material.width)) {
      fail("The bundle format and matrix size do not match its keys.");
    }
    return { text: bundle.ciphertext, material };
  }

  function mappings(trace) {
    const n = trace.input.length;
    const order = orderAt(n, trace.material.shuffleTimes);
    const records = Array.from({ length: n }, (_, slot) => {
      const inputPosition = trace.mode === "encrypt" ? order[slot] : slot;
      const outputPosition = trace.mode === "encrypt" ? slot : order[slot];
      const column = slot % trace.material.width;
      const input = trace.input[inputPosition];
      const key = trace.material.lookup[column];
      return { inputPosition, outputPosition, input, output: trace.substituted[slot],
        column, row: trace.material.indexes[column], key, unchanged: input > key };
    });
    return records.sort((a, b) => a.inputPosition - b.inputPosition);
  }

  function unitLabel(unit) {
    if (unit === 32) return "␠";
    if (unit < 32 || unit === 127) return "·";
    if (unit >= 0xd800 && unit <= 0xdfff) return "◇";
    return String.fromCharCode(unit);
  }

  return Object.freeze({ WIDTH, DEMO_WIDTH, MIN, MAX, toUnits, fromUnits, makeMaterial,
    generateMaterial, parseKeys, orderAt, shuffle, substitution, transform,
    encrypt, decrypt, packBundle, unpackBundle, mappings, unitLabel });
});
