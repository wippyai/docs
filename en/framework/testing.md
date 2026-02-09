# Test Framework

The `wippy/test` module provides a BDD-style testing framework with assertions, lifecycle hooks, and mocking.

## Setup

Add the dependency:

```bash
wippy add wippy/test
wippy install
```

The module registers a `test` command automatically. Once installed, `wippy run test` discovers and runs all test entries in your project.

## Defining Tests

Tests are `function.lua` entries with `meta.type: test`:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
      description: Math operations
    source: file://math_test.lua
    method: run
    imports:
      test: wippy.test:test
```

### Test Metadata

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Must be `"test"` for the runner to discover it |
| `suite` | No | Groups tests in the runner output |
| `description` | No | Human-readable description |
| `order` | No | Sort order within a suite (lower runs first) |

## Writing Tests

### BDD Style

Use `describe` and `it` blocks to structure tests:

```lua
local test = require("test")

local function define_tests()
    test.describe("calculator", function()
        test.it("adds numbers", function()
            test.eq(1 + 1, 2)
        end)

        test.it("multiplies numbers", function()
            test.eq(3 * 4, 12)
        end)
    end)
end

local run_cases = test.run_cases(define_tests)

local function run(options)
    local result = run_cases(options)
    if result.failed_tests > 0 then
        error("tests failed: " .. result.failed_tests)
    end
    return result
end

return { run = run }
```

### Nested Suites

Suites can be nested for organization:

```lua
test.describe("user", function()
    test.describe("validation", function()
        test.it("requires name", function()
            test.ok(validate({}).error)
        end)

        test.it("accepts valid input", function()
            test.is_nil(validate({name = "Alice"}).error)
        end)
    end)

    test.describe("formatting", function()
        test.it("formats display name", function()
            test.eq(format_name("alice"), "Alice")
        end)
    end)
end)
```

### Skipping Tests

```lua
test.it_skip("not implemented yet", function()
    test.fail("TODO")
end)
```

Skipped tests appear in the output but don't count as failures.

### Suite Aliases

`test.spec` and `test.context` are aliases for `test.describe`:

```lua
test.spec("feature", function()
    test.context("when valid input", function()
        test.it("succeeds", function()
            test.ok(true)
        end)
    end)
end)
```

## Assertions

### Equality

```lua
test.eq(actual, expected, msg?)       -- actual == expected
test.neq(actual, expected, msg?)      -- actual ~= expected
```

### Truthiness

```lua
test.ok(val, msg?)                    -- val is truthy
test.fail(msg?)                       -- unconditional failure
```

### Nil Checks

```lua
test.is_nil(val, msg?)                -- val == nil
test.not_nil(val, msg?)               -- val ~= nil
```

### Type Checks

```lua
test.is_true(val, msg?)               -- val == true
test.is_false(val, msg?)              -- val == false
test.is_string(val, msg?)
test.is_number(val, msg?)
test.is_table(val, msg?)
test.is_function(val, msg?)
test.is_boolean(val, msg?)
```

### Strings and Collections

```lua
test.contains(str, substr, msg?)      -- substring match
test.matches(str, pattern, msg?)      -- Lua pattern match
test.has_key(tbl, key, msg?)          -- table key exists
test.len(val, expected, msg?)         -- #val == expected
```

### Numeric Comparisons

```lua
test.gt(a, b, msg?)                   -- a > b
test.gte(a, b, msg?)                  -- a >= b
test.lt(a, b, msg?)                   -- a < b
test.lte(a, b, msg?)                  -- a <= b
```

### Error Handling

```lua
test.throws(fn, msg?)                 -- fn() raises error, returns it
test.has_error(val, err, msg?)        -- val is nil, err is not nil
test.no_error(val, err, msg?)         -- err is nil
```

All assertions accept an optional message as the last argument. On failure, the message is included in the error output.

## Lifecycle Hooks

```lua
test.describe("database", function()
    test.before_all(function()
        -- runs once before the suite
        db = connect()
    end)

    test.after_all(function()
        -- runs once after the suite
        db:close()
    end)

    test.before_each(function()
        -- runs before each test
        db:begin_transaction()
    end)

    test.after_each(function()
        -- runs after each test
        db:rollback()
    end)

    test.it("inserts a record", function()
        db:exec("INSERT INTO users (name) VALUES ('Alice')")
        local count = db:query_row("SELECT COUNT(*) FROM users")
        test.eq(count, 1)
    end)
end)
```

Hooks in nested suites execute in order: parent `before_each` runs before child `before_each`, and child `after_each` runs before parent `after_each`.

## Mocking

The mock system replaces global object fields and automatically restores them after each test.

### Basic Mocking

```lua
test.describe("notifications", function()
    test.it("sends message", function()
        local sent = false
        test.mock("process.send", function(pid, topic, payload)
            sent = true
        end)

        notify_user("hello")
        test.is_true(sent)
        -- mock is auto-restored after this test
    end)
end)
```

### Mock API

```lua
test.mock("object.field", replacement)    -- replace a global field
test.mock_process("field", replacement)   -- shorthand for process fields
test.restore_mock("object.field")         -- restore one mock
test.restore_all_mocks()                  -- restore all mocks
```

Mock paths use dot notation: `"process.send"` replaces `_G.process.send`.

Mocks for `process.send` automatically proxy test framework messages through the original function, so test event reporting continues to work when process.send is mocked.

All mocks are automatically restored after each test via the `after_each` hook.

## Running Tests

### Run All Tests

```bash
wippy run test
```

### Filter by Pattern

```bash
wippy run test math
wippy run test user validation
```

Filters match against entry IDs. Multiple patterns are combined.

### Example Output

```
3 tests in 1 suites

  calculator
    + adds numbers                           0ms
    + multiplies numbers                     0ms
    - divides by zero                        1ms
      Error: expected error, got nil

  1 suite | 2 passed | 1 failed | 0 skipped | 3ms
```

## Simple Tests

For tests that don't need the BDD framework, define a simple function that returns `true` or raises an error:

```lua
local funcs = require("funcs")

local function main()
    local result, err = funcs.call("app:my_function", "input")
    if err then
        error("call failed: " .. tostring(err))
    end
    if result ~= "expected" then
        error("expected 'expected', got: " .. tostring(result))
    end
    return true
end

return { main = main }
```

```yaml
  - name: integration
    kind: function.lua
    meta:
      type: test
      suite: integration
    source: file://integration_test.lua
    method: main
    modules:
      - funcs
```

The runner detects whether a test uses BDD case events or returns a simple value. Both patterns work with `wippy run test`.

## Project Structure

A typical test layout:

```
src/
  _index.yaml
  app.lua
  test/
    _index.yaml          # test entries
    math_test.lua
    user_test.lua
    integration_test.lua
```

The test `_index.yaml` defines the test namespace and entries:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
    source: file://math_test.lua
    method: run
    imports:
      test: wippy.test:test

  - name: user
    kind: function.lua
    meta:
      type: test
      suite: user
    source: file://user_test.lua
    method: run
    imports:
      test: wippy.test:test
```

## Infrastructure Requirements

The test runner needs a `process.host` and `terminal.host` in your application. These are typically already present. If not, add them:

```yaml
entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true
```

## See Also

- [Framework Overview](framework/overview.md) - Framework module usage
- [CLI Reference](guides/cli.md) - CLI commands
- [Functions](concepts/functions.md) - Function registry
