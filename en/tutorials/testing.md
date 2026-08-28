---
title: "Testing"
description: "Write and run Lua tests with wippy/test assertions, lifecycle hooks, mocking, filtering, and exit codes."
---

# Testing

Use the `wippy/test` framework to define Lua test cases with assertions, lifecycle hooks, and mocks, then execute them with `wippy test`.

**Classification:** Runnable tutorial. It contains a complete library, test entry,
dependency setup, expected runner output, and failure checks.

## What You'll Build

A small library and a test suite that covers it:

1. A `calc` library with `add` and `div` functions.
2. A test entry that describes cases, asserts behavior, and skips a pending case.
3. A successful test run with `wippy test`.

## Prerequisites

- Wippy runtime `v0.3.32a`.
- An empty working directory. Create and initialize the project, then install the
  test framework:

  ```bash
  mkdir testing-demo
  cd testing-demo
  mkdir src
  wippy init
  wippy add wippy/test
  wippy install
  ```

  The test framework declares `wippy/terminal` as a dependency, so installation
  brings in the terminal host used by the runner's live UI.

The finished project contains:

```text
testing-demo/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── calc.lua
    └── calc_test.lua
```

## The Code Under Test

```lua
-- src/calc.lua
local function add(a, b)
    return a + b
end

local function div(a, b)
    if b == 0 then
        return nil, "division by zero"
    end
    return a / b
end

return { add = add, div = div }
```

## The Test

A test is an ordinary `function.lua` entry tagged with `meta.type: test`. Its method
returns the value produced by `test.run_cases(...)`, which the runner invokes:

```lua
-- src/calc_test.lua
local test = require("test")
local calc = require("calc")

local function define_tests()
    test.describe("calculator", function()
        local started = false

        test.before_all(function()
            started = true
        end)

        test.it("setup ran", function()
            test.is_true(started)
        end)

        test.it("adds numbers", function()
            test.eq(calc.add(2, 3), 5)
        end)

        test.it("returns error on divide by zero", function()
            local result, err = calc.div(1, 0)
            test.has_error(result, err)
            test.contains(err, "division by zero")
        end)

        test.it_skip("not implemented yet", function()
            test.fail("should not run")
        end)
    end)
end

return { run = test.run_cases(define_tests) }
```

Register both entries. Discovery keys off `meta.type: test`; `meta.suite` groups the
results in the output:

```yaml
# src/_index.yaml
version: "1.0"
namespace: app

entries:
  - name: calc
    kind: library.lua
    source: file://calc.lua

  - name: calc_test
    kind: function.lua
    meta:
      name: Calculator Test
      type: test
      suite: calculator
    source: file://calc_test.lua
    method: run
    imports:
      test: wippy.test:test
      calc: app:calc
```

The `imports` map controls what `require(...)` resolves to inside the test: `test`
binds the framework, `calc` binds the unit under test.

## Run It

```bash
wippy test
```

Filter by entry id substring (namespace:name) while iterating:

```bash
wippy test test calc_test
```

The first `test` selects the framework's test-runner entrypoint. Remaining
arguments are substring filters applied to test entry IDs.

Expected output for the suite:

```
    o setup ran <duration>
    o adds numbers <duration>
    o returns error on divide by zero <duration>
    - not implemented yet (skipped)
  o calculator (4) 3/4 1 skipped <duration>

  PASSED
  3 tests  1 skipped  <duration>
```

The live renderer prints each case before the suite summary; timings vary by run.

`wippy test` exits with `0` when every case passes and `1` when any case fails, allowing CI to use the command's exit status.

To verify the failure path, temporarily change the expected sum from `5` to `6`.
The runner should print `FAILED` and exit with status 1. Restore `5` before
continuing.

## Assertions

Each assertion raises on failure; the type guards also return the validated value.

| Assertion | Checks |
|---|---|
| `test.eq(a, b)` / `test.neq(a, b)` | Equality / inequality |
| `test.ok(v)` / `test.fail(msg)` | Truthy / force a failure |
| `test.is_nil(v)` / `test.not_nil(v)` | Nil / non-nil |
| `test.is_true(v)` / `test.is_false(v)` | Boolean value |
| `test.is_string/number/table/function/boolean(v)` | Type guards (return `v`) |
| `test.contains(str, sub)` / `test.matches(str, pattern)` | Substring / Lua pattern |
| `test.has_key(tbl, key)` / `test.len(v, n)` | Map key / length |
| `test.gt/gte/lt/lte(a, b)` | Numeric comparison |
| `test.throws(fn)` / `test.has_error(val, err)` / `test.no_error(val, err)` | Error handling |

All take an optional trailing message argument.

## Lifecycle and Mocking

Call these inside a `describe` block:

- `test.before_all` / `test.after_all` — run once per block.
- `test.before_each` / `test.after_each` — run around every case.
- `test.mock("module.field", fn)` — replace a function for the current case;
  mocks restore automatically after each case. Use `test.restore_all_mocks()` to
  clear them early.

Nested `describe` blocks inherit parent hooks (outer `before_*` first, inner
`after_*` first).

## Troubleshooting

- `No test runner found` means `wippy/test` is not present in `wippy.lock`; run
  `wippy add wippy/test` followed by `wippy install`.
- A missing `calc` or `test` module means the `imports` keys do not match the
  corresponding `require(...)` calls.
- A test file is not discovered unless its entry has `meta.type: test`.
- Timings and terminal glyphs vary by terminal. Use the final status and process
  exit code for automation.

## Cleanup

After leaving the `testing-demo` directory, remove it when you no longer need the
disposable project.

## Next Steps

- [Hello World](tutorials/hello-world.md) — Minimal project layout
- [Entry Kinds](guides/entry-kinds.md) — `function.lua`, `library.lua`, and related entries
- [Test Framework](framework/testing.md) — Runner and event-protocol reference
