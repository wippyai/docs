# Funktionen

Funktionen sind synchrone, zustandslose Entry Points. Sie rufen sie auf, sie werden ausgeführt, sie geben ein Ergebnis zurück. Wenn eine Funktion läuft, erbt sie den Kontext des Aufrufers — wenn der Aufrufer abbricht, wird auch die Funktion abgebrochen. Das macht Funktionen ideal für HTTP-Handler, API-Endpunkte und jede Operation, die innerhalb eines Request-Lebenszyklus abgeschlossen werden sollte.

## Funktionen aufrufen

Rufen Sie Funktionen synchron mit `funcs.call()` auf:

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
```

Für nicht-blockierende Ausführung verwenden Sie `funcs.async()`:

```lua
local future = funcs.async("app.process:analyze", data)

local ch = future:response()
local result, ok = ch:receive()
```

Siehe das [funcs-Modul](lua-funcs.md) für die vollständige API.

## Kontextpropagierung

Jeder Aufruf erstellt einen Frame mit eigenem Kontextbereich. Kindfunktionen erben Elternkontext ohne explizite Übergabe:

```lua
local ctx = require("ctx")

local trace_id = ctx.get("trace_id")
local user_id = ctx.get("user_id")
```

Kontext beim Aufrufen hinzufügen:

```lua
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :call("app.api:process", data)
```

Sicherheitskontext propagiert auf dieselbe Weise. Aufgerufene Funktionen sehen den Actor des Aufrufers und können Berechtigungen prüfen. Siehe das [security-Modul](lua-security.md) für Zugriffskontroll-APIs.

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

Funktionen können von anderen Runtime-Komponenten aufgerufen werden — HTTP-Handlern, Queue-Konsumenten, geplanten Jobs — und unterliegen Berechtigungsprüfungen basierend auf dem Sicherheitskontext des Aufrufers.

## Pools

Funktionen laufen auf Pools, die die Ausführung verwalten. Der Pool-Typ bestimmt das Skalierungsverhalten.

**Inline** läuft in der Goroutine des Aufrufers. Keine Nebenläufigkeit, kein Allokations-Overhead. Wird für eingebettete Kontexte verwendet.

**Static** hält eine feste Anzahl von Workern. Anfragen werden in eine Warteschlange gestellt, wenn alle Worker beschäftigt sind. Vorhersagbare Ressourcennutzung.

```yaml
pool:
  type: static
  workers: 8
  buffer: 512
```

**Lazy** beginnt leer und erstellt Worker bei Bedarf. Ungenutzte Worker werden nach einem Timeout zerstört. Effizient bei variablem Traffic.

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive** skaliert automatisch basierend auf dem Durchsatz. Der Controller misst die Leistung und passt die Worker-Anzahl an, um für die aktuelle Last zu optimieren.

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
Wenn Sie keinen Pool-Typ angeben, wählt die Runtime einen basierend auf Ihrer Konfiguration. Setzen Sie <code>workers</code> für static, <code>max_size</code> für lazy, oder setzen Sie explizit <code>type</code> für volle Kontrolle.
</tip>

## Interceptors

Funktionsaufrufe durchlaufen eine Interceptor-Kette. Interceptors behandeln Querschnittsbelange, ohne die Geschäftslogik zu berühren.

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

Eingebaute Interceptors umfassen Retry mit exponentiellem Backoff. Sie können benutzerdefinierte Interceptors für Logging, Metriken, Tracing, Autorisierung, Circuit Breaking oder Request-Transformation hinzufügen.

Die Kette läuft vor und nach jedem Aufruf. Jeder Interceptor kann den Request modifizieren, die Ausführung kurzschließen oder die Response wrappen.

## Contracts

Funktionen können ihre Input/Output-Schemas als Contracts exponieren. Contracts definieren Methodensignaturen, die Runtime-Validierung und Dokumentationsgenerierung ermöglichen.

```lua
local contract = require("contract")
local email = contract.get("app.email:sender")
email:send({to = "user@example.com", subject = "Hello"})
```

Diese Abstraktion ermöglicht es Ihnen, Implementierungen auszutauschen, ohne aufrufenden Code zu ändern — nützlich für Tests, Multi-Tenant-Deployments oder graduelle Migrationen.

## Funktionen vs Prozesse

Funktionen erben Aufruferkontext und sind an den Aufrufer-Lebenszyklus gebunden. Wenn der Aufrufer abbricht, brechen Funktionen ab. Dies ermöglicht Edge-Ausführung — direkte Ausführung in HTTP-Handlern und Queue-Konsumenten.

Prozesse laufen unabhängig mit Host-Kontext. Sie überleben ihren Ersteller und kommunizieren über Nachrichten. Verwenden Sie Prozesse für Hintergrundarbeit; verwenden Sie Funktionen für request-bezogene Operationen.
