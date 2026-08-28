---
title: "Bibliotecas estándar de Lua"
description: "Funciones globales integradas y API de tablas, cadenas, matemáticas, corrutinas y errores estructurados disponibles para las entradas de Wippy."
---

# Bibliotecas estándar de Lua
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Estas bibliotecas principales de Lua están disponibles en todas las entradas Lua ejecutables sin `require()`.

Esta es una referencia de API. Los bloques de firmas enumeran las funciones disponibles; los bloques más extensos son ejemplos aislados o patrones parciales, no entradas completas. Nombres como `check_health` y `process_request` representan callbacks de la aplicación.

## Funciones globales integradas

### Tipos y conversiones

```lua
type(value)         -- Returns: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- Convert to number, optional base (2-36)
tostring(value)     -- Convert to string, calls __tostring metamethod
```

### Aserciones y errores

```lua
assert(v [,msg])    -- Raises error if v is false/nil, returns v otherwise
error(msg [,level]) -- Raises error at specified stack level (default 1)
pcall(fn, ...)      -- Protected call, returns ok, result_or_error
xpcall(fn, errh)    -- Protected call with error handler function
```

### Iteración de tablas

```lua
pairs(t)            -- Iterate all key-value pairs
ipairs(t)           -- Iterate array portion (1, 2, 3, ...)
next(t [,index])    -- Get next key-value pair after index
```

### Metatablas

```lua
getmetatable(obj)       -- Get metatable (or __metatable field if protected)
setmetatable(t, mt)     -- Set metatable, returns t
```

### Acceso directo a tablas

Omite los metamétodos para acceder directamente a las tablas:

```lua
rawget(t, k)        -- Get t[k] without __index
rawset(t, k, v)     -- Set t[k]=v without __newindex
rawequal(a, b)      -- Compare without __eq
```

### Utilidades

```lua
select(index, ...)  -- Return args from index onwards
select("#", ...)    -- Return number of args
unpack(t [,i [,j]]) -- Return t[i] through t[j] as multiple values
print(...)          -- Print values (uses structured logging in Wippy)
```

### Variables globales

```lua
_G        -- The global environment table
_VERSION  -- Lua version string
```

## Manipulación de tablas

La biblioteca `table` proporciona operaciones de arrays in situ, ordenación, concatenación y desempaquetado:

```lua
table.insert(t, [pos,] value)  -- Insert value at pos (default: end)
table.remove(t [,pos])         -- Remove and return element at pos (default: last)
table.concat(t [,sep [,i [,j]]]) -- Concatenate array elements with separator
table.sort(t [,comp])          -- Sort in place, comp(a,b) returns true if a < b
table.unpack(t [,i [,j]])      -- Unpack table elements as multiple values
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, returns "x"

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- Descending order
end)
```

## Operaciones con cadenas

Las funciones de cadenas también están disponibles como métodos de los valores de cadena.

### Coincidencia de patrones

```lua
string.find(s, pattern [,init [,plain]])   -- Find pattern, returns start, end, captures
string.match(s, pattern [,init])           -- Extract matching substring
string.gmatch(s, pattern)                  -- Iterator over all matches
string.gsub(s, pattern, repl [,n])         -- Replace matches, returns string, count
```

### Conversión de mayúsculas y minúsculas

```lua
string.upper(s)   -- Convert to uppercase
string.lower(s)   -- Convert to lowercase
```

### Subcadenas y caracteres

```lua
string.sub(s, i [,j])      -- Substring from i to j (negative indexes from end)
string.len(s)              -- String length (or use #s)
string.byte(s [,i [,j]])   -- Numeric codes of characters
string.char(...)           -- Create string from character codes
string.rep(s, n)           -- Repeat string n times
string.reverse(s)          -- Reverse string
```

### Formateo

```lua
string.format(fmt, ...)    -- Printf-style formatting
```

Especificadores de formato: `%d` (entero), `%f` (flotante), `%s` (cadena), `%q` (entrecomillado), `%x` (hexadecimal), `%o` (octal), `%e` (científico), `%%` (% literal)

```lua
local s = "Hello, World!"

-- Pattern matching
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- Substitution
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- Method syntax
local upper = s:upper()                       -- "HELLO, WORLD!"
local part = s:sub(1, 5)                      -- "Hello"
```

### Patrones

| Patrón | Coincidencia |
|--------|----------|
| `.` | Cualquier carácter |
| `%a` | Letras |
| `%d` | Dígitos |
| `%w` | Caracteres alfanuméricos |
| `%s` | Espacio en blanco |
| `%p` | Puntuacion |
| `%c` | Caracteres de control |
| `%x` | Dígitos hexadecimales |
| `%z` | Cero (nulo) |
| `[set]` | Clase de caracteres |
| `[^set]` | Clase negada |
| `*` | 0 o más (voraz) |
| `+` | 1 o más (voraz) |
| `-` | 0 o más (no voraz) |
| `?` | 0 o 1 |
| `^` | Inicio de string |
| `$` | Fin de string |
| `%b()` | Par balanceado |
| `(...)` | Grupo de captura |

Las versiones en mayúscula (`%A`, `%D`, etc.) coinciden con el complemento.

## Funciones matemáticas

La biblioteca `math` proporciona constantes numéricas y operaciones matemáticas habituales.

