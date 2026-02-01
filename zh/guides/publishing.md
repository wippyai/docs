# 发布模块

在 Wippy Hub 上分享可复用的代码。

## 前提条件

1. 在 [hub.wippy.ai](https://hub.wippy.ai) 创建账户
2. 创建或加入组织
3. 在组织下注册模块名称

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
|------|------|------|
| `organization` | 是 | Hub 上的组织名称 |
| `module` | 是 | 模块名称 |
| `description` | 是 | 简短描述 |
| `license` | 否 | SPDX 标识符（MIT, Apache-2.0） |
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
|------|------|
| `*` | 任意版本 |
| `1.0.0` | 精确版本 |
| `>=1.0.0` | 最低版本 |
| `^1.0.0` | 兼容版本（相同主版本） |

## 需求

定义使用者必须提供的配置：

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
- `path` - 值注入的 JSONPath

使用者通过覆盖配置：

```bash
wippy run -o acme.http:api_endpoint=https://custom.api.com
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
    client: acme.http:client           # 同一命名空间
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

## 发布流程

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

带发布说明：

```bash
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## 使用已发布的模块

### 添加依赖

```bash
wippy add acme/http-utils
wippy add acme/http-utils@1.0.0
wippy install
```

### 配置需求

运行时覆盖值：

```bash
wippy run -o acme.http:api_endpoint=https://my.api.com
```

或在 `.wippy.yaml` 中：

```yaml
override:
  acme.http:api_endpoint: "https://my.api.com"
```

### 在代码中导入

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

**wippy.yaml:**
```yaml
organization: acme
module: cache
description: In-memory caching with TTL
license: MIT
keywords:
  - cache
  - memory
```

**src/_index.yaml:**
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

**src/cache.lua:**
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

## 参见

- [CLI 参考](guides/cli.md)
- [入口类型](guides/entry-kinds.md)
- [配置](guides/configuration.md)
