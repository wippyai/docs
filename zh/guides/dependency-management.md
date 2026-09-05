---
title: "依赖管理"
description: "Wippy 使用基于锁定文件的依赖系统。模块发布到 hub，在源代码中声明为依赖项，然后解析到 wippy.lock 文件中以跟踪确切版本。"
---

# 依赖管理

Wippy 使用基于锁定文件的依赖系统。模块发布到 hub，在源代码中声明为依赖项，然后解析到 `wippy.lock` 文件中以跟踪确切版本。

## 项目文件

### wippy.lock

锁定文件跟踪项目的目录布局和固定的依赖项：

```yaml
directories:
  modules: .wippy
  src: ./src
modules:
  - name: acme/http
    version: v1.2.0
    hash: 4ea816fe84ca58a1f0869e5ca6afa93d6ddd72fa09e1162d9e600a7fbf39f0a2
  - name: acme/sql
    version: v2.0.1
    hash: b3f9c8e12a456d7890abcdef1234567890abcdef1234567890abcdef12345678
```

| 字段 | 描述 |
|------|------|
| `directories.modules` | 下载模块的存储位置（默认：`.wippy`） |
| `directories.src` | 源代码所在位置（默认：`./src`） |
| `modules[].name` | 模块标识符，格式为 `org/module` |
| `modules[].version` | 固定的语义版本 |
| `modules[].hash` | 下载的包必须匹配的构件摘要；纯十六进制值按 `sha256` 读取 |
| `modules[].root` | 标记所选的部署根；最多只能有一个模块携带它 |
| `options.unpack_modules` | 将包解压为目录，而不是作为 `.wapp` 文件加载（默认：`false`） |

### wippy.yaml

用于发布的模块元数据。仅在发布自己的模块时需要：

```yaml
organization: acme
module: http
version: 1.2.0
description: HTTP utilities for Wippy
license: MIT
repository: https://github.com/acme/wippy-http
keywords:
  - http
  - web
```

| 字段 | 必需 | 描述 |
|------|------|------|
| `organization` | 是 | 小写字母、数字和连字符 |
| `module` | 是 | 小写字母、数字和连字符 |
| `version` | 否 | 语义版本（发布时设置） |
| `description` | 否 | 模块描述 |
| `license` | 否 | SPDX 许可证标识符 |
| `repository` | 否 | 源代码仓库 URL |
| `homepage` | 否 | 项目主页 |
| `keywords` | 否 | 发现关键词 |
| `authors` | 否 | 作者列表 |

## 声明依赖

在 `_index.yaml` 中添加 `ns.dependency` 条目：

```yaml
version: "1.0"
namespace: app
entries:
  - name: dependency.http
    kind: ns.dependency
    component: acme/http
    version: "^1.0.0"

  - name: dependency.sql
    kind: ns.dependency
    component: acme/sql
    version: ">=2.0.0"
```

### 版本约束

| 约束 | 示例 | 匹配范围 |
|------|------|----------|
| 精确 | `1.2.3` | 仅 1.2.3 |
| 插入符 | `^1.2.0` | >=1.2.0, <2.0.0 |
| 波浪号 | `~1.2.0` | >=1.2.0, <1.3.0 |
| 范围 | `>=1.0.0` | 1.0.0 及以上 |
| 通配符 | `*` | 任意版本（选择最高版本） |
| 组合 | `>=1.0.0 <2.0.0` | 1.0.0 到 2.0.0 之间 |

### 解析规则

- 每个模块根据依赖图中**所有已声明范围的交集**解析。不兼容的范围（菱形冲突）会以明确的错误使解析失败，而不是悄悄选择某一边。
- 依赖从其声明的范围求解，而不是从先前解析的固定版本求解。
- **根声明优先于传递声明**：当你的应用和某个依赖都引入同一个模块或需求时，你的声明优先。
- 同一个组件只能作为根依赖声明一次 — 重复声明会以冲突错误被拒绝。请改为更新已有的依赖。

两类解析失败会被区分报告。任何发行版都无法满足的约束表达式 — 活动范围的交集为空 — 属于冲突，错误会点名该模块以及每个贡献了范围的请求方。而一组有效的范围若在 hub 上当前没有可匹配的版本，则属于可用性失败：后续的发行版无需改动任何声明即可让它变得可解析。

运行时将每次解析出的依赖图持久化到其注册表历史中，并在启动时重放而不是重新求解，因此已部署的应用启动时使用的正是应用依赖变更时解析出的版本。`wippy.lock` 仍然是源码项目的可移植快照。

### 条目来源

来源信息归注册表所有，而不是条目元数据。加载条目时，注册表会为每个条目标记提供它的部署来源：

| 字段 | 说明 |
|------|------|
| `registry.owner` | 提供该条目的模块名（`org/module`）；应用源码为空 |
| `registry.root` | 设置在部署根提供的 `ns.dependency` 条目上，将其标记为根声明 |

条目作者绝不会写入这些字段；它们在加载期间被赋值，无法从 `_index.yaml` 伪造。使用 `wippy registry list --registry-meta --json` 查看它们。

## 工作流程

### 创建新项目

```bash
wippy init
```

创建包含默认目录的 `wippy.lock`。

### 添加依赖

```bash
wippy add acme/http               # Latest version
wippy add acme/http@1.2.3         # Exact version
wippy add acme/http@latest         # Latest label
```

这会更新锁定文件。然后执行安装：

```bash
wippy install
```

### 从源代码解析

如果源代码中已声明 `ns.dependency` 条目：

```bash
wippy update
```

这会扫描源代码目录，解析所有依赖约束，更新锁定文件并安装模块。

