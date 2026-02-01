# 日志
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

支持 debug、info、warn 和 error 级别的结构化日志。

## 加载

```lua
local logger = require("logger")
```

## 日志级别

### Debug

```lua
logger:debug("message", {key = "value"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `message` | string | 日志消息 |
| `fields` | table? | 上下文键值对 |

### Info

```lua
logger:info("message", {key = "value"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `message` | string | 日志消息 |
| `fields` | table? | 上下文键值对 |

### Warn

```lua
logger:warn("message", {key = "value"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `message` | string | 日志消息 |
| `fields` | table? | 上下文键值对 |

### Error

```lua
logger:error("message", {key = "value"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `message` | string | 日志消息 |
| `fields` | table? | 上下文键值对 |

## 日志器自定义

### 附加字段

创建带持久字段的子日志器。

```lua
local child = logger:with({request_id = id})
child:info("message")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `fields` | table | 附加到所有日志的字段 |

**返回:** `Logger`

### 命名日志器

创建命名的子日志器。

```lua
local named = logger:named("auth")
named:info("message")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 日志器名称 |

**返回:** `Logger`

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 名称字符串为空 | `errors.INVALID` | 否 |

错误处理请参阅 [错误处理](lua/core/errors.md)。
