# Bibliotecas Estandar de Lua
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Bibliotecas principales de Lua disponibles automaticamente en todos los procesos de Wippy. No se necesita `require()`.

## Funciones Globales

### Tipo y Conversion

```lua
type(value)         -- Devuelve: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- Convertir a número, base opcional (2-36)
tostring(value)     -- Convertir a string, llama metametodo __tostring
```

### Aserciones y Errores

```lua
assert(v [,msg])    -- Genera error si v es false/nil, devuelve v de lo contrario
error(msg [,level]) -- Genera error en el nivel de pila especificado (por defecto 1)
pcall(fn, ...)      -- Llamada protegida, devuelve ok, resultado_o_error
xpcall(fn, errh)    -- Llamada protegida con función manejadora de error
```

### Iteracion de Tablas

```lua
pairs(t)            -- Iterar todos los pares clave-valor
ipairs(t)           -- Iterar porcion de array (1, 2, 3, ...)
next(t [,index])    -- Obtener siguiente par clave-valor despues de index
```

### Metatablas

```lua
getmetatable(obj)       -- Obtener metatabla (o campo __metatable si protegido)
setmetatable(t, mt)     -- Establecer metatabla, devuelve t
```

### Acceso Directo a Tablas

Omitir metametodos para acceso directo a tablas:

```lua
rawget(t, k)        -- Obtener t[k] sin __index
rawset(t, k, v)     -- Establecer t[k]=v sin __newindex
rawequal(a, b)      -- Comparar sin __eq
```

### Utilidades

```lua
select(index, ...)  -- Devuelve args desde index en adelante
select("#", ...)    -- Devuelve número de args
unpack(t [,i [,j]]) -- Devuelve t[i] hasta t[j] como multiples valores
print(...)          -- Imprimir valores (usa logging estructurado en Wippy)
```

### Variables Globales

```lua
_G        -- La tabla de entorno global
_VERSION  -- Cadena de versión de Lua
```

## Manipulacion de Tablas

Funciones para modificar tablas:

```lua
table.insert(t, [pos,] value)  -- Insertar valor en pos (por defecto: final)
table.remove(t [,pos])         -- Remover y devolver elemento en pos (por defecto: ultimo)
table.concat(t [,sep [,i [,j]]]) -- Concatenar elementos de array con separador
table.sort(t [,comp])          -- Ordenar in place, comp(a,b) devuelve true si a < b
table.pack(...)                -- Empacar varargs en tabla con campo 'n'
table.unpack(t [,i [,j]])      -- Desempacar elementos de tabla como multiples valores
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, devuelve "x"

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- Orden descendente
end)
```

## Operaciones de String

Funciones de manipulacion de strings. También disponibles como metodos en valores string:

### Coincidencia de Patrones

```lua
string.find(s, pattern [,init [,plain]])   -- Encontrar patrón, devuelve inicio, fin, capturas
string.match(s, pattern [,init])           -- Extraer subcadena coincidente
string.gmatch(s, pattern)                  -- Iterador sobre todas las coincidencias
string.gsub(s, pattern, repl [,n])         -- Reemplazar coincidencias, devuelve string, conteo
```

### Conversion de Mayusculas

```lua
string.upper(s)   -- Convertir a mayusculas
string.lower(s)   -- Convertir a minusculas
```

### Subcadenas y Caracteres

```lua
string.sub(s, i [,j])      -- Subcadena de i a j (indices negativos desde el final)
string.len(s)              -- Longitud de string (o usar #s)
string.byte(s [,i [,j]])   -- Codigos numericos de caracteres
string.char(...)           -- Crear string desde codigos de caracter
string.rep(s, n [,sep])    -- Repetir string n veces con separador
string.reverse(s)          -- Invertir string
```

### Formateo

```lua
string.format(fmt, ...)    -- Formateo estilo printf
```

