# Metriken & Telemetrie
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Erfassen Sie Anwendungsmetriken mit Countern, Gauges und Histogrammen.

## Laden

```lua
local metrics = require("metrics")
```

## Counter

### Counter inkrementieren

```lua
metrics.counter_inc("requests_total", {method = "POST"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Metrik-Name |
| `labels` | table? | Label-Schlussel-Wert-Paare |

**Gibt zuruck:** `boolean, error`

### Zu Counter addieren

```lua
metrics.counter_add("bytes_total", 1024, {direction = "out"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Metrik-Name |
| `value` | number | Zu addierender Wert |
| `labels` | table? | Label-Schlussel-Wert-Paare |

**Gibt zuruck:** `boolean, error`

## Gauges

### Gauge setzen

```lua
metrics.gauge_set("queue_depth", 42, {queue = "emails"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Metrik-Name |
| `value` | number | Aktueller Wert |
| `labels` | table? | Label-Schlussel-Wert-Paare |

**Gibt zuruck:** `boolean, error`

### Gauge inkrementieren

```lua
metrics.gauge_inc("connections", {pool = "db"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Metrik-Name |
| `labels` | table? | Label-Schlussel-Wert-Paare |

**Gibt zuruck:** `boolean, error`

### Gauge dekrementieren

```lua
metrics.gauge_dec("connections", {pool = "db"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Metrik-Name |
| `labels` | table? | Label-Schlussel-Wert-Paare |

**Gibt zuruck:** `boolean, error`

## Histogramme

### Beobachtung aufzeichnen

```lua
metrics.histogram("duration_seconds", 0.123, {method = "GET"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Metrik-Name |
| `value` | number | Beobachteter Wert |
| `labels` | table? | Label-Schlussel-Wert-Paare |

**Gibt zuruck:** `boolean, error`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Collector nicht verfugbar | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) fur die Arbeit mit Fehlern.
