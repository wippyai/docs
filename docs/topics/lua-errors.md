# Errors
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Structured error handling with categorization and retry metadata. Global `errors` table available without require.

## Creating Errors

```lua
-- Simple message (kind defaults to UNKNOWN)
local err = errors.new("something went wrong")

-- With kind
local err = errors.new(errors.NOT_FOUND, "user not found")

-- Full constructor
local err = errors.new({
    message = "user not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})
```

## Wrapping Errors

Add context while preserving kind, retryable, and details:

```lua
local data, err = db.query("SELECT * FROM users")
if err then
    return nil, errors.wrap(err, "failed to load users")
end
```

## Error Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `err:kind()` | string | Error category |
| `err:message()` | string | Error message |
| `err:retryable()` | boolean/nil | Whether operation can be retried |
| `err:details()` | table/nil | Structured metadata |
| `err:stack()` | string | Lua stack trace |
| `tostring(err)` | string | Full representation |

## Checking Kind

```lua
if errors.is(err, errors.INVALID) then
    -- handle invalid input
end

-- Or compare directly
if err:kind() == errors.NOT_FOUND then
    -- handle missing resource
end
```

## Error Kinds

| Constant | Use Case |
|----------|----------|
| `errors.NOT_FOUND` | Resource doesn't exist |
| `errors.ALREADY_EXISTS` | Resource already exists |
| `errors.INVALID` | Bad input or arguments |
| `errors.PERMISSION_DENIED` | Access denied |
| `errors.UNAVAILABLE` | Service temporarily down |
| `errors.INTERNAL` | Internal error |
| `errors.CANCELED` | Operation was canceled |
| `errors.CONFLICT` | Resource state conflict |
| `errors.TIMEOUT` | Operation timed out |
| `errors.RATE_LIMITED` | Too many requests |
| `errors.UNKNOWN` | Unspecified error |

## Call Stack

Get structured call stack:

```lua
local stack = errors.call_stack(err)
if stack then
    print("Thread:", stack.thread)
    for _, frame in ipairs(stack.frames) do
        print(frame.source .. ":" .. frame.line, frame.name)
    end
end
```

## Retryable Errors

| Typically Retryable | Not Retryable |
|---------------------|---------------|
| `TIMEOUT` | `INVALID` |
| `UNAVAILABLE` | `NOT_FOUND` |
| `RATE_LIMITED` | `PERMISSION_DENIED` |
| | `ALREADY_EXISTS` |

```lua
if err:retryable() then
    -- safe to retry
end
```

## Error Details

```lua
local err = errors.new({
    message = "validation failed",
    kind = errors.INVALID,
    details = {
        errors = {
            {field = "email", message = "invalid format"},
            {field = "age", message = "must be positive"}
        }
    }
})

local details = err:details()
for _, e in ipairs(details.errors) do
    print(e.field, e.message)
end
```
