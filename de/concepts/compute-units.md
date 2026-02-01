# Compute Units

Wippy bietet drei Möglichkeiten, Code auszuführen: Funktionen, Prozesse und Workflows. Sie nutzen die gleiche zugrundeliegende Infrastruktur, unterscheiden sich aber darin, wie lange sie leben, wo ihr Zustand gespeichert wird und was passiert, wenn etwas fehlschlägt.

## Funktionen

Funktionen sind das einfachste Modell. Sie rufen sie auf, sie werden ausgeführt, sie geben ein Ergebnis zurück. Zwischen Aufrufen wird kein Zustand gespeichert.

```lua
local result = funcs.call("app.math:add", 2, 3)
```

Funktionen werden im Kontext des Aufrufers ausgeführt. Wenn der Aufrufer abbricht oder beendet wird, werden alle laufenden Funktionen ebenfalls abgebrochen. Das vereinfacht die Handhabung — Sie müssen sich keine Gedanken über das Aufräumen machen.

<tip>
Verwenden Sie Funktionen für HTTP-Handler, Datentransformationen und alles, was schnell abgeschlossen werden und ein Ergebnis zurückgeben sollte.
</tip>

## Prozesse

Prozesse sind Aktoren. Sie behalten den Zustand über mehrere Nachrichten hinweg, laufen unabhängig von demjenigen, der sie gestartet hat, und kommunizieren über Nachrichtenübermittlung.

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "job", {task = "process_data"})
```

Wenn Sie einen Prozess starten, läuft er weiter, auch nachdem Ihr Code beendet ist. Prozesse können sich gegenseitig überwachen, verknüpfen und Überwachungsbäume bilden, die fehlgeschlagene Kindprozesse automatisch neu starten.

Der Scheduler verteilt Tausende von Prozessen auf einen Worker-Pool. Jeder Prozess unterbricht beim Warten auf E/A, sodass andere laufen können.

<tip>
Verwenden Sie Prozesse für Hintergrundjobs, Dienst-Daemons und alles, was seinen Ersteller überleben oder Zustand über Nachrichten hinweg behalten muss.
</tip>

## Workflows

Workflows sind für Vorgänge gedacht, die unter keinen Umständen fehlschlagen dürfen. Sie speichern ihren Zustand bei einem Workflow-Anbieter (Temporal oder andere) dauerhaft und können nach Abstürzen, Neustarts oder Infrastrukturänderungen genau dort fortfahren, wo sie aufgehört haben.

```lua
-- Dies kann tagelang laufen, Neustarts überleben und niemals Fortschritt verlieren
workflow.execute("app.orders:process", order_id)
```

Der Kompromiss ist die Latenz. Jeder Schritt wird aufgezeichnet, daher sind Workflows langsamer als Funktionen oder Prozesse. Für mehrstufige Geschäftsprozesse oder langlebige Orchestrierungen ist diese Beständigkeit jedoch den Aufwand wert.

<note>
Wippy behandelt Determinismus für Workflows automatisch. Sie müssen keine speziellen Techniken lernen — schreiben Sie normalen Code und die Laufzeitumgebung stellt sicher, dass er sich beim Wiederholen korrekt verhält.
</note>

## Vergleich

| | Funktionen | Prozesse | Workflows |
|---|---|---|---|
| **Zustand** | Keiner | Im Speicher | Dauerhaft gespeichert |
| **Lebensdauer** | Einzelner Aufruf | Bis Exit oder Crash | Überlebt alles |
| **Kommunikation** | Rückgabewert + Nachrichten | Message-Passing | Activity-Aufrufe + Nachrichten |
| **Fehlerbehandlung** | Aufrufer behandelt | Überwachungsbäume | Automatische Wiederholung |
| **Latenz** | Niedrigste | Niedrig | Höher |

## Gleicher Code, unterschiedliches Verhalten

Viele Module passen sich automatisch an ihren Kontext an. Zum Beispiel blockiert `time.sleep()` in einer Funktion den Worker, in einem Prozess unterbricht es, damit andere laufen können, und in einem Workflow zeichnet es einen Timer auf, der bei der Wiederherstellung korrekt wiederholt wird.
