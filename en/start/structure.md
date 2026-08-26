---
title: "YAML & Project Structure"
description: "Project layout, YAML definition files, and naming conventions."
---

# YAML & Project Structure

## Directory Layout

```
myapp/
├── .wippy.yaml          # Runtime configuration
├── wippy.lock           # Source directories config
├── .wippy/              # Installed modules
└── src/                 # Application source
    ├── _index.yaml      # Entry definitions
    ├── api/
    │   ├── _index.yaml
    │   └── *.lua
    └── workers/
        ├── _index.yaml
        └── *.lua
```

## YAML Definition Files

<note>
YAML definitions are loaded into the registry at startup. The registry is the source of truth; YAML files are one way to populate it. Entries can also come from other sources or be created programmatically.
</note>

### Definition File Format

A definition file contains a `namespace` and either an `entries` array or top-level `name` and `kind` fields. The `version` field is optional:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: Fetches user by ID
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: User API endpoint
    method: GET
    path: /users/{id}
    func: get_user
```

| Field | Required | Description |
|-------|----------|-------------|
| `version` | No | Schema version (currently `"1.0"`) |
| `namespace` | Yes | Entry namespace for this file |
| `entries` | Yes | Array of entry definitions |

### Naming Convention

Use dots (`.`) for semantic separation and underscores (`_`) for words:

```yaml
# Function and its endpoint
- name: get_user              # The function
- name: get_user.endpoint     # Its HTTP endpoint

# Multiple endpoints for same function
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# Routers
- name: api.public            # Public API router
- name: api.admin             # Admin API router
```

<tip>
Pattern: <code>base_name.variant</code> — dots separate semantic parts, while underscores separate words within a part.
</tip>

### Namespaces

Namespaces are dot-separated identifiers:

```
app
app.api
app.api.v2
app.workers
```

Entry full ID combines namespace and name: `app.api:get_user`

### Source Directories

The `wippy.lock` file defines where Wippy loads definitions from:

```yaml
directories:
  modules: .wippy
  src: ./src
```

Wippy recursively scans these directories for YAML files.

## Entry Definitions

Each item in the `entries` array defines one entry. Its properties are at the root level, without a `data:` wrapper:

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: Returns hello world
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Hello endpoint
    method: GET
    path: /hello
    func: hello
```

### Metadata

Use `meta` for UI-friendly information:

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: Payment Processor
    comment: Handles Stripe payments
  source: file://payment.lua
```

Use `meta.title` and `meta.comment` for text displayed in management interfaces.

### Application Entries

Use `registry.entry` kind for application-level configuration:

```yaml
- name: config
  kind: registry.entry
  meta:
    title: Application Settings
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## Common Entry Kinds

| Kind | Purpose |
|------|---------|
| `registry.entry` | General-purpose data |
| `function.lua` | Callable Lua function |
| `process.lua` | Long-running process |
| `http.service` | HTTP server |
| `http.router` | Route group |
| `http.endpoint` | HTTP handler |
| `process.host` | Process supervisor |

See the [Entry Kinds Guide](guides/entry-kinds.md) for the entry-kind reference.

## Configuration Files

### .wippy.yaml

Runtime configuration at project root:

```yaml
version: "1.0"

logger:
  encoding: json

logmanager:
  min_level: 0

supervisor:
  host:
    worker_count: 16
```

See the [Configuration Guide](guides/configuration.md) for runtime configuration fields.

### wippy.lock

Defines source directories:

```yaml
directories:
  modules: .wippy
  src: ./src
```

## Referencing Entries

Reference entries by full ID or relative name. Children attach to their parent through `meta`, not via parent-side lists:

```yaml
# Router declares itself against a server
- name: api
  kind: http.router
  meta:
    server: app:gateway
  prefix: /api

# Endpoint references router by registry ID (cross-namespace works the same way)
- name: get_user.endpoint
  kind: http.endpoint
  meta:
    router: app.api:api
  method: GET
  path: /users/{id}
  func: app.api:get_user
```

## Example Project

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

## See Also

- [Application Architecture](concepts/architecture.md) — Organize an application into slices and layers
- [Entry Kinds Guide](guides/entry-kinds.md) — Review available entry kinds
- [Configuration Guide](guides/configuration.md) — Configure runtime options
- [Custom Entry Kinds](internals/kinds.md) — Implement handlers (advanced)
