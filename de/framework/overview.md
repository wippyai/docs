---
title: "Framework"
description: "Offizielle Wippy-Framework-Module aus dem Hub installieren, deklarieren und importieren."
---

# Framework

Offizielle Framework-Module werden über den Wippy Hub unter der Organisation `wippy` veröffentlicht.

Diese Seite ist eine Referenz zur Modulverwaltung in einem bestehenden Wippy-Projekt.
Die Befehle können im Projektstamm ausgeführt werden; die YAML- und Importblöcke sind
unabhängige Referenz-Snippets und keine vollständige Anwendung.

## Framework-Module hinzufügen

```bash
wippy add wippy/test
wippy install
```

Dadurch wird das Modul zur Lock-Datei hinzugefügt und nach `.wippy/vendor/` heruntergeladen.

## Abhängigkeiten im Quellcode deklarieren

Framework-Module können auch als Abhängigkeiten in `_index.yaml` deklariert werden:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "*"
```

Lösen Sie anschließend die Abhängigkeiten auf und installieren Sie sie:

```bash
wippy update
```

## Framework-Bibliotheken importieren

Importieren Sie installierte Framework-Bibliotheken in die jeweiligen Einträge:

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

Der Import ordnet `wippy.test:test` — den Eintrag `test` aus dem Namespace
`wippy.test` — dem lokalen Namen `test` zu. In Lua wird er anschließend mit
`require("test")` geladen.

## Verfügbare Module

| Modul | Beschreibung |
|--------|-------------|
| `wippy/llm` | Einheitliche LLM-Schnittstelle für Generierung, Streaming, Tool-Aufrufe und strukturierte Ausgabe |
| `wippy/agent` | Agenten-Framework mit Tools, Delegaten, Traits und Speicher |
| `wippy/embeddings` | Speicherung von Vektor-Embeddings und Ähnlichkeitssuche |
| `wippy/test` | BDD-Testframework mit Assertions und Mocking |
| `wippy/dataflow` | Workflow-Orchestrierung mit DAG-basierter Knotenausführung |
| `wippy/relay` | WebSocket-Relay mit benutzerspezifischen Hubs und Plugin-Routing |
| `wippy/views` | Virtuelles Seiten- und Komponentensystem mit Template-Rendering |
| `wippy/facade` | Konfiguration des Frontend-Hosts, Theming und Konfigurationsendpunkt |
| `wippy/terminal` | Komponenten für Terminal-Oberflächen |
| `wippy/migration` | Datenbankschema-Migrationen |
| `wippy/security` | Akteurs-Scopes, Policy-Bundles und Sicherheitshelfer |
| `wippy/usage` | Erfassung von Token-Verbrauch und Kosten für LLM-Aufrufe |

Durchsuchen Sie den Hub nach dem aktuellen Modulkatalog:

```bash
wippy search wippy
```

## Siehe auch

- [Abhängigkeitsverwaltung](../guides/dependency-management.md) — Lock-Dateien und Versionsbeschränkungen
- [Veröffentlichen](../guides/publishing.md) — Ein Modul veröffentlichen
- [CLI-Referenz](../guides/cli.md) — Befehle zur Modulverwaltung
