---
title: "Tree-sitter-Parsing"
description: "Quellcode parsen, konkrete Syntaxbäume untersuchen und Tree-sitter-Abfragen ausführen."
---

# Tree-sitter-Parsing
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Das Modul `treesitter` parst Quellcode mit [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) über die [go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter)-Bindings in konkrete Syntaxbäume.

Diese Seite ist eine API-Referenz mit Teilrezepten zum Parsen. Quellzeichenketten und Abfragemuster sind Anwendungseingaben; Ausschnitte auf Node-Ebene setzen einen aktiven Baum aus einem zuvor geprüften Parse-Vorgang voraus. Parser, Bäume, Abfragen und Cursor sind verwaltete Ressourcen: Schließen Sie jedes erfolgreich erstellte Handle, sobald die letzte davon abhängige Operation abgeschlossen ist.

Tree-sitter produziert Syntaxbäume, die:
- Die vollständige Struktur des Quellcodes repräsentieren
- Inkrementell aktualisiert werden, wenn sich Code ändert
- Robust gegenüber Syntaxfehlern sind (partielles Parsing)
- Musterbasierte Abfragen mit S-Ausdrücken unterstützen

## Laden

```lua
local treesitter = require("treesitter")
```

<note>
Das Modul `treesitter` ist optional und nur in Builds vorhanden, die das Build-Tag `treesitter` enthalten. Offizielle Wippy-Binärdateien enthalten es. Quell-Builds können `make build-wippy` oder `go build -tags treesitter` verwenden; ohne das Tag ist `require("treesitter")` nicht verfügbar.
</note>

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

local root, root_err = tree:root_node()
if root_err then
    tree:close()
    return nil, root_err
end
print(root:kind())        -- "source_file"
print(root:child_count()) -- number of top-level declarations
tree:close()
```

### Syntaxbaum abfragen

```lua
local code = [[
func hello() {}
func world() {}
]]

local tree, parse_err = treesitter.parse("go", code)
if parse_err then
    return nil, parse_err
end
local root, root_err = tree:root_node()
if root_err then
    tree:close()
    return nil, root_err
end

-- Find all function names
local query, query_err = treesitter.query("go", [[
    (function_declaration name: (identifier) @func_name)
]])
if query_err then
    tree:close()
    return nil, query_err
end

local captures, captures_err = query:captures(root, code)
if captures_err then
    query:close()
    tree:close()
    return nil, captures_err
end
for _, capture in ipairs(captures) do
    print(capture.name, capture.text)
end
-- "func_name"  "hello"
-- "func_name"  "world"
query:close()
tree:close()
```

## Parsing

### Einfaches Parsing

Parsen Sie Quellcode mit einem temporären internen Parser.

```lua
local tree, err = treesitter.parse("go", code)
if err then
    return nil, err
end
-- Use the tree, then call tree:close().
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `language` | string | Sprachname oder Alias |
| `code` | string | Quellcode |

**Gibt zurück:** `Tree, error`

### Wiederverwendbarer Parser

Erstellen Sie einen Parser für wiederholtes Parsing oder inkrementelle Updates.

```lua
local parser, parser_err = treesitter.parser()
if parser_err then
    return nil, parser_err
end
local _, language_err = parser:set_language("go")
if language_err then
    parser:close()
    return nil, language_err
end

local tree1, first_err = parser:parse("package main")
if first_err then
    parser:close()
    return nil, first_err
end

-- Parse another source with the reusable parser. For an incremental update,
-- edit the old tree first as shown in the complete recipe below.
local tree2, second_err = parser:parse("package main\nfunc foo() {}")
if second_err then
    tree1:close()
    parser:close()
    return nil, second_err
end

tree2:close()
tree1:close()
parser:close()
```

**Gibt zurück:** `Parser, error`

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

Bäume, die ein wiederverwendbarer Parser erstellt, und der Parser selbst werden unabhängig voneinander verwaltet; schließen Sie jedes erfolgreiche Handle. Nodes leihen den Speicher ihres Baums und dürfen nach dessen Schließen nicht mehr verwendet werden. Cursor leihen ebenfalls einen Baum und müssen daher vor ihm geschlossen werden. Abfragen besitzen eigene native Ressourcen und erfordern ebenfalls `close()`; schließen Sie eine Abfrage, sobald ihre Captures oder Matches nicht mehr benötigt werden. Explizite Bereinigung ist deterministisch, während der Prozess-Ressourcenspeicher lediglich eine Rückfallebene für Handles ist, die beim Prozessende noch offen sind.

