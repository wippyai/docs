---
title: "Metriken & Telemetrie"
description: "Anwendungs-Counter, Gauges und Histogrammbeobachtungen erfassen."
---

# Metriken & Telemetrie
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Das Modul `metrics` erfasst Anwendungs-Counter, Gauges und Histogrammbeobachtungen.

Diese Seite ist eine API-Referenz. Die Ausschnitte zeigen jeweils eine Beobachtung und reichen Collector-Fehler weiter.

Nach der Übergabe an den aktiven Collector liefert jede Funktion `true, nil`. Ist im Ausführungskontext kein Collector vorhanden, liefert sie `nil` und einen nicht wiederholbaren Fehler `errors.INTERNAL`.

Labels sind optional. Nur Einträge mit Zeichenkettenschlüssel und Zeichenkettenwert werden erfasst; andere Einträge werden stillschweigend ignoriert. Ein nicht tabellarisches Labels-Argument wird wie ein fehlendes Argument behandelt.

Metriknamen werden ohne lokale Validierung weitergereicht.

## Laden

```lua
local metrics = require("metrics")
```

## Counter

### `metrics.counter_inc`

Erhöht einen Counter um eins.

```lua
local recorded, err = metrics.counter_inc("requests_total", {method = "POST"})
if err then return nil, err end
return recorded
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Metrik-Name |
| `labels` | table? | Label-Schlüssel-Wert-Paare |

**Gibt zurück:** `boolean, error`

### `metrics.counter_add`

Addiert einen Wert zu einem Counter.

```lua
local recorded, err = metrics.counter_add("bytes_total", 1024, {direction = "out"})
if err then return nil, err end
return recorded
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Metrik-Name |
| `value` | number | Zu addierender Wert |
| `labels` | table? | Label-Schlüssel-Wert-Paare |

**Gibt zurück:** `boolean, error`

Die Runtime reicht den Wert unverändert weiter und verlangt keinen positiven Wert.

## Gauges

### `metrics.gauge_set`

```lua
local recorded, err = metrics.gauge_set("queue_depth", 42, {queue = "emails"})
if err then return nil, err end
return recorded
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Metrik-Name |
| `value` | number | Aktueller Wert |
| `labels` | table? | Label-Schlüssel-Wert-Paare |

**Gibt zurück:** `boolean, error`

### `metrics.gauge_inc`

```lua
local recorded, err = metrics.gauge_inc("connections", {pool = "db"})
if err then return nil, err end
return recorded
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Metrik-Name |
| `labels` | table? | Label-Schlüssel-Wert-Paare |

**Gibt zurück:** `boolean, error`

### `metrics.gauge_dec`

```lua
local recorded, err = metrics.gauge_dec("connections", {pool = "db"})
if err then return nil, err end
return recorded
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Metrik-Name |
| `labels` | table? | Label-Schlüssel-Wert-Paare |

**Gibt zurück:** `boolean, error`

## Histogramme

### `metrics.histogram`

```lua
local recorded, err = metrics.histogram("duration_seconds", 0.123, {method = "GET"})
if err then return nil, err end
return recorded
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Metrik-Name |
| `value` | number | Beobachteter Wert |
| `labels` | table? | Label-Schlüssel-Wert-Paare |

**Gibt zurück:** `boolean, error`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Collector nicht verfügbar | `errors.INTERNAL` | nein |

Ungültige Typen für Name oder Wert lösen Lua-Argumentfehler aus, statt strukturierte Fehler zurückzugeben.

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
