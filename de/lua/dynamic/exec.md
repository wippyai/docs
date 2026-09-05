---
title: "Befehlsausführung"
description: "Führen Sie externe Befehle und Shell-Skripte mit voller Kontrolle über I/O-Streams aus."
---

# Befehlsausführung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Führen Sie externe Befehle und Shell-Skripte mit voller Kontrolle über I/O-Streams aus.

Für Executor-Konfiguration siehe [Executor](system/exec.md).

## Laden

```lua
local exec = require("exec")
```

## Einen Executor beschaffen

Holen Sie eine Prozess-Executor-Ressource nach ID:

```lua
local executor, err = exec.get("app:exec")
if err then
    return nil, err
end

-- Executor verwenden
local proc = executor:exec("ls -la")
-- ...

-- Freigeben wenn fertig
executor:release()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Ressourcen-ID |

**Gibt zurück:** `Executor, error`

## Einen Prozess erstellen

Erstellen Sie einen neuen Prozess mit dem angegebenen Befehl:

```lua
-- Einfacher Befehl
local proc, err = executor:exec("echo 'Hello, World!'")

-- Mit Arbeitsverzeichnis
local proc = executor:exec("npm install", {
    work_dir = "/app/project"
})

-- Mit Umgebungsvariablen
local proc = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})

