/* The 2017 algorithm, including its original substitution rule. No dependencies. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OmegaCipher = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const WIDTH = 64;
  const MIN = 32;
  const MAX = 126;
  const fail = (message) => { throw new Error(message); };

  function toUnits(text) {
    if (typeof text !== "string") fail("请输入文字。");
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
    if (!Array.isArray(columns) || columns.length !== WIDTH ||
        !columns.every((v) => Number.isInteger(v) && v >= MIN && v <= MAX)) {
      fail("Private key 必须包含 64 个 32–126 之间的字符编码。");
    }
    if (!Array.isArray(indexes) || indexes.length !== WIDTH ||
        !indexes.every((v) => Number.isInteger(v) && v >= 0 && v < WIDTH) ||
        indexes[0] < 10) {
      fail("索引必须为 64 个 0–63 之间的整数，首个索引至少为 10。");
    }
    const base = [...columns];
    const shifts = [...indexes];
    const privateKey = base.join("");
    const indexNumber = shifts.map((v) => String(v).padStart(2, "0")).join("");
    const shuffleDigits = shifts.join("");
    const matrix = Array.from({ length: WIDTH }, (_, row) =>
      Array.from({ length: WIDTH }, (_, col) =>
        MIN + ((base[(row + shifts[col]) % WIDTH] - MIN + col) % 95)));
    return {
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

  function generateMaterial(random = Math.random) {
    const columns = [];
    const indexes = [];
    for (let i = 0; i < WIDTH; i++) {
      columns.push(Math.floor(random() * 95) + MIN);
      indexes.push(Math.floor(random() * WIDTH));
    }
    while (indexes[0] < 10) indexes[0] = Math.floor(random() * WIDTH);
    return makeMaterial(columns, indexes);
  }

  function parseKeys(keyPackInput, privateKeyInput) {
    if (typeof keyPackInput !== "string" || typeof privateKeyInput !== "string") {
      fail("请同时提供 Key pack 和 Private key。");
    }
    const key = privateKeyInput.trim();
    const pack = keyPackInput.trim();
    if (!/^[1-9]\d{127,191}$/.test(key)) {
      fail("Private key 格式不对：需要原版生成的十进制数字串。");
    }
    if (!/^[1-9]\d{0,319}$/.test(pack)) {
      fail("Key pack 格式不对：需要最多 320 位的十进制整数。");
    }
    const columns = [];
    let offset = 0;
    for (let i = 0; i < WIDTH; i++) {
      const size = key[offset] === "1" ? 3 : 2;
      columns.push(Number(key.slice(offset, offset + size)));
      offset += size;
    }
    if (offset !== key.length) fail("Private key 的字符编码数量不对。");
    const divisor = BigInt(key);
    const packed = BigInt(pack);
    if (packed % divisor !== 0n) {
      fail("Key pack 不能被 Private key 整除，请检查这两份密钥是否配套。");
    }
    const indexNumber = (packed / divisor).toString();
    if (!/^[1-9]\d{127}$/.test(indexNumber)) fail("解出的索引不是原版的 128 位数字串。");
    const indexes = Array.from({ length: WIDTH }, (_, i) =>
      Number(indexNumber.slice(i * 2, i * 2 + 2)));
    return makeMaterial(columns, indexes);
  }

  // A power of the original permutation; whole cycles can be skipped exactly.
  function orderAt(length, rounds, inverse = false) {
    if (!Number.isInteger(length) || length < 0 ||
        !Number.isSafeInteger(rounds) || rounds < 0) {
      fail("洗牌长度和轮数必须是非负整数。");
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
    return units.map((unit, i) => substitution(unit, material.lookup[i % WIDTH]));
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
    if (trace.mode !== "encrypt") fail("只能从加密结果生成解密包。");
    // JSON escapes isolated UTF-16 surrogates, so even split emoji round-trip.
    return JSON.stringify({
      format: "omega-code-2017",
      ciphertext: trace.output,
      keyPack: trace.material.keyPack,
      privateKey: trace.material.privateKey,
    }, null, 2);
  }

  function unpackBundle(text) {
    let bundle;
    try { bundle = JSON.parse(text); }
    catch { fail("解密包不是有效的 JSON。"); }
    if (!bundle || bundle.format !== "omega-code-2017" ||
        typeof bundle.ciphertext !== "string" ||
        typeof bundle.keyPack !== "string" || typeof bundle.privateKey !== "string") {
      fail("请粘贴由本演示生成的完整解密包。");
    }
    return { text: bundle.ciphertext, material: parseKeys(bundle.keyPack, bundle.privateKey) };
  }

  function unitLabel(unit) {
    if (unit === 32) return "␠";
    if (unit < 32 || unit === 127) return "·";
    if (unit >= 0xd800 && unit <= 0xdfff) return "◇";
    return String.fromCharCode(unit);
  }

  return Object.freeze({ WIDTH, MIN, MAX, toUnits, fromUnits, makeMaterial,
    generateMaterial, parseKeys, orderAt, shuffle, substitution, transform,
    encrypt, decrypt, packBundle, unpackBundle, unitLabel });
});
