---
title: "Linter"
description: "Verwenden Sie den integrierten Lua-Linter für Typprüfung, statische Analyse, Filterung, Caching und CI-Ausgabe."
---

# Linter

Führen Sie `wippy lint` aus, um Lua-Einträge typzuprüfen und statisch zu analysieren.

## Verwendung

```bash
wippy lint                        # Check all Lua entries
wippy lint --level hint           # Show all diagnostics including hints
wippy lint --json                 # Output in JSON format
wippy lint --ns app               # Check only the app namespace
wippy lint --summary              # Group results by error code
```

## Was gepruft wird

Der Linter validiert alle Lua-Eintragsarten:

- `function.lua` - Funktionen
- `library.lua` - Bibliotheken
- `process.lua` - Prozesse
- `workflow.lua` - Workflows

Ihre vorkompilierten `.bc`-Varianten (`function.lua.bc`, `library.lua.bc`, `process.lua.bc`, `workflow.lua.bc`) werden ebenfalls gelintet.

Jeder Eintrag wird geparst, typgepruft und auf Korrektheitsprobleme analysiert.

## Schweregrade

Diagnosen haben drei Schweregrade:

| Stufe | Beschreibung |
|-------|--------------|
| `error` | Typfehler und Korrektheitsprobleme, die behoben werden müssen |
| `warning` | Wahrscheinliche Fehler oder problematische Muster |
| `hint` | Stilvorschlage und informative Hinweise |

Steuern Sie die angezeigten Stufen mit `--level`:

```bash
wippy lint --level error          # Errors only
wippy lint --level warning        # Warnings and errors (default)
wippy lint --level hint           # Everything
```

## Fehlercodes

### Parse-Fehler

| Code | Beschreibung |
|------|--------------|
| `P0001` | Lua-Syntaxfehler - Quellcode kann nicht geparst werden |

### Typprufungsfehler (E-Serie)

Typprüfungsfehler (`E0001`+) melden Probleme, die vom Typsystem erkannt werden: Typkonflikte, undefinierte Variablen, ungültige Operationen und ähnliche Korrektheitsprobleme. Diese werden immer als Fehler gemeldet.

```lua
local x: number = "hello"         -- E: string not assignable to number

local function add(a: number, b: number): number
    return a + b
end

add("one", "two")                  -- E: string not assignable to number
```

### Nicht deklarierte Requires

Ein String-Literal-`require("name")`, dessen Modul weder in den `imports`/`modules`-Deklarationen des Eintrags steht noch ein ambienter Builtin ist, schlägt fehl mit:

```
require("name") is not declared in _index.yaml imports or modules
```

Diese Prufung lauft immer (sie ist nicht hinter `--rules` gekapselt) und wird als Fehler gemeldet. Deklarieren Sie das Modul, um sie zu erfullen:

```yaml
imports:
  json: wippy.stdlib:json    # alias -> registry id
modules:
  - funcs                    # bare module name
```

Dynamische Requires (`require(variable)`) werden nicht untersucht. Die ambiente Menge — Module, die ohne Deklaration verfügbar sind, etwa `process` in ausführbaren Kinds — wird zwischen Linter und Runtime geteilt, sodass Lint-Zeit- und Laufzeitauflösung nicht auseinanderdriften können.

### Lint-Regel-Warnungen (W-Serie)

Lint-Regeln bieten Stil- und Qualitatsprufungen. Aktivieren Sie sie mit `--rules`:

```bash
wippy lint --rules
```

| Code | Regel | Beschreibung |
|------|-------|-------------|
| `W0001` | no-empty-blocks | Leere Blockanweisungen |
| `W0002` | no-global-assign | Zuweisung an globale Variablen |
| `W0003` | no-self-compare | Vergleich eines Wertes mit sich selbst |
| `W0004` | no-unused-vars | Unbenutzte lokale Variablen |
| `W0005` | no-unused-params | Unbenutzte Funktionsparameter |
| `W0006` | no-unused-imports | Unbenutzte Import-Anweisungen |
| `W0007` | no-shadowed-vars | Variable überschattet äußeren Gültigkeitsbereich |

Ohne `--rules` wird nur die Typprufung (P- und E-Codes) durchgefuhrt.

## Filterung

### Nach Namespace

Prüfen Sie bestimmte Namespaces mit `--ns`:

```bash
wippy lint --ns app               # Exact namespace match
wippy lint --ns "app.*"           # All under app
wippy lint --ns app --ns lib      # Multiple namespaces
```

Abhängigkeiten der ausgewählten Einträge werden für die Typprüfung geladen, aber ihre Diagnosen werden nicht angezeigt.

