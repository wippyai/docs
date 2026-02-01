# Publishing Modules

Share reusable code on the Wippy Hub.

## Prerequisites

1. Create an account on [hub.wippy.ai](https://hub.wippy.ai)
2. Create an organization or join one
3. Register your module name under your organization

## Module Structure

```
mymodule/
├── wippy.yaml      # Module manifest
├── src/
│   ├── _index.yaml # Entry definitions
│   └── *.lua       # Source files
└── README.md       # Documentation (optional)
```

## wippy.yaml

Module manifest:

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

| Field | Required | Description |
|-------|----------|-------------|
| `organization` | Yes | Your org name on the hub |
| `module` | Yes | Module name |
| `description` | Yes | Short description |
| `license` | No | SPDX identifier (MIT, Apache-2.0) |
| `repository` | No | Source repository URL |
| `homepage` | No | Project homepage |
| `keywords` | No | Search keywords |

## Entry Definitions

Entries are defined in `_index.yaml`:

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

## Dependencies

Declare dependencies on other modules:

```yaml
entries:
  - name: __dependency.wippy.test
    kind: ns.dependency
    meta:
      description: Testing framework
    component: wippy/test
    version: ">=0.3.0"
```

Version constraints:

| Constraint | Meaning |
|------------|---------|
| `*` | Any version |
| `1.0.0` | Exact version |
| `>=1.0.0` | Minimum version |
| `^1.0.0` | Compatible (same major) |

## Requirements

Define configuration that consumers must provide:

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

Targets specify where the value is injected:
- `entry` - Full entry ID to configure
- `path` - JSONPath for value injection

Consumers configure via override:

```bash
wippy run -o acme.http:api_endpoint=https://custom.api.com
```

## Imports

Reference other entries:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  modules:
    - json
  imports:
    client: acme.http:client           # Same namespace
    utils: acme.utils:helpers          # Different namespace
    base_registry: :registry           # Built-in
```

In Lua:

```lua
local client = require("client")
local utils = require("utils")
```

## Contracts

Define public interfaces:

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

## Publishing Workflow

### 1. Authenticate

```bash
wippy auth login
```

### 2. Prepare

```bash
wippy init
wippy update
wippy lint
```

### 3. Validate

```bash
wippy publish --dry-run
```

### 4. Publish

```bash
wippy publish --version 1.0.0
```

With release notes:

```bash
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## Using Published Modules

### Add Dependency

```bash
wippy add acme/http-utils
wippy add acme/http-utils@1.0.0
wippy install
```

### Configure Requirements

Override values at runtime:

```bash
wippy run -o acme.http:api_endpoint=https://my.api.com
```

Or in `.wippy.yaml`:

```yaml
override:
  acme.http:api_endpoint: "https://my.api.com"
```

### Import in Your Code

```yaml
# your src/_index.yaml
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

## Complete Example

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

Publish:

```bash
wippy init && wippy update && wippy lint
wippy publish --version 1.0.0
```

## See Also

- [CLI Reference](guides/cli.md)
- [Entry Kinds](guides/entry-kinds.md)
- [Configuration](guides/configuration.md)
