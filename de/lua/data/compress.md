---
title: "Komprimierung"
description: "Strings mit gzip, Brotli, Zstandard, rohem DEFLATE und zlib komprimieren und dekomprimieren."
---

# Komprimierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Das Modul `compress` kodiert und dekodiert Strings mit gzip, Brotli, Zstandard, rohem DEFLATE und zlib.

Diese Seite ist eine API-Referenz mit partiellen HTTP- und Storage-Rezepten. Jede Operation materialisiert ihre vollständige Ein- und Ausgabe als Lua-Strings; verwenden Sie Archive- oder Stream-APIs, wenn Daten im Streaming verbleiben müssen. Die Beispiele setzen voraus, dass der Eintrag `compress` und alle separat benötigten Module wie `json` oder `http` aktiviert.

## Laden

```lua
local compress = require("compress")
```

Fügen Sie `compress` zur `modules:`-Liste des ausführbaren Eintrags hinzu, bevor Sie das Modul laden.

## GZIP

Gzip ist in RFC 1952 definiert.

### Komprimieren {id="gzip-compress"}

```lua
-- Compress for HTTP response
local body, json_err = json.encode(large_response)
if json_err then return nil, json_err end
local compressed, err = compress.gzip.encode(body)
if err then
    return nil, err
end

-- Set Content-Encoding header
local header_err = res:set_header("Content-Encoding", "gzip")
if header_err then return nil, header_err end
local write_err = res:write(compressed)
if write_err then return nil, write_err end

-- Maximum compression for storage
local archived, archive_err = compress.gzip.encode(data, {level = 9})
if archive_err then return nil, archive_err end

-- Fast compression for real-time
local fast, fast_err = compress.gzip.encode(data, {level = 1})
if fast_err then return nil, fast_err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu komprimierende Daten |
| `options` | table? | Optionale Kodierungsoptionen |

#### Optionen {id="gzip-compress-options"}

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `level` | integer | Komprimierungsstufe 1-9 (Standard: 6) |

**Gibt zurück:** `string, error`

### Dekomprimieren {id="gzip-decompress"}

```lua
-- Decompress HTTP request
local content_encoding, header_err = req:header("Content-Encoding")
if header_err then return nil, header_err end
if content_encoding == "gzip" then
    local body, body_err = req:body()
    if body_err then return nil, body_err end
    local decompressed, err = compress.gzip.decode(body)
    if err then
        return nil, errors.wrap(err, "gzip request body could not be decoded")
    end
    body = decompressed
end

-- Decompress with size limit (prevent zip bombs)
local decompressed, err = compress.gzip.decode(data, {max_size = 10 * 1024 * 1024})
if err then
    return nil, errors.wrap(err, "gzip decode failed")
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | GZIP-komprimierte Daten |
| `options` | table? | Optionale Dekodierungsoptionen |

#### Optionen {id="gzip-decompress-options"}

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `max_size` | integer | Max. dekomprimierte Größe in Bytes (Standard: 128MB, Max: 1GB) |

**Gibt zurück:** `string, error`

## Brotli

Brotli ist in RFC 7932 definiert und wird häufig für komprimierte Textinhalte verwendet.

### Komprimieren {id="brotli-compress"}

```lua
-- Best for static assets and text content
local compressed, err = compress.brotli.encode(html_content, {level = 11})
if err then return nil, err end

-- Store `compressed` through the application's cache contract if needed.

-- Moderate compression for API responses
local compressed, err = compress.brotli.encode(json_data, {level = 4})
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu komprimierende Daten |
| `options` | table? | Optionale Kodierungsoptionen |

#### Optionen {id="brotli-compress-options"}

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `level` | integer | Komprimierungsstufe 0-11 (Standard: 6) |

**Gibt zurück:** `string, error`

### Dekomprimieren {id="brotli-decompress"}

```lua
local decompressed, err = compress.brotli.decode(compressed_data)
if err then
    return nil, err
end

-- With size limit
local decompressed, err = compress.brotli.decode(data, {max_size = 50 * 1024 * 1024})
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Brotli-komprimierte Daten |
| `options` | table? | Optionale Dekodierungsoptionen |

#### Optionen {id="brotli-decompress-options"}

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `max_size` | integer | Max. dekomprimierte Größe in Bytes (Standard: 128MB, Max: 1GB) |

