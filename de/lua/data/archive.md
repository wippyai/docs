---
title: "Archive"
description: "Lesen und Schreiben von zip/tar-Archiven mit begrenztem Speicherverbrauch. Archive werden weder in den RAM geladen noch auf die Festplatte entpackt —…"
---

# Archive
<secondary-label ref="function"/>
<secondary-label ref="io"/>
<secondary-label ref="encoding"/>

Lesen und Schreiben von zip/tar-Archiven mit begrenztem Speicherverbrauch. Archive werden weder in den RAM geladen noch auf die Festplatte entpackt — der Spitzenspeicherbedarf ist unabhängig von Archiv- und Eintragsgröße, sodass Archive im Multi-GB-Bereich auf einem Server mit wenig RAM laufen.

## Laden

```lua
local archive = require("archive")
```

## Formate

Eingebaute Formate werden anhand von Magic Bytes erkannt oder mit `opts.format` erzwungen:

| Format | Wahlfreier Zugriff | Sequenzieller Scan | Schreiben |
|--------|:-----------:|:---------------:|:-----:|
| `zip` | ja | ja (lokale Header) | ja |
| `tar` | ja | ja | ja |
| `tar.gz` | nein | ja | ja |
| `tar.zst` | nein | ja | ja |

`archive.formats()` gibt die Liste der registrierten Formatnamen zurück.

```lua
local names = archive.formats()  -- {"zip", "tar", "tar.gz", "tar.zst", ...}
```

## Optionen

Alle Einstiegspunkte akzeptieren eine optionale `opts`-Tabelle:

| Schlüssel | Standard | Bedeutung |
|-----|---------|---------|
| `format` | auto | `"zip"`, `"tar"`, `"tar.gz"`, `"tar.zst"`; auto = Magic Bytes prüfen, sonst Dateiendung |
| `max_entries` | 100000 | Archive mit mehr Einträgen ablehnen (Schutz vor Dekomprimierungsbomben) |
| `max_total_bytes` | 2 GiB | Obergrenze für die kumulierte unkomprimierte Ausgabe beim Lesen/Extrahieren |
| `max_file_bytes` | 1 GiB | Obergrenze für die unkomprimierte Größe eines einzelnen Eintrags |
| `max_inline_bytes` | 16 MiB | Harte Obergrenze für den RAM-materialisierenden `read()`-Aufruf; darüber `stream()`/`extract()` verwenden |
| `buffer_bytes` | 64 KiB | Streaming-Kopierpuffer für Lesen/Extrahieren/Hinzufügen |

`max_total_bytes`/`max_file_bytes` sind Arbeitsgrenzen, keine RAM-Grenzen — das Streamen eines Eintrags hält nie mehr als `buffer_bytes` plus das Dekomprimierungsfenster des Codecs. Der einzige Stellhebel für die RAM-Größe ist `max_inline_bytes`.

## Lesen — Wahlfreier Zugriff

`archive.open(source, ...)` öffnet eine **suchbare** Quelle für vollständigen wahlfreien Zugriff (das zentrale Verzeichnis eines Zip wird vorab gelesen; Einträge werden bei Bedarf dekomprimiert). Die Quelle kann ein `fs.FS`-Handle plus Pfad sein, eine geöffnete `fs.File`, rohe Bytes (Bytes halten das gesamte Archiv im RAM — nur für kleine Archive) oder ein beliebiger Reader mit wahlfreiem Zugriff, den ein anderes Modul übergibt.

Ein Reader aus einem anderen Modul qualifiziert sich, wenn er `io.ReaderAt` implementiert und seine `Size` meldet; ein optionaler `Name` wird für die Erkennung anhand der Dateiendung verwendet, wenn `opts.format` weggelassen wird. [`cloudstorage`](lua/storage/cloud.md) `open_reader` ist ein solcher und liest ein Multi-GB-Archiv direkt aus dem Objektspeicher. Das Archiv öffnet in diesem Fall nichts und schließt den Reader nie — das tut sein Besitzer.

