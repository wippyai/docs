# Contracts
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Rufen Sie Services uber typisierte Contracts auf. Rufen Sie Remote-APIs, Workflows und Funktionen mit Schema-Validierung und Unterstutzung fur asynchrone Ausfuhrung auf.

## Laden

```lua
local contract = require("contract")
```

## Ein Binding offnen

Offnen Sie ein Binding direkt per ID:

```lua
local greeter, err = contract.open("app.services:greeter")
if err then
    return nil, err
end

local result, err = greeter:say_hello("Alice")
```

Mit Scope-Kontext oder Query-Parametern:

```lua
-- Mit Scope-Tabelle
local svc, err = contract.open("app.services:user", {
    tenant_id = "acme",
    region = "us-east"
})

-- Mit Query-Parametern (automatisch konvertiert: "true"→bool, Zahlen→int/float)
local api, err = contract.open("app.services:api?debug=true&timeout=5000")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `binding_id` | string | Binding-ID, unterstutzt Query-Parameter |
| `scope` | table | Kontextwerte (optional, uberschreibt Query-Parameter) |

**Gibt zuruck:** `Instance, error`

## Einen Contract abrufen

Rufen Sie die Contract-Definition zur Introspektion ab:

```lua
local c, err = contract.get("app.services:greeter")

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
```

### Methodendefinition

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `name` | string | Methodenname |
| `description` | string | Methodenbeschreibung |
| `input_schemas` | table[] | Eingabe-Schema-Definitionen |
| `output_schemas` | table[] | Ausgabe-Schema-Definitionen |

## Implementierungen finden

Listen Sie alle Bindings auf, die einen Contract implementieren:

```lua
local bindings, err = contract.find_implementations("app.services:greeter")

for _, binding_id in ipairs(bindings) do
    print(binding_id)
end
```

Oder uber das Contract-Objekt:

```lua
local c, err = contract.get("app.services:greeter")
local bindings, err = c:implementations()
```

## Implementierung prufen

Prufen Sie, ob eine Instanz einen Contract implementiert:

```lua
if contract.is(instance, "app.services:greeter") then
    instance:say_hello("World")
end
```

## Methoden aufrufen

Synchroner Aufruf - blockiert bis zum Abschluss:

```lua
local calc, err = contract.open("app.services:calculator")

local sum, err = calc:add(10, 20)
local product, err = calc:multiply(5, 6)
```

## Asynchrone Aufrufe

Fugen Sie das Suffix `_async` fur asynchrone Ausfuhrung hinzu:

```lua
local processor, err = contract.open("app.services:processor")

local future, err = processor:process_async(large_dataset)

-- Andere Arbeit erledigen...

-- Auf Ergebnis warten
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

Siehe [Futures](lua-future.md) fur Future-Methoden.

## Via Contract offnen

Offnen Sie ein Binding uber das Contract-Objekt:

```lua
local c, err = contract.get("app.services:user")

-- Standard-Binding
local instance, err = c:open()

-- Spezifisches Binding
local instance, err = c:open("app.services:user_impl")

-- Mit Scope
local instance, err = c:open(nil, {user_id = 123})
local instance, err = c:open("app.services:user_impl", {user_id = 123})
```

## Kontext hinzufugen

Erstellen Sie einen Wrapper mit vorkonfiguriertem Kontext:

```lua
local c, err = contract.get("app.services:user")

local wrapped = c:with_context({
    request_id = ctx.get("request_id"),
    user_id = current_user.id
})

local instance, err = wrapped:open()
```

## Sicherheitskontext

Setzen Sie Actor und Scope fur die Autorisierung:

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")

local secured = c:with_actor(security.actor()):with_scope(security.scope())

local admin, err = secured:open()
```

## Berechtigungen

| Berechtigung | Ressource | Funktionen |
|------------|----------|-----------|
| `contract.get` | Contract-ID | `get()` |
| `contract.open` | Binding-ID | `open()`, `Contract:open()` |
| `contract.implementations` | Contract-ID | `find_implementations()`, `Contract:implementations()` |
| `contract.call` | Methodenname | synchrone und asynchrone Methodenaufrufe |
| `contract.context` | "context" | `Contract:with_context()` |
| `contract.security` | "security" | `Contract:with_actor()`, `Contract:with_scope()` |

## Fehler

| Bedingung | Art |
|-----------|------|
| Ungultiges Binding-ID-Format | `errors.INVALID` |
| Contract nicht gefunden | `errors.NOT_FOUND` |
| Binding nicht gefunden | `errors.NOT_FOUND` |
| Methode nicht gefunden | `errors.NOT_FOUND` |
| Kein Standard-Binding | `errors.NOT_FOUND` |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` |
| Aufruf fehlgeschlagen | `errors.INTERNAL` |
