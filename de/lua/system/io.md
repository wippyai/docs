# Terminal-I/O
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Lesen von stdin und Schreiben zu stdout/stderr fur CLI-Anwendungen.

<note>
Dieses Modul funktioniert nur im Terminal-Kontext. Sie konnen es nicht aus regularen Funktionen verwenden—nur aus Prozessen, die auf einem <a href="system-terminal.md">Terminal-Host</a> laufen.
</note>

## Laden

```lua
local io = require("io")
```

## Schreiben zu Stdout

Schreibt Strings zu stdout ohne Zeilenumbruch:

```lua
local ok, err = io.write("text", "more")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `...` | string | Variable Anzahl von Strings zum Schreiben |

**Gibt zuruck:** `boolean, error`

## Print mit Zeilenumbruch

Schreibt Werte zu stdout mit Tabs dazwischen und Zeilenumbruch am Ende:

```lua
io.print("value1", "value2", 123)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `...` | any | Variable Anzahl von Werten zum Ausgeben |

**Gibt zuruck:** `boolean, error`

## Schreiben zu Stderr

Schreibt Werte zu stderr mit Tabs dazwischen und Zeilenumbruch am Ende:

```lua
io.eprint("Error:", message)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `...` | any | Variable Anzahl von Werten zum Ausgeben |

**Gibt zuruck:** `boolean, error`

## Bytes lesen

Liest bis zu n Bytes von stdin:

```lua
local data, err = io.read(1024)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `n` | integer | Anzahl der zu lesenden Bytes (Standard: 1024, Werte <= 0 werden zu 1024) |

**Gibt zuruck:** `string, error`

## Zeile lesen

Liest eine Zeile von stdin bis zum Zeilenumbruch:

```lua
local line, err = io.readline()
```

**Gibt zuruck:** `string, error`

## Ausgabe flushen

Flusht den stdout-Puffer:

```lua
local ok, err = io.flush()
```

**Gibt zuruck:** `boolean, error`

## Kommandozeilenargumente

Holt Kommandozeilenargumente:

```lua
local args = io.args()
```

**Gibt zuruck:** `string[]`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Kein Terminal-Kontext | `errors.UNAVAILABLE` | nein |
| Schreiboperation fehlgeschlagen | `errors.INTERNAL` | nein |
| Leseoperation fehlgeschlagen | `errors.INTERNAL` | nein |
| Flush-Operation fehlgeschlagen | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) fur die Arbeit mit Fehlern.
