---
title: "Dataflow"
description: "Das Modul wippy/dataflow stellt eine Workflow-Orchestrierungs-Engine auf Basis gerichteter azyklischer Graphen (DAGs) bereit. Workflows bestehen aus Knoten —…"
---

# Dataflow

Das Modul `wippy/dataflow` stellt eine Workflow-Orchestrierungs-Engine auf Basis gerichteter azyklischer Graphen (DAGs) bereit. Workflows bestehen aus Knoten — Funktionen, Agenten, Zyklen und parallelen Prozessoren — die über typisierte Datenrouten verbunden sind. Der Orchestrator verwaltet Ausführung, Zustandspersistenz und Wiederherstellung.

## Setup

Fügen Sie das Modul Ihrem Projekt hinzu:

```bash
wippy add wippy/dataflow
wippy install
```

Deklarieren Sie die Abhängigkeit:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "*"
```

Das Dataflow-Modul hängt von `wippy/agent`, `wippy/llm` und `wippy/session` ab — diese werden beim Ausführen von `wippy install` automatisch aufgelöst. Das Modul benötigt eine Datenbankressource unter `app:db` für die Workflow-Persistenz und führt Migrationen automatisch über `wippy/migration` aus.

Das Modul veröffentlicht einen `env.variable`-Eintrag `userspace.dataflow.env:web_host_origin` (Standard `https://front.wippy.ai`), den nachgelagerte Flows zum Erstellen öffentlicher URLs lesen können. Überschreiben Sie ihn über den Env-Router oder ein Requirement.

## Flow Builder

Der Flow Builder bietet eine Fluent-Schnittstelle zum Zusammensetzen von Workflows. Importieren Sie ihn in Ihren Eintrag:

```yaml
imports:
  flow: userspace.dataflow.flow:flow
```

```lua
local flow = require("flow")
```

### Kern-API

```lua
flow.create()
    :with_title(title)
    :with_metadata(metadata)
    :with_input(data)
    :with_data(data)
    :[operation](config)
    :as(name)
    :to(target, input_key, transform)
    :error_to(target, input_key, transform)
    :when(condition)
    :run()   -- synchron
    :start() -- asynchron

flow.template()
    :[operations]...
```

### Lineare Pipeline

Knoten werden automatisch verkettet, wenn kein explizites Routing definiert ist. Der Output jedes Knotens fließt in den nächsten:

```lua
local result, err = flow.create()
    :with_input({ text = "Hello world" })
    :func("app:tokenize")
    :func("app:translate", { args = { target_lang = "fr" } })
    :func("app:format_output")
    :run()
```

### Benanntes Routing

Verwenden Sie `:as()`, um Knoten zu benennen, und `:to()`, um Daten zwischen ihnen zu routen. Verwenden Sie `:as()` nur, wenn der Knoten referenziert werden muss:

```lua
local result, err = flow.create()
    :with_input(task)
        :to("router")

    :func("app:router"):as("router")
        :to("context", "routing")
        :to("dev", "routing")

    :agent("app:context_agent"):as("context")
        :to("dev", "gathered_context")

    :agent("app:dev_agent"):as("dev")
        :to("@success")

    :run()
```

Der zweite Parameter von `:to()` ist der **Diskriminator** — der Input-Schlüssel am empfangenden Knoten. Empfängt ein Knoten mehrere Inputs, werden diese als Tabelle gesammelt, deren Schlüssel die Diskriminatoren sind.

### Workflow-Eingabe und statische Daten

`:with_input()` ist die einzige primäre Eingabe des Workflows. `:with_data()` erzeugt unabhängige statische Datenquellen:

```lua
flow.create()
    :with_input(task)
        :to("router")

    :with_data(config):as("cfg")
        :to("dev", "config")
        :to("logger", "config")

    :with_data(branch):as("branch_data")
        :to("checker", "branch")

    :func("app:router"):as("router")
        :to("dev", "task")

    :func("app:dev"):as("dev")
        :to("@success")
        :error_to("@fail")

    :run()
```

