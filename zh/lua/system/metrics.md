# 指标与遥测
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

使用计数器、仪表和直方图记录应用程序指标。

## 加载

```lua
local metrics = require("metrics")
```

## 计数器

### 递增计数器

```lua
metrics.counter_inc("requests_total", {method = "POST"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 指标名称 |
| `labels` | table? | 标签键值对 |

**返回:** `boolean, error`

### 增加计数器值

```lua
metrics.counter_add("bytes_total", 1024, {direction = "out"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 指标名称 |
| `value` | number | 要增加的值 |
| `labels` | table? | 标签键值对 |

**返回:** `boolean, error`

## 仪表

### 设置仪表值

```lua
metrics.gauge_set("queue_depth", 42, {queue = "emails"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 指标名称 |
| `value` | number | 当前值 |
| `labels` | table? | 标签键值对 |

**返回:** `boolean, error`

### 递增仪表

```lua
metrics.gauge_inc("connections", {pool = "db"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 指标名称 |
| `labels` | table? | 标签键值对 |

**返回:** `boolean, error`

### 递减仪表

```lua
metrics.gauge_dec("connections", {pool = "db"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 指标名称 |
| `labels` | table? | 标签键值对 |

**返回:** `boolean, error`

## 直方图

### 记录观测值

```lua
metrics.histogram("duration_seconds", 0.123, {method = "GET"})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 指标名称 |
| `value` | number | 观测值 |
| `labels` | table? | 标签键值对 |

**返回:** `boolean, error`

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 收集器不可用 | `errors.INTERNAL` | 否 |

错误处理请参阅 [错误处理](lua/core/errors.md)。