**Gibt zurück:** `string, error`

## Zstandard

Zstandard ist ein universelles Komprimierungsformat nach RFC 8878.

### Komprimieren {id="zstd-compress"}

```lua
-- Good balance of speed and ratio
local compressed, err = compress.zstd.encode(binary_data)
if err then return nil, err end

-- Higher compression for archival
local archived, archive_err = compress.zstd.encode(data, {level = 19})
if archive_err then return nil, archive_err end

-- Fast mode for latency-sensitive payloads
local fast, fast_err = compress.zstd.encode(data, {level = 1})
if fast_err then return nil, fast_err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu komprimierende Daten |
| `options` | table? | Optionale Kodierungsoptionen |

#### Optionen {id="zstd-compress-options"}

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `level` | integer | Komprimierungsstufe 1-22 (Standard: 3) |
| `dict` | string? | Zstd-Dictionary-Bytes aus `train_dict` (Standard: keine) |

**Gibt zurück:** `string, error`

### Dekomprimieren {id="zstd-decompress"}

```lua
local decompressed, err = compress.zstd.decode(compressed_data)
if err then
    return nil, err
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zstandard-komprimierte Daten |
| `options` | table? | Optionale Dekodierungsoptionen |

#### Optionen {id="zstd-decompress-options"}

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `max_size` | integer | Max. dekomprimierte Größe in Bytes (Standard: 128MB, Max: 1GB) |
| `dict` | string? | Zstd-Dictionary-Bytes (muss mit dem zum Kodieren verwendeten Dictionary übereinstimmen) |

**Gibt zurück:** `string, error`

### Dictionaries {id="zstd-dictionaries"}

Trainieren Sie ein Dictionary aus ähnlichen Beispiel-Payloads und übergeben Sie es anschließend über die Option `dict` an `encode` und `decode`. Zum Dekodieren ist dasselbe Dictionary erforderlich, das beim Kodieren verwendet wurde.

```lua
local dict, err = compress.zstd.train_dict(samples, { size = 112640 })
if err then return nil, err end
local packed, pack_err = compress.zstd.encode(data, { dict = dict })
if pack_err then return nil, pack_err end
local original, decode_err = compress.zstd.decode(packed, { dict = dict })
if decode_err then return nil, decode_err end
```

#### train_dict(samples, options?)

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `samples` | string[] | Trainingsbeispiele (mindestens eines >= 8 Bytes) |
| `options` | table? | `size` (integer, Ziel-Dictionary-Bytes, 256-1048576, Standard 114688), `id` (integer, Standard 0), `level` (integer, 1-22) |

**Gibt zurück:** `string, error` (die Dictionary-Bytes)

#### inspect_dict(dict)

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `dict` | string | Dictionary-Bytes |

**Gibt zurück:** `table, error` — `{id: integer, content_size: integer}`

## Deflate

Rohes DEFLATE ist in RFC 1951 definiert und wird auch innerhalb anderer Formate verwendet.

### Komprimieren {id="deflate-compress"}

```lua
local compressed, err = compress.deflate.encode(data, {level = 6})
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu komprimierende Daten |
| `options` | table? | Optionale Kodierungsoptionen |

#### Optionen {id="deflate-compress-options"}

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `level` | integer | Komprimierungsstufe 1-9 (Standard: 6) |

**Gibt zurück:** `string, error`

### Dekomprimieren {id="deflate-decompress"}

```lua
local decompressed, err = compress.deflate.decode(compressed)
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | DEFLATE-komprimierte Daten |
| `options` | table? | Optionale Dekodierungsoptionen |

#### Optionen {id="deflate-decompress-options"}

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `max_size` | integer | Max. dekomprimierte Größe in Bytes (Standard: 128MB, Max: 1GB) |

**Gibt zurück:** `string, error`

## Zlib

Zlib umschließt DEFLATE-Daten gemäß RFC 1950 mit Header und Prüfsumme.

### Komprimieren {id="zlib-compress"}

```lua
local compressed, err = compress.zlib.encode(data, {level = 6})
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu komprimierende Daten |
| `options` | table? | Optionale Kodierungsoptionen |

#### Optionen {id="zlib-compress-options"}

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `level` | integer | Komprimierungsstufe 1-9 (Standard: 6) |

**Gibt zurück:** `string, error`

### Dekomprimieren {id="zlib-decompress"}

```lua
local decompressed, err = compress.zlib.decode(compressed)
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zlib-komprimierte Daten |
| `options` | table? | Optionale Dekodierungsoptionen |

