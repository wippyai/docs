---
title: "Typsystem"
description: "Syntax und Runtime-Verhalten von Wippys graduellem Typsystem, einschließlich Unions, Records, Generics, Validierung und Reflektion."
---

# Typsystem

> **Experimentell.** Das Typsystem wird weiterentwickelt; einige Einschränkungen sind zu erwarten.

Wippys graduelles Typsystem unterstützt schrittweise Annotationen und flusssensitive Prüfung. Typen sind standardmäßig nicht-nullbar.

Diese Seite ist eine Sprachreferenz und kein vollständiges Programm. Jeder Codeblock ist ein isoliertes Typprüfungsbeispiel; Alternativen innerhalb eines Blocks sind nicht zwingend zur gemeinsamen Verwendung gedacht. Namen wie `get_data`, `get_user`, `call` und `User` stehen für Anwendungscode. Mit `ERROR` markierte Zeilen demonstrieren absichtlich Diagnosen. Die Beispiele verwenden Sprachsyntax und integrierte Typwerte und benötigen daher keine Runtime-Module.

## Primitive

```lua
local n: number = 3.14
local i: integer = 42         -- integer is subtype of number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- dynamic member and method access
local u: unknown = { source = "example" }  -- must narrow before use
```

### `any` und `unknown`

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

## Der never-Typ

`never` ist der Bottom-Typ: Er besitzt keine möglichen Werte.

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

Verwenden Sie `!`, um zu bestätigen, dass ein Ausdruck nicht `nil` ist:

```lua
local user: User? = get_user()
local name = (user!).name            -- assert user is non-nil
```

`!` ist ausschließlich eine Assertion für den Typprüfer: Sie verengt den Typ auf Nicht-`nil`, erzeugt aber keine Runtime-Prüfung. Ist der Wert tatsächlich `nil`, schlägt die folgende Operation mit dem üblichen Fehler fehl, etwa beim Indizieren von `nil`. Verwenden Sie die Assertion, wenn ein Wert sicher nicht `nil` sein kann, der Typprüfer dies aber nicht beweisen kann.

## Typ-Casts

### Runtime-Validierung

Rufen Sie einen Typ als Funktion auf, um einen Wert zu validieren. Die Validierung gibt den ursprünglichen Wert mit dem angeforderten statischen Typ zurück; sie konvertiert oder koerziert ihn nicht:

```lua
local data: any = get_json()
local user = User(data)              -- validates and returns User
local name = user.name               -- safe field access
```

Dies funktioniert mit primitiven und benutzerdefinierten Typen:

```lua
local x: any = get_value()
local s = string(x)                  -- requires an existing string
local n = integer(x)                 -- requires an existing integer
local b = boolean(x)                 -- requires an existing boolean

type Point = {x: number, y: number}
local p = Point(data)                -- validates record structure
```

Beispielsweise löst `string(42)` einen Validierungsfehler aus; verwenden Sie `tostring(42)`, wenn eine Konvertierung beabsichtigt ist.

### `Type:is()`-Methode

`Type:is` validiert, ohne einen Fehler auszulösen, und gibt entweder `(value, nil)` oder `(nil, error)` zurück:

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

Das Ergebnis verengt den Typ in Bedingungen:

```lua
if Point:is(data) then
    local p: Point = data            -- data narrowed to Point
end
```

### Unsicherer Cast

Verwenden Sie `::` oder `as` für ungeprüfte Casts:

```lua
local data: any = get_data()
local user = data :: User            -- no runtime check
local user = data as User            -- same as ::
```

Verwenden Sie diese sparsam. Unsichere Casts umgehen die Validierung und können Runtime-Fehler verursachen, wenn der Wert nicht zum Typ passt.

## Typ-Reflektion

Typen sind erstklassige Werte mit Introspektionsmethoden.

### Kind und Name

```lua
type NumberType = number
print(NumberType:kind())             -- "number"
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
type NumberArray = {number}
print(NumberArray:elem():kind())     -- "number"

type NumberMap = {[string]: number}
print(NumberMap:key():kind())        -- "string"
print(NumberMap:val():kind())        -- "number"
```

### Optionale Typen

```lua
type OptionalNumber = number?
print(OptionalNumber:kind())         -- "optional"
print(OptionalNumber:inner():kind()) -- "number"
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
type Predicate = (number, string) -> boolean
for param in Predicate:params() do
    print(param:kind())
end
print(Predicate:ret():kind())        -- "boolean"
```

`typeof(expression)` ist Typsyntax und keine Runtime-Reflektionsfunktion. Verwenden Sie sie in einem Alias wie `type Config = typeof(default_config)`; der resultierende Alias ist der Runtime-Typwert.

### Typ-Vergleich

```lua
type NumberType = number
type IntegerType = integer

print(NumberType == NumberType)      -- true
print(IntegerType <= NumberType)     -- true (subtype)
print(IntegerType < NumberType)      -- true (strict subtype)
```

### Typen als Tabellenschlüssel

```lua
type NumberType = number
type StringType = string

local handlers = {}
handlers[NumberType] = function() return "number handler" end
handlers[StringType] = function() return "string handler" end

local h = handlers[NumberType]
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

Hängen Sie Typaliasen mit Annotationen Validierungsbedingungen an. Rufen Sie anschließend den Typ auf oder verwenden Sie `Type:is()`, um sie zur Laufzeit durchzusetzen:

```lua
type NonNegative = number @min(0)
type Percentage = number @min(0) @max(100)
type Email = string @pattern("^.+@.+$")

local x = NonNegative(1)
local percent, err = Percentage:is(50)
local email = Email("test@example.com")
```

Eine Annotation an einer lokalen Variable wird vom Linter statisch geprüft. Sie fügt bei der Zuweisung keine automatische Runtime-Prüfung ein; die Durchsetzung zur Laufzeit erfolgt, wenn ein Typwert einen Wert validiert.

### Eingebaute Validatoren

| Validator | Gilt für | Beispiel |
|-----------|------------|---------|
| `@min(n)` | number | `type Positive = number @min(1)` |
| `@max(n)` | number | `type Percentage = number @max(100)` |
| `@min_len(n)` | string, array | `type NonEmpty = string @min_len(1)` |
| `@max_len(n)` | string, array | `type ShortName = string @max_len(10)` |
| `@pattern(regex)` | string | `type Email = string @pattern("^.+@.+$")` |

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
| Veränderliches Feld | Quasi-invariant | Normalerweise invariant; frische Literale und Verengungen können auf ihren Basistyp erweitert werden |
| Funktionsparameter | Kontravariant | Supertyp erlaubt |
| Funktions-Rückgabe | Kovariant | Subtyp erlaubt |

## Subtyping

- `integer` ist ein Subtyp von `number`
- `never` ist ein Subtyp aller Typen
- Alle Typen sind Subtypen von `any`
- Union-Subtyping: `A` ist Subtyp von `A | B`

## Schrittweise Einführung

Typen lassen sich schrittweise hinzufügen; untypisierter Code funktioniert weiterhin:

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

Sinnvolle Ausgangspunkte sind:

1. Funktionssignaturen an API-Grenzen
2. HTTP-Handler und Queue-Konsumenten
3. Kritischer Geschäftslogik

## Typprüfung

Führen Sie den Typprüfer aus mit:

```bash
wippy lint
```

Der Befehl meldet Typfehler, ohne Code auszuführen.
