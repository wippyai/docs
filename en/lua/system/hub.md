---
title: "Hub"
description: "Read-only access to the Wippy Hub module catalog: list modules, search, fetch metadata, versions, dependencies, and READMEs."
---

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
local versions, err = hub.versions.list("wippy/terminal", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/terminal", "1.0.0")
```

| Function | Description |
|----------|-------------|
| `hub.versions.list(module, opts?)` | List versions for a module |
| `hub.versions.get(module, version, opts?)` | Fetch a specific version |
| `hub.versions.inspect(module, version, opts?)` | Inspect a version's artifact (downloads and reads the bundle) |
| `hub.versions.open(module, version, opts?)` | Open a version's artifact as a package handle |

### Package Handle

`hub.versions.open` downloads the artifact and returns a handle with fields `version`, `digest`, `packed`:

```lua
local pkg, err = hub.versions.open("wippy/terminal", "1.2.3")

local entries, err = pkg:entries({
    kind = "function.lua",       -- string or string[], omit for all kinds
    include_data = false,        -- default true
})
-- each entry: { id = "ns:name", kind = "...", meta = {...}, data = <any> }

pkg:close()
```

| Method | Description |
|--------|-------------|
| `pkg:metadata()` | Pack metadata map |
| `pkg:entries(opts?)` | Registry entries in the artifact; `opts.kind` filters, `opts.include_data` (default true) controls the `data` field |
| `pkg:resources()` | Embedded resources list |
| `pkg:fs(resource)` | Filesystem handle for an embedded resource |
| `pkg:close()` | Release the handle |

Entry `data` is returned raw — `${env:...}` references are not resolved.

## Dependencies

```lua
local deps, err = hub.dependencies.get("wippy/terminal", "1.0.0")
local users, err = hub.dependents.get("wippy/terminal")
```

| Function | Description |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | Dependencies for a module version |
| `hub.dependents.get(module, opts?)` | Modules that depend on this one |

## Files

```lua
local files, err = hub.files.list("wippy/terminal", "1.0.0")
```

| Function | Description |
|----------|-------------|
| `hub.files.list(module, version, opts?)` | List files for a version (`version` required); returns `{items, total, page, page_size}` |

## Authentication

Push a registry token into the running process — every hub consumer picks it up on its next call, without a restart:

```lua
local status, err = hub.auth.authenticate("wpy_xxx")          -- default registry
local status, err = hub.auth.authenticate("wpy_xxx", "https://hub.example.com")

local status, err = hub.auth.status()
local ok, err = hub.auth.logout()
```

| Function | Description |
|----------|-------------|
| `hub.auth.authenticate(token, registry?)` | Validate the token against the registry and, on success, install it as the runtime override |
| `hub.auth.status(registry?)` | Live-validate the current credential |
| `hub.auth.logout(registry?)` | Clear the runtime token override |

`status` contains `authenticated`, `registry`, and `orgs`; identity fields (`username`, `user_id`, `scope`, `expires_at`, `expired`) are present only when authenticated. A token that fails validation is not stored — `authenticate` returns `authenticated = false`. The override takes precedence over `WIPPY_TOKEN` and stored credentials.

**Permissions:** `hub.auth.authenticate`, `hub.auth.status`, `hub.auth.logout`

## See Also

- [CLI Reference](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Publishing Guide](guides/publishing.md)
