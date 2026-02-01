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
