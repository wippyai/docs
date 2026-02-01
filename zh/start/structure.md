# 项目结构

项目布局、YAML 定义文件和命名规范。

## 目录结构

```
myapp/
├── .wippy.yaml          # 运行时配置
├── wippy.lock           # 源目录配置
├── .wippy/              # 已安装的模块
└── src/                 # 应用源代码
    ├── _index.yaml      # 记录定义
    ├── api/
    │   ├── _index.yaml
    │   └── *.lua
    └── workers/
        ├── _index.yaml
        └── *.lua
```

## YAML 定义文件

<note>
YAML 定义在启动时加载到注册表中。注册表是唯一的数据源——YAML 文件只是填充它的一种方式。记录也可以来自其他来源或通过编程方式创建。
</note>

### 文件结构

任何包含 `version` 和 `namespace` 的 YAML 文件都是有效的：

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: 根据 ID 获取用户
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: 用户 API 端点
    method: GET
    path: /users/{id}
    func: get_user
```

| 字段 | 必需 | 描述 |
|------|------|------|
| `version` | 是 | 架构版本（当前为 `"1.0"`） |
| `namespace` | 是 | 此文件中记录的命名空间 |
| `entries` | 是 | 记录定义数组 |

### 命名规范

使用点（`.`）分隔语义部分，使用下划线（`_`）分隔单词：

```yaml
# 函数及其端点
- name: get_user              # 函数
- name: get_user.endpoint     # 其 HTTP 端点

# 同一函数的多个端点
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# 路由器
- name: api.public            # 公共 API 路由器
- name: api.admin             # 管理 API 路由器
```

<tip>
模式：<code>base_name.variant</code> — 点分隔语义部分，下划线分隔部分内的单词。
</tip>

### 命名空间

命名空间是点分隔的标识符：

```
app
app.api
app.api.v2
app.workers
```

记录完整 ID 由命名空间和名称组成：`app.api:get_user`

### 源目录

`wippy.lock` 文件定义了 Wippy 从哪里加载定义：

```yaml
directories:
  modules: .wippy
  src: ./src
```

Wippy 递归扫描这些目录查找 YAML 文件。

## 记录定义

每个记录在 `entries` 数组中。属性位于根级别（无 `data:` 包装）：

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: 返回 hello world
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Hello 端点
    method: GET
    path: /hello
    func: hello
```

### 元数据

使用 `meta` 存储界面友好的信息：

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: 支付处理器
    comment: 处理 Stripe 支付
  source: file://payment.lua
```

约定：`meta.title` 和 `meta.comment` 在管理界面中显示良好。

### 应用记录

使用 `registry.entry` 类型存储应用级配置：

```yaml
- name: config
  kind: registry.entry
  meta:
    title: 应用设置
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## 常见记录类型

| 类型 | 用途 |
|------|------|
| `registry.entry` | 通用数据 |
| `function.lua` | 可调用的 Lua 函数 |
| `process.lua` | 长时间运行的进程 |
| `http.service` | HTTP 服务器 |
| `http.router` | 路由组 |
| `http.endpoint` | HTTP 处理器 |
| `process.host` | 进程监管器 |

详见 [记录类型指南](guides/entry-kinds.md)。

## 配置文件

### .wippy.yaml

项目根目录的运行时配置：

```yaml
logger:
  level: info
  mode: production

host:
  worker_count: 16

http:
  address: :8080
```

详见 [配置指南](guides/configuration.md)。

### wippy.lock

定义源目录：

```yaml
directories:
  modules: .wippy
  src: ./src
```

## 引用记录

通过完整 ID 或相对名称引用记录：

```yaml
# 完整 ID（跨命名空间）
- name: main.router
  kind: http.router
  endpoints:
    - app.api:get_user.endpoint
    - app.api:list_orders.endpoint

# 同一命名空间 - 直接使用名称
- name: get_user.endpoint
  kind: http.endpoint
  func: get_user
```

## 示例项目

```
myapp/
├── .wippy.yaml
├── wippy.lock
└── src/
    ├── _index.yaml           # namespace: app
    ├── api/
    │   ├── _index.yaml       # namespace: app.api
    │   ├── users.lua
    │   └── orders.lua
    ├── lib/
    │   ├── _index.yaml       # namespace: app.lib
    │   └── database.lua
    └── workers/
        ├── _index.yaml       # namespace: app.workers
        └── email_sender.lua
```

## 另请参阅

- [记录类型指南](guides/entry-kinds.md) — 可用的记录类型
- [配置指南](guides/configuration.md) — 运行时选项
- [自定义记录类型](internals/kinds.md) — 实现处理器（高级）