-- Shell-Skript ausführen
local proc = executor:exec("./deploy.sh production", {
    work_dir = "/app/scripts",
    env = {
        DEPLOY_ENV = "production"
    }
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `cmd` | string | Ausführbare Datei und literale Argumente |
| `options.work_dir` | string | Arbeitsverzeichnis |
| `options.env` | table | Umgebungsvariablen |
| `options.pty` | table | Ein Pseudoterminal für den Kindprozess allokieren |

**Gibt zurück:** `Process, error`

Der Prozess wird erstellt, aber nicht gestartet.

### Befehlszerlegung

`cmd` wird mit shell-ähnlichem Quoting in eine ausführbare Datei und literale Argumente zerlegt: Einfache und doppelte Anführungszeichen gruppieren ein Wort, und ein Backslash escaped das folgende Zeichen. Es gibt keine Shell, also finden weder Variablenexpansion noch Globbing, Pipes oder Umleitungen statt. Ein nicht geschlossenes Anführungszeichen gibt `errors.INVALID` zurück.

```lua
-- Ein Argument mit Leerzeichen, literal übergeben
local proc = executor:exec("grep 'hello world' notes.txt")

-- $HOME wird als die fünf Zeichen $HOME übergeben, nicht expandiert
local proc = executor:exec("echo $HOME")
```

Um Shell-Funktionen zu nutzen, wird eine Shell explizit aufgerufen:

```lua
local proc = executor:exec("/bin/sh -c 'ls *.log | wc -l'")
```

### PTY-Optionen

Das Allokieren eines PTY gibt dem Kindprozess ein echtes Terminal: Zeileneditierung, Job Control und Vollbildprogramme funktionieren wie in einer Shell.

```lua
local proc = executor:exec("/bin/bash --noprofile --norc", {
    pty = {width = 100, height = 30, term = "xterm-256color"},
})
```

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `width` | number | 80 | Anfängliche PTY-Spalten, 1 bis 65535 |
| `height` | number | 24 | Anfängliche PTY-Zeilen, 1 bis 65535 |
| `term` | string | keiner | `TERM`-Wert des Kindprozesses |

Breite mal Höhe darf 262.144 Zellen nicht überschreiten. Ein PTY-gestützter Prozess führt die Ausgabe des Kindprozesses zu einem einzigen Terminal-Stream zusammen; er wird über [resize](#resize) und [attach_terminal](#attach_terminal) gesteuert statt über die stdin/stdout-Pipe-Methoden.

## start / wait

Starten Sie den Prozess und warten Sie auf Abschluss.

```lua
local proc = executor:exec("./build.sh")

local ok, err = proc:start()
if err then
    return nil, err
end

local exit_code, err = proc:wait()
if err then
    return nil, err
end

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", "Build failed with exit code: " .. exit_code)
end
```

## stdout_stream / stderr_stream

Holen Sie Streams zum Lesen der Prozessausgabe.

```lua
local proc = executor:exec("./process-data.sh")

local stdout = proc:stdout_stream()
local stderr = proc:stderr_stream()

proc:start()

-- Alle stdout lesen
local output = {}
while true do
    local chunk = stdout:read(4096)
    if not chunk then break end
    table.insert(output, chunk)
end
local result = table.concat(output)

-- Auf Fehler prüfen
local err_output = {}
while true do
    local chunk = stderr:read(4096)
    if not chunk then break end
    table.insert(err_output, chunk)
end

local exit_code = proc:wait()

stdout:close()
stderr:close()

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", table.concat(err_output))
end

return result
```

## write_stdin

Schreiben Sie Daten an Prozess-stdin.

```lua
local proc = executor:exec("head -n 3")
local stdout = proc:stdout_stream()

proc:start()

proc:write_stdin("banana\napple\ncherry\n")

local lines = stdout:read()

proc:wait()
stdout:close()
```

Jeder Aufruf schreibt die angegebenen Bytes und kehrt zurück. Es gibt keine Methode, die stdin schließt: Es bleibt für die Lebensdauer des Prozesses offen, sodass ein Befehl, der bis zum Eingabeende liest, wie etwa `sort`, nie ein EOF sieht und erst endet, wenn der Prozess ein Signal erhält oder geschlossen wird. Wählen Sie einen Befehl, der von sich aus aufhört zu lesen, wie es `head -n 3` tut, oder führen Sie einen Befehl, der EOF braucht, hinter einer Shell-Pipeline aus, die seine Eingabe liefert.

## signal / close

Senden Sie Signale oder geben Sie den Prozess frei.

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... später, muss gestoppt werden ...

-- SIGTERM senden und das Handle freigeben
proc:close()

-- SIGKILL senden und das Handle freigeben
proc:close(true)

-- Oder ein bestimmtes Signal senden und das Handle behalten
local SIGINT = 2
proc:signal(SIGINT)
```

`close(force?)` sendet einem gestarteten Kindprozess `SIGTERM`, oder `SIGKILL`, wenn `force` wahr ist, und reapt ihn dann im Hintergrund, sodass der Aufruf nicht blockiert. Ein Kindprozess, der nach einer Gnadenfrist noch läuft, wird gekillt, damit das Reaping immer abschließt. Ein nicht gestartetes Handle wird einfach ungültig gemacht, und zweimaliges Schließen ist kein Fehler.

Das Reaping schließt die stdout- und stderr-Pipes des Kindprozesses, also sollte jede benötigte Ausgabe vor dem Aufruf von `close()` gelesen werden. Danach meldet jede Methode des Prozesses, `wait()` eingeschlossen, `process closed` — wenn der Exit-Code wichtig ist, stattdessen `signal()` und `wait()` verwenden.

## resize

Ändert die Größe des PTY eines PTY-gestützten Prozesses. Ein Pipe-gestützter Prozess gibt einen Fehler zurück.

```lua
local ok, err = proc:resize(120, 40)
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `width` | number | Spalten, 1 bis 65535 |
| `height` | number | Zeilen, 1 bis 65535 |

**Gibt zurück:** `boolean, error`

Damit wird die anfängliche Geometrie gesetzt, bevor der Prozess an eine Terminal-Session übergeben wird. Sobald eine Session den Prozess besitzt, wird ihr stattdessen ein `resize`-Ereignis gesendet.

## attach_terminal

Hängt einen nicht gestarteten PTY-gestützten Prozess an das Terminal des aufrufenden Prozesses an und gibt eine `TerminalSession` zurück.

```lua
local exec = require("exec")
local tty = require("tty")

local executor = assert(exec.get("app:exec"))
local proc = assert(executor:exec("/bin/bash --noprofile --norc", {
    pty = {term = "xterm-256color"},
}))
local session = assert(proc:attach_terminal())
```

**Gibt zurück:** `TerminalSession, error`

Der Aufruf verbraucht den Prozess: Die Session wird sein alleiniger Lebenszyklus-Eigentümer, und das ursprüngliche Handle kann nicht mehr verwendet werden. Die Session öffnet eine Surface auf dem aktuellen Terminal-Port und übernimmt PTY-Emulation, Eingabekodierung, Größenänderung, geordnete und erzwungene Beendigung sowie das Reaping. Sie benötigt einen Terminal-Port — einen Prozess auf einem [Terminal-Host](system/terminal.md) oder einen mit einem [Viewport-Grant](lua/system/tty.md#viewport) gespawnten Prozess — und schlägt fehl, wenn der Port keinen Eingabecontroller hat oder bereits eine offene Surface besitzt.

### TerminalSession

| Methode | Gibt zurück | Beschreibung |
|---------|-------------|--------------|
| `send(event)` | `boolean, error` | Ein kanonisches TTY-Ereignis an den Kindprozess weiterleiten |
| `done()` | channel | Kanal, der einmal auslöst, wenn der Kindprozess endet |
| `status()` | `string, error` | `"running"` oder `"done"`, mit dem Fehler, falls er fehlgeschlagen ist |
| `close()` | `boolean, error` | Beendigung eines laufenden Kindprozesses anfordern |

`send` akzeptiert die in [TTY](lua/system/tty.md#event-types) beschriebenen Key-, Mouse-, Resize-, Focus- und Paste-Datensätze. Ein Senden, nachdem der Kindprozess beendet ist, gibt einen Fehler zurück.

```lua
local channel = require("channel")

local events = assert(tty.events())
assert(tty.start())
local done = session:done()

while true do
    local selected = channel.select({
        events:case_receive(),
        done:case_receive(),
    })
    if not selected.ok or selected.channel == done then break end
    if selected.value.type == "close" then break end
    assert(session:send(selected.value))
end

assert(session:close())
```

## Berechtigungen

Exec-Operationen unterliegen der Sicherheitsrichtlinienauswertung.

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `exec.get` | Executor-ID | Executor-Ressource beschaffen |
| `exec.run` | Befehl | Einen bestimmten Befehl ausführen |

`exec.run` wird gegen die rohe Befehlszeichenkette ausgewertet, mit den angeforderten Optionen als Metadaten:

| Schlüssel | Typ | Beschreibung |
|-----------|-----|--------------|
| `work_dir` | string | Angefordertes Arbeitsverzeichnis, leer wenn nicht gesetzt |
| `env_names` | string[] | Namen der übergebenen Umgebungsvariablen, sortiert; Werte werden nicht offengelegt |
| `pty.requested` | boolean | Ob ein PTY angefordert wurde |
| `pty.width` | number | Aufgelöste PTY-Spalten, vorhanden wenn angefordert |
| `pty.height` | number | Aufgelöste PTY-Zeilen, vorhanden wenn angefordert |
| `pty.term` | string | Angeforderter `TERM`-Wert, vorhanden wenn angefordert |

Eine Policy kann damit einfache Befehle erlauben und zugleich diejenigen einschränken, die ein Terminal oder ein bestimmtes Arbeitsverzeichnis anfordern.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ungültige ID | `errors.INVALID` | nein |
| Berechtigung verweigert | `errors.INVALID` | nein |
| Prozess geschlossen | `errors.INVALID` | nein |
| Prozess nicht gestartet | `errors.INVALID` | nein |
| Bereits gestartet | `errors.INVALID` | nein |
| Nicht geschlossenes Anführungszeichen im Befehl | `errors.INVALID` | nein |
| Kein PTY am Prozess | `errors.INVALID` | nein |
| Terminal-Port nicht verfügbar | `errors.UNAVAILABLE` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.

## Siehe auch

- [Executor](system/exec.md) — Executor-Konfiguration
- [TTY](lua/system/tty.md) — Terminal-Ereignisse, Surfaces und Viewports
- [Terminal-UI](tutorials/tty.md) — eine Shell, die einen PTY-Kindprozess in einem Viewport hostet
