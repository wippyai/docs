# 测试

使用 `wippy/test` 框架为您的 Lua 代码编写和运行测试 — 这是一个 BDD 风格的运行器，提供断言、生命周期钩子和模拟功能，通过 `wippy run test` 命令执行。

## 您将构建什么

一个小型库和覆盖它的测试套件：

1. 一个包含 `add` 和 `div` 函数的 `calc` 库。
2. 一个测试入口，用于描述用例、断言行为并跳过一个待定用例。
3. 通过 `wippy run test` 进行一次全绿的测试运行。

## 先决条件

- 一个 Wippy 项目（克隆 [app-template](https://github.com/wippyai/app-template)，或在空目录中执行 `wippy init`）。
- 已安装测试框架和终端宿主：

  ```bash
  wippy add wippy/test
  wippy add wippy/terminal
  wippy install
  ```

  运行器会渲染一个实时的终端 UI，因此 `wippy/terminal` 必须与 `wippy/test` 一同安装。

## 被测代码

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

## 测试

测试是一个普通的 `function.lua` 入口，标记了 `meta.type: test`。它的方法返回 `test.run_cases(...)` 产生的值，由运行器调用：

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

注册这两个入口。发现机制依据 `meta.type: test`；`meta.suite` 在输出中将结果分组：

```yaml
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

`imports` 映射控制测试内部 `require(...)` 解析到的内容：`test` 绑定框架，`calc` 绑定被测单元。

## 运行

```bash
wippy run test
```

在迭代时过滤到单个套件（匹配入口 id 或套件名称）：

```bash
wippy run test calculator
```

上述套件的输出：

```
  calculator (4)  3/4  1 skipped  1ms
    o setup ran
    o adds numbers
    o returns error on divide by zero
    - not implemented yet (skipped)

  PASSED   3 tests   1 skipped   1ms
```

当每个用例都通过时，`wippy run test` 退出码为 `0`，任何失败时为 `1`，因此可以直接接入 CI。

## 断言

每个断言在失败时抛出错误；类型守卫还会返回经过验证的值。

| 断言 | 检查 |
|---|---|
| `test.eq(a, b)` / `test.neq(a, b)` | 相等 / 不相等 |
| `test.ok(v)` / `test.fail(msg)` | 真值 / 强制失败 |
| `test.is_nil(v)` / `test.not_nil(v)` | Nil / 非 nil |
| `test.is_true(v)` / `test.is_false(v)` | 布尔值 |
| `test.is_string/number/table/function/boolean(v)` | 类型守卫（返回 `v`） |
| `test.contains(str, sub)` / `test.matches(str, pattern)` | 子串 / Lua 模式 |
| `test.has_key(tbl, key)` / `test.len(v, n)` | 映射键 / 长度 |
| `test.gt/gte/lt/lte(a, b)` | 数值比较 |
| `test.throws(fn)` / `test.has_error(val, err)` / `test.no_error(val, err)` | 错误处理 |

它们都接受一个可选的尾随消息参数。

## 生命周期与模拟

在 `describe` 块内调用这些：

- `test.before_all` / `test.after_all` — 每个块运行一次。
- `test.before_each` / `test.after_each` — 围绕每个用例运行。
- `test.mock("module.field", fn)` — 为当前用例替换一个函数；模拟在每个用例后自动恢复。使用 `test.restore_all_mocks()` 可提前清除它们。

嵌套的 `describe` 块继承父级钩子（外层 `before_*` 优先，内层 `after_*` 优先）。

## 下一步

- [Hello World](tutorials/hello-world.md) — 最小化的项目布局
- [入口种类](guides/entry-kinds.md) — `function.lua`、`library.lua` 及其相关类型
- [测试框架](framework/testing.md) — 运行器和事件协议的完整参考
