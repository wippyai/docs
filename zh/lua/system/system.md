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
|------|------|------|
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
|------|------|------|
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
|------|------|------|
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
|------|------|------|
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
|------|------|------|
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
|------|------|------|
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

## 工作目录

获取运行时的当前工作目录：

```lua
local dir, err = system.process.cwd()
```

**返回:** `string, error`

## 进程主机

列出所有进程主机及其 worker 和队列统计信息：

```lua
local hosts, err = system.hosts.list()
```

**返回:** `table[], error`

每个主机表包含：

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 主机注册表 ID |
| `workers` | number | Worker 池大小 |
| `processes` | number | 此主机上的活跃进程数 |
| `executed` | number | 已执行的总步数 |
| `stolen` | number | 从其他主机窃取的步数 |
| `queue_depth` | number | 主机队列中的待处理项数 |

列出特定主机上运行的进程：

```lua
local procs, err = system.hosts.processes("app:host")
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `host_id` | string | 主机注册表 ID |

**返回:** `table[], error`

每个进程表包含：

| 字段 | 类型 | 描述 |
|------|------|------|
| `pid` | string | 进程 ID |
| `host` | string | 主机 ID |
| `source` | string | 源条目 ID |
| `state` | string | 进程状态 |
| `steps` | number | 已执行步数 |
| `started_at` | number | 启动时间戳（纳秒） |
| `parent` | string | 父 PID（若无则省略） |
| `actor_id` | string | Actor ID（若无则省略） |
| `stats` | table | 进程特定统计（可选） |

## 服务状态

获取特定受监督服务的状态：

```lua
local state, err = system.supervisor.state("namespace:service")
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `service_id` | string | 服务 ID（例如 "namespace:service"） |

**返回:** `table, error`

状态表包含：

| 字段 | 类型 | 描述 |
|------|------|------|
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

## 集群原语

`system.node`、`system.cluster`、`system.raft` 和 `system.lock` 子表暴露集群层。[启用集群](guides/cluster.md)时最为有用；在独立节点上会优雅降级——`system.raft.*` 报告"raft not available"，`system.cluster` 仅报告本地节点，`system.lock` 需要集群提供的全局注册表。

所有读取调用都是本地且廉价的：报告此节点已提交状态的视图，从不阻塞网络。

### 节点标识

`system.node` 报告此节点在集群中的自身标识。

```lua
local id, err = system.node.id()      -- 此节点的 ID
local addr, err = system.node.addr()  -- 广播的网络地址
local role, err = system.node.role()  -- "leader" | "voter" | "standby" | "non-member"
```

| 函数 | 返回 | 说明 |
|------|------|------|
| `system.node.id()` | `string, error` | 来自中继上下文的节点 ID |
| `system.node.addr()` | `string, error` | 广播的地址（如 `10.0.0.1:7946`）；成员资格不可用时报错 |
| `system.node.role()` | `string, error` | 此节点的 Raft 角色；Raft 未运行时返回 `"non-member"`（无错误） |

**权限:** `node` 上的 `system.read`。

### 集群成员资格

`system.cluster` 报告集群范围的视图：成员组成和谁是 leader。

```lua
local members, err = system.cluster.members()  -- 节点表数组
local leader, err = system.cluster.leader()    -- leader 节点 ID，未知时为 ""
local n, err = system.cluster.size()           -- 可见成员数量
```

`system.cluster.members()` 返回节点表数组。本地节点包含一次并排在最前。

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 节点 ID |
| `is_local` | boolean | 调用节点为 true |
| `addr` | string | 广播的地址（未知时省略） |
| `meta` | table | 字符串到字符串的 gossip 元数据（无时省略） |

| 函数 | 返回 | 说明 |
|------|------|------|
| `system.cluster.members()` | `table[], error` | 无法访问成员资格信息时报错 |
| `system.cluster.leader()` | `string, error` | 当前 Raft leader 的 ID；leader 未知或 Raft 不存在时为 `""`（无错误） |
| `system.cluster.size()` | `number, error` | 可见成员数量；无成员资格信息时为 `0` |

**权限:** `cluster` 上的 `system.read`。

### Raft 状态

