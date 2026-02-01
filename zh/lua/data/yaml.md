# YAML 编码
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

将 YAML 文档解析为 Lua 表，并将 Lua 值序列化为 YAML 字符串。

## 加载

```lua
local yaml = require("yaml")
```

## 编码

### 编码值

将 Lua 表编码为 YAML 格式。

```lua
-- Simple key-value
local config = {
    name = "myapp",
    port = 8080,
    debug = true
}
local out = yaml.encode(config)
-- name: myapp
-- port: 8080
-- debug: true

-- Arrays become YAML lists
local items = {"apple", "banana", "cherry"}
yaml.encode(items)
-- - apple
-- - banana
-- - cherry

-- Nested structures
local server = {
    http = {
        address = ":8080",
        timeout = "30s"
    },
    database = {
        host = "localhost",
        port = 5432
    }
}
yaml.encode(server)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | table | 要编码的 Lua 表 |
| `options` | table? | 可选的编码选项 |

#### 选项

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `field_order` | string[] | 自定义字段顺序 - 字段按此顺序出现 |
| `sort_unordered` | boolean | 将不在 `field_order` 中的字段按字母排序 |

```lua
-- Control field order in output
local entry = {
    zebra = 1,
    alpha = 2,
    name = "test",
    kind = "demo"
}

-- Fields appear in specified order, remaining sorted alphabetically
local result = yaml.encode(entry, {
    field_order = {"name", "kind"},
    sort_unordered = true
})
-- name: test
-- kind: demo
-- alpha: 2
-- zebra: 1

-- Just sort all fields alphabetically
yaml.encode(entry, {sort_unordered = true})
-- alpha: 2
-- kind: demo
-- name: test
-- zebra: 1
```

**返回:** `string, error`

## 解码

### 解码字符串

将 YAML 字符串解析为 Lua 表。

```lua
-- Parse configuration
local config, err = yaml.decode([[
server:
  host: localhost
  port: 8080
features:
  - auth
  - logging
  - metrics
]])
if err then
    return nil, err
end

print(config.server.host)     -- "localhost"
print(config.server.port)     -- 8080
print(config.features[1])     -- "auth"

-- Parse from file content
local content = fs.read("config.yaml")
local settings, err = yaml.decode(content)
if err then
    return nil, errors.wrap(err, "invalid config file")
end

-- Handle mixed types
local data = yaml.decode([[
name: test
count: 42
ratio: 3.14
enabled: true
tags:
  - lua
  - wippy
]])
print(type(data.count))    -- "number"
print(type(data.enabled))  -- "boolean"
print(type(data.tags))     -- "table"
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要解析的 YAML 字符串 |

**返回:** `any, error` - 根据 YAML 内容返回表、数组、字符串、数字或布尔值

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 输入不是表（编码） | `errors.INVALID` | 否 |
| 输入不是字符串（解码） | `errors.INVALID` | 否 |
| 空字符串（解码） | `errors.INVALID` | 否 |
| 无效的 YAML 语法 | `errors.INTERNAL` | 否 |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
