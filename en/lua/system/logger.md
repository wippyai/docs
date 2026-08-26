---
title: "Logging"
description: "Write structured log messages and create child loggers with persistent context."
---

# Logging
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

The `logger` module writes structured messages at debug, info, warn, and error levels.

## Loading

```lua
local logger = require("logger")
```

## Log Levels

### `logger:debug`

Write a debug-level log message.

```lua
logger:debug("message", {key = "value"})
```

### `logger:info`

Write an info-level log message.

```lua
logger:info("message", {key = "value"})
```

### `logger:warn`

Write a warning-level log message.

```lua
logger:warn("message", {key = "value"})
```

### `logger:error`

Write an error-level log message.

```lua
logger:error("message", {key = "value"})
```

All four log-level methods accept the same parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Log message |
| `fields` | table? | Contextual key-value pairs |

## Logger Customization

### `logger:with`

Create a child logger that adds the same fields to every message.

```lua
local child = logger:with({request_id = id})
child:info("message")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `fields` | table | Fields to attach to all logs |

**Returns:** `Logger`

### `logger:named`

Create a child logger with a name.

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

See [Error Handling](lua/core/errors.md) for working with errors.
