---
title: "Evaluacion Dinamica"
description: "Ejecutar código dinamicamente en tiempo de ejecución con entornos aislados y acceso controlado a modulos."
---

# Evaluacion Dinamica

Ejecutar código dinamicamente en tiempo de ejecución con entornos aislados y acceso controlado a modulos.

## Dos Sistemas

Wippy proporciona dos sistemas de evaluacion:

| Sistema | Proposito | Caso de Uso |
|---------|-----------|-------------|
| `expr` | Evaluacion de expresiones | Config, plantillas, calculos simples |
| `eval_runner` | Ejecución completa de Lua | Plugins, scripts de usuario, código dinamico |

## Módulo expr

Evaluacion de expresiones ligera usando sintaxis expr-lang.

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
-- result = 20
```

### Compilar Expresiones

Compilar una vez, ejecutar muchas veces:

```lua
local program, err = expr.compile("price * quantity")

local total1 = program:run({price = 10, quantity = 5})
local total2 = program:run({price = 20, quantity = 3})
```

### Sintaxis Soportada

```lua
-- Aritmetica
expr.eval("1 + 2 * 3")           -- 7
expr.eval("10 / 2 - 1")          -- 4
expr.eval("10 % 3")              -- 1

-- Comparacion
expr.eval("x > 5", {x = 10})     -- true
expr.eval("x == y", {x = 1, y = 1}) -- true

-- Booleano
expr.eval("a && b", {a = true, b = false})  -- false
expr.eval("a || b", {a = true, b = false})  -- true
expr.eval("!a", {a = false})     -- true

-- Ternario
expr.eval("x > 0 ? 'positive' : 'negative'", {x = 5})

-- Funciones
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(1, 5, 3)")        -- 1
expr.eval("len([1, 2, 3])")      -- 3

-- Arrays
expr.eval("[1, 2, 3][0]")        -- 1

-- Concatenacion de strings
expr.eval("'hello' + ' ' + 'world'")
```

## Módulo eval_runner

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
| `limits` | table | Limites de ejecucion para esta corrida |

### Limite de Pasos

`limits.max_steps` acota cuanto puede ejecutarse un `runner.run`:

```lua
local result, err = runner.run({
    source = user_source,
    method = "main",
    limits = {max_steps = 500}
})
```

Un paso es un turno del scheduler de eval: el programa avanza hasta que cede o termina, y cada resume consume un paso. El computo puro entre cesiones cuenta como un solo paso sin importar cuanto dure, asi que el limite acota turnos de planificacion, no tiempo de CPU.

Cuando la cuenta excede el limite, la corrida se detiene y devuelve `errors.INTERNAL` con `eval exceeded maximum step limit`.

`max_steps = 0` significa sin limite. Omitir `limits` hereda el valor por defecto del host:

```yaml
# .wippy.yaml
lua:
  eval:
    max_steps: 10000  # presupuesto por defecto para corridas sin limits.max_steps
                      # 0 = sin limite; un valor negativo hace fallar el arranque
