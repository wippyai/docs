# OS-Zeit
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Standard-Lua-`os`-Zeitfunktionen. Liefert echte Wanduhrzeit fur Zeitstempel, Datumsformatierung und Zeitberechnungen.

## Laden

Globale `os`-Tabelle. Kein require erforderlich.

```lua
os.time()
os.date()
os.clock()
os.difftime()
```

## Zeitstempel abrufen

Unix-Zeitstempel abrufen (Sekunden seit 1. Jan 1970 UTC):

```lua
-- Aktueller Zeitstempel
local now = os.time()  -- 1718462445

-- Spezifisches Datum/Uhrzeit
local t = os.time({
    year = 2024,
    month = 12,
    day = 25,
    hour = 10,
    min = 30,
    sec = 0
})
```

**Signatur:** `os.time([spec]) -> integer`

**Parameter:**

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `year` | integer | aktuelles Jahr | Vierstelliges Jahr (z.B. 2024) |
| `month` | integer | aktueller Monat | Monat 1-12 |
| `day` | integer | aktueller Tag | Tag des Monats 1-31 |
| `hour` | integer | 0 | Stunde 0-23 |
| `min` | integer | 0 | Minute 0-59 |
| `sec` | integer | 0 | Sekunde 0-59 |

Ohne Argumente aufgerufen, gibt den aktuellen Unix-Zeitstempel zuruck.

Mit einer Tabelle aufgerufen, verwendet jedes fehlende Feld die oben gezeigten Standards. Die Felder `year`, `month` und `day` verwenden standardmassig das aktuelle Datum, wenn nicht angegeben.

```lua
-- Nur Datum (Uhrzeit standardmassig Mitternacht)
os.time({year = 2024, month = 6, day = 15})

-- Teilweise (fullt aktuelles Jahr/Monat aus)
os.time({day = 1})  -- erster des aktuellen Monats
```

## Datum formatieren

Zeitstempel als String formatieren oder Datums-Tabelle zuruckgeben:

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
| `format` | string | `"%c"` | Format-String, `"*t"` fur Tabelle |
| `timestamp` | integer | aktuelle Zeit | Unix-Zeitstempel zum Formatieren |

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
| `%U` | Wochennummer (00-53) | 24 |
| `%z` | Zeitzonenoffset | -0700 |
| `%Z` | Zeitzonenname | PDT |
| `%c` | Volles Datum/Uhrzeit | Sat Jun 15 14:30:45 2024 |
| `%x` | Nur Datum | 06/15/24 |
| `%X` | Nur Uhrzeit | 14:30:45 |
| `%%` | Literales % | % |

### Datums-Tabelle

Wenn Format `"*t"` ist, gibt eine Tabelle zuruck:

```lua
local t = os.date("*t")
```

| Feld | Typ | Beschreibung | Beispiel |
|-------|------|-------------|---------|
| `year` | integer | Vierstelliges Jahr | 2024 |
| `month` | integer | Monat (1-12) | 6 |
| `day` | integer | Tag des Monats (1-31) | 15 |
| `hour` | integer | Stunde (0-23) | 14 |
| `min` | integer | Minute (0-59) | 30 |
| `sec` | integer | Sekunde (0-59) | 45 |
| `wday` | integer | Wochentag (1-7, Sonntag=1) | 7 |
| `yday` | integer | Tag des Jahres (1-366) | 167 |
| `isdst` | boolean | Sommerzeit | false |

Verwenden Sie `"!*t"` fur UTC-Datums-Tabelle.

## Verstrichene Zeit messen

Sekunden seit Lua-Runtime-Start abrufen:

```lua
local start = os.clock()

-- Arbeit ausfuhren
for i = 1, 1000000 do end

local elapsed = os.clock() - start
print(string.format("Took %.3f seconds", elapsed))
```

**Signatur:** `os.clock() -> number`

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
| `t2` | integer | Spaterer Zeitstempel |
| `t1` | integer | Fruherer Zeitstempel |

Gibt `t2 - t1` in Sekunden zuruck. Kann negativ sein wenn `t1 > t2`.

## Plattform-Konstante

Konstante zur Identifizierung der Laufzeit:

```lua
os.platform  -- "wippy"
```
