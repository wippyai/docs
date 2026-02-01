# 表达式语言
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

使用 [expr-lang](https://expr-lang.org/) 语法求值动态表达式。编译和执行安全表达式，用于过滤、验证和规则求值，无需完整的 Lua 执行。

## 配置

表达式缓存在启动时配置：

```yaml
lua:
  expr:
    cache_enabled: true   # 启用表达式缓存
    capacity: 5000        # 缓存容量
```

## 加载

```lua
local expr = require("expr")
```

## 求值表达式

求值表达式字符串并返回结果。使用内部 LRU 缓存存储已编译的表达式：

```lua
-- 简单数学
local result = expr.eval("1 + 2 * 3")  -- 7

-- 带变量
local total = expr.eval("price * quantity", {
    price = 29.99,
    quantity = 3
})  -- 89.97

-- 布尔表达式
local is_adult = expr.eval("age >= 18", {age = 21})  -- true

-- 字符串操作
local greeting = expr.eval('name + " is " + status', {
    name = "Alice",
    status = "online"
})  -- "Alice is online"

-- 三元运算符
local label = expr.eval('score > 90 ? "A" : score > 80 ? "B" : "C"', {
    score = 85
})  -- "B"

-- 数组操作
local has_admin = expr.eval('"admin" in roles', {
    roles = {"user", "admin", "viewer"}
})  -- true
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `expression` | string | expr-lang 语法表达式 |
| `env` | table | 表达式的变量环境（可选） |

**返回值:** `any, error`

## 编译表达式

将表达式编译为可重用的 Program 对象，用于重复求值：

```lua
-- 编译一次用于重复使用
local discount_calc, err = expr.compile("price * (1 - discount_rate)")
if err then
    return nil, err
end

-- 使用不同输入重用
local price1 = discount_calc:run({price = 100, discount_rate = 0.1})  -- 90
local price2 = discount_calc:run({price = 50, discount_rate = 0.2})   -- 40
local price3 = discount_calc:run({price = 200, discount_rate = 0.15}) -- 170
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `expression` | string | expr-lang 语法表达式 |
| `env` | table | 编译的类型提示环境（可选） |

**返回值:** `Program, error`

## 运行已编译程序

使用提供的环境执行已编译的表达式：

```lua
-- 验证规则
local validator, _ = expr.compile("len(password) >= 8 and len(password) <= 128")

local valid1 = validator:run({password = "short"})       -- false
local valid2 = validator:run({password = "securepass123"}) -- true

-- 定价规则
local pricer, _ = expr.compile([[
    base_price * quantity * (1 - bulk_discount) + shipping
]])

local order_total = pricer:run({
    base_price = 25.00,
    quantity = 10,
    bulk_discount = 0.15,
    shipping = 12.50
})  -- 225.00
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `env` | table | 表达式的变量环境（可选） |

**返回值:** `any, error`

## 内置函数

Expr-lang 提供许多内置函数：

```lua
-- 数学函数
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(10, 2, 8)")       -- 2
expr.eval("abs(-42)")            -- 42
expr.eval("ceil(3.2)")           -- 4
expr.eval("floor(3.8)")          -- 3

-- 字符串函数
expr.eval('len("hello")')        -- 5
expr.eval('upper("hello")')      -- "HELLO"
expr.eval('lower("HELLO")')      -- "hello"
expr.eval('trim("  hi  ")')      -- "hi"
expr.eval('contains("hello", "ell")')  -- true

-- 数组函数
expr.eval("len(items)", {items = {1,2,3}})  -- 3
expr.eval("sum(values)", {values = {1,2,3,4}})  -- 10
```

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 表达式为空 | `errors.INVALID` | 否 |
| 表达式语法无效 | `errors.INTERNAL` | 否 |
| 表达式求值失败 | `errors.INTERNAL` | 否 |
| 结果转换失败 | `errors.INTERNAL` | 否 |

参见 [错误处理](lua/core/errors.md) 了解如何处理错误。
