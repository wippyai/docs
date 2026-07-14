---
title: "Typsystem"
---

# Typsystem

> **Experimentell.** Einige Einschränkungen sind zu erwarten.

Wippy enthält ein graduelles Typsystem mit flusssensitiver Prüfung. Typen sind standardmäßig nicht-nullbar.

## Primitive

```lua
local n: number = 3.14
local i: integer = 42         -- integer is subtype of number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- explicit dynamic (opt-out of checking)
local u: unknown = something  -- must narrow before use
```

### any vs. unknown

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

## Nil-Sicherheit

Typen sind standardmäßig nicht-nullbar. Verwende `?` für optionale Werte:

```lua
local x: number = nil         -- ERROR: nil not assignable to number
local y: number? = nil        -- OK: number? means "number or nil"
local z: number? = 42         -- OK
```

### Kontrollfluss-Verfeinerung

Der Typprüfer verfolgt den Kontrollfluss:

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

## Union-Typen

```lua
local val: number | string = get_value()

if type(val) == "number" then
    print(val + 1)            -- val: number
else
    print(val:upper())        -- val: string
end
```

### Literal-Typen

```lua
type Status = "pending" | "active" | "done"

local s: Status = "pending"   -- OK
local s: Status = "invalid"   -- ERROR
```

## Funktionstypen

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

### Variadische Funktionen

```lua
local function sum(...: number): number
    local total: number = 0
    for _, v in ipairs({...}) do
        total = total + v
    end
    return total
end
```

## Record-Typen

```lua
type User = {name: string, age: number}

local u: User = {name = "alice", age = 25}
```

### Optionale Felder

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

### Eingeschränkte Generics

```lua
type HasName = {name: string}

local function greet<T: HasName>(obj: T): string
    return "Hello, " .. obj.name
end

greet({name = "Alice"})       -- OK
greet({age = 30})             -- ERROR: missing 'name'
```

## Intersection-Typen

Mehrere Typen kombinieren:

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

## Der never-Typ

`never` ist der Bottom-Typ — es existieren keine Werte:

```lua
function fail(msg: string): never
    error(msg)
end
```

## Fehlerbehandlungs-Muster

Der Prüfer versteht das Lua-Fehler-Idiom:

```lua
local value, err = call()
if err then
    -- value is nil here
    return nil, err
end
-- value is non-nil here, err is nil
print(value)
```

## Non-Nil-Assertion

Verwende `!`, um zu beteuern, dass ein Ausdruck nicht nil ist:

```lua
local user: User? = get_user()
local name = user!.name              -- assert user is non-nil
```

Wenn der Wert zur Laufzeit nil ist, wird ein Fehler ausgelöst. Verwende dies, wenn du weißt, dass ein Wert nicht nil sein kann, der Typprüfer dies aber nicht beweisen kann.

## Typ-Casts

### Sicherer Cast (Validierung)

Rufe einen Typ als Funktion auf, um zu validieren und zu casten:

```lua
local data: any = get_json()
local user = User(data)              -- validates and returns User
local name = user.name               -- safe field access
```

Funktioniert mit Primitiven und benutzerdefinierten Typen:

```lua
local x: any = get_value()
local s = string(x)                  -- cast to string
local n = integer(x)                 -- cast to integer
local b = boolean(x)                 -- cast to boolean

type Point = {x: number, y: number}
local p = Point(data)                -- validates record structure
```

### Type:is()-Methode

Validiert ohne zu werfen, gibt `(value, nil)` oder `(nil, error)` zurück:

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

Das Ergebnis verfeinert sich in Conditionals:

```lua
if Point:is(data) then
    local p: Point = data            -- data narrowed to Point
end
```

### Unsicherer Cast

Verwende `::` oder `as` für ungeprüfte Casts:

```lua
local data: any = get_data()
local user = data :: User            -- no runtime check
local user = data as User            -- same as ::
```

Sparsam verwenden. Unsichere Casts umgehen die Validierung und können Laufzeitfehler verursachen, wenn der Wert nicht zum Typ passt.

