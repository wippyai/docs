---
title: "Publishing Modules"
description: "Prepare, validate, publish, configure, and consume modules through the Wippy Hub."
---

# Publishing Modules

Publishing packages a module and makes a version or mutable label available through the Wippy Hub.

This is a publishing workflow and reference. The `acme/*` modules, URLs, tokens,
credentials, and example source are illustrative; replace them with resources owned
by your organization.

## Prerequisites

1. Create an account on [hub.wippy.ai](https://hub.wippy.ai).
2. Create or join an organization.
3. Choose a module name. The first publish can register a missing name if your account has permission; use `--create` to register it before upload and set its properties explicitly.

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

Define module metadata in `wippy.yaml`:

```yaml
organization: acme
module: http-utils
type: library
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
| `organization` | Yes | Organization name on the Hub |
| `module` | Yes | Module name |
| `type` | No | Module type: `library`, `application`, `agent`, or `plugin` |
| `description` | No | Short description |
| `license` | No | SPDX identifier (MIT, Apache-2.0) |
| `repository` | No | Source repository URL |
| `homepage` | No | Project homepage |
| `keywords` | No | Search keywords |

`type` controls how the Hub classifies the module and can be changed in a later publish. The `--module-type` flag overrides it for one publish. When omitted, a newly created module defaults to `application` with a deprecation warning.

## Entry Definitions

Define the module's entries in `_index.yaml`:

```yaml
version: "1.0"
namespace: acme.http

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: HTTP Utilities
      description: Helpers for HTTP operations
    readme: file://README.md
    wiki:
      GUIDE.md: file://docs/GUIDE.md
      examples/auth.md: file://docs/auth.md

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

The `wiki:` map on `ns.definition` publishes documentation pages alongside the README. Keys are page paths, and values are `file://` references. Contents are inlined during packing and served by the Hub as a module wiki.

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

- `entry` — Full entry ID to configure
- `path` — Dot path into the target entry for value injection

`default` accepts any scalar type — `default: 20` flows into a numeric target as a number, not a string. The same applies to `parameters[].value` on `ns.dependency` entries, and both accept `${env:NAME}` references, carried verbatim and resolved when the target entry is decoded.

Consumers can configure the target through an override. The `-o` flag accepts a `namespace:entry:field=value` value:

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

## Publish Workflow

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

### Publish Flags

| Flag | Description |
|------|-------------|
| `--label <name>` | Publish as a mutable label (e.g. `latest`, `beta`) instead of an immutable version |
| `--protected` | Mark the published version as protected (cannot be deleted or overwritten) |
| `--registry <url>` | Override the registry URL for this publish |
| `--config <dir>` | Directory containing `wippy.yaml` (default: current dir) |
| `--create` | Register the module on the hub if it does not exist yet, then publish |
| `--module-visibility <v>` | Visibility for `--create`: `private` (default) or `public` |
| `--module-type <t>` | Module type: `library`, `application`, `agent`, or `plugin` (overrides `type:` in wippy.yaml) |
| `--module-display-name <n>` | Display name for `--create` |

### Embed Static Files

Select an `fs.directory` entry for embedding either with `--embed` or with the
project manifest's persistent `embed:` list. Selected entries are transformed
to `fs.embed` resources. An unselected `fs.directory` entry remains in the
pack, but its referenced directory contents are not included.

```yaml
# wippy.yaml
embed:
  - app:public_files
  - app:assets
```

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

The manifest list and `--embed` flag accept entry IDs or names matching
`fs.directory` entries. The same CLI flag is available on `wippy pack`; a CLI
selection overrides the manifest list for that invocation.

### First Publish

On its first publish, a module is registered on the Hub as private by default, and the publish retries once. Use `--create` to register it before publishing and set its properties:

```bash
wippy publish --create --version 0.1.0 \
  --module-visibility public \
  --module-type library \
  --module-display-name "HTTP Utils"
```

`--create` is idempotent — for an already-registered module the create step is a no-op. If your account cannot create modules in the organization, the hub returns a permission error instead of publishing.

### Publishing to a Local Hub

Point `--registry` at a locally running Hub to publish and install without using the public registry. Plain HTTP is allowed only for local hosts: `localhost`, `127.0.0.1`, and the container aliases `host.docker.internal` (Docker Desktop or OrbStack) and `host.containers.internal` (Podman). Other hosts must use HTTPS.

```bash
wippy auth login --registry http://localhost:8080 --token wpy_xxx
wippy publish --registry http://localhost:8080 --create --version 0.1.0
```

The registry and token can also come from the `WIPPY_REGISTRY` and `WIPPY_TOKEN` environment variables. When unset, the registry defaults to `https://hub.wippy.ai`.

### Quotas

If the organization's private-module quota is exhausted, publishing fails with a message such as `cannot publish: Private-module quota exhausted (5 of 5)...`. Make the module public or ask an organization administrator to raise the quota. Uploads and downloads retry automatically after transient network errors.

## Publishing Runtime Defaults

Applications with `type: application` can include runtime configuration defaults in their packs through `publish.runtime` in `wippy.yaml`:

```yaml
type: application
publish:
  runtime:
    source: .wippy.yaml            # default: .wippy.yaml
    sections: [security, registry, override]
    vars: [public_url]
```

| Field | Description |
|-------|-------------|
| `source` | Config file the sections are read from (default: `.wippy.yaml`) |
| `sections` | Runtime config sections copied into pack metadata as defaults |
| `vars` | Explicit allowlist of variables to pack even when unreferenced |

Rules:

- Only variables referenced by the selected sections or published profiles are packed (followed transitively); everything else needs a `vars` entry.
- `${env:...}` references in exported config are rejected — publisher environment never leaks into a pack.
- The machine-local sections `boot`, `extensions`, and `workspace` cannot be exported.
- Only the main application pack provides host runtime defaults; runtime metadata in dependency packs is ignored.

At the destination, configuration precedence runs from application-pack defaults through runtime defaults, local configuration files, selected profiles, and finally CLI overrides.

## Publishing Profiles

Root application profiles are exported into the pack's `runtime.profiles` metadata. Publishing does not select or bake a profile — consumers pick one at run time with `wippy run --profile <name>`:

```yaml
publish:
  profiles:
    enabled: true
    source: config/profiles.yaml   # default: .wippy.yaml
    include: [production]          # omit to publish all non-workspace profiles
```

`include: []` publishes none; an unknown name fails the publish. `workspace` sub-sections are never exported, even inside a published profile. See [Configuration](./configuration.md#profiles) for declaring profiles.

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

## Example Module

**wippy.yaml:**
```yaml
organization: acme
module: cache
type: library
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

  - name: cache
    kind: library.lua
    source: file://cache.lua
    modules:
      - time
```

**src/cache.lua:**
```lua
local time = require("time")

local cache = {}
local store = {}

function cache.set(key, value, ttl)
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
wippy init
wippy update
wippy lint
wippy publish --version 1.0.0
```

## See Also

- [CLI Reference](./cli.md) — Publishing commands and flags
- [Entry Kinds](./entry-kinds.md) — Module and dependency entries
- [Configuration](./configuration.md) — Runtime configuration and profiles
