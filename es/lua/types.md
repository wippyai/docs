# Sistema de Tipos

Wippy incluye un sistema de tipos gradual con verificación sensible al flujo. Los tipos son no nulos por defecto.

## Primitivos

```lua
local n: number = 3.14
local i: integer = 42         -- integer es subtipo de number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- dinámico explícito (excluir verificación)
local u: unknown = something  -- debe reducirse antes de usar
```

### any vs unknown

```lua
-- any: excluir verificación de tipos
local a: any = get_data()
a.foo.bar.baz()              -- sin error, puede fallar en tiempo de ejecución

-- unknown: desconocido seguro, debe reducirse antes de usar
local u: unknown = get_data()
u.foo                        -- ERROR: no se puede acceder a propiedad de unknown
if type(u) == "table" then
    -- u reducido a table aquí
end
```

## Seguridad de Nil

Los tipos son no nulos por defecto. Use `?` para valores opcionales:

```lua
local x: number = nil         -- ERROR: nil no asignable a number
local y: number? = nil        -- OK: number? significa "number o nil"
local z: number? = 42         -- OK
```

### Reducción por Flujo de Control

El verificador de tipos rastrea el flujo de control:

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- x es number aquí
    end
    return 0
end

-- Patrón de retorno temprano
local user, err = get_user(123)
if err then return nil, err end
-- user reducido a no nulo aquí

-- O por defecto
local val = get_value() or 0  -- val: number
```

## Tipos Union

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

-- Múltiples retornos
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- Retornos de error (idioma Lua)
local function fetch(url: string): (string?, error?)
    -- devuelve (data, nil) o (nil, error)
end

-- Tipos de función de primera clase
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

## Tipos Record

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

### Genéricos con Restricciones

```lua
type HasName = {name: string}

local function greet<T: HasName>(obj: T): string
    return "Hello, " .. obj.name
end

greet({name = "Alice"})       -- OK
greet({age = 30})             -- ERROR: falta 'name'
```

## Tipos Intersección

Combine múltiples tipos:

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

`never` es el tipo inferior - no existen valores:

```lua
function fail(msg: string): never
    error(msg)
end
```

## Patrón de Manejo de Errores

El verificador entiende el idioma de error de Lua:

```lua
local value, err = call()
if err then
    -- value es nil aquí
    return nil, err
end
-- value es no nulo aquí, err es nil
print(value)
```

## Aserción No Nula

Use `!` para asegurar que una expresión es no nula:

```lua
local user: User? = get_user()
local name = user!.name              -- asegura que user es no nulo
```

Si el valor es nil en tiempo de ejecución, se genera un error. Use cuando sepa que un valor no puede ser nil pero el verificador de tipos no puede probarlo.

## Conversiones de Tipo

### Conversión Segura (Validación)

Llame a un tipo como función para validar y convertir:

```lua
local data: any = get_json()
local user = User(data)              -- valida y devuelve User
local name = user.name               -- acceso seguro a campo
```

Funciona con primitivos y tipos personalizados:

```lua
local x: any = get_value()
local s = string(x)                  -- convertir a string
local n = integer(x)                 -- convertir a integer
local b = boolean(x)                 -- convertir a boolean

type Point = {x: number, y: number}
local p = Point(data)                -- valida estructura de record
```

### Método Type:is()

Validar sin lanzar, devuelve `(value, nil)` o `(nil, error)`:

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- p es Point válido
else
    return nil, err                  -- validación fallida
end
```

El resultado se reduce en condicionales:

```lua
if Point:is(data) then
    local p: Point = data            -- data reducido a Point
end
```

### Conversión Insegura

Use `::` o `as` para conversiones sin verificar:

```lua
local data: any = get_data()
local user = data :: User            -- sin verificación en tiempo de ejecución
local user = data as User            -- igual que ::
```

Use con moderación. Las conversiones inseguras omiten la validación y pueden causar errores en tiempo de ejecución si el valor no coincide con el tipo.

## Reflexión de Tipos

Los tipos son valores de primera clase con métodos de introspección.

### Kind y Name

```lua
print(Number:kind())                 -- "number"
print(Point:kind())                  -- "record"
print(Point:name())                  -- "Point"
```

### Campos de Record

Itere sobre campos de record:

```lua
type User = {name: string, age: number}

for name, typ in User:fields() do
    print(name, typ:kind())
end
-- name    string
-- age     number
```

Acceda a tipos de campo individuales:

```lua
local nameType = User.name           -- tipo del campo 'name'
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

### Tipos Union

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
print(Integer <= Number)             -- true (subtipo)
print(Integer < Number)              -- true (subtipo estricto)
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

Agregue tipos a firmas de función:

```lua
-- Tipos de parámetro y retorno
local function process(input: string): number
    return #input
end

-- Tipos de variable local
local count: number = 0

-- Alias de tipo
type StringArray = {string}
type StringMap = {[string]: number}
```

## Reglas de Varianza

| Posición | Varianza | Descripción |
|----------|----------|-------------|
| Campo de solo lectura | Covariante | Puede usar subtipo |
| Campo mutable | Invariante | Debe coincidir exactamente |
| Parámetro de función | Contravariante | Puede usar supertipo |
| Retorno de función | Covariante | Puede usar subtipo |

## Subtipado

- `integer` es subtipo de `number`
- `never` es subtipo de todos los tipos
- Todos los tipos son subtipos de `any`
- Subtipado de union: `A` es subtipo de `A | B`

## Adopción Gradual

Agregue tipos incrementalmente - el código sin tipos continúa funcionando:

```lua
-- El código existente funciona sin cambios
function old_function(x)
    return x + 1
end

-- El nuevo código obtiene tipos
function new_function(x: number): number
    return x + 1
end
```

Comience agregando tipos a:
1. Firmas de función en límites de API
2. Manejadores HTTP y consumidores de cola
3. Lógica de negocio crítica

## Verificación de Tipos

Ejecute el verificador de tipos:

```bash
wippy lint
```

Reporta errores de tipo sin ejecutar código.