Especificadores de formato: `%d` (entero), `%f` (flotante), `%s` (string), `%q` (citado), `%x` (hex), `%o` (octal), `%e` (cientifico), `%%` (% literal)

```lua
local s = "Hello, World!"

-- Coincidencia de patrones
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- Sustitucion
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- Sintaxis de método
local upper = s:upper()                       -- "HELLO, WORLD!"
local part = s:sub(1, 5)                      -- "Hello"
```

### Patrones

| Patrón | Coincide |
|--------|----------|
| `.` | Cualquier caracter |
| `%a` | Letras |
| `%d` | Digitos |
| `%w` | Alfanumerico |
| `%s` | Espacio en blanco |
| `%p` | Puntuacion |
| `%c` | Caracteres de control |
| `%x` | Digitos hexadecimales |
| `%z` | Cero (nulo) |
| `[set]` | Clase de caracteres |
| `[^set]` | Clase negada |
| `*` | 0 o mas (avido) |
| `+` | 1 o mas (avido) |
| `-` | 0 o mas (perezoso) |
| `?` | 0 o 1 |
| `^` | Inicio de string |
| `$` | Fin de string |
| `%b()` | Par balanceado |
| `(...)` | Grupo de captura |

Las versiones mayusculas (`%A`, `%D`, etc.) coinciden con el complemento.

## Funciones Matematicas

Funciones y constantes matematicas:

### Constantes {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- Infinito
math.mininteger  -- Entero minimo
math.maxinteger  -- Entero maximo
```

### Operaciones Basicas

```lua
math.abs(x)           -- Valor absoluto
math.min(...)         -- Minimo de argumentos
math.max(...)         -- Maximo de argumentos
math.floor(x)         -- Redondear hacia abajo
math.ceil(x)          -- Redondear hacia arriba
math.modf(x)          -- Partes entera y fraccional
math.fmod(x, y)       -- Resto de punto flotante
```

### Potencias y Raices

```lua
math.sqrt(x)          -- Raiz cuadrada
math.pow(x, y)        -- x^y (o usar operador x^y)
math.exp(x)           -- e^x
math.log(x [,base])   -- Log natural (o log base n)
```

### Trigonometria

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- Radianes
math.asin(x)  math.acos(x)  math.atan(y [,x])
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- Hiperbolicas
math.deg(r)   -- Radianes a grados
math.rad(d)   -- Grados a radianes
```

### Numeros Aleatorios

```lua
math.random()         -- Flotante aleatorio [0,1)
math.random(n)        -- Entero aleatorio [1,n]
math.random(m, n)     -- Entero aleatorio [m,n]
math.randomseed(x)    -- Establecer semilla aleatoria
```

### Conversion de Tipo

```lua
math.tointeger(x)     -- Convertir a entero o nil
math.type(x)          -- "integer", "float", o nil
math.ult(m, n)        -- Comparacion menor-que sin signo
```

## Corrutinas

Creacion y control de corrutinas. Consulte [Canales y Corrutinas](lua/core/channel.md) para canales y patrones concurrentes:

```lua
coroutine.create(fn)        -- Crear corrutina desde función
coroutine.resume(co, ...)   -- Iniciar/continuar corrutina
coroutine.yield(...)        -- Suspender corrutina, devolver valores a resume
coroutine.status(co)        -- "running", "suspended", "normal", "dead"
coroutine.running()         -- Corrutina actual (nil si hilo principal)
coroutine.wrap(fn)          -- Crear corrutina como función invocable
```

### Crear Corrutinas Concurrentes

Crear una corrutina concurrente que se ejecuta independientemente (específico de Wippy):

```lua
coroutine.spawn(fn)         -- Crear función como corrutina concurrente
```

```lua
-- Crear tarea en segundo plano
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- Continuar ejecución principal inmediatamente
process_request()
```

## Manejo de Errores

Creacion y clasificacion de errores estructurados. Consulte [Manejo de Errores](lua/core/errors.md) para documentacion completa:

### Constantes {id="error-constants"}

```lua
errors.UNKNOWN           -- Error no clasificado
errors.INVALID           -- Argumento o entrada invalida
errors.NOT_FOUND         -- Recurso no encontrado
errors.ALREADY_EXISTS    -- Recurso ya existe
errors.PERMISSION_DENIED -- Permiso denegado
errors.TIMEOUT           -- Operación agoto tiempo
errors.CANCELED          -- Operación cancelada
errors.UNAVAILABLE       -- Servicio no disponible
errors.INTERNAL          -- Error interno
errors.CONFLICT          -- Conflicto (ej., modificacion concurrente)
errors.RATE_LIMITED      -- Limite de tasa excedido
```

### Funciones {id="error-functions"}

```lua
-- Crear error desde string
local err = errors.new("something went wrong")

-- Crear error con metadatos
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- Envolver error existente con contexto
local wrapped = errors.wrap(err, "failed to load profile")

-- Verificar tipo de error
if errors.is(err, errors.NOT_FOUND) then
    -- manejar no encontrado
end

-- Obtener pila de llamadas del error
local stack = errors.call_stack(err)
```

### Metodos de Error

```lua
err:message()    -- Obtener mensaje de error como string
err:kind()       -- Obtener tipo de error (ej., "NOT_FOUND")
err:retryable()  -- true, false, o nil (desconocido)
err:details()    -- Obtener tabla de detalles o nil
err:stack()      -- Obtener traza de pila como string
```

## Unicode UTF-8

Manejo de strings Unicode UTF-8:

### Constantes {id="utf8-constants"}

```lua
utf8.charpattern  -- Patrón que coincide con un solo caracter UTF-8
```

### Funciones {id="utf8-functions"}

```lua
utf8.char(...)           -- Crear string desde codepoints Unicode
utf8.codes(s)            -- Iterador sobre codepoints: for pos, code in utf8.codes(s)
utf8.codepoint(s [,i [,j]]) -- Obtener codepoints en posiciones i a j
utf8.len(s [,i [,j]])    -- Contar caracteres UTF-8 (no bytes)
utf8.offset(s, n [,i])   -- Posicion de byte del n-esimo caracter desde posicion i
```

```lua
local s = "Hello, 世界"

-- Contar caracteres (no bytes)
print(utf8.len(s))  -- 9

-- Iterar sobre codepoints
for pos, code in utf8.codes(s) do
    print(pos, code, utf8.char(code))
end

-- Obtener codepoint en posicion
local code = utf8.codepoint(s, 8)  -- Primer caracter chino

-- Crear string desde codepoints
local emoji = utf8.char(0x1F600)  -- Cara sonriente
```

## Caracteristicas Restringidas

Las siguientes caracteristicas estandar de Lua NO estan disponibles por seguridad:

| Caracteristica | Alternativa |
|----------------|-------------|
| `load`, `loadstring`, `loadfile`, `dofile` | Usar módulo [Evaluacion Dinamica](lua/dynamic/eval.md) |
| `collectgarbage` | GC automatico |
| `rawlen` | Usar operador `#` |
| `io.*` | Usar módulo [Sistema de Archivos](lua/storage/filesystem.md) |
| `os.execute`, `os.exit`, `os.remove`, `os.rename`, `os.tmpname` | Usar modulos [Ejecución de Comandos](lua/dynamic/exec.md), [Entorno](lua/system/env.md) |
| `debug.*` (excepto traceback) | No disponible |
| `package.loadlib` | Bibliotecas nativas no soportadas |

## Vea También

- [Canales y Corrutinas](lua/core/channel.md) - Canales estilo Go para concurrencia
- [Manejo de Errores](lua/core/errors.md) - Crear y manejar errores estructurados
- [OS Time](lua/system/ostime.md) - Funciones de tiempo del sistema
