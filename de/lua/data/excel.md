---
title: "Excel-Tabellen"
description: "Microsoft-Excel-XLSX-Arbeitsmappen erstellen, öffnen, lesen, streamen, ändern und schreiben."
---

# Excel-Tabellen
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

Das Modul `excel` erstellt und liest Microsoft-Excel-Arbeitsmappen im Format `.xlsx`, verwaltet Tabellenblätter und Zellen und schreibt Arbeitsmappen in streamkompatible Dateien.

Diese Seite ist eine API-Referenz mit partiellen Rezepten für Arbeitsmappen und Dateisystemzugriff. Längere E/A-Beispiele zeigen die explizite Bereinigung; isolierte Methodenbeispiele lassen das abschließende Schließen der Arbeitsmappe aus. Produktionscode sollte den primären Operationsfehler bewahren und dennoch die erforderliche Bereinigung versuchen.

## Laden

```lua
local excel = require("excel")
```

Fügen Sie `excel` zur `modules:`-Liste des ausführbaren Eintrags hinzu, bevor Sie das Modul laden. Dateisystemrezepte benötigen zusätzlich `fs`.

## Arbeitsmappen erstellen und öffnen

### Arbeitsmappe erstellen

Erstellt eine Arbeitsmappe mit dem standardmäßigen Tabellenblatt `Sheet1`.

```lua
local wb, err = excel.new()
if err then
    return nil, err
end

-- Create sheets and add data
local _, sheet_err = wb:new_sheet("Report")
if sheet_err then
    wb:close()
    return nil, sheet_err
end
local set_err = wb:set_cell_value("Report", "A1", "Title")
if set_err then
    wb:close()
    return nil, set_err
end

local close_err = wb:close()
if close_err then return nil, close_err end
```

**Rückgabewerte:** `Workbook, error`

### Arbeitsmappe öffnen

Öffnet eine Arbeitsmappe aus einem Reader-Objekt.

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
    local _ = file:close()
    return nil, err
end

-- Read data from workbook
local rows, rows_err = wb:get_rows("Sheet1")
if rows_err then
    local _ = wb:close()
    local _ = file:close()
    return nil, rows_err
end
for i, row in ipairs(rows) do
    print("Row " .. i .. ": " .. table.concat(row, ", "))
end

local wb_close_err = wb:close()
local file_close_err = file:close()
if wb_close_err then return nil, wb_close_err end
if file_close_err then return nil, file_close_err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `reader` | File | Muss io.Reader implementieren (z.B. fs.File) |

**Rückgabewerte:** `Workbook, error`

## Tabellenblatt-Operationen

### Tabellenblatt erstellen

Erstellt ein Tabellenblatt oder gibt den Index eines vorhandenen Tabellenblatts mit demselben Namen zurück.

```lua
local wb, err = excel.new()
if err then return nil, err end

-- Create sheets
local idx1, err = wb:new_sheet("Summary")
if err then return nil, err end
local idx2, err = wb:new_sheet("Details")
if err then return nil, err end
local idx3, err = wb:new_sheet("Charts")
if err then return nil, err end

-- If sheet exists, returns its index
local existing, err = wb:new_sheet("Summary")  -- returns same as idx1
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Tabellenblattname |

**Rückgabewerte:** `integer, error`. Tabellenblattindizes beginnen bei 1.

### Tabellenblätter auflisten

Gibt Liste aller Tabellenblattnamen in der Arbeitsmappe zurück.

```lua
local wb, err = excel.new()
if err then return nil, err end
for _, name in ipairs({"Sales", "Expenses", "Summary"}) do
    local _, sheet_err = wb:new_sheet(name)
    if sheet_err then return nil, sheet_err end
end

local sheets, list_err = wb:get_sheet_list()
if list_err then return nil, list_err end
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
local wb, err = excel.new()
if err then return nil, err end
local _, sheet_err = wb:new_sheet("Data")
if sheet_err then return nil, sheet_err end

-- Set different value types
local cells = {
    {"A1", "Product Name"}, {"B1", "Price"}, {"C1", "In Stock"},
    {"A2", "Widget"}, {"B2", 29.99}, {"C2", true},
    {"A3", "Gadget"}, {"B3", 49.99}, {"C3", false},
    {"AA1", "Extended Column"}, {"AB100", "Far cell"}
}
for _, cell in ipairs(cells) do
    local set_err = wb:set_cell_value("Data", cell[1], cell[2])
    if set_err then return nil, set_err end
end
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
local wb, err = excel.new()
if err then return nil, err end
local _, sheet_err = wb:new_sheet("Report")
if sheet_err then return nil, sheet_err end
for _, cell in ipairs({
    {"A1", "Name"}, {"B1", "Score"},
    {"A2", "Alice"}, {"B2", 95},
    {"A3", "Bob"}, {"B3", 87}
}) do
    local set_err = wb:set_cell_value("Report", cell[1], cell[2])
    if set_err then return nil, set_err end
end

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

### Zeilen streamen

`wb:rows(sheet)` öffnet einen Cursor, der Tabellenblattzeilen inkrementell dekodiert, während `get_rows` das vollständige Blatt materialisiert. Beim Öffnen der Arbeitsmappe wird weiterhin die vollständige XLSX-Eingabe gelesen; Metadaten der Arbeitsmappe und gemeinsam genutzte Strings können im Speicher bleiben. Der Vorgang arbeitet daher nicht durchgehend mit konstantem Speicher:

