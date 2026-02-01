# Metricas y Telemetria
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Registrar metricas de aplicacion usando contadores, gauges e histogramas.

## Carga

```lua
local metrics = require("metrics")
```

## Contadores

### Incrementar Contador

```lua
metrics.counter_inc("requests_total", {method = "POST"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre de metrica |
| `labels` | table? | Pares clave-valor de etiquetas |

**Devuelve:** `boolean, error`

### Agregar a Contador

```lua
metrics.counter_add("bytes_total", 1024, {direction = "out"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre de metrica |
| `value` | number | Valor a agregar |
| `labels` | table? | Pares clave-valor de etiquetas |

**Devuelve:** `boolean, error`

## Gauges

### Establecer Gauge

```lua
metrics.gauge_set("queue_depth", 42, {queue = "emails"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre de metrica |
| `value` | number | Valor actual |
| `labels` | table? | Pares clave-valor de etiquetas |

**Devuelve:** `boolean, error`

### Incrementar Gauge

```lua
metrics.gauge_inc("connections", {pool = "db"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre de metrica |
| `labels` | table? | Pares clave-valor de etiquetas |

**Devuelve:** `boolean, error`

### Decrementar Gauge

```lua
metrics.gauge_dec("connections", {pool = "db"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre de metrica |
| `labels` | table? | Pares clave-valor de etiquetas |

**Devuelve:** `boolean, error`

## Histogramas

### Registrar Observacion

```lua
metrics.histogram("duration_seconds", 0.123, {method = "GET"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre de metrica |
| `value` | number | Valor observado |
| `labels` | table? | Pares clave-valor de etiquetas |

**Devuelve:** `boolean, error`

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Colector no disponible | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