## Syntaxbäume

### Root-Node abrufen

```lua
local tree, err = treesitter.parse("go", "package main")
if err then
    return nil, err
end
local root, root_err = tree:root_node()
if root_err then
    tree:close()
    return nil, root_err
end

print(root:kind())  -- "source_file"
local source_text, text_err = root:text()
if text_err then
    tree:close()
    return nil, text_err
end
print(source_text)  -- "package main"
tree:close()
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
local tree, parse_err = treesitter.parse("go", code)
if parse_err then
    return nil, parse_err
end

-- Mark edit: changed "1" to "100" at byte 19
local _, edit_err = tree:edit({
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
if edit_err then
    tree:close()
    return nil, edit_err
end

-- Re-parse with edited tree (faster than full parse)
local parser, parser_err = treesitter.parser()
if parser_err then
    tree:close()
    return nil, parser_err
end
local _, language_err = parser:set_language("go")
if language_err then
    parser:close()
    tree:close()
    return nil, language_err
end
local new_tree, new_tree_err = parser:parse("func main() { x := 100 }", tree)
if new_tree_err then
    parser:close()
    tree:close()
    return nil, new_tree_err
end

new_tree:close()
parser:close()
tree:close()
```

## Nodes

Nodes repräsentieren Elemente im Syntaxbaum. In den einzelnen Ausschnitten unten sind `root`, `node` und `func_decl` von der Anwendung ausgewählte Nodes, die von einem noch offenen Baum geliehen werden.

### Node-Typen

```lua
local node = root:child(0)

-- Type information
print(node:kind())        -- "package_clause"
print(node:type())        -- same as kind()
print(node:is_named())    -- true for significant nodes
print(node:grammar_name()) -- grammar rule name
```

### Navigation

```lua
-- Children
local child = node:child(0)           -- by index (0-based)
local named = node:named_child(0)     -- named children only
local count = node:child_count()
local named_count = node:named_child_count()

-- Siblings
local next = node:next_sibling()
local prev = node:prev_sibling()
local next_named = node:next_named_sibling()
local prev_named = node:prev_named_sibling()

-- Parent
local parent = node:parent()

-- By field name
local name_node = func_decl:child_by_field_name("name")
local field = node:field_name_for_child(0)
```

### Positionsinformationen

```lua
-- Byte offsets
local start = node:start_byte()
local end_ = node:end_byte()

-- Row/column positions (0-based)
local start_pt = node:start_point()  -- {row = 0, column = 0}
local end_pt = node:end_point()      -- {row = 0, column = 12}

-- Source text
local source_text, err = node:text()
if err then
    return nil, err
end
```

### Fehlererkennung

```lua
if root:has_error() then
    -- Tree contains syntax errors
end

if node:is_error() then
    -- This specific node is an error
end

if node:is_missing() then
    -- Parser inserted this to recover from error
end
```

### S-Ausdruck

```lua
local sexp = node:to_sexp()
-- "(source_file (package_clause (package_identifier)))"
```

## Queries

Tree-sitter-Abfragen gleichen Muster in Form von S-Ausdrücken mit Syntaxbäumen ab.

### Query erstellen

```lua
local query, err = treesitter.query("go", [[
    (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
    )
]])
if err then
    return nil, err
end
-- The owner calls query:close() after the final query operation.
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `language` | string | Sprachname |
| `pattern` | string | Query-Muster in S-Ausdruck-Syntax |

**Gibt zurück:** `Query, error`

### Query ausführen

```lua
-- Get all captures (flattened)
local captures, captures_err = query:captures(root, source_code)
if captures_err then
    query:close()
    tree:close()
    return nil, captures_err
end
for _, capture in ipairs(captures) do
    print(capture.name)   -- "func_name"
    print(capture.text)   -- actual text
    print(capture.index)  -- capture index
    -- capture.node is the Node object
end

-- Get matches (grouped by pattern)
local matches, matches_err = query:matches(root, source_code)
if matches_err then
    query:close()
    tree:close()
    return nil, matches_err
end
for _, match in ipairs(matches) do
    print(match.id, match.pattern)
    for _, capture in ipairs(match.captures) do
        local captured_text, text_err = capture.node:text()
        if text_err then
            query:close()
            tree:close()
            return nil, text_err
        end
        print(capture.name, captured_text)
    end
end