## Typ-Reflektion

Typen sind First-Class-Werte mit Introspektionsmethoden.

### Kind und Name

```lua
print(Number:kind())                 -- "number"
print(Point:kind())                  -- "record"
print(Point:name())                  -- "Point"
```

### Record-Felder

Über Record-Felder iterieren:

```lua
type User = {name: string, age: number}

for name, typ in User:fields() do
    print(name, typ:kind())
end
-- name    string
-- age     number
```

Auf einzelne Feldtypen zugreifen:

```lua
local nameType = User.name           -- type of 'name' field
print(nameType:kind())               -- "string"
```

### Collection-Typen

```lua
local arr: {number} = {1, 2, 3}
local arrType = typeof(arr)
print(arrType:elem():kind())         -- "number"

local map: {[string]: number} = {}
local mapType = typeof(map)
print(mapType:key():kind())          -- "string"
print(mapType:val():kind())          -- "number"
```

### Optionale Typen

```lua
local opt: number? = nil
local optType = typeof(opt)
print(optType:kind())                -- "optional"
print(optType:inner():kind())        -- "number"
```

### Union-Typen

```lua
type Status = "pending" | "active" | "done"

for variant in Status:variants() do
    print(variant)
end
```

### Funktionstypen

```lua
local fn: (number, string) -> boolean

local fnType = typeof(fn)
for param in fnType:params() do
    print(param:kind())
end
print(fnType:ret():kind())           -- "boolean"
```

### Typ-Vergleich

```lua
print(Number == Number)              -- true
print(Integer <= Number)             -- true (subtype)
print(Integer < Number)              -- true (strict subtype)
```

### Typen als Tabellenschlüssel

```lua
local handlers = {}
handlers[Number] = function() return "number handler" end
handlers[String] = function() return "string handler" end

local h = handlers[typeof(value)]
if h then h() end
```

## Typ-Annotationen

Typen zu Funktionssignaturen hinzufügen:

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

## Typ-Validatoren

Füge Typen Laufzeit-Validierungs-Constraints über Annotationen hinzu:

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

### Eingebaute Validatoren

| Validator | Gilt für | Beispiel |
|-----------|------------|---------|
| `@min(n)` | number | `local x: number @min(0) = 1` |
| `@max(n)` | number | `local x: number @max(100) = 50` |
| `@min_len(n)` | string, array | `local s: string @min_len(1) = "hi"` |
| `@max_len(n)` | string, array | `local s: string @max_len(10) = "hi"` |
| `@pattern(regex)` | string | `local email: string @pattern("^.+@.+$") = "a@b.com"` |

### Validatoren für Record-Felder

```lua
type User = {
    age: number @min(0) @max(150),
    name: string @min_len(1) @max_len(100)
}
```

### Validatoren für Array-Elemente

```lua
local scores: {number @min(0) @max(100)} = {85, 90}
```

### Validatoren für Union-Mitglieder

```lua
local id: number @min(1) | string @min_len(1) = 1
```

## Varianzregeln

| Position | Varianz | Beschreibung |
|----------|----------|-------------|
| Readonly-Feld | Kovariant | Subtyp erlaubt |
| Veränderliches Feld | Invariant | Muss exakt übereinstimmen |
| Funktionsparameter | Kontravariant | Supertyp erlaubt |
| Funktions-Rückgabe | Kovariant | Subtyp erlaubt |

## Subtyping

- `integer` ist ein Subtyp von `number`
- `never` ist ein Subtyp aller Typen
- Alle Typen sind Subtypen von `any`
- Union-Subtyping: `A` ist Subtyp von `A | B`

## Schrittweise Einführung

Typen inkrementell hinzufügen — untypisierter Code funktioniert weiterhin:

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

Beginne damit, Typen hinzuzufügen zu:
1. Funktionssignaturen an API-Grenzen
2. HTTP-Handler und Queue-Konsumenten
3. Kritischer Geschäftslogik

## Typprüfung

Den Typprüfer ausführen:

```bash
wippy lint
```

Meldet Typfehler, ohne Code auszuführen.
