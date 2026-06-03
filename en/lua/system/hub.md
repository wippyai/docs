# Hub

Read-only access to the Wippy Hub module catalog: list modules, search, fetch metadata, versions, dependencies, and READMEs.

## Loading

```lua
local hub = require("hub")
```

## Per-call Options

Every call accepts an optional options table. Keys common to all calls:

| Key | Type | Description |
|-----|------|-------------|
| `registry` | string | Registry URL override |
| `token` | string | API token override |
| `timeout` | duration/number | Request timeout (e.g. `"3m"` or seconds) |

Pagination-aware calls also accept `page` and `page_size`.

## Modules

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

| Function | Description |
|----------|-------------|
| `hub.modules.list(opts?)` | List modules with filters |
| `hub.modules.search(query, opts?)` | Search by query string |
| `hub.modules.get(module, opts?)` | Fetch module by `org/name` or module id |
| `hub.modules.readme(module, opts?)` | Fetch README; returns `{content, filename, version}` |

### List/Search Options

| Option | Values |
|--------|--------|
| `organization_id` / `org` | string |
| `visibility` | `public`, `private`, `internal` |
| `type` | `library`, `application`, `agent`, `plugin` |
| `sort_order` | `name_asc`, `name_desc`, `created_desc`, `updated_desc`, `downloads_desc` |
| `keywords` (search) | array of strings |
| `license` (search) | string |
| `include_deprecated` (search) | boolean |

### README

```lua
local readme, err = hub.modules.readme("wippy/terminal", {
    version = "1.2.3"
})
print(readme.content)
```

The `version` option accepts either a version string or a table like `{id, version, label}`.

## Versions

```lua
local versions, err = hub.versions.list("wippy/http", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/http", "1.0.0")
```

| Function | Description |
|----------|-------------|
| `hub.versions.list(module, opts?)` | List versions for a module |
| `hub.versions.get(module, version, opts?)` | Fetch a specific version |
| `hub.versions.inspect(module, version, opts?)` | Inspect a version's artifact (downloads and reads the bundle) |

## Dependencies

```lua
local deps, err = hub.dependencies.get("wippy/http", "1.0.0")
local users, err = hub.dependents.get("wippy/http")
```

| Function | Description |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | Dependencies for a module version |
| `hub.dependents.get(module, opts?)` | Modules that depend on this one |

## Files

```lua
local files, err = hub.files.list("wippy/http", "1.0.0")
```

| Function | Description |
|----------|-------------|
| `hub.files.list(module, version, opts?)` | List files for a version (`version` required); returns `{items, total, page, page_size}` |

## See Also

- [CLI Reference](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Publishing Guide](guides/publishing.md)
