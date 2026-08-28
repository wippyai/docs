---
title: "OS-Zeit"
description: "Runtime-Zeit lesen, Datumswerte formatieren und Zeitdifferenzen über die globale Lua-Tabelle os berechnen."
---

# OS-Zeit
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Die globale Tabelle `os` stellt Zeitstempel, Datumsformatierung, Messung verstrichener Zeit und Berechnung von Zeitdifferenzen bereit. In einem Workflow verwenden Abfragen der aktuellen Zeit dessen Zeitreferenz; außerhalb eines Workflows verwenden sie die Systemuhr.

Diese Seite ist eine API-Referenz. Zeitstempelliterale und formatierte Ausgaben dienen nur der Veranschaulichung; aktuelle Werte hängen von Runtime- oder Workflow-Uhr und Zeitzone ab.

## Laden

Die Tabelle `os` ist global und muss nicht mit `require` geladen werden.

```lua
os.time()
os.date()
os.clock()
os.difftime()
```

## Zeitstempel abrufen

Unix-Zeitstempel abrufen (Sekunden seit 1. Jan 1970 UTC):

```lua
-- Current timestamp
local now = os.time()  -- 1718462445

-- Specific date/time
local t = os.time({
    year = 2024,
    month = 12,
    day = 25,
    hour = 10,
    min = 30,
    sec = 0
})
```

**Signatur:** `os.time([spec]) -> number`

**Parameter:**

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `year` | number | aktuelles Jahr | Vierstelliges Jahr (z.B. 2024) |
| `month` | number | aktueller Monat | Monat 1-12 |
| `day` | number | aktueller Tag | Tag des Monats 1-31 |
| `hour` | number | 0 | Stunde 0-23 |
| `min` | number | 0 | Minute 0-59 |
| `sec` | number | 0 | Sekunde 0-59 |

Ohne Argumente aufgerufen, gibt den aktuellen Unix-Zeitstempel zurück.

Mit einer Tabelle aufgerufen, verwendet jedes fehlende Feld die oben gezeigten Standards. Die Felder `year`, `month` und `day` verwenden standardmäßig das aktuelle Datum, wenn nicht angegeben.

```lua
-- Just date (time defaults to midnight)
os.time({year = 2024, month = 6, day = 15})

-- Partial (fills in current year/month)
os.time({day = 1})  -- first of current month
```

## Datum formatieren

Zeitstempel als String formatieren oder Datums-Tabelle zurückgeben:

<code-block lang="lua">
local now = os.time()

-- Standardformat
os.date()  -- "Sat Jun 15 14:30:45 2024"

-- Benutzerdefiniertes Format
os.date("%Y-%m-%d", now)           -- "2024-06-15"
os.date("%H:%M:%S", now)           -- "14:30:45"
os.date("%Y-%m-%dT%H:%M:%S", now)  -- "2024-06-15T14:30:45"

-- UTC-Zeit (Format mit ! voranstellen)
os.date("!%Y-%m-%d %H:%M:%S", now)  -- UTC statt lokal

-- Datums-Tabelle
local t = os.date("*t", now)
</code-block>

**Signatur:** `os.date([format], [timestamp]) -> string | table`

| Parameter | Typ | Standard | Beschreibung |
|-----------|------|---------|-------------|
| `format` | string | `"%c"` | Format-String, `"*t"` für Tabelle |
| `timestamp` | number | aktuelle Zeit | Unix-Zeitstempel zum Formatieren |

### Format-Spezifikatoren

| Code | Ausgabe | Beispiel |
|------|--------|---------|
| `%Y` | 4-stelliges Jahr | 2024 |
| `%y` | 2-stelliges Jahr | 24 |
| `%m` | Monat (01-12) | 06 |
| `%d` | Tag (01-31) | 15 |
| `%H` | Stunde 24h (00-23) | 14 |
| `%I` | Stunde 12h (01-12) | 02 |
| `%M` | Minute (00-59) | 30 |
| `%S` | Sekunde (00-59) | 45 |
| `%p` | AM/PM | PM |
| `%A` | Wochentagsname | Saturday |
| `%a` | Wochentag kurz | Sat |
| `%B` | Monatsname | June |
| `%b` | Monat kurz | Jun |
| `%w` | Wochentag (0-6, Sonntag=0) | 6 |
| `%j` | Tag des Jahres (001-366) | 167 |
| `%U` | ISO-8601-Wochennummer (01-53, Woche beginnt Montag) | 24 |
| `%W` | ISO-8601-Wochennummer (01-53, Woche beginnt Montag) | 24 |
| `%z` | Zeitzonenoffset | -0700 |
| `%Z` | Zeitzonenname | PDT |
| `%c` | Volles Datum/Uhrzeit | Sat Jun 15 14:30:45 2024 |
| `%x` | Nur Datum | 06/15/24 |
| `%X` | Nur Uhrzeit | 14:30:45 |
| `%%` | Literales % | % |

### Datums-Tabelle

Wenn Format `"*t"` ist, gibt eine Tabelle zurück:

```lua
local t = os.date("*t")
```

| Feld | Typ | Beschreibung | Beispiel |
|-------|------|-------------|---------|
| `year` | number | Vierstelliges Jahr | 2024 |
| `month` | number | Monat (1-12) | 6 |
| `day` | number | Tag des Monats (1-31) | 15 |
| `hour` | number | Stunde (0-23) | 14 |
| `min` | number | Minute (0-59) | 30 |
| `sec` | number | Sekunde (0-59) | 45 |
| `wday` | number | Wochentag (1-7, Sonntag=1) | 7 |
| `yday` | number | Tag des Jahres (1-366) | 167 |
| `isdst` | boolean | In dieser Version `true`, wenn der UTC-Offset der Zone ungleich null ist; kein verlässlicher DST-Indikator | false |

Verwenden Sie `"!*t"` für UTC-Datums-Tabelle.

## Verstrichene Zeit messen

Liest die Sekunden zwischen der aktuellen Runtime-Zeitreferenz und dem Initialisierungszeitpunkt des OS-Zeitmoduls:

```lua
local start = os.clock()

-- do work
for i = 1, 1000000 do end

local elapsed = os.clock() - start
print(string.format("Took %.3f seconds", elapsed))
```

**Signatur:** `os.clock() -> number`

Anders als die CPU-Zeitdefinition von Standard-Lua basiert diese Implementierung auf verstrichener Zeit. In Workflows verwendet sie die Workflow-Zeitreferenz.

## Zeitdifferenz

Differenz zwischen zwei Zeitstempeln in Sekunden abrufen:

```lua
local t1 = os.time({year = 2024, month = 1, day = 1})
local t2 = os.time({year = 2024, month = 12, day = 31})

local diff = os.difftime(t2, t1)  -- t2 - t1
local days = diff / 86400
print(days)  -- 365
```

**Signatur:** `os.difftime(t2, t1) -> number`

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `t2` | number | Späterer Zeitstempel |
| `t1` | number | Früherer Zeitstempel |

Gibt `t2 - t1` in Sekunden zurück. Kann negativ sein wenn `t1 > t2`.

## Plattform-Konstante

Die Konstante `os.platform` identifiziert die Runtime:

```lua
os.platform  -- "wippy"
```
