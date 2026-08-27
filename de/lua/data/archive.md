---
title: "Archive"
description: "ZIP-, TAR-, gzip-komprimierte TAR- und Zstandard-komprimierte TAR-Archive lesen, durchsuchen, extrahieren und erstellen."
---

# Archive
<secondary-label ref="function"/>
<secondary-label ref="io"/>
<secondary-label ref="encoding"/>

Das Modul `archive` liest und schreibt Archive der ZIP- und TAR-Familie über Random-Access-Reader, sequenzielle Streams und Dateisystemziele.

Dies ist eine API-Referenz mit unvollständigen E/A-Rezepten. Die Streaming-Operationen begrenzen Puffer zum Kopieren von Einträgen, doch Metadaten, Codec-Zustand, Quellen aus Rohbytes und Ergebnisse von `read()` belegen weiterhin Arbeitsspeicher. Verwenden Sie für große Archive mit wahlfreiem Zugriff seekfähige Dateien oder Ranged Reader, `scan()` für ausschließlich vorwärts lesbare Eingaben und für die Anwendung geeignete explizite Grenzwerte.

## Laden

```lua
local archive = require("archive")
```

Fügen Sie `archive` zur Liste `modules:` des ausführbaren Eintrags hinzu, bevor Sie es laden. Rezepte mit Dateisystemen, Cloud-Readern oder HTTP-Streams benötigen außerdem diese Fähigkeiten und die zugehörigen Sicherheitsrichtlinien.

## Formate

Das Modul erkennt integrierte Formate an Magic Bytes oder verwendet das in `opts.format` angegebene Format.

| Format | Wahlfreies Lesen | Sequenzieller Scan | Schreiben |
|--------|:----------------:|:------------------:|:---------:|
| `zip` | ja | ja (lokale Header) | ja |
| `tar` | ja | ja | ja |
| `tar.gz` | nein | ja | ja |
| `tar.zst` | nein | ja | ja |

`archive.formats()` gibt die Liste registrierter Formatnamen zurück.

```lua
local names = archive.formats()  -- {"zip", "tar", "tar.gz", "tar.zst", ...}
```

## Optionen

Jeder Einstiegspunkt akzeptiert eine optionale Tabelle `opts`:

| Schlüssel | Standardwert | Bedeutung |
|-----------|--------------|-----------|
| `format` | auto | `"zip"`, `"tar"`, `"tar.gz"`, `"tar.zst"`; auto = Magic Bytes erkennen, andernfalls Dateiendung |
| `max_entries` | 100000 | Archive mit mehr Einträgen zurückweisen (Schutz vor Dekompressionsbomben) |
| `max_total_bytes` | 2 GiB | Kumulatives Limit der unkomprimierten Ausgabe für `extract_all()` |
| `max_file_bytes` | 1 GiB | Limit der unkomprimierten Größe eines einzelnen Eintrags |
| `max_inline_bytes` | 16 MiB | Hartes Limit für den im RAM materialisierenden Aufruf `read()`; darüber `stream()`/`extract()` verwenden |
| `buffer_bytes` | 64 KiB | Kopierpuffer für Streaming-Extract-/Add-Pfade; begrenzt die Allokation von `read()` nicht |

`max_file_bytes` begrenzt jeden Eintrag, während `max_total_bytes` nur von `extract_all()` des Readers und Walkers erzwungen wird. Anwendungen, die `read()`, `stream()`, `extract()` für einen Eintrag oder manuelles Walking verwenden, müssen ihr eigenes kumulatives Budget durchsetzen. `max_inline_bytes` begrenzt die durch `read()` materialisierten Eintragsdaten; `buffer_bytes` tut dies nicht. Diese Limits umfassen nicht alle Metadaten- und Codec-Allokationen.

## Lesen — wahlfreier Zugriff

`archive.open(source, ...)` öffnet eine **seekfähige** Quelle für vollständigen wahlfreien Zugriff. Das zentrale ZIP-Verzeichnis wird vorab gelesen; Einträge werden bei Bedarf dekomprimiert. Die Quelle kann ein `fs.FS`-Handle mit Pfad, eine offene `fs.File`, ein Cloud-Storage-Reader oder Rohbytes sein. Rohbytes halten das gesamte Archiv im RAM und eignen sich nur für kleine Archive.