### Constantes {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- Infinity
math.mininteger  -- Minimum integer
math.maxinteger  -- Maximum integer
```

### Operaciones básicas

```lua
math.abs(x)           -- Absolute value
math.min(...)         -- Minimum of arguments
math.max(...)         -- Maximum of arguments
math.floor(x)         -- Round down
math.ceil(x)          -- Round up
math.modf(x)          -- Integer and fractional parts
math.fmod(x, y)       -- Floating-point remainder
```

### Potencias y raíces

```lua
math.sqrt(x)          -- Square root
math.pow(x, y)        -- x^y (or use x^y operator)
math.exp(x)           -- e^x
math.log(x)           -- Natural log
math.log10(x)         -- Base-10 log
```

### Trigonometría

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- Radians
math.asin(x)  math.acos(x)  math.atan(x)
math.atan2(y, x)                            -- Arc tangent of y/x
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- Hyperbolic
math.deg(r)   -- Radians to degrees
math.rad(d)   -- Degrees to radians
```

### Números aleatorios

```lua
math.random()         -- Random float [0,1)
math.random(n)        -- Random integer [1,n]
math.random(m, n)     -- Random integer [m,n]
math.randomseed(x)    -- Compatibility no-op; does not seed math.random
```

`math.random` no es determinista. No debe usarse para decisiones que tengan que reproducirse de forma idéntica en un workflow; `math.randomseed` no puede hacerlo determinista.

### Conversión de tipos

```lua
math.tointeger(x)     -- Convert to integer or nil
math.type(x)          -- "integer", "float", or nil
math.ult(m, n)        -- Unsigned less-than comparison
```

## Corrutinas

La biblioteca `coroutine` permite crear y controlar corrutinas. Consulta [Canales y corrutinas](lua/core/channel.md) para ver patrones de concurrencia basados en canales.

```lua
coroutine.create(fn)        -- Create coroutine from function
coroutine.resume(co, ...)   -- Start/continue coroutine
coroutine.yield(...)        -- Suspend coroutine, return values to resume
coroutine.status(co)        -- "running", "suspended", "normal", "dead"
coroutine.running()         -- Current coroutine (nil if main thread)
coroutine.wrap(fn)          -- Create coroutine as callable function
```

### Inicio de corrutinas concurrentes

Wippy añade `coroutine.spawn` para el trabajo concurrente administrado por el planificador:

```lua
coroutine.spawn(fn)         -- Spawn function as concurrent coroutine
```

```lua
local time = require("time")

-- Spawn background task
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- Continue main execution immediately
process_request()
```

Este patrón parcial presupone que la entrada incluye `time` en `modules:` y proporciona las funciones `check_health` y `process_request`. La corrutina iniciada se ejecuta de forma concurrente en el mismo proceso Lua; `process_request()` se alcanza inmediatamente y cada comprobación de estado va seguida de una espera de 30 segundos.

## Manejo de errores

La tabla global `errors` crea y clasifica errores estructurados. Consulta [Manejo de errores](lua/core/errors.md) para ver la API completa.

### Constantes {id="error-constants"}

```lua
errors.UNKNOWN           -- Unclassified error
errors.INVALID           -- Invalid argument or input
errors.NOT_FOUND         -- Resource not found
errors.ALREADY_EXISTS    -- Resource already exists
errors.PERMISSION_DENIED -- Permission denied
errors.TIMEOUT           -- Operation timed out
errors.CANCELED          -- Operation cancelled
errors.UNAVAILABLE       -- Service unavailable
errors.INTERNAL          -- Internal error
errors.CONFLICT          -- Conflict (e.g., concurrent modification)
errors.RATE_LIMITED      -- Rate limit exceeded
```

### Funciones {id="error-functions"}

```lua
-- Create error from string
local err = errors.new("something went wrong")

-- Create error with metadata
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- Wrap existing error with context
local wrapped = errors.wrap(err, "failed to load profile")

-- Check error kind
if errors.is(err, errors.NOT_FOUND) then
    -- handle not found
end

-- Get call stack from error
local stack = errors.call_stack(err)
```

### Métodos de error

```lua
err:message()    -- Get error message string
err:kind()       -- Get error kind (e.g., "NOT_FOUND")
err:retryable()  -- true, false, or nil (unknown)
err:details()    -- Get details table or nil
err:stack()      -- Get stack trace as string
```

## Funciones restringidas

Las siguientes funciones estándar de Lua no están disponibles en los procesos de Wippy:

| Función | Alternativa |
|----------------|-------------|
| `load`, `loadstring`, `loadfile`, `dofile` | Usa el módulo [Evaluación dinámica](lua/dynamic/eval.md) |
| `collectgarbage` | Recolección de basura automática |
| `rawlen` | Usa el operador `#` |
| `string.dump` | No compatible |
| `io.*` | Usa [Sistema de archivos](lua/storage/filesystem.md) para archivos o [E/S de terminal](../system/io.md) para flujos de terminal |
| `os.execute` | Usa [Ejecución de comandos](lua/dynamic/exec.md) |
| `os.remove`, `os.rename` | Usa [Sistema de archivos](../storage/filesystem.md) |
| `os.exit`, `os.tmpname` | Sin equivalente directo en la biblioteca estándar |
| `debug.*` | No disponible |
| `utf8.*` | No disponible |
| `package.loadlib` | Las bibliotecas nativas no son compatibles |

## Véase también

- [Canales y corrutinas](lua/core/channel.md) - Canales al estilo de Go para concurrencia
- [Manejo de errores](lua/core/errors.md) - Creación y manejo de errores estructurados
- [Hora del sistema operativo](lua/system/ostime.md) - Funciones de hora del sistema
