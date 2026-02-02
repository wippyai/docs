# Komprimierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Komprimieren und dekomprimieren Sie Daten mit gzip, deflate, zlib, brotli und zstd-Algorithmen.

## Laden

```lua
local compress = require("compress")
```

## GZIP

Am weitesten verbreitetes Format (RFC 1952).

### Komprimieren {id="gzip-compress"}

```lua
-- Für HTTP-Response komprimieren
local body = json.encode(large_response)
local compressed, err = compress.gzip.encode(body)
if err then
    return nil, err
end

-- Content-Encoding-Header setzen
res:set_header("Content-Encoding", "gzip")
res:write(compressed)

-- Maximale Komprimierung für Speicherung
local archived = compress.gzip.encode(data, {level = 9})

-- Schnelle Komprimierung für Echtzeit
local fast = compress.gzip.encode(data, {level = 1})
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
-- HTTP-Request dekomprimieren
local content_encoding = req:header("Content-Encoding")
if content_encoding == "gzip" then
    local body = req:body()
    local decompressed, err = compress.gzip.decode(body)
    if err then
        return nil, errors.new("INVALID", "Invalid gzip data")
    end
    body = decompressed
end

-- Dekomprimieren mit Größenbegrenzung (Zip-Bomben verhindern)
local decompressed, err = compress.gzip.decode(data, {max_size = 10 * 1024 * 1024})
if err then
    return nil, errors.new("INVALID", "Decompressed size exceeds 10MB limit")
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

Beste Komprimierungsrate für Text (RFC 7932).

### Komprimieren {id="brotli-compress"}

```lua
-- Am besten für statische Assets und Textinhalte
local compressed = compress.brotli.encode(html_content, {level = 11})

-- Komprimierte Assets cachen
cache:set("static:" .. hash, compressed)

-- Moderate Komprimierung für API-Responses
local compressed = compress.brotli.encode(json_data, {level = 4})
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

-- Mit Größenbegrenzung
local decompressed = compress.brotli.decode(data, {max_size = 50 * 1024 * 1024})
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

Schnelle Komprimierung mit guten Raten (RFC 8878).

### Komprimieren {id="zstd-compress"}

```lua
-- Gute Balance zwischen Geschwindigkeit und Rate
local compressed = compress.zstd.encode(binary_data)

-- Höhere Komprimierung für Archivierung
local archived = compress.zstd.encode(data, {level = 19})

-- Schnellmodus für Echtzeit-Streaming
local fast = compress.zstd.encode(data, {level = 1})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu komprimierende Daten |
| `options` | table? | Optionale Kodierungsoptionen |

#### Optionen {id="zstd-compress-options"}

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `level` | integer | Komprimierungsstufe 1-22 (Standard: 3) |

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

**Gibt zurück:** `string, error`

## Deflate

Rohe DEFLATE-Komprimierung (RFC 1951). Wird intern von anderen Formaten verwendet.

### Komprimieren {id="deflate-compress"}

```lua
local compressed = compress.deflate.encode(data, {level = 6})
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
local decompressed = compress.deflate.decode(compressed)
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

DEFLATE mit Header und Prüfsumme (RFC 1950).

### Komprimieren {id="zlib-compress"}

```lua
local compressed = compress.zlib.encode(data, {level = 6})
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
local decompressed = compress.zlib.decode(compressed)
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
| zstd | Größe Dateien, Streaming | Schnell | Gut | 1-22 |
| deflate/zlib | Low-Level, spezifische Protokolle | Mittel | Gut | 1-9 |

```lua
-- HTTP-Response basierend auf Accept-Encoding
local accept = req:header("Accept-Encoding") or ""
local body = json.encode(response_data)

if accept:find("br") then
    res:set_header("Content-Encoding", "br")
    res:write(compress.brotli.encode(body))
elseif accept:find("gzip") then
    res:set_header("Content-Encoding", "gzip")
    res:write(compress.gzip.encode(body))
else
    res:write(body)
end
```

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leere Eingabe | `errors.INVALID` | nein |
| Stufe außerhalb des Bereichs | `errors.INVALID` | nein |
| Ungültige komprimierte Daten | `errors.INVALID` | nein |
| Dekomprimierte Größe überschreitet Limit | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
