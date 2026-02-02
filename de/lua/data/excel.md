# Excel-Tabellen
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

Lesen und schreiben Sie Microsoft Excel-Dateien (.xlsx). Erstellen Sie Arbeitsmappen, verwalten Sie Tabellenblätter, lesen Sie Zellwerte und generieren Sie Berichte mit Formatierungsunterstützung.

## Laden

```lua
local excel = require("excel")
```

## Arbeitsmappen erstellen

### Neue Arbeitsmappe

Erstellt eine neue leere Excel-Arbeitsmappe.

```lua
local wb, err = excel.new()
if err then
    return nil, err
end

-- Tabellenblätter erstellen und Daten hinzufügen
wb:new_sheet("Report")
wb:set_cell_value("Report", "A1", "Title")

wb:close()
```

**Gibt zurück:** `Workbook, error`

### Arbeitsmappe öffnen

Öffnet eine Excel-Arbeitsmappe von einem Reader-Objekt.

```lua
local fs = require("fs")

local vol, err = fs.get("app:data")
if err then
    return nil, err
end

local file, err = vol:open("/reports/sales.xlsx", "r")
if err then
    return nil, err
end

local wb, err = excel.open(file)
if err then
    file:close()
    return nil, err
end

-- Daten aus Arbeitsmappe lesen
local rows = wb:get_rows("Sheet1")
for i, row in ipairs(rows) do
    print("Row " .. i .. ": " .. table.concat(row, ", "))
end

wb:close()
file:close()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `reader` | File | Muss io.Reader implementieren (z.B. fs.File) |

**Gibt zurück:** `Workbook, error`

## Tabellenblatt-Operationen

### Tabellenblatt erstellen

Erstellt ein neues Tabellenblatt oder gibt den Index eines existierenden zurück.

```lua
local wb = excel.new()

-- Tabellenblätter erstellen
local idx1 = wb:new_sheet("Summary")
local idx2 = wb:new_sheet("Details")
local idx3 = wb:new_sheet("Charts")

-- Wenn Tabellenblatt existiert, gibt seinen Index zurück
local existing = wb:new_sheet("Summary")  -- gibt gleichen Wert wie idx1 zurück
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Tabellenblattname |

**Gibt zurück:** `integer, error`

### Tabellenblätter auflisten

Gibt Liste aller Tabellenblattnamen in der Arbeitsmappe zurück.

```lua
local wb = excel.new()
wb:new_sheet("Sales")
wb:new_sheet("Expenses")
wb:new_sheet("Summary")

local sheets = wb:get_sheet_list()
-- sheets = {"Sheet1", "Sales", "Expenses", "Summary"}

for _, name in ipairs(sheets) do
    print("Sheet:", name)
end
```

**Gibt zurück:** `string[], error`

## Zellen-Operationen

### Zellwert setzen

Setzt den Wert einer einzelnen Zelle.

```lua
local wb = excel.new()
wb:new_sheet("Data")

-- Verschiedene Werttypen setzen
wb:set_cell_value("Data", "A1", "Product Name")  -- string
wb:set_cell_value("Data", "B1", "Price")         -- string
wb:set_cell_value("Data", "C1", "In Stock")      -- string

wb:set_cell_value("Data", "A2", "Widget")
wb:set_cell_value("Data", "B2", 29.99)           -- number
wb:set_cell_value("Data", "C2", true)            -- boolean

wb:set_cell_value("Data", "A3", "Gadget")
wb:set_cell_value("Data", "B3", 49.99)
wb:set_cell_value("Data", "C3", false)

-- Zellreferenzen unterstützen Spalten über Z hinaus
wb:set_cell_value("Data", "AA1", "Extended Column")
wb:set_cell_value("Data", "AB100", "Far cell")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sheet` | string | Tabellenblattname |
| `cell` | string | Zellreferenz ("A1", "B2", "AA100") |
| `value` | any | string, integer, number oder boolean |

**Gibt zurück:** `error`

### Alle Zeilen abrufen

Holt alle Zeilen von einem Tabellenblatt als 2D-Array.

```lua
local wb = excel.new()
wb:new_sheet("Report")
wb:set_cell_value("Report", "A1", "Name")
wb:set_cell_value("Report", "B1", "Score")
wb:set_cell_value("Report", "A2", "Alice")
wb:set_cell_value("Report", "B2", 95)
wb:set_cell_value("Report", "A3", "Bob")
wb:set_cell_value("Report", "B3", 87)

local rows, err = wb:get_rows("Report")
if err then
    return nil, err
end

-- rows[1] = {"Name", "Score"}
-- rows[2] = {"Alice", "95"}
-- rows[3] = {"Bob", "87"}

for i, row in ipairs(rows) do
    if i == 1 then
        print("Headers:", row[1], row[2])
    else
        print("Data:", row[1], "scored", row[2])
    end
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `sheet` | string | Tabellenblattname |

**Gibt zurück:** `string[][], error`

Alle Zellwerte werden als Strings zurückgegeben. Booleans als "TRUE" oder "FALSE", Zahlen als String-Darstellung.

## Datei-Operationen

### In Datei schreiben

Schreibt Arbeitsmappe in ein Writer-Objekt.

```lua
local fs = require("fs")
local wb = excel.new()

-- Bericht erstellen
wb:new_sheet("Monthly Report")
wb:set_cell_value("Monthly Report", "A1", "Month")
wb:set_cell_value("Monthly Report", "B1", "Revenue")
wb:set_cell_value("Monthly Report", "A2", "January")
wb:set_cell_value("Monthly Report", "B2", 45000)
wb:set_cell_value("Monthly Report", "A3", "February")
wb:set_cell_value("Monthly Report", "B3", 52000)

-- In Datei schreiben
local vol, err = fs.get("app:output")
if err then
    wb:close()
    return nil, err
end

local file, err = vol:open("/reports/monthly.xlsx", "w")
if err then
    wb:close()
    return nil, err
end

local err = wb:write_to(file)
file:close()
wb:close()

if err then
    return nil, err
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `writer` | File | Muss io.Writer implementieren (z.B. fs.File) |

**Gibt zurück:** `error`

### Arbeitsmappe schließen

Schließt Arbeitsmappe und gibt Ressourcen frei.

```lua
local wb = excel.new()
-- ... mit Arbeitsmappe arbeiten ...
wb:close()

-- Sicher mehrfach aufzurufen
wb:close()
```

**Gibt zurück:** `error`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Kein Kontext | `errors.INTERNAL` | nein |
| Ungültige Arbeitsmappe | `errors.INVALID` | nein |
| Arbeitsmappe geschlossen | `errors.INTERNAL` | nein |
| Kein Reader/Writer | `errors.INTERNAL` | nein |
| Ungültige Excel-Datei | `errors.INTERNAL` | nein |
| Nicht existierendes Tabellenblatt | `errors.INTERNAL` | nein |
| Ungültige Zellreferenz | `errors.INTERNAL` | nein |
| Schreiben fehlgeschlagen | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.

## Siehe auch

- [Dateisystem](lua-fs.md) - Dateioperationen zum Lesen/Schreiben von Excel-Dateien
