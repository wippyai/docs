---
title: "Test-Framework"
description: "Wippy-Tests mit BDD-Suites, Assertions, Lifecycle-Hooks, Mocks und einfachen Testfunktionen definieren und ausführen."
---

# Test-Framework

Das Modul `wippy/test` stellt BDD-Suites, Assertions, Lifecycle-Hooks, Mocks und
einen Runner für Testeinträge bereit.

Diese Seite ist eine API-Einführung. Die Lua-, YAML-, Ausgabe- und Projektstrukturblöcke
sind Referenz-Snippets für ein bestehendes Wippy-Projekt und ergeben zusammen kein
direkt kopierbares Projekt. Namen wie `validate`, `format_name`, `db`, `connect` und
`notify_user` stehen für Funktionen oder Module der getesteten Anwendung. Ein
vollständiges ausführbares Beispiel finden Sie unter
[Eine Wippy-Anwendung testen](../tutorials/testing.md).

## Einrichtung

Fügen Sie die Abhängigkeit hinzu:

```bash
wippy add wippy/test
wippy install
```

Das Modul registriert den Test-Einstiegspunkt automatisch als Befehl mit
`use_case: test`. Nach der Installation entdeckt und führt `wippy test` alle
Testeinträge im Projekt aus.

## Tests definieren

Tests sind `function.lua`-Einträge mit `meta.type: test`:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
      name: Math operations
    source: file://math_test.lua
    method: main
    imports:
      test: wippy.test:test
```

### Test-Metadaten

| Feld | Erforderlich | Beschreibung |
|-------|----------|-------------|
| `type` | Ja | Muss `"test"` sein, damit der Runner den Test entdeckt |
| `suite` | Nein | Gruppiert Tests in der Runner-Ausgabe |
| `name` | Nein | Anzeigename in der Runner-Ausgabe |
| `order` | Nein | Sortierreihenfolge innerhalb einer Suite (niedrigere Werte zuerst) |

## Tests schreiben

### BDD-Stil

Strukturieren Sie Tests mit `describe`- und `it`-Blöcken:

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

Suites können verschachtelt werden, um zusammengehöriges Verhalten zu gruppieren:

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

### Tests überspringen

```lua
test.it_skip("not implemented yet", function()
    test.fail("TODO")
end)
```

Übersprungene Tests erscheinen in der Ausgabe, zählen aber nicht als Fehler.

### Suite-Aliase

`test.spec` und `test.context` sind Aliase für `test.describe`:

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

### Nil-Prüfungen

```lua
test.is_nil(val, msg?)                -- val == nil
test.not_nil(val, msg?)               -- val ~= nil
```

### Typprüfungen

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

Hooks verschachtelter Suites werden geordnet ausgeführt: Das `before_each` der
übergeordneten Suite läuft vor dem `before_each` der untergeordneten Suite; deren
`after_each` läuft vor dem `after_each` der übergeordneten Suite.

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

Mocks für `process.send` leiten Nachrichten des Testframeworks automatisch über die
Originalfunktion weiter. Die Berichterstattung über Testereignisse funktioniert daher
weiterhin, wenn `process.send` gemockt ist.

Alle Mocks werden nach jedem Test automatisch über den Hook `after_each` wiederhergestellt.

## Tests ausführen

### Alle Tests ausführen

```bash
wippy test
```

### Nach Muster filtern

```bash
wippy test math
wippy test user validation
```

Filter suchen nach wörtlichen Teilstrings in den Eintrags-IDs. Bei mehreren Mustern
wird ein Eintrag ausgeführt, wenn seine ID mindestens eines davon enthält.

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

Für Tests ohne BDD-Suites definieren Sie eine Funktion, die `true` zurückgibt oder
einen Fehler auslöst:

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

Der Runner erkennt, ob ein Test BDD-Fallereignisse verwendet oder einen einfachen Wert
zurückgibt. Beide Muster funktionieren mit `wippy test`.

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

Die Testdatei `_index.yaml` definiert Namespace und Einträge:

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
    method: main
    imports:
      test: wippy.test:test

  - name: user
    kind: function.lua
    meta:
      type: test
      suite: user
    source: file://user_test.lua
    method: main
    imports:
      test: wippy.test:test
```

## Terminal-Host

`wippy/test` hängt von `wippy/terminal` ab. Dieses Modul stellt den automatisch
startenden Host `wippy.terminal:host` bereit, den der CLI-Runner verwendet. Anwendungen
müssen nicht eigens einen Prozess- oder Terminal-Host deklarieren, nur um `wippy test`
auszuführen.

## Siehe auch

- [Framework-Übersicht](./overview.md) — Framework-Module installieren und importieren
- [CLI-Referenz](../guides/cli.md) — Testbefehl und Optionen
- [Funktionen](../concepts/functions.md) — Funktionseinträge und Aufrufe
