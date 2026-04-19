# Sistema de Tipos

> **Experimental.** Se esperan algunas limitaciones.

Wippy incluye un sistema de tipos gradual con verificación sensible al flujo. Los tipos no son anulables por defecto.

## Primitivos

```lua
local n: number = 3.14
local i: integer = 42         -- integer is subtype of number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- explicit dynamic (opt-out of checking)
local u: unknown = something  -- must narrow before use
```

### any vs unknown

```lua
-- any: opt-out of type checking
local a: any = get_data()
a.foo.bar.baz()              -- no error, may crash at runtime

-- unknown: safe unknown, must narrow before use
local u: unknown = get_data()
u.foo                        -- ERROR: cannot access property of unknown
if type(u) == "table" then
    -- u narrowed to table here
end
```

## Seguridad de Nil

Los tipos no son anulables por defecto. Use `?` para valores opcionales:

```lua
local x: number = nil         -- ERROR: nil not assignable to number
local y: number? = nil        -- OK: number? means "number or nil"
local z: number? = 42         -- OK
```

### Estrechamiento por Flujo de Control

El verificador de tipos rastrea el flujo de control:

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- x is number here
    end
    return 0
end

-- Early return pattern
local user, err = get_user(123)
if err then return nil, err end
-- user narrowed to non-nil here

-- Or default
local val = get_value() or 0  -- val: number
```

## Tipos Unión

```lua
local val: number | string = get_value()

if type(val) == "number" then
    print(val + 1)            -- val: number
else
    print(val:upper())        -- val: string
end
```

### Tipos Literales

```lua
type Status = "pending" | "active" | "done"

local s: Status = "pending"   -- OK
local s: Status = "invalid"   -- ERROR
```

## Tipos de Función

```lua
local function add(a: number, b: number): number
    return a + b
end

-- Multiple returns
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- Error returns (Lua idiom)
local function fetch(url: string): (string?, error?)
    -- returns (data, nil) or (nil, error)
end

-- First-class function types
local double: (number) -> number = function(x: number): number
    return x * 2
end
```

### Funciones Variádicas

```lua
local function sum(...: number): number
    local total: number = 0
    for _, v in ipairs({...}) do
        total = total + v
    end
    return total
end
```

## Tipos Registro

```lua
type User = {name: string, age: number}

local u: User = {name = "alice", age = 25}
```

### Campos Opcionales

```lua
type Config = {
    host: string,
    port: number,
    timeout?: number,
    debug?: boolean
}

local cfg: Config = {host = "localhost", port = 8080}  -- OK
```

## Genéricos

```lua
local function identity<T>(x: T): T
    return x
end

local n: number = identity(42)
local s: string = identity("hello")
```

### Genéricos Restringidos

```lua
type HasName = {name: string}

local function greet<T: HasName>(obj: T): string
    return "Hello, " .. obj.name
end

greet({name = "Alice"})       -- OK
greet({age = 30})             -- ERROR: missing 'name'
```

## Tipos Intersección

Combinan múltiples tipos:

```lua
type Named = {name: string}
type Aged = {age: number}
type Person = Named & Aged

local p: Person = {name = "Alice", age = 30}
```

## Uniones Etiquetadas

```lua
type Result<T, E> =
    | {ok: true, value: T}
    | {ok: false, error: E}

type LoadState =
    | {status: "loading"}
    | {status: "loaded", data: User}
    | {status: "error", message: string}

local function render(state: LoadState): string
    if state.status == "loading" then
        return "Loading..."
    elseif state.status == "loaded" then
        return "Hello, " .. state.data.name
    elseif state.status == "error" then
        return "Error: " .. state.message
    end
end
```

## El Tipo never

`never` es el tipo de fondo — no existen valores:

```lua
function fail(msg: string): never
    error(msg)
end
```

## Patrón de Manejo de Errores

El verificador entiende el modismo de error de Lua:

```lua
local value, err = call()
if err then
    -- value is nil here
    return nil, err
end
-- value is non-nil here, err is nil
print(value)
```

## Aserción de No-Nil

Use `!` para afirmar que una expresión no es nil:

```lua
local user: User? = get_user()
local name = user!.name              -- assert user is non-nil
```

Si el valor es nil en tiempo de ejecución, se lanza un error. Úselo cuando sepa que un valor no puede ser nil pero el verificador de tipos no puede demostrarlo.

## Casts de Tipo

### Cast Seguro (Validación)

Llame a un tipo como una función para validar y hacer cast:

```lua
local data: any = get_json()
local user = User(data)              -- validates and returns User
local name = user.name               -- safe field access
```

Funciona con primitivos y tipos personalizados:

```lua
local x: any = get_value()
local s = string(x)                  -- cast to string
local n = integer(x)                 -- cast to integer
local b = boolean(x)                 -- cast to boolean

type Point = {x: number, y: number}
local p = Point(data)                -- validates record structure
```

### Método Type:is()

Valida sin lanzar excepción, retorna `(value, nil)` o `(nil, error)`:

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- p is valid Point
else
    return nil, err                  -- validation failed
end
```

