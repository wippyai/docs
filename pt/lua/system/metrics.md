---
title: "Métricas e Telemetria"
description: "Registre contadores, gauges e observações de histogramas da aplicação."
---

# Métricas e Telemetria
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

O módulo `metrics` registra contadores, gauges e observações de histogramas da aplicação.

Esta é uma referência de API. Cada exemplo mostra uma observação isolada e propaga erros do collector.

Todas as funções retornam `true, nil` depois de enviar a observação ao collector ativo. Se o contexto de execução não tiver um collector, retornam `nil` e um erro `errors.INTERNAL` não retentável.

Labels são opcionais. Apenas entradas com chave string e valor string são registradas; as demais são ignoradas silenciosamente. Um argumento de labels que não seja tabela é tratado como se nenhum label tivesse sido fornecido.

Os nomes das métricas são encaminhados sem validação local.

## Carregamento

```lua
local metrics = require("metrics")
```

## Contadores

### `metrics.counter_inc`

Incrementa um contador em um.

```lua
local recorded, err = metrics.counter_inc("requests_total", {method = "POST"})
if err then return nil, err end
return recorded
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da métrica |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

### `metrics.counter_add`

Adiciona um valor a um contador.

```lua
local recorded, err = metrics.counter_add("bytes_total", 1024, {direction = "out"})
if err then return nil, err end
return recorded
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da métrica |
| `value` | number | Valor a adicionar |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

O runtime encaminha o valor sem alterações e não exige que ele seja positivo.

## Gauges

### `metrics.gauge_set`

Define um gauge com o valor atual.

```lua
local recorded, err = metrics.gauge_set("queue_depth", 42, {queue = "emails"})
if err then return nil, err end
return recorded
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da métrica |
| `value` | number | Valor atual |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

### `metrics.gauge_inc`

Incrementa um gauge em um.

```lua
local recorded, err = metrics.gauge_inc("connections", {pool = "db"})
if err then return nil, err end
return recorded
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da métrica |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

### `metrics.gauge_dec`

Decrementa um gauge em um.

```lua
local recorded, err = metrics.gauge_dec("connections", {pool = "db"})
if err then return nil, err end
return recorded
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da métrica |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

## Histogramas

### `metrics.histogram`

Registra uma observação de histograma.

```lua
local recorded, err = metrics.histogram("duration_seconds", 0.123, {method = "GET"})
if err then return nil, err end
return recorded
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da métrica |
| `value` | number | Valor observado |
| `labels` | table? | Pares chave-valor de labels |

**Retorna:** `boolean, error`

## Erros

| Condição | Kind | Retentável |
|----------|------|------------|
| Coletor não disponível | `errors.INTERNAL` | não |

Tipos inválidos de nome ou valor geram erros de argumento Lua, em vez de retornar erros estruturados.

Consulte [Tratamento de erros](../core/errors.md) para trabalhar com erros.
