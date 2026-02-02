# Tree-sitter-Parsing
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Parsen Sie Quellcode in konkrete Syntaxbäume mit [Tree-sitter](https://tree-sitter.github.io/tree-sitter/). Basiert auf [go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter) Bindings.

Tree-sitter produziert Syntaxbäume, die:
- Die vollständige Struktur des Quellcodes repräsentieren
- Inkrementell aktualisiert werden, wenn sich Code ändert
- Robust gegenüber Syntaxfehlern sind (partielles Parsing)
- Musterbasierte Abfragen mit S-Ausdrücken unterstützen

## Laden

```lua
local treesitter = require("treesitter")
```

## Unterstützte Sprachen

| Sprache | Aliase | Root-Node |
|----------|---------|-----------|
| Go | `go`, `golang` | `source_file` |
| JavaScript | `js`, `javascript` | `program` |
| TypeScript | `ts`, `typescript` | `program` |
| TSX | `tsx` | `program` |
| Python | `python`, `py` | `module` |
| Lua | `lua` | `chunk` |
| PHP | `php` | `program` |
| C# | `csharp`, `cs`, `c#` | `compilation_unit` |
| HTML | `html`, `html5` | `document` |
| Markdown | `markdown`, `md` | `document` |
| SQL | `sql` | - |

```lua
local langs = treesitter.supported_languages()
-- {go = true, javascript = true, python = true, ...}
```

## Schnellstart

### Code parsen

```lua
local code = [[
func hello() {
    return "Hello!"
}
]]

local tree, err = treesitter.parse("go", code)
if err then
    return nil, err
end

local root = tree:root_node()
print(root:kind())        -- "source_file"
print(root:child_count()) -- Anzahl Top-Level-Deklarationen
```

### Syntaxbaum abfragen

```lua
local code = [[
func hello() {}
func world() {}
]]

local tree = treesitter.parse("go", code)
local root = tree:root_node()

-- Alle Funktionsnamen finden
local query = treesitter.query("go", [[
    (function_declaration name: (identifier) @func_name)
]])

local captures = query:captures(root, code)
for _, capture in ipairs(captures) do
    print(capture.name, capture.text)
end
-- "func_name"  "hello"
-- "func_name"  "world"
```

## Parsing

### Einfaches Parsing

Quellcode in einen Syntaxbaum parsen. Erstellt intern einen temporären Parser.

```lua
local tree, err = treesitter.parse("go", code)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `language` | string | Sprachname oder Alias |
| `code` | string | Quellcode |

**Gibt zurück:** `Tree, error`

### Wiederverwendbarer Parser

Erstellen Sie einen Parser für wiederholtes Parsing oder inkrementelle Updates.

```lua
local parser = treesitter.parser()
parser:set_language("go")

local tree1 = parser:parse("package main")

-- Inkrementelles Parsing mit altem Baum
local tree2 = parser:parse("package main\nfunc foo() {}", tree1)

parser:close()
```

**Gibt zurück:** `Parser`

### Parser-Methoden

| Methode | Beschreibung |
|--------|-------------|
| `set_language(lang)` | Parser-Sprache setzen, gibt `boolean, error` zurück |
| `get_language()` | Aktuellen Sprachnamen abrufen |
| `parse(code, old_tree?)` | Code parsen, optional mit altem Baum für inkrementelles Parsing |
| `set_timeout(duration)` | Parse-Timeout setzen (String wie `"1s"` oder Nanosekunden) |
| `set_ranges(ranges)` | Byte-Bereiche zum Parsen setzen |
| `reset()` | Parser-Zustand zurücksetzen |
| `close()` | Parser-Ressourcen freigeben |

## Syntaxbäume

### Root-Node abrufen

```lua
local tree = treesitter.parse("go", "package main")
local root = tree:root_node()

print(root:kind())  -- "source_file"
print(root:text())  -- "package main"
```

### Tree-Methoden

| Methode | Beschreibung |
|--------|-------------|
| `root_node()` | Root-Node des Baums abrufen |
| `root_node_with_offset(bytes, point)` | Root mit angewendetem Offset abrufen |
| `language()` | Sprachobjekt des Baums abrufen |
| `copy()` | Tiefe Kopie des Baums erstellen |
| `walk()` | Cursor für Traversierung erstellen |
| `edit(edit_table)` | Inkrementelle Bearbeitung anwenden |
| `changed_ranges(other_tree)` | Geänderte Bereiche abrufen |
| `included_ranges()` | Beim Parsing eingeschlossene Bereiche abrufen |
| `dot_graph()` | DOT-Graph-Repräsentation abrufen |
| `close()` | Tree-Ressourcen freigeben |

### Inkrementelles Bearbeiten

Aktualisieren Sie den Baum, wenn sich Quellcode ändert:

```lua
local code = "func main() { x := 1 }"
local tree = treesitter.parse("go", code)

-- Bearbeitung markieren: "1" zu "100" geändert bei Byte 19
tree:edit({
    start_byte = 19,
    old_end_byte = 20,
    new_end_byte = 22,
    start_row = 0,
    start_column = 19,
    old_end_row = 0,
    old_end_column = 20,
    new_end_row = 0,
    new_end_column = 22
})

-- Mit bearbeitetem Baum neu parsen (schneller als vollständiges Parsing)
local parser = treesitter.parser()
parser:set_language("go")
local new_tree = parser:parse("func main() { x := 100 }", tree)
```

## Nodes

Nodes repräsentieren Elemente im Syntaxbaum.

### Node-Typen

```lua
local node = root:child(0)

-- Typinformationen
print(node:kind())        -- "package_clause"
print(node:type())        -- gleich wie kind()
print(node:is_named())    -- true für signifikante Nodes
print(node:grammar_name()) -- Grammatik-Regelname
```

### Navigation

```lua
-- Kinder
local child = node:child(0)           -- nach Index (0-basiert)
local named = node:named_child(0)     -- nur benannte Kinder
local count = node:child_count()
local named_count = node:named_child_count()

-- Geschwister
local next = node:next_sibling()
local prev = node:prev_sibling()
local next_named = node:next_named_sibling()
local prev_named = node:prev_named_sibling()

-- Eltern
local parent = node:parent()

-- Nach Feldname
local name_node = func_decl:child_by_field_name("name")
local field = node:field_name_for_child(0)
```

### Positionsinformationen

```lua
-- Byte-Offsets
local start = node:start_byte()
local end_ = node:end_byte()

-- Zeile/Spalte-Positionen (0-basiert)
local start_pt = node:start_point()  -- {row = 0, column = 0}
local end_pt = node:end_point()      -- {row = 0, column = 12}

-- Quelltext
local text = node:text()
```

### Fehlererkennung

```lua
if root:has_error() then
    -- Baum enthält Syntaxfehler
end

if node:is_error() then
    -- Dieser spezifische Node ist ein Fehler
end

if node:is_missing() then
    -- Parser hat diesen zur Fehlerwiederherstellung eingefügt
end
```

### S-Ausdruck

```lua
local sexp = node:to_sexp()
-- "(source_file (package_clause (package_identifier)))"
```

## Queries

Musterabgleich mit Tree-sitters Abfragesprache (S-Ausdrücke).

### Query erstellen

```lua
local query, err = treesitter.query("go", [[
    (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
    )
]])
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `language` | string | Sprachname |
| `pattern` | string | Query-Muster in S-Ausdruck-Syntax |

**Gibt zurück:** `Query, error`

### Query ausführen

```lua
-- Alle Captures abrufen (flach)
local captures = query:captures(root, source_code)
for _, capture in ipairs(captures) do
    print(capture.name)   -- "@func_name"
    print(capture.text)   -- tatsächlicher Text
    print(capture.index)  -- Capture-Index
    -- capture.node ist das Node-Objekt
end

-- Matches abrufen (nach Muster gruppiert)
local matches = query:matches(root, source_code)
for _, match in ipairs(matches) do
    print(match.id, match.pattern)
    for _, capture in ipairs(match.captures) do
        print(capture.name, capture.node:text())
    end
end
```

### Query-Steuerung

```lua
-- Query-Bereich begrenzen
query:set_byte_range(0, 1000)
query:set_point_range({row = 0, column = 0}, {row = 10, column = 0})

-- Matches begrenzen
query:set_match_limit(100)
if query:did_exceed_match_limit() then
    -- Mehr Matches existieren
end

-- Timeout (String-Dauer oder Nanosekunden)
query:set_timeout("500ms")
query:set_timeout(1000000000)  -- 1 Sekunde in Nanosekunden

-- Muster/Captures deaktivieren
query:disable_pattern(0)
query:disable_capture("func_name")
```

### Query-Inspektion

```lua
local pattern_count = query:pattern_count()
local capture_count = query:capture_count()
local name = query:capture_name_for_id(0)
local id = query:capture_index_for_name("func_name")
```

## Tree-Cursor

Effiziente Traversierung ohne Node-Objekte bei jedem Schritt zu erstellen.

### Grundlegende Traversierung

```lua
local cursor = tree:walk()

-- Bei Root starten
print(cursor:current_node():kind())  -- "source_file"
print(cursor:current_depth())        -- 0

-- Navigieren
if cursor:goto_first_child() then
    print(cursor:current_node():kind())
    print(cursor:current_depth())  -- 1
end

if cursor:goto_next_sibling() then
    -- zum nächsten Geschwister gewechselt
end

cursor:goto_parent()  -- zurück zum Eltern

cursor:close()
```

### Cursor-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `current_node()` | `Node` | Node an Cursor-Position |
| `current_depth()` | `integer` | Tiefe (0 = Root) |
| `current_field_name()` | `string?` | Feldname falls vorhanden |
| `goto_parent()` | `boolean` | Zum Eltern wechseln |
| `goto_first_child()` | `boolean` | Zum ersten Kind wechseln |
| `goto_last_child()` | `boolean` | Zum letzten Kind wechseln |
| `goto_next_sibling()` | `boolean` | Zum nächsten Geschwister wechseln |
| `goto_previous_sibling()` | `boolean` | Zum vorherigen Geschwister wechseln |
| `goto_first_child_for_byte(n)` | `integer?` | Zum Kind wechseln, das Byte enthält |
| `goto_first_child_for_point(pt)` | `integer?` | Zum Kind wechseln, das Punkt enthält |
| `reset(node)` | - | Cursor auf Node zurücksetzen |
| `copy()` | `Cursor` | Kopie des Cursors erstellen |
| `close()` | - | Ressourcen freigeben |

## Sprach-Metadaten

```lua
local lang = treesitter.language("go")

print(lang:version())           -- ABI-Version
print(lang:node_kind_count())   -- Anzahl Node-Typen
print(lang:field_count())       -- Anzahl Felder

-- Node-Kind-Lookup
local kind = lang:node_kind_for_id(1)
local id = lang:id_for_node_kind("identifier", true)
local is_named = lang:node_kind_is_named(1)

-- Feld-Lookup
local field_name = lang:field_name_for_id(1)
local field_id = lang:field_id_for_name("name")
```

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Sprache nicht unterstützt | `errors.INVALID` | nein |
| Sprache hat kein Binding | `errors.INVALID` | nein |
| Ungültiges Query-Muster | `errors.INVALID` | nein |
| Ungültige Positionen | `errors.INVALID` | nein |
| Parsing fehlgeschlagen | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.

## Query-Syntax-Referenz

Tree-sitter-Queries verwenden S-Ausdruck-Muster:

```
; Node-Typ matchen
(identifier)

; Mit Feldnamen matchen
(function_declaration name: (identifier))

; Mit @name capturen
(function_declaration name: (identifier) @func_name)

; Mehrere Muster
[
  (function_declaration)
  (method_declaration)
] @declaration

; Wildcards
(_)           ; beliebiger Node
(identifier)+ ; ein oder mehr
(identifier)* ; null oder mehr
(identifier)? ; optional

; Prädikate
((identifier) @var
  (#match? @var "^_"))  ; Regex-Match
```

Siehe [Tree-sitter Query Syntax](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax) für vollständige Dokumentation.