### Nach Fehlercode

Filtern Sie Diagnosen nach Code:

```bash
wippy lint --code E0001
wippy lint --code E0001 --code E0004
```

### Nach Anzahl

Begrenzen Sie die Anzahl der angezeigten Diagnosen:

```bash
wippy lint --limit 10             # Show first 10 issues
```

## Ausgabeformate

### Tabellenformat (Standard)

Jede Diagnose wird mit Quellkontext, Dateispeicherort und Fehlermeldung angezeigt. Ergebnisse sind nach Eintrag, Schweregrad und Zeilennummer sortiert.

Eine Zusammenfassungszeile zeigt die Gesamtzahlen:

```
Checked 42 entries: 5 errors, 12 warnings
```

### Zusammenfassungsformat

Diagnosen nach Namespace und Fehlercode gruppieren:

```bash
wippy lint --summary
```

```
By namespace:

  app                              15 issues (5 errors, 10 warnings)
  lib                               2 issues (2 warnings)

By error code:

  E0001      [error  ]    5 occurrences
  E0004      [error  ]    3 occurrences

Checked 42 entries: 5 errors, 12 warnings
```

### JSON-Format

Maschinenlesbare Ausgabe für die CI-Verarbeitung:

```bash
wippy lint --json
```

```json
{
  "diagnostics": [
    {
      "entry_id": "app:handler",
      "code": "E0001",
      "severity": "error",
      "message": "string not assignable to number",
      "line": 10,
      "column": 5
    }
  ],
  "total_entries": 42,
  "error_count": 5,
  "warning_count": 12,
  "hint_count": 0
}
```

## Caching

Der Linter speichert Ergebnisse zwischen Aufrufen. Cache-Schlüssel umfassen Quellcode-Hash, Methodenname, Abhängigkeiten und Typsystemkonfiguration.

Leeren Sie den Cache, wenn Ergebnisse veraltet erscheinen:

```bash
wippy lint --cache-reset
```

## CI-Integration

Im Tabellen- und Zusammenfassungsmodus endet der Befehl mit einem von null verschiedenen Exit-Code, wenn das gefilterte Ergebnis Fehler enthält. Warnungen und Hinweise beeinflussen den Exit-Code nicht, auch wenn `--level warning` oder `--level hint` sie anzeigt.

Der JSON-Modus verhält sich anders: Nach erfolgreicher Kodierung des Ergebnisses endet `wippy lint --json` mit Code 0, selbst wenn `error_count` nicht null ist. Ein CI-Job mit JSON-Ausgabe muss `error_count` selbst auswerten. Verwenden Sie einen Aufruf ohne JSON, wenn der Exit-Status als Gate dienen soll:

```bash
wippy lint --level error
```

Sie können einen Bericht getrennt erzeugen, ohne seinen Exit-Status als Linter-Ergebnis zu behandeln:

```bash
wippy lint --json --level error > lint-results.json
```

Beispiel für einen GitHub-Actions-Schritt:

```yaml
- name: Lint
  run: wippy lint --level warning
```

## Flags-Referenz

| Flag | Kurz | Standard | Beschreibung |
|------|------|----------|--------------|
| `--level` | | warning | Minimaler Schweregrad (error, warning, hint) |
| `--json` | | false | Ausgabe im JSON-Format |
| `--ns` | | | Nach Namespace-Mustern filtern |
| `--code` | | | Nach Fehlercodes filtern |
| `--limit` | | 0 | Maximale Anzahl angezeigter Diagnosen (0 = unbegrenzt) |
| `--summary` | | false | Nach Fehlercode gruppieren |
| `--no-color` | | false | Farbige Ausgabe deaktivieren |
| `--rules` | | false | Lint-Regeln aktivieren (W-Serie Stil-/Qualitatsprufungen) |
| `--cache-reset` | | false | Cache vor dem Linting leeren |
| `--profile` | | | Workspace-Profil aus der zusammengeführten Runtime-Konfiguration anwenden; wiederholen, um Profile der Reihe nach anzuwenden |
| `--set` | | | Zusammengeführten Konfigurationswert als `section.path=value` überschreiben; für mehrere Überschreibungen wiederholen |
| `--lock-file` | `-l` | wippy.lock | Pfad zur Lock-Datei |

## Siehe auch

- [CLI](./cli.md) — Vollständige CLI-Referenz
- [Typen](../lua/types.md) — Dokumentation des Typsystems
- [LSP](./lsp.md) — Editorintegration mit Live-Diagnosen
