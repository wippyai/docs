---
title: "发布模块"
description: "在 Wippy Hub 上分享可重用代码。"
---

# 发布模块

在 Wippy Hub 上分享可重用代码。

## 前置条件

1. 在 [hub.wippy.ai](https://hub.wippy.ai) 创建账号
2. 创建组织或加入组织
3. 在你的组织下注册模块名称

## 模块结构

```
mymodule/
├── wippy.yaml      # 模块清单
├── src/
│   ├── _index.yaml # 入口定义
│   └── *.lua       # 源文件
└── README.md       # 文档（可选）
```

## wippy.yaml

模块清单：

```yaml
organization: acme
module: http-utils
description: HTTP utilities and helpers
license: MIT
repository: https://github.com/acme/http-utils
homepage: https://acme.dev
keywords:
  - http
  - utilities
```

| 字段 | 必填 | 说明 |
|-------|----------|-------------|
| `organization` | 是 | 你在 hub 上的组织名 |
| `module` | 是 | 模块名 |
| `description` | 否 | 简短描述 |
| `license` | 否 | SPDX 标识符（MIT、Apache-2.0） |
| `repository` | 否 | 源代码仓库 URL |
| `homepage` | 否 | 项目主页 |
| `keywords` | 否 | 搜索关键词 |

## 入口定义

入口在 `_index.yaml` 中定义：

```yaml
version: "1.0"
namespace: acme.http

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: HTTP Utilities
      description: Helpers for HTTP operations

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

## 依赖

声明对其他模块的依赖：

```yaml
entries:
  - name: __dependency.wippy.test
    kind: ns.dependency
    meta:
      description: Testing framework
    component: wippy/test
    version: ">=0.3.0"
```

版本约束：

| 约束 | 含义 |
|------------|---------|
| `*` | 任意版本 |
| `1.0.0` | 精确版本 |
| `>=1.0.0` | 最低版本 |
| `^1.0.0` | 兼容（同主版本） |

## 需求

定义消费者必须提供的配置：

```yaml
entries:
  - name: api_endpoint
    kind: ns.requirement
    meta:
      description: API endpoint URL
    targets:
      - entry: acme.http:client
        path: ".meta.endpoint"
    default: "https://api.example.com"
```

Targets 指定值注入的位置：
- `entry` - 要配置的完整入口 ID
- `path` - 用于值注入的 JSONPath

消费者通过覆盖来配置。`-o` 标志接受 `namespace:entry:field=value` 三元组：

```bash
wippy run -o acme.http:client:meta.endpoint=https://custom.api.com
```

## 导入

引用其他入口：

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  modules:
    - json
  imports:
    client: acme.http:client           # 同命名空间
    utils: acme.utils:helpers          # 不同命名空间
    base_registry: :registry           # 内置
```

在 Lua 中：

```lua
local client = require("client")
local utils = require("utils")
```

## 契约

定义公共接口：

```yaml
- name: http_contract
  kind: contract.definition
  meta:
    name: HTTP Client Contract
  methods:
    - name: get
      description: Perform GET request
    - name: post
      description: Perform POST request

- name: http_contract_binding
  kind: contract.binding
  contracts:
    - contract: acme.http:http_contract
      methods:
        get: acme.http:get_handler
        post: acme.http:post_handler
```

## 发布工作流

### 1. 认证

```bash
wippy auth login
```

### 2. 准备

```bash
wippy init
wippy update
wippy lint
```

### 3. 验证

```bash
wippy publish --dry-run
```

### 4. 发布

```bash
wippy publish --version 1.0.0
```

带发行说明：

```bash
wippy publish --version 1.0.0 --release-notes "Initial release"
```

### 附加标志

| 标志 | 说明 |
|------|-------------|
| `--label <name>` | 作为可变标签发布（如 `latest`、`beta`），而不是不可变版本 |
| `--protected` | 将发布的版本标记为受保护（不能被删除或覆盖） |
| `--registry <url>` | 为本次发布覆盖注册表 URL |
| `--config <dir>` | 包含 `wippy.yaml` 的目录（默认：当前目录） |
| `--create` | 如果模块在 hub 上尚不存在，则注册该模块，然后发布 |
| `--module-visibility <v>` | `--create` 的可见性：`private`（默认）或 `public` |
| `--module-type <t>` | `--create` 的类型：`application`（默认）、`library`、`agent` 或 `plugin` |
| `--module-display-name <n>` | `--create` 的显示名称 |

### 嵌入静态文件

带有 `fs.directory` 入口（静态资产、模板、公共文件）的模块必须使用 `--embed` 将它们包含在发布的包中。否则，`fs.directory` 入口会被排除。

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

`--embed` 标志接受与 `fs.directory` 入口匹配的入口 ID 或名称。同样的标志也可用于 `wippy pack`。

### 首次发布

首次发布模块时，它会被自动注册到 hub（默认为私有），并且发布会重试一次。传入 `--create` 可提前注册并设置其属性：

```bash
wippy publish --create --version 0.1.0 \
  --module-visibility public \
  --module-type library \
  --module-display-name "HTTP Utils"
```

`--create` 是幂等的——对于已注册的模块，create 步骤是空操作。如果你的账户无权在该组织中创建模块，hub 会返回权限错误而不进行发布。

### 发布到本地 Hub

将 `--registry` 指向本地运行的 hub，即可在不使用公共注册表的情况下发布和安装。纯 HTTP 仅对本地主机允许——`localhost`、`127.0.0.1` 以及容器别名 `host.docker.internal`（Docker Desktop / OrbStack）和 `host.containers.internal`（Podman）；任何其他主机都必须使用 HTTPS。

```bash
wippy auth login --registry http://localhost:8080 --token wpy_xxx
wippy publish --registry http://localhost:8080 --create --version 0.1.0
```

注册表和令牌也可以来自 `WIPPY_REGISTRY` 和 `WIPPY_TOKEN` 环境变量。未设置时，注册表默认为 `https://hub.wippy.ai`。

### 配额

如果组织的私有模块配额已用尽，发布会失败并返回类似 `cannot publish: Private-module quota exhausted (5 of 5)...` 的消息。请将模块设为公开，或请组织管理员提高配额。上传和下载在遇到瞬时网络错误时会自动重试。

## 使用已发布的模块

### 添加依赖

```bash
wippy add acme/http-utils
wippy add acme/http-utils@1.0.0
wippy install
```

### 配置需求

在运行时覆盖值：

```bash
wippy run -o acme.http:client:meta.endpoint=https://my.api.com
```

或在 `.wippy.yaml` 中：

```yaml
override:
  acme.http:client:meta.endpoint: "https://my.api.com"
```

### 在你的代码中导入

```yaml
# 你的 src/_index.yaml
entries:
  - name: __dependency.acme.http
    kind: ns.dependency
    component: acme/http-utils
    version: ">=1.0.0"

  - name: my_handler
    kind: function.lua
    source: file://handler.lua
    imports:
      http: acme.http:client
```

## 完整示例

**wippy.yaml：**
```yaml
organization: acme
module: cache
description: In-memory caching with TTL
license: MIT
keywords:
  - cache
  - memory
```

**src/_index.yaml：**
```yaml
version: "1.0"
namespace: acme.cache

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: Cache Module

  - name: max_size
    kind: ns.requirement
    meta:
      description: Maximum cache entries
    targets:
      - entry: acme.cache:cache
        path: ".meta.max_size"
    default: "1000"

  - name: cache
    kind: library.lua
    meta:
      max_size: 1000
    source: file://cache.lua
    modules:
      - time
```

**src/cache.lua：**
```lua
local time = require("time")

local cache = {}
local store = {}
local max_size = 1000

function cache.set(key, value, ttl)
    if #store >= max_size then
        cache.evict_oldest()
    end
    store[key] = {
        value = value,
        expires = ttl and (time.now():unix() + ttl) or nil
    }
end

function cache.get(key)
    local entry = store[key]
    if not entry then return nil end
    if entry.expires and time.now():unix() > entry.expires then
        store[key] = nil
        return nil
    end
    return entry.value
end

return cache
```

发布：

```bash
wippy init && wippy update && wippy lint
wippy publish --version 1.0.0
```

## 另见

- [CLI 参考](guides/cli.md)
- [入口类型](guides/entry-kinds.md)
- [配置](guides/configuration.md)
