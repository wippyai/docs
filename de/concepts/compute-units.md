---
title: "Compute Units"
description: "Vergleichen Sie Wippy-Funktionen, -Prozesse und -Workflows nach Lebensdauer, Zustand, Kommunikation und Fehlerbehandlung."
---

# Compute Units

Wippy bietet drei Möglichkeiten, Code auszuführen: Funktionen, Prozesse und Workflows. Sie nutzen dieselbe zugrunde liegende Infrastruktur, unterscheiden sich jedoch darin, wie lange sie leben, wo ihr Zustand liegt und was bei Fehlern geschieht.

## Funktionen

Funktionen werden bei einem Aufruf ausgeführt und geben ein Ergebnis zurück. Behandeln Sie jeden Aufruf als zustandslos:
Dauerhafter oder gemeinsam genutzter Zustand gehört in eine Datenbank oder einen Store. Funktionspools können
Lua-Zustände wiederverwenden; Modulglobale und Closure-Upvalues sind daher workerlokal und
kein zuverlässiger Speicher über mehrere Aufrufe hinweg.

```lua
local funcs = require("funcs")

local result, err = funcs.call("app.math:add", 2, 3)
if err then
    return nil, err
end
```

Funktionen werden im Kontext des Aufrufers ausgeführt. Wenn der Aufrufer abgebrochen oder beendet wird, werden auch seine laufenden Funktionsaufrufe abgebrochen.

<tip>
Verwenden Sie Funktionen für HTTP-Handler, Datentransformationen und alles, was schnell abgeschlossen werden und ein Ergebnis zurückgeben soll.
</tip>

## Prozesse

Prozesse sind Aktoren. Sie behalten Zustand über mehrere Nachrichten hinweg, laufen unabhängig von der Stelle, die sie gestartet hat, und kommunizieren durch Nachrichtenübermittlung.

```lua
local pid, err = process.spawn("app.workers:handler", "app:processes")
if err then return nil, err end

local ok, send_err = process.send(pid, "job", {task = "process_data"})
if send_err then return nil, send_err end
return ok
```

Nach dem Start läuft ein Prozess unabhängig von dem Code, der ihn erzeugt hat. Prozesse können einander überwachen oder verknüpfen und an Supervision-Trees teilnehmen, die fehlgeschlagene Kinder neu starten.

Der Scheduler multiplext Tausende Prozesse über einen Worker-Pool. Jeder Prozess gibt die Ausführung beim Warten auf E/A frei, damit andere laufen können.

<tip>
Verwenden Sie Prozesse für Hintergrundaufgaben, Service-Daemons und alles, was seinen Erzeuger überleben oder Zustand über mehrere Nachrichten hinweg behalten muss.
</tip>

## Workflows

Workflows sind für dauerhafte Abläufe gedacht, die sich von Unterbrechungen erholen müssen. Ein
Workflow-Provider wie Temporal zeichnet die Ausführungshistorie auf und spielt sie erneut ab, um
Zustand nach Abstürzen, Neustarts oder Infrastrukturänderungen wiederherzustellen.

```lua
-- The provider records this workflow so a worker restart can replay it.
local pid, err = process.spawn("app.orders:process", "app:temporal_worker", order_id)
if err then return nil, err end
return pid
```

Dauerhaftigkeit erhöht die Latenz, weil Workflow-Operationen aufgezeichnet werden. Verwenden Sie Workflows, wenn Wiederherstellung wichtiger ist als die geringere Latenz von Funktionen oder Prozessen, etwa für mehrstufige Geschäftsabläufe und lang laufende Orchestrierung.

<note>
Wippy zeichnet unterstützte Workflow-Operationen so auf, dass sie beim Replay dieselben Ergebnisse liefern. Workflow-Code verwendet dieselbe Lua-Syntax wie andere Compute Units.
</note>

## Vergleich

| | Funktionen | Prozesse | Workflows |
|---|---|---|---|
| **Zustand** | Aufruflokal; nicht von Worker-Wiederverwendung abhängig machen | Im Arbeitsspeicher | Aus persistierter Historie rekonstruiert |
| **Lebensdauer** | Einzelner Aufruf | Bis zum Beenden oder Absturz | Über Neustarts hinweg |
| **Kommunikation** | Rückgabewert + Nachrichten | Nachrichtenübermittlung | Activity-Aufrufe + Nachrichten |
| **Fehlerbehandlung** | Durch den Aufrufer | Supervision-Trees | Wiederherstellung durch Provider; Retries gemäß Richtlinie |
| **Latenz** | Niedrigste | Niedrig | Höher |

## Gleicher Code, anderes Verhalten

Viele Module passen sich automatisch an ihren Kontext an. Beispielsweise gibt `time.sleep()`
sowohl in Funktionen als auch in Prozessen die Ausführung frei, sodass andere Arbeit laufen kann. In einem Workflow
zeichnet der Provider zusätzlich den Timer auf, damit das Replay keinen zweiten Timer startet.
