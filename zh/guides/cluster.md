# 集群

Wippy 默认以单节点运行。启用集群后，一组节点将成为一个协调系统，在有界 Raft 共识核心之上共享成员资格、集群范围的进程名称、分布式锁和进程组消息传递。

将 `cluster.enabled: true` 设置之前，集群功能处于关闭状态。以下所有内容在单节点上均不生效。

## 集群能力

- **成员资格** — 每个节点通过 gossip 了解存活的对等节点集合，并具备快速故障检测能力。
- **集群范围的进程名称** — 以名称注册进程，可从任意节点解析，并可选择一致性保障级别（参见[命名](#命名与名称作用域)）。
- **分布式锁** — `system.lock` 提供集群范围的互斥访问，持有者进程退出时自动释放（参见[分布式锁](#分布式锁)）。
- **进程组** — 向所有节点上某个命名组的所有成员广播消息（参见[进程组](#进程组)）。
- **复制键值存储** — `store.kv.raft`（强）和 `store.kv.crdt`（最终）在节点间复制 KV 数据（参见 [Store](system/store.md#cluster-kv-stores)）。
- **共识核心** — 一个小型有界 Raft 集群为命名和锁原语提供线性化基础。

## 架构：有界 Raft

将每个节点都设为 Raft 对等节点扩展性较差：leader 需要将每条日志条目复制给每个对等节点，因此空闲 leader 的开销随集群规模线性增长。Wippy 将 Raft 限定在固定大小的核心中，让集群其余节点通过 gossip 参与。每个节点在 Raft 配置中占据以下三种角色之一：

| 角色 | 数量（默认） | 在 Raft 配置中 | 接收日志复制 | 参与投票 |
|------|------------|--------------|------------|--------|
| **选民（Voter）** | 最多 5 个（`max_voters`，奇数） | 是 | 是 | 是 |
| **备用（Standby）** | 最多 4 个（`max_standbys`） | 是 | 是 | 否 |
| **客户端（Client）** | 无限制 | 否 | 否 | 否 |

- **选民** 构成 quorum。写入在大多数选民确认后提交。选民数量始终为奇数，以确保多数定义明确。
- **备用节点** 是完全复制并保持热备状态的非投票成员。当选民离开时，leader 将排名最高的备用节点晋升到空缺的选民槽，从而无需等待新节点追赶即可恢复 quorum。
- **客户端** 是 `voters + standbys` 以外的所有节点。它们完全不在 Raft 配置中，因此 leader 永远不会向它们发送日志条目。它们参与 gossip 并将写入路由到 Raft 成员。这使空闲 leader 的 CPU 消耗无论集群规模多大都保持在 O(1)。

由于备用节点和客户端可以承载集群其余部分，即使数百节点的集群仍然只有一个 5 选民的共识核心。`max_voters`/`max_standbys` 上限正是使该设计"有界"的关键。

### 选民选取

leader 运行一个协调器，在每次成员变更时（由 `raft.reconcile_debounce` 防抖，默认 2s），重新计算哪些节点应为选民，并应用最小的晋升/降级操作集合。选取过程是确定性的——每个节点从相同的 gossip 视图中推导出相同的排序——由三个 gossip 广播的提示驱动：

- `raft.eligible` — `eligible: false` 的节点永远不会被选为选民（适用于希望保持为客户端或备用的节点）。
- `raft.priority` — 填充选民槽时值越低越优先；相同时按节点 ID 排序。
- `failure_domain` — 选民优先分布在不同域（可用区/机架）上，使单个域的故障不会影响选民多数。

操作按保护 quorum 的顺序执行：先添加和晋升，再降级，最后移除。

## 成员资格与 gossip

成员资格使用 SWIM gossip（HashiCorp memberlist）。每个节点绑定一个 gossip 端口（默认 **7946**），并持续与对等节点交换小消息，以检测故障并传播元数据。

节点通过指向一个或多个已有节点来加入：

```yaml
cluster:
  enabled: true
  name: node-2
  membership:
    join_addrs: "node-1:7946"
```

第一个节点无需 `join_addrs`——它作为种子启动。加入操作带退避重试，处于隔离状态的节点会定期尝试重新加入，因此以新 IP 重启的节点（Kubernetes 中常见）可快速重新收敛。

Gossip 可通过共享密钥加密，密钥可内联提供或从文件读取：

```yaml
cluster:
  membership:
    secret_file: /etc/wippy/cluster.key
```

成员变更事件（`NodeJoined`、`NodeLeft`、`NodeUpdated`）驱动 Raft 引导、选民协调、进程组同步，以及离开节点所拥有名称的自动清理。

## 引导

初始集群通过 gossip 形成，而非静态对等列表。这遵循 Consul/Nomad 的 `bootstrap_expect` 模式：每个启动节点声明期望的节点数量，等到所有节点彼此可见后再共同组成 quorum。

| `bootstrap_expect` | 行为 |
|--------------------|------|
| `0` | 从不自举；只加入已存在的集群 |
| `1` | 单节点；立即以自身为唯一选民完成引导 |
| `N` | 等待 N 个合格对等节点在 gossip 中稳定可见，之后所有节点推导出相同的选民列表并组成 quorum |

对于 N 节点引导，在每个初始节点上设置相同的 `bootstrap_expect: N`。每个节点在 gossip 中广播"预引导"状态；一旦恰好 N 个此类对等节点在短暂的稳定窗口内可见，每个节点独立计算出相同的有序选民集合并组建集群。稳定窗口防止短暂的局部视图过早触发引导。

之后启动的节点会看到已组建的集群，直接跳过引导——leader 的协调器会将其添加为选民或备用节点。

## Raft 共识核心

Raft 状态**默认持久化到文件系统**：日志和快照保存在 `cluster.raft.data_dir` 下（默认 `~/.wippy/store`，位于 `_sys/raft`），且 [`store.kv.raft`](system/store.md#cluster-kv-stores) 通过同一核心复制。重启的节点仍会重新加入 gossip 并从对等节点追赶状态，因此集群也能容忍单个节点磁盘丢失；持久性同时来自活跃 quorum 和磁盘状态。只有在无法解析出数据目录时（既未配置路径又无 home 目录），节点才以无磁盘方式运行——参见[恢复](#恢复与故障模式)。

Raft 不会开放独立的监听端口。它通过**节点间网格**传输——即节点间中继流量使用的相同 TCP 连接，通过 yamux 多路复用。节点间端口在启动时自动选定（范围 7950-7959，之后为临时端口），固定后通过 gossip 广播，使对等节点可以访问。通常只需暴露 gossip 端口。

Raft FSM 保存全局名称注册表：活跃的 `name -> PID` 绑定以及进行中的强预留。这是下述命名原语读写的内容。

## 命名与名称作用域

进程可以注册名称，并通过名称而非原始 PID 来访问。关键决策是**作用域**，它决定一致性保障。有四种作用域，从最廉价/最弱到最强：

| 作用域 | 依托 | 可见性 | 保障 |
|--------|------|--------|------|
| **Local（本地）** | 每节点映射 | 仅此节点 | 即时，节点本地；无需协调 |
| **Eventual（最终一致）** | gossip CRDT | 集群范围 | 最终一致；经过 gossip 轮次后收敛 |
| **Consistent（一致）** | Raft | 集群范围 | 线性化写入；集群内唯一单例 |
| **Strong（强一致）** | Raft + 全节点确认 | 集群范围 | 一致，且所有存活节点确认后名称才生效 |

如何选择：

- **Local** — 仅在单节点上有意义的名称（每节点辅助进程）。进程退出时立即释放。零代价。
- **Eventual** — 允许短暂过期窗口的集群范围服务、组和在线状态名称。绑定集合会完整复制到每个节点，因此适用于有限的命名空间，而非为每个高基数实体（如每会话进程）分配一个名称（这类请直接通过 PID 寻址）。当两个源注册同一名称时，冲突解决机制选取胜者，落败进程收到取消事件（`process.event.CANCEL`），原因为 `name revoked: <name>`；它继续运行并可重新注册。节点离开时释放名称。
- **Consistent** — 集群范围命名单例的标准选择。先写优先：同一名称向不同 PID 的第二次注册会失败并返回"already exists"，同时返回当前所有者。写入需要 quorum，因此在少数分区中会阻塞。读取来自本地 Raft 副本，可能落后写入几毫秒。
- **Strong** — 用于哪怕短暂的过期读取都危险的少数控制平面单例。在 Consistent 保障之上，注册操作会开启一个预留，所有存活节点必须确认后名称才生效；任何已持有冲突绑定的节点会立即拒绝。如果超时前并非所有节点都确认，注册过期并报告缺失节点。这是[分布式锁](#分布式锁)的基础。

名称自动释放：Local 在进程退出时释放；Consistent 和 Strong 在进程退出（通过拓扑监控）及节点离开时释放；Eventual 在节点离开时释放。消息传递（`process.send`、`process.terminate` 等）的名称解析按顺序查询各层——Consistent，然后 Eventual，然后 Local——因此相同字符串的 Consistent 名称会遮蔽 Eventual 名称。

命名的 Lua 接口位于 `process.registry`（带作用域的注册/查找/注销）——参见[进程](lua/core/process.md)参考。

## 进程组

进程组是以 Erlang `pg` 为模型的集群感知发布/订阅与成员资格机制。进程加入命名组；向该组的广播经由节点间网格以尽力而为（best-effort）方式送达所有节点上的组成员。组具有最终一致性且独立于 Raft——通过 gossip 的成员资格视图选择接收方——因此即使共识核心正在收敛时也能正常工作。

典型操作：加入/离开组、向所有成员（或仅本地成员）广播、列出成员，以及监控组的加入/离开事件。新节点加入时，组通过直接同步握手协调成员资格，后台反熵循环随时间修复任何分歧。

参见[进程组](lua/core/pg.md)了解 Lua API，参见 [`pg.scope` 入口类型](system/process-groups.md)了解配置。

## 分布式锁

`system.lock` 是直接基于 Strong 名称作用域构建的集群范围互斥锁。获取锁会以 Strong 作用域注册其名称，归调用进程所有；释放时注销该名称。由于 Strong 要求所有存活节点确认，整个集群最多只能有一个持有者。

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- 临界区：集群范围内只有一个持有者
  system.lock.release("orders.migration")
end
```

获取是非阻塞的（立即失败）：如果锁已被持有则立即返回，调用者需自行实现重试/退避。锁在持有者进程退出或其节点离开时自动释放，无需手动清理。参见[系统](lua/system/system.md)参考了解确切的函数签名。

## 配置

完整的逐键参考在[配置](guides/configuration.md#集群)中。最简配置：

单节点（开发环境）：

```yaml
cluster:
  enabled: true
  name: dev
  raft:
    bootstrap_expect: 1
```

三节点投票集群：

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  raft:
    bootstrap_expect: 3
```

仅 gossip 客户端（加入集群用于命名/消息传递，从不运行 Raft）：

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  raft:
    role: client
```

## 端口

| 用途 | 端口 | 协议 | 配置键 |
|------|------|------|--------|
| Gossip（成员资格） | 7946 | TCP + UDP | `cluster.membership.bind_port` |
| 节点间网格（中继 + Raft） | 自动 | TCP | `cluster.internode.bind_port` |

没有独立的 Raft 端口——Raft 通过节点间网格多路复用。节点间端口自动分配并通过 gossip 广播，因此只有 gossip 端口需要可预测地暴露。

## 可观测性

集群健康状况通过标准 [Prometheus 端点](guides/observability.md)和存活健康检查暴露。

需要关注的关键指标：

| 指标 | 含义 |
|------|------|
| `raft_state` | 0 = 追随者，1 = 候选人，2 = leader |
| `raft_term` | 当前 Raft 任期；快速增长表明选举频繁 |
| `raft_voters` / `raft_non_voters` | 配置中的存活选民和备用节点 |
| `raft_leader_changes_total` | leader 切换次数；健康集群应接近平稳 |
| `raft_voter_churn_burst_total` | 选民添加/移除操作的突发次数；持续搅动是危险信号 |
| `gossip_members{state}` | 按状态（alive/suspect/dead/left）统计的节点数 |
| `gossip_convergence_seconds` | gossip 事件间隔时间 |

内置存活检查（连接到存活端点）：

- **gossip** — 节点的 gossip 健康分数保持较低时为健康，并有启动宽限窗口，避免重新加入的节点被过早杀死。
- **raft 最后联系** — 投票追随者若长时间未收到 leader 消息则失败；备用节点容忍更长的间隔；leader 始终通过。
- **进程组广播** — 若组在较长时间内未见到广播流量则失败，可捕获事件循环卡死或持续分区。

## 恢复与故障模式

Raft 状态会持久化到文件系统，但集群的主要持久性仍来自活跃 quorum。实践规则：

- 保持选民多数存活。5 个选民可容忍 2 个同时故障；备用节点晋升以填补空缺。低于多数时，写入（新的 Consistent/Strong 注册和锁获取）会阻塞直到 quorum 恢复。已有名称和查找继续从本地副本提供服务。
- leader 主动驱逐心跳静默且 gossip 已死亡的选民，使已死亡的选民不会在备用节点晋升时永久阻塞 quorum。
- 要恢复失去 quorum 的集群，重启故障节点即可。它们重新加入 gossip，存活成员将其重新折叠进来。将选民分布在 `failure_domain` 上是防止单个可用区故障导致 quorum 丢失的关键。

## 另请参阅

- [配置](guides/configuration.md#集群) — 所有集群配置键
- [进程](lua/core/process.md) — 按名称注册和解析进程
- [系统](lua/system/system.md) — `system.cluster`、`system.raft`、`system.node`、`system.lock`
- [可观测性](guides/observability.md) — 指标和健康端点
- [进程模型](concepts/process-model.md) — actor、PID 和消息传递
