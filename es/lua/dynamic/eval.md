---
title: "Evaluación dinámica"
description: "Evalúa expresiones o ejecuta código Lua con capacidades restringidas y acceso configurado a módulos y al registro."
---

# Evaluación dinámica

Wippy proporciona evaluación de expresiones y ejecución Lua con capacidades
restringidas para código suministrado en tiempo de ejecución. Esta página es una guía
de API: sus ejemplos se ejecutan dentro de un proceso Lua de Wippy existente y
presuponen que la entrada declara los módulos usados por el caller. Los IDs de
registro, políticas y datos de aplicación son placeholders del entorno.

`eval_runner` limita los módulos Wippy que puede alcanzar el código evaluado, pero no
es un aislamiento completo para código hostil. En particular, `limits.max_steps`
cuenta reanudaciones del scheduler, no instrucciones Lua, por lo que no interrumpe un
bucle infinito que no haga yield.

## Elegir un sistema de evaluación

Wippy proporciona dos sistemas de evaluacion:

| Sistema | Proposito | Caso de Uso |
|---------|-----------|-------------|
| `expr` | Evaluacion de expresiones | Config, plantillas, calculos simples |
| `eval_runner` | Ejecución Lua con capacidades restringidas | Plugins de confianza y código dinámico controlado |

## Evaluación de expresiones con `expr`

El módulo `expr` evalúa expresiones escritas con sintaxis expr-lang. Úsalo para
expresiones, no para programas Lua completos. [Lenguaje de expresiones](lua/dynamic/expression.md)
es la referencia completa de la API Lua y la sintaxis.

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
if err then
    return nil, err
end
-- result = 20
```

### Reutilizar expresiones compiladas

Compilar una vez, ejecutar muchas veces:

```lua
local program, err = expr.compile("price * quantity")
if err then
    return nil, err
end

local total1, first_err = program:run({price = 10, quantity = 5})
if first_err then
    return nil, first_err
end

local total2, second_err = program:run({price = 20, quantity = 3})
if second_err then
    return nil, second_err
end
```

### Resumen de sintaxis

| Función | Expresión | Resultado |
|---------|-----------|-----------|
| Aritmética | `1 + 2 * 3` | `7` |
| Resto | `10 % 3` | `1` |
| Comparación | `x > 5` con `{x = 10}` | `true` |
| Booleanos | `a && b` con `{a = true, b = false}` | `false` |
| Ternario | `x > 0 ? 'positive' : 'negative'` con `{x = 5}` | `"positive"` |
| Función | `max(1, 5, 3)` | `5` |
| Índice de array | `[1, 2, 3][0]` | `1` |
| Concatenación | `'hello' + ' ' + 'world'` | `"hello world"` |

## Lua con capacidades restringidas mediante `eval_runner`

Ejecución completa de Lua con controles de seguridad.

```lua
local runner = require("eval_runner")

local result, err = runner.run({
    source = [[
        local function double(x)
            return x * 2
        end
        return { double = double }
    ]],
    method = "double",
    args = {21}
})
if err then
    return nil, err
end
-- result = 42
```

### Configuración

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `source` | string | Código fuente Lua (requerido) |
| `method` | string | Función a llamar en tabla devuelta |
| `args` | any[] | Argumentos pasados a la función |
| `modules` | string[] | Modulos integrados permitidos |
| `imports` | table | Entradas de registro a importar |
| `context` | table | Valores disponibles como `ctx` |
| `allow_classes` | string[] | Clases de módulo adicionales |
| `custom_modules` | table | Tablas personalizadas como modulos |
| `limits` | table | Límites de ejecución de la evaluación |

Si `modules` se omite o está vacío, el host proporciona todos los módulos disponibles
cuyas clases pasan el filtro predeterminado. En ese modo implícito, `allow_classes`
amplía el filtro y puede añadir módulos de las clases indicadas. Con una lista
`modules` explícita, solo permite los módulos enumerados cuyas clases quedarían
bloqueadas. Prefiere una lista explícita y mínima para que las capacidades sean visibles.

En el runtime v0.3.32a, las comprobaciones de política `eval.module` cubren los nombres
incluidos explícitamente en `modules`, no los elegidos implícitamente por el filtro.
No confíes en esa política para eliminar un módulo predeterminado implícito; pasa una
lista explícita.

### Límite de pasos

Usa `limits.max_steps` para limitar las reanudaciones del scheduler:

```lua
local result, err = runner.run({
    source = user_code,
    modules = {"json"},
    limits = {max_steps = 1000}
})
if err then
    return nil, err
