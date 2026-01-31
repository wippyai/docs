# Type System

Wippy includes a gradual type system with flow-sensitive checking. Types are non-nullable by default.

## Primitives

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

## Nil Safety

Types are non-nullable by default. Use `?` for optional values:

```lua
local x: number = nil         -- ERROR: nil not assignable to number
local y: number? = nil        -- OK: number? means "number or nil"
local z: number? = 42         -- OK
```

### Control Flow Narrowing

The type checker tracks control flow:

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

## Union Types

```lua
local val: number | string = get_value()

if type(val) == "number" then
    print(val + 1)            -- val: number
else
    print(val:upper())        -- val: string
end
```

### Literal Types

```lua
type Status = "pending" | "active" | "done"

local s: Status = "pending"   -- OK
local s: Status = "invalid"   -- ERROR
```

## Function Types

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

### Variadic Functions

```lua
local function sum(...: number): number
    local total: number = 0
    for _, v in ipairs({...}) do
        total = total + v
    end
    return total
end
```

## Record Types

```lua
type User = {name: string, age: number}

local u: User = {name = "alice", age = 25}
```

### Optional Fields

```lua
type Config = {
    host: string,
    port: number,
    timeout?: number,
    debug?: boolean
}

local cfg: Config = {host = "localhost", port = 8080}  -- OK
```

## Generics

```lua
local function identity<T>(x: T): T
    return x
end

local n: number = identity(42)
local s: string = identity("hello")
```

### Constrained Generics

```lua
type HasName = {name: string}

local function greet<T: HasName>(obj: T): string
    return "Hello, " .. obj.name
end

greet({name = "Alice"})       -- OK
greet({age = 30})             -- ERROR: missing 'name'
```

## Intersection Types

Combine multiple types:

```lua
type Named = {name: string}
type Aged = {age: number}
type Person = Named & Aged

local p: Person = {name = "Alice", age = 30}
```

## Tagged Unions

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

## The never Type

`never` is the bottom type - no values exist:

```lua
function fail(msg: string): never
    error(msg)
end
```

## Error Handling Pattern

The checker understands the Lua error idiom:

```lua
local value, err = call()
if err then
    -- value is nil here
    return nil, err
end
-- value is non-nil here, err is nil
print(value)
```

## Type Annotations

Add types to function signatures:

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

## Variance Rules

| Position | Variance | Description |
|----------|----------|-------------|
| Readonly field | Covariant | Can use subtype |
| Mutable field | Invariant | Must match exactly |
| Function parameter | Contravariant | Can use supertype |
| Function return | Covariant | Can use subtype |

## Subtyping

- `integer` is a subtype of `number`
- `never` is a subtype of all types
- All types are subtypes of `any`
- Union subtyping: `A` is subtype of `A | B`

## Gradual Adoption

Add types incrementally - untyped code continues to work:

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

Start by adding types to:
1. Function signatures at API boundaries
2. HTTP handlers and queue consumers
3. Critical business logic
