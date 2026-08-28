---
title: "Dataflow"
description: "Workflows als gerichtete azyklische Graphen erstellen, ausführen, persistieren und wiederherstellen."
---

# Dataflow

Das Modul `wippy/dataflow` stellt eine Workflow-Engine auf Grundlage gerichteter azyklischer Graphen (DAGs) bereit. Workflows bestehen aus Knoten – Funktionen, Agenten, Zyklen und parallelen Verarbeitern –, die durch typisierte Datenrouten verbunden sind. Der Orchestrator übernimmt Ausführung, Zustandspersistenz und Wiederherstellung.

Diese Seite ist eine API-Einführung mit konzeptionellen und Referenzausschnitten, kein eigenständiges Tutorial. Werte wie `task`, `config` und `file_list` sowie IDs wie `app:tokenize` oder `app:worker` stehen für Daten und Registry-Entrys der Anwendung. Die Ausschnitte setzen außerdem die unter [Einrichtung](#einrichtung) beschriebene Persistenzdatenbank und den Prozess-Host voraus. Ein vollständiges ausführbares Projekt finden Sie unter [Einen Dataflow-Workflow erstellen](../tutorials/dataflow.md).

## Einrichtung

Fügen Sie das Modul dem Projekt hinzu:

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

Das Dataflow-Modul hängt von `wippy/agent`, `wippy/llm`, `wippy/session` und `wippy/test` ab; `wippy install` löst diese Abhängigkeiten automatisch auf. Für die Workflow-Persistenz erwartet es standardmäßig eine Datenbankressource unter `app:db` und einen Prozess-Host unter `app:processes`. Die Migrationen führt `wippy/migration` automatisch aus. Abweichende Ressourcen werden über die Anforderungen `target_db` beziehungsweise `process_host` zugeordnet.

Das Modul veröffentlicht den Eintrag `userspace.dataflow.env:web_host_origin` vom Typ `env.variable` mit dem Standardwert `https://front.wippy.ai`. Nachgelagerte Flows können ihn zum Erzeugen öffentlicher URLs lesen. Überschreiben Sie ihn über den Env-Router oder eine Anforderung.

## Flow Builder

Der Flow Builder bietet eine Fluent API zum Zusammensetzen von Workflows. Importieren Sie ihn in Ihren Eintrag:

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
    :run()   -- synchronous
    :start() -- asynchronous

flow.template()
    :[operations]...
```

### Lineare Pipeline

Ohne explizite Routen werden Knoten automatisch verkettet. Die Ausgabe eines Knotens fließt jeweils in den nächsten:

```lua
local result, err = flow.create()
    :with_input({ text = "Hello world" })
    :func("app:tokenize")
    :func("app:translate", { args = { target_lang = "fr" } })
    :func("app:format_output")
    :run()
```

### Benannte Routen

Mit `:as()` benennen Sie Knoten, mit `:to()` leiten Sie Daten zwischen ihnen weiter. Verwenden Sie `:as()` nur, wenn der Knoten referenziert werden muss:

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

Der zweite Parameter von `:to()` ist der **Diskriminator**, also der Eingabeschlüssel am Zielknoten. Empfängt ein Knoten mehrere Eingaben, werden sie in einer Tabelle gesammelt, deren Schlüssel die Diskriminatoren sind.

### Workflow-Eingabe und statische Daten

`:with_input()` definiert die einzige primäre Eingabe des Workflows. `:with_data()` erzeugt unabhängige statische Datenquellen:

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

Verwenden Sie `:with_input()` für externe Daten, die in den Workflow gelangen. `:with_data()` eignet sich für `config`, Konstanten und Referenzdaten, die mehrere Knoten gemeinsam nutzen. Bei statischen Daten legt die erste Route die eigentlichen Daten an; weitere Routen erzeugen leichtgewichtige Referenzen.

### Bedingte Routen

Fügen Sie nach `:to()` mit `:when()` eine Bedingung hinzu. Bedingungen werden in der Syntax von `expr` gegen die Knotenausgabe ausgewertet:

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

Bedingungen lassen sich für komplexere Routen mit Inline-Transformationen kombinieren:

```lua
:func("app:decompose"):as("decompose")
    :to("@success", nil, "{passed: true, feedback: nil}"):when("len(output.items) == 0")
    :to("processor", "items", "output.items")
```

Bedingungsausdrücke unterstützen Vergleiche (`output.score > 0.8`), logische Operatoren (`output.valid && output.count > 5`), Array-Funktionen (`len(output.items) > 0`, `any(output.errors, {.critical})`), Zeichenkettenoperationen (`output.status contains 'success'`) und optionale Verkettung (`output.data?.nested?.value`).

### Workflow-Endpunkte

Leiten Sie zu `@success` oder `@fail` weiter, um den Workflow ausdrücklich zu beenden. In verschachtelten Kontexten wie Zyklen und Parallelknoten erzeugen diese Endpunkte eine Knotenausgabe statt einer Workflow-Ausgabe:

```lua
:func("app:final_step"):to("@success")
:func("app:handler"):error_to("@fail")
```

### Fehlerrouten

Mit `:error_to()` leiten Sie Knotenfehler an einen Handler weiter. Fehler können wie normale Eingaben an Wiederherstellungsknoten übergeben werden:

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

Dieses Muster führt beide Planer parallel aus. Schlägt einer fehl, wird sein Fehler zur Eingabe des Konsolidierers, der mit den verfügbaren Ergebnissen fortfährt.

## Zusammenführen von Eingaben

Wie Knoten Eingaben empfangen, hängt von den Diskriminatoren und davon ab, ob `args` konfiguriert ist.

**Ohne `args` – eine Standardeingabe:**

```lua
:func("source"):to("target")
-- target receives: raw content (unwrapped)
```

**Ohne `args` – eine benannte Eingabe:**

```lua
:func("source"):to("target", "task")
-- target receives: { task = content }
```

**Ohne `args` – mehrere Eingaben:**

```lua
:func("source1"):to("target", "data")
:func("source2"):to("target", "config")
-- target receives: { data = content1, config = content2 }
```

**Mit `args` – Eingaben werden in die Basis eingefügt:**

```lua
:func("app:api_client", {
    args = { base_url = "https://api.com", timeout = 5000 }
})
-- with :to("api_client", "body") from upstream
-- api_client receives: { base_url = "https://api.com", timeout = 5000, body = content }
```

<note>
Knoten mit <code>args</code> können keine Eingaben mit dem Diskriminator <code>"default"</code> empfangen. Verwenden Sie stattdessen benannte Diskriminatoren mit <code>:to(target, "input_key")</code>.
</note>

## Eingabetransformationen

Transformieren Sie Daten, bevor sie einen Knoten erreichen:

```lua
-- String transform: single expression
:func("app:step", { input_transform = "input.nested.field" })

-- Table transform: named expressions
:func("app:step", {
    input_transform = {
        task = "inputs.task",
        config = "inputs.settings",
        priority = "output.score > 0.8 ? 'high' : 'normal'"
    }
})
```

In Transformationen stehen die Kontextvariablen `input` (Workflow-Eingabe), `inputs` (alle eingehenden Knoteneingaben) und `output` (aktuelle Knotenausgabe bei der Weiterleitung) zur Verfügung.

### Inline-Routentransformationen

Der dritte Parameter von `:to()` ist ein Inline-Transformationsausdruck:

```lua
:func("source"):as("source")
    :to("target", nil, "output.data")
    :to("other", nil, "{passed: true, value: output.x}")
    :to("list", nil, "map(output.items, {.id})")
```

## Knotentypen

### Funktionsknoten

Führt einen registrierten Eintrag vom Typ `function.lua` aus:

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
| `args` | table | Basisargumente, die mit den Knoteneingaben zusammengeführt werden |
| `inputs` | table | Eingabeanforderungen: `{ required = {...}, optional = {...} }` |
| `context` | table | An die Funktion übergebener Ausführungskontext |
| `input_transform` | string/table | Ausdruck zum Transformieren von Eingaben |
| `metadata` | table | Knotenmetadaten, zum Beispiel `{ title = "..." }` |

Gibt die Funktion `{ _control = { commands = [...] } }` zurück, startet der Orchestrator einen untergeordneten Workflow. Darauf beruhen verschachtelte Flows.

### Agentenknoten

Führt einen Agenten mit Tool-Aufrufen und optionaler strukturierter Ausgabe aus:

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
| `arena.max_iterations` | number | Höchstzahl der Schlussfolgerungsschleifen (Standard: 32) |
| `arena.min_iterations` | number | Mindestzahl der Iterationen vor dem Beenden (Standard: 1) |
| `arena.tool_calling` | string | `"auto"`, `"any"` (erfordert `exit_schema`), `"none"` (lehnt `exit_schema` ab) |
| `arena.tools` | array | Registry-IDs der Tools |
| `arena.exit_schema` | table | JSON-Schema für die strukturierte Ausgabe |
| `arena.exit_func_id` | string | Funktion zum Validieren der Endausgabe |
| `arena.context` | table | Zusätzlicher Kontext |
| `inputs` | table | Eingabeanforderungen |
| `active_traits` | array | Aktive Traits des ausgewählten Agenten überschreiben; ein leeres Array deaktiviert sie für diesen Knoten |
| `active_tools` | array | Aktive Tools des ausgewählten Agenten überschreiben; ein leeres Array deaktiviert sie für diesen Knoten |
| `show_tool_calls` | boolean | Tool-Aufrufe in die Ausgabe aufnehmen |
| `input_transform` | string/table | Eingaben transformieren |
| `metadata` | table | Knotenmetadaten |

**Dynamische Agentenauswahl:** Übergeben Sie als Agenten-ID eine leere Zeichenkette und lösen Sie sie über `input_transform` auf:

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

**Validierung der Endausgabe:** Ist `exit_func_id` gesetzt, validiert die Funktion die Endausgabe des Agenten. Bei einem Validierungsfehler erhält der Agent den Fehler als Beobachtung und fährt bis höchstens `max_iterations` fort.

### Zyklusknoten

Führt eine Funktion oder Vorlage wiederholt mit persistentem `state` aus:

```lua
:cycle({
    func_id = "app:content_cycle",
    max_iterations = 3,
    initial_state = {
        entry_id = entry_id,
        content_prompt = prompt,
        task = task,
        min_score = 8.0,
        feedback_history = {}
    }
})
```

Die Zyklusfunktion erhält bei jeder Iteration:

```lua
{
    input = <workflow_input>,  -- only on the first iteration (iteration == 1); nil thereafter
    state = <accumulated_state>,
    last_result = <previous_iteration_output>,
    iteration = <current_iteration_number>
}
```

`input` enthält die Workflow-Eingabe nur in der ersten Iteration und danach `nil`. Legen Sie alles, was über mehrere Iterationen benötigt wird, in `state` ab.

Die Funktion steuert die Fortsetzung:

```lua
function my_cycle(cycle_context)
    -- stop if approved
    if cycle_context.last_result and cycle_context.last_result.approved then
        return {
            state = cycle_context.state,
            result = cycle_context.last_result,
            continue = false
        }
    end

    -- spawn child workflow for this iteration
    -- task is read from state since cycle_context.input is nil after iteration 1
    return flow.create()
        :with_input({ task = cycle_context.state.task })
        :agent("app:worker")
        :agent("app:qa")
        :run()
end
```

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `func_id` | string | Iterationsfunktion; schließt `template` aus |
| `template` | FlowBuilder | Vorlage für jede Iteration; schließt `func_id` aus |
| `max_iterations` | number | Höchstzahl der Iterationen (Standard: 100) |
| `initial_state` | table | Anfangszustand (Standard: `{}`) |
| `continue_condition` | string | Ausdruck: fortsetzen, solange er wahr ist |
| `inputs` | table | Eingabeanforderungen |
| `context` | table | An die Zyklusfunktion übergebener Ausführungskontext |
| `input_transform` | string/table | Eingaben transformieren, bevor der Zyklus sie empfängt |
| `metadata` | table | Knotenmetadaten |

**Vorlagenbasierter Zyklus:**

```lua
:cycle({
    template = flow.template()
        :agent("app:worker")
        :func("app:validator"),
    max_iterations = 5
})
```

### Parallelknoten

Map-Reduce-Muster für Arrays:

```lua
:parallel({
    inputs = { required = { "specs", "task" } },
    source_array_key = "specs",
    iteration_input_key = "spec",
    passthrough_keys = { "task" },
    batch_size = 10,
    scheduling = "rolling",
    on_error = "continue",
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
| `source_array_key` | string | Eingabeschlüssel mit einem nicht leeren Array (erforderlich) |
| `template` | FlowBuilder | Vorlage für jedes Element (erforderlich; muss zu `@success` führen) |
| `iteration_input_key` | string | Eingabeschlüssel des aktuellen Elements (Standard: `"default"`) |
| `batch_size` | number | Positive Ganzzahl bis 1000; Höchstzahl gleichzeitig laufender Elemente (Standard: 1) |
| `scheduling` | string | `"batch"` (Standard) wartet auf eine vollständige Welle; `"rolling"` füllt frei gewordene Plätze fortlaufend nach und erfordert `on_error = "continue"` |
| `on_error` | string | `"continue"` (Standard) oder `"fail_fast"`; `"collect_errors"` bleibt ein Kompatibilitätsalias für `"continue"` |
| `filter` | string | `"all"` (Standard), `"successes"` oder `"failures"` |
| `unwrap` | boolean | Rohergebnisse statt umhüllter Metadaten zurückgeben (Standard: `false`) |
| `passthrough_keys` | array | Eingabeschlüssel, die an jede Iteration weitergereicht werden |
| `inputs` | table | Eingabeanforderungen |
| `input_transform` | string/table | Eingaben vor der parallelen Verarbeitung transformieren |
| `metadata` | table | Knotenmetadaten |

**Durchgereichte Schlüssel** stellen jeder Iteration gemeinsamen Kontext wie Konfiguration oder Aufgabenbeschreibung bereit, ohne die Daten im Quellarray zu duplizieren:

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

### Signalknoten

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
| `timeout` | string/number | Positive Zeitangabe oder positive endliche Millisekundenzahl; bei Ablauf entsteht `{ timeout = true, code = "SIGNAL_TIMEOUT" }` |
| `inputs` | table | Eingabeanforderungen |
| `input_transform` | string/table | Transformiert Inputs, bevor der Knoten sie erhält |
| `metadata` | table | Knoten-Metadaten |

Senden Sie das Signal von außerhalb des Workflows über die Client-API (siehe `client:signal()` unten).

#### Verhalten

Der Knoten gibt mit `wait_for_signal = true` die Ausführung ab und persistiert diesen Yield im Workflow-Zustand. Der Orchestrator nimmt den Knoten wieder auf, wenn ein passender `NODE_SIGNAL`-Commit eintrifft.

- `client:signal()` speichert ausgelassene, `nil`- oder `false`-Daten als `{}`. Dieses leere Objekt erfüllt den Yield ebenso wie erhaltene Werte, etwa `0` und `""`.
- Ein Signal-Yield blockiert `COMPLETE_WORKFLOW`, aber nicht andere ausstehende Knoten — parallele Zweige werden weiter ausgeführt, während ein Zweig wartet.
- `client:signal()` reiht das Signal dauerhaft ein und fordert die Aktivierung des Workflows an. Erreicht das Signal den Workflow, bevor der Knoten seinen Yield erreicht, wird es beim Erfassen des Yields zugestellt; ein separater Aufruf von `:start()` ist nicht erforderlich.
- Nur ein Signal erfüllt jeden Yield. Wenn ein zweites Signal mit derselben `signal_id` eintrifft, bevor der Yield erfüllt ist, überschreibt es das erste.
- Teilen mehrere aktive Yields dieselbe `signal_id`, empfängt ein passender Yield die Daten; welcher, ist nicht festgelegt. Verwenden Sie eindeutige IDs, wenn der Empfänger relevant ist.
- Wird `signal_id` ausgelassen, entsteht eine UUID v7, die der Builder nicht zurückgibt. Legen Sie für über die Client-API zugestellte Signale eine explizite, stabile ID fest.
- Die zugestellten Signaldaten werden als Signal-Payload an die Ausgabe des Knotens übergeben.

#### Dauerhaftigkeit und Wiederherstellung

Der Signal-Yield ist Teil des Workflow-Zustands und wird über denselben Outbox-Mechanismus wie jedes andere Kommando persistiert. Wenn der Orchestrator-Prozess während des Wartens beendet wird:

- Der ausstehende Yield wird beim Neustart wiederhergestellt.
- Während des Ausfalls zugestellte Signale werden in die Warteschlange gestellt und beim erneuten Laden des Zustands angewendet.
- Verbund-Pipelines (`func → signal → signal → func`) erholen sich schrittweise — jedes Signal kann über einen separaten Neustart hinweg zugestellt werden.

Verwaiste Signal-Yields (Yields, deren Elternprozess ohne Abschluss beendet wurde) werden vom Process-Exit-Handler des Workflow-Zustands bereinigt.

#### Pipeline-Muster

Signal-Knoten können in jeder Topologie verwendet werden. Ergänzen Sie die
Client-Bindung neben dem oben gezeigten Import `flow`:

```yaml
imports:
  client: userspace.dataflow:client
```

```lua
local client = require("client")
local c, client_err = client.new()
if client_err then return nil, client_err end

-- Human-in-the-loop approval between two functions
local approval_id, start_err = flow.create()
    :with_input({ draft_id = "draft-123" })
    :func("app:draft")
    :signal({ signal_id = "approve_draft" })
    :func("app:publish")
    :start()
if start_err then return nil, start_err end

local _, signal_err = c:signal(approval_id, "approve_draft", { approved = true })
if signal_err then return nil, signal_err end

-- Two parallel approvals that must both arrive before release
local release_id, release_err = flow.create()
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
    :start()
if release_err then return nil, release_err end

local _, legal_err = c:signal(release_id, "legal_ok", { approved_by = "legal" })
if legal_err then return nil, legal_err end

local _, finance_err = c:signal(release_id, "finance_ok", { approved_by = "finance" })
if finance_err then return nil, finance_err end
```

Gespeicherte Signaldaten stehen als Knotenausgabe bereit. Nachgelagerte Knoten erhalten die übermittelte Payload; ausgelassene, `nil`- oder `false`-Daten werden jedoch zu `{}` normalisiert.

### Join-Knoten

Sammelt mehrere Eingaben, bevor die Ausführung fortgesetzt wird:

```lua
:join({
    inputs = { required = { "source1", "source2" } },
    output_mode = "object",
    ignored_keys = { "triggered" }
})
```

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `output_mode` | string | `"object"` (Standard) oder `"array"` (Ankunftsreihenfolge) |
| `ignored_keys` | array | Eingabeschlüssel, die von der Ausgabe ausgeschlossen werden |
| `inputs` | table | Eingabeanforderungen |
| `input_transform` | string/table | Eingaben vor dem Zusammenführen transformieren |
| `metadata` | table | Knotenmetadaten |

## Templates

Vorlagen definieren wiederverwendbare Unter-Workflows. Erstellen Sie eine Vorlage mit `flow.template()` und fügen Sie sie mit `:use()` ein:

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

Beim Kompilieren fügt die Vorlage ihre Operationen in den übergeordneten Flow ein.

## Verschachtelte Workflows

In Zyklen und Parallelknoten verwendete Funktionen können einen untergeordneten Workflow starten, indem sie `flow.create():run()` zurückgeben:

```lua
function my_processor(input)
    return flow.create()
        :with_input(input)
        :func("app:step_a")
        :func("app:step_b")
        :run()
end
```

Wird `:run()` in einem vorhandenen Dataflow-Kontext ausgeführt, liefert es `{ _control = { commands = [...] } }`, statt den Workflow direkt auszuführen. Der Orchestrator verarbeitet den untergeordneten Workflow über den Yield-Mechanismus.

<note>
Eine Funktion, die einen untergeordneten Workflow starten soll, muss <code>flow.create():run()</code> zurückgeben. Andere Dataflow-Funktionen dürfen gewöhnliche Ergebnisse liefern.
</note>

## Synchrone und asynchrone Ausführung

`:run()` führt den Workflow synchron aus. Normalerweise liefert es die abschließende Workflow-Ausgabe. Eine dauerhafte Wartebedingung kann die Ausführung jedoch zuvor passivieren; dann enthält das Ergebnis neben der Workflow-ID sowohl `pending = true` als auch `passivated = true`.

```lua
local result, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :run()
```

`:start()` liefert sofort eine Workflow-ID zurück:

```lua
local dataflow_id, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :start()
```

In verschachtelten Kontexten ist `:start()` nicht zulässig.

## Client API

Verwenden Sie die Client-API zur programmgesteuerten Verwaltung von Workflows:

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
| `client.new()` | Client erstellen; erfordert den aktuellen Security Actor und Scope |
| `:create_workflow(commands, options?)` | Workflow erstellen; liefert `dataflow_id` |
| `:execute(dataflow_id, options?)` | Synchron ausführen; liefert das Ergebnis |
| `:start(dataflow_id, options?)` | Asynchron ausführen; liefert `dataflow_id` |
| `:output(dataflow_id)` | Workflow-Ausgaben abrufen |
| `:get_status(dataflow_id)` | Aktuellen Status abrufen |
| `:cancel(dataflow_id, timeout?)` | Kontrolliert abbrechen (Standard: 30 s) |
| `:terminate(dataflow_id)` | Sofort beenden |
| `:signal(dataflow_id, signal_id, data?)` | Externes Signal an einen wartenden Signalknoten liefern |
| `:revive(dataflow_id)` | Aktivierung eines nicht abgeschlossenen Workflows anfordern |

## Workflow-Status

| Status | Beschreibung |
|--------|-------------|
| `pending` | Erstellt, aber noch nicht ausgeführt |
| `running` | Workflow-Ausführung ist aktiv |
| `waiting` | Passiviert und wartet auf ein dauerhaftes Ereignis wie ein Signal |
| `completed` | Erfolgreich abgeschlossen |
| `failed` | Fehlgeschlagen |
| `cancelled` | Vom Benutzer abgebrochen |
| `terminated` | Sofort beendet |

Knoten besitzen einen eigenen Lebenszyklus. Aktuelle Knotenübergänge verwenden `template`, `pending`, `running`, `waiting`, `completed`, `failed` und `cancelled`. `ready` wird beim Laden als Workflow-Aktivierungsstatus akzeptiert. `paused`, `skipped` und `terminated` auf Knotenebene bleiben als Kompatibilitätswerte erkannt, werden von aktuellen Knotenübergängen aber nicht geschrieben.

## Metadata

```lua
flow.create()
    :with_title("Document Processing Pipeline")
    :with_metadata({ source = "api", priority = "high" })
    :with_input({ document_id = "doc-123" })
    :func("app:process", { metadata = { title = "Process Document" } })
    :run()
```

Ohne Angabe lautet der Titel standardmäßig "Flow Builder Workflow".

## Validierungsregeln

Der Compiler validiert den Workflow-Graphen vor der Ausführung:

- Alle Namen aus `:as(name)` müssen eindeutig sein.
- Alle Ziele von `:to()` und `:error_to()` müssen vorhandene Namen referenzieren; ausgenommen sind `@success` und `@fail`.
- Der Graph muss azyklisch sein.
- Alle Knoten benötigen eine eingehende Route von einem anderen Knoten, der Workflow-Eingabe oder statischen Daten.
- `:cycle()` erfordert entweder `func_id` oder `template`, nicht beides.
- `:parallel()` erfordert `source_array_key` und `template`.
- Mindestens ein Pfad muss zu `@success` führen oder eine automatische Ausgabe besitzen.
- Bei Knoten darf `:when()` nur auf `:to()` oder `:error_to()` folgen, nicht auf statische Daten.
- Knoten mit `args` oder einem `input_transform` in Zeichenkettenform können keine Eingaben mit dem Diskriminator `"default"` empfangen.

## Ausdrucksreferenz

Ausdrücke verwenden die Syntax des Moduls `expr`. Sie steht in `:when()`-Bedingungen und in Werten von `input_transform` zur Verfügung.

**Operatoren:** `+`, `-`, `*`, `/`, `%`, `**`, `&`, `|`, `^`, `<<`, `>>`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`, `in`, `contains`, `startsWith`, `endsWith`

**Array-Funktionen:** `all()`, `any()`, `none()`, `one()`, `filter()`, `map()`, `count()`, `len()`, `first()`, `last()`

**Mathematische Funktionen:** `max()`, `min()`, `abs()`, `ceil()`, `floor()`, `round()`, `sqrt()`, `pow()`

**Zeichenkettenfunktionen:** `len()`, `upper()`, `lower()`, `trim()`, `split()`, `join()`

**Typfunktionen:** `type()`, `int()`, `float()`, `string()`

**Literale:** Zahlen, Zeichenketten, boolesche Werte (`true`/`false`), Null (`nil`), Arrays (`[1, 2, 3]`) und Objekte (`{key: value}`)

**Ternärer Ausdruck:** `output.age >= 18 ? output.verified : false`

**Optionale Verkettung:** `output.data?.nested?.value`

## Fehlerbehandlung

Sowohl `:run()` als auch `:start()` folgen den üblichen Lua-Fehlerkonventionen:

- Erfolg: `data, nil` bei `run` beziehungsweise `dataflow_id, nil` bei `start`
- Fehler: `nil, error_message`

Zu den Fehlerkategorien gehören Kompilierungsfehler, Client-Fehler, Fehler beim Erstellen oder Ausführen eines Workflows sowie fehlgeschlagene Workflows.

## Siehe auch

- [Agenten](framework/agents.md) – Agenten-Framework für Agentenknoten
- [LLM](framework/llm.md) – von Agenten verwendete Modellschnittstelle
- [Framework-Überblick](framework/overview.md) – Framework-Module installieren und importieren
