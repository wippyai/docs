# Testing

Schreibe und führe Tests für deinen Lua-Code mit dem Framework `wippy/test` aus — ein
Runner im BDD-Stil mit Assertions, Lifecycle-Hooks und Mocking, ausgeführt über den
Befehl `wippy run test`.

## Was du bauen wirst

Eine kleine Bibliothek und eine Test-Suite, die sie abdeckt:

1. Eine `calc`-Bibliothek mit den Funktionen `add` und `div`.
2. Ein Test-Entry, das Fälle beschreibt, Verhalten prüft und einen ausstehenden Fall überspringt.
3. Ein grüner Testlauf via `wippy run test`.

## Voraussetzungen

- Ein Wippy-Projekt (klone [app-template](https://github.com/wippyai/app-template) oder
  führe `wippy init` in einem leeren Verzeichnis aus).
- Das Test-Framework und ein Terminal-Host sind installiert:

  ```bash
  wippy add wippy/test
  wippy add wippy/terminal
  wippy install
  ```

  Der Runner rendert eine Live-Terminal-UI, daher ist `wippy/terminal` neben
  `wippy/test` erforderlich.

## Der zu testende Code

```lua
-- src/calc.lua
local function add(a, b)
    return a + b
end

local function div(a, b)
    if b == 0 then
        return nil, "division by zero"
    end
    return a / b
end

return { add = add, div = div }
```

## Der Test

Ein Test ist ein gewöhnliches `function.lua`-Entry, das mit `meta.type: test` getaggt ist.
Seine Methode gibt den von `test.run_cases(...)` erzeugten Wert zurück, den der Runner
aufruft:

```lua
-- src/calc_test.lua
local test = require("test")
local calc = require("calc")

local function define_tests()
    test.describe("calculator", function()
        local started = false

        test.before_all(function()
            started = true
        end)

        test.it("setup ran", function()
            test.is_true(started)
        end)

        test.it("adds numbers", function()
            test.eq(calc.add(2, 3), 5)
        end)

        test.it("returns error on divide by zero", function()
            local result, err = calc.div(1, 0)
            test.has_error(result, err)
            test.contains(err, "division by zero")
        end)

        test.it_skip("not implemented yet", function()
            test.fail("should not run")
        end)
    end)
end

return { run = test.run_cases(define_tests) }
```

Registriere beide Einträge. Die Erkennung knüpft an `meta.type: test` an; `meta.suite`
gruppiert die Ergebnisse in der Ausgabe:

```yaml
version: "1.0"
namespace: app

entries:
  - name: calc
    kind: library.lua
    source: file://calc.lua

  - name: calc_test
    kind: function.lua
    meta:
      name: Calculator Test
      type: test
      suite: calculator
    source: file://calc_test.lua
    method: run
    imports:
      test: wippy.test:test
      calc: app:calc
```

Die `imports`-Map steuert, worauf `require(...)` innerhalb des Tests aufgelöst wird:
`test` bindet das Framework, `calc` bindet die zu testende Einheit.

## Ausführen

```bash
wippy run test
```

Filtere während des Iterierens auf eine einzelne Suite (passt zur Entry-ID oder zum
Suite-Namen):

```bash
wippy run test calculator
```

Ausgabe für die obige Suite:

```
  calculator (4)  3/4  1 skipped  1ms
    o setup ran
    o adds numbers
    o returns error on divide by zero
    - not implemented yet (skipped)

  PASSED   3 tests   1 skipped   1ms
```

`wippy run test` beendet sich mit `0`, wenn jeder Fall besteht, und mit `1` bei
jedem Fehlschlag, sodass es sich direkt in CI einfügt.

## Assertions

Jede Assertion wirft bei einem Fehlschlag; die Typ-Guards geben zudem den validierten Wert zurück.

| Assertion | Prüft |
|---|---|
| `test.eq(a, b)` / `test.neq(a, b)` | Gleichheit / Ungleichheit |
| `test.ok(v)` / `test.fail(msg)` | Truthy / Fehlschlag erzwingen |
| `test.is_nil(v)` / `test.not_nil(v)` | Nil / nicht-nil |
| `test.is_true(v)` / `test.is_false(v)` | Boolescher Wert |
| `test.is_string/number/table/function/boolean(v)` | Typ-Guards (geben `v` zurück) |
| `test.contains(str, sub)` / `test.matches(str, pattern)` | Teilstring / Lua-Pattern |
| `test.has_key(tbl, key)` / `test.len(v, n)` | Map-Schlüssel / Länge |
| `test.gt/gte/lt/lte(a, b)` | Numerischer Vergleich |
| `test.throws(fn)` / `test.has_error(val, err)` / `test.no_error(val, err)` | Fehlerbehandlung |

Alle nehmen ein optionales abschließendes Nachrichtenargument entgegen.

## Lifecycle und Mocking

Rufe diese innerhalb eines `describe`-Blocks auf:

- `test.before_all` / `test.after_all` — laufen einmal pro Block.
- `test.before_each` / `test.after_each` — laufen rund um jeden Fall.
- `test.mock("module.field", fn)` — ersetzt eine Funktion für den aktuellen Fall;
  Mocks werden nach jedem Fall automatisch wiederhergestellt. Verwende
  `test.restore_all_mocks()`, um sie frühzeitig zu löschen.

Verschachtelte `describe`-Blöcke erben die Hooks des übergeordneten Blocks (äußere
`before_*` zuerst, innere `after_*` zuerst).

## Nächste Schritte

- [Hello World](tutorials/hello-world.md) — das minimale Projekt-Layout
- [Entry-Arten](guides/entry-kinds.md) — `function.lua`, `library.lua` und Verwandte
- [Test-Framework](framework/testing.md) — vollständige Referenz für den Runner und das Event-Protokoll
