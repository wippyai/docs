# Environment System

Manages environment variables through configurable storage backends.

## Overview

The environment system separates storage from access:

- **Storages** - Where values are stored (OS, files, memory)
- **Variables** - Named references to values in storages

Variables can be referenced by:
- **Public name** - The `variable` field value (must be unique across the system)
- **Entry ID** - Full `namespace:name` reference

If you don't want a variable to be publicly accessible by name, omit the `variable` field.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `env.storage.memory` | In-memory key-value storage |
| `env.storage.file` | File-based storage (.env format) |
| `env.storage.os` | Read-only OS environment access |
| `env.storage.router` | Chains multiple storages |
| `env.variable` | Named variable referencing a storage |

## Storage Backends

### Memory Storage

Volatile in-memory storage.

```yaml
- name: runtime_env
  kind: env.storage.memory
```

### File Storage

Persistent storage using `.env` file format (`KEY=VALUE` with `#` comments).

```yaml
- name: app_config
  kind: env.storage.file
  file_path: /etc/app/config.env
  auto_create: true
  file_mode: 0600
  dir_mode: 0700
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `file_path` | string | required | Path to .env file |
| `auto_create` | boolean | false | Create file if missing |
| `file_mode` | integer | 0644 | File permissions |
| `dir_mode` | integer | 0755 | Directory permissions |

### OS Storage

Read-only access to operating system environment variables.

```yaml
- name: os_env
  kind: env.storage.os
```

Always read-only. Set operations return `PERMISSION_DENIED`.

### Router Storage

Chains multiple storages. Reads search in order until found. Writes go to first storage only.

```yaml
- name: config
  kind: env.storage.router
  storages:
    - app.config:memory    # Primary (writes here)
    - app.config:file      # Fallback
    - app.config:os        # Fallback
```

| Property | Type | Description |
|----------|------|-------------|
| `storages` | array | Ordered list of storage references |

## Variables

Variables provide named access to storage values.

```yaml
- name: DATABASE_URL
  kind: env.variable
  variable: DATABASE_URL
  storage: app.config:file
  default: postgres://localhost/app
  read_only: false
```

| Property | Type | Description |
|----------|------|-------------|
| `variable` | string | Public variable name (optional, must be unique) |
| `storage` | string | Storage reference (`namespace:name`) |
| `default` | string | Default value if not found |
| `read_only` | boolean | Prevent modifications |

### Variable Naming

Variable names must contain only: `a-z`, `A-Z`, `0-9`, `_`

### Access Patterns

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

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Variable not found | `errors.NOT_FOUND` | no |
| Storage not found | `errors.NOT_FOUND` | no |
| Variable is read-only | `errors.PERMISSION_DENIED` | no |
| Storage is read-only | `errors.PERMISSION_DENIED` | no |
| Invalid variable name | `errors.INVALID` | no |

## Runtime Access

- [env module](lua-env.md) - Lua runtime access

## See Also

- [Security Model](system-security.md) - Access control for environment variables
- [Configuration Guide](guide-configuration.md) - Application configuration patterns
