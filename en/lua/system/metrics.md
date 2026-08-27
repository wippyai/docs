---
title: "Metrics & Telemetry"
description: "Record application counters, gauges, and histogram observations."
---

# Metrics & Telemetry
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

The `metrics` module records application counters, gauges, and histogram observations.

Every function returns `true, nil` after passing the observation to the active collector. If the execution context has no collector, it returns `nil` and a non-retryable `errors.INTERNAL` error.

Labels are optional. Only entries with both a string key and a string value are recorded; other entries are silently ignored. A non-table labels argument is treated as if no labels were supplied.

Metric names are forwarded without local validation.

## Loading

```lua
local metrics = require("metrics")
```

## Counters

### `metrics.counter_inc`

Increment a counter by one.

```lua
metrics.counter_inc("requests_total", {method = "POST"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Metric name |
| `labels` | table? | Label key-value pairs |

**Returns:** `boolean, error`

### `metrics.counter_add`

Add a value to a counter.

```lua
metrics.counter_add("bytes_total", 1024, {direction = "out"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Metric name |
| `value` | number | Value to add |
| `labels` | table? | Label key-value pairs |

**Returns:** `boolean, error`

The runtime forwards the value unchanged and does not require it to be positive.

## Gauges

### `metrics.gauge_set`

Set a gauge to the current value.

```lua
metrics.gauge_set("queue_depth", 42, {queue = "emails"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Metric name |
| `value` | number | Current value |
| `labels` | table? | Label key-value pairs |

**Returns:** `boolean, error`

### `metrics.gauge_inc`

Increment a gauge by one.

```lua
metrics.gauge_inc("connections", {pool = "db"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Metric name |
| `labels` | table? | Label key-value pairs |

**Returns:** `boolean, error`

### `metrics.gauge_dec`

Decrement a gauge by one.

```lua
metrics.gauge_dec("connections", {pool = "db"})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Metric name |
| `labels` | table? | Label key-value pairs |

**Returns:** `boolean, error`

## Histograms

### `metrics.histogram`

Record a histogram observation.

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

Invalid name or value types raise Lua argument errors instead of returning structured errors.

See [Error Handling](lua/core/errors.md) for working with errors.
