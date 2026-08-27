---
title: "Request Context"
description: "Read request-scoped values propagated through function and process calls."
---

# Request Context
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

The `ctx` module reads request-scoped values propagated through [function calls](lua/core/funcs.md) or [process operations](lua/core/process.md).

## Loading

```lua
local ctx = require("ctx")
```

## Context Access

### Get a Value

```lua
local value, err = ctx.get("key")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Context key |

**Returns:** `any, error`

### Get All Values

```lua
local values = ctx.all()
```

**Returns:** `table, nil`

`ctx.all()` always succeeds. It returns an empty table when no request context or no context values are available.

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty key | `errors.INVALID` | no |
| Key not found | `errors.NOT_FOUND` | no |
| No context available (`ctx.get` only) | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
