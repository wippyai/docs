# Metrics & Telemetry
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Record application metrics using counters, gauges, and histograms.

## Loading

```lua
local metrics = require("metrics")
```

## Counters

### Increment Counter

```lua
metrics.counter_inc("requests_total", {method = "POST"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Metric name |
| `labels` | table? | Label key-value pairs |

**Returns:** `boolean, error`

### Add to Counter

```lua
metrics.counter_add("bytes_total", 1024, {direction = "out"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Metric name |
| `value` | number | Value to add |
| `labels` | table? | Label key-value pairs |

**Returns:** `boolean, error`

## Gauges

### Set Gauge

```lua
metrics.gauge_set("queue_depth", 42, {queue = "emails"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Metric name |
| `value` | number | Current value |
| `labels` | table? | Label key-value pairs |

**Returns:** `boolean, error`

### Increment Gauge

```lua
metrics.gauge_inc("connections", {pool = "db"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Metric name |
| `labels` | table? | Label key-value pairs |

**Returns:** `boolean, error`

### Decrement Gauge

```lua
metrics.gauge_dec("connections", {pool = "db"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Metric name |
| `labels` | table? | Label key-value pairs |

**Returns:** `boolean, error`

## Histograms

### Record Observation

```lua
metrics.histogram("duration_seconds", 0.123, {method = "GET"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Metric name |
| `value` | number | Observed value |
| `labels` | table? | Label key-value pairs |

**Returns:** `boolean, error`

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Collector not available | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
