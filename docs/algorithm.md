# OmegaCode: algorithm and formats

The browser supports the original **64 × 64** algorithm and an explicit **128 × 128 extension**. New encryption in the interface uses 128 × 128. The original Java source remains unchanged.

Throughout this document, `N` is the matrix width: 64 or 128.

## Random material

Generate `N` character seeds `C`, each in `[32, 126]`, and `N` indexes `I`, each in `[0, N−1]`.

| Format | Index field width | Minimum first index |
| --- | --- | --- |
| `omega-code-2017` | 2 decimal digits | 10 |
| `omega-code-128-v1` | 3 decimal digits | 100 |

The first-index rule prevents leading zeros from disappearing when the packed index sequence becomes a big integer. Three digits are necessary in the extension because indexes can reach 127.

The **private key** concatenates the decimal character seeds without separators. Codes beginning with `1` occupy three digits; the others occupy two. The **index number** concatenates the indexes with fixed-width zero padding. The **key pack** multiplies these two big integers.

The **shuffle count** uses the first four digits of the index sequence **without padding**, preserving the original rule.

## Matrix construction

For row `r` and column `c`:

```text
M[r][c] = 32 + ((C[(r + I[c]) mod N] - 32 + c) mod 95)
```

Each column rotates the seed sequence and increments its values by the column number, wrapping within printable ASCII.

Only one cell is selected per column:

```text
K[c] = M[I[c]][c]
     = 32 + ((C[(2 × I[c]) mod N] - 32 + c) mod 95)
```

This inherited construction selects `N` matrix cells per schedule and uses only even seed indexes: at most 32 distinct seeds for `N = 64`, or 64 for `N = 128`. A larger matrix does not remove that structural limitation.

## Shuffling

One forward round moves odd, zero-based positions ahead of even positions:

```text
ABCDEF → BDFACE
ABCDE  → BDACE
```

Shuffling operates on the entire message. Decryption reverses it by splitting after `floor(length / 2)` elements, interleaving the second half into even positions and the first into odd positions.

The implementation computes permutation powers by following cycles, producing the same result as thousands of repeated rounds. Animation expands the first two rounds and then transitions to the exact final ordering. Interpolated curves are visual motion, not additional cryptographic operations.

## Position-dependent substitution

At shuffled message position `j`, use column `c = j mod N`:

```text
F(x, K[c]) = x                 when x > K[c]
            K[c] - x + 32     otherwise
```

Two occurrences of `A` can encounter different values because their shuffled positions select different columns. The mapping comparison reports the original input position, output position, matrix coordinates, selected value, arithmetic, and actual output.

Different positions do not guarantee different outputs. Cells may repeat, the schedule repeats after `N` positions, and the pass-through branch leaves many input values unchanged. The interface reports the actual count of distinct outputs instead of assuming they are unique.

For printable ASCII, the substitution is self-inverse. Decryption applies it first, then reverses the shuffle. Codes below 32 can fail to round-trip; the page rejects control characters.

## UTF-16 and bundles

The Java implementation operates on UTF-16 units. The port uses `charCodeAt` and `String.fromCharCode` to preserve that behavior. Non-ASCII units pass through substitution, and emoji pairs may be split by shuffling.

JSON preserves those units, including isolated surrogates:

```json
{
  "format": "omega-code-128-v1",
  "matrixSize": 128,
  "ciphertext": "...",
  "keyPack": "...",
  "privateKey": "..."
}
```

Legacy bundles use `omega-code-2017`; the optional `matrixSize` is 64. Old bundles without that field remain supported. Raw keys are also accepted: decoding the private-key seed count identifies the version. The parser validates index ranges, exact division, field lengths, and consistency between the bundle identifier and key material.

These checks reject malformed inputs but do not authenticate ciphertext or prove a plausible key is correct. Bundles contain secret key material and are intended only for this demo.

## Verification and rendering

The Java oracle runs the untouched source and serializes UTF-16 units as numeric arrays. Its 11 reference fixtures verify legacy parity. Separate tests cover 128 × 128 round trips, positions 64/127/128, three-digit indexes, repeated-character mappings, and version mismatch rejection.

`motion.js` uses `material.width` for matrix coordinates and lookups. It renders up to 32 paths from longer messages and labels that sampling; mapping comparisons include every input occurrence. The matrix is cached in a canvas layer, while characters, paths, and lookup highlights are redrawn continuously.
