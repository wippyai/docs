# Logging
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

Structured logging with debug, info, warn, and error levels.

## Loading

```lua
local logger = require("logger")
```

## Log Levels

### Debug

```lua
logger:debug("message", {key = "value"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Log message |
| `fields` | table? | Contextual key-value pairs |

### Info

```lua
logger:info("message", {key = "value"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Log message |
| `fields` | table? | Contextual key-value pairs |

### Warn

```lua
logger:warn("message", {key = "value"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Log message |
| `fields` | table? | Contextual key-value pairs |

### Error

```lua
logger:error("message", {key = "value"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Log message |
| `fields` | table? | Contextual key-value pairs |

## Logger Customization

### With Fields

Create a child logger with persistent fields.

```lua
local child = logger:with({request_id = id})
child:info("message")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `fields` | table | Fields to attach to all logs |

**Returns:** `Logger`

### Named Logger

Create a named child logger.

```lua
local named = logger:named("auth")
named:info("message")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Logger name |

**Returns:** `Logger`

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty name string | `errors.INVALID` | no |

See [Error Handling](lua-errors.md) for working with errors.