```lua
local fs = require("fs")
local archive = require("archive")

-- Öffnen per fs-Handle + Pfad (das Modul öffnet die Datei und besitzt ihren Lebenszyklus)
local r, err = archive.open(fs.get("app:uploads"), "incoming.zip")
-- Oder aus einer bereits geöffneten, suchbaren fs.File
-- local r = archive.open(fs:get("app:uploads"):open("x.zip"))
-- Oder aus rohen Bytes (nur kleine Archive)
-- local r = archive.open(zip_bytes, { format = "zip" })
-- Oder aus einem Reader mit wahlfreiem Zugriff, der einem anderen Modul gehört
-- local reader = cloudstorage.get("app:files"):open_reader("incoming.zip")
-- local r = archive.open(reader)
```

**Rückgabe:** `Reader, error`

**Berechtigung:** `archive.read`

### entries

Über das Verzeichnis iterieren (nur Metadaten — keine Dekomprimierung):

```lua
for e in r:entries() do
    -- e: name, size, compressed_size, is_dir, mode, modified, method, crc32, type
    print(e.name, e.size, e.is_dir)
end
```

### stat

Eintrags-Metadaten per Name abrufen (keine Dekomprimierung):

```lua
local info, err = r:stat("docs/readme.md")
```

### read

Einen einzelnen Eintrag als Lua-String materialisieren. Oberhalb von `max_inline_bytes` ein Fehler (`kind = Invalid`) — für alles Große `stream()` oder `extract()` verwenden:

```lua
local data, err = r:read("docs/readme.md")  -- nur kleine Einträge
```

### stream

Gibt den Eintrag als `stream.Stream` zurück, der bei Bedarf dekomprimiert. Lässt sich überall komponieren, wo ein Stream das kann — `:scanner()`, `fs:writefile()` oder an ein anderes Modul übergeben:

```lua
local es, err = r:stream("big.csv")
while true do
    local chunk = es:read(65536)
    if not chunk then break end
    process(chunk)
end
es:close()
```

### extract

Einen Eintrag in ein Ziel-Dateisystem streamen:

```lua
local ok, err = r:extract("docs/readme.md", fs.get("app:out"))
-- optionaler Zielpfad:
-- r:extract("docs/readme.md", fs.get("app:out"), "readme.md")
```

### extract_all

Jeden Eintrag in ein Ziel-Dateisystem streamen:

```lua
local count, err = r:extract_all(fs.get("app:out"), {
    prefix = "job123/",          -- jedem Zielpfad voranstellen
    strip  = 1,                  -- N führende Pfadkomponenten verwerfen
    filter = function(e) return not e.is_dir end,
})
```

Eintragsnamen werden beim Extrahieren bereinigt — `..`-Segmente, absolute Pfade und Windows-Laufwerks-/UNC-Präfixe werden abgelehnt (Zip-Slip-Schutz).

### close

Den Reader schließen. Idempotent; wird auch am Ende des Task-Scopes automatisch geschlossen.

```lua
r:close()
```

## Lesen — Sequenzieller Scan

`archive.scan(source, opts?)` öffnet einen **nur vorwärts lesbaren** Stream (einen HTTP-Upload-Body, einen Multipart-Dateistream). Einträge werden in Archivreihenfolge besucht; der Reader jedes Eintrags ist nur gültig, bis Sie weiterschalten. Kein wahlfreies `read(name)`.

```lua
local up = form.files.upload[1]:stream()        -- stream.Stream
local s, err = archive.scan(up, { format = "zip" })

for e, entry in s:walk() do                      -- entry ist ein stream.Stream
    if not e.is_dir then
        fs.get("app:uploads"):writefile("job123/" .. e.name, entry)
    end
end
s:close()
```

**Rückgabe:** `Walker, error`

**Berechtigung:** `archive.read`

Ein Walker unterstützt außerdem `extract_all` mit denselben Optionen wie der Reader mit wahlfreiem Zugriff und streamt in einem Aufruf jeden Eintrag in ein Ziel-Dateisystem:

```lua
local count, err = s:extract_all(fs.get("app:uploads"), { prefix = "job123/" })
```

