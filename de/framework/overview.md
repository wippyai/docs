---
title: "Framework"
description: "Wippy stellt offizielle Framework-Module über den Hub bereit. Diese Module werden unter der Organisation wippy gepflegt und können jedem Projekt hinzugefügt werden."
---

# Framework

Wippy stellt offizielle Framework-Module über den Hub bereit. Diese Module werden unter der Organisation `wippy` gepflegt und können jedem Projekt hinzugefügt werden.

## Framework-Module hinzufügen

```bash
wippy add wippy/test
wippy install
```

Das trägt das Modul in deine Lock-Datei ein und lädt es nach `.wippy/vendor/` herunter.

## Abhängigkeiten im Quellcode deklarieren

Framework-Module lassen sich auch als Abhängigkeiten in deiner `_index.yaml` deklarieren:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "^0.3.0"
```

Anschließend auflösen und installieren:

```bash
wippy update
```

## Framework-Bibliotheken importieren

Nach der Installation importierst du Framework-Bibliotheken in deine Einträge:

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

Der Import bildet `wippy.test:test` (den Eintrag `test` aus dem Namespace `wippy.test`) auf den lokalen Namen `test` ab, den du dann in Lua per `require("test")` einbindest.

## Verfügbare Module

| Modul | Beschreibung |
|--------|-------------|
| `wippy/llm` | Einheitliche LLM-Schnittstelle mit Generierung, Streaming, Tool-Calling und strukturierter Ausgabe |
| `wippy/agent` | Agent-Framework mit Tools, Delegates, Traits und Memory |
| `wippy/embeddings` | Speicherung von Vektor-Embeddings und Ähnlichkeitssuche |
| `wippy/test` | Test-Framework im BDD-Stil mit Assertions und Mocking |
| `wippy/dataflow` | Workflow-Orchestrierung mit DAG-basierter Node-Ausführung |
| `wippy/relay` | WebSocket-Relay mit Hubs pro Benutzer und Plugin-Routing |
| `wippy/views` | Virtuelles Seiten- und Komponentensystem mit Template-Rendering |
| `wippy/facade` | Frontend-Host-Konfiguration, Theming und Config-Endpoint |
| `wippy/terminal` | Terminal-UI-Komponenten |
| `wippy/migration` | Datenbank-Schema-Migrationen |
| `wippy/security` | Akteur-Scopes, Policy-Bundles und Sicherheits-Helfer |
| `wippy/usage` | Token- und Kostenabrechnung für LLM-Aufrufe |

Es sind weitere Module verfügbar, und es werden regelmäßig neue veröffentlicht. Durchsuche den Hub:

```bash
wippy search wippy
```

## Siehe auch

- [Dependency Management](guides/dependency-management.md) - Lock-Datei und Versionsbeschränkungen
- [Publishing](guides/publishing.md) - Eigene Module veröffentlichen
- [CLI-Referenz](guides/cli.md) - CLI-Befehle
