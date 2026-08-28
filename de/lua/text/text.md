---
title: "Textverarbeitung"
description: "Reguläre Ausdrücke kompilieren, Texte vergleichen, Patches erstellen und Dokumente in Abschnitte aufteilen."
---

# Textverarbeitung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Das Modul `text` stellt reguläre Ausdrücke, Textvergleiche und Patches sowie das Aufteilen von Dokumenten bereit. Diese Seite ist eine API-Referenz. Die kurzen Blöcke sind einzelne Aufrufe; längere Blöcke zum Aufteilen sind Teilrezepte, deren Dokumente, konfigurierte Dateisystemressourcen und nachgelagerte Verarbeitung von der umgebenden Anwendung bereitgestellt werden.

## Laden

```lua
local text = require("text")
```

## Reguläre Ausdrücke

### `text.regexp.compile`

```lua
local re, err = text.regexp.compile("[0-9]+")
if err then
    return nil, err
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `pattern` | string | RE2-kompatibles Regex-Muster |

**Gibt zurück:** `Regexp, error`

### `re:match_string`

```lua
local ok = re:match_string("abc123")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu matchender String |

**Gibt zurück:** `boolean`

### `re:find_string`

```lua
local match = re:find_string("abc123def")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu durchsuchender String |

**Gibt zurück:** `string | nil`

In dieser Runtime-Version wird auch ein Treffer auf die leere Zeichenkette als `nil` dargestellt. Verwenden Sie ein Muster, das mindestens ein Zeichen verbraucht, wenn Sie einen leeren Treffer von keinem Treffer unterscheiden müssen.

### `re:find_all_string`

```lua
local matches = re:find_all_string("a1b2c3")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu durchsuchender String |

**Gibt zurück:** `string[]`

### `re:find_string_submatch`

```lua
local match = re:find_string_submatch("user@example.com")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu durchsuchender String |

**Gibt zurück:** `string[] | nil` (vollständiger Match + Capture-Gruppen)

### `re:find_all_string_submatch`

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu durchsuchender String |

**Gibt zurück:** `string[][]`

### `re:find_string_index`

```lua
local pos = re:find_string_index("abc123")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu durchsuchender String |

**Gibt zurück:** `table | nil` ({start, end}, 1-basiert)

### `re:find_all_string_index`

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu durchsuchender String |

**Gibt zurück:** `table[] | nil` (nil, wenn es keine Treffer gibt)

### `re:replace_all_string`

```lua
local result = re:replace_all_string("a1b2", "X")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Eingabe-String |
| `repl` | string | Ersetzungs-String |

**Gibt zurück:** `string`

### `re:split`

```lua
local parts = re:split("a,b,c", -1)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `s` | string | Zu teilender String |
| `n` | integer | Max Teile, -1 für alle |

**Gibt zurück:** `string[]`

### `re:num_subexp`

```lua
local count = re:num_subexp()
```

**Gibt zurück:** `number`

### `re:subexp_names`

```lua
local names = re:subexp_names()
```

**Gibt zurück:** `string[]`

### `re:string`

```lua
local pattern = re:string()
```

**Gibt zurück:** `string`

## Text-Diffing