`tar`, `tar.gz` und `tar.zst` streamen nativ. `zip` wird über lokale Header pro Eintrag geparst; Einträge, die mit einem Streaming-Data-Descriptor geschrieben wurden (Größe/CRC folgen den Daten), werden gelesen, indem bis zur Eintragsgrenze dekomprimiert wird. Für robuste Zip-Verarbeitung großer Uploads legen Sie den Upload zuerst als Datei ab (eine begrenzte sequenzielle Kopie) und verwenden dann `archive.open`:

```lua
local dst = fs.get("app:tmp")
dst:writefile("u.zip", req:stream())   -- Streaming-Kopie Upload → fs-Datei
local r = archive.open(dst, "u.zip")   -- robuster wahlfreier Zugriff
-- ... entries / extract_all ...
r:close()
dst:remove("u.zip")
```

## Schreiben

`archive.create(dest, ...)` baut ein Archiv, indem Einträge in ein Ziel gestreamt werden — eine Datei in einem fs (mit Pfad) oder ein beschreibbarer `stream.Stream` (z. B. eine HTTP-Antwort), sodass ein `.zip` zum Herunterladen mit begrenztem Speicher direkt auf die Leitung erzeugt wird.

```lua
local w, err = archive.create(fs.get("app:tmp"), "out.zip", { format = "zip" })
-- oder in eine Antwort streamen:
-- local w = archive.create(res:stream(), { format = "zip" })
```

**Rückgabe:** `Writer, error`

**Berechtigung:** `archive.write`

### add

Einen Eintrag aus einem String, Bytes, einem Reader oder einem `stream.Stream` hinzufügen:

```lua
w:add("notes.txt", "hello")
w:add("from_upload", some_stream, { method = "deflate", mode = tonumber("644", 8) })
```

### add_file

Einen Eintrag aus einer Datei in einem Dateisystem streamen:

```lua
w:add_file("data/big.bin", fs.get("app:data"), "big.bin")
```

### add_dir

Einen Verzeichniseintrag hinzufügen:

```lua
w:add_dir("empty/")
```

### close

Das Archiv finalisieren (schreibt bei zip das zentrale Verzeichnis). Idempotent; wird auch am Ende des Task-Scopes automatisch geschlossen.

```lua
w:close()
```

`add*`-Optionen: `{ method = "store"|"deflate", mode, size }`. Tar-Formate benötigen die Eintragsgröße vorab, daher erfordert `add()` aus einem Stream oder Reader in ein `tar*`-Archiv `size` (Strings und `add_file` liefern sie mit). Der Zip-Writer streamt mittels Data Descriptors auch zu nicht suchbaren Writern, sodass das Schreiben in einen Antwort-Stream funktioniert.

## Fehler

| Bedingung | Kind |
|-----------|------|
| Quelle ist kein fs-Handle, keine fs-Datei, keine Bytes und kein Reader mit wahlfreiem Zugriff | `errors.INVALID` |
| Unbekanntes / nicht passendes Format | `errors.INVALID` |
| Beschädigtes oder abgeschnittenes Archiv | `errors.INVALID` |
| Grenzwert überschritten (Einträge / gesamt / Datei / inline) | `errors.INVALID` |
| Wahlfreier Zugriff auf ein reines Stream-Format (`scan` verwenden) | `errors.UNAVAILABLE` |
| Eintragsname nicht gefunden | `errors.NOT_FOUND` |
| Quelle nicht lesbar / Ziel nicht beschreibbar | `errors.PERMISSION_DENIED` |
| Lesen eines veralteten gestreamten Eintrags, nachdem der Walk weitergeschaltet hat | `errors.INTERNAL` |

Siehe [Fehlerbehandlung](lua/core/errors.md) für den Umgang mit Fehlern.

## Siehe auch

- [Dateisystem](lua/storage/filesystem.md) - Quell- und Ziel-Dateisysteme
- [Stream](lua/core/stream.md) - Stream-Objekte, die an Archive übergeben und von ihnen zurückgegeben werden
- [Kompression](lua/data/compress.md) - gzip/deflate/zstd im Speicher
- [Cloud Storage](lua/storage/cloud.md) - `open_reader` als Archivquelle mit wahlfreiem Zugriff
