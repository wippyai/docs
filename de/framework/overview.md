# Framework

Wippy stellt offizielle Framework-Module ueber den Hub bereit. Diese Module werden unter der Organisation `wippy` gepflegt und koennen jedem Projekt hinzugefuegt werden.

## Framework-Module hinzufuegen

```bash
wippy add wippy/test
wippy install
```

Dies fuegt das Modul Ihrer Lock-Datei hinzu und laedt es nach `.wippy/vendor/` herunter.

## Abhaengigkeiten im Quellcode deklarieren

Framework-Module koennen auch als Abhaengigkeiten in Ihrer `_index.yaml` deklariert werden:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "^0.3.0"
```

Dann aufloesen und installieren:

```bash
wippy update
```

## Framework-Bibliotheken importieren

Nach der Installation importieren Sie Framework-Bibliotheken in Ihre Eintraege:

```yaml
entries:
  - name: my_test
    kind: function.lua
    meta:
      type: test
      suite: my-suite
    source: file://my_test.lua
    method: run
    imports:
      test: wippy.test:test
```

Der Import bildet `wippy.test:test` (den `test`-Eintrag aus dem Namespace `wippy.test`) auf den lokalen Namen `test` ab, den Sie dann mit `require("test")` in Lua verwenden.

## Verfuegbare Module

| Module | Beschreibung |
|--------|-------------|
| `wippy/test` | BDD-Testframework mit Assertions und Mocking |
| `wippy/terminal` | Terminal-UI-Komponenten |

Weitere Module sind verfuegbar und werden regelmaessig veroeffentlicht. Durchsuchen Sie den Hub:

```bash
wippy search wippy
```

## Siehe auch

- [Abhaengigkeitsverwaltung](guides/dependency-management.md) - Lock-Datei und Versionsbeschraenkungen
- [Veroeffentlichung](guides/publishing.md) - Eigene Module veroeffentlichen
- [CLI-Referenz](guides/cli.md) - CLI-Befehle