Vergleichen Sie Textversionen und erzeugen Sie Patches mit [go-diff](https://github.com/sergi/go-diff), einer Implementierung von Googles diff-match-patch-Algorithmus.

### `text.diff.new`

```lua
local diff, err = text.diff.new()
local diff, err = text.diff.new(options)
```

**Gibt zurück:** `Differ, error`

#### Optionen {id="diff-options"}

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `diff_timeout` | number | 1.0 | Timeout in Sekunden |
| `diff_edit_cost` | integer | 4 | Kosten einer leeren Bearbeitung |
| `match_threshold` | number | 0.5 | Match-Toleranz 0-1 |
| `match_distance` | integer | 1000 | Distanz zur Match-Suche |
| `patch_delete_threshold` | number | 0.5 | Lösch-Schwelle |
| `patch_margin` | integer | 4 | Kontext-Rand |

### `diff:compare`

Unterschiede zwischen zwei Texten finden. Gibt ein Array von Operationen zurück, die beschreiben, wie text1 in text2 transformiert wird.

```lua
local diff, diff_err = text.diff.new()
if diff_err then
    return nil, diff_err
end
local diffs, err = diff:compare("hello world", "hello there")
if err then
    return nil, err
end

-- diffs contains:
-- {operation = "equal", text = "hello "}
-- {operation = "delete", text = "world"}
-- {operation = "insert", text = "there"}
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `text1` | string | Original-Text |
| `text2` | string | Modifizierter Text |

**Gibt zurück:** `table, error` (Array von {operation, text})

Operationen: `"equal"`, `"delete"`, `"insert"`

### `diff:summarize`

Zählen Sie unveränderte, eingefügte und gelöschte UTF-8-Bytes. Bei Nicht-ASCII-Text entsprechen diese Summen weder Unicode-Codepoints noch Graphemclustern.

```lua
-- `diffs` is the checked result from diff:compare.
local summary = diff:summarize(diffs)

-- summary.equals = 6 (bytes unchanged)
-- summary.deletions = 5 (bytes removed)
-- summary.insertions = 5 (bytes added)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `diffs` | table | Diff-Array von compare |

**Gibt zurück:** `table` ({insertions, deletions, equals})

### `diff:pretty_text`

Diff mit ANSI-Farben für Terminal-Anzeige formatieren.

```lua
local formatted, err = diff:pretty_text(diffs)
if err then
    return nil, err
end
print(formatted)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `diffs` | table | Diff-Array von compare |

**Gibt zurück:** `string, error`

### `diff:pretty_html`

Diff als HTML mit `<del>`- und `<ins>`-Tags formatieren.

```lua
local html, err = diff:pretty_html(diffs)
if err then
    return nil, err
end
-- `html` is an HTML fragment with equal, deleted, and inserted spans.
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `diffs` | table | Diff-Array von compare |

**Gibt zurück:** `string, error`

### `diff:patch_make`

Patches generieren, die angewendet werden können, um einen Text in einen anderen zu transformieren. Patches können serialisiert und später angewendet werden.

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
if err then
    return nil, err
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `text1` | string | Original-Text |
| `text2` | string | Modifizierter Text |

**Gibt zurück:** `table, error`

### `diff:patch_apply`

Patches anwenden, um Text zu transformieren. Gibt das Ergebnis und ob alle Patches erfolgreich angewendet wurden zurück.

```lua
local result, success = diff:patch_apply(patches, text1)
-- result = "The quick red fox jumps over the lazy cat"
-- success = true
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `patches` | table | Patches von patch_make |
| `text` | string | Text, auf den Patches angewendet werden |

**Gibt zurück:** `string, boolean`

Prüfen Sie `success`, bevor Sie `result` als die angeforderte Transformation behandeln. Übergeben Sie Patch-Tabellen, die von `patch_make` erzeugt wurden. In dieser Runtime-Version kann fehlerhafter serialisierter Patch-Text in einer manuell erstellten Tabelle übersprungen werden, ohne dass dies separat gemeldet wird.

## Text-Splitting

Große Dokumente in kleinere Chunks aufteilen, während semantische Grenzen erhalten bleiben. Basiert auf [langchaingo](https://github.com/tmc/langchaingo) Text-Splitter.

### `text.splitter.recursive`

Der rekursive Splitter versucht nacheinander doppelte Zeilenumbrüche, einzelne Zeilenumbrüche, Leerzeichen und schließlich einzelne Zeichen. Er wechselt zum nächsten Trennzeichen, wenn ein Abschnitt die Größenbegrenzung überschreitet.

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})
if err then
    return nil, err
end

local long_text = "This is a long text that needs splitting..."
local chunks, split_err = splitter:split_text(long_text)
if split_err then
    return nil, split_err
end
```

**Gibt zurück:** `Splitter, error`

#### Optionen {id="recursive-splitter-options"}

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `chunk_size` | integer | 4000 | Max Zeichen pro Chunk |
| `chunk_overlap` | integer | 200 | Zeichen wiederholt zwischen benachbarten Chunks |
| `keep_separator` | boolean | false | Trennzeichen in Ausgabe behalten |
| `separators` | string[] | nil | Benutzerdefinierte Trennzeichenliste |

### `text.splitter.markdown`

Der Markdown-Splitter kann Überschriften mit ihrem Inhalt zusammenhalten, Codeblöcke bewahren und Tabellenzeilen gruppieren.

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})
if err then
    return nil, err
