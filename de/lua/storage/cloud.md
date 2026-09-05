---
title: "Cloud-Speicher"
description: "Zugriff auf S3-kompatiblen Objektspeicher. Objekte hochladen, herunterladen, auflisten und verwalten, URLs für Download, Upload und Multipart-Teile…"
---

# Cloud-Speicher
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

Zugriff auf S3-kompatiblen Objektspeicher. Objekte hochladen, herunterladen, auflisten und verwalten, URLs für Download, Upload und Multipart-Teile vorsignieren sowie Objekte mit wahlfreiem Zugriff lesen.

Für Speicherkonfiguration siehe [Cloud-Speicher](system/cloudstorage.md).

## Laden

```lua
local cloudstorage = require("cloudstorage")
```

## Speicher abrufen

Holen Sie eine Cloud-Speicherressource anhand der Registry-ID:

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

storage:upload_object("data/file.txt", "content")
storage:release()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Speicherressourcen-ID |

**Gibt zurück:** `Storage, error`

## Objekte hochladen

Inhalt aus String oder Datei hochladen:

```lua
local storage = cloudstorage.get("app.infra:files")

-- String-Inhalt hochladen
local ok, err = storage:upload_object("reports/daily.json", json.encode({
    date = "2024-01-15",
    total = 1234
}))

-- Aus Datei hochladen
local fs = require("fs")
local vol = fs.get("app:data")
local file = vol:open("/large-file.bin", "r")

storage:upload_object("backups/large-file.bin", file)
file:close()

storage:release()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Objektschlüssel/Pfad |
| `content` | string oder Reader | Inhalt als String oder Datei-Reader |
| `options` | table | Optionale Metadaten und Optionen für bedingtes Schreiben |

**Gibt zurück:** `boolean, error`

### Upload-Optionen

Hängen Sie Metadaten an oder schützen Sie das Schreiben mit einer Optionstabelle:

```lua
storage:upload_object("reports/daily.json", body, {
    content_type = "application/json",
    cache_control = "max-age=3600",
    metadata = { owner = "team-a", run_id = "1234" },  -- gespeichert als x-amz-meta-*
    only_if_absent = true                              -- schlägt fehl, wenn der Schlüssel bereits existiert
})
```

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `content_type` | string | MIME-Typ |
| `cache_control` | string | Cache-Control-Header |
| `content_disposition` | string | Content-Disposition-Header |
| `content_encoding` | string | Content-Encoding-Header |
| `metadata` | table | Benutzer-Metadaten (string-Schlüssel/-Werte), gespeichert als `x-amz-meta-*` |
| `headers` | table | Zusätzliche Request-Header (string-Schlüssel/-Werte) |
| `if_match` | string | Nur schreiben, wenn das aktuelle Objekt-ETag übereinstimmt |
| `if_none_match` | string | Nur schreiben, wenn kein Objekt mit dem ETag übereinstimmt (`"*"` bedeutet beliebig) |
| `only_if_absent` | boolean | Nur schreiben, wenn der Schlüssel nicht existiert (Alias für `if_none_match = "*"`) |

Ein bedingtes Schreiben, dessen Vorbedingung fehlschlägt, gibt einen `precondition_failed`-Fehler zurück.

## Objekte herunterladen

Objekt in einen Datei-Writer herunterladen:

```lua
local storage = cloudstorage.get("app.infra:files")
local fs = require("fs")
local vol = fs.get("app:temp")

local file = vol:open("/downloaded.json", "w")
local ok, err = storage:download_object("reports/daily.json", file)
file:close()

-- Teilinhalt herunterladen (erste 1KB)
local partial = vol:open("/partial.bin", "w")
storage:download_object("backups/large-file.bin", partial, {
    range = "bytes=0-1023"
})
partial:close()

storage:release()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Herunterzuladender Objektschlüssel |
| `writer` | Writer | Ziel-Datei-Writer |
| `options.range` | string | Byte-Bereich (z.B. "bytes=0-1023") |
| `options.if_match` | string | Nur herunterladen, wenn das Objekt-ETag übereinstimmt |
| `options.if_none_match` | string | Nur herunterladen, wenn das ETag nicht übereinstimmt |

**Gibt zurück:** `boolean, error`

Eine fehlgeschlagene Vorbedingung (`if_match`/`if_none_match`) gibt einen `precondition_failed`-Fehler zurück.

## Objekte auflisten

Objekte mit optionaler Präfix-Filterung auflisten:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.etag)
end

-- Durch große Ergebnisse paginieren
local token = nil
repeat
    local result = storage:list_objects({
        prefix = "logs/",
        max_keys = 1000,
        continuation_token = token
    })
    for _, obj in ipairs(result.objects) do
        process(obj)
    end
    token = result.next_continuation_token