`system.raft` 读取此节点本地对 Raft 共识核心的视图。Raft 未在此节点运行时所有函数返回 `nil, error`（"raft not available"）。

```lua
local leader, err = system.raft.is_leader()      -- boolean
local member, err = system.raft.is_member()      -- boolean：选民或备用
local role, err = system.raft.role()             -- 与 system.node.role() 相同的值
local term, err = system.raft.term()             -- 当前 Raft 任期
local idx, err = system.raft.commit_index()      -- 最高已提交日志索引
local stats, err = system.raft.stats()           -- 原始统计映射（string -> string）
```

| 函数 | 返回 | 说明 |
|------|------|------|
| `system.raft.is_leader()` | `boolean, error` | 此节点为当前 leader 时为 true |
| `system.raft.is_member()` | `boolean, error` | 此节点在已提交配置中为选民或备用时为 true |
| `system.raft.role()` | `string, error` | `"leader"` / `"voter"` / `"standby"` / `"non-member"` |
| `system.raft.term()` | `number, error` | 当前任期；统计不可用时为 `0` |
| `system.raft.commit_index()` | `number, error` | 此节点上最高已提交日志索引 |
| `system.raft.stats()` | `table, error` | 完整原始统计映射；键和值均为字符串 |

**权限:** `raft` 上的 `system.read`，`system.raft.stats()` 需要 `raft_stats` 上的 `system.read`。

### 分布式锁

`system.lock` 提供集群范围的互斥锁。锁是调用进程拥有的全局唯一名称。基于 Strong 名称作用域构建，因此整个集群最多只能有一个持有者，且持有者进程退出或其节点离开时锁自动释放——不会产生卡死的锁需要清理。

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- 临界区：集群范围内只有一个持有者
  system.lock.release("orders.migration")
end
```

获取是非阻塞的：如果锁已被持有则立即返回 `false`，调用者自行实现重试和退避。只有当前持有者才能释放；释放未持有的锁是安全的空操作。

| 函数 | 返回 | 结果 |
|------|------|------|
| `system.lock.acquire(name)` | `boolean, error` | `true, nil` 已获取；`false, error` 已被持有（类型 `errors.ALREADY_EXISTS`）；`nil, error` 失败 |
| `system.lock.release(name)` | `boolean, error` | `true, nil` 已释放；`false, nil` 未持有或被其他进程持有；`nil, error` 失败 |

| 参数 | 类型 | 描述 |
|------|------|------|
| `name` | string | 集群范围的锁名称 |

**权限:** 锁 `name` 上的 `system.lock`（策略可限制调用方可锁定的名称）。

## 权限

系统操作受安全策略评估约束。

| 操作 | 资源 | 描述 |
|------|------|------|
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
| `system.read` | `cwd` | 读取工作目录 |
| `system.read` | `hosts` | 列出主机 / 主机进程 |
| `system.read` | `modules` | 列出已加载模块 |
| `system.read` | `supervisor` | 读取监督器状态 |
| `system.read` | `node` | 读取此节点的标识 |
| `system.read` | `cluster` | 读取集群成员资格和 leader |
| `system.read` | `raft` | 读取 Raft 状态 |
| `system.read` | `raft_stats` | 读取原始 Raft 统计映射 |
| `system.lock` | `<锁名称>` | 获取或释放分布式锁 |
| `system.exit` | - | 触发系统关闭 |

## 错误

| 条件 | 类型 | 可重试 |
|------|------|--------|
| 权限被拒绝 | `errors.INVALID` | 否 |
| 参数无效 | `errors.INVALID` | 否 |
| 缺少必需参数 | `errors.INVALID` | 否 |
| 代码管理器不可用 | `errors.INTERNAL` | 否 |
| 服务信息不可用 | `errors.INTERNAL` | 否 |
| 操作系统错误（hostname、cwd） | `errors.INTERNAL` | 否 |
| 此节点 Raft 未运行 | `errors.INTERNAL` | 否 |
| 成员资格不可用 | `errors.INTERNAL` | 否 |
| 锁已被持有 | `errors.ALREADY_EXISTS` | 否 |

错误处理参见[错误处理](lua/core/errors.md)。
