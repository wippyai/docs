---
title: "构建组件"
description: "编写可复用模块：使用 ns.requirement 声明需求接口，以及宿主如何通过依赖参数提供值。"
---

# 构建组件

**组件**是可复用的 Wippy 模块 — 发布到 hub 并挂载到宿主应用中的一片功能。组件面临的难题是它无法直接指名它所依赖的东西：它需要*某个*数据库、*某个*进程宿主、*某个*路由器，但它不知道宿主会给它哪些。Wippy 用**需求接口**解决这个问题 — 组件声明洞，宿主来填。

本指南讲作者一侧：声明该接口，并理解值如何流入你的条目。消费者一侧（锁文件、版本约束、`wippy add`/`update`）参见[依赖管理](guides/dependency-management.md)。组件内部如何组织参见[应用架构](concepts/architecture.md)。

## 三种类型

| 类型 | 侧 | 角色 |
|------|------|------|
| `ns.definition` | 组件 | 模块元数据；发布所必需。 |
| `ns.requirement` | 组件 | 宿主必须填充的洞，以及值注入到哪里。 |
| `ns.dependency` | 宿主 | 挂载组件并为其需求提供值。 |

## ns.definition

每个模块一个，发布所必需。它只承载模块的显示名称和 README 路径 — 仅此而已。

```yaml
- name: definition
  kind: ns.definition
  module: jobs                # optional; defaults to the entry name
  readme: file://README.md    # path to the module's documentation
  meta:
    title: Durable Jobs
    description: Leased job queue with retry and dead-lettering.
```

只有 `module` 和 `readme` 是组件数据；`meta` 是供管理界面使用的普通条目元数据。发行说明在发布时提供，而不是在这里。

## ns.requirement

需求是一个**带有注入目标列表的具名洞**。宿主提供一个值；运行时将该值写入每个目标条目的给定路径处。

```yaml
- name: target_db
  kind: ns.requirement
  meta:
    description: SQL database backing every table in this module.
  default: app:db
  targets:
    - entry: app.jobs.migrations:schema
      path: .meta.target_db
    - entry: app.jobs.persist:lifecycle
      path: .db
```

### default — 必填与可选

`default` 字段决定宿主是否*必须*提供值：

- **存在 `default`**（任何值，包括空字符串）→ 该需求是**可选的**。宿主未提供时使用默认值。
- **没有 `default`** → 该需求是**必填的**。什么都没提供时，严格模式下链接失败（否则给出警告）。

<note>
显式的空默认值（<code>default: ""</code>）与完全没有默认值是不同的。空字符串意味着“可选，回退为空”；缺失意味着“宿主必须提供”。对于在应用内有合理惯例的基础设施（<code>app:db</code>、<code>app:processes</code>）使用默认值；对于只有宿主才知道的值则省略它。
</note>

### targets — 值落在哪里

每个目标都是一个 `{entry, path}` 对：

- **`entry`** — 值被注入的条目。裸名称（`schema`）在需求自身的命名空间内解析；完全限定的 id（`app.jobs.migrations:schema`）跨命名空间精确指向该条目。
- **`path`** — 指向目标条目内部的点路径，例如 `.meta.target_db`、`.host`、`.database.url`。前导点是惯例。

没有目标的需求是错误 — 一个哪里都不注入的洞毫无意义。

在路径上使用 `+=` 后缀可以追加而不是设置 — 当多个需求向同一个列表贡献值时（例如中间件）很有用：

```yaml
targets:
  - entry: app.api:router
    path: .middleware+=     # appends the value to the list at .middleware
```

### 一个需求，多个目标

把需要同一个值的所有东西归到一个需求之下。这是惯用模式：一个 `target_db` 需求注入每个迁移的 `.meta.target_db` 和每个持久化库的 `.db`，一个 `process_host` 注入每个受监督 `service` 的 `.host`，一个 `api_router` 注入每个端点的 `.meta.router`：

```yaml
- name: process_host
  kind: ns.requirement
  default: app:processes
  targets:
    - { entry: app.jobs.service:worker.service, path: .host }
    - { entry: app.jobs.service:sweeper.service, path: .host }
```

宿主填一个洞；运行时把值扇出到每个目标。没有任何东西会镜像到一个平行的配置条目中 — 需求条目本身*就是*接线。

## 消费组件

宿主用 `ns.dependency` 挂载组件，并通过 `parameters` 填充其需求：

```yaml
version: "1.0"
namespace: app
entries:
  - name: dep.jobs
    kind: ns.dependency
    component: acme/jobs
    version: "^1.0.0"
    parameters:
      - name: target_db
        value: app:db
      - name: process_host
        value: app:processes
      - name: api_router
        value: app:api
```

每个 `parameter.name` 匹配一个需求；它的 `value` 就是注入该需求各目标的值。带默认值的需求可以省略；必填的需求必须提供。

### 参数名匹配

参数名如何绑定到需求：

- **裸名称**（`target_db`）匹配被挂载组件中同名的需求。它不会越界到其他模块的需求。
- **限定名称**（`acme.jobs:target_db`）精确匹配该需求 id。在为传递依赖接线时用它来消除歧义。

如果两个依赖为同一个需求提供了**不同**的值，那是冲突并会被报告（相同的值则没有问题）。

## 值何时解析

注入发生在构建管线的 **Link 阶段** — 在发布时、依赖展开时和启动时 — 而不是在运行期。该阶段：

1. 收集每个 `ns.requirement`，以及每个 `ns.dependency` 及其参数。
2. 为每个需求解析一个值：匹配的参数胜出；否则用默认值；否则（没有默认值）保持未解析。
3. 将解析出的值写入每个目标条目的路径处（设置，或对 `+=` 追加）。

在**严格需求**模式下，未解析的必填需求会使构建失败；否则记录警告并继续。当条目到达运行时时，每个已填充的需求都已经烘焙进其目标。

## 验证接缝：挂载测试

单元测试在隔离状态下运行切片；它们看不到*组装后*的模块是否自洽。添加一个打包/挂载测试，对照实时的、已注入需求的注册表整体审计模块：

- 每个受监督的 `service` 都指向一个存在的进程条目，
- 每个被派生或被调度的 id 都解析到真实条目，
- 每个 `env.variable` 的存储都已注册。

这些正是被隔离的单元测试套件掩盖的集成接缝 — 正是这些缝隙让监督者引用了一个从未注册的 worker，或者让测试夹具把只属于测试环境的存储 id 泄漏进已挂载的启动中。参见[监督](guides/supervision.md)与[测试](framework/testing.md)框架。

## 另请参阅

- [应用架构](concepts/architecture.md) — 组件内部如何组织
- [依赖管理](guides/dependency-management.md) — 锁文件、版本、消费者工作流
- [发布模块](guides/publishing.md) — 把组件放上 hub
- [条目种类指南](guides/entry-kinds.md) — `ns.definition`、`ns.requirement`、`ns.dependency` 参考
