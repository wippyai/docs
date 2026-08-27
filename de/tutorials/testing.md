---
title: "Testing"
description: "Lua-Tests mit Assertions, Lifecycle-Hooks, Mocking, Filtern und Exit-Codes aus wippy/test schreiben und ausführen."
---

# Testing

Verwenden Sie das Framework `wippy/test`, um Lua-Testfälle mit Assertions,
Lifecycle-Hooks und Mocks zu definieren und anschließend mit `wippy test` auszuführen.

**Klassifizierung:** Ausführbares Tutorial. Es enthält eine vollständige Bibliothek,
einen Testeintrag, die Einrichtung der Abhängigkeiten, die erwartete Runner-Ausgabe
und Prüfungen des Fehlerpfads.

## Was Sie bauen

Eine kleine Bibliothek und eine Test-Suite, die sie abdeckt:

1. Eine `calc`-Bibliothek mit den Funktionen `add` und `div`.
2. Ein Test-Entry, das Fälle beschreibt, Verhalten prüft und einen ausstehenden Fall überspringt.
3. Einen erfolgreichen Testlauf mit `wippy test`.

## Voraussetzungen

- Wippy-Runtime `v0.3.32a`.
- Ein leeres Arbeitsverzeichnis. Erstellen und initialisieren Sie das Projekt und
  installieren Sie anschließend das Test-Framework:

  ```bash
  mkdir testing-demo
  cd testing-demo
  mkdir src
  wippy init
  wippy add wippy/test
  wippy install
  ```

  Das Test-Framework deklariert `wippy/terminal` als Abhängigkeit. Die Installation
  bringt deshalb den Terminal Host mit, den die Live-UI des Runners verwendet.

Das fertige Projekt enthält:

```text
testing-demo/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── calc.lua
    └── calc_test.lua
```

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
# src/_index.yaml
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
wippy test
```

Filtern Sie während der Entwicklung nach einem Teilstring der Eintrags-ID (Namespace und Name):

```bash
wippy test test calc_test
```

Das erste `test` wählt den Test-Runner-Einstiegspunkt des Frameworks aus. Die übrigen
Argumente sind Teilstringfilter für die IDs der Testeinträge.

Erwartete Ausgabe der Suite:

```
    o setup ran <duration>
    o adds numbers <duration>
    o returns error on divide by zero <duration>
    - not implemented yet (skipped)
  o calculator (4) 3/4 1 skipped <duration>

  PASSED
  3 tests  1 skipped  <duration>
```

Der Live-Renderer zeigt jeden Fall vor der Suite-Zusammenfassung; die Laufzeiten unterscheiden sich je nach Ausführung.

`wippy test` endet mit `0`, wenn alle Fälle erfolgreich sind, und mit `1`, wenn
ein Fall fehlschlägt. Dadurch kann CI den Exit-Status des Befehls verwenden.

Um den Fehlerpfad zu prüfen, ändern Sie die erwartete Summe vorübergehend von `5`
auf `6`. Der Runner sollte `FAILED` ausgeben und mit Status 1 enden. Stellen Sie
anschließend `5` wieder her.

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

Rufen Sie diese Funktionen innerhalb eines `describe`-Blocks auf:

- `test.before_all` / `test.after_all` — laufen einmal pro Block.
- `test.before_each` / `test.after_each` — laufen rund um jeden Fall.
- `test.mock("module.field", fn)` — ersetzt eine Funktion für den aktuellen Fall;
  Mocks werden nach jedem Fall automatisch wiederhergestellt. Verwenden Sie
  `test.restore_all_mocks()`, um sie frühzeitig zu löschen.

Verschachtelte `describe`-Blöcke erben die Hooks des übergeordneten Blocks (äußere
`before_*` zuerst, innere `after_*` zuerst).

## Fehlerbehebung

- `No test runner found` bedeutet, dass `wippy/test` nicht in `wippy.lock` enthalten
  ist. Führen Sie `wippy add wippy/test` und danach `wippy install` aus.
- Ein fehlendes Modul `calc` oder `test` bedeutet, dass die Schlüssel unter `imports`
  nicht zu den entsprechenden `require(...)`-Aufrufen passen.
- Eine Testdatei wird nur erkannt, wenn ihr Eintrag `meta.type: test` enthält.
- Laufzeiten und Terminalzeichen unterscheiden sich je nach Terminal. Verwenden Sie
  für die Automatisierung den abschließenden Status und den Prozess-Exit-Code.

## Bereinigung

Entfernen Sie das Verzeichnis `testing-demo`, sobald Sie das temporäre Projekt nicht mehr benötigen.

## Nächste Schritte

- [Hello World](hello-world.md) — Minimales Projektlayout
- [Eintragsarten](../guides/entry-kinds.md) — `function.lua`, `library.lua` und verwandte Einträge
- [Test-Framework](../framework/testing.md) — Referenz für Runner und Event-Protokoll
