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
        return double(input)
    ]],
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
        local utils = require("utils")
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
```

### Modulos Personalizados

Inyectar tablas personalizadas:

```lua
runner.run({
    source = [[
        return sdk.versión
    ]],
    custom_modules = {
        sdk = {versión = "1.0.0", api_key = "xxx"}
    }
})
```

### Valores de Contexto

Pasar datos accesibles como `ctx`:

```lua
runner.run({
    source = [[
        return "Hello, " .. ctx.user
    ]],
    context = {user = "Alice"}
})
```

### Compilar Programas

Compilar una vez para ejecución repetida:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})

local result = program:run({10})  -- 20
```

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
- `eval.module` - Para cada módulo en lista blanca
- `eval.import` - Para cada importacion de registro
- `eval.class` - Para cada clase permitida

Configurar en politicas de seguridad.

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
