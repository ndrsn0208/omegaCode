<div align="center">

![OmegaCode — 128 × 128 Cipher Visualizer](docs/assets/cover.svg)

**See how the same character maps differently at different positions.**

A continuous, interactive cipher visualization with a 128 × 128 matrix,
editable input, and a comparison of repeated-character mappings.

[Open the demo](#try-it) · [Algorithm and formats](docs/algorithm.md) · [Original Java](src/omegaCode)

</div>

![Cyan inputs pass through the 128×128 matrix and become orange outputs, followed by reverse decryption](docs/assets/walkthrough.gif)

## Try it

Open **[`demo/index.html`](demo/index.html)** in a modern browser. It works offline with no install, account, API, or build step.

For a local preview with Node.js 20 or newer:

```sh
npm run preview
```

Then open **http://127.0.0.1:4173**. This server exposes only the demo files and listens only on your computer.

1. Type your text and select **Encrypt text**. The default example, `AAAA AAAA AAAA`, makes repeated-character mappings easy to compare.
2. Watch the continuous 26-second animation, or pause and drag the timeline.
3. Use **Track character** to highlight every occurrence of a character. IDs such as `#0` identify original input positions.
4. Compare the matrix coordinates, arithmetic, and output for each occurrence in the mapping cards.
5. Select **Decrypt this result** to run the reverse operation, or paste a complete decryption bundle in Decrypt mode.

The interface is in English. Text and labels are at least 16 px. Cyan represents input values; orange represents output values.

## Same character, different mapping

The lookup depends on a character's **position after shuffling**, rather than only on the character itself. For example, with the cipher's substitution rule:

| Input | Selected matrix value | Output |
| --- | --- | --- |
| `A` (65) | 100 | `C` (67) |
| `A` (65) | 110 | `M` (77) |
| `A` (65) | 50 | `A` (unchanged) |

Different positions **can** produce different results. Unique results are not guaranteed: matrix values can repeat, and the original rule passes a character through when its value exceeds the selected matrix value. The comparison displays these cases honestly, including collisions and unchanged characters.

## Two compatible formats

| | Original format | New demo format |
| --- | --- | --- |
| Matrix | 64 × 64 | 128 × 128 |
| Seeds and indexes | 64 each | 128 each |
| Packed index width | 2 decimal digits | 3 decimal digits |
| First index | At least 10 | At least 100 |
| Bundle identifier | `omega-code-2017` | `omega-code-128-v1` |

New encryption in the page uses the 128 × 128 extension. Decryption automatically recognizes both formats, including old bundles without a `matrixSize` field. A legacy import is labeled **64 × 64 · legacy** rather than displayed as a 128 × 128 result.

The original three Java files in `src/omegaCode/` remain unchanged. The 128 × 128 format extends the same construction; it is a new version, not a claim that the 2017 program originally used that size.

## Animation and input

The animation uses actual intermediate values. It expands the first two shuffle rounds, then advances to the exact final permutation. Every glyph is mapped through its real matrix cell. Larger matrices are rendered once into a cached layer to keep continuous motion smooth.

Input is limited to 256 UTF-16 character positions. The full message is computed; up to 32 paths are shown for long messages. All repeated-character mapping records remain available with **Show all mappings**. The animation respects reduced-motion preferences.

**␠** represents a space. **◇** represents a UTF-16 surrogate unit, such as half of an emoji. The complete JSON bundle preserves separated surrogate units when copying between applications.

The preview above is rendered at 24 fps by the same motion engine, with each direction shortened to 15 seconds.

## Educational cipher

This is a cryptography experiment, not a secure encryption product:

- Random material uses `Math.random()`.
- Characters above the selected matrix value pass through unchanged.
- The lookup schedule repeats every 128 positions in the extension, or 64 in legacy mode.
- Non-ASCII units change position but pass through substitution.
- Control characters can fail to round-trip, so the page rejects them.
- The algorithm does not authenticate ciphertext or detect all incorrect keys.

The decryption bundle contains the ciphertext **and both secret key values**. It is a demo convenience, not a safe sharing format. Computation stays in the page; text and keys are not stored in conversation state or browser storage.

## Verify it

```sh
npm test
npm run check
```

The dependency-free suite covers all 9,025 printable-ASCII character/key combinations, both matrix sizes, index serialization, 64- and 128-position boundaries, Unicode bundles, honest mapping comparisons, continuous motion, and 11 fixtures from the original Java classes.

With JDK 11+ installed, compare fresh legacy cases against the untouched Java code:

```sh
npm run verify:java
```

Set `JAVA_HOME` if your JDK is not on `PATH`. Compilation uses a temporary directory and cleans up afterwards.

## Project layout

```text
src/omegaCode/          Original 2017 Java implementation
demo/omega.js           Legacy and 128×128 cipher formats
demo/motion.js          Shared animation renderer and trajectories
demo/film.js            Playback, input, and mapping comparisons
demo/index.html         Offline entry point
tests/                  Cipher, compatibility, and motion tests
scripts/                Preview, verification, and artwork generators
docs/                   Algorithm notes and preview assets
```