Verwenden Sie `:with_input()` für externe Daten, die in den Workflow eintreten. Verwenden Sie `:with_data()` für Konfiguration, Konstanten und Referenzdaten, die von mehreren Knoten gemeinsam genutzt werden. Statische Daten nutzen eine Referenzoptimierung — die erste Route erzeugt die eigentlichen Daten, nachfolgende Routen erzeugen leichtgewichtige Referenzen.

### Bedingtes Routing

Verwenden Sie `:when()` nach `:to()`, um Bedingungen hinzuzufügen. Bedingungen werden mit `expr`-Syntax gegen den Output des Knotens ausgewertet:

```lua
flow.create()
    :with_input(data)
    :func("app:classify"):as("classify")
        :to("handler_a"):when("output.category == 'a'")
        :to("handler_b"):when("output.category == 'b'")
        :to("fallback")
    :func("app:handler_a"):as("handler_a"):to("@success")
    :func("app:handler_b"):as("handler_b"):to("@success")
    :func("app:fallback"):as("fallback"):to("@success")
    :run()
```

Bedingungen lassen sich für komplexeres Routing mit Inline-Transformationen kombinieren:

```lua
:func("app:decompose"):as("decompose")
    :to("@success", nil, "{passed: true, feedback: nil}"):when("len(output.items) == 0")
    :to("processor", "items", "output.items")
```

Bedingte Ausdrücke unterstützen: Vergleiche (`output.score > 0.8`), logische Operatoren (`output.valid && output.count > 5`), Array-Funktionen (`len(output.items) > 0`, `any(output.errors, {.critical})`), String-Operationen (`output.status contains 'success'`) und Optional Chaining (`output.data?.nested?.value`).

### Workflow-Terminals

Routen Sie zu `@success` oder `@fail`, um den Workflow explizit zu beenden. In verschachtelten Kontexten (Zyklen, parallel) erzeugen Terminals Knoten-Outputs statt Workflow-Outputs:

```lua
:func("app:final_step"):to("@success")
:func("app:handler"):error_to("@fail")
```

### Fehler-Routing

Verwenden Sie `:error_to()`, um Knotenfehler an einen Handler zu routen. Fehler können als normale Inputs an Wiederherstellungsknoten geroutet werden:

```lua
:agent("app:gpt_planner", { model = "gpt-5" }):as("gpt_planner")
    :to("consolidator", "gpt_plan")
    :error_to("consolidator", "gpt_plan")

:agent("app:claude_planner", { model = "claude-4-5-sonnet" }):as("claude_planner")
    :to("consolidator", "claude_plan")
    :error_to("consolidator", "claude_plan")

:agent("app:consolidator", {
    inputs = { required = { "gpt_plan", "claude_plan" } }
}):as("consolidator")
```

Dieses Muster führt beide Planer parallel aus — schlägt einer fehl, wird sein Fehler zum Input für den Consolidator, der mit den verfügbaren Ergebnissen fortfährt.

## Input-Zusammenführung

Wie Knoten Inputs empfangen, hängt von den Diskriminatoren ab und davon, ob `args` konfiguriert ist.

**Ohne args — einzelner Default-Input:**

```lua
:func("source"):to("target")
-- target erhält: Rohinhalt (nicht eingepackt)
```

**Ohne args — einzelner benannter Input:**

```lua
:func("source"):to("target", "task")
-- target erhält: { task = content }
```

**Ohne args — mehrere Inputs:**

```lua
:func("source1"):to("target", "data")
:func("source2"):to("target", "config")
-- target erhält: { data = content1, config = content2 }
```

**Mit args — Inputs werden in die Basis gemergt:**

```lua
:func("app:api_client", {
    args = { base_url = "https://api.com", timeout = 5000 }
})
-- mit :to("api_client", "body") von einem vorgelagerten Knoten
-- api_client erhält: { base_url = "https://api.com", timeout = 5000, body = content }
```

