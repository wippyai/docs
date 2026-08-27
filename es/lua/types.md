---
title: "Sistema de Tipos"
description: "Wippy incluye un sistema de tipos gradual con verificación sensible al flujo. Los tipos no son anulables por defecto."
---

# Sistema de Tipos

> **Experimental.** Se esperan algunas limitaciones.

Wippy incluye un sistema de tipos gradual con verificación sensible al flujo. Los tipos no son anulables por defecto.

Esta página es una referencia del lenguaje, no un programa completo. Cada bloque de código es un ejemplo aislado de comprobación de tipos, y las alternativas dentro de un bloque no están pensadas necesariamente para combinarse. Nombres como `get_data`, `get_user`, `call` y `User` representan código de la aplicación; las líneas marcadas `ERROR` muestran diagnósticos intencionadamente. Estos ejemplos usan sintaxis del lenguaje y valores de tipo integrados, por lo que no requieren módulos del runtime.

## Primitivos

```lua
local n: number = 3.14
local i: integer = 42         -- integer is subtype of number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- dynamic member and method access
local u: unknown = { source = "example" }  -- must narrow before use
```

### `any` y `unknown`

```lua
-- any: dynamic member and method access
local a: any = get_data()
a.foo.bar.baz()              -- no error, may crash at runtime
local s: string = a          -- ERROR: any is not assignable to string

-- unknown: safe unknown, must narrow before use as a concrete type
local u: unknown = get_data()
u.foo                        -- no error: member access on unknown behaves like any
local n: number = u          -- ERROR: unknown not assignable to number, narrow first
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
    {ok: true, value: T}
    | {ok: false, error: E}

type LoadState =
    {status: "loading"}
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

## El tipo `never`

`never` es el tipo de fondo — no existen valores:

```lua
function fail(msg: string): never
    error(msg)
end
```

## Patrón de Manejo de Errores

El checker entiende el patrón habitual de retorno `value, error` de Lua:

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
local name = (user!).name            -- assert user is non-nil
```

`!` es solo una aserción del checker: estrecha el tipo a no nil, pero no emite ninguna comprobación durante la ejecución. Si el valor es realmente nil, la operación siguiente falla con el error habitual (por ejemplo, al indexar nil). Úsalo cuando sepas que un valor no puede ser nil, pero el checker no pueda demostrarlo.

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
local s = string(x)                  -- requires an existing string
local n = integer(x)                 -- requires an existing integer
local b = boolean(x)                 -- requires an existing boolean

type Point = {x: number, y: number}
local p = Point(data)                -- validates record structure
```

Por ejemplo, `string(42)` genera un error de validación; usa `tostring(42)` cuando quieras convertir el valor.

### Método Type:is()

`Type:is` valida sin lanzar una excepción y devuelve `(value, nil)` o `(nil, error)`:

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
type NumberType = number
print(NumberType:kind())             -- "number"
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
type NumberArray = {number}
print(NumberArray:elem():kind())     -- "number"

type NumberMap = {[string]: number}
print(NumberMap:key():kind())        -- "string"
print(NumberMap:val():kind())        -- "number"
```

### Tipos Opcionales

```lua
type OptionalNumber = number?
print(OptionalNumber:kind())         -- "optional"
print(OptionalNumber:inner():kind()) -- "number"
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
type Predicate = (number, string) -> boolean
for param in Predicate:params() do
    print(param:kind())
end
print(Predicate:ret():kind())        -- "boolean"
```

`typeof(expression)` es sintaxis de tipos, no una función de reflexión durante la ejecución. Úsala en un alias como `type Config = typeof(default_config)`; el alias resultante es el valor de tipo durante la ejecución.

### Comparación de Tipos

```lua
type NumberType = number
type IntegerType = integer

print(NumberType == NumberType)      -- true
print(IntegerType <= NumberType)     -- true (subtype)
print(IntegerType < NumberType)      -- true (strict subtype)
```

### Tipos como Claves de Tabla

```lua
type NumberType = number
type StringType = string

local handlers = {}
handlers[NumberType] = function() return "number handler" end
handlers[StringType] = function() return "string handler" end

local h = handlers[NumberType]
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

Adjunta restricciones de validación a alias de tipo mediante anotaciones y después llama al tipo o usa `Type:is()` para aplicarlas durante la ejecución:

```lua
type NonNegative = number @min(0)
type Percentage = number @min(0) @max(100)
type Email = string @pattern("^.+@.+$")

local x = NonNegative(1)
local percent, err = Percentage:is(50)
local email = Email("test@example.com")
```

### Validadores Integrados

| Validador | Aplica a | Ejemplo |
|-----------|----------|---------|
| `@min(n)` | number | `type Positive = number @min(1)` |
| `@max(n)` | number | `type Percentage = number @max(100)` |
| `@min_len(n)` | string, array | `type NonEmpty = string @min_len(1)` |
| `@max_len(n)` | string, array | `type ShortName = string @max_len(10)` |
| `@pattern(regex)` | string | `type Email = string @pattern("^.+@.+$")` |

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
