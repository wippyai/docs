# 请求上下文
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

访问请求作用域的上下文值。上下文通过 [Funcs](lua/core/funcs.md) 或 [Process](lua/core/process.md) 设置。

## 加载

```lua
local ctx = require("ctx")
```

## 上下文访问

### 获取值

```lua
local value, err = ctx.get("key")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 上下文键 |

**返回:** `any, error`

### 获取所有值

```lua
local values, err = ctx.all()
```

**返回:** `table, error`

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 空键 | `errors.INVALID` | 否 |
| 键未找到 | `errors.NOT_FOUND` | 否 |
| 无可用上下文 | `errors.INTERNAL` | 否 |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
