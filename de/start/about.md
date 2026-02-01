# Über Wippy

Wippy ist eine Plattform und Laufzeitumgebung für Software, die sich zur Laufzeit ändern muss — Automatisierungssysteme, KI-Agenten, Plugin-Architekturen und ähnliche Anwendungen, bei denen der Kern einmal entwickelt und anschließend wiederholt angepasst wird, ohne neu zu kompilieren oder bereitzustellen.

Das Fundament ist das Actor-Modell. Code läuft in isolierten Prozessen, die über Nachrichten kommunizieren und jeweils ihren eigenen Zustand verwalten. Wenn etwas fehlschlägt, schlägt es isoliert fehl. Supervision-Bäume behandeln die Wiederherstellung automatisch und starten Prozesse neu, wenn sie abstürzen.

```lua
local worker = process.spawn("app.workers:handler", "app:processes")
process.send(worker, "task", {id = 1, data = payload})
process.monitor(worker)
```

Die Konfiguration liegt in einer zentralen Registry, die Änderungen als Ereignisse weitergibt. Sobald Sie eine Konfigurationsdatei aktualisieren, erhalten laufende Prozesse die Änderungen. Sie passen sich ohne Neustart an — neue Verbindungen, geändertes Verhalten, was auch immer erforderlich ist — während das System weiterläuft.

```lua
local db = registry.get("app.db:postgres")
local cache = registry.get("app.cache:redis")
```

Für Vorgänge, die Infrastrukturausfälle überstehen müssen — Zahlungsabläufe, mehrstufige Workflows, langlebige Agentenaufgaben — speichert die Laufzeitumgebung den Zustand automatisch dauerhaft. Fällt ein Server mitten im Vorgang aus? Der Workflow wird auf einer anderen Maschine genau dort fortgesetzt, wo er unterbrochen wurde.

Das gesamte System läuft aus einer einzigen Datei. Keine Container zu orchestrieren, keine Dienste zu koordinieren. Eine Programmdatei, eine Konfiguration, und die Laufzeitumgebung erledigt den Rest.

## Hintergrund

Das Aktorenmodell stammt aus Erlang, wo es seit den 1980er Jahren Telefonvermittlungen betreibt. Die Philosophie „Lass es abstürzen" — Fehler isolieren, schnell neu starten — stammt ebenfalls von dort. Go zeigte, dass Channels und Nachrichtenübermittlung nebenläufigen Code lesbar machen können. Temporal zeigte, dass dauerhafte Workflows nicht bedeuten müssen, gegen das Framework zu kämpfen.

Wir haben Wippy entwickelt, weil KI-Agenten eine Infrastruktur benötigen, die sich zur Laufzeit ändern kann. Neue Werkzeuge, aktualisierte Prompts, verschiedene Modelle — diese können nicht auf einen Bereitstellungszyklus warten. Wenn ein Agent einen neuen Ansatz ausprobieren muss, sollte diese Änderung innerhalb von Sekunden wirksam sein, nicht erst nach einem Release.

Da Agenten als Aktoren mit Registry-Zugriff laufen, können sie diese Änderungen selbst vornehmen — Code generieren, neue Komponenten registrieren, ihre eigenen Workflows anpassen. Mit ausreichenden Berechtigungen kann ein Agent seine Arbeitsweise verbessern, ohne menschliches Eingreifen. Das System kann sich selbst weiterentwickeln.
