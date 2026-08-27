---
title: "Funktionen"
description: "Wie Funktionen definiert und aufgerufen, Kontexte weitergegeben, Pools konfiguriert und Interceptors angewendet werden."
---

# Funktionen

Funktionen sind Entrypoints mit Aufruf und Rückgabe. Eine Funktion erbt den
Kontext ihres Aufrufers und wird abgebrochen, wenn der Aufrufer abgebrochen wird. Pools können Lua-Zustände wiederverwenden;
Modulglobale und Closure-Upvalues können daher auf einem Worker erhalten bleiben, werden jedoch nicht
zuverlässig zwischen Aufrufen geteilt. Speichern Sie dauerhaften oder gemeinsamen Zustand außerhalb der
Funktion. Verwenden Sie Funktionen für HTTP-Handler, API-Endpoints und andere Operationen,
die innerhalb eines Anfragelebenszyklus abgeschlossen werden.

## Funktionen aufrufen

Rufen Sie Funktionen synchron mit `funcs.call()` auf:

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
if err then return nil, err end
return result
```

Für eine nicht blockierende Ausführung verwenden Sie `funcs.async()`:

```lua
local future, err = funcs.async("app.process:analyze", data)
if err then
    return nil, err
end

local ch = future:response()
local payload, open = ch:receive()
if not open then
    return nil, "future response channel closed"
end

local result, err = payload:data()
if err then
    return nil, err
end
```

Aufruf und Executor-Optionen beschreibt das [funcs-Modul](../lua/core/funcs.md).

## Kontextweitergabe

Jeder Aufruf erzeugt einen Frame mit eigenem Kontext-Scope. Kindfunktionen erben den Elternkontext ohne explizite Übergabe:

```lua
local ctx = require("ctx")

local trace_id = ctx.get("trace_id")
local user_id = ctx.get("user_id")
```

Fügen Sie beim Aufruf Kontext hinzu:

```lua
local funcs = require("funcs")

local exec, err = funcs.new():with_context({trace_id = "abc-123"})
if err then return nil, err end

local result, err = exec:call("app.api:process", data)
if err then return nil, err end
return result
```

Sicherheitskontext wird auf dieselbe Weise weitergegeben. Aufgerufene Funktionen sehen den Akteur des Aufrufers und können Berechtigungen prüfen. Zugriffskontroll-APIs beschreibt das [security-Modul](../lua/security/security.md).

## Registry-Definition

Auf Registry-Ebene sieht ein Funktionseintrag so aus:

```yaml
- name: get_user
  kind: function.lua
  source: file://handlers/user.lua
  method: get
  pool:
    type: lazy
    max_size: 16
```

Andere Runtime-Komponenten wie HTTP-Handler, Queue-Consumer und geplante Aufgaben können Funktionen aufrufen. Die Aufrufe unterliegen Berechtigungsprüfungen anhand des Sicherheitskontexts des Aufrufers.

## Pools

Funktionen laufen in Pools, die ihre Ausführung verwalten. Der Pooltyp bestimmt das Skalierungsverhalten.

**Inline** läuft ohne Worker-Pool in der Goroutine des Aufrufers. Dieser Typ wird für eingebettete Kontexte verwendet.

**Static** hält eine feste Anzahl Worker bereit. Sind alle Worker belegt, werden Anfragen eingereiht; die Worker-Nebenläufigkeit bleibt dadurch fest.

```yaml
pool:
  type: static
  size: 8
  buffer: 512
```

**Lazy** startet ohne Worker und erzeugt sie bei Bedarf. Inaktive Worker werden nach einem Timeout entfernt.

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive** passt die Worker-Anzahl anhand des gemessenen Durchsatzes und der aktuellen Last an.

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
Bevorzugen Sie einen expliziten Pool-<code>type</code>. Setzen Sie bei <code>type: static</code> den Wert <code>size</code>. Ist zusätzlich <code>workers</code> vorhanden, liefert er die Worker-Anzahl und erfordert weiterhin ein positives <code>size</code>. Im älteren impliziten Modus wählen <code>workers &gt; 0</code> zusammen mit <code>size &gt; 0</code> einen statischen Pool, <code>max_size &gt; 0</code> ohne Worker einen Lazy-Pool; <code>size</code> allein fällt auf Inline-Ausführung zurück.
</tip>

## Interceptors

Funktionsaufrufe durchlaufen eine Interceptor-Kette. Interceptors behandeln querschnittliche Belange getrennt von der Funktionsimplementierung.

```yaml
- name: my_function
  kind: function.lua
  source: file://handler.lua
  method: main
  meta:
    options:
      retry:
        max_attempts: 3
        initial_delay: 100
        backoff_factor: 2.0
```

Zu den integrierten Interceptors gehört Retry mit exponentiellem Backoff. In Go geschriebene Runtime-Integrationen können weitere Interceptors für Logging, Metriken, Tracing, Autorisierung, Circuit Breaking oder Anfragetransformation registrieren; Lua-Anwendungseinträge können nur von der Runtime installierte Interceptors konfigurieren.

Die Kette läuft vor und nach jedem Aufruf. Jeder Interceptor kann die Anfrage ändern, die Ausführung kurzschließen oder die Antwort umschließen.

## Contracts

Funktionen können ihre Ein- und Ausgabeschemas als Contracts bereitstellen. Contracts definieren Methodensignaturen für Runtime-Validierung und Dokumentationsgenerierung.

```lua
local contract = require("contract")
local sender, err = contract.get("app.email:sender")
if err then return nil, err end

local email, err = sender:open("app.email:sender_impl")
if err then return nil, err end

local result, err = email:send({to = "user@example.com", subject = "Hello"})
if err then return nil, err end
return result
```

Contracts erlauben Aufrufern, eine Schnittstelle zu verwenden und die Implementierung getrennt auszuwählen. Das unterstützt Tests, mandantenfähige Bereitstellungen und schrittweise Migrationen.

## Funktionen und Prozesse

Funktionen erben Kontext und Lebenszyklus des Aufrufers. Wird der Aufrufer abgebrochen, werden auch seine Funktionsaufrufe abgebrochen. Das eignet sich für die Ausführung in HTTP-Handlern und Queue-Consumern.

Prozesse laufen unabhängig mit Host-Kontext. Sie überleben ihren Erzeuger und kommunizieren durch Nachrichten. Verwenden Sie Prozesse für Hintergrundarbeit und Funktionen für anfragegebundene Operationen.