### 更新依赖

```bash
wippy update                       # Re-resolve all dependencies
wippy update acme/http             # Update only acme/http
wippy update acme/http acme/sql    # Update specific modules
```

更新特定模块时，其他模块保持固定在当前版本。如果更新需要更改非目标模块，系统会提示确认。

### 从锁定文件安装

```bash
wippy install                      # Install all from lock
wippy install --refresh            # 重新获取每个模块（--force 和 --repair 是别名）
```

## 模块存储

下载的模块存储在 `.wippy/vendor/` 目录下：

```
project/
  wippy.lock
  src/
    _index.yaml
  .wippy/
    vendor/
      acme/
        http-v1.2.0.wapp
        sql-v2.0.1.wapp
```

默认情况下，模块以 `.wapp` 文件保存。要将其解压为目录：

```yaml
# wippy.lock
options:
  unpack_modules: true
```

启用解压后：

```
.wippy/
  vendor/
    acme/
      http-v1.2.0.wapp
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

解压绝不会丢弃包。经过校验的规范 `.wapp` 会保留在解压目录旁边，因为它是该模块唯一的内容寻址证据，而且构件物化和修复都会从中读回资源。安装检查依据的正是 `.wapp`：包缺失的目录会被视为未安装，模块将被重新下载。每次安装都会从校验过的归档中重新解压出目录，因此对供应商目录的手工修改不会保留。

从[工作区替换](#local-development-with-replacements)解析出的模块从不会被下载或供应商化；它们从本地路径加载。

## 使用替换进行本地开发

使用本地目录覆盖 hub 模块以进行开发。替换在运行时配置文件的 `workspace` 区段中声明 — 通常放在一个私有的、被 git 忽略、组合在 `.wippy.yaml` 之上的文件中：

```yaml
# .wippy.workspace.yaml
version: "1.0"
workspace:
  replacements:
    acme/http: ../local-http
    acme/sql: ../local-sql
```

```bash
wippy run --config .wippy.yaml --config .wippy.workspace.yaml
```

键为 `org/module`，值为目录（相对路径相对于第一个 `--config` 文件所在目录解析）。将替换设为 `null` 会禁用从先前配置层或 profile 继承的替换。替换也可以放在 [profile](guides/configuration.md#profiles) 中，从而只在 `--profile workspace` 时生效。

只有当锁定图确实选中了某个模块时，才要求其路径存在且为目录。为无人依赖的模块声明的替换属于解析输入，而非启动输入：它可以指向本机上并未检出的目录而不会导致校验失败。

替换改变的是模块源码的来源，而不是选择了哪个发行版。加载路径保留锁定文件为该模块选定的版本和摘要，并被标记为替换；从中加载的条目会遮蔽具有相同 ID 的供应商条目。当为一个锁定文件未固定版本的模块声明替换时，解析会向 hub 询问一个发行版本，在有更强证据选定版本之前，它会持有一个仅限本地的零版本。

工作区替换在启动时影响加载图，且永远不会写入 `wippy.lock`。对本地源码的更改会被直接调和，无需联系 hub。模块 `wippy.yaml` 中的源码 `exclude:` glob 同样适用于替换目录 — 在加载条目和对内容做哈希时都生效。

`wippy.lock` 中的 `replacements:` 区段已弃用：它仍会加载，但会打印警告。请将这些条目移到配置文件中的 `workspace.replacements`。

## 加载顺序

启动时，Wippy 按以下顺序从目录加载条目：

1. 源代码目录（`src`）
2. 替换目录
3. 供应商模块目录

具有活动替换的模块会跳过其供应商路径。

## 完整性验证

锁定文件中的每个模块都携带一个构件摘要，没有摘要的模块根本无法安装。

下载采用暂存方式：包先写入其最终位置旁边的临时文件，针对 `wippy.lock` 中固定的摘要以及 hub 随下载 URL 提供的摘要（外加所提供的大小）进行校验，然后才重命名到位。校验失败的暂存文件会被删除。

摘要不匹配是硬性的、不可重试的失败 — `PermissionDenied`，"module integrity verification failed" — 并且在安装时和启动时以同样方式抛出，启动时会在加载条目之前重新校验已供应商化的包。不会有任何重试、覆盖不匹配项重新下载，或回退到所提供内容的行为。

同样的检查也保护解析过程。当 hub 提供的清单摘要与锁定文件固定的摘要不同时，清单缓存会刷新一次并重新比对；如果仍然不一致，解析会失败并点名两个摘要。

解压出的目录携带各自记录的摘要、大小和树摘要，并会根据记录值重新校验，因此被修改的供应商目录树会被检测出来而不是被加载。

替换来源同样是内容寻址的。运行时会为替换目录树计算摘要，当解析出的图已经为该模块固定了不同的摘要或大小时便予以拒绝，因此替换无法悄悄冒充与之不匹配的内容。

## 构建时构件

模块可以发布一个标记了 `meta.artifact.format` 的文件系统资源，供消费方物化到磁盘上，而不是在运行时读取。完整的和定向的 `wippy install` 与 `wippy update`、冷启动以及运行时依赖操作，都会在改变模块图的同一事务中协调这些输出；`artifact.materialization_root` 设置输出根目录。参见[构建时构件](guides/artifacts.md)。

## 另请参阅

- [构建时构件](guides/artifacts.md) - 声明、物化与协调构件资源
- [构建组件](guides/components.md) - 作者侧：`ns.requirement` 与通过 `parameters` 提供值
- [CLI](guides/cli.md) - 命令参考
- [发布](guides/publishing.md) - 将模块发布到 hub
- [项目结构](start/structure.md) - 项目布局