```lua
local fs = require("fs")
local archive = require("archive")

-- Open by fs handle + path (the module opens the file and owns its lifecycle)
local uploads, fs_err = fs.get("app:uploads")
if fs_err then return nil, fs_err end
local r, err = archive.open(uploads, "incoming.zip")
if err then return nil, err end
-- Or from an already-open seekable fs.File
-- local r, err = archive.open(open_file)
-- Or from raw bytes (small archives only)
-- local r, err = archive.open(zip_bytes, { format = "zip" })
```

Übergeben Sie für ein großes Archiv im Cloud-Speicher den von `open_reader` zurückgegebenen Ranged Reader:

```lua
local cloudstorage = require("cloudstorage")

local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end
local source, source_err = storage:open_reader("uploads/large.zip")
if source_err then
    storage:release()
    return nil, source_err
end
local r, archive_err = archive.open(source)
if archive_err then
    source:close()
    storage:release()
    return nil, archive_err
end

-- Read archive entries here.

local _, reader_close_err = r:close()
local _, source_close_err = source:close()
storage:release()
if reader_close_err then return nil, reader_close_err end
if source_close_err then return nil, source_close_err end
```

Der Archiv-Reader besitzt eine Datei, die er aus einem `fs.FS`-Handle und Pfad öffnet. Eine extern bereitgestellte `fs.File` oder einen Ranged Reader besitzt er nicht; schließen Sie zuerst den Archiv-Reader und danach vom Aufrufer verwaltete Eingaben und Handles.

**Rückgabe:** `Reader, error`

**Berechtigung:** `archive.read`

### `entries`

Über Eintragsmetadaten iterieren, ohne die Inhalte zu dekomprimieren:

```lua
for e in r:entries() do
    -- e: name, size, compressed_size, is_dir, mode, modified, method, crc32, type
    print(e.name, e.size, e.is_dir)
end
```

### `stat`

Eintragsmetadaten anhand des Namens lesen, ohne den Inhalt zu dekomprimieren:

```lua
local info, err = r:stat("docs/readme.md")
if err then return nil, err end
```

### `read`

Einen einzelnen Eintrag als Lua-String materialisieren. Oberhalb von `max_inline_bytes` wird ein Fehler mit `kind = Invalid` zurückgegeben; verwenden Sie für große Inhalte `stream()` oder `extract()`:

```lua
local data, err = r:read("docs/readme.md")  -- small entries only
if err then return nil, err end
```

### `stream`

Einen Eintrag als `stream.Stream` zurückgeben, der bei Bedarf dekomprimiert. Das Ergebnis kann gescannt, an `fs:writefile()` übergeben oder einem anderen Stream-Konsumenten bereitgestellt werden:

```lua
local es, err = r:stream("big.csv")
if err then return nil, err end
while true do
    local chunk, read_err = es:read(65536)
    if read_err then
        es:close()
        return nil, read_err
    end
    if not chunk then break end
    process(chunk)
end
local _, close_err = es:close()
if close_err then return nil, close_err end
```

### `extract`

Einen Eintrag in ein Zieldateisystem streamen:

```lua
local out, fs_err = fs.get("app:out")
if fs_err then return nil, fs_err end
local ok, err = r:extract("docs/readme.md", out)
if err then return nil, err end
-- optional destination path:
-- r:extract("docs/readme.md", out, "readme.md")
```

### `extract_all`

Alle Einträge in ein Zieldateisystem streamen:

```lua
local out, fs_err = fs.get("app:out")
if fs_err then return nil, fs_err end
local count, err = r:extract_all(out, {
    prefix = "job123/",          -- prepend to each destination path
    strip  = 1,                  -- drop N leading path components
    filter = function(e) return not e.is_dir end,
})
if err then return nil, err end
```

Lösen Sie das Zieldateisystem separat im Anwendungscode auf, damit Fehler von `fs.get` behandelt werden können. Bei `extract` für einen Eintrag ergeben unsichere Zielnamen einen Fehler. `extract_all` überspringt Einträge, deren resultierender Pfad `..` enthält, absolut ist oder ein Windows-Laufwerks- beziehungsweise UNC-Präfix besitzt.

