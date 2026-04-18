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
local versions, err = hub.versions.list("wippy/http", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/http", "1.0.0")
```

| 函数 | 说明 |
|----------|-------------|
| `hub.versions.list(module, opts?)` | 列出某个模块的所有版本 |
| `hub.versions.get(module, version, opts?)` | 获取指定版本 |

## 依赖

```lua
local deps, err = hub.dependencies.get("wippy/http", "1.0.0")
local users, err = hub.dependents.get("wippy/http")
```

| 函数 | 说明 |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | 某个模块版本的依赖 |
| `hub.dependents.get(module, opts?)` | 依赖此模块的其他模块 |

## 文件

```lua
local files, err = hub.files.list("wippy/http", "1.0.0")
```

返回已发布版本的文件列表。

## 另请参阅

- [CLI Reference](guides/cli.md) — `wippy readme`、`wippy search`、`wippy publish`
- [Publishing Guide](guides/publishing.md)