until not result.is_truncated

storage:release()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `options.prefix` | string | Nach Schlüssel-Präfix filtern |
| `options.max_keys` | integer | Maximale Anzahl zurückzugebender Objekte |
| `options.continuation_token` | string | Paginierungs-Token |
| `options.include_owner` | boolean | Den `owner` jedes Objekts einbeziehen (`id`, `display_name`) |
| `options.include_versions` | boolean | Objektversionen auflisten; jedes Element enthält `version_id` |

**Gibt zurück:** `table, error`

Ergebnis enthält `objects`, `is_truncated`, `next_continuation_token`. Jedes Objekt hat `key`, `size`, `etag`, `storage_class` sowie optional `last_modified`, `version_id` und `owner`.

<note>
In Listenergebnissen ist <code>content_type</code> immer leer — S3-Listenoperationen geben ihn nicht zurück. Verwenden Sie <code>head_object</code>, um den Content-Type und die Metadaten eines Objekts zu lesen.
</note>

## Objekt-Metadaten

Die Metadaten eines einzelnen Objekts abrufen, ohne dessen Body herunterzuladen:

```lua
local storage = cloudstorage.get("app.infra:files")

local meta, err = storage:head_object("reports/daily.json")
if err then
    return nil, err
end

print(meta.size, meta.etag, meta.content_type)
for k, v in pairs(meta.metadata) do
    print("meta", k, v)
end

storage:release()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Objektschlüssel |

**Gibt zurück:** `table, error`

Ergebnisfelder:

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `size` | integer | Objektgröße in Bytes |
| `etag` | string | Entity-Tag |
| `content_type` | string | MIME-Typ |
| `cache_control` | string | Cache-Control-Header |
| `content_disposition` | string | Content-Disposition-Header |
| `content_encoding` | string | Content-Encoding-Header |
| `storage_class` | string | Speicherklasse |
| `version_id` | string | Versions-ID (vorhanden, wenn Versionierung aktiviert ist) |
| `last_modified` | integer | Zeitpunkt der letzten Änderung (Unix-Sekunden) |
| `metadata` | table | Benutzer-Metadaten (`x-amz-meta-*`) |
| `headers` | table | Rohe Response-Header (kleingeschriebene Schlüssel) |

Ein fehlendes Objekt gibt einen `not_found`-Fehler zurück.

## Objekte löschen

Mehrere Objekte entfernen:

```lua
local storage = cloudstorage.get("app.infra:files")

storage:delete_objects({
    "temp/file1.txt",
    "temp/file2.txt",
    "temp/file3.txt"
})

storage:release()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `keys` | string[] | Array von zu löschenden Objektschlüsseln |

**Gibt zurück:** `boolean, error`

Jeder Schlüssel wird versucht. Das Löschen eines nicht existierenden Schlüssels ist kein Fehler. Meldet der Provider Fehler pro Schlüssel, gibt der Aufruf einen einzelnen Fehler zurück, der jeden fehlgeschlagenen Schlüssel und seinen Provider-Fehlercode nennt.

## Download-URLs

Erstellen Sie eine temporäre URL, die das Herunterladen eines Objekts ohne Anmeldeinformationen ermöglicht. Nützlich zum Teilen von Dateien mit externen Benutzern oder zum Bereitstellen von Inhalten über Ihre Anwendung.

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

local url, err = storage:presigned_get_url("reports/quarterly.pdf", {
    expiration = 3600
})

storage:release()

if err then
    return nil, err
end

-- URL an Client für direkten Download zurückgeben
return {download_url = url}
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Objektschlüssel |
| `options.expiration` | integer | Sekunden bis URL abläuft (Standard: 3600) |

**Gibt zurück:** `string, error`

## Upload-URLs

Erstellen Sie eine temporäre URL, die das Hochladen eines Objekts ohne Anmeldeinformationen ermöglicht. Ermöglicht Clients, Dateien direkt in den Speicher hochzuladen, ohne über Ihren Server zu proxyen.

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

local url, err = storage:presigned_put_url("uploads/user-123/avatar.jpg", {
    expiration = 600,
    content_type = "image/jpeg",
    content_length = 1024 * 1024
})

storage:release()

if err then
    return nil, err
end

-- URL an Client für direkten Upload zurückgeben
return {upload_url = url}
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Objektschlüssel |
| `options.expiration` | integer | Sekunden bis URL abläuft (Standard: 3600) |
| `options.content_type` | string | Erforderlicher Content-Type für Upload |
| `options.content_length` | integer | Maximale Upload-Größe in Bytes |

**Gibt zurück:** `string, error`

## Multipart-Uploads

