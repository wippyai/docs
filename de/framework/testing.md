# Test-Framework

Das Modul `wippy/test` bietet ein BDD-Testframework mit Assertions, Lifecycle-Hooks und Mocking.

## Einrichtung

Abhaengigkeit hinzufuegen:

```bash
wippy add wippy/test
wippy install
```

Das Modul registriert automatisch einen `test`-Befehl. Nach der Installation erkennt `wippy run test` alle Test-Eintraege in Ihrem Projekt und fuehrt sie aus.

## Tests definieren

Tests sind `function.lua`-Eintraege mit `meta.type: test`:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
      description: Math operations
    source: file://math_test.lua
    method: run
    imports:
      test: wippy.test:test
```

### Test-Metadaten

| Field | Required | Beschreibung |
|-------|----------|-------------|
| `type` | Yes | Muss `"test"` sein, damit der Runner den Test erkennt |
| `suite` | No | Gruppiert Tests in der Runner-Ausgabe |
| `description` | No | Menschenlesbare Beschreibung |
| `order` | No | Sortierreihenfolge innerhalb einer Suite (niedrigere Werte zuerst) |

## Tests schreiben

### BDD-Stil

Verwenden Sie `describe`- und `it`-Bloecke zur Strukturierung von Tests:

```lua
local test = require("test")

local function define_tests()
    test.describe("calculator", function()
        test.it("adds numbers", function()
            test.eq(1 + 1, 2)
        end)

        test.it("multiplies numbers", function()
            test.eq(3 * 4, 12)
        end)
    end)
end

local run_cases = test.run_cases(define_tests)

local function run(options)
    local result = run_cases(options)
    if result.failed_tests > 0 then
        error("tests failed: " .. result.failed_tests)
    end
    return result
end

return { run = run }
```

### Verschachtelte Suites

Suites koennen zur Organisation verschachtelt werden:

```lua
test.describe("user", function()
    test.describe("validation", function()
        test.it("requires name", function()
            test.ok(validate({}).error)
        end)

        test.it("accepts valid input", function()
            test.is_nil(validate({name = "Alice"}).error)
        end)
    end)

    test.describe("formatting", function()
        test.it("formats display name", function()
            test.eq(format_name("alice"), "Alice")
        end)
    end)
end)
```

### Tests ueberspringen

```lua
test.it_skip("not implemented yet", function()
    test.fail("TODO")
end)
```

Uebersprungene Tests erscheinen in der Ausgabe, zaehlen aber nicht als Fehler.

### Suite-Aliase

`test.spec` und `test.context` sind Aliase fuer `test.describe`:

```lua
test.spec("feature", function()
    test.context("when valid input", function()
        test.it("succeeds", function()
            test.ok(true)
        end)
    end)
end)
```

## Assertions

### Gleichheit

```lua
test.eq(actual, expected, msg?)       -- actual == expected
test.neq(actual, expected, msg?)      -- actual ~= expected
```

### Wahrheitswerte

```lua
test.ok(val, msg?)                    -- val is truthy
test.fail(msg?)                       -- unconditional failure
```

### Nil-Pruefungen

```lua
test.is_nil(val, msg?)                -- val == nil
test.not_nil(val, msg?)               -- val ~= nil
```

### Typpruefungen

```lua
test.is_true(val, msg?)               -- val == true
test.is_false(val, msg?)              -- val == false
test.is_string(val, msg?)
test.is_number(val, msg?)
test.is_table(val, msg?)
test.is_function(val, msg?)
test.is_boolean(val, msg?)
```

### Strings und Collections

```lua
test.contains(str, substr, msg?)      -- substring match
test.matches(str, pattern, msg?)      -- Lua pattern match
test.has_key(tbl, key, msg?)          -- table key exists
test.len(val, expected, msg?)         -- #val == expected
```

### Numerische Vergleiche

```lua
test.gt(a, b, msg?)                   -- a > b
test.gte(a, b, msg?)                  -- a >= b
test.lt(a, b, msg?)                   -- a < b
test.lte(a, b, msg?)                  -- a <= b
```

### Fehlerbehandlung

```lua
test.throws(fn, msg?)                 -- fn() raises error, returns it
test.has_error(val, err, msg?)        -- val is nil, err is not nil
test.no_error(val, err, msg?)         -- err is nil
```

Alle Assertions akzeptieren eine optionale Nachricht als letztes Argument. Bei einem Fehlschlag wird die Nachricht in der Fehlerausgabe angezeigt.

## Lifecycle-Hooks

```lua
test.describe("database", function()
    test.before_all(function()
        -- runs once before the suite
        db = connect()
    end)

    test.after_all(function()
        -- runs once after the suite
        db:close()
    end)

    test.before_each(function()
        -- runs before each test
        db:begin_transaction()
    end)

    test.after_each(function()
        -- runs after each test
        db:rollback()
    end)

    test.it("inserts a record", function()
        db:exec("INSERT INTO users (name) VALUES ('Alice')")
        local count = db:query_row("SELECT COUNT(*) FROM users")
        test.eq(count, 1)
    end)
end)
```

Hooks in verschachtelten Suites werden in Reihenfolge ausgefuehrt: `before_each` des Eltern-Blocks laeuft vor `before_each` des Kind-Blocks, und `after_each` des Kind-Blocks laeuft vor `after_each` des Eltern-Blocks.

## Mocking

Das Mock-System ersetzt globale Objektfelder und stellt sie nach jedem Test automatisch wieder her.

### Einfaches Mocking

```lua
test.describe("notifications", function()
    test.it("sends message", function()
        local sent = false
        test.mock("process.send", function(pid, topic, payload)
            sent = true
        end)

        notify_user("hello")
        test.is_true(sent)
        -- mock is auto-restored after this test
    end)
end)
```

### Mock-API

```lua
test.mock("object.field", replacement)    -- replace a global field
test.mock_process("field", replacement)   -- shorthand for process fields
test.restore_mock("object.field")         -- restore one mock
test.restore_all_mocks()                  -- restore all mocks
```

Mock-Pfade verwenden Punkt-Notation: `"process.send"` ersetzt `_G.process.send`.

Mocks fuer `process.send` leiten Test-Framework-Nachrichten automatisch ueber die Originalfunktion weiter, sodass die Test-Event-Berichterstattung weiterhin funktioniert, wenn process.send gemockt ist.

Alle Mocks werden nach jedem Test automatisch ueber den `after_each`-Hook wiederhergestellt.

## Tests ausfuehren

### Alle Tests ausfuehren

```bash
wippy run test
```

### Nach Muster filtern

```bash
wippy run test math
wippy run test user validation
```

Filter gleichen gegen Entry-IDs ab. Mehrere Muster werden kombiniert.

### Beispielausgabe

```
3 tests in 1 suites

  calculator
    + adds numbers                           0ms
    + multiplies numbers                     0ms
    - divides by zero                        1ms
      Error: expected error, got nil

  1 suite | 2 passed | 1 failed | 0 skipped | 3ms
