# Testing

Write and run tests for your Wippy applications using the built-in test framework.

## Test Discovery

Tests are discovered by metadata. The test runner finds all registry entries with `meta.type = "test"` and executes them.

```bash
wippy run app:test_runner app:terminal
```

The runner uses `registry.find({["meta.type"] = "test"})` to locate tests and calls them via `funcs.call(entry.id)`.

## Defining Tests

Register test functions in `_index.yaml` with `meta.type = "test"`:

```yaml
version: "1.0"
namespace: app.test.errors

entries:
  - name: new
    kind: function.lua
    meta:
      type: test
      suite: errors
      description: errors.new creates structured errors
    source: file://new.lua
    method: main
    imports:
      assert2: app.lib:assert
```

**Metadata fields:**

- `meta.type`: Must be `"test"` for test discovery
- `meta.suite`: Groups related tests (e.g., "errors", "json")
- `meta.order`: Run order within suite (default: 0)
- `meta.description`: Test description (shown in output)

## Writing Test Functions

Test functions must return `true` on success or throw an error on failure:

```lua
-- tests/test/errors/new.lua
local assert = require("assert2")

local function main()
    local e1 = errors.new("simple error")
    assert.ok(e1, "errors.new returns error")
    assert.eq(e1:message(), "simple error", "message matches")
    assert.eq(e1:kind(), "", "default kind is empty")
    assert.is_nil(e1:retryable(), "default retryable is nil")

    local e2 = errors.new({
        message = "not found",
        kind = errors.NOT_FOUND,
        retryable = false,
        details = {resource = "user", id = 123}
    })
    assert.eq(e2:message(), "not found", "message from table")
    assert.eq(e2:kind(), errors.NOT_FOUND, "kind from table")

    local d = e2:details()
    assert.eq(d.resource, "user", "details.resource")
    assert.eq(d.id, 123, "details.id")

    return true
end

return { main = main }
```

## Assertion Library

Create a reusable assertion module in `tests/lib/assert.lua`:

```lua
local M = {}

function M.eq(actual: any, expected: any, msg: string?)
    if actual ~= expected then
        error((msg or "assertion failed") .. ": expected " .. tostring(expected) .. ", got " .. tostring(actual), 2)
    end
end

function M.neq(actual: any, expected: any, msg: string?)
    if actual == expected then
        error((msg or "assertion failed") .. ": expected not " .. tostring(expected), 2)
    end
end

function M.ok(val: any?, msg: string?): asserts val
    if not val then
        error((msg or "assertion failed") .. ": expected truthy value", 2)
    end
end

function M.fail(msg)
    error(msg or "assertion failed", 2)
end

function M.is_nil(val, msg)
    if val ~= nil then
        error((msg or "assertion failed") .. ": expected nil, got " .. tostring(val), 2)
    end
end

function M.not_nil(val: any?, msg: string?): asserts val
    if val == nil then
        error((msg or "assertion failed") .. ": expected non-nil value", 2)
    end
end

function M.is_string(val: any, msg: string?): asserts val is string
    if type(val) ~= "string" then
        error((msg or "assertion failed") .. ": expected string, got " .. type(val), 2)
    end
end

function M.is_number(val: any, msg: string?): asserts val is number
    if type(val) ~= "number" then
        error((msg or "assertion failed") .. ": expected number, got " .. type(val), 2)
    end
end

function M.is_table(val: any, msg: string?)
    if type(val) ~= "table" then
        error((msg or "assertion failed") .. ": expected table, got " .. type(val), 2)
    end
end

function M.is_boolean(val: any, msg: string?): asserts val is boolean
    if type(val) ~= "boolean" then
        error((msg or "assertion failed") .. ": expected boolean, got " .. type(val), 2)
    end
end

function M.contains(str, substr, msg)
    if type(str) ~= "string" or not string.find(str, substr, 1, true) then
        error((msg or "assertion failed") .. ": expected string to contain '" .. tostring(substr) .. "'", 2)
    end
end

function M.has_error(val, err, msg)
    if val ~= nil then
        error((msg or "has_error failed") .. ": expected nil result, got " .. tostring(val), 2)
    end
    if err == nil then
        error((msg or "has_error failed") .. ": expected error, got nil", 2)
    end
end

function M.no_error(val, err, msg)
    if err ~= nil then
        error((msg or "no_error failed") .. ": unexpected error: " .. tostring(err), 2)
    end
end

function M.throws(fn, msg)
    local ok, err = pcall(fn)
    if ok then
        error((msg or "throws failed") .. ": expected function to throw", 2)
    end
    return err
end

function M.not_throws(fn, msg)
    local ok, err = pcall(fn)
    if not ok then
        error((msg or "not_throws failed") .. ": unexpected error: " .. tostring(err), 2)
    end
end

-- Error structure assertions
function M.error_kind(err, expected_kind, msg)
    if err == nil then
        error((msg or "error_kind failed") .. ": error is nil", 2)
    end
    if type(err) ~= "table" then
        error((msg or "error_kind failed") .. ": error is not structured (got " .. type(err) .. ")", 2)
    end
    if err.kind ~= expected_kind then
        error((msg or "error_kind failed") .. ": expected kind '" .. tostring(expected_kind) .. "', got '" .. tostring(err.kind) .. "'", 2)
    end
end

function M.error_message(err, expected_msg, msg)
    if err == nil then
        error((msg or "error_message failed") .. ": error is nil", 2)
    end
    local actual_msg = type(err) == "table" and err.message or tostring(err)
    if actual_msg ~= expected_msg then
        error((msg or "error_message failed") .. ": expected message '" .. tostring(expected_msg) .. "', got '" .. tostring(actual_msg) .. "'", 2)
    end
end

function M.error_contains(err, substr, msg)
    if err == nil then
        error((msg or "error_contains failed") .. ": error is nil", 2)
    end
    local actual_msg = type(err) == "table" and err.message or tostring(err)
    if not string.find(actual_msg, substr, 1, true) then
        error((msg or "error_contains failed") .. ": expected error to contain '" .. tostring(substr) .. "', got '" .. tostring(actual_msg) .. "'", 2)
    end
end

return M
```