Ein einzelnes vorsigniertes PUT begrenzt ein Objekt auf 5 GiB. Ein vorsignierter Multipart-Upload teilt ein größeres Objekt in Teile, die ein Client direkt hochlädt und die dann serverseitig zusammengesetzt werden. Multipart ist eine Fähigkeit des Providers: S3 implementiert sie, Provider ohne sie geben `errors.UNAVAILABLE` zurück.

```lua
local storage = cloudstorage.get("app.infra:files")

local mp, err = storage:create_multipart_upload("backups/huge.zip", {
    content_type = "application/zip",
    metadata = { source = "uploader" },
})
if err then return nil, err end

local urls, err = storage:presigned_part_urls("backups/huge.zip", mp.upload_id, {
    count = 3,
    expiration = 900,
})
if err then
    storage:abort_multipart_upload("backups/huge.zip", mp.upload_id)
    return nil, err
end

-- Der Client sendet jede URL per PUT und liefert das ETag aus den Response-Headern zurück.
local done, err = storage:complete_multipart_upload("backups/huge.zip", mp.upload_id, {
    { part_number = 1, etag = etag1 },
    { part_number = 2, etag = etag2 },
    { part_number = 3, etag = etag3 },
})

storage:release()
```

### create_multipart_upload

Startet einen Multipart-Upload für einen Schlüssel.

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `key` | string | Objektschlüssel des finalen Objekts |
| `options` | table | `content_type`, `cache_control`, `content_disposition`, `content_encoding`, `metadata`, `headers` - dieselbe Semantik wie bei `upload_object` |

**Gibt zurück:** `table, error` - die Tabelle enthält `upload_id`, das den Upload für jeden späteren Part-, Complete- und Abort-Aufruf identifiziert.

Bedingte Schreibvorgänge (`if_match`, `if_none_match`, `only_if_absent`) sind nicht Teil des Multipart-Protokolls und werden hier nicht akzeptiert.

### presigned_part_urls

Erzeugt vorsignierte PUT-URLs für Teile eines laufenden Uploads. Jede URL wird mit einem einfachen HTTP-PUT beschrieben; der Uploader muss den `ETag`-Response-Header jedes Teils für `complete_multipart_upload` aufbewahren.

| Parameter | Typ | Standard | Beschreibung |
|-----------|-----|----------|--------------|
| `key` | string | erforderlich | Objektschlüssel |
| `upload_id` | string | erforderlich | Aus `create_multipart_upload` |
| `options.parts` | int[] | - | Explizite Teilnummern (1-10000, keine Duplikate) |
| `options.count` | int | - | Teile `1..count` vorsignieren |
| `options.headers` | table | - | Header, die bei jeder Part-Anfrage erforderlich sind; sie werden signiert und müssen vom Uploader ebenfalls gesendet werden |
| `options.expiration` | int | 3600 | Sekunden bis zum Ablauf der URLs |

Genau eines von `parts` oder `count` ist erforderlich, und ein einzelner Aufruf signiert höchstens 1000 URLs vor - bei sehr großen Objekten seitenweise vorsignieren.

**Gibt zurück:** `table, error` - ein Array von `{ part_number, url }`.

Jeder Teil außer dem letzten muss mindestens 5 MiB groß sein; der Provider erzwingt dies beim Abschluss.

### complete_multipart_upload

Setzt das finale Objekt aus seinen hochgeladenen Teilen zusammen. Teile können in beliebiger Reihenfolge gemeldet werden und werden vor dem Abschluss nach Teilnummer sortiert.

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `key` | string | Objektschlüssel |
| `upload_id` | string | Aus `create_multipart_upload` |
| `parts` | table | Array von `{ part_number = int, etag = string }` |

**Gibt zurück:** `table, error` - `etag`, dazu `version_id` und `location`, sofern der Provider sie meldet. Eine unbekannte Upload-ID gibt `errors.NOT_FOUND` zurück.

### abort_multipart_upload

Verwirft einen laufenden Upload und gibt seine gespeicherten Teile frei.

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `key` | string | Objektschlüssel |
| `upload_id` | string | Aus `create_multipart_upload` |

**Gibt zurück:** `boolean, error`

