---
title: "Metrics & Telemetry"
description: "Record application counters, gauges, and histogram observations."
---

# Metrics & Telemetry
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

The `metrics` module records application counters, gauges, and histogram observations.

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

See [Error Handling](lua/core/errors.md) for working with errors.
