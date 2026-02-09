# 测试框架

`wippy/test` 模块提供 BDD 风格的测试框架，支持断言、生命周期钩子和 Mock。

## 配置

添加依赖：

```bash
wippy add wippy/test
wippy install
```

该模块自动注册 `test` 命令。安装后，`wippy run test` 会发现并运行项目中的所有测试条目。

## 定义测试

测试是带有 `meta.type: test` 的 `function.lua` 条目：

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

### 测试元数据

| 字段 | 必填 | 描述 |
|-------|----------|-------------|
| `type` | 是 | 必须为 `"test"` 以便运行器发现 |
| `suite` | 否 | 在运行器输出中分组测试 |
| `description` | 否 | 人类可读的描述 |
| `order` | 否 | 套件内的排序顺序（越小越先执行） |

## 编写测试

### BDD 风格

使用 `describe` 和 `it` 块来组织测试结构：

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

### 嵌套套件

套件可以嵌套以组织结构：

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

### 跳过测试

```lua
test.it_skip("not implemented yet", function()
    test.fail("TODO")
end)
```

被跳过的测试会出现在输出中，但不计为失败。

### 套件别名

`test.spec` 和 `test.context` 是 `test.describe` 的别名：

```lua
test.spec("feature", function()
    test.context("when valid input", function()
        test.it("succeeds", function()
            test.ok(true)
        end)
    end)
end)
```

## 断言

### 相等性

```lua
test.eq(actual, expected, msg?)       -- actual == expected
test.neq(actual, expected, msg?)      -- actual ~= expected
```

### 真值性

```lua
test.ok(val, msg?)                    -- val is truthy
test.fail(msg?)                       -- unconditional failure
```

### Nil 检查

```lua
test.is_nil(val, msg?)                -- val == nil
test.not_nil(val, msg?)               -- val ~= nil
```

### 类型检查

```lua
test.is_true(val, msg?)               -- val == true
test.is_false(val, msg?)              -- val == false
test.is_string(val, msg?)
test.is_number(val, msg?)
test.is_table(val, msg?)
test.is_function(val, msg?)
test.is_boolean(val, msg?)
```

### 字符串和集合

```lua
test.contains(str, substr, msg?)      -- substring match
test.matches(str, pattern, msg?)      -- Lua pattern match
test.has_key(tbl, key, msg?)          -- table key exists
test.len(val, expected, msg?)         -- #val == expected
```

### 数值比较

```lua
test.gt(a, b, msg?)                   -- a > b
test.gte(a, b, msg?)                  -- a >= b
test.lt(a, b, msg?)                   -- a < b
test.lte(a, b, msg?)                  -- a <= b
```

### 错误处理

```lua
test.throws(fn, msg?)                 -- fn() raises error, returns it
test.has_error(val, err, msg?)        -- val is nil, err is not nil
test.no_error(val, err, msg?)         -- err is nil
```

所有断言接受可选消息作为最后一个参数。失败时，消息会包含在错误输出中。

## 生命周期钩子

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

嵌套套件中的钩子按顺序执行：父级 `before_each` 在子级 `before_each` 之前运行，子级 `after_each` 在父级 `after_each` 之前运行。

## Mock

Mock 系统替换全局对象字段，并在每个测试后自动恢复。

### 基本 Mock

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

Mock 路径使用点号表示法：`"process.send"` 替换 `_G.process.send`。

对 `process.send` 的 Mock 会自动通过原始函数代理测试框架消息，因此当 process.send 被 Mock 时，测试事件报告仍然正常工作。

所有 Mock 在每个测试后通过 `after_each` 钩子自动恢复。

## 运行测试

### 运行所有测试

```bash
wippy run test
```

### 按模式过滤

```bash
wippy run test math
wippy run test user validation
```

过滤器匹配条目 ID。多个模式会被组合。

### 输出示例

```
3 tests in 1 suites

  calculator
    + adds numbers                           0ms
    + multiplies numbers                     0ms
    - divides by zero                        1ms
      Error: expected error, got nil

  1 suite | 2 passed | 1 failed | 0 skipped | 3ms
```

## 简单测试

对于不需要 BDD 框架的测试，定义一个返回 `true` 或抛出错误的简单函数：

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

运行器会检测测试使用的是 BDD 用例事件还是返回简单值。两种模式均可与 `wippy run test` 配合使用。

## 项目结构

典型的测试布局：

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

测试 `_index.yaml` 定义测试命名空间和条目：

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

## 基础设施要求

测试运行器需要应用程序中存在 `process.host` 和 `terminal.host`。通常它们已经存在。如果没有，请添加：

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

## 另请参阅

- [框架概述](framework/overview.md) - 框架模块使用
- [命令行工具](guides/cli.md) - CLI 命令
- [函数](concepts/functions.md) - 函数注册表
