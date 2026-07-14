---
title: Was ist Wippy - Konzepte und Laufzeitüberblick
description: Verstehen Sie, wie Wippy funktioniert, bevor Sie es installieren. Behandelt das Actor-Modell, die Registry, dauerhafte Workflows und warum das System darauf ausgelegt ist, sich zur Laufzeit zu ändern.
---

# Über Wippy

Wippy ist eine quelloffene Laufzeitumgebung nach dem Actor-Modell für Software, die sich zur Laufzeit ändern muss: Automatisierungssysteme, KI-Agenten, Plugin-Architekturen und ähnliche Anwendungen, bei denen der Kern einmal entwickelt und anschließend wiederholt angepasst wird, ohne neu zu kompilieren oder bereitzustellen.

Einen vollständigen Produktüberblick, einschließlich was Wippy ersetzt, was es nicht ist und wer dahintersteht, finden Sie auf der [About-Seite](https://wippy.ai/about).

Das Fundament ist das Actor-Modell. Code läuft in isolierten Prozessen, die über Nachrichten kommunizieren und jeweils ihren eigenen Zustand verwalten. Wenn etwas fehlschlägt, schlägt es isoliert fehl. Supervision-Bäume behandeln die Wiederherstellung automatisch und starten Prozesse neu, wenn sie abstürzen.

```lua
local worker = process.spawn("app.workers:handler", "app:processes")
process.send(worker, "task", {id = 1, data = payload})
process.monitor(worker)
```

Die Konfiguration liegt in einer zentralen Registry, die Änderungen als Ereignisse weitergibt. Sobald Sie eine Konfigurationsdatei aktualisieren, erhalten laufende Prozesse die Änderungen. Sie passen sich ohne Neustart an. Neue Verbindungen, geändertes Verhalten, was auch immer erforderlich ist, während das System weiterläuft.

```lua
local db = registry.get("app.db:postgres")
local cache = registry.get("app.cache:redis")
```

Für Vorgänge, die Infrastrukturausfälle überstehen müssen, speichert die Laufzeitumgebung den Zustand automatisch dauerhaft: Zahlungsabläufe, mehrstufige Workflows und langlebige Agentenaufgaben. Fällt ein Server mitten im Vorgang aus? Der Workflow wird auf einer anderen Maschine genau dort fortgesetzt, wo er unterbrochen wurde.

Das gesamte System läuft aus einer einzigen Datei. Keine Container zu orchestrieren, keine Dienste zu koordinieren. Eine Programmdatei, eine Konfiguration, und die Laufzeitumgebung erledigt den Rest.

Die ganze Geschichte, warum Wippy entwickelt wurde, finden Sie unter [Why We Built Wippy](https://wippy.ai/about#why-we-built-wippy).
