# Type System
<secondary-label ref="experimental"/>

Wippy includes a sound, gradual type system. Types are non-nullable by default, array access returns `T?`, and mutable containers are invariant.

## Primitives

```lua
local n: number = 3.14
local i: integer = 42         -- integer is subtype of number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- explicit escape hatch (unsound)
local u: unknown = something  -- safe unknown, must validate before use
```

### unknown vs any

```lua
-- any: opt-out of type checking (unsound)
local a: any = fetch_raw()
a.foo.bar.baz()              -- no compile error, may crash at runtime

-- unknown: safe unknown (must narrow before use)
local u: unknown = fetch_raw()
u.foo                        -- ERROR: cannot access property of unknown
if type(u) == "table" then
    -- u narrowed to table
end
local user = User(u)         -- validate to get typed value
```

## Nil Safety

Types are non-nullable by default. Use `?` for optional values:

```lua
local x: number = nil         -- ERROR: nil not assignable to number
local y: number? = nil        -- OK: number? means "number or nil"
local z: number? = 42         -- OK
```

### Nil Check Narrowing

The type checker understands control flow:

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
-- user is User here (narrowed)

-- Or default
local val = get_value() or 0  -- val: number
```

### Non-nil Assertion

```lua
local arr: {number} = {1, 2, 3}
local first = arr[1]!         -- first: number (throws if nil at runtime)
```

## Safe Collection Access

Unlike TypeScript, array and map access returns `T?`:

```lua
local arr: {number} = {1, 2, 3}
local x = arr[1]              -- x: number? (not number)
local y = arr[100]            -- y: number? (nil at runtime, type-safe)

local map: {[string]: number} = {a = 1, b = 2}
local z = map["a"]            -- z: number?

-- Safe patterns
if x ~= nil then
    use(x)                    -- x: number
end
local val = arr[i] or 0       -- val: number
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

### Exhaustive Matching

The compiler ensures all cases are handled:

```lua
local val: number | string | boolean = get()

if type(val) == "number" then
    print(val + 1)
end
-- ERROR: unhandled cases: string, boolean
```

### Literal Types

```lua
type TrafficLight = "red" | "yellow" | "green"

local light: TrafficLight = "red"      -- OK
local light: TrafficLight = "purple"   -- ERROR
```

## Function Types

```lua
local function add(a: number, b: number): number
    return a + b
end

-- Multiple returns (Lua idiom)
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- Error returns
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

## Record Types (Nominal)

Named types are nominal - same shape does not mean same type:

```lua
type User = {name: string, age: number}
type Admin = {name: string, age: number}

local admin: Admin = {name = "alice", age = 25}
local user: User = admin     -- ERROR: Admin not assignable to User
```

This prevents semantic errors:

```lua
type Meters = number
type Feet = number

local height: Meters = 100
local length: Feet = height  -- ERROR: Meters not assignable to Feet
```

### Optional Fields

```lua
type Config = {
    host: string,
    port: number,
    timeout?: number,
    debug?: boolean
}

local cfg: Config = { host = "localhost", port = 8080 }  -- OK
```

### Anonymous Tables (Structural)

Anonymous table types are structural:

```lua
local obj: {name: string, age: number} = {name = "bob", age = 30}

-- Width subtyping: extra fields OK
local other = {name = "alice", age = 25, extra = true}
local obj2: {name: string, age: number} = other  -- OK
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

greet({name = "Alice"})      -- OK
greet({age = 30})            -- ERROR: missing 'name' field
```

### Invariant Mutable Containers

Mutable generics are invariant to prevent aliasing bugs:

```lua
type Animal = {name: string}
type Dog = {name: string, breed: string}

local dogs: {Dog} = {{name = "Rex", breed = "Lab"}}
local animals: {Animal} = dogs  -- ERROR

-- Why? If allowed:
-- animals[1] = {name = "Cat"}  -- would corrupt dogs!
```

## Readonly Modifier

Readonly collections are covariant (safe for subtyping):

```lua
local nums: readonly {number} = {10, 20, 30}
local first = nums[1]        -- OK: reading
nums[1] = 100                -- ERROR: cannot assign to readonly

