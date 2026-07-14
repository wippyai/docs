---
title: "Publishing Modules"
---

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
| `description` | No | Short description |
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

Consumers configure via override. The `-o` flag takes a `namespace:entry:field=value` triple:

```bash
wippy run -o acme.http:client:meta.endpoint=https://custom.api.com
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

### Additional Flags

| Flag | Description |
|------|-------------|
| `--label <name>` | Publish as a mutable label (e.g. `latest`, `beta`) instead of an immutable version |
| `--protected` | Mark the published version as protected (cannot be deleted or overwritten) |
| `--registry <url>` | Override the registry URL for this publish |
| `--config <dir>` | Directory containing `wippy.yaml` (default: current dir) |
| `--create` | Register the module on the hub if it does not exist yet, then publish |
| `--module-visibility <v>` | Visibility for `--create`: `private` (default) or `public` |
| `--module-type <t>` | Type for `--create`: `application` (default), `library`, `agent`, or `plugin` |
| `--module-display-name <n>` | Display name for `--create` |

### Embedding Static Files

Modules with `fs.directory` entries (static assets, templates, public files) must use `--embed` to include them in the published package. Without it, `fs.directory` entries are excluded.

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

The `--embed` flag accepts entry IDs or names matching `fs.directory` entries. The same flag is available on `wippy pack`.

### First Publish

The first time you publish a module it is registered on the hub automatically (private by default) and the publish retries once. Pass `--create` to register it up-front and set its properties:

```bash
wippy publish --create --version 0.1.0 \
  --module-visibility public \
  --module-type library \
  --module-display-name "HTTP Utils"
```

`--create` is idempotent — for an already-registered module the create step is a no-op. If your account cannot create modules in the organization, the hub returns a permission error instead of publishing.

### Publishing to a Local Hub

Point `--registry` at a locally running hub to publish and install without the public registry. Plain HTTP is allowed only for local hosts — `localhost`, `127.0.0.1`, and the container aliases `host.docker.internal` (Docker Desktop / OrbStack) and `host.containers.internal` (Podman); any other host must use HTTPS.

```bash
wippy auth login --registry http://localhost:8080 --token wpy_xxx
wippy publish --registry http://localhost:8080 --create --version 0.1.0
```

The registry and token can also come from the `WIPPY_REGISTRY` and `WIPPY_TOKEN` environment variables. When unset, the registry defaults to `https://hub.wippy.ai`.

### Quotas

If the organization's private-module quota is exhausted, publish fails with a message such as `cannot publish: Private-module quota exhausted (5 of 5)...`. Make the module public or ask an org admin to raise the quota. Uploads and downloads retry automatically on transient network errors.

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
wippy run -o acme.http:client:meta.endpoint=https://my.api.com
```

Or in `.wippy.yaml`:

```yaml
override:
  acme.http:client:meta.endpoint: "https://my.api.com"
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