### `close`

Den Reader schließen. Die Operation ist idempotent; der Reader wird außerdem am Ende des Task-Geltungsbereichs automatisch geschlossen.

```lua
local ok, err = r:close()
if err then return nil, err end
```

## Lesen — sequenzieller Scan

`archive.scan(source, opts?)` öffnet eine **ausschließlich vorwärts lesbare** Quelle wie einen HTTP-Upload-Body oder Multipart-Dateistream. Einträge werden in Archivreihenfolge besucht; jeder Eintrags-Reader bleibt nur gültig, bis der Walk fortschreitet. Wahlfreier Zugriff mit `read(name)` ist nicht verfügbar.

```lua
local up, stream_err = form.files.upload[1]:stream()        -- stream.Stream
if stream_err then return nil, stream_err end
local s, err = archive.scan(up, { format = "zip" })
if err then
    up:close()
    return nil, err
end

local uploads, fs_err = fs.get("app:uploads")
if fs_err then
    s:close()
    up:close()
    return nil, fs_err
end

local count, extract_err = s:extract_all(uploads, {prefix = "job123/"})
if extract_err then
    s:close()
    up:close()
    return nil, extract_err
end
local _, close_err = s:close()
local _, upload_close_err = up:close()
if close_err then return nil, close_err end
if upload_close_err then return nil, upload_close_err end
```

**Rückgabe:** `Walker, error`

**Berechtigung:** `archive.read`

`extract_all` wendet dieselbe Bereinigung von Zielpfaden und dieselbe Gesamtgrößenbegrenzung wie oben beschrieben an. Wenn eine Anwendung stattdessen `s:walk()` direkt fortsetzt, werden Iteratorfehler als Lua-Fehler ausgelöst, und jeder Eintragsstream ist nur bis zur nächsten Iteration gültig. Die Bereinigung im Task-Geltungsbereich gibt Walker und aktuellen Eintragsstream weiterhin frei; schließen Sie vom Aufrufer verwaltete Eingabestreams ausdrücklich, wenn die Kontrolle in der Anwendung bleibt.

`tar`, `tar.gz` und `tar.zst` streamen nativ. `zip` wird über lokale Header pro Eintrag geparst; Einträge mit einem Streaming-Data-Descriptor, bei denen Größe und CRC hinter den Daten stehen, werden bis zur Eintragsgrenze dekomprimiert. Für robuste Verarbeitung großer ZIP-Uploads schreiben Sie den Upload zunächst als begrenzte sequenzielle Kopie in eine Datei und verwenden anschließend `archive.open`:

```lua
local uuid = require("uuid")

local dst, fs_err = fs.get("app:tmp")
if fs_err then return nil, fs_err end
local upload, stream_err = req:stream()
if stream_err then return nil, stream_err end
local stage_id, id_err = uuid.v7()
if id_err then
    upload:close()
    return nil, id_err
end
local stage_path = stage_id .. ".zip"
local copied, copy_err = dst:writefile(stage_path, upload, "wx")
local _, upload_close_err = upload:close()
if copy_err or upload_close_err then
    dst:remove(stage_path)
    return nil, copy_err or upload_close_err
end
local r, open_err = archive.open(dst, stage_path)   -- robust random access
if open_err then
    dst:remove(stage_path)
    return nil, open_err
end

-- Replace this operation with the random-access work the handler needs.
local info, operation_err = r:stat("manifest.json")
local _, close_err = r:close()
local removed, remove_err = dst:remove(stage_path)
if operation_err then return nil, operation_err end
if close_err then return nil, close_err end
if remove_err then return nil, remove_err end
return info
```

Jede Anfrage erzeugt einen unvorhersagbaren Staging-Namen und legt ihn exklusiv an, sodass gleichzeitige Handler ihre Dateien nicht gegenseitig kürzen können. Nach dem Versuch, die Staging-Datei zu entfernen, wird der primäre Kopier-, Upload-Close-, Open- oder Archivoperationsfehler zurückgegeben. Produktionshandler können einen Bereinigungsfehler separat protokollieren, wenn bereits ein primärer Fehler vorliegt. Fügen Sie für dieses Rezept `uuid` zur Modul-Allowlist des ausführbaren Eintrags hinzu.