end
```

`max_steps` debe ser un entero no negativo. Si se omite, hereda `lua.eval.max_steps`
(predeterminado `10000`); un `0` explícito elimina el límite. Cada reanudación del
scheduler consume un paso, pero las iteraciones ordinarias de Lua no. Por tanto, no
es un presupuesto de CPU o instrucciones para código que no haga yield.

Campos desconocidos de `limits`, un valor que no sea tabla y valores de `max_steps`
no válidos devuelven `errors.INVALID` no reintentable.

### Acceso a Modulos

Lista blanca de modulos permitidos:

```lua
local encoded, err = runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
if err then
    return nil, err
end
```

Con una lista explícita, no pueden requerirse módulos ajenos a ella. Cada módulo
enumerado también requiere el permiso `eval.module`.

### Importaciones de Registro

Importar entradas del registro:

```lua
local result, err = runner.run({
    source = [[
        local data = ...
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
if err then
    return nil, err
end
```

La biblioteca importada debe estar respaldada por código fuente y devolver un valor.
El alias (`utils`) se vincula como global en el programa evaluado; no es un módulo
Wippy y no necesita `require()`.

### Importaciones Privilegiadas

A una importación se le pueden conceder módulos que el propio código evaluado no puede ver. Usa la forma de tabla con `id` y `modules`:

```lua
local quote, err = runner.run({
    source = [[
        return pricing.quote(...)
    ]],
    modules = {"json"},
    imports = {
        pricing = { id = "app.lib:pricing", modules = {"funcs"} }
    },
})
if err then
    return nil, err
end
```

La biblioteca `pricing` se ejecuta en su propio entorno con alcance donde `funcs` está disponible; el código fuente evaluado no puede requerir ni alcanzar `funcs` directamente. Conceder un módulo a una importación requiere que el llamador tenga el permiso `eval.module` para ese módulo — las capacidades no pueden delegarse más allá de lo que el propio llamador tiene permitido.

### Módulos personalizados

Inyectar tablas personalizadas:

```lua
local version, err = runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0"}
    }
})
if err then
    return nil, err
end
```

El código evaluado puede acceder directamente a los valores de módulos personalizados.
No coloques secretos ni handles privilegiados salvo que quieras revelarlos a ese código.

### Valores de Contexto

Pasar datos accesibles como `ctx`:

```lua
local greeting, err = runner.run({
    source = [[
        local user, ctx_err = ctx.get("user")
        if ctx_err then error(ctx_err) end
        return "Hello, " .. user
    ]],
    modules = {"ctx"},
    context = {user = "Alice"}
})
if err then
    return nil, err
end
```

### Compilar Programas

`runner.compile` valida el código fuente e informa su punto de entrada y módulos sin
ejecutarlo mediante `eval_runner`:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})
if err then
    return nil, err
end

program:method()   -- "process"  (string)
program:modules()  -- {"json"}    (string[])
```

El programa compilado es informativo; ejecuta llamando a `runner.run` con el código fuente y el método.

## Controles de capacidades

### Clases de Modulos

Los modulos se categorizan por capacidad:

| Clase | Descripción | Predeterminado |
|-------|-------------|----------------|
| `deterministic` | Funciones puras | Permitido |
| `encoding` | Codificacion de datos | Permitido |
| `time` | Operaciones de tiempo | Permitido |
| `nondeterministic` | Aleatorio, etc. | Permitido |
| `io` | Operaciones de E/S sin una clase bloqueada independiente | Permitido |
| `security` | Helpers de seguridad | Permitido |
| `workflow` | Operaciones seguras para workflows | Permitido |
| `process` | Spawn, registro | Bloqueado |
| `storage` | Archivo, base de datos | Bloqueado |
| `network` | HTTP, sockets | Bloqueado |

«Bloqueado» significa que lo está salvo que el caller incluya la clase en
`allow_classes` y esté autorizado para el recurso `eval.class`. Un módulo puede
pertenecer a varias clases; enumera cada clase bloqueada que tenga.

### Habilitar Clases Bloqueadas

```lua
local status, err = runner.run({
    source = [[
        local http = require("http_client")
        local response, err = http.get("https://api.example.com")
        if err then error(err) end
        return response.status_code
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
if err then
    return nil, err
end
```

Autorizar la clase solo admite el módulo en el entorno evaluado. Siguen aplicándose
sus propias comprobaciones de seguridad y controles de acceso externos.

### Verificaciones de Permisos

El sistema verifica permisos para:

- `eval.compile` - Antes de compilacion
- `eval.run` - Antes de ejecución
- `eval.module` - Para cada módulo de la allowlist y cada módulo concedido a una importación privilegiada; se requiere el permiso `eval.module`
- `eval.import` - Para cada importacion de registro
- `eval.class` - Para cada clase permitida

Configurar en politicas de seguridad.

## Caché de Compilación

Los programas compilados se almacenan en una caché LRU con clave por fuente, método,
módulos y clases permitidas; las ejecuciones repetidas omiten la recompilación. Las
importaciones, módulos personalizados, argumentos, contexto y `limits` se vinculan en
tiempo de ejecución y no afectan la clave.

```yaml
# .wippy.yaml
lua:
  eval:
    cache_size: 256   # entries; 0 or less disables caching (default: 256)
    cache_ttl: 0      # expiry; 0 = no expiry (default: 0)
    max_steps: 10000  # inherited run limit; 0 = unlimited (default: 10000)
```

## Manejo de Errores

```lua
local result, err = runner.run(run_config)
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- Access denied by security policy
    elseif err:kind() == errors.INVALID then
        -- Missing source or invalid limits configuration
    elseif err:kind() == errors.INTERNAL then
        -- Syntax, compilation, import, or execution failure
    end
end
```

Aquí `run_config` es la tabla de configuración que construye la aplicación circundante.

## Casos de Uso

### Plugins

```lua
local plugins, find_err = registry.find({["meta.type"] = "plugin"})
if find_err then
    return nil, find_err
end

for _, plugin in ipairs(plugins) do
    local _, run_err = runner.run({
        source = plugin.data.source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
    if run_err then
        return nil, run_err
    end
end
```

Este patrón parcial presupone que el caller cargó `registry` y `eval_runner`, que
`app_config` está definido y que las entradas coincidentes guardan Lua en
`data.source`. `registry.find` devuelve tablas de entrada, por lo que los campos se
leen como `plugin.data`, no mediante un método.

### Reglas repetidas

```lua
local compiled, compile_err = expr.compile("score >= minimum")
if compile_err then
    return nil, compile_err
end

for _, candidate in ipairs(candidates) do
    local accepted, run_err = compiled:run({
        score = candidate.score,
        minimum = 80
    })
    if run_err then
        return nil, run_err
    end
    candidate.accepted = accepted
end
```

Este patrón parcial presupone que la aplicación proporciona `candidates`. Usa el
módulo template, no `expr`, cuando la salida sea texto renderizado.

### Scripts de usuario

```lua
local result, err = runner.run({
    source = user_code, -- Supplied by the surrounding application
    modules = {"json", "text"},
    context = {data = input_data}
})
if err then
    return nil, err
end
```

Es un patrón de integración parcial, no un sandbox para código hostil. Valida quién
puede proporcionar `user_code`, concede solo los módulos y políticas necesarios y
aplica un timeout externo o aislamiento cuando código no fiable pueda no hacer yield.

## Vea También

- [Expression](./expression.md) - Referencia del lenguaje de expresiones
- [Exec](lua/dynamic/exec.md) - Ejecución de comandos del sistema
- [Security](lua/security/security.md) - Políticas de seguridad
