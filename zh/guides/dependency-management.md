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
| `modules[].hash` | 用于完整性验证的内容哈希 |

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
wippy install --force              # Bypass cache, re-download
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
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

## 使用替换进行本地开发

使用本地目录覆盖 hub 模块以进行开发：

```yaml
# wippy.lock
directories:
  modules: .wippy
  src: ./src
modules:
  - name: acme/http
    version: v1.2.0
    hash: ...
replacements:
  - from: acme/http
    to: ../local-http
```

替换路径相对于锁定文件。当替换处于活动状态时，使用本地目录代替供应商模块。替换在 `wippy update` 操作后会被保留。

## 加载顺序

启动时，Wippy 按以下顺序从目录加载条目：

1. 源代码目录（`src`）
2. 替换目录
3. 供应商模块目录

具有活动替换的模块会跳过其供应商路径。

## 完整性验证

锁定文件中的每个模块都有内容哈希。在安装过程中，下载的模块会根据其预期哈希进行验证。不匹配的模块会被拒绝并从注册表重新下载。

## 另请参阅

- [CLI](guides/cli.md) - 命令参考
- [发布](guides/publishing.md) - 将模块发布到 hub
- [项目结构](start/structure.md) - 项目布局