<note>
Knoten mit <code>args</code> können keine Inputs mit dem Diskriminator <code>"default"</code> empfangen. Verwenden Sie stattdessen benannte Diskriminatoren mit <code>:to(target, "input_key")</code>.
</note>

## Input-Transformationen

Transformieren Sie Daten, bevor sie einen Knoten erreichen:

```lua
-- String-Transformation: einzelner Ausdruck
:func("app:step", { input_transform = "input.nested.field" })

-- Tabellen-Transformation: benannte Ausdrücke
:func("app:step", {
    input_transform = {
        task = "inputs.task",
        config = "inputs.settings",
        priority = "output.score > 0.8 ? 'high' : 'normal'"
    }
})
```

In Transformationen verfügbare Kontextvariablen: `input` (Workflow-Eingabe), `inputs` (alle eingehenden Knoten-Inputs), `output` (Output des aktuellen Knotens beim Routing).

### Inline-Routen-Transformationen

Der dritte Parameter von `:to()` ist ein Inline-Transformationsausdruck:

```lua
:func("source"):as("source")
    :to("target", nil, "output.data")
    :to("other", nil, "{passed: true, value: output.x}")
    :to("list", nil, "map(output.items, {.id})")
```

## Knotentypen

### Function-Knoten

Führt einen registrierten `function.lua`-Eintrag aus:

```lua
:func("app:my_function", {
    args = { key = "value" },
    inputs = { required = { "task", "config" } },
    context = { session_id = "abc" },
    input_transform = { task = "inputs.prompt" },
    metadata = { title = "Process Data" }
})
```

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `args` | table | Basisargumente, die mit den Knoten-Inputs gemergt werden |
| `inputs` | table | Input-Anforderungen: `{ required = {...}, optional = {...} }` |
| `context` | table | Ausführungskontext, der an die Funktion übergeben wird |
| `input_transform` | string/table | Ausdruck zur Transformation der Inputs |
| `metadata` | table | Knoten-Metadaten (z. B. `{ title = "..." }`) |

Gibt die Funktion `{ _control = { commands = [...] } }` zurück, startet der Orchestrator einen Kind-Workflow. So funktionieren verschachtelte Flows.

### Agent-Knoten

Führt einen Agenten mit Tool-Aufrufen und optionalem strukturiertem Exit aus:

```lua
:agent("app:content_writer", {
    model = "gpt-5",
    inputs = { required = { "context", "content_plan", "analysis" } },
    arena = {
        prompt = "Write content based on the provided context.",
        max_iterations = 12,
        tool_calling = "any",
        exit_schema = {
            type = "object",
            properties = {
                content = { type = "string" },
                title = { type = "string" }
            },
            required = { "content", "title" }
        }
    },
    show_tool_calls = true,
    metadata = { title = "Content Writer" }
})
```

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `model` | string | Modell überschreiben |
| `arena.prompt` | string | System-Prompt |
| `arena.max_iterations` | number | Maximale Reasoning-Schleifen (Standard: 32) |
| `arena.min_iterations` | number | Minimale Iterationen vor dem Exit (Standard: 1) |
| `arena.tool_calling` | string | `"auto"`, `"any"` (erfordert `exit_schema`), `"none"` (lehnt `exit_schema` ab) |
| `arena.tools` | array | Tool-Registry-IDs |
| `arena.exit_schema` | table | JSON-Schema für den strukturierten Exit |
| `arena.exit_func_id` | string | Funktion zur Validierung des Exit-Outputs |
| `arena.context` | table | Zusätzlicher Kontext |
| `inputs` | table | Input-Anforderungen |
| `show_tool_calls` | boolean | Tool-Aufrufe in den Output aufnehmen |
| `input_transform` | string/table | Inputs transformieren |
| `metadata` | table | Knoten-Metadaten |

**Dynamische Agentenauswahl:** Übergeben Sie einen leeren String als Agent-ID und lösen Sie sie über `input_transform` auf:

