---
title: "类型系统"
description: "Wippy 包含一个具有流敏感检查的渐进式类型系统。类型默认为非空。"
---

# 类型系统

> **实验性。** 预计存在一些限制。

Wippy 包含一个具有流敏感检查的渐进式类型系统。类型默认为非空。

## 基本类型

```lua
local n: number = 3.14
local i: integer = 42         -- integer 是 number 的子类型
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- 显式动态（退出检查）
local u: unknown = something  -- 必须先收窄才能使用
```

### any 与 unknown

```lua
-- any: 退出类型检查
local a: any = get_data()
a.foo.bar.baz()              -- 无错误，运行时可能崩溃

-- unknown: 安全的未知类型，必须先收窄才能使用
local u: unknown = get_data()
u.foo                        -- 错误：无法访问 unknown 的属性
if type(u) == "table" then
    -- 此处 u 收窄为 table
end
```

## Nil 安全

类型默认为非空。使用 `?` 表示可选值：

```lua
local x: number = nil         -- 错误：nil 不能赋给 number
local y: number? = nil        -- 正确：number? 表示"number 或 nil"
local z: number? = 42         -- 正确
```

### 控制流收窄

类型检查器跟踪控制流：

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- 此处 x 是 number
    end
    return 0
end

-- 早期返回模式
local user, err = get_user(123)
if err then return nil, err end
-- 此处 user 收窄为非 nil

-- 或默认值
local val = get_value() or 0  -- val: number
```

## 联合类型

```lua
local val: number | string = get_value()

if type(val) == "number" then
    print(val + 1)            -- val: number
else
    print(val:upper())        -- val: string
end
```

### 字面量类型

```lua
type Status = "pending" | "active" | "done"

local s: Status = "pending"   -- 正确
local s: Status = "invalid"   -- 错误
```

## 函数类型

```lua
local function add(a: number, b: number): number
    return a + b
end

-- 多返回值
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- 错误返回（Lua 习惯用法）
local function fetch(url: string): (string?, error?)
    -- 返回 (data, nil) 或 (nil, error)
end

-- 一等函数类型
local double: (number) -> number = function(x: number): number
    return x * 2
end
```

### 可变参数函数

```lua
local function sum(...: number): number
    local total: number = 0
    for _, v in ipairs({...}) do
        total = total + v
    end
    return total
end
```

## 记录类型

```lua
type User = {name: string, age: number}

local u: User = {name = "alice", age = 25}
```

### 可选字段

```lua
type Config = {
    host: string,
    port: number,
    timeout?: number,
    debug?: boolean
}

local cfg: Config = {host = "localhost", port = 8080}  -- 正确
```

## 泛型

```lua
local function identity<T>(x: T): T
    return x
end

local n: number = identity(42)
local s: string = identity("hello")
```

### 受约束泛型

```lua
type HasName = {name: string}

local function greet<T: HasName>(obj: T): string
    return "Hello, " .. obj.name
end

greet({name = "Alice"})       -- 正确
greet({age = 30})             -- 错误：缺少 'name'
```

## 交叉类型

合并多个类型：

```lua
type Named = {name: string}
type Aged = {age: number}
type Person = Named & Aged

local p: Person = {name = "Alice", age = 30}
```

## 标记联合

```lua
type Result<T, E> =
    | {ok: true, value: T}
    | {ok: false, error: E}

type LoadState =
    | {status: "loading"}
    | {status: "loaded", data: User}
    | {status: "error", message: string}

local function render(state: LoadState): string
    if state.status == "loading" then
        return "Loading..."
    elseif state.status == "loaded" then
        return "Hello, " .. state.data.name
    elseif state.status == "error" then
        return "Error: " .. state.message
    end
end
```

## never 类型

`never` 是底类型——不存在任何值：

```lua
function fail(msg: string): never
    error(msg)
end
```

## 错误处理模式

检查器理解 Lua 的错误习惯用法：

```lua
local value, err = call()
if err then
    -- 此处 value 为 nil
    return nil, err
end
-- 此处 value 为非 nil，err 为 nil
print(value)
```

## 非 Nil 断言

使用 `!` 断言表达式为非 nil：

```lua
local user: User? = get_user()
local name = user!.name              -- 断言 user 为非 nil
```

如果运行时值为 nil，则抛出错误。在你知道某值不能为 nil 但类型检查器无法证明时使用。

## 类型转换

### 安全转换（验证）

将类型作为函数调用以验证并转换：

```lua
local data: any = get_json()
local user = User(data)              -- 验证并返回 User
local name = user.name               -- 安全字段访问
```

适用于基本类型和自定义类型：

```lua
local x: any = get_value()
local s = string(x)                  -- 转换为 string
local n = integer(x)                 -- 转换为 integer
local b = boolean(x)                 -- 转换为 boolean

