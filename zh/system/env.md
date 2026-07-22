---
title: "Environment 系统"
description: "通过可配置的存储后端管理环境变量。"
---

# Environment 系统

通过可配置的存储后端管理环境变量。

## 概述

环境系统将存储与访问分离：

- **Storages** - 值的存储位置（OS、文件、内存）
- **Variables** - 对存储中值的命名引用

变量可以通过以下方式引用：
- **公共名称** - `variable` 字段值（必须在系统中唯一）
- **Entry ID** - 完整的 `namespace:name` 引用

如果不希望变量可以通过名称公开访问，请省略 `variable` 字段。

## Entry 类型

| Kind | 描述 |
|------|------|
| `env.storage.memory` | 内存键值存储 |
| `env.storage.file` | 基于文件的存储（.env 格式） |
| `env.storage.os` | 只读 OS 环境访问 |
| `env.storage.static` | 只读静态键值存储 |
| `env.storage.router` | 链接多个存储 |
| `env.variable` | 引用存储的命名变量 |

## 存储后端

### 内存存储

易失性内存存储。

```yaml
- name: runtime_env
  kind: env.storage.memory
```

### 文件存储

使用 `.env` 文件格式的持久存储（`KEY=VALUE`，`#` 注释）。

```yaml
- name: app_config
  kind: env.storage.file
  file_path: /etc/app/config.env
  auto_create: true
  file_mode: 0600
  dir_mode: 0700
```

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `file_path` | string | required | .env 文件路径 |
| `auto_create` | boolean | false | 文件不存在时创建 |
| `file_mode` | integer | 0644 | 文件权限 |
| `dir_mode` | integer | 0755 | 目录权限 |

### OS 存储

只读访问操作系统环境变量。

```yaml
- name: os_env
  kind: env.storage.os
```

始终只读。Set 操作返回 `PERMISSION_DENIED`。

### 静态存储

只读存储，值直接在配置中定义。值嵌入到条目中，运行时无法更改。适用于随模块或包分发的公共配置常量。

```yaml
- name: defaults
  kind: env.storage.static
  values:
    PUBLIC_API_HOST: "https://api.example.com"
    PUBLIC_WS_HOST: "wss://api.example.com/ws"
    APP_ENV: "production"
```

| 属性 | 类型 | 描述 |
|------|------|------|
| `values` | map | 键值对（字符串到字符串） |

始终只读。Set 操作返回 `PERMISSION_DENIED`。

### 路由器存储

链接多个存储。按顺序搜索读取直到找到。写入仅到第一个存储。

```yaml
- name: config
  kind: env.storage.router
  storages:
    - app.config:memory    # Primary (writes here)
    - app.config:file      # Fallback
    - app.config:os        # Fallback
```

| 属性 | 类型 | 描述 |
|------|------|------|
| `storages` | array | 有序的存储引用列表 |

## 变量

变量提供对存储值的命名访问。

```yaml
- name: DATABASE_URL
  kind: env.variable
  variable: DATABASE_URL
  storage: app.config:file
  default: postgres://localhost/app
  read_only: false
```

| 属性 | 类型 | 描述 |
|------|------|------|
| `variable` | string | 公共变量名（可选，必须唯一） |
| `storage` | string | 存储引用（`namespace:name`） |
| `default` | string | 未找到时的默认值 |
| `read_only` | boolean | 阻止修改 |

### 变量命名

变量名只能包含：`a-z`、`A-Z`、`0-9`、`_`

### 访问模式

```yaml
# Public variable - accessible by name "PORT"
- name: port_var
  kind: env.variable
  variable: PORT
  storage: app.config:os
  default: "8080"

# Private variable - accessible only by ID "app.config:internal_key"
- name: internal_key
  kind: env.variable
  storage: app.config:secrets
```

## 占位符插值

已注册的变量通过 `${env:NAME}` 占位符引入条目配置，在解码时统一根据此注册表解析。条目数据中的任何字符串字段都可以通过这种方式引用变量。

| 语法 | 含义 |
|--------|--------|
| `${env:NAME}` | 通过 env 注册表解析 `NAME`；未设置且无默认值时报错 |
| `${env:NAME\|default}` | 解析 `NAME`，未设置时回退到 `default` |
| `${NAME\|default}` | 简写形式；`NAME` 必须为大写下划线格式（`A-Z0-9_`）且 `\|default` 必填 — 裸 `${VAR}` 保持原样，以免嵌入的 shell/模板片段被误认为引用 |
| `$${` | 字面量 `${`（转义） |

`NAME` 是已注册变量的公共名称或其条目 ID（带点号/冒号的注册表 ID 形式，例如 `app.env:tls_cert`）。它**不是**原始的 OS 环境变量：只有当以 `env.storage.os` 为后端的变量以该名称注册时，OS 值才可被访问。

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: ${env:app.env:tls_cert}
    key:  ${env:app.env:tls_key}
```

整个值为单个占位符的字段取变量的类型化值（给定类型化默认值时强制转换为 bool/int/float）；占位符与周围文本混合时则插值为字符串。变量自身的 `default` 优先于占位符的内联 `|default`。解析不到值且没有默认值的引用会导致解码失败。

解析只发生在解码时：存储的注册表条目保留原始占位符，因此解析后的密钥绝不会出现在 `registry.get` 结果或持久化状态中。引用 `${env:...}` 的条目在启动时会自动排在其所依赖的 env 存储和变量之后。

<note>
旧配置使用同级的 <code>&lt;field&gt;_env</code> 指令（例如 <code>cert_env: app.env:tls_cert</code>），解析方式相同。这种形式已<b>弃用</b> — 请迁移到 <code>${env:NAME}</code> 占位符。指向未注册变量的 <code>&lt;field&gt;_env</code> 键不会被视为指令，保持原样；指向已注册但为空的变量时，保留内联的 <code>&lt;field&gt;</code> 值。只有不带默认值的显式 <code>${env:NAME}</code> 才会在变量缺失时硬性失败。
</note>

## 错误

| 条件 | Kind | 可重试 |
|------|------|--------|
| 变量未找到 | `errors.NOT_FOUND` | 否 |
| 存储未找到 | `errors.NOT_FOUND` | 否 |
| 变量只读 | `errors.PERMISSION_DENIED` | 否 |
| 存储只读 | `errors.PERMISSION_DENIED` | 否 |
| 无效变量名 | `errors.INVALID` | 否 |

## 运行时访问

- [env 模块](lua/system/env.md) - Lua 运行时访问

## 参见

- [Security 模型](system/security.md) - 环境变量的访问控制
- [配置指南](guides/configuration.md) - 应用配置模式
