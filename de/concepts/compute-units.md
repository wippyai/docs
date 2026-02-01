# Compute Units

Wippy bietet drei Möglichkeiten, Code auszuführen: Funktionen, Prozesse und Workflows. Sie teilen sich die gleiche zugrundeliegende Maschinerie, unterscheiden sich aber darin, wie lange sie leben, wohin ihr Zustand geht und was passiert, wenn etwas fehlschlägt.

## Funktionen

Funktionen sind das einfachste Modell. Sie rufen sie auf, sie führen aus, sie geben ein Ergebnis zurück. Kein Zustand persistiert zwischen Aufrufen.

```lua
local result = funcs.call("app.math:add", 2, 3)
```

Funktionen werden im Kontext des Aufrufers ausgeführt. Wenn der Aufrufer abbricht oder beendet wird, werden alle laufenden Funktionen ebenfalls abgebrochen. Das hält die Dinge einfach — Sie müssen nicht über Aufräumen nachdenken.

<tip>
Verwenden Sie Funktionen für HTTP-Handler, Datentransformationen und alles, was schnell abgeschlossen werden und ein Ergebnis zurückgeben sollte.
</tip>

## Prozesse

Prozesse sind Actors. Sie behalten Zustand über mehrere Nachrichten hinweg, laufen unabhängig von demjenigen, der sie gestartet hat, und kommunizieren über Message-Passing.

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "job", {task = "process_data"})
```

Wenn Sie einen Prozess starten, läuft er weiter, auch nachdem Ihr Code beendet ist. Prozesse können sich gegenseitig monitoren, verlinken und Supervision-Bäume bilden, die fehlgeschlagene Kinder automatisch neu starten.

Der Scheduler multiplext Tausende von Prozessen über einen Worker-Pool. Jeder Prozess yieldet beim Warten auf I/O, sodass andere laufen können.

<tip>
Verwenden Sie Prozesse für Hintergrundjobs, Dienst-Daemons und alles, was seinen Ersteller überleben oder Zustand über Nachrichten hinweg behalten muss.
</tip>

## Workflows

Workflows sind für Operationen gedacht, die absolut nicht fehlschlagen dürfen. Sie persistieren ihren Zustand zu einem Workflow-Provider (Temporal oder andere) und können nach Abstürzen, Neustarts oder Infrastrukturänderungen genau dort fortfahren, wo sie aufgehört haben.

```lua
-- Dies kann tagelang laufen, Neustarts überleben und niemals Fortschritt verlieren
workflow.execute("app.orders:process", order_id)
```

Der Kompromiss ist Latenz. Jeder Schritt wird aufgezeichnet, daher sind Workflows langsamer als Funktionen oder Prozesse. Aber für mehrstufige Geschäftsprozesse oder langlebige Orchestrierungen ist diese Dauerhaftigkeit es wert.

<note>
Wippy behandelt Determinismus für Workflows automatisch. Sie müssen keine speziellen Techniken lernen — schreiben Sie normalen Code und die Runtime stellt sicher, dass er sich während des Replays korrekt verhält.
</note>

## Vergleich

| | Funktionen | Prozesse | Workflows |
|---|---|---|---|
| **Zustand** | Keiner | Im Speicher | Persistiert |
| **Lebensdauer** | Einzelner Aufruf | Bis Exit oder Crash | Überlebt alles |
| **Kommunikation** | Rückgabewert + Nachrichten | Message-Passing | Activity-Aufrufe + Nachrichten |
| **Fehlerbehandlung** | Aufrufer behandelt | Supervision-Bäume | Automatischer Retry |
| **Latenz** | Niedrigste | Niedrig | Höher |

## Gleicher Code, unterschiedliches Verhalten

Viele Module passen sich automatisch an ihren Kontext an. Zum Beispiel blockiert `time.sleep()` in einer Funktion den Worker, in einem Prozess yieldet es, damit andere laufen können, und in einem Workflow zeichnet es einen Timer auf, der bei der Wiederherstellung korrekt replayed wird.
