// Bundle the same demo into a dependency-free fragment for an inline preview.
// Usage: node scripts/build-inline.cjs /absolute/path/omega-code.html
const fs = require("node:fs");
const path = require("node:path");
const project = path.resolve(__dirname, "..");
const output = process.argv[2];
if (!output || !path.isAbsolute(output)) throw new Error("Supply an absolute output path.");
const read = (file) => fs.readFileSync(path.join(project, "demo", file), "utf8");
const markup = read("index.html").split("<!-- OMEGA_FRAGMENT_START -->")[1]
  .split("<!-- OMEGA_FRAGMENT_END -->")[0].trim();
const fragment = `${markup}\n<style>\n${read("film.css")}\n</style>\n<script>\n${read("omega.js")}\n${read("motion.js")}\n${read("film.js")}\n</script>\n`;
fs.writeFileSync(output, fragment);
console.log(output);
