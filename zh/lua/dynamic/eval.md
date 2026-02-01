# 动态求值

在运行时动态执行代码，具有沙盒环境和受控模块访问。

## 两个系统

Wippy 提供两个求值系统：

| 系统 | 用途 | 使用场景 |
|--------|---------|----------|
| `expr` | 表达式求值 | 配置、模板、简单计算 |
| `eval_runner` | 完整 Lua 执行 | 插件、用户脚本、动态代码 |

## expr 模块

使用 expr-lang 语法的轻量级表达式求值。

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
-- result = 20
```

### 编译表达式

编译一次，多次运行：

```lua
local program, err = expr.compile("price * quantity")

local total1 = program:run({price = 10, quantity = 5})
local total2 = program:run({price = 20, quantity = 3})
```

### 支持的语法

```lua
-- 算术
expr.eval("1 + 2 * 3")           -- 7
expr.eval("10 / 2 - 1")          -- 4
expr.eval("10 % 3")              -- 1

-- 比较
expr.eval("x > 5", {x = 10})     -- true
expr.eval("x == y", {x = 1, y = 1}) -- true

-- 布尔
expr.eval("a && b", {a = true, b = false})  -- false
expr.eval("a || b", {a = true, b = false})  -- true
expr.eval("!a", {a = false})     -- true

-- 三元
expr.eval("x > 0 ? 'positive' : 'negative'", {x = 5})

-- 函数
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(1, 5, 3)")        -- 1
expr.eval("len([1, 2, 3])")      -- 3

-- 数组
expr.eval("[1, 2, 3][0]")        -- 1

-- 字符串连接
expr.eval("'hello' + ' ' + 'world'")
```

## eval_runner 模块

具有安全控制的完整 Lua 执行。

```lua
local runner = require("eval_runner")

local result, err = runner.run({
    source = [[
        local function double(x)
            return x * 2
        end
        return double(input)
    ]],
    args = {21}
})
-- result = 42
```

### 配置

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `source` | string | Lua 源代码（必需） |
| `method` | string | 在返回表中调用的函数 |
| `args` | any[] | 传递给函数的参数 |
| `modules` | string[] | 允许的内置模块 |
| `imports` | table | 要导入的注册表条目 |
| `context` | table | 作为 `ctx` 可用的值 |
| `allow_classes` | string[] | 附加模块类 |
| `custom_modules` | table | 作为模块的自定义表 |

### 模块访问

白名单允许的模块：

```lua
runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
```

不在列表中的模块无法被 require。

### 注册表导入

从注册表导入条目：

```lua
runner.run({
    source = [[
        local utils = require("utils")
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
```

### 自定义模块

注入自定义表：

```lua
runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0", api_key = "xxx"}
    }
})
```

### 上下文值

传递可作为 `ctx` 访问的数据：

```lua
runner.run({
    source = [[
        return "Hello, " .. ctx.user
    ]],
    context = {user = "Alice"}
})
```

### 编译程序

编译一次用于重复执行：

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})

local result = program:run({10})  -- 20
```

## 安全模型

### 模块类

模块按能力分类：

| 类 | 描述 | 默认 |
|-------|-------------|---------|
| `deterministic` | 纯函数 | 允许 |
| `encoding` | 数据编码 | 允许 |
| `time` | 时间操作 | 允许 |
| `nondeterministic` | 随机等 | 允许 |
| `process` | 进程、注册表 | 阻止 |
| `storage` | 文件、数据库 | 阻止 |
| `network` | HTTP、套接字 | 阻止 |

### 启用阻止的类

```lua
runner.run({
    source = [[
        local http = require("http_client")
        return http.get("https://api.example.com")
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
```

### 权限检查

系统检查以下权限：

- `eval.compile` - 编译前
- `eval.run` - 执行前
- `eval.module` - 白名单中的每个模块
- `eval.import` - 每个注册表导入
- `eval.class` - 每个允许的类

在安全策略中配置。

## 错误处理

```lua
local result, err = runner.run({...})
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- 安全策略拒绝访问
    elseif err:kind() == errors.INVALID then
        -- 无效的源或配置
    elseif err:kind() == errors.INTERNAL then
        -- 执行或编译错误
    end
end
```

## 使用场景

### 插件系统

```lua
local plugins = registry.find({meta = {type = "plugin"}})

for _, plugin in ipairs(plugins) do
    local source = plugin:data().source
    runner.run({
        source = source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
end
```

### 模板求值

```lua
local template = "Hello, {{name}}! You have {{count}} messages."
local compiled = expr.compile("name")

-- 快速重复求值
for _, user in ipairs(users) do
    local greeting = compiled:run({name = user.name})
end
```

### 用户脚本

```lua
local user_code = request:body()

local result, err = runner.run({
    source = user_code,
    modules = {"json", "text"},  -- 仅安全模块
    context = {data = input_data}
})
```

## 参见

- [表达式](lua/dynamic/expression.md) - 表达式语言参考
- [Exec](lua/dynamic/exec.md) - 系统命令执行
- [安全](lua/security/security.md) - 安全策略