Ein Upload, der nie abgeschlossen wird, hält seine Teile gespeichert - und abrechnungsrelevant -, bis er abgebrochen wird. Auf jedem Fehlerpfad abbrechen und als Absicherung eine Bucket-Lifecycle-Regel konfigurieren - siehe [Cloud-Speicher](system/cloudstorage.md#multipart-uploads).

## Bereichs-Reader

`open_reader` öffnet wahlfreien Zugriff auf ein Objekt über Ranged-GETs - ohne lokales Zwischenspeichern und ohne vollständigen Download. Der Hauptkonsument ist [`archive.open`](lua/data/archive.md), das mehrere GB große Archive mit begrenztem Speicher direkt aus dem Objektspeicher liest.

```lua
local archive = require("archive")
local storage = cloudstorage.get("app.infra:files")

local reader, err = storage:open_reader("uploads/huge.zip", {
    block_size = 8 * 1024 * 1024,
    cache_blocks = 4,
})
if err then return nil, err end

local r = assert(archive.open(reader))
for e in r:entries() do
    print(e.name, e.size)
end
r:close()
reader:close()

storage:release()
```

| Parameter | Typ | Standard | Beschreibung |
|-----------|-----|----------|--------------|
| `key` | string | erforderlich | Objektschlüssel |
| `options.block_size` | int | 8388608 | Einheit des Ranged-GET in Bytes (64 KiB bis 128 MiB) |
| `options.cache_blocks` | int | 4 | Im Speicher gehaltene LRU-Blöcke (1 bis 64) |

`block_size * cache_blocks` darf 256 MiB nicht überschreiten. Ein fehlendes Objekt gibt `errors.NOT_FOUND` zurück.

**Gibt zurück:** `Reader, error`

Das ETag des Objekts wird beim Öffnen des Readers fixiert und bei jedem Bereichs-Lesevorgang als `If-Match` gesendet, sodass ein während des Lesens überschriebenes Objekt mit `errors.CONFLICT` fehlschlägt, statt eine Mischung aus zwei Objektgenerationen zu liefern. Ein Provider, der kein ETag liefern kann, gibt `errors.UNAVAILABLE` zurück; der Reader liefert nie ein nicht fixiertes Objekt.

Lesevorgänge mit Cache-Miss führen blockierende Netzwerk-IO in der aufrufenden Task aus und serialisieren gleichzeitige Reader, sodass sequenzieller Zugriff pro Eintrag - das Archiv-Muster - die vorgesehene Form ist.

### Reader-Methoden

| Methode | Gibt zurück | Beschreibung |
|---------|-------------|--------------|
| `size()` | `integer` | Objektgröße in Bytes, aus dem Stat beim Öffnen |
| `key()` | `string` | Objektschlüssel, aus dem der Reader liest |
| `close()` | `boolean, error` | Blockcache freigeben; idempotent |

Der Reader wird am Ende des Task-Scopes automatisch geschlossen, wenn er nicht explizit geschlossen wird.

## Storage-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `upload_object(key, content, opts?)` | `boolean, error` | String- oder Dateiinhalt hochladen |
| `download_object(key, writer, opts?)` | `boolean, error` | In Datei-Writer herunterladen |
| `head_object(key)` | `table, error` | Objekt-Metadaten abrufen |
| `list_objects(opts?)` | `table, error` | Objekte mit Präfix-Filter auflisten |
| `delete_objects(keys)` | `boolean, error` | Mehrere Objekte löschen |
| `presigned_get_url(key, opts?)` | `string, error` | Temporäre Download-URL generieren |
| `presigned_put_url(key, opts?)` | `string, error` | Temporäre Upload-URL generieren |
| `create_multipart_upload(key, opts?)` | `table, error` | Einen vorsignierten Multipart-Upload starten |
| `presigned_part_urls(key, upload_id, opts)` | `table, error` | PUT-URLs für Upload-Teile vorsignieren |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | Das Objekt aus den hochgeladenen Teilen zusammensetzen |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | Einen laufenden Multipart-Upload verwerfen |
| `open_reader(key, opts?)` | `Reader, error` | Einen Bereichs-Reader mit wahlfreiem Zugriff öffnen |
| `release()` | `boolean` | Speicherressource freigeben |

## Berechtigungen

Cloud-Speicheroperationen unterliegen der Sicherheitsrichtlinienauswertung.

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `cloudstorage.get` | Speicher-ID | Eine Speicherressource abrufen |

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leere Ressourcen-ID | `errors.INVALID` | nein |
| Ressource nicht gefunden | `errors.NOT_FOUND` | nein |
| Keine Cloud-Speicherressource | `errors.INVALID` | nein |
| Speicher freigegeben | `errors.INVALID` | nein |
| Leerer Schlüssel | `errors.INVALID` | nein |
| Inhalt nil | `errors.INVALID` | nein |
| Writer nicht gültig | `errors.INVALID` | nein |
| Objekt nicht gefunden | `errors.NOT_FOUND` | nein |
| Unbekannte Upload-ID | `errors.NOT_FOUND` | nein |
| Bedingte Vorbedingung fehlgeschlagen | `errors.CONFLICT` | nein |
| Objekt während eines Bereichs-Lesevorgangs überschrieben | `errors.CONFLICT` | nein |
| Provider unterstützt keine Multipart-Uploads | `errors.UNAVAILABLE` | nein |
| Provider liefert kein ETag für `open_reader` | `errors.UNAVAILABLE` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |
| Operation fehlgeschlagen | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
