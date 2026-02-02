# UUID Generation
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Generate universally unique identifiers. Adapted for workflows - random UUIDs return consistent values on replay.

## Loading

```lua
local uuid = require("uuid")
```

## Random UUIDs

### Version 1

Time-based UUID with timestamp and node ID.

```lua
local id, err = uuid.v1()
```

**Returns:** `string, error`

### Version 4

Random UUID.

```lua
local id, err = uuid.v4()
```

**Returns:** `string, error`

### Version 7

Time-ordered UUID. Sortable by creation time.

```lua
local id, err = uuid.v7()
```

**Returns:** `string, error`

## Deterministic UUIDs

### Version 3

Deterministic UUID from namespace and name using MD5.

```lua
local id, err = uuid.v3(namespace, name)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `namespace` | string | Valid UUID string |
| `name` | string | Value to hash |

**Returns:** `string, error`

### Version 5

Deterministic UUID from namespace and name using SHA-1.

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `namespace` | string | Valid UUID string |
| `name` | string | Value to hash |

**Returns:** `string, error`

## Inspection

### Validate

```lua
local valid = uuid.validate(input)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | any | Value to check |

**Returns:** `boolean`

### Get Version

```lua
local ver, err = uuid.version(id)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `uuid` | string | Valid UUID string |

**Returns:** `integer, error`

### Get Variant

```lua
local var, err = uuid.variant(id)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `uuid` | string | Valid UUID string |

**Returns:** `string, error` (RFC4122, Microsoft, NCS, or Invalid)

### Parse

```lua
local info, err = uuid.parse(id)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `uuid` | string | Valid UUID string |

**Returns:** `table, error`

Returned table fields:
- `version` (integer): UUID version (1, 3, 4, 5, or 7)
- `variant` (string): RFC4122, Microsoft, NCS, or Invalid
- `timestamp` (integer): Unix timestamp (v1 and v7 only)
- `node` (string): Node ID (v1 only)

### Format

```lua
local formatted, err = uuid.format(id, "standard")
local formatted, err = uuid.format(id, "simple")
local formatted, err = uuid.format(id, "urn")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `uuid` | string | Valid UUID string |
| `format` | string? | standard (default), simple, or urn |

**Returns:** `string, error`

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Invalid input type | `errors.INVALID` | no |
| Invalid UUID format | `errors.INVALID` | no |
| Unsupported format type | `errors.INVALID` | no |
| Generation failed | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
