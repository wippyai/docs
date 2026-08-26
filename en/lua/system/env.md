---
title: "Environment Variables"
description: "Read and update environment variables exposed by the configured environment system."
---

# Environment Variables
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

The `env` module reads and updates environment variables exposed by the runtime.

Variables must be defined in the [Environment System](system/env.md) before they can be accessed. The system controls which storage backends (OS, file, memory) provide values and whether variables are read-only.

## Loading

```lua
local env = require("env")
```

## `get`

Retrieve an environment variable.

```lua
-- Get database connection string
local db_url = env.get("DATABASE_URL")
if not db_url then
    return nil, errors.new({
        message = "DATABASE_URL not configured",
        kind = errors.INVALID
    })
end

-- Get with fallback
local port = env.get("PORT") or "8080"
local host = env.get("HOST") or "localhost"

-- Get secrets
local api_key = env.get("API_SECRET_KEY")
local jwt_secret = env.get("JWT_SECRET")

-- Configuration
local log_level = env.get("LOG_LEVEL") or "info"
local debug_mode = env.get("DEBUG") == "true"
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Variable name |

**Returns:** `string, error`

The function returns `nil, error` when the variable does not exist.

## `set`

Set an environment variable.

```lua
-- Set runtime configuration
env.set("APP_MODE", "production")

-- Override for testing
env.set("API_URL", "http://localhost:8080")

-- Set based on conditions
if is_development then
    env.set("LOG_LEVEL", "debug")
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Variable name |
| `value` | string | Value to set |

**Returns:** `boolean, error`

## `get_all`

Retrieve all environment variables accessible to the caller.

```lua
local vars = env.get_all()

-- Log configuration (be careful not to log secrets)
for key, value in pairs(vars) do
    if not key:match("SECRET") and not key:match("KEY") then
        logger.debug("env", {[key] = value})
    end
end

-- Check required variables
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new({
            message = "Missing required env var: " .. key,
            kind = errors.INVALID
        })
    end
end
```

**Returns:** `table, error`

## Permissions

Security policy evaluation applies to environment access.

### Security Actions

| Action | Resource | Description |
|--------|----------|-------------|
| `env.get` | Variable name | Read environment variable |
| `env.set` | Variable name | Write environment variable |

`get_all` has no dedicated security action: it returns only the variables for which the `env.get` action is permitted, filtering each variable name through `env.get`.

### Checking Access

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

See [Security Model](system/security.md) for policy configuration.

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty key | `errors.INVALID` | no |
| Variable not found | `errors.NOT_FOUND` | no |
| Permission denied | `errors.PERMISSION_DENIED` | no |

See [Error Handling](lua/core/errors.md) for working with errors.

## See Also

- [Environment System](system/env.md) - Configure storage backends and variable definitions
