# Metricas e Telemetria
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Registre metricas de aplicacao usando contadores, gauges e histogramas.

## Carregamento

```lua
local metrics = require("metrics")
```

## Contadores

### Incrementar Contador

```lua
metrics.counter_inc("requests_total", {method = "POST"})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `name` | string | Nome da metrica |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

### Adicionar ao Contador

```lua
metrics.counter_add("bytes_total", 1024, {direction = "out"})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `name` | string | Nome da metrica |
| `value` | number | Valor a adicionar |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

## Gauges

### Definir Gauge

```lua
metrics.gauge_set("queue_depth", 42, {queue = "emails"})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `name` | string | Nome da metrica |
| `value` | number | Valor atual |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

### Incrementar Gauge

```lua
metrics.gauge_inc("connections", {pool = "db"})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `name` | string | Nome da metrica |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

### Decrementar Gauge

```lua
metrics.gauge_dec("connections", {pool = "db"})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `name` | string | Nome da metrica |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

## Histogramas

### Registrar Observacao

```lua
metrics.histogram("duration_seconds", 0.123, {method = "GET"})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `name` | string | Nome da metrica |
| `value` | number | Valor observado |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Coletor nao disponivel | `errors.INTERNAL` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
