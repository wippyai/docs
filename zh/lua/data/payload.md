# Payload 编码
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

在 JSON、MessagePack 和二进制等格式之间转换数据。处理类型化负载用于服务间通信和工作流数据传递。

## 加载

全局命名空间。无需 require。

```lua
payload.new(...)  -- direct access
```

## 格式常量

负载类型的格式标识符：

```lua
payload.format.JSON     -- "json/plain"
payload.format.YAML     -- "yaml/plain"
payload.format.STRING   -- "text/plain"
payload.format.BYTES    -- "application/octet-stream"
payload.format.MSGPACK  -- "application/msgpack"
payload.format.LUA      -- "lua/any"
payload.format.GOLANG   -- "golang/any"
payload.format.ERROR    -- "golang/error"
```

## 创建 Payload

从 Lua 值创建新的 payload：

```lua
-- From table
local p = payload.new({
    user_id = 123,
    name = "Alice",
    roles = {"admin", "user"}
})

-- From string
local str_p = payload.new("Hello, World!")

-- From number
local num_p = payload.new(42.5)

-- From boolean
local bool_p = payload.new(true)

-- From nil
local nil_p = payload.new(nil)

-- From error
local err_p = payload.new(errors.new("something failed"))
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `value` | any | Lua 值（字符串、数字、布尔值、表、nil 或 error） |

**返回:** `Payload, nil`

## 获取格式

获取 payload 格式：

```lua
local p = payload.new({name = "test"})
local format = p:get_format()  -- "lua/any"

local str_p = payload.new("hello")
local format2 = str_p:get_format()  -- "lua/any"

local err_p = payload.new(errors.new("failed"))
local format3 = err_p:get_format()  -- "golang/error"
```

**返回:** `string, nil` - `payload.format.*` 常量之一

## 提取数据

从 payload 中提取 Lua 值（如需要则进行转码）：

```lua
local p = payload.new({
    items = {1, 2, 3},
    total = 100
})

local data, err = p:data()
if err then
    return nil, err
end

print(data.total)        -- 100
print(data.items[1])     -- 1
```

**返回:** `any, error`

## 转码 Payload

将 payload 转码为不同格式：

```lua
local p = payload.new({
    name = "test",
    value = 123
})

-- Convert to JSON
local json_p, err = p:transcode(payload.format.JSON)
if err then
    return nil, err
end
print(json_p:get_format())  -- "json/plain"

-- Convert to MessagePack (compact binary)
local msgpack_p, err = p:transcode(payload.format.MSGPACK)
if err then
    return nil, err
end

-- Convert to YAML
local yaml_p, err = p:transcode(payload.format.YAML)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `format` | string | 来自 `payload.format.*` 的目标格式 |

**返回:** `Payload, error`

## 异步结果

Payload 通常从异步函数调用中接收：

```lua
local funcs = require("funcs")

local future, err = funcs.async("app.process:compute", input_data)
if err then
    return nil, err
end

-- Wait for result
local ch = future:response()
local result_payload, ok = ch:receive()
if not ok then
    return nil, errors.new("channel closed")
end

-- Extract data from payload
local result, err = result_payload:data()
if err then
    return nil, err
end

print(result.computed_value)
```

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 转码失败 | `errors.INTERNAL` | 否 |
| 结果不是有效的 Lua 值 | `errors.INTERNAL` | 否 |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