El resultado se estrecha en condicionales:

```lua
if Point:is(data) then
    local p: Point = data            -- data narrowed to Point
end
```

### Cast Inseguro

Use `::` o `as` para casts no verificados:

```lua
local data: any = get_data()
local user = data :: User            -- no runtime check
local user = data as User            -- same as ::
```

Úselo con moderación. Los casts inseguros omiten la validación y pueden causar errores en tiempo de ejecución si el valor no coincide con el tipo.

## Reflexión de Tipos

Los tipos son valores de primera clase con métodos de introspección.

### Kind y Nombre

```lua
print(Number:kind())                 -- "number"
print(Point:kind())                  -- "record"
print(Point:name())                  -- "Point"
```

### Campos de Registro

Itere sobre los campos de un registro:

```lua
type User = {name: string, age: number}

for name, typ in User:fields() do
    print(name, typ:kind())
end
-- name    string
-- age     number
```

Acceda a tipos de campos individuales:

```lua
local nameType = User.name           -- type of 'name' field
print(nameType:kind())               -- "string"
```

### Tipos de Colección

```lua
local arr: {number} = {1, 2, 3}
local arrType = typeof(arr)
print(arrType:elem():kind())         -- "number"

local map: {[string]: number} = {}
local mapType = typeof(map)
print(mapType:key():kind())          -- "string"
print(mapType:val():kind())          -- "number"
```

### Tipos Opcionales

```lua
local opt: number? = nil
local optType = typeof(opt)
print(optType:kind())                -- "optional"
print(optType:inner():kind())        -- "number"
```

### Tipos Unión

```lua
type Status = "pending" | "active" | "done"

for variant in Status:variants() do
    print(variant)
end
```

### Tipos de Función

```lua
local fn: (number, string) -> boolean

local fnType = typeof(fn)
for param in fnType:params() do
    print(param:kind())
end
print(fnType:ret():kind())           -- "boolean"
```

### Comparación de Tipos

```lua
print(Number == Number)              -- true
print(Integer <= Number)             -- true (subtype)
print(Integer < Number)              -- true (strict subtype)
```

### Tipos como Claves de Tabla

```lua
local handlers = {}
handlers[Number] = function() return "number handler" end
handlers[String] = function() return "string handler" end

local h = handlers[typeof(value)]
if h then h() end
```

## Anotaciones de Tipo

Agregue tipos a las firmas de función:

```lua
-- Parameter and return types
local function process(input: string): number
    return #input
end

-- Local variable types
local count: number = 0

-- Type aliases
type StringArray = {string}
type StringMap = {[string]: number}
```

## Validadores de Tipo

Agregue restricciones de validación en tiempo de ejecución a los tipos usando anotaciones:

```lua
-- Single validator
local x: number @min(0) = 1

-- Multiple validators
local x: number @min(0) @max(100) = 50

-- String pattern
local email: string @pattern("^.+@.+$") = "test@example.com"

-- No-arg validator
local x: number @integer = 42
```

### Validadores Integrados

| Validador | Aplica a | Ejemplo |
|-----------|----------|---------|
| `@min(n)` | number | `local x: number @min(0) = 1` |
| `@max(n)` | number | `local x: number @max(100) = 50` |
| `@min_len(n)` | string, array | `local s: string @min_len(1) = "hi"` |
| `@max_len(n)` | string, array | `local s: string @max_len(10) = "hi"` |
| `@pattern(regex)` | string | `local email: string @pattern("^.+@.+$") = "a@b.com"` |

### Validadores de Campo de Registro

```lua
type User = {
    age: number @min(0) @max(150),
    name: string @min_len(1) @max_len(100)
}
```

### Validadores de Elemento de Array

```lua
local scores: {number @min(0) @max(100)} = {85, 90}
```

### Validadores de Miembro de Unión

```lua
local id: number @min(1) | string @min_len(1) = 1
```

## Reglas de Varianza

| Posición | Varianza | Descripción |
|----------|----------|-------------|
| Campo de solo lectura | Covariante | Puede usar subtipo |
| Campo mutable | Invariante | Debe coincidir exactamente |
| Parámetro de función | Contravariante | Puede usar supertipo |
| Retorno de función | Covariante | Puede usar subtipo |

## Subtipado

- `integer` es un subtipo de `number`
- `never` es un subtipo de todos los tipos
- Todos los tipos son subtipos de `any`
- Subtipado de unión: `A` es subtipo de `A | B`

## Adopción Gradual

Agregue tipos incrementalmente — el código sin tipos sigue funcionando:

```lua
-- Existing code works unchanged
function old_function(x)
    return x + 1
end

-- New code gets types
function new_function(x: number): number
    return x + 1
end
```

Comience agregando tipos a:
1. Firmas de funciones en los límites de la API
2. Handlers HTTP y consumidores de cola
3. Lógica de negocio crítica

## Verificación de Tipos

Ejecute el verificador de tipos:

```bash
wippy lint
```

Reporta errores de tipo sin ejecutar código.