Register the assertion library:

```yaml
# tests/lib/_index.yaml
version: "1.0"
namespace: app.lib

entries:
  - name: assert
    kind: function.lua
    source: file://assert.lua
```

## Testing Error Handling

Wippy functions return `(result, error)` pairs. Test both success and error paths:

```lua
local assert = require("assert2")

local function main()
    -- Test success path
    local t, err = time.parse("2006-01-02 15:04:05", "2024-12-29 15:04:05")
    assert.is_nil(err, "parse succeeds")
    assert.not_nil(t, "parse returns time")
    assert.eq(t:year(), 2024, "parsed year")

    -- Test error path
    local bad_t, bad_err = time.parse("2006-01-02", "invalid-date")
    assert.is_nil(bad_t, "invalid parse returns nil")
    assert.not_nil(bad_err, "invalid parse returns error")

    return true
end

return { main = main }
```

**Error pattern assertions:**

```lua
local function main()
    -- Check error kind
    local user, err = fetch_user(-1)
    assert.is_nil(user, "no user on error")
    assert.eq(err:kind(), errors.INVALID, "INVALID kind")
    assert.eq(err:retryable(), false, "not retryable")

    -- Check error message contains text
    local _, compress_err = compress.gzip.encode("")
    assert.not_nil(compress_err, "error returned")
    assert.contains(tostring(compress_err), "empty", "error mentions empty")

    -- Check function throws
    assert.throws(function()
        error("something went wrong")
    end, "should throw")

    return true
end
```

## Test Suites

Group related tests using `meta.suite`:

```yaml
version: "1.0"
namespace: app.test.channel

entries:
  - name: basic
    kind: function.lua
    meta:
      type: test
      suite: channel
      order: 1
    source: file://basic.lua
    method: main
    imports:
      assert2: app.lib:assert

  - name: buffered
    kind: function.lua
    meta:
      type: test
      suite: channel
      order: 2
    source: file://buffered.lua
    method: main
    imports:
      assert2: app.lib:assert

  - name: close
    kind: function.lua
    meta:
      type: test
      suite: channel
      order: 3
    source: file://close.lua
    method: main
    imports:
      assert2: app.lib:assert
```

Tests in the same suite are grouped in the output and can be ordered with `meta.order`.

## Test Runner Implementation

The test runner is a process that discovers and executes tests:

```yaml
# src/_index.yaml
entries:
  - name: test_runner
    kind: process.lua
    meta:
      comment: Runs all tests with meta.type=test
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
      - time
```

Basic runner implementation:

