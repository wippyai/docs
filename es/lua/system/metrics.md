---
title: "Metricas y Telemetria"
description: "Registra contadores, gauges y observaciones de histogramas de la aplicación."
---

# Metricas y Telemetria
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

El módulo `metrics` registra contadores, gauges y observaciones de histogramas de la aplicación.

Esta es una referencia de API. Los fragmentos muestran una observación cada vez y propagan los errores del colector.

Cada función devuelve `true, nil` después de pasar la observación al colector activo. Si el contexto de ejecución no tiene colector, devuelve `nil` y un error `errors.INTERNAL` no reintentable.

Las etiquetas son opcionales. Solo se registran las entradas cuya clave y valor son strings; las demás se ignoran silenciosamente. Un argumento de etiquetas que no sea una tabla se trata como si no se hubieran proporcionado etiquetas.

Los nombres de métricas se reenvían sin validación local.

## Carga

```lua
local metrics = require("metrics")
```

## Contadores

### `metrics.counter_inc`

Incrementa un contador en uno.

```lua
local recorded, err = metrics.counter_inc("requests_total", {method = "POST"})
if err then return nil, err end
return recorded
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre de metrica |
| `labels` | table? | Pares clave-valor de etiquetas |

**Devuelve:** `boolean, error`

### `metrics.counter_add`

Añade un valor a un contador.

```lua
local recorded, err = metrics.counter_add("bytes_total", 1024, {direction = "out"})
if err then return nil, err end
return recorded
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre de metrica |
| `value` | number | Valor a agregar |
| `labels` | table? | Pares clave-valor de etiquetas |

**Devuelve:** `boolean, error`

El entorno de ejecución reenvía el valor sin modificar y no exige que sea positivo.

## Gauges

### `metrics.gauge_set`

Establece el valor actual de un gauge.

```lua
local recorded, err = metrics.gauge_set("queue_depth", 42, {queue = "emails"})
if err then return nil, err end
return recorded
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre de metrica |
| `value` | number | Valor actual |
| `labels` | table? | Pares clave-valor de etiquetas |

**Devuelve:** `boolean, error`

### `metrics.gauge_inc`

Incrementa un gauge en uno.

```lua
local recorded, err = metrics.gauge_inc("connections", {pool = "db"})
if err then return nil, err end
return recorded
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre de metrica |
| `labels` | table? | Pares clave-valor de etiquetas |

**Devuelve:** `boolean, error`

### `metrics.gauge_dec`

Decrementa un gauge en uno.

```lua
local recorded, err = metrics.gauge_dec("connections", {pool = "db"})
if err then return nil, err end
return recorded
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre de metrica |
| `labels` | table? | Pares clave-valor de etiquetas |

**Devuelve:** `boolean, error`

## Histogramas

### `metrics.histogram`

Registra una observación en un histograma.

```lua
local recorded, err = metrics.histogram("duration_seconds", 0.123, {method = "GET"})
if err then return nil, err end
return recorded
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre de metrica |
| `value` | number | Valor observado |
| `labels` | table? | Pares clave-valor de etiquetas |

**Devuelve:** `boolean, error`

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Colector no disponible | `errors.INTERNAL` | no |

Los nombres o valores de tipo no válido generan errores de argumentos Lua en lugar de devolver errores estructurados.

Consulte [Manejo de Errores](../core/errors.md) para trabajar con errores.
