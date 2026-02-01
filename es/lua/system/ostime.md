# Tiempo de OS
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Funciones de tiempo `os` estandar de Lua. Proporciona tiempo de reloj de pared real para marcas de tiempo, formato de fechas y calculos de tiempo.

## Carga

Tabla global `os`. No se necesita require.

```lua
os.time()
os.date()
os.clock()
os.difftime()
```

## Obtener Marcas de Tiempo

Obtener marca de tiempo Unix (segundos desde 1 de Enero, 1970 UTC):

```lua
-- Marca de tiempo actual
local now = os.time()  -- 1718462445

-- Fecha/hora especifica
local t = os.time({
    year = 2024,
    month = 12,
    day = 25,
    hour = 10,
    min = 30,
    sec = 0
})
```

**Firma:** `os.time([spec]) -> integer`

**Parametros:**

| Campo | Tipo | Predeterminado | Descripcion |
|-------|------|----------------|-------------|
| `year` | integer | ano actual | Ano de cuatro digitos (ej., 2024) |
| `month` | integer | mes actual | Mes 1-12 |
| `day` | integer | dia actual | Dia del mes 1-31 |
| `hour` | integer | 0 | Hora 0-23 |
| `min` | integer | 0 | Minuto 0-59 |
| `sec` | integer | 0 | Segundo 0-59 |

Cuando se llama sin argumentos, devuelve la marca de tiempo Unix actual.

Cuando se llama con una tabla, cualquier campo faltante usa los valores predeterminados mostrados arriba. Los campos `year`, `month` y `day` usan la fecha actual si no se especifican.

```lua
-- Solo fecha (hora predeterminada a medianoche)
os.time({year = 2024, month = 6, day = 15})

-- Parcial (rellena ano/mes actual)
os.time({day = 1})  -- primero del mes actual
```

## Formatear Fechas

Formatear una marca de tiempo como string o devolver una tabla de fecha:

<code-block lang="lua">
local now = os.time()

-- Formato predeterminado
os.date()  -- "Sat Jun 15 14:30:45 2024"

-- Formato personalizado
os.date("%Y-%m-%d", now)           -- "2024-06-15"
os.date("%H:%M:%S", now)           -- "14:30:45"
os.date("%Y-%m-%dT%H:%M:%S", now)  -- "2024-06-15T14:30:45"

-- Hora UTC (prefijo de formato con !)
os.date("!%Y-%m-%d %H:%M:%S", now)  -- UTC en lugar de local

-- Tabla de fecha
local t = os.date("*t", now)
</code-block>

**Firma:** `os.date([format], [timestamp]) -> string | table`

| Parametro | Tipo | Predeterminado | Descripcion |
|-----------|------|----------------|-------------|
| `format` | string | `"%c"` | String de formato, `"*t"` para tabla |
| `timestamp` | integer | tiempo actual | Marca de tiempo Unix a formatear |

### Especificadores de Formato

| Codigo | Salida | Ejemplo |
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
| `%U` | Numero de semana (00-53) | 24 |
| `%z` | Offset de zona horaria | -0700 |
| `%Z` | Nombre de zona horaria | PDT |
| `%c` | Fecha/hora completa | Sat Jun 15 14:30:45 2024 |
| `%x` | Solo fecha | 06/15/24 |
| `%X` | Solo hora | 14:30:45 |
| `%%` | Literal % | % |

### Tabla de Fecha

Cuando el formato es `"*t"`, devuelve una tabla:

```lua
local t = os.date("*t")
```

| Campo | Tipo | Descripcion | Ejemplo |
|-------|------|-------------|---------|
| `year` | integer | Ano de cuatro digitos | 2024 |
| `month` | integer | Mes (1-12) | 6 |
| `day` | integer | Dia del mes (1-31) | 15 |
| `hour` | integer | Hora (0-23) | 14 |
| `min` | integer | Minuto (0-59) | 30 |
| `sec` | integer | Segundo (0-59) | 45 |
| `wday` | integer | Dia de semana (1-7, Domingo=1) | 7 |
| `yday` | integer | Dia del ano (1-366) | 167 |
| `isdst` | boolean | Horario de verano | false |

Use `"!*t"` para tabla de fecha UTC.

## Medir Tiempo Transcurrido

Obtener segundos transcurridos desde que inicio el runtime de Lua:

```lua
local start = os.clock()

-- hacer trabajo
for i = 1, 1000000 do end

local elapsed = os.clock() - start
print(string.format("Tomo %.3f segundos", elapsed))
```

**Firma:** `os.clock() -> number`

## Diferencia de Tiempo

Obtener diferencia entre dos marcas de tiempo en segundos:

```lua
local t1 = os.time({year = 2024, month = 1, day = 1})
local t2 = os.time({year = 2024, month = 12, day = 31})

local diff = os.difftime(t2, t1)  -- t2 - t1
local days = diff / 86400
print(days)  -- 365
```

**Firma:** `os.difftime(t2, t1) -> number`

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `t2` | integer | Marca de tiempo posterior |
| `t1` | integer | Marca de tiempo anterior |

Devuelve `t2 - t1` en segundos. Puede ser negativo si `t1 > t2`.

## Constante de Plataforma

Constante que identifica el runtime:

```lua
os.platform  -- "wippy"
```
