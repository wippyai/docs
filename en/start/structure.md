# YAML & Project Structure

Project layout, YAML definition files, and naming conventions.

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
YAML definitions are loaded into the registry at startup. The registry is the source of truth - YAML files are one way to populate it. Entries can also come from other sources or be created programmatically.
</note>

### File Structure

Any YAML file with `version` and `namespace` is valid:

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
| `version` | yes | Schema version (currently `"1.0"`) |
| `namespace` | yes | Entry namespace for this file |
| `entries` | yes | Array of entry definitions |

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
Pattern: <code>base_name.variant</code> - dots separate semantic parts, underscores separate words within a part.
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

Each entry in the `entries` array. Properties are at root level (no `data:` wrapper):

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

Convention: `meta.title` and `meta.comment` render nicely in management UIs.

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

See [Entry Kinds Guide](guide-entry-kinds.md) for complete reference.

## Configuration Files

### .wippy.yaml

Runtime configuration at project root:

```yaml
logger:
  level: info
  mode: production

host:
  worker_count: 16

http:
  address: :8080
```

See [Configuration Guide](guide-configuration.md) for all options.

### wippy.lock

Defines source directories:

```yaml
directories:
  modules: .wippy
  src: ./src
```

## Referencing Entries

Reference entries by full ID or relative name:

```yaml
# Full ID (cross-namespace)
- name: main.router
  kind: http.router
  endpoints:
    - app.api:get_user.endpoint
    - app.api:list_orders.endpoint

# Same namespace - just use name
- name: get_user.endpoint
  kind: http.endpoint
  func: get_user
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

- [Entry Kinds Guide](guide-entry-kinds.md) - Available entry kinds
- [Configuration Guide](guide-configuration.md) - Runtime options
- [Custom Entry Kinds](internal-kinds.md) - Implementing handlers (advanced)