```

## Einfache Tests

Fuer Tests, die das BDD-Framework nicht benoetigen, definieren Sie eine einfache Funktion, die `true` zurueckgibt oder einen Fehler ausloest:

```lua
local funcs = require("funcs")

local function main()
    local result, err = funcs.call("app:my_function", "input")
    if err then
        error("call failed: " .. tostring(err))
    end
    if result ~= "expected" then
        error("expected 'expected', got: " .. tostring(result))
    end
    return true
end

return { main = main }
```

```yaml
  - name: integration
    kind: function.lua
    meta:
      type: test
      suite: integration
    source: file://integration_test.lua
    method: main
    modules:
      - funcs
```

Der Runner erkennt, ob ein Test BDD-Case-Events verwendet oder einen einfachen Wert zurueckgibt. Beide Muster funktionieren mit `wippy run test`.

## Projektstruktur

Ein typisches Test-Layout:

```
src/
  _index.yaml
  app.lua
  test/
    _index.yaml          # test entries
    math_test.lua
    user_test.lua
    integration_test.lua
```

Die Test-`_index.yaml` definiert den Test-Namespace und die Eintraege:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
    source: file://math_test.lua
    method: run
    imports:
      test: wippy.test:test

  - name: user
    kind: function.lua
    meta:
      type: test
      suite: user
    source: file://user_test.lua
    method: run
    imports:
      test: wippy.test:test
```

## Infrastrukturanforderungen

Der Test-Runner benoetigt einen `process.host` und `terminal.host` in Ihrer Anwendung. Diese sind typischerweise bereits vorhanden. Falls nicht, fuegen Sie sie hinzu:

```yaml
entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true
```

## Siehe auch

- [Framework-Uebersicht](framework/overview.md) - Verwendung von Framework-Modulen
- [CLI-Referenz](guides/cli.md) - CLI-Befehle
- [Funktionen](concepts/functions.md) - Funktions-Registry
