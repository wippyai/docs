# 系统
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

查询运行时系统信息，包括内存使用、垃圾回收统计、CPU 详情和进程元数据。

## 加载

```lua
local system = require("system")
```

## 关闭

使用退出码触发系统关闭。适用于终端应用；从运行中的 actor 调用将终止整个系统：

```lua
local ok, err = system.exit(0)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `code` | integer | 退出码（0 = 成功），默认为 0 |

**返回:** `boolean, error`

## 列出模块

获取所有已加载的 Lua 模块及其元数据：

```lua
local mods, err = system.modules()
```

**返回:** `table[], error`

每个模块表包含：

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `name` | string | 模块名称 |
| `description` | string | 模块描述 |
| `class` | string[] | 模块分类标签 |

## 内存统计

获取详细的内存统计信息：

```lua
local stats, err = system.memory.stats()
```

**返回:** `table, error`

统计表包含：

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `alloc` | number | 已分配并正在使用的字节数 |
| `total_alloc` | number | 累计分配的字节数 |
| `sys` | number | 从系统获取的字节数 |
| `heap_alloc` | number | 堆上分配的字节数 |
| `heap_sys` | number | 从系统获取的堆字节数 |
| `heap_idle` | number | 空闲 span 中的字节数 |
| `heap_in_use` | number | 非空闲 span 中的字节数 |
| `heap_released` | number | 释放给操作系统的字节数 |
| `heap_objects` | number | 已分配的堆对象数 |
| `stack_in_use` | number | 栈分配器使用的字节数 |
| `stack_sys` | number | 从系统获取的栈字节数 |
| `mspan_in_use` | number | 正在使用的 mspan 结构字节数 |
| `mspan_sys` | number | 从系统获取的 mspan 字节数 |
| `num_gc` | number | 已完成的 GC 周期数 |
| `next_gc` | number | 下次 GC 的目标堆大小 |

## 当前分配

获取当前分配的字节数：

```lua
local bytes, err = system.memory.allocated()
```

**返回:** `number, error`

## 堆对象

获取已分配的堆对象数：

```lua
local count, err = system.memory.heap_objects()
```

**返回:** `number, error`

## 内存限制

设置内存限制（返回之前的值）：

```lua
local prev, err = system.memory.set_limit(1024 * 1024 * 100)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `limit` | integer | 内存限制（字节），-1 表示无限制 |

**返回:** `number, error`

获取当前内存限制：

```lua
local limit, err = system.memory.get_limit()
```

**返回:** `number, error`

## 强制 GC

强制执行垃圾回收：

```lua
local ok, err = system.gc.collect()
```

**返回:** `boolean, error`

## GC 目标百分比

设置 GC 目标百分比（返回之前的值）。值为 100 表示堆翻倍时触发 GC：

```lua
local prev, err = system.gc.set_percent(200)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `percent` | integer | GC 目标百分比 |

**返回:** `number, error`

获取当前 GC 目标百分比：

```lua
local percent, err = system.gc.get_percent()
```

**返回:** `number, error`

## Goroutine 数量

获取活跃的 goroutine 数量：

```lua
local count, err = system.runtime.goroutines()
```

**返回:** `number, error`

## GOMAXPROCS

获取或设置 GOMAXPROCS 值：

```lua
-- 获取当前值
local current, err = system.runtime.max_procs()

-- 设置新值
local prev, err = system.runtime.max_procs(4)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `n` | integer | 如果提供，设置 GOMAXPROCS（必须 > 0） |

**返回:** `number, error`

## CPU 数量

获取逻辑 CPU 数量：

```lua
local cpus, err = system.runtime.cpu_count()
```

**返回:** `number, error`

## 进程 ID

获取当前进程 ID：

```lua
local pid, err = system.process.pid()
```

**返回:** `number, error`

## 主机名

获取系统主机名：

```lua
local hostname, err = system.process.hostname()
```

**返回:** `string, error`

## 服务状态

获取特定受监督服务的状态：

```lua
local state, err = system.supervisor.state("namespace:service")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `service_id` | string | 服务 ID（例如 "namespace:service"） |

**返回:** `table, error`

状态表包含：

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `id` | string | 服务 ID |
| `status` | string | 当前状态 |
| `desired` | string | 期望状态 |
| `retry_count` | number | 重试次数 |
| `last_update` | number | 最后更新时间戳（纳秒） |
| `started_at` | number | 启动时间戳（纳秒） |
| `details` | string | 可选详情（已格式化） |

## 所有服务状态

获取所有受监督服务的状态：

```lua
local states, err = system.supervisor.states()
```

**返回:** `table[], error`

每个状态表的格式与 `system.supervisor.state()` 相同。

## 权限

系统操作受安全策略评估约束。

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `system.read` | `memory` | 读取内存统计 |
| `system.read` | `memory_limit` | 读取内存限制 |
| `system.control` | `memory_limit` | 设置内存限制 |
| `system.read` | `gc_percent` | 读取 GC 百分比 |
| `system.gc` | `gc` | 强制垃圾回收 |
| `system.gc` | `gc_percent` | 设置 GC 百分比 |
| `system.read` | `goroutines` | 读取 goroutine 数量 |
| `system.read` | `gomaxprocs` | 读取 GOMAXPROCS |
| `system.control` | `gomaxprocs` | 设置 GOMAXPROCS |
| `system.read` | `cpu` | 读取 CPU 数量 |
| `system.read` | `pid` | 读取进程 ID |
| `system.read` | `hostname` | 读取主机名 |
| `system.read` | `modules` | 列出已加载模块 |
| `system.read` | `supervisor` | 读取监督器状态 |
| `system.exit` | - | 触发系统关闭 |

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 权限被拒绝 | `errors.PERMISSION_DENIED` | 否 |
| 参数无效 | `errors.INVALID` | 否 |
| 缺少必需参数 | `errors.INVALID` | 否 |
| 代码管理器不可用 | `errors.INTERNAL` | 否 |
| 服务信息不可用 | `errors.INTERNAL` | 否 |
| 获取主机名时操作系统错误 | `errors.INTERNAL` | 否 |

错误处理请参阅 [错误处理](lua/core/errors.md)。
