# Request Context
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Access request-scoped context values. Context is set via [Funcs](lua/core/funcs.md) or [Process](lua/core/process.md).

## Loading

```lua
local ctx = require("ctx")
```

## Context Access

### Get Value

```lua
local value, err = ctx.get("key")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Context key |

**Returns:** `any, error`

### Get All Values

```lua
local values, err = ctx.all()
```

**Returns:** `table, error`

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty key | `errors.INVALID` | no |
| Key not found | `errors.NOT_FOUND` | no |
| No context available | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