```lua
:agent("", {
    inputs = { required = { "spec", "task" } },
    input_transform = {
        agent_id = "inputs.spec.agent_id",
        task = "inputs.task"
    },
    arena = {
        prompt = "Process according to spec",
        max_iterations = 25
    }
})
```

**Exit-Validierung:** Ist `exit_func_id` gesetzt, validiert die Funktion den Exit-Output des Agenten. Schlägt die Validierung fehl, erhält der Agent den Fehler als Beobachtung und fährt fort (bis zu `max_iterations`).

### Cycle-Knoten

Iteriert eine Funktion oder ein Template wiederholt mit persistentem Zustand:

```lua
:cycle({
    func_id = "app:content_cycle",
    max_iterations = 3,
    initial_state = {
        entry_id = entry_id,
        content_prompt = prompt,
        min_score = 8.0,
        feedback_history = {}
    }
})
```

Die Zyklusfunktion erhält in jeder Iteration:

```lua
{
    input = <workflow_input>,  -- nur in der ersten Iteration (iteration == 1); danach nil
    state = <accumulated_state>,
    last_result = <previous_iteration_output>,
    iteration = <current_iteration_number>
}
```

`input` enthält die Workflow-Eingabe nur in der ersten Iteration und ist danach `nil`; alles, was über Iterationen hinweg benötigt wird, muss in `state` abgelegt werden.

Die Funktion steuert die Fortsetzung:

```lua
function my_cycle(cycle_context)
    -- anhalten, wenn freigegeben
    if cycle_context.last_result and cycle_context.last_result.approved then
        return {
            state = cycle_context.state,
            result = cycle_context.last_result,
            continue = false
        }
    end

    -- Kind-Workflow für diese Iteration starten
    -- task wird aus state gelesen, da cycle_context.input ab Iteration 2 nil ist
    return flow.create()
        :with_input({ task = cycle_context.state.task })
        :agent("app:worker")
        :agent("app:qa")
        :run()
end
```

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `func_id` | string | Iterationsfunktion (schließt `template` aus) |
| `template` | FlowBuilder | Template für jede Iteration (schließt `func_id` aus) |
| `max_iterations` | number | Maximale Anzahl an Iterationen |
| `initial_state` | table | Anfangszustand |
| `continue_condition` | string | Ausdruck: fortsetzen, solange true |

**Template-basierter Zyklus:**

```lua
:cycle({
    template = flow.template()
        :agent("app:worker")
        :func("app:validator"),
    max_iterations = 5
})
```

### Parallel-Knoten

Map-Reduce-Muster über Arrays:

```lua
:parallel({
    inputs = { required = { "specs", "task" } },
    source_array_key = "specs",
    iteration_input_key = "spec",
    passthrough_keys = { "task" },
    batch_size = 10,
    on_error = "collect_errors",
    filter = "successes",
    unwrap = true,
    template = flow.template()
        :agent("app:processor", {
            inputs = { required = { "spec", "task" } },
            input_transform = {
                agent_id = "inputs.spec.agent_id",
                task = "inputs.task"
            },
            arena = {
                prompt = "Process according to spec",
                max_iterations = 25
            }
        })
        :to("@success"),
    metadata = { title = "Process Specs" }
})
```

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `source_array_key` | string | Input-Schlüssel, der das Array enthält (erforderlich) |
| `template` | FlowBuilder | Template für jedes Element (erforderlich, muss zu `@success` routen) |
| `iteration_input_key` | string | Input-Schlüssel für das aktuelle Element (Standard: `"default"`) |
| `batch_size` | number | Elemente pro parallelem Batch (Standard: 1 = sequenziell) |
| `on_error` | string | `"collect_errors"` (Standard) oder `"fail_fast"` |
| `filter` | string | `"all"` (Standard), `"successes"`, `"failures"` |
| `unwrap` | boolean | Rohergebnisse statt eingepackter Metadaten zurückgeben (Standard: false) |
| `passthrough_keys` | array | Input-Schlüssel, die an jede Iteration weitergereicht werden |