## Schreiben

`archive.create(dest, ...)` streamt Einträge in einen Dateisystempfad, eine offene beschreibbare Datei oder einen beschreibbaren `stream.Stream`.

```lua
local tmp, fs_err = fs.get("app:tmp")
if fs_err then return nil, fs_err end
local w, err = archive.create(tmp, "out.zip", { format = "zip" })
if err then return nil, err end
```

**Rückgabe:** `Writer, error`

**Berechtigung:** `archive.write`

### `add`

Einen Eintrag aus einem Lua-String mit Text oder Bytes, einer offenen `fs.File` oder einem `stream.Stream` hinzufügen:

```lua
local ok, err = w:add("notes.txt", "hello")
if err then return nil, err end
local added, add_err = w:add("from_upload", some_stream, { method = "deflate", mode = 420 }) -- 0644
if add_err then return nil, add_err end
```

### `add_file`

Einen Eintrag aus einer Datei in einem Dateisystem streamen:

```lua
local data_fs, fs_err = fs.get("app:data")
if fs_err then return nil, fs_err end
local ok, err = w:add_file("data/big.bin", data_fs, "big.bin")
if err then return nil, err end
```

### `add_dir`

Einen Verzeichniseintrag hinzufügen:

```lua
local ok, err = w:add_dir("empty/")
if err then return nil, err end
```

### `close`

Das Archiv einschließlich des zentralen ZIP-Verzeichnisses finalisieren. Die Operation ist idempotent; der Writer wird außerdem am Ende des Task-Geltungsbereichs automatisch geschlossen.

```lua
local ok, err = w:close()
if err then return nil, err end
```

Die Optionen von `add` lauten `{method = "store"|"deflate", mode, size}`. `size` ist erforderlich, wenn einem Archiv der TAR-Familie ein Stream hinzugefügt wird; Stringwerte und `add_file` liefern ihre Größe automatisch. `add_file` akzeptiert `method` und `mode`; `add_dir` besitzt keine Optionen. Der ZIP-Writer verwendet Data Descriptors, wenn sein Ziel ein nicht seekfähiger beschreibbarer Stream ist.

Numerische Lua-Literale sind dezimal; verwenden Sie `420` für die Unix-Berechtigungsbits, die üblicherweise oktal als `0644` geschrieben werden.

Der Writer schließt keine extern bereitgestellte Datei und keinen Stream, die beziehungsweise der als Eintragsquelle oder Archivziel dient. Schließen Sie vom Aufrufer verwaltete Ressourcen nach `w:close()`.

## Fehler

| Bedingung | Art |
|-----------|-----|
| Unbekanntes / nicht passendes Format | `errors.INVALID` |
| Vom aktuellen Lua-Wrapper gemeldetes beschädigtes oder abgeschnittenes Archiv | `errors.INTERNAL` |
| Gesamtlimit von Inline-`read()` oder `extract_all` überschritten | `errors.INVALID` |
| Beim Öffnen oder Lesen über den aktuellen Lua-Wrapper erreichtes Eintrags-/Archivlimit | `errors.INTERNAL` |
| Wahlfreier Zugriff auf ein reines Streaming-Format (`scan` verwenden) | `errors.UNAVAILABLE` |
| Eintragsname nicht gefunden | `errors.NOT_FOUND` |
| Archivrichtlinie verweigert | `errors.PERMISSION_DENIED` |
| E/A-Fehler der Quelle oder des Ziels | `errors.INTERNAL` |
| Veralteten gestreamten Eintrag lesen, nachdem der Walk fortgeschritten ist | `errors.INTERNAL` |

Unter [Fehlerbehandlung](../core/errors.md) erfahren Sie, wie Sie mit Fehlern arbeiten.

## Siehe auch

- [Dateisystem](../storage/filesystem.md) - Quell- und Zieldateisysteme
- [Cloud-Speicher](../storage/cloud.md) - Ranged Reader für in der Cloud gespeicherte Archive
- [Stream](../core/stream.md) - An Archive übergebene und von ihnen zurückgegebene Streamobjekte
- [Komprimierung](./compress.md) - gzip/deflate/zstd im Arbeitsspeicher
