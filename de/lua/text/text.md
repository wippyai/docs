# Textverarbeitung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Regulare Ausdrucke, Text-Diffing und semantisches Text-Splitting.

## Laden

```lua
local text = require("text")
```

## Regulare Ausdrucke

### Kompilieren

```lua
local re, err = text.regexp.compile("[0-9]+")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `pattern` | string | RE2-kompatibles Regex-Muster |

**Gibt zuruck:** `Regexp, error`

### Match

```lua
local ok = re:match_string("abc123")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu matchender String |

**Gibt zuruck:** `boolean`

### Find

```lua
local match = re:find_string("abc123def")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu durchsuchender String |

**Gibt zuruck:** `string | nil`

### Find All

```lua
local matches = re:find_all_string("a1b2c3")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu durchsuchender String |

**Gibt zuruck:** `string[]`

### Find mit Gruppen

```lua
local match = re:find_string_submatch("user@example.com")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu durchsuchender String |

**Gibt zuruck:** `string[] | nil` (vollstandiger Match + Capture-Gruppen)

### Find All mit Gruppen

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu durchsuchender String |

**Gibt zuruck:** `string[][]`

### Find Index

```lua
local pos = re:find_string_index("abc123")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu durchsuchender String |

**Gibt zuruck:** `table | nil` ({start, end}, 1-basiert)

### Find All Index

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu durchsuchender String |

**Gibt zuruck:** `table[]`

### Ersetzen

```lua
local result = re:replace_all_string("a1b2", "X")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Eingabe-String |
| `repl` | string | Ersetzungs-String |

**Gibt zuruck:** `string`

### Split

```lua
local parts = re:split("a,b,c", -1)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu teilender String |
| `n` | integer | Max Teile, -1 fur alle |

**Gibt zuruck:** `string[]`

### Unterausdrucks-Anzahl

```lua
local count = re:num_subexp()
```

**Gibt zuruck:** `number`

### Unterausdrucks-Namen

```lua
local names = re:subexp_names()
```

**Gibt zuruck:** `string[]`

### Muster-String

```lua
local pattern = re:string()
```

**Gibt zuruck:** `string`

## Text-Diffing

