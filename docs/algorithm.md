# Inside OmegaCode

This walkthrough describes the 2017 implementation in `src/omegaCode/`, including its unusual choices. The browser demo preserves its arithmetic, key representation, and UTF-16 character model.

## 1. Random material and key packaging

Generate a base sequence `C` containing 64 integers in `[32, 126]`, and indexes `I` containing 64 integers in `[0, 63]`. Resample the first index until it is at least 10.

- **Private key:** concatenate the decimal character codes in `C`, without separators.
- **Index number:** concatenate the indexes in `I`, padding each to two digits.
- **Key pack:** multiply those two large integers.
- **Shuffle count:** concatenate `I` **without** padding and interpret the first four digits.

The two different concatenation rules matter. Reusing the padded representation to choose the shuffle count changes the cipher.

The first index restriction prevents a leading zero from disappearing when the index number is converted to an integer. Character codes are decoded by reading three digits when the next digit is `1`, and two otherwise.

This packages shared secret material; it does not establish a public-key cryptosystem.

## 2. The matrix

For row `r` and column `c`, the constructor computes:

```text
M[r][c] = 32 + ((C[(r + I[c]) mod 64] - 32 + c) mod 95)
```

Each column is a rotated version of the original sequence with its character codes incremented by the column number. Incrementing past 126 wraps back to 32.

Encryption and decryption select only:

```text
K[c] = M[I[c]][c]
     = 32 + ((C[(2 × I[c]) mod 64] - 32 + c) mod 95)
```

Consequently, only 64 matrix cells are selected per schedule, and only even-numbered positions in `C` can contribute to substitution. Depending on repeated indexes, fewer than 32 distinct seed values may be used.

The animation unfolds the full matrix and highlights each moving glyph's actual lookup. The matrix is generated once per encryption; replaying or scrubbing does not change the keys.

## 3. Shuffling

One forward round moves the characters at odd, zero-based indexes ahead of the characters at even indexes:

```text
ABCDEF → BDFACE
ABCDE  → BDACE
```

This operates on the **entire message**, before substitution is split into 64-position groups.

To reverse it, split the shuffled array after `floor(length / 2)` elements. Interleave the second half into even indexes and the first half into odd indexes.

The demo computes the final power of this permutation by following its cycles. The original program repeats the same permutation thousands of times. Both methods give the same ordering.

The continuous animation shows the first two rounds and then fast-forwards to the exact final ordering. The counter labels this compression. Curves between those states are visual choreography, not additional cryptographic operations. The single timeline controls time across the whole animation.

Each glyph preserves its identity through the complete journey. For messages longer than 40 UTF-16 units, the renderer samples 40 trajectories while the algorithm still computes every character. The interface labels this sampling.

## 4. Substitution

At message position `j`, choose column `c = j mod 64` and its selected value `K[c]`. For a character code `x`:

```text
F(x, K) = x             when x > K
          K - x + 32   otherwise
```

For example, with `K = 100`, `A` (65) becomes `C` (67), while `z` (122) is unchanged.

On the printable ASCII interval, applying the same rule twice restores the input. This is why decryption can use the same substitution before reversing the shuffle.

For codes below 32, the rule can produce a result greater than `K`; the second application then leaves it unchanged. Control characters therefore do not generally round-trip. Tests retain an example of this original defect; the UI rejects those inputs.

## 5. Unicode and bundles

Java `char` values are UTF-16 units. The port intentionally uses `charCodeAt` and `String.fromCharCode`, rather than code-point iteration.

Chinese characters and other units above 126 pass through substitution unchanged, but can move during shuffling. Emoji commonly contain two surrogate units, which may be separated. The JSON bundle preserves those units, including isolated surrogates, so the same browser implementation can reconstruct the original string.

The bundle is:

```json
{
  "format": "omega-code-2017",
  "ciphertext": "...",
  "keyPack": "...",
  "privateKey": "..."
}
```

These are secret-bearing demo bundles. Nothing about packaging the keys with the ciphertext makes the result safe to share.

## 6. Validation boundaries

The original Java source is unchanged. The browser adds validation around that algorithm:

- Check that private-key parsing yields exactly 64 codes in the original range.
- Require exact division of the key pack; never silently truncate a quotient.
- Require 64 valid recovered indexes and the original first-index restriction.
- Limit the interactive input to 256 UTF-16 units and reject control characters.

These checks can catch malformed inputs, but cannot authenticate a ciphertext or prove a valid-looking key is the right one.

`tests/OmegaReference.java` executes the original classes and outputs numeric UTF-16 arrays, avoiding lossy text encoding for split surrogates. The committed reference fixtures are generated test data, not real credentials. `npm run verify:java` checks newly generated cases against the JavaScript implementation.