**Passthrough-Schlüssel** stellen jeder Iteration gemeinsamen Kontext (Konfiguration, Aufgabenbeschreibung) bereit, ohne Daten im Quell-Array zu duplizieren:

```lua
:with_data(file_list):as("files"):to("processor", "files")
:with_data("secret"):as("api_key"):to("processor", "api_key")

:parallel({
    inputs = { required = { "files", "api_key" } },
    source_array_key = "files",
    iteration_input_key = "filename",
    passthrough_keys = { "api_key" },
    template = flow.template()
        :func("app:upload", {
            inputs = { required = { "filename", "api_key" } }
        })
        :to("@success")
}):as("processor")
```

### Signal-Knoten

Pausiert die Ausführung, bis ein externes Signal eintrifft. Wird für menschliche Freigaben, externe Ereignisse oder mehrstufige Workflows verwendet:

```lua
:signal({
    signal_id = "approval",
    inputs = { required = { "draft" } },
    metadata = { title = "Wait for approval" }
})
```

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `signal_id` | string | Signalname, der mit `client:signal()` abgeglichen wird. Wenn leer oder weggelassen, wird zur Laufzeit eine UUID v7 generiert |
| `inputs` | table | Input-Anforderungen |
| `input_transform` | string/table | Transformiert Inputs, bevor der Knoten sie erhält |
| `metadata` | table | Knoten-Metadaten |

Senden Sie das Signal von außerhalb des Workflows über die Client-API (siehe `client:signal()` unten).

#### Verhalten

Der Knoten yieldet mit `wait_for_signal = true` und persistiert diesen Yield im Workflow-Zustand. Der Orchestrator nimmt den Knoten wieder auf, wenn ein passender `NODE_SIGNAL`-Commit eintrifft.

- Das Signal wird durch jede nicht-`nil` Payload erfüllt. `false`, `0`, `""` und `{}` erfüllen den Yield alle; nur `nil` lässt ihn ausstehend.
- Ein Signal-Yield blockiert `COMPLETE_WORKFLOW`, aber nicht andere ausstehende Knoten — parallele Zweige werden weiter ausgeführt, während ein Zweig wartet.
- Signale können vor `:start()` vorab in die Warteschlange gestellt werden: Wenn ein passender `NODE_SIGNAL`-Commit eintrifft, bevor der Signal-Knoten den Yield erreicht, wird er in dem Moment zugestellt, in dem der Yield erfasst wird.
- Nur ein Signal erfüllt jeden Yield. Wenn ein zweites Signal mit derselben `signal_id` eintrifft, bevor der Yield erfüllt ist, überschreibt es das erste.
- Wenn mehrere Signal-Yields dieselbe `signal_id` teilen, erhält der erste passende Yield die Daten.
- Wenn das Feld `signal_id` fehlt, fällt der Abgleich auf den Diskriminator des Knotens zurück.
- Die zugestellten Signaldaten werden als Signal-Payload an den Output des Knotens übergeben.

#### Dauerhaftigkeit und Wiederherstellung

Der Signal-Yield ist Teil des Workflow-Zustands und wird über denselben Outbox-Mechanismus wie jedes andere Kommando persistiert. Wenn der Orchestrator-Prozess während des Wartens beendet wird:

- Der ausstehende Yield wird beim Neustart wiederhergestellt.
- Während des Ausfalls zugestellte Signale werden in die Warteschlange gestellt und beim erneuten Laden des Zustands angewendet.
- Verbund-Pipelines (`func → signal → signal → func`) erholen sich schrittweise — jedes Signal kann über einen separaten Neustart hinweg zugestellt werden.

Verwaiste Signal-Yields (Yields, deren Elternprozess ohne Abschluss beendet wurde) werden vom Process-Exit-Handler des Workflow-Zustands bereinigt.

#### Pipeline-Muster

Signal-Knoten nehmen an jeder Topologie teil:

