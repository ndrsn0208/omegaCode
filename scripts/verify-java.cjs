const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const O = require("../demo/omega.js");
const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "omega-java-parity-"));
const tool = (name) => process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, "bin", name) : name;
function run(command, args) {
  const result = cp.spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || `${command} failed`);
  }
  return result.stdout;
}
try {
  run(tool("javac"), ["-d", temp, "src/omegaCode/Encryption.java",
    "src/omegaCode/Decryption.java", "tests/OmegaReference.java"]);
  const fixtures = JSON.parse(run(tool("java"), ["-cp", temp, "OmegaReference"]));
  for (const fixture of fixtures) {
    const material = O.parseKeys(fixture.keyPack, fixture.privateKey);
    const encoded = O.encrypt(O.fromUnits(fixture.input), material);
    const decoded = O.decrypt(O.fromUnits(fixture.encrypted), material);
    assert.deepEqual(O.toUnits(encoded.output), fixture.encrypted, `${fixture.name}: encryption`);
    assert.deepEqual(O.toUnits(decoded.output), fixture.decrypted, `${fixture.name}: decryption`);
  }
  if (process.argv.includes("--write-fixtures")) {
    const folder = path.join(root, "tests", "fixtures");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "java-reference.json"), JSON.stringify(fixtures, null, 2) + "\n");
  }
  console.log(`PASS: ${fixtures.length} cases match the original Java encryption and decryption.`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
