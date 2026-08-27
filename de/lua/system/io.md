---
title: "Terminal-I/O"
description: "Terminaleingaben lesen und in Standardausgabe und Standardfehler schreiben."
---

# Terminal-I/O
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Das Modul `io` liest in Terminalanwendungen aus der Standardeingabe und schreibt in Standardausgabe und Standardfehler.

Diese Seite ist eine API-Referenz. Ihre Ausschnitte sind einzelne Aufrufe; beeinflusst das Ergebnis den Kontrollfluss, sollte ein Terminalprozess zurückgegebene strukturierte Lua-Fehler weiterreichen.

<note>
Dieses Modul ist nur für Prozesse verfügbar, die auf einem <a href="../../system/terminal.md">Terminal-Host</a> laufen, nicht für reguläre Funktionen.
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
| `...` | any | Variable Anzahl von Werten zum Schreiben (zu string gecastet) |

**Gibt zurück:** `boolean, error`

## Print mit Zeilenumbruch

Schreibt Werte zu stdout mit Tabs dazwischen und Zeilenumbruch am Ende:

```lua
io.print("value1", "value2", 123)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `...` | any | Variable Anzahl von Werten zum Ausgeben |

**Gibt zurück:** `boolean, error`

Nach erfolgreicher Ermittlung des Terminalkontexts werden Schreibfehler ignoriert und die Funktion liefert `true`. Fehlt der Terminalkontext, lautet das Ergebnis `nil, "no terminal context"`.

## Schreiben zu Stderr

Schreibt Werte zu stderr mit Tabs dazwischen und Zeilenumbruch am Ende:

```lua
io.eprint("Error:", message)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `...` | any | Variable Anzahl von Werten zum Ausgeben |

**Gibt zurück:** `boolean, error`

Nach erfolgreicher Ermittlung des Terminalkontexts werden Schreibfehler ignoriert und die Funktion liefert `true`. Fehlt der Terminalkontext, lautet das Ergebnis `nil, "no terminal context"`.

## Bytes lesen

Liest bis zu n Bytes von stdin:

```lua
local data, err = io.read(1024)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `n` | integer | Anzahl der zu lesenden Bytes (Standard: 1024, Werte <= 0 werden zu 1024) |

**Gibt zurück:** `string, error`. Ein erfolgreicher Lesevorgang kann weniger als `n` Bytes oder eine leere Zeichenkette liefern.

## Zeile lesen

Liest eine Zeile aus der Standardeingabe:

```lua
local line, err = io.readline()
```

**Gibt zurück:** `string, error`. Abschließende Zeichen `\n` und `\r` werden entfernt. EOF nach einer Teileingabe liefert diese Teilzeile; EOF ohne Eingabe liefert `nil` und einen strukturierten Fehler.

## Raw-Modus

Aktiviert oder deaktiviert den Raw-Terminal-Modus (deaktiviert Zeilenpufferung und Echo):

```lua
local ok, err = io.raw(true)   -- enable
local ok, err = io.raw(false)  -- disable
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `enable` | boolean | `true` zum Aktivieren, `false` zum Deaktivieren (Standard: `true`) |

**Gibt zurück:** `boolean, error`

Der Raw-Modus ist referenzgezählt: Jeder Aufruf von `io.raw(true)` muss durch `io.raw(false)` ausgeglichen werden. Beim Prozessende kehrt das Terminal automatisch in den Normalmodus zurück.

## Ausgabe flushen

Flusht den stdout-Puffer:

```lua
local ok, err = io.flush()
```

**Gibt zurück:** `boolean, error`. Unterstützt die Standardausgabe `Sync()` nicht, ist der Aufruf ein erfolgreiches No-op.

## Kommandozeilenargumente

Holt Kommandozeilenargumente:

```lua
local args = io.args()
```

**Gibt zurück:** `string[]`

`io.args()` schlägt nie fehl. Ohne Terminalkontext liefert es eine leere Tabelle.

## Fehler

Dieses Modul gibt strukturierte Lua-Fehler zurück. Ein fehlender Terminalkontext verwendet `errors.UNAVAILABLE`; direkte Schreib-/Flush-Fehler und ungültige Yield-Antworten verwenden `errors.INTERNAL`. Dispatcher-gestützte Fehler von Lesen, Readline und Raw-Modus bewahren vorhandene Fehlermetadaten. `io.args()` besitzt keinen Fehler-Rückgabewert.