```lua
-- Human-in-the-Loop-Freigabe zwischen zwei Funktionen
flow.create()
    :func("app:draft")
    :signal({ signal_id = "approve_draft" })
    :func("app:publish")
    :run()

-- Zwei parallele Freigaben, die beide vor der Veröffentlichung eintreffen müssen
flow.create()
    :with_input({ doc = "release-notes" })
        :as("trigger")
        :to("legal", "doc")
        :to("finance", "doc")

    :signal({ signal_id = "legal_ok", inputs = { required = { "doc" } } })
        :as("legal")
        :to("gate", "legal")

    :signal({ signal_id = "finance_ok", inputs = { required = { "doc" } } })
        :as("finance")
        :to("gate", "finance")

    :join({ inputs = { required = { "legal", "finance" } } })
        :as("gate")
        :to("release")

    :func("app:release"):as("release"):to("@success")
    :run()
```

Signaldaten werden als Knoten-Output bereitgestellt, sodass nachgelagerte Knoten alles erhalten, was an `client:signal()` übergeben wurde.

### Join-Knoten

Sammelt mehrere Inputs, bevor es weitergeht:

```lua
:join({
    inputs = { required = { "source1", "source2" } },
    output_mode = "object",
    ignored_keys = { "triggered" }
})
```

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `output_mode` | string | `"object"` (Standard) oder `"array"` (Reihenfolge des Eintreffens) |
| `ignored_keys` | array | Input-Schlüssel, die aus dem Output ausgeschlossen werden |
| `inputs` | table | Input-Anforderungen |

## Templates

Templates definieren wiederverwendbare Teil-Workflows. Verwenden Sie `flow.template()` zum Erstellen und `:use()` zum Einfügen:

```lua
local preprocessor = flow.template()
    :func("app:clean")
    :func("app:tokenize")

flow.create()
    :with_input(data)
    :use(preprocessor)
    :func("app:process")
    :run()
```

Templates fügen ihre Operationen zur Kompilierzeit inline in den übergeordneten Flow ein.

## Verschachtelte Workflows

Funktionen, die in Cycle- und Parallel-Knoten verwendet werden, können Kind-Workflows starten, indem sie `flow.create():run()` zurückgeben:

```lua
function my_processor(input)
    return flow.create()
        :with_input(input)
        :func("app:step_a")
        :func("app:step_b")
        :run()
end
```

Wird `:run()` innerhalb eines bestehenden Dataflow-Kontexts ausgeführt, gibt es `{ _control = { commands = [...] } }` zurück, statt direkt auszuführen. Der Orchestrator behandelt den Kind-Workflow über den Yield-Mechanismus.

<note>
Funktionen, die an der Dataflow-Komposition teilnehmen, <strong>müssen</strong> <code>flow.create():run()</code> zurückgeben. Funktionen, die etwas anderes zurückgeben, können keine Kind-Workflows starten.
</note>

## Synchron vs. asynchron

`:run()` blockiert, bis der Workflow abgeschlossen ist, und gibt den Output zurück:

```lua
local result, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :run()
```

`:start()` kehrt sofort mit einer Workflow-ID zurück:

```lua
local dataflow_id, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :start()
```

`:start()` kann in verschachtelten Kontexten nicht verwendet werden.

## Client-API

Für die programmatische Workflow-Verwaltung:

```yaml
imports:
  client: userspace.dataflow:client
```

```lua
local client = require("client")

local c, err = client.new()
```

| Methode | Beschreibung |
|--------|-------------|
| `client.new()` | Client erstellen (erfordert einen Security-Actor) |
| `:create_workflow(commands, options?)` | Workflow erstellen, gibt `dataflow_id` zurück |
| `:execute(dataflow_id, options?)` | Synchron ausführen, gibt das Ergebnis zurück |
| `:start(dataflow_id, options?)` | Asynchron ausführen, gibt `dataflow_id` zurück |
| `:output(dataflow_id)` | Workflow-Outputs abrufen |
| `:get_status(dataflow_id)` | Aktuellen Status abrufen |
| `:cancel(dataflow_id, timeout?)` | Sanft abbrechen (Standard: 30s) |
| `:terminate(dataflow_id)` | Zwangsweise beenden |
| `:signal(dataflow_id, signal_id, data?)` | Liefert ein externes Signal an einen wartenden Signal-Knoten |