```lua
local cursor, err = wb:rows("Report")
if err then
    return nil, err
end

while true do
    local batch, err = cursor:read(500)
    if err then
        local _ = cursor:close()
        return nil, err
    end
    if not batch then
        break                       -- end of sheet
    end
    for _, row in ipairs(batch) do
        process(row)
    end
end
local close_err = cursor:close()
if close_err then return nil, close_err end
```

| Methode | Beschreibung |
|---------|--------------|
| `cursor:read(n?)` | Den nächsten Batch von bis zu `n` Zeilen lesen (Standard 1, max 10000). Gibt `string[][], error` zurück; `nil, nil` am Blattende |
| `cursor:close()` | Cursor freigeben (idempotent; Cursor schließen auch mit der Arbeitsmappe) |

Zellwerte werden identisch zu `get_rows` formatiert. Leere Zeilen kommen als leere Tabellen zurück, und abschließende leere Zeilen bleiben erhalten statt abgeschnitten zu werden. Nach dem Blattende oder einem Fehler geben nachfolgende Reads weiterhin denselben Zustand zurück.

## Datei-Operationen

### In Datei schreiben

Schreibt Arbeitsmappe in ein Writer-Objekt.

```lua
local fs = require("fs")
local wb, err = excel.new()
if err then return nil, err end

-- Build report
local _, sheet_err = wb:new_sheet("Monthly Report")
if sheet_err then
    wb:close()
    return nil, sheet_err
end
for _, cell in ipairs({
    {"A1", "Month"}, {"B1", "Revenue"},
    {"A2", "January"}, {"B2", 45000},
    {"A3", "February"}, {"B3", 52000}
}) do
    local set_err = wb:set_cell_value("Monthly Report", cell[1], cell[2])
    if set_err then
        wb:close()
        return nil, set_err
    end
end

-- Write to file
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

local write_err = wb:write_to(file)
local file_close_err = file:close()
local wb_close_err = wb:close()
if write_err then return nil, write_err end
if file_close_err then return nil, file_close_err end
if wb_close_err then return nil, wb_close_err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `writer` | File | Muss io.Writer implementieren (z.B. fs.File) |

**Gibt zurück:** `error`

`write_to` schließt den Writer nicht. Schließen Sie die Datei separat wie im Beispiel.

### Als Bytes serialisieren

Serialisiert die Arbeitsmappe als vollständige `.xlsx`-Datei in einen binären Lua-String:

```lua
local data, err = wb:bytes()
if err then
    return nil, err
end

-- For example, return `data` in an HTTP response or upload it to object storage.
```

**Rückgabewerte:** `string, error`

Die Arbeitsmappe bleibt nach `bytes()` geöffnet und verwendbar. Die vollständige Datei wird im Speicher materialisiert; verwenden Sie für große Arbeitsmappen `write_to`, wenn ein Writer verfügbar ist.

### Arbeitsmappe schließen

Schließt Arbeitsmappe und gibt Ressourcen frei.

```lua
local wb, err = excel.new()
if err then return nil, err end
-- ... work with workbook ...
local close_err = wb:close()
if close_err then return nil, close_err end

-- Safe to call multiple times
local second_close_err = wb:close()
if second_close_err then return nil, second_close_err end
```

**Gibt zurück:** `error`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Kein Kontext in `new` oder `open` | `errors.INTERNAL` | nein |
| Ungültige oder leere Excel-Datei in `open` | `errors.INTERNAL` | nein |
| Ungültiger Workbook-Receiver in `new_sheet`, `get_sheet_list`, `get_rows`, `rows` oder `bytes` | `errors.INVALID` | nein |
| Ungültiger Workbook-Receiver in `set_cell_value`, `write_to` oder `close` | `errors.INTERNAL` | nein |
| Geschlossene Arbeitsmappe in `rows` | `errors.INVALID` | nein |
| Geschlossene Arbeitsmappe in anderen Workbook-Operationen | `errors.INTERNAL` | nein |
| Fehler beim Erstellen eines Tabellenblatts | `errors.INTERNAL` | nein |
| Fehlendes Tabellenblatt in `rows` | `errors.INVALID` | nein |
| Fehlendes Tabellenblatt in `get_rows` oder `set_cell_value` | `errors.INTERNAL` | nein |
| Ungültige Zellreferenz | `errors.INTERNAL` | nein |
| Ungültiger Writer oder Schreibfehler | `errors.INTERNAL` | nein |
| Ungültiger oder geschlossener Zeilencursor in `read` oder Batch-Größe unter 1 | `errors.INVALID` | nein |
| Ungültiger Zeilencursor in `close` | `errors.INTERNAL` | nein |
| Fehler beim Lesen einer Zeile, Schließen eines Cursors oder Abbruch des Kontexts | `errors.INTERNAL` | nein |

Wird ein Wert, der kein `io.Reader` ist, an `open` oder ein Wert, der kein Userdata ist, an `write_to` übergeben, entsteht ein Lua-Argumentfehler statt eines strukturierten Fehlers. Writer-Userdata ohne Implementierung von `io.Writer` gibt `errors.INTERNAL` zurück. Ein Zeilenbatch über 10.000 wird auf 10.000 begrenzt und nicht abgelehnt.

Das Schließen einer Arbeitsmappe schließt auch ihre offenen Zeilencursor. Arbeitsmappen werden bei der Bereinigung ihres Lua-Ausführungskontexts automatisch geschlossen; explizite `close()`-Aufrufe geben Ressourcen früher frei.

Siehe [Fehlerbehandlung](../core/errors.md) für die Arbeit mit Fehlern.

## Siehe auch

- [Dateisystem](../storage/filesystem.md) - Dateioperationen zum Lesen und Schreiben von Excel-Dateien