```lua
-- runner.lua
local io = require("io")
local registry = require("registry")
local funcs = require("funcs")
local time = require("time")

local function run_test(entry)
    local ok, result, err = pcall(function()
        return funcs.call(entry.id)
    end)

    if not ok then
        return false, result
    elseif err then
        return false, err
    elseif result == false then
        return false, "test returned false"
    else
        return true, nil
    end
end

local function main()
    local args = io.args()

    io.print("Running Tests")
    io.print("")

    -- Find all tests
    local entries, err = registry.find({["meta.type"] = "test"})
    if err then
        io.eprint("Error: " .. tostring(err))
        return 1
    end

    if not entries or #entries == 0 then
        io.print("No tests found")
        return 0
    end

    -- Filter by patterns
    if #args > 0 then
        local filtered = {}
        for _, entry in ipairs(entries) do
            for _, pattern in ipairs(args) do
                if entry.id:find(pattern, 1, true) then
                    table.insert(filtered, entry)
                    break
                end
            end
        end
        entries = filtered
    end

    local passed = 0
    local failed = 0
    local failures = {}
    local start = time.now()

    -- Run tests
    for _, entry in ipairs(entries) do
        local name = entry.id:match(":([^:]+)$") or entry.id
        io.write("  " .. name .. " ... ")

        local ok, err_obj = run_test(entry)

        if ok then
            io.print("ok")
            passed = passed + 1
        else
            io.print("FAILED")
            failed = failed + 1
            table.insert(failures, {id = entry.id, error = err_obj})
        end
    end

    local elapsed = time.now():sub(start):milliseconds()

    -- Print failures
    if #failures > 0 then
        io.print("")
        io.print("Failures:")
        for _, f in ipairs(failures) do
            io.print("")
            io.print("  " .. f.id)
            io.print("  " .. tostring(f.error))
        end
    end

    -- Summary
    io.print("")
    if failed > 0 then
        io.print("FAILED: " .. passed .. " passed, " .. failed .. " failed  " .. elapsed .. "ms")
        return 1
    else
        io.print("PASSED: " .. passed .. " tests  " .. elapsed .. "ms")
        return 0
    end
end

return { main = main }
```

The real test runner at `/home/wolfy-j/projects/wippy/tests/app/src/runner.lua` includes:

- Suite grouping and ordering
- Live progress display with spinners
- Progress bars
- Retry logic for pool registration races
- Colored output
- Detailed failure reports

## Running Tests

Run all tests:

```bash
wippy run app:test_runner app:terminal
```

Filter tests by pattern:

```bash
# Run tests containing "errors"
wippy run app:test_runner app:terminal -- errors

# Run tests containing "channel" or "time"
wippy run app:test_runner app:terminal -- channel time
```

The runner matches patterns against test entry IDs using `entry.id:find(pattern, 1, true)`.

## Example Test Output

```
  Running Tests

  12 tests in 3 suites

  ● errors (9) 9/9  15ms
  ● channel (8) 8/8  23ms
  ● time (6) 5/6  12ms
      ✗ parse_invalid

  Failures

    app.test.time:parse_invalid
    assertion failed: expected error, got nil

  FAILED  [████████████████████░]

  22 passed  1 failed  50ms
```

## Testing Patterns

**Channel operations:**

```lua
local function main()
    local ch = channel.new(1)
    ch:send("hello")
    local val, ok = ch:receive()
    assert.eq(val, "hello", "received correct value")
    assert.eq(ok, true, "receive ok is true")
    return true
end
```

**Function calls:**

```lua
local function main()
    local result, err = funcs.call("app.test.funcs:echo", "test input")
    assert.is_nil(err, "call echo no error")
    assert.eq(result.ok, true, "echo result ok")
    assert.eq(result.echo, "test input", "echo result has input")
    return true
end
```

**Registry queries:**

```lua
local function main()
    local entries, err = registry.find({kind = "function.lua"})
    assert.is_nil(err, "find by kind no error")
    assert.not_nil(entries, "find returns entries")
    assert.ok(#entries > 0, "find has results")

    for _, entry in ipairs(entries) do
        assert.not_nil(entry.id, "entry has id")
        assert.eq(type(entry.id), "string", "id is string")
    end

    return true
end
```

## Project Structure

```
myapp/
├── tests/
│   ├── lib/
│   │   ├── _index.yaml        # Assert library registration
│   │   └── assert.lua         # Assertion functions
│   ├── test/
│   │   ├── errors/
│   │   │   ├── _index.yaml    # Error tests metadata
│   │   │   ├── new.lua        # Test error creation
│   │   │   ├── patterns.lua   # Test error patterns
│   │   │   └── wrap.lua       # Test error wrapping
│   │   ├── channel/
│   │   │   ├── _index.yaml    # Channel tests metadata
│   │   │   ├── basic.lua      # Test basic operations
│   │   │   └── buffered.lua   # Test buffered channels
│   │   └── ...
│   ├── _index.yaml            # Test runner registration
│   └── runner.lua             # Test runner implementation
└── src/
    └── ...                     # Application code
```

## Key Points

1. Tests are discovered via `meta.type = "test"` in registry entries
2. Test functions must return `true` or throw errors
3. Use `meta.suite` to group related tests
4. Use `meta.order` to control execution order within suites
5. Test both success and error paths with `(result, error)` return patterns
6. Filter tests by passing patterns as command-line arguments
7. The test runner uses `registry.find()` and `funcs.call()` to execute tests

## Next Steps

- [Error Handling](lua/core/errors.md) - Error patterns and assertions
- [Registry](lua/core/registry.md) - Registry queries and filtering
- [Functions](concepts/functions.md) - Function calls and execution
