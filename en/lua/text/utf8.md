---
title: "UTF-8"
description: "Count Unicode codepoints, iterate UTF-8 text and translate character offsets into byte positions."
---

# UTF-8
<secondary-label ref="function"/>
<secondary-label ref="process"/>

The immutable `utf8` standard library is available as a global in Lua processes and functions. Use it directly; no `require` or entry-level module declaration is needed.

Lua strings and their `#` length are byte-oriented. `utf8` operates on codepoints; a displayed character can contain several codepoints.

## Common Operations

| Call | Result |
|------|--------|
| `utf8.char(codepoint, ...)` | Encode values from `0` to `0x7FFFFFFF`, using up to six bytes |
| `utf8.len(s, i?, j?, lax?)` | Count codepoints starting in the inclusive byte-position range, or return `nil, byte_position` for invalid UTF-8; defaults to the entire string |
| `utf8.codepoint(s, i?, j?, lax?)` | Read codepoints whose leading bytes are in the inclusive byte-position range; `i` defaults to `1`, `j` to `i` |
| `utf8.codes(s, lax?)` | Iterator yielding 1-based byte positions and codepoints |
| `utf8.offset(s, n, i?)` | Byte position of the `n`th codepoint from `i`, or `nil` when it is outside the string |
| `utf8.charpattern` | Lua pattern for a UTF-8 byte sequence |

```lua
local s = utf8.char(72, 228, 8364) -- H, ä, €
assert(#s == 6)
assert(utf8.len(s) == 3)

for byte_position, codepoint in utf8.codes(s) do
    print(byte_position, codepoint) -- 1/72, 2/228, 4/8364
end
```

`len` and `codepoint` accept negative byte positions relative to the end of the string.

Decoding is strict by default: values above `U+10FFFF`, surrogates and malformed byte sequences are invalid. Set `lax` to `true` to accept extended encodings up to `0x7FFFFFFF`, including surrogates. Overlong and incomplete encodings remain invalid. `utf8.char` can produce these extended encodings, so use lax decoding when reading them back.

Lua string literals also support `\xXX` byte escapes, `\u{...}` character escapes and `\z` to skip following whitespace. Character escapes use the same encoding as `utf8.char`:

```lua
assert("\u{E4}" == utf8.char(228))
assert("\x41" == "A")
```

Unknown or malformed escape sequences raise compile errors. Write `\\` for a literal backslash.

## Byte Offsets

For `utf8.offset`, positive `n` counts forward from byte position `i`, which defaults to `1`. Negative `n` counts backwards and defaults to starting at `#s + 1`. A negative `i` is relative to the end of the string. `n = 0` finds the leading byte of the sequence containing `i`; the end sentinel is also accepted.

```lua
assert(utf8.offset(s, 3) == 4)
assert(utf8.offset(s, -1) == 4)
assert(utf8.offset(s, 0, 3) == 2)
assert(utf8.offset("", 0) == 1)
```

Positions outside `1..#s + 1`, or a continuation-byte starting position with nonzero `n`, raise Lua errors. Validate external text with `utf8.len` before decoding or iterating it; malformed input can raise Lua errors in `codepoint` and `codes`.
