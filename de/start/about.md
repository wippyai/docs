# Über Wippy

Wippy ist eine agentische Plattform und Runtime für Software, die sich während der Laufzeit ändern muss — Automatisierungssysteme, KI-Agenten, Plugin-Architekturen und ähnliche Anwendungen, bei denen der Kern einmal entwickelt und dann wiederholt angepasst wird, ohne neu zu bauen oder zu deployen.

Das Fundament ist das Actor-Modell. Code läuft in isolierten Prozessen, die über Nachrichten kommunizieren und jeweils ihren eigenen Zustand verwalten. Wenn etwas fehlschlägt, schlägt es isoliert fehl. Supervision-Bäume behandeln die Wiederherstellung automatisch und starten Prozesse neu, wenn sie abstürzen.

```lua
local worker = process.spawn("app.workers:handler", "app:processes")
process.send(worker, "task", {id = 1, data = payload})
process.monitor(worker)
```

Die Konfiguration befindet sich in einer zentralen Registry, die Änderungen als Events propagiert. Aktualisieren Sie eine Konfigurationsdatei, und laufende Prozesse erhalten die Änderungen. Sie passen sich ohne Neustarts an — neue Verbindungen, aktualisiertes Verhalten, was auch immer Sie benötigen — während das System weiterläuft.

```lua
local db = registry.get("app.db:postgres")
local cache = registry.get("app.cache:redis")
```

Für Operationen, die Infrastrukturausfälle überstehen müssen — Zahlungsabläufe, mehrstufige Workflows, langlebige Agenten-Tasks — persistiert die Runtime den Zustand automatisch. Server stirbt mitten in der Operation? Der Workflow setzt auf einer anderen Maschine fort, genau dort wo er aufgehört hat.

Das gesamte System läuft aus einer einzigen Datei. Keine Container zu orchestrieren, keine Dienste zu koordinieren. Eine Binary, eine Konfiguration, und die Runtime erledigt den Rest.

## Hintergrund

Das Actor-Modell stammt aus Erlang, wo es seit den 1980er Jahren Telekommunikationsvermittlungen betreibt. Die "Let it crash"-Philosophie — Fehler isolieren, schnell neu starten — stammt ebenfalls von dort. Go zeigte, dass Channels und Message-Passing nebenläufigen Code lesbar machen können. Temporal bewies, dass dauerhafte Workflows nicht bedeuten müssen, gegen das Framework zu kämpfen.

Wir haben Wippy gebaut, weil KI-Agenten Infrastruktur brauchen, die sich während der Laufzeit ändern kann. Neue Tools, aktualisierte Prompts, verschiedene Modelle — diese können nicht auf einen Deploy-Zyklus warten. Wenn ein Agent einen neuen Ansatz ausprobieren muss, sollte diese Änderung in Sekunden funktionieren, nicht erst nach einem Release.

Da Agenten als Actors mit Registry-Zugriff laufen, können sie diese Änderungen selbst vornehmen — Code generieren, neue Komponenten registrieren, ihre eigenen Workflows anpassen. Mit ausreichenden Berechtigungen kann ein Agent verbessern, wie er arbeitet, ohne menschliches Eingreifen. Das System kann sich selbst schreiben.
