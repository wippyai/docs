# 测试

使用内置测试框架为 Wippy 应用程序编写和运行测试。

## 测试发现

测试通过元数据发现。测试运行器查找所有带有 `meta.type = "test"` 的注册表条目并执行它们。

```bash
wippy run app:test_runner app:terminal
```

运行器使用 `registry.find({["meta.type"] = "test"})` 定位测试，并通过 `funcs.call(entry.id)` 调用它们。

## 定义测试

在 `_index.yaml` 中注册测试函数，设置 `meta.type = "test"`：

```yaml
version: "1.0"
namespace: app.test.errors

entries:
  - name: new
    kind: function.lua
    meta:
      type: test
      suite: errors
      description: errors.new 创建结构化错误
    source: file://new.lua
    method: main
    imports:
      assert2: app.lib:assert
```

**元数据字段：**

- `meta.type`：必须是 `"test"` 以便测试发现
- `meta.suite`：分组相关测试（如 "errors"、"json"）
- `meta.order`：套件内的运行顺序（默认：0）
- `meta.description`：测试描述（显示在输出中）

## 编写测试函数

测试函数必须在成功时返回 `true`，或在失败时抛出错误：

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

## 断言库

在 `tests/lib/assert.lua` 中创建可重用的断言模块：

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

-- 错误结构断言
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

注册断言库：

```yaml
# tests/lib/_index.yaml
version: "1.0"
namespace: app.lib

entries:
  - name: assert
    kind: function.lua
    source: file://assert.lua
```

## 测试错误处理

Wippy 函数返回 `(result, error)` 对。测试成功和错误路径：

```lua
local assert = require("assert2")

local function main()
    -- 测试成功路径
    local t, err = time.parse("2006-01-02 15:04:05", "2024-12-29 15:04:05")
    assert.is_nil(err, "parse succeeds")
    assert.not_nil(t, "parse returns time")
    assert.eq(t:year(), 2024, "parsed year")

    -- 测试错误路径
    local bad_t, bad_err = time.parse("2006-01-02", "invalid-date")
    assert.is_nil(bad_t, "invalid parse returns nil")
    assert.not_nil(bad_err, "invalid parse returns error")

    return true
end

return { main = main }
```

**错误模式断言：**

```lua
local function main()
    -- 检查错误类型
    local user, err = fetch_user(-1)
    assert.is_nil(user, "no user on error")
    assert.eq(err:kind(), errors.INVALID, "INVALID kind")
    assert.eq(err:retryable(), false, "not retryable")

    -- 检查错误消息包含文本
    local _, compress_err = compress.gzip.encode("")
    assert.not_nil(compress_err, "error returned")
    assert.contains(tostring(compress_err), "empty", "error mentions empty")

    -- 检查函数抛出异常
    assert.throws(function()
        error("something went wrong")
    end, "should throw")

    return true
end
```

## 测试套件

使用 `meta.suite` 分组相关测试：

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

同一套件中的测试在输出中分组，可以使用 `meta.order` 排序。

## 测试运行器实现

测试运行器是发现并执行测试的进程：

```yaml
# src/_index.yaml
entries:
  - name: test_runner
    kind: process.lua
    meta:
      comment: 运行所有带 meta.type=test 的测试
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
      - time
```

基本运行器实现：

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

    -- 查找所有测试
    local entries, err = registry.find({["meta.type"] = "test"})
    if err then
        io.eprint("Error: " .. tostring(err))
        return 1
    end

    if not entries or #entries == 0 then
        io.print("No tests found")
        return 0
    end

    -- 按模式过滤
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

    -- 运行测试
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

    -- 打印失败
    if #failures > 0 then
        io.print("")
        io.print("Failures:")
        for _, f in ipairs(failures) do
            io.print("")
            io.print("  " .. f.id)
            io.print("  " .. tostring(f.error))
        end
    end

    -- 摘要
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

## 运行测试

运行所有测试：

```bash
wippy run app:test_runner app:terminal
```

按模式过滤测试：

```bash
# 运行包含 "errors" 的测试
wippy run app:test_runner app:terminal -- errors

# 运行包含 "channel" 或 "time" 的测试
wippy run app:test_runner app:terminal -- channel time
```

运行器使用 `entry.id:find(pattern, 1, true)` 匹配测试条目 ID 的模式。

## 示例测试输出

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

## 测试模式

**通道操作：**

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

**函数调用：**

```lua
local function main()
    local result, err = funcs.call("app.test.funcs:echo", "test input")
    assert.is_nil(err, "call echo no error")
    assert.eq(result.ok, true, "echo result ok")
    assert.eq(result.echo, "test input", "echo result has input")
    return true
end
```

**注册表查询：**

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

## 项目结构

```
myapp/
├── tests/
│   ├── lib/
│   │   ├── _index.yaml        # 断言库注册
│   │   └── assert.lua         # 断言函数
│   ├── test/
│   │   ├── errors/
│   │   │   ├── _index.yaml    # 错误测试元数据
│   │   │   ├── new.lua        # 测试错误创建
│   │   │   ├── patterns.lua   # 测试错误模式
│   │   │   └── wrap.lua       # 测试错误包装
│   │   ├── channel/
│   │   │   ├── _index.yaml    # 通道测试元数据
│   │   │   ├── basic.lua      # 测试基本操作
│   │   │   └── buffered.lua   # 测试缓冲通道
│   │   └── ...
│   ├── _index.yaml            # 测试运行器注册
│   └── runner.lua             # 测试运行器实现
└── src/
    └── ...                     # 应用代码
```

## 要点

1. 测试通过注册表条目中的 `meta.type = "test"` 发现
2. 测试函数必须返回 `true` 或抛出错误
3. 使用 `meta.suite` 分组相关测试
4. 使用 `meta.order` 控制套件内的执行顺序
5. 使用 `(result, error)` 返回模式测试成功和错误路径
6. 通过传递命令行参数作为模式过滤测试
7. 测试运行器使用 `registry.find()` 和 `funcs.call()` 执行测试

## 下一步

- [错误处理](lua/core/errors.md) - 错误模式和断言
- [注册表](lua/core/registry.md) - 注册表查询和过滤
- [函数](concepts/functions.md) - 函数调用和执行