-- Covariant: readonly {Dog} assignable to readonly {Animal}
local dogs: readonly {Dog} = {{name = "Rex", breed = "Lab"}}
local animals: readonly {Animal} = dogs  -- OK
```

## Intersection Types

Combine multiple types:

```lua
type Named = {name: string}
type Aged = {age: number}
type Person = Named & Aged

local p: Person = {name = "Alice", age = 30}
```

## Tagged Unions (Sum Types)

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
    -- No else needed: compiler knows all cases covered
end
```

## The never Type

`never` is the bottom type - no values exist:

```lua
function fail(msg: string): never
    error(msg)
end

-- Exhaustiveness checking
type Color = "red" | "green" | "blue"

function name(c: Color): string
    if c == "red" then return "Red"
    elseif c == "green" then return "Green"
    elseif c == "blue" then return "Blue"
    else
        local _: never = c  -- compile-time exhaustiveness check
        error("unreachable")
    end
end
```

## Types as Values

Types are first-class runtime values - callable, passable, and introspectable.

### Validation

Types can validate data at runtime. Call a type as a function to validate and get a typed value:

```lua
type User = {name: string, age: number}

-- Assert style: throws on failure
local data = fetch_json("/api/user")  -- data: unknown
local user = User(data)               -- validates at runtime, returns value or throws

-- Check style: returns boolean (no error, fast)
if User:is(data) then
    process(data)                     -- data is valid User
end
```

<tip>
Runtime validation means types aren't just for compile-time checks. You can validate JSON from APIs, user input, or any external data against your type definitions.
</tip>

### Passing Types as Values

```lua
local function fetch_as<T>(url: string, schema: type<T>): T
    local data = http.get(url):json()
    return schema(data)               -- validates
end

local user = fetch_as("/api/user", User)
local order = fetch_as("/api/order", Order)
```

### Reflection

```lua
type Point = {x: number, y: number}

Point:kind()              -- "record"
Point:name()              -- "Point"
Point.x                   -- number (type of field x)

for name, typ in Point:fields() do
    print(name, typ:kind())   -- "x number", "y number"
end

-- Type comparison
print(integer <= number)     -- true: integer is subtype
print(Point == Point)        -- true: same type
```

### Introspection Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `:kind()` | string | "number", "record", "array", "union", etc. |
| `:name()` | string? | Type name or nil for anonymous |
| `:is(value)` | boolean | Validates value against type |
| `:elem()` | type | Array element type |
| `:key()` | type | Map key type |
| `:val()` | type | Map value type |
| `:inner()` | type | Optional inner type |
| `:ret()` | type | Function return type |
| `:fields()` | iterator | Yields (name, type) pairs |
| `:variants()` | iterator | Yields union variant types |
| `:params()` | iterator | Yields function parameter types |

## Unsafe Operations

### Type Cast (::)

Compile-time only, no runtime check:

```lua
local data: unknown = fetch_raw()
local user = data :: User     -- tells compiler "trust me"
```

### Type Assertion (as)

Alternative syntax:

```lua
local x: any = 42
local y: number = x as number
```

## Recursive Types

Self-referential types work through lazy resolution:

```lua
type Node<T> = {
    value: T,
    next: Node<T>?,
}

type JSONValue =
    | nil
    | boolean
    | number
    | string
    | {JSONValue}
    | {[string]: JSONValue}
```

## Error Handling

Errors are values, not exceptions:

```lua
-- Standard pattern: (T?, error?)
function parse(s: string): (number?, error?)
    local n = tonumber(s)
    if n == nil then
        return nil, {message = "not a number: " .. s}
    end
    return n, nil
end

local data, err = fetch("/api")
if err then return nil, err end
print(data:upper())          -- OK: data narrowed to string
```

## Variance Rules

| Position | Variance | Safe Operations |
|----------|----------|-----------------|
| Readonly field/element | Covariant | Read only |
| Mutable field/element | Invariant | Read and write |
| Function parameter | Contravariant | Passed in |
| Function return | Covariant | Passed out |

## Configuration

```yaml
lua:
  type_system:
    enabled: true
    strict: true
    skip_untyped: true
    rules:
      type_check: true
      nil_check: true
      readonly: true
      undefined: true
      missing_return: true
      exhaustive: false
```

## Gradual Adoption

Add types incrementally:

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
1. Function signatures
2. API boundaries (HTTP handlers, queue consumers)
3. Critical business logic
