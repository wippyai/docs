---
title: "Hub"
description: "以只读方式访问 Wippy Hub 模块目录：列出模块、搜索、获取元数据、版本、依赖项和 README。"
---

# Hub

以只读方式访问 Wippy Hub 模块目录：列出模块、搜索、获取元数据、版本、依赖项和 README。

## 加载

```lua
local hub = require("hub")
```

## 每次调用的选项

每次调用都接受一个可选的选项表。所有调用通用的键：

| 键 | 类型 | 说明 |
|-----|------|-------------|
| `registry` | string | 覆盖 Registry URL |
| `token` | string | 覆盖 API token |
| `timeout` | duration/number | 请求超时（例如 `"3m"` 或秒数） |

支持分页的调用还接受 `page` 和 `page_size`。

## 模块

```lua
local result, err = hub.modules.list({
    org = "wippy",
    visibility = "public",
    type = "library",
    sort_order = "downloads_desc",
    page = 1,
    page_size = 20,
})
-- result = { items, total, page, page_size }
```

| 函数 | 说明 |
|----------|-------------|
| `hub.modules.list(opts?)` | 按过滤条件列出模块 |
| `hub.modules.search(query, opts?)` | 按查询字符串搜索 |
| `hub.modules.get(module, opts?)` | 按 `org/name` 或模块 id 获取模块 |
| `hub.modules.readme(module, opts?)` | 获取 README；返回 `{content, filename, version}` |

### List/Search 选项

| 选项 | 取值 |
|--------|--------|
| `organization_id` / `org` | string |
| `visibility` | `public`, `private`, `internal` |
| `type` | `library`, `application`, `agent`, `plugin` |
| `sort_order` | `name_asc`, `name_desc`, `created_desc`, `updated_desc`, `downloads_desc` |
| `keywords` (search) | 字符串数组 |
| `license` (search) | string |
| `include_deprecated` (search) | boolean |

### README

```lua
local readme, err = hub.modules.readme("wippy/terminal", {
    version = "1.2.3"
})
print(readme.content)
```

`version` 选项接受版本字符串或形如 `{id, version, label}` 的表。

## 版本

```lua
local versions, err = hub.versions.list("wippy/terminal", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/terminal", "1.0.0")
```

| 函数 | 说明 |
|----------|-------------|
| `hub.versions.list(module, opts?)` | 列出某个模块的所有版本 |
| `hub.versions.get(module, version, opts?)` | 获取指定版本 |
| `hub.versions.inspect(module, version, opts?)` | 检查某个版本的产物（下载并读取该包） |
| `hub.versions.open(module, version, opts?)` | 以包句柄的形式打开某个版本的产物 |

### 包句柄

`hub.versions.open` 下载产物并返回一个句柄，包含 `version`、`digest`、`packed` 字段：

```lua
local pkg, err = hub.versions.open("wippy/terminal", "1.2.3")

local entries, err = pkg:entries({
    kind = "function.lua",       -- string or string[], omit for all kinds
    include_data = false,        -- default true
})
-- each entry: { id = "ns:name", kind = "...", meta = {...}, data = <any> }

pkg:close()
```

| 方法 | 说明 |
|--------|-------------|
| `pkg:metadata()` | 包元数据映射 |
| `pkg:entries(opts?)` | 产物中的注册表条目；`opts.kind` 用于过滤，`opts.include_data`（默认 true）控制 `data` 字段 |
| `pkg:resources()` | 嵌入资源列表 |
| `pkg:fs(resource)` | 嵌入资源的文件系统句柄 |
| `pkg:close()` | 释放句柄 |

条目 `data` 按原样返回 — `${env:...}` 引用不会被解析。

## 依赖

```lua
local deps, err = hub.dependencies.get("wippy/terminal", "1.0.0")
local users, err = hub.dependents.get("wippy/terminal")
```

| 函数 | 说明 |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | 某个模块版本的依赖 |
| `hub.dependents.get(module, opts?)` | 依赖此模块的其他模块 |

## 文件

```lua
local files, err = hub.files.list("wippy/terminal", "1.0.0")
```

| 函数 | 说明 |
|----------|-------------|
| `hub.files.list(module, version, opts?)` | 列出某个版本的文件（`version` 必填）；返回 `{items, total, page, page_size}` |

## 认证

将 Registry token 推送到运行中的进程 — 每个 hub 使用方在下一次调用时即可获取，无需重启：

```lua
local status, err = hub.auth.authenticate("wpy_xxx")          -- default registry
local status, err = hub.auth.authenticate("wpy_xxx", "https://hub.example.com")

local status, err = hub.auth.status()
local ok, err = hub.auth.logout()
```

| 函数 | 说明 |
|----------|-------------|
| `hub.auth.authenticate(token, registry?)` | 向 Registry 验证 token，成功后将其安装为运行时覆盖 |
| `hub.auth.status(registry?)` | 实时验证当前凭证 |
| `hub.auth.logout(registry?)` | 清除运行时 token 覆盖 |

`status` 包含 `authenticated`、`registry` 和 `orgs`；身份字段（`username`、`user_id`、`scope`、`expires_at`、`expired`）仅在已认证时存在。验证失败的 token 不会被存储 — `authenticate` 返回 `authenticated = false`。该覆盖优先于 `WIPPY_TOKEN` 和已存储的凭证。

**权限：** `hub.auth.authenticate`、`hub.auth.status`、`hub.auth.logout`

## 另请参阅

- [CLI Reference](guides/cli.md) — `wippy readme`、`wippy search`、`wippy publish`
- [Publishing Guide](guides/publishing.md)
