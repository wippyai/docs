# Typsystem

Wippy enthält ein graduelles Typsystem mit flusssensitiver Prüfung. Typen sind standardmäßig nicht-nullable.

## Primitive

```lua
local n: number = 3.14
local i: integer = 42         -- integer ist Subtyp von number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- explizit dynamisch (opt-out der Prufung)
local u: unknown = something  -- muss vor Verwendung eingeschrankt werden
```

### any vs unknown

```lua
-- any: Opt-out aus der Typprüfung
local a: any = get_data()
a.foo.bar.baz()              -- kein Fehler, kann zur Laufzeit abstürzen

-- unknown: sicheres Unbekannt, muss vor Verwendung eingeschränkt werden
local u: unknown = get_data()
u.foo                        -- FEHLER: kann auf Eigenschaft von unknown nicht zugreifen
if type(u) == "table" then
    -- u hier auf table eingeschrankt
end
```

## Nil-Sicherheit

Typen sind standardmäßig nicht-nullable. Verwenden Sie `?` für optionale Werte:

```lua
local x: number = nil         -- FEHLER: nil nicht an number zuweisbar
local y: number? = nil        -- OK: number? bedeutet "number oder nil"
local z: number? = 42         -- OK
```

### Kontrollfluss-Einschränkung

Der Typchecker verfolgt den Kontrollfluss:

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- x ist hier number
    end
    return 0
end

-- Early-Return-Muster
local user, err = get_user(123)
if err then return nil, err end
-- user hier auf non-nil eingeschrankt

-- Oder Standard
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
local s: Status = "invalid"   -- FEHLER
```

## Funktionstypen

```lua
local function add(a: number, b: number): number
    return a + b
end

-- Mehrere Rückgaben
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- Fehler-Rückgaben (Lua-Idiom)
local function fetch(url: string): (string?, error?)
    -- gibt (data, nil) oder (nil, error) zurück
end

-- Erstklassige Funktionstypen
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
greet({age = 30})             -- FEHLER: fehlendes 'name'
```

## Intersection-Typen

Kombinieren Sie mehrere Typen:

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

`never` ist der Bottom-Typ - es existieren keine Werte:

```lua
function fail(msg: string): never
    error(msg)
end
```

## Fehlerbehandlungsmuster

Der Checker versteht das Lua-Fehler-Idiom:

```lua
local value, err = call()
if err then
    -- value ist hier nil
    return nil, err
end
-- value ist hier non-nil, err ist nil
print(value)
```

## Non-Nil-Assertion

Verwenden Sie `!` um zu behaupten, dass ein Ausdruck non-nil ist:

```lua
local user: User? = get_user()
local name = user!.name              -- behauptet, dass user non-nil ist
```

Wenn der Wert zur Laufzeit nil ist, wird ein Fehler ausgelöst. Verwenden Sie dies, wenn Sie wissen, dass ein Wert nicht nil sein kann, aber der Typchecker es nicht beweisen kann.

## Typ-Casts

### Sicherer Cast (Validierung)

Rufen Sie einen Typ als Funktion auf, um zu validieren und zu casten:

```lua
local data: any = get_json()
local user = User(data)              -- validiert und gibt User zuruck
local name = user.name               -- sicherer Feldzugriff
```

Funktioniert mit Primitiven und benutzerdefinierten Typen:

```lua
local x: any = get_value()
local s = string(x)                  -- cast zu string
local n = integer(x)                 -- cast zu integer
local b = boolean(x)                 -- cast zu boolean

type Point = {x: number, y: number}
local p = Point(data)                -- validiert Record-Struktur
```

### Type:is()-Methode

Validieren ohne Fehler zu werfen, gibt `(value, nil)` oder `(nil, error)` zurück:

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- p ist gültiger Point
else
    return nil, err                  -- Validierung fehlgeschlagen
end
```

Das Ergebnis schrankt in Bedingungen ein:

```lua
if Point:is(data) then
    local p: Point = data            -- data auf Point eingeschrankt
end
```

### Unsicherer Cast

Verwenden Sie `::` oder `as` für ungeprüftes Casten:

```lua
local data: any = get_data()
local user = data :: User            -- keine Laufzeitprüfung
local user = data as User            -- gleich wie ::
```

Sparsam verwenden. Unsichere Casts umgehen die Validierung und können Laufzeitfehler verursachen, wenn der Wert nicht zum Typ passt.

## Typ-Reflektion

Typen sind erstklassige Werte mit Introspektionsmethoden.

### Art und Name

```lua
print(Number:kind())                 -- "number"
print(Point:kind())                  -- "record"
print(Point:name())                  -- "Point"
```

### Record-Felder

Iterieren Sie über Record-Felder:

```lua
type User = {name: string, age: number}

for name, typ in User:fields() do
    print(name, typ:kind())
end
-- name    string
-- age     number
```

Greifen Sie auf einzelne Feldtypen zu:

```lua
local nameType = User.name           -- Typ des 'name'-Feldes
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

### Typvergleich

```lua
print(Number == Number)              -- true
print(Integer <= Number)             -- true (Subtyp)
print(Integer < Number)              -- true (strikter Subtyp)
```

### Typen als Tabellenschlussel

```lua
local handlers = {}
handlers[Number] = function() return "number handler" end
handlers[String] = function() return "string handler" end

local h = handlers[typeof(value)]
if h then h() end
```

## Typannotationen

Fügen Sie Typen zu Funktionssignaturen hinzu:

```lua
-- Parameter- und Rückgabetypen
local function process(input: string): number
    return #input
end

-- Lokale Variablentypen
local count: number = 0

-- Typaliase
type StringArray = {string}
type StringMap = {[string]: number}
```

## Varianzregeln

| Position | Varianz | Beschreibung |
|----------|----------|-------------|
| Readonly-Feld | Kovariant | Kann Subtyp verwenden |
| Mutables Feld | Invariant | Muss exakt übereinstimmen |
| Funktionsparameter | Kontravariant | Kann Supertyp verwenden |
| Funktionsrückgabe | Kovariant | Kann Subtyp verwenden |

## Subtyping

- `integer` ist Subtyp von `number`
- `never` ist Subtyp aller Typen
- Alle Typen sind Subtypen von `any`
- Union-Subtyping: `A` ist Subtyp von `A | B`

## Graduelle Adoption

Fügen Sie Typen inkrementell hinzu - untypisierter Code funktioniert weiterhin:

```lua
-- Bestehender Code funktioniert unverändert
function old_function(x)
    return x + 1
end

-- Neuer Code erhält Typen
function new_function(x: number): number
    return x + 1
end
```

Beginnen Sie mit dem Hinzufügen von Typen zu:
1. Funktionssignaturen an API-Grenzen
2. HTTP-Handler und Queue-Consumer
3. Kritische Geschäftslogik

## Typprüfung

Führen Sie den Typchecker aus:

```bash
wippy lint
```

Meldet Typfehler ohne Code auszuführen.
