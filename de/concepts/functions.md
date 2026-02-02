# Funktionen

Funktionen sind synchrone, zustandslose Einstiegspunkte. Sie rufen sie auf, sie werden ausgeführt, sie geben ein Ergebnis zurück. Wenn eine Funktion läuft, erbt sie den Kontext des Aufrufers — wenn der Aufrufer abbricht, wird auch die Funktion abgebrochen. Das macht Funktionen ideal für HTTP-Handler, API-Endpunkte und jede Operation, die innerhalb eines Anfragelebenszyklus abgeschlossen werden sollte.

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

Siehe das [funcs-Modul](lua/core/funcs.md) für die vollständige API.

## Kontextpropagierung

Jeder Aufruf erstellt einen Rahmen mit eigenem Kontextbereich. Kindfunktionen erben den Elternkontext ohne explizite Übergabe:

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

Der Sicherheitskontext wird auf dieselbe Weise weitergegeben. Aufgerufene Funktionen sehen den Aktor des Aufrufers und können Berechtigungen prüfen. Siehe das [security-Modul](lua/security/security.md) für Zugriffskontroll-APIs.

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

Funktionen können von anderen Laufzeitkomponenten aufgerufen werden — HTTP-Handlern, Warteschlangen-Konsumenten, geplanten Aufgaben — und unterliegen Berechtigungsprüfungen basierend auf dem Sicherheitskontext des Aufrufers.

## Pools

Funktionen werden in Pools ausgeführt, die die Ausführung verwalten. Der Pool-Typ bestimmt das Skalierungsverhalten.

**Inline** läuft in der Goroutine des Aufrufers. Keine Nebenläufigkeit, kein Speicher-Overhead. Wird für eingebettete Kontexte verwendet.

**Static** hält eine feste Anzahl von Workern. Anfragen werden in die Warteschlange gestellt, wenn alle Worker beschäftigt sind. Vorhersagbare Ressourcennutzung.

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

**Adaptive** skaliert automatisch basierend auf dem Durchsatz. Der Controller misst die Leistung und passt die Anzahl der Worker an, um sie für die aktuelle Last zu optimieren.

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
Wenn Sie keinen Pool-Typ angeben, wählt die Laufzeitumgebung einen basierend auf Ihrer Konfiguration. Setzen Sie <code>workers</code> für static, <code>max_size</code> für lazy, oder setzen Sie explizit <code>type</code> für volle Kontrolle.
</tip>

## Interceptors

Funktionsaufrufe durchlaufen eine Abfangkette. Abfänger behandeln übergreifende Belange, ohne die Geschäftslogik zu berühren.

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

Integrierte Abfänger umfassen Wiederholungen mit exponentiellem Anstieg der Wartezeit. Sie können benutzerdefinierte Abfänger für Protokollierung, Metriken, Ablaufverfolgung, Autorisierung, Schutzschalter oder Anfragetransformation hinzufügen.

Die Kette läuft vor und nach jedem Aufruf. Jeder Abfänger kann die Anfrage modifizieren, die Ausführung kurzschließen oder die Antwort umhüllen.

## Contracts

Funktionen können ihre Eingabe-/Ausgabe-Schemata als Verträge bereitstellen. Verträge definieren Methodensignaturen, die Laufzeitvalidierung und Dokumentationsgenerierung ermöglichen.

```lua
local contract = require("contract")
local email = contract.get("app.email:sender")
email:send({to = "user@example.com", subject = "Hello"})
```

Diese Abstraktion ermöglicht es Ihnen, Implementierungen auszutauschen, ohne aufrufenden Code zu ändern — nützlich für Tests, Mandantenfähigkeit oder schrittweise Migrationen.

## Funktionen vs Prozesse

Funktionen erben den Aufruferkontext und sind an den Aufruferlebenszyklus gebunden. Wenn der Aufrufer abbricht, brechen Funktionen ab. Dies ermöglicht eine direkte Ausführung in HTTP-Handlern und Warteschlangen-Konsumenten.

Prozesse laufen unabhängig mit Host-Kontext. Sie überleben ihren Ersteller und kommunizieren über Nachrichten. Verwenden Sie Prozesse für Hintergrundarbeit; verwenden Sie Funktionen für anfragebezogene Operationen.