query:close()
tree:close()
```

Wenn Userdata des falschen Typs anstelle eines Tree-sitter-`Node` übergeben wird, gibt die Methode `nil, error` zurück. Bei einem primitiven Wert oder einer Tabelle wird bereits vor dieser Prüfung ein Lua-Argumentfehler ausgelöst. `root`, `source_code` und `query` müssen hier von einem noch offenen Baum und einer erfolgreich erstellten Abfrage stammen. Der Ausschnitt verwendet das besitzende `tree`-Handle, um beide Ressourcen vor der Rückkehr zu schließen.

### Query-Steuerung

```lua
-- Limit query scope
query:set_byte_range(0, 1000)
query:set_point_range({row = 0, column = 0}, {row = 10, column = 0})

-- Limit matches
query:set_match_limit(100)
if query:did_exceed_match_limit() then
    -- More matches exist
end

-- Timeout (string duration or nanoseconds)
query:set_timeout("500ms")
query:set_timeout(1000000000)  -- 1 second in nanoseconds

-- Disable patterns/captures
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

Ein Tree-Cursor durchläuft einen Baum, ohne bei jedem Schritt ein Node-Objekt zu erstellen.

### Grundlegende Traversierung

```lua
local cursor, err = tree:walk()
if err then
    return nil, err
end

-- Start at root
print(cursor:current_node():kind())  -- "source_file"
print(cursor:current_depth())        -- 0

-- Navigate
if cursor:goto_first_child() then
    print(cursor:current_node():kind())
    print(cursor:current_depth())  -- 1
end

if cursor:goto_next_sibling() then
    -- moved to next sibling
end

cursor:goto_parent()  -- back to parent

cursor:close()
```

### Cursor-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `current_node()` | `Node` | Node an Cursor-Position |
| `current_depth()` | `integer` | Tiefe (0 = Root) |
| `current_field_name()` | `string?` | Feldname falls vorhanden |
| `current_field_id()` | `integer` | Feld-ID (0 falls keine) |
| `current_descendant_index()` | `integer` | Nachfahren-Index des aktuellen Nodes |
| `goto_parent()` | `boolean` | Zum Eltern wechseln |
| `goto_first_child()` | `boolean` | Zum ersten Kind wechseln |
| `goto_last_child()` | `boolean` | Zum letzten Kind wechseln |
| `goto_next_sibling()` | `boolean` | Zum nächsten Geschwister wechseln |
| `goto_previous_sibling()` | `boolean` | Zum vorherigen Geschwister wechseln |
| `goto_descendant(index)` | - | Zum Nachfahren per Index wechseln |
| `goto_first_child_for_byte(n)` | `integer?` | Zum Kind wechseln, das Byte enthält |
| `goto_first_child_for_point(pt)` | `integer?` | Zum Kind wechseln, das Punkt enthält |
| `reset(node)` | - | Cursor auf Node zurücksetzen |
| `reset_to(cursor)` | - | Cursor auf Position eines anderen Cursors zurücksetzen |
| `copy()` | `Cursor` | Kopie des Cursors erstellen |
| `close()` | - | Ressourcen freigeben |

## Sprach-Metadaten

```lua
local lang, err = treesitter.language("go")
if err then
    return nil, err
end

print(lang:version())           -- ABI version
print(lang:node_kind_count())   -- number of node types
print(lang:field_count())       -- number of fields
print(lang:parse_state_count()) -- number of parse states

-- Node kind lookup
local kind = lang:node_kind_for_id(1)
local id = lang:id_for_node_kind("identifier", true)
local is_named = lang:node_kind_is_named(1)

-- Field lookup
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
| Kein Ausführungskontext | `errors.INTERNAL` | nein |

Das Schließen eines bereits geschlossenen Parsers, Baums, einer Abfrage oder eines Cursors ist sicher. Der Aufruf jeder anderen Methode für ein geschlossenes Handle löst einen Lua-Argumentfehler aus.

Informationen zum Umgang mit Fehlern finden Sie unter [Fehlerbehandlung](lua/core/errors.md).

## Query-Syntax-Referenz

Tree-sitter-Queries verwenden S-Ausdruck-Muster:

```
; Match a node type
(identifier)

; Match with field names
(function_declaration name: (identifier))

; Capture with @name
(function_declaration name: (identifier) @func_name)

; Multiple patterns
[
  (function_declaration)
  (method_declaration)
] @declaration

; Wildcards
(_)           ; any node
(identifier)+ ; one or more
(identifier)* ; zero or more
(identifier)? ; optional

; Predicates
((identifier) @var
  (#match? @var "^_"))  ; regex match
```

Siehe [Tree-sitter Query Syntax](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax) für vollständige Dokumentation.