type Point = {x: number, y: number}
local p = Point(data)                -- 验证记录结构
```

### Type:is() 方法

不抛出地验证，返回 `(value, nil)` 或 `(nil, error)`：

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- p 是有效的 Point
else
    return nil, err                  -- 验证失败
end
```

结果在条件中收窄：

```lua
if Point:is(data) then
    local p: Point = data            -- data 收窄为 Point
end
```

### 不安全转换

使用 `::` 或 `as` 进行未检查的转换：

```lua
local data: any = get_data()
local user = data :: User            -- 无运行时检查
local user = data as User            -- 与 :: 相同
```

少用。不安全转换绕过验证，如果值与类型不匹配可能引发运行时错误。

## 类型反射

类型是带有内省方法的一等值。

### 种类与名称

```lua
print(Number:kind())                 -- "number"
print(Point:kind())                  -- "record"
print(Point:name())                  -- "Point"
```

### 记录字段

遍历记录字段：

```lua
type User = {name: string, age: number}

for name, typ in User:fields() do
    print(name, typ:kind())
end
-- name    string
-- age     number
```

访问单个字段类型：

```lua
local nameType = User.name           -- 'name' 字段的类型
print(nameType:kind())               -- "string"
```

### 集合类型

```lua
local arr: {number} = {1, 2, 3}
local arrType = typeof(arr)
print(arrType:elem():kind())         -- "number"

local map: {[string]: number} = {}
local mapType = typeof(map)
print(mapType:key():kind())          -- "string"
print(mapType:val():kind())          -- "number"
```

### 可选类型

```lua
local opt: number? = nil
local optType = typeof(opt)
print(optType:kind())                -- "optional"
print(optType:inner():kind())        -- "number"
```

### 联合类型

```lua
type Status = "pending" | "active" | "done"

for variant in Status:variants() do
    print(variant)
end
```

### 函数类型

```lua
local fn: (number, string) -> boolean

local fnType = typeof(fn)
for param in fnType:params() do
    print(param:kind())
end
print(fnType:ret():kind())           -- "boolean"
```

### 类型比较

```lua
print(Number == Number)              -- true
print(Integer <= Number)             -- true (子类型)
print(Integer < Number)              -- true (严格子类型)
```

### 类型作为表键

```lua
local handlers = {}
handlers[Number] = function() return "number handler" end
handlers[String] = function() return "string handler" end

local h = handlers[typeof(value)]
if h then h() end
```

## 类型注解

为函数签名添加类型：

```lua
-- 参数和返回类型
local function process(input: string): number
    return #input
end

-- 局部变量类型
local count: number = 0

-- 类型别名
type StringArray = {string}
type StringMap = {[string]: number}
```

## 类型验证器

使用注解为类型添加运行时验证约束：

```lua
-- 单个验证器
local x: number @min(0) = 1

-- 多个验证器
local x: number @min(0) @max(100) = 50

-- 字符串模式
local email: string @pattern("^.+@.+$") = "test@example.com"

-- 无参验证器
local x: number @integer = 42
```

### 内置验证器

| 验证器 | 适用于 | 示例 |
|-----------|------------|---------|
| `@min(n)` | number | `local x: number @min(0) = 1` |
| `@max(n)` | number | `local x: number @max(100) = 50` |
| `@min_len(n)` | string、array | `local s: string @min_len(1) = "hi"` |
| `@max_len(n)` | string、array | `local s: string @max_len(10) = "hi"` |
| `@pattern(regex)` | string | `local email: string @pattern("^.+@.+$") = "a@b.com"` |

### 记录字段验证器

```lua
type User = {
    age: number @min(0) @max(150),
    name: string @min_len(1) @max_len(100)
}
```

### 数组元素验证器

```lua
local scores: {number @min(0) @max(100)} = {85, 90}
```

### 联合成员验证器

```lua
local id: number @min(1) | string @min_len(1) = 1
```

## 变型规则

| 位置 | 变型 | 说明 |
|----------|----------|-------------|
| 只读字段 | 协变 | 可使用子类型 |
| 可变字段 | 不变 | 必须精确匹配 |
| 函数参数 | 逆变 | 可使用超类型 |
| 函数返回 | 协变 | 可使用子类型 |

## 子类型化

- `integer` 是 `number` 的子类型
- `never` 是所有类型的子类型
- 所有类型都是 `any` 的子类型
- 联合子类型化：`A` 是 `A | B` 的子类型

## 渐进式采用

逐步添加类型——未类型化的代码继续工作：

```lua
-- 现有代码不变地工作
function old_function(x)
    return x + 1
end

-- 新代码获得类型
function new_function(x: number): number
    return x + 1
end
```

从向以下位置添加类型开始：
1. API 边界处的函数签名
2. HTTP 处理函数和队列消费者
3. 关键业务逻辑

## 类型检查

运行类型检查器：

```bash
wippy lint
```

报告类型错误而不执行代码。
