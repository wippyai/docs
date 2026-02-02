# Metricas e Telemetria
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Registre metricas de aplicação usando contadores, gauges e histogramas.

## Carregamento

```lua
local metrics = require("metrics")
```

## Contadores

### Incrementar Contador

```lua
metrics.counter_inc("requests_total", {method = "POST"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da metrica |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

### Adicionar ao Contador

```lua
metrics.counter_add("bytes_total", 1024, {direction = "out"})
```

| Parâmetro | Tipo | Descrição |
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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da metrica |
| `value` | number | Valor atual |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

### Incrementar Gauge

```lua
metrics.gauge_inc("connections", {pool = "db"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da metrica |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

### Decrementar Gauge

```lua
metrics.gauge_dec("connections", {pool = "db"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da metrica |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

## Histogramas

### Registrar Observação

```lua
metrics.histogram("duration_seconds", 0.123, {method = "GET"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da metrica |
| `value` | number | Valor observado |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Coletor não disponível | `errors.INTERNAL` | não |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