## Workflow-Status

| Status | Beschreibung |
|--------|-------------|
| `template` | Knoten ist eine Template-Instanz |
| `pending` | Wartet auf Inputs |
| `ready` | Inputs gesammelt, bereit zur Ausführung |
| `running` | Wird aktiv ausgeführt |
| `paused` | Yieldet, wartet auf Kind-Workflow |
| `completed` | Erfolgreich abgeschlossen |
| `failed` | Fehlgeschlagen |
| `cancelled` | Vom Benutzer abgebrochen |
| `skipped` | Bedingter Zweig nicht genommen |
| `terminated` | Zwangsweise beendet |

## Metadaten

```lua
flow.create()
    :with_title("Document Processing Pipeline")
    :with_metadata({ source = "api", priority = "high" })
    :func("app:process", { metadata = { title = "Process Document" } })
    :run()
```

Der Titel ist standardmäßig "Flow Builder Workflow", wenn keiner angegeben wird.

## Validierungsregeln

Der Compiler validiert Workflows zur Kompilierzeit:

- Alle `:as(name)`-Namen müssen eindeutig sein
- Alle `:to()`- und `:error_to()`-Ziele müssen auf vorhandene Namen verweisen (außer `@success`, `@fail`)
- Der Graph muss azyklisch sein
- Alle Knoten müssen eingehende Routen haben (von einem anderen Knoten, der Workflow-Eingabe oder statischen Daten)
- `:cycle()` erfordert `func_id` oder `template` (nicht beides)
- `:parallel()` erfordert `source_array_key` und `template`
- Mindestens ein Pfad muss zu `@success` führen oder einen automatischen Output haben
- `:when()` folgt nur auf `:to()` oder `:error_to()` von Knoten (nicht von statischen Daten)
- Knoten mit `args` können keine Inputs mit dem Diskriminator `"default"` empfangen

## Ausdrucksreferenz

Ausdrücke verwenden die Syntax des `expr`-Moduls und stehen in `:when()`-Bedingungen und `input_transform`-Werten zur Verfügung.

**Operatoren:** `+`, `-`, `*`, `/`, `%`, `**`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`, `contains`, `startsWith`, `endsWith`

**Array-Funktionen:** `all()`, `any()`, `none()`, `one()`, `filter()`, `map()`, `count()`, `len()`, `first()`, `last()`

**Mathematische Funktionen:** `max()`, `min()`, `abs()`, `ceil()`, `floor()`, `round()`, `sqrt()`, `pow()`

**String-Funktionen:** `len()`, `upper()`, `lower()`, `trim()`, `split()`, `join()`

**Typfunktionen:** `type()`, `int()`, `float()`, `string()`

**Literale:** Zahlen, Strings, Booleans (`true`/`false`), null (`nil`), Arrays (`[1, 2, 3]`), Objekte (`{key: value}`)

**Ternärer Operator:** `output.age >= 18 ? output.verified : false`

**Optional Chaining:** `output.data?.nested?.value`

## Fehlerbehandlung

Sowohl `:run()` als auch `:start()` folgen den üblichen Lua-Fehlerkonventionen:

- Erfolg: `data, nil` (run) oder `dataflow_id, nil` (start)
- Fehler: `nil, error_message`

Fehlerkategorien: Kompilierungsfehler, Client-Fehler, Fehler bei der Workflow-Erstellung, Ausführungsfehler und Workflow-Fehlschläge.

## Siehe auch

- [Agents](framework/agents.md) - Agent-Framework, das von Agent-Knoten verwendet wird
- [LLM](framework/llm.md) - LLM-Modul
- [Framework-Übersicht](framework/overview.md) - Nutzung der Framework-Module