end

local fs = require("fs")
local docs, docs_err = fs.get("app:docs")
if docs_err then
    return nil, docs_err
end
local readme, read_err = docs:readfile("README.md")
if read_err then
    return nil, read_err
end
local chunks, split_err = splitter:split_text(readme)
if split_err then
    return nil, split_err
end
```

Dieses Teilrezept setzt voraus, dass der Eintrag sowohl `text` als auch `fs` aktiviert, eine Dateisystemressource `app:docs` konfiguriert ist und darin eine lesbare `README.md` vorhanden ist.

**Gibt zurück:** `Splitter, error`

#### Optionen {id="markdown-splitter-options"}

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `chunk_size` | integer | 4000 | Max Zeichen pro Chunk |
| `chunk_overlap` | integer | 200 | Zeichen wiederholt zwischen benachbarten Chunks |
| `code_blocks` | boolean | false | Code-Blöcke zusammenhalten |
| `reference_links` | boolean | false | Referenz-Links erhalten |
| `heading_hierarchy` | boolean | false | Überschriftenebenen beachten |
| `join_table_rows` | boolean | false | Tabellenzeilen zusammenhalten |

### `splitter:split_text`

Einzelnes Dokument in Array von Chunks aufteilen.

```lua
local chunks, err = splitter:split_text(document)
if err then
    return nil, err
end

for i, chunk in ipairs(chunks) do
    -- Process each chunk (e.g., create embedding, send to LLM)
    process(chunk)
end
```

Hier ist `splitter` ein erfolgreich erstellter Splitter; `document` und `process` werden von der Anwendung bereitgestellt.

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `text` | string | Zu teilender Text |

**Gibt zurück:** `string[], error`

### `splitter:split_batch`

Mehrere Dokumente teilen, während ihre Metadaten erhalten bleiben. Jedes Eingabedokument kann mehrere Ausgabe-Chunks produzieren. Alle Chunks erben die Metadaten ihres Quelldokuments.

```lua
-- Input: pages from a PDF with page numbers
local pages = {
    {content = "First page content...", metadata = {page = 1}},
    {content = "Second page content...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)
if err then
    return nil, err
end

-- Output: each chunk knows which page it came from
for _, chunk in ipairs(chunks) do
    print("Page " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `pages` | table | Array von {content, metadata} |

**Gibt zurück:** `table, error` (Array von {content, metadata})

`split_batch` überspringt ein Element stillschweigend, wenn es keine Tabelle ist, sein Feld `content` fehlt, leer oder keine Zeichenkette ist oder das Aufteilen dieses Elements fehlschlägt. Die Methode gibt die verbleibenden Abschnitte dennoch mit einem `nil`-Fehler zurück. Validieren Sie jedes Eingabeelement vor dem Aufruf und prüfen Sie Anforderungen an die Anzahl der Ergebnisse im Anwendungscode; ein erfolgreicher Aufruf belegt nicht, dass jede Eingabe vertreten ist.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ungültige Muster-Syntax | `errors.INVALID` | nein |
| Interner Fehler | `errors.INTERNAL` | nein |

Informationen zum Umgang mit Fehlern finden Sie unter [Fehlerbehandlung](lua/core/errors.md).
