---
title: "Hojas de cálculo de Excel"
description: "Crea, abre, lee, procesa por streaming, modifica y escribe libros XLSX de Microsoft Excel."
---

# Hojas de cálculo de Excel
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

El módulo `excel` crea y lee libros `.xlsx` de Microsoft Excel, administra hojas y celdas y escribe libros en archivos compatibles con streams.

Esta es una referencia de API con recetas parciales de libros y sistemas de archivos. Los ejemplos de E/S más extensos muestran la limpieza explícita; los ejemplos de métodos aislados omiten la limpieza final del libro. El código de producción debe conservar el error de la operación principal y, aun así, intentar la limpieza necesaria.

## Carga

```lua
local excel = require("excel")
```

Añade `excel` a la lista `modules:` de la entrada ejecutable antes de requerirlo. Las recetas de sistema de archivos también requieren `fs`.

## Creación y apertura de libros

### Creación de un libro

Crea un libro con la hoja predeterminada `Sheet1`:

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

**Devuelve:** `Workbook, error`

### Apertura de un libro

Abre un libro desde un objeto reader:

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `reader` | File | Debe implementar io.Reader (por ejemplo, fs.File) |

**Devuelve:** `Workbook, error`

## Operaciones con hojas

### Creación de una hoja

Crea una hoja o devuelve el índice de una hoja existente con el mismo nombre:

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre de hoja |

**Devuelve:** `integer, error`. Los índices de hoja empiezan en 1.

### Listado de hojas

Devuelve los nombres de todas las hojas del libro:

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

**Devuelve:** `string[], error`

## Operaciones con celdas

### Establecimiento del valor de una celda

Establece el valor de una celda:

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sheet` | string | Nombre de hoja |
| `cell` | string | Referencia de celda ("A1", "B2", "AA100") |
| `value` | any | string, integer, number o boolean |

**Devuelve:** `error`

### Obtención de todas las filas

Lee todas las filas de una hoja en un array bidimensional:

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sheet` | string | Nombre de hoja |

**Devuelve:** `string[][], error`

Todos los valores de celda se devuelven como cadenas. Los booleanos usan `"TRUE"` o `"FALSE"`, y los números su representación como cadena.

### Streaming de filas

`wb:rows(sheet)` abre un cursor que decodifica las filas de la hoja de forma incremental, mientras que `get_rows` materializa toda la hoja. Al abrir el libro se sigue leyendo toda la entrada XLSX y pueden conservarse metadatos del libro y cadenas compartidas, por lo que el proceso no usa memoria constante de principio a fin:

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

| Método | Descripción |
|--------|-------------|
| `cursor:read(n?)` | Lee el siguiente lote de hasta `n` filas (por defecto 1, máximo 10000). Devuelve `string[][], error`; `nil, nil` al final de la hoja |
| `cursor:close()` | Libera el cursor (idempotente; los cursores también se cierran con el libro de trabajo) |

Los valores de celda se formatean de forma idéntica a `get_rows`. Las filas vacías se devuelven como tablas vacías, y las filas vacías finales se preservan en lugar de recortarse. Tras el final de la hoja o un error, las lecturas posteriores siguen devolviendo ese mismo estado.

## Operaciones con archivos

### Escritura en un archivo

Escribe un libro en un objeto writer:

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `writer` | File | Debe implementar io.Writer (por ejemplo, fs.File) |

**Devuelve:** `error`

`write_to` no cierra el writer. Cierra el archivo por separado, como en el ejemplo.

### Serialización a bytes

Serializa el libro como un archivo `.xlsx` completo en una cadena binaria Lua:

```lua
local data, err = wb:bytes()
if err then
    return nil, err
end

-- For example, return `data` in an HTTP response or upload it to object storage.
```

**Devuelve:** `string, error`

El libro permanece abierto y puede seguir usándose después de `bytes()`. El archivo completo se materializa en memoria; para libros grandes, usa `write_to` cuando haya un writer disponible.

### Cierre de un libro

Cierra un libro y libera sus recursos:

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

**Devuelve:** `error`

## Errores

| Condición | Clase | Reintentable |
|-----------|------|--------------|
| No hay contexto en `new` u `open` | `errors.INTERNAL` | no |
| Archivo Excel no válido o vacío en `open` | `errors.INTERNAL` | no |
| Receptor de libro no válido en `new_sheet`, `get_sheet_list`, `get_rows`, `rows` o `bytes` | `errors.INVALID` | no |
| Receptor de libro no válido en `set_cell_value`, `write_to` o `close` | `errors.INTERNAL` | no |
| Libro cerrado en `rows` | `errors.INVALID` | no |
| Libro cerrado en otras operaciones | `errors.INTERNAL` | no |
| Error al crear la hoja | `errors.INTERNAL` | no |
| Falta la hoja en `rows` | `errors.INVALID` | no |
| Falta la hoja en `get_rows` o `set_cell_value` | `errors.INTERNAL` | no |
| Referencia de celda no válida | `errors.INTERNAL` | no |
| Writer no válido o error de escritura | `errors.INTERNAL` | no |
| Cursor de filas no válido o cerrado en `read`, o tamaño de lote inferior a 1 | `errors.INVALID` | no |
| Cursor de filas no válido en `close` | `errors.INTERNAL` | no |
| Error de lectura de filas, cierre del cursor o cancelación del contexto | `errors.INTERNAL` | no |

Pasar a `open` un valor que no sea un `io.Reader`, o a `write_to` un valor que no sea userdata, genera un error de argumento Lua en lugar de devolver un error estructurado. Un userdata de writer que no implementa `io.Writer` devuelve `errors.INTERNAL`. Un lote de filas mayor que 10 000 se limita a 10 000 en lugar de rechazarse.

Al cerrar un libro también se cierran sus cursores de filas abiertos. Los libros se cierran automáticamente cuando se limpia su contexto de ejecución Lua, pero las llamadas explícitas a `close()` liberan antes los recursos.

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.

## Véase también

- [Sistema de archivos](lua/storage/filesystem.md) - Operaciones para leer y escribir archivos de Excel
