---
title: "Tiempo de OS"
description: "Lee el tiempo del entorno de ejecución, formatea fechas y calcula diferencias temporales con la tabla global os de Lua."
---

# Tiempo de OS
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

La tabla global `os` proporciona timestamps, formato de fechas, medición del tiempo transcurrido y cálculo de diferencias temporales. En un workflow, las lecturas del tiempo actual usan la referencia temporal del workflow; fuera de él usan el reloj del sistema.

Esta es una referencia de API. Los timestamps literales y las salidas formateadas son ilustrativos; los valores actuales dependen del reloj y la zona horaria del entorno de ejecución o del workflow.

## Carga

La tabla `os` es global y no necesita cargarse con `require`.

```lua
os.time()
os.date()
os.clock()
os.difftime()
```

## Obtener Marcas de Tiempo

Lee un timestamp Unix en segundos desde el 1 de enero de 1970 UTC:

```lua
-- Current timestamp
local now = os.time()  -- 1718462445

-- Specific date/time
local t = os.time({
    year = 2024,
    month = 12,
    day = 25,
    hour = 10,
    min = 30,
    sec = 0
})
```

**Firma:** `os.time([spec]) -> number`

**Parametros:**

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `year` | number | ano actual | Ano de cuatro digitos (ej., 2024) |
| `month` | number | mes actual | Mes 1-12 |
| `day` | number | dia actual | Dia del mes 1-31 |
| `hour` | number | 0 | Hora 0-23 |
| `min` | number | 0 | Minuto 0-59 |
| `sec` | number | 0 | Segundo 0-59 |

Sin argumentos, `os.time()` devuelve el timestamp Unix actual.

Cuando se llama con una tabla, cualquier campo faltante usa los valores predeterminados mostrados arriba. Los campos `year`, `month` y `day` usan la fecha actual si no se especifican.

```lua
-- Just date (time defaults to midnight)
os.time({year = 2024, month = 6, day = 15})

-- Partial (fills in current year/month)
os.time({day = 1})  -- first of current month
```

## Formatear Fechas

Formatea un timestamp como string o devuelve sus campos de fecha en una tabla:

<code-block lang="lua">
local now = os.time()

-- Default format
os.date()  -- "Sat Jun 15 14:30:45 2024"

-- Custom format
os.date("%Y-%m-%d", now)           -- "2024-06-15"
os.date("%H:%M:%S", now)           -- "14:30:45"
os.date("%Y-%m-%dT%H:%M:%S", now)  -- "2024-06-15T14:30:45"

-- UTC time (prefix format with !)
os.date("!%Y-%m-%d %H:%M:%S", now)  -- UTC instead of local

-- Date table
local t = os.date("*t", now)
</code-block>

**Firma:** `os.date([format], [timestamp]) -> string | table`

| Parámetro | Tipo | Predeterminado | Descripción |
|-----------|------|----------------|-------------|
| `format` | string | `"%c"` | String de formato, `"*t"` para tabla |
| `timestamp` | number | tiempo actual | Marca de tiempo Unix a formatear |

### Especificadores de Formato

| Código | Salida | Ejemplo |
|--------|--------|---------|
| `%Y` | Ano de 4 digitos | 2024 |
| `%y` | Ano de 2 digitos | 24 |
| `%m` | Mes (01-12) | 06 |
| `%d` | Dia (01-31) | 15 |
| `%H` | Hora 24h (00-23) | 14 |
| `%I` | Hora 12h (01-12) | 02 |
| `%M` | Minuto (00-59) | 30 |
| `%S` | Segundo (00-59) | 45 |
| `%p` | AM/PM | PM |
| `%A` | Nombre de dia de semana | Saturday |
| `%a` | Dia de semana corto | Sat |
| `%B` | Nombre de mes | June |
| `%b` | Mes corto | Jun |
| `%w` | Dia de semana (0-6, Domingo=0) | 6 |
| `%j` | Dia del ano (001-366) | 167 |
| `%U` | Número de semana (00-53) | 24 |
| `%W` | Número de semana ISO 8601 (01-53, la semana empieza el lunes) | 24 |
| `%z` | Offset de zona horaria | -0700 |
| `%Z` | Nombre de zona horaria | PDT |
| `%c` | Fecha/hora completa | Sat Jun 15 14:30:45 2024 |
| `%x` | Solo fecha | 06/15/24 |
| `%X` | Solo hora | 14:30:45 |
| `%%` | Literal % | % |

### Tabla de Fecha

Cuando el formato es `"*t"`, `os.date()` devuelve una tabla:

```lua
local t = os.date("*t")
```

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `year` | number | Ano de cuatro digitos | 2024 |
| `month` | number | Mes (1-12) | 6 |
| `day` | number | Dia del mes (1-31) | 15 |
| `hour` | number | Hora (0-23) | 14 |
| `min` | number | Minuto (0-59) | 30 |
| `sec` | number | Segundo (0-59) | 45 |
| `wday` | number | Dia de semana (1-7, Domingo=1) | 7 |
| `yday` | number | Dia del ano (1-366) | 167 |
| `isdst` | boolean | `true` cuando el offset UTC de la zona no es cero en esta versión; no es un indicador fiable de DST | false |

Use `"!*t"` para tabla de fecha UTC.

## Medir Tiempo Transcurrido

Lee los segundos entre la referencia temporal actual del entorno de ejecución y el momento en que se inicializó el módulo de tiempo del sistema operativo:

```lua
local start = os.clock()

-- do work
for i = 1, 1000000 do end

local elapsed = os.clock() - start
print(string.format("Took %.3f seconds", elapsed))
```

**Firma:** `os.clock() -> number`

A diferencia de la definición de tiempo de CPU del Lua estándar, esta implementación se basa en tiempo transcurrido. En workflows usa la referencia temporal del workflow.

## Diferencia de Tiempo

Calcula la diferencia entre dos timestamps en segundos:

```lua
local t1 = os.time({year = 2024, month = 1, day = 1})
local t2 = os.time({year = 2024, month = 12, day = 31})

local diff = os.difftime(t2, t1)  -- t2 - t1
local days = diff / 86400
print(days)  -- 365
```

**Firma:** `os.difftime(t2, t1) -> number`

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `t2` | number | Marca de tiempo posterior |
| `t1` | number | Marca de tiempo anterior |

El resultado es `t2 - t1` en segundos y es negativo cuando `t1 > t2`.

## Constante de Plataforma

La constante `os.platform` identifica el entorno de ejecución:

```lua
os.platform  -- "wippy"
```