```

`limits` se aplica solo a `runner.run`; `runner.compile` no acepta limites. `limits` debe ser una tabla que contenga unicamente `max_steps`, y `max_steps` debe ser un entero no negativo — cualquier otra cosa devuelve `errors.INVALID` antes de que el programa se ejecute.

### Acceso a Modulos

Lista blanca de modulos permitidos:

```lua
runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
```

Los modulos no en la lista no pueden ser requeridos.

### Importaciones de Registro

Importar entradas del registro:

```lua
runner.run({
    source = [[
        local data = ...
        local utils = require("utils")
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
```

### Importaciones Privilegiadas

A una importación se le pueden conceder módulos que el propio código evaluado no puede ver. Usa la forma de tabla con `id` y `modules`:

```lua
runner.run({
    source = [[
        local pricing = require("pricing")
        return pricing.quote(...)
    ]],
    modules = {"json"},
    imports = {
        pricing = { id = "app.lib:pricing", modules = {"funcs"} }
    },
})
```

La biblioteca `pricing` se ejecuta en su propio entorno con alcance donde `funcs` está disponible; el código fuente evaluado no puede requerir ni alcanzar `funcs` directamente. Conceder un módulo a una importación requiere que el llamador tenga el permiso `eval.module` para ese módulo — las capacidades no pueden delegarse más allá de lo que el propio llamador tiene permitido.

### Modulos Personalizados

Inyectar tablas personalizadas:

```lua
runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0", api_key = "xxx"}
    }
})
```

### Valores de Contexto

Pasar datos accesibles como `ctx`:

```lua
runner.run({
    source = [[
        return "Hello, " .. ctx.get("user")
    ]],
    context = {user = "Alice"}
})
```

### Compilar Programas

`runner.compile` valida el código fuente e informa su punto de entrada y módulos sin ejecutarlo:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})

program:method()   -- "process"  (string)
program:modules()  -- {"json"}    (string[])
```

La tabla de opciones acepta los mismos campos `modules` e `imports` que `runner.run`, y se aplican las mismas comprobaciones de permisos `eval.module` y `eval.import`. El programa compilado es informativo; ejecuta llamando a `runner.run` con el código fuente y el método.

## Modelo de Seguridad

### Clases de Modulos

Los modulos se categorizan por capacidad:

| Clase | Descripción | Predeterminado |
|-------|-------------|----------------|
| `deterministic` | Funciones puras | Permitido |
| `encoding` | Codificacion de datos | Permitido |
| `time` | Operaciones de tiempo | Permitido |
| `nondeterministic` | Aleatorio, etc. | Permitido |
| `process` | Spawn, registro | Bloqueado |
| `storage` | Archivo, base de datos | Bloqueado |
| `network` | HTTP, sockets | Bloqueado |

### Habilitar Clases Bloqueadas

```lua
runner.run({
    source = [[
        local http = require("http_client")
        return http.get("https://api.example.com")
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
```

### Verificaciones de Permisos

El sistema verifica permisos para:

- `eval.compile` - Antes de compilacion
- `eval.run` - Antes de ejecución
- `eval.module` - Para cada módulo en lista blanca, y para cada módulo concedido a una importación privilegiada
- `eval.import` - Para cada importacion de registro
- `eval.class` - Para cada clase permitida

Configurar en politicas de seguridad.

## Caché de Compilación

Los programas compilados se almacenan en una caché LRU con clave por fuente, método, módulos y clases permitidas — las ejecuciones repetidas de código idéntico omiten la recompilación. Las importaciones y el contexto se vinculan en tiempo de ejecución y no afectan la clave de la caché.

```yaml
# .wippy.yaml
lua:
  eval:
    cache_size: 256   # entradas; 0 o menos desactiva la caché (por defecto: 256)
    cache_ttl: 0      # expiración; 0 = sin expiración (por defecto: 0)
```

## Manejo de Errores

```lua
local result, err = runner.run({...})
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- Acceso denegado por politica de seguridad
    elseif err:kind() == errors.INVALID then
        -- Fuente o configuración invalida
    elseif err:kind() == errors.INTERNAL then
        -- Error de ejecución o compilacion
    end
end
```

## Casos de Uso

### Sistema de Plugins

```lua
local plugins = registry.find({meta = {type = "plugin"}})

for _, plugin in ipairs(plugins) do
    local source = plugin:data().source
    runner.run({
        source = source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
end
```

### Evaluacion de Plantillas

```lua
local template = "Hello, {{name}}! You have {{count}} messages."
local compiled = expr.compile("name")

-- Evaluacion rapida repetida
for _, user in ipairs(users) do
    local greeting = compiled:run({name = user.name})
end
```

### Scripts de Usuario

```lua
local user_code = request:body()

local result, err = runner.run({
    source = user_code,
    modules = {"json", "text"},  -- Solo modulos seguros
    context = {data = input_data}
})
```

## Vea También

- [Expression](lua/dynamic/expression.md) - Referencia del lenguaje de expresiones
- [Exec](lua/dynamic/exec.md) - Ejecución de comandos del sistema
- [Security](lua/security/security.md) - Politicas de seguridad