Textversionen vergleichen und Patches generieren. Basiert auf [go-diff](https://github.com/sergi/go-diff) (Googles diff-match-patch).

### Differ erstellen

```lua
local diff, err = text.diff.new()
local diff, err = text.diff.new(options)
```

**Gibt zuruck:** `Differ, error`

#### Optionen {id="diff-options"}

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `diff_timeout` | number | 1.0 | Timeout in Sekunden |
| `diff_edit_cost` | integer | 4 | Kosten einer leeren Bearbeitung |
| `match_threshold` | number | 0.5 | Match-Toleranz 0-1 |
| `match_distance` | integer | 1000 | Distanz zur Match-Suche |
| `patch_delete_threshold` | number | 0.5 | Losch-Schwelle |
| `patch_margin` | integer | 4 | Kontext-Rand |

### Vergleichen

Unterschiede zwischen zwei Texten finden. Gibt ein Array von Operationen zuruck, die beschreiben, wie text1 in text2 transformiert wird.

```lua
local diff, _ = text.diff.new()
local diffs, err = diff:compare("hello world", "hello there")

-- diffs enthalt:
-- {operation = "equal", text = "hello "}
-- {operation = "delete", text = "world"}
-- {operation = "insert", text = "there"}
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `text1` | string | Original-Text |
| `text2` | string | Modifizierter Text |

**Gibt zuruck:** `table, error` (Array von {operation, text})

Operationen: `"equal"`, `"delete"`, `"insert"`

### Zusammenfassen

Geanderte Zeichen zwischen Versionen zahlen.

```lua
local diffs, _ = diff:compare("hello world", "hello there")
local summary = diff:summarize(diffs)

-- summary.equals = 6 (unveranderte Zeichen)
-- summary.deletions = 5 (entfernte Zeichen)
-- summary.insertions = 5 (hinzugefugte Zeichen)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `diffs` | table | Diff-Array von compare |

**Gibt zuruck:** `table` ({insertions, deletions, equals})

### Pretty Text

Diff mit ANSI-Farben fur Terminal-Anzeige formatieren.

```lua
local formatted, err = diff:pretty_text(diffs)
print(formatted)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `diffs` | table | Diff-Array von compare |

**Gibt zuruck:** `string, error`

### Pretty HTML

Diff als HTML mit `<del>`- und `<ins>`-Tags formatieren.

```lua
local html, err = diff:pretty_html(diffs)
-- Gibt zuruck: "hello <del>world</del><ins>there</ins>"
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `diffs` | table | Diff-Array von compare |

**Gibt zuruck:** `string, error`

### Patches erstellen

Patches generieren, die angewendet werden konnen, um einen Text in einen anderen zu transformieren. Patches konnen serialisiert und spater angewendet werden.

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `text1` | string | Original-Text |
| `text2` | string | Modifizierter Text |

**Gibt zuruck:** `table, error`

### Patches anwenden

Patches anwenden, um Text zu transformieren. Gibt das Ergebnis und ob alle Patches erfolgreich angewendet wurden zuruck.

```lua
local result, success = diff:patch_apply(patches, text1)
-- result = "The quick red fox jumps over the lazy cat"
-- success = true
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `patches` | table | Patches von patch_make |
| `text` | string | Text, auf den Patches angewendet werden |

**Gibt zuruck:** `string, boolean`

## Text-Splitting

Grosse Dokumente in kleinere Chunks aufteilen, wahrend semantische Grenzen erhalten bleiben. Basiert auf [langchaingo](https://github.com/tmc/langchaingo) Text-Splitter.

### Rekursiver Splitter

Teilt Text mit einer Hierarchie von Trennzeichen. Versucht zuerst bei doppelten Zeilenumbruchen (Absatze) zu teilen, dann einzelne Zeilenumbruche, dann Leerzeichen, dann Zeichen. Fallt auf kleinere Trennzeichen zuruck, wenn Chunks die Grossenbegrenzung uberschreiten.

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})

local long_text = "This is a long text that needs splitting..."
local chunks, err = splitter:split_text(long_text)
-- chunks = {"This is a long...", "...text that needs...", "...splitting..."}
```

**Gibt zuruck:** `Splitter, error`

#### Optionen {id="recursive-splitter-options"}

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `chunk_size` | integer | 4000 | Max Zeichen pro Chunk |
| `chunk_overlap` | integer | 200 | Zeichen wiederholt zwischen benachbarten Chunks |
| `keep_separator` | boolean | false | Trennzeichen in Ausgabe behalten |
| `separators` | string[] | nil | Benutzerdefinierte Trennzeichenliste |

### Markdown-Splitter

Teilt Markdown-Dokumente unter Beachtung der Struktur. Versucht Uberschriften mit ihrem Inhalt zusammenzuhalten, Code-Blocke intakt zu lassen und Tabellenzeilen zusammenzuhalten.

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})

local readme = fs.read("README.md")
local chunks, err = splitter:split_text(readme)
```

**Gibt zuruck:** `Splitter, error`

#### Optionen {id="markdown-splitter-options"}

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `chunk_size` | integer | 4000 | Max Zeichen pro Chunk |
| `chunk_overlap` | integer | 200 | Zeichen wiederholt zwischen benachbarten Chunks |
| `code_blocks` | boolean | false | Code-Blocke zusammenhalten |
| `reference_links` | boolean | false | Referenz-Links erhalten |
| `heading_hierarchy` | boolean | false | Uberschriftenebenen beachten |
| `join_table_rows` | boolean | false | Tabellenzeilen zusammenhalten |

### Text teilen

Einzelnes Dokument in Array von Chunks aufteilen.

```lua
local chunks, err = splitter:split_text(document)

for i, chunk in ipairs(chunks) do
    -- Jeden Chunk verarbeiten (z.B. Embedding erstellen, an LLM senden)
    process(chunk)
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `text` | string | Zu teilender Text |

**Gibt zuruck:** `string[], error`

### Batch teilen

Mehrere Dokumente teilen, wahrend ihre Metadaten erhalten bleiben. Jedes Eingabedokument kann mehrere Ausgabe-Chunks produzieren. Alle Chunks erben die Metadaten ihres Quelldokuments.

```lua
-- Eingabe: Seiten aus einem PDF mit Seitennummern
local pages = {
    {content = "First page content...", metadata = {page = 1}},
    {content = "Second page content...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)

-- Ausgabe: Jeder Chunk weiss, von welcher Seite er stammt
for _, chunk in ipairs(chunks) do
    print("Page " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `pages` | table | Array von {content, metadata} |

**Gibt zuruck:** `table, error` (Array von {content, metadata})

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ungultige Muster-Syntax | `errors.INVALID` | nein |
| Interner Fehler | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) fur die Arbeit mit Fehlern.
