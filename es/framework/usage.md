---
title: "Seguimiento de Uso"
description: "El modulo wippy/usage registra el consumo de tokens de LLM y proporciona consultas agregadas agrupadas por intervalo de tiempo, modelo o usuario. Se…"
---

# Seguimiento de Uso

El modulo `wippy/usage` registra el consumo de tokens de LLM y proporciona consultas agregadas agrupadas por intervalo de tiempo, modelo o usuario. Se vincula al contrato `wippy.llm:usage_tracker`, por lo que cualquier codigo que llame a traves del modulo LLM produce automaticamente registros de uso.

## Configuracion

Agrega el modulo a tu proyecto:

```bash
wippy add wippy/usage
wippy install
```

Declara la dependencia y apunta el requisito `target_db` a la base de datos donde deben residir los registros de uso:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.usage
    kind: ns.dependency
    component: wippy/usage
    version: "*"

  - name: target_db
    kind: registry.entry
    meta:
      wippy.usage.target_db: app:app_db
```

Cuando la aplicacion inicia, `wippy/migration` ejecuta la migracion `01_create_token_usage_table` del modulo, la cual crea la tabla `token_usage` junto con indices en `user_id`, `context_id`, `model_id` y `timestamp`.

## Esquema

```
token_usage
├── usage_id           text primary key (uuid v7)
├── user_id            text not null
├── context_id         text
├── model_id           text not null
├── prompt_tokens      integer
├── completion_tokens  integer
├── thinking_tokens    integer default 0
├── cache_read_tokens  integer default 0
├── cache_write_tokens integer default 0
├── timestamp          timestamp
└── meta               text (JSON)
```

## Seguimiento Automatico

`wippy/llm` resuelve el contrato `wippy.llm:usage_tracker` antes de cada generacion. `wippy/usage` vincula su implementacion como la predeterminada:

```yaml
contracts:
  - contract: wippy.llm:usage_tracker
    default: true
    methods:
      track_usage: wippy.usage:usage_tracker
```

Cada llamada LLM exitosa invoca `track_usage` con el id del modelo, los recuentos de tokens y un `context_id` opcional. El `user_id` se toma del actor de seguridad activo; las llamadas fuera de un contexto de usuario se registran como `"system"`.

## API del Tracker

Importa el tracker directamente cuando necesites registrar uso fuera del flujo LLM:

```yaml
imports:
  usage_tracker: wippy.usage:usage_tracker
```

```lua
local tracker = require("usage_tracker")

local usage_id, err = tracker.track_usage(
    "openai:gpt-4o",
    prompt_tokens,
    completion_tokens,
    thinking_tokens,
    cache_read_tokens,
    cache_write_tokens,
    { context_id = "chat-42", metadata = { feature = "summary" } }
)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `model_id` | string | Id canonico del modelo |
| `prompt_tokens` | number | Tokens de entrada |
| `completion_tokens` | number | Tokens de salida |
| `thinking_tokens` | number | Tokens de razonamiento (0 cuando no se reporta) |
| `cache_read_tokens` | number | Aciertos de cache de prompt |
| `cache_write_tokens` | number | Escrituras de cache de prompt |
| `options.context_id` | string | Etiqueta de forma libre; recurre a `ctx.get("context_id")` |
| `options.timestamp` | number | Timestamp Unix; por defecto ahora (UTC) |
| `options.metadata` | table | Metadatos JSON arbitrarios almacenados junto con el registro |

Retorna `usage_id` o `nil, err`.

## API del Repositorio

`wippy.usage:token_usage_repo` ofrece consultas agregadas:

```yaml
imports:
  usage: wippy.usage:token_usage_repo
```

```lua
local usage = require("usage")

local summary  = usage.get_summary(start_unix, end_unix)
local by_time  = usage.get_usage_by_time(start_unix, end_unix, usage.INTERVAL.DAY)
local by_model = usage.get_usage_by_model(start_unix, end_unix)
local by_user  = usage.get_usage_by_user(start_unix, end_unix)
```

### Funciones

| Funcion | Retorna |
|---------|---------|
| `get_summary(start, end)` | Totales en el rango: tokens de prompt/completion/thinking/cache, recuento de solicitudes, `total_tokens` (prompt + completion + thinking) |
| `get_usage_by_time(start, end, interval)` | Array de intervalos, uno por intervalo; los intervalos faltantes retornan ceros |
| `get_usage_by_model(start, end)` | Totales por modelo, ordenados por `total_tokens` descendente |
| `get_usage_by_user(start, end)` | Totales por usuario, ordenados por `total_tokens` descendente |
| `create(user_id, model_id, prompt, completion, options)` | Insercion de bajo nivel usada por el tracker |

### Intervalos

```lua
usage.INTERVAL.HOUR   -- "hour"
usage.INTERVAL.DAY    -- "day"
usage.INTERVAL.WEEK   -- "week"
usage.INTERVAL.MONTH  -- "month"
```

`get_usage_by_time` alinea los intervalos al intervalo configurado. En PostgreSQL usa `generate_series` con aritmetica de intervalos; en SQLite usa un CTE recursivo sobre timestamps UNIX. `total_tokens` en cada intervalo excluye los tokens de cache.

### Rangos de Tiempo

Tanto el tracker como el repositorio aceptan timestamps UNIX en el limite de la API publica. Internamente el repositorio convierte a cadenas RFC3339 para almacenamiento y consulta. Pasa valores `os.time()` o `time.now():unix()`, no cadenas formateadas.

## Metadatos y Contexto

La columna `meta` almacena un blob JSON de forma libre. Usalo para correlacionar registros con eventos de la aplicacion:

```lua
tracker.track_usage(model_id, prompt, completion, 0, 0, 0, {
    context_id = "chat-42",
    metadata   = {
        session_id = "s-7",
        route      = "/api/summarise",
        agent_id   = "writer",
    },
})
```

`context_id` es una columna de nivel superior y puede indexarse; `metadata` se almacena como texto y esta pensado para visualizacion, no para filtrado.

## Ver Tambien

- [LLM](framework/llm.md) - Generacion LLM y el contrato `usage_tracker`
- [Migraciones](framework/migration.md) - Runner de migraciones que crea el esquema
- [Vision General del Framework](framework/overview.md) - Uso de modulos del framework