#### Optionen {id="zlib-decompress-options"}

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `max_size` | integer | Max. dekomprimierte Größe in Bytes (Standard: 128MB, Max: 1GB) |

**Gibt zurück:** `string, error`

## Algorithmus auswählen

| Algorithmus | Am besten für | Geschwindigkeit | Rate | Stufenbereich |
|-----------|----------|-------|-------|-------------|
| gzip | HTTP, breite Kompatibilität | Mittel | Gut | 1-9 |
| brotli | Statische Assets, Text | Langsam | Beste | 0-11 |
| zstd | Binäre Payloads, schnelle Komprimierung | Schnell | Gut | 1-22 |
| deflate/zlib | Low-Level, spezifische Protokolle | Mittel | Gut | 1-9 |

```lua
-- HTTP response based on Accept-Encoding
local accept, header_err = req:header("Accept-Encoding")
if header_err then return nil, header_err end
accept = accept or ""
local body, json_err = json.encode(response_data)
if json_err then return nil, json_err end

local qualities = {}
for item in accept:gmatch("[^,]+") do
    local coding = item:match("^%s*([^;%s]+)")
    local has_q = item:match(";%s*[qQ]%s*=") ~= nil
    local q_text = item:match(";%s*[qQ]%s*=%s*([^;%s,]+)")
    local q
    if not has_q then
        q = 1
    elseif q_text == "0" or q_text == "1" or
           (q_text and q_text:match("^0%.%d?%d?%d?$")) or
           (q_text and q_text:match("^1%.0?0?0?$")) then
        q = tonumber(q_text)
    end
    if coding and q and q >= 0 and q <= 1 then
        coding = coding:lower()
        qualities[coding] = math.max(qualities[coding] or 0, q)
    end
end

local function quality(coding)
    if qualities[coding] ~= nil then return qualities[coding] end
    if coding == "identity" then
        return qualities["*"] == 0 and 0 or 1
    end
    return qualities["*"] or 0
end

local selected, selected_q = nil, -1
for _, coding in ipairs({"br", "gzip", "identity"}) do
    local q = quality(coding)
    if q > selected_q then
        selected, selected_q = coding, q
    end
end

-- Include every field used by this handler or its surrounding middleware.
local vary_fields = {"Accept-Encoding"}
local vary_err = res:set_header("Vary", table.concat(vary_fields, ", "))
if vary_err then return nil, vary_err end

if selected_q <= 0 then
    local status_err = res:set_status(http.STATUS.NOT_ACCEPTABLE)
    if status_err then return nil, status_err end
    local write_err = res:write("No acceptable content encoding")
    if write_err then return nil, write_err end
elseif selected == "br" then
    local compressed, compress_err = compress.brotli.encode(body)
    if compress_err then return nil, compress_err end
    local set_err = res:set_header("Content-Encoding", "br")
    if set_err then return nil, set_err end
    local write_err = res:write(compressed)
    if write_err then return nil, write_err end
elseif selected == "gzip" then
    local compressed, compress_err = compress.gzip.encode(body)
    if compress_err then return nil, compress_err end
    local set_err = res:set_header("Content-Encoding", "gzip")
    if set_err then return nil, set_err end
    local write_err = res:write(compressed)
    if write_err then return nil, write_err end
else
    local write_err = res:write(body)
    if write_err then return nil, write_err end
end
```

Dieser partielle Handler parst exakte Coding-Tokens und RFC-q-Werte, berücksichtigt explizite Ablehnungen wie `br;q=0` und setzt `Vary: Accept-Encoding`. `set_header` ersetzt einen vorhandenen `Vary`-Wert; fügen Sie daher jedes weitere Feld, das umgebende Middleware verwendet, zu `vary_fields` hinzu, bevor Sie den Header setzen. Ein vollständiger HTTP-Stack kann stattdessen einen gemeinsamen Negotiation-Helper bereitstellen.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leere Eingabe | `errors.INVALID` | nein |
| Stufe außerhalb des Bereichs | `errors.INVALID` | nein |
| Ungültige komprimierte Daten | `errors.INVALID` | nein |
| Dekomprimierte Größe überschreitet Limit | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
