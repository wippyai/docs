---
title: "Cloud-Speicher"
description: "Objekte in S3-kompatiblem Speicher hochladen, herunterladen, auflisten und verwalten."
---

# Cloud-Speicher
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

Das Modul `cloudstorage` lädt Objekte in S3-kompatiblen Speicher hoch, lädt sie herunter, listet sie auf und verwaltet sie. Außerdem erzeugt es vorsignierte URLs für direkten Zugriff.

Diese Seite ist eine API-Referenz. Ihre Ausschnitte setzen einen konfigurierten Speichereintrag, Zugriff auf jedes von ihnen genannte Dateisystem-Volume und die unten aufgeführten Berechtigungen voraus. Die Blöcke zu mehrteiligen Uploads und vorsignierten URLs sind Teilrezepte für die Client-Integration; die Anwendung muss die HTTP-Übertragungen ausführen und die zurückgegebenen ETags bereitstellen. Wenn sowohl eine Operation als auch die Ressourcenbereinigung fehlschlagen können, stellt die umgebende Anwendung `report_cleanup_error(err)` bereit. Die Funktion zeichnet den Bereinigungsfehler auf, ohne den ursprünglichen Fehler zu ersetzen.

Informationen zur Speicherkonfiguration finden Sie unter [Cloud-Speicher](../../system/cloudstorage.md).

## Laden

```lua
local cloudstorage = require("cloudstorage")
```

## Speicher abrufen

Rufen Sie eine Cloud-Speicherressource anhand ihrer Registry-ID ab:

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

local uploaded, upload_err = storage:upload_object("data/file.txt", "content")
storage:release()
if upload_err then return nil, upload_err end
return uploaded
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Speicherressourcen-ID |

**Gibt zurück:** `Storage, error`

## Objekte hochladen

Inhalt aus String oder Datei hochladen:

```lua
local json = require("json")

local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

-- Upload string content
local body, encode_err = json.encode({
    date = "2024-01-15",
    total = 1234
})
if encode_err then
    storage:release()
    return nil, encode_err
end
local ok, err = storage:upload_object("reports/daily.json", body)
if err then
    storage:release()
    return nil, err
end

-- Upload from file
local fs = require("fs")
local vol, fs_err = fs.get("app:data")
if fs_err then
    storage:release()
    return nil, fs_err
end
local file, open_err = vol:open("/large-file.bin", "r")
if open_err then
    storage:release()
    return nil, open_err
end

local uploaded, file_upload_err = storage:upload_object("backups/large-file.bin", file)
local _, close_err = file:close()

storage:release()
if file_upload_err then
    if close_err then report_cleanup_error(close_err) end
    return nil, file_upload_err
end
if close_err then return nil, close_err end
return uploaded
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
local uploaded, err = storage:upload_object("reports/daily.json", body, {
    content_type = "application/json",
    cache_control = "max-age=3600",
    metadata = { owner = "team-a", run_id = "1234" },  -- stored as x-amz-meta-*
    only_if_absent = true                              -- fail if the key already exists
})
if err then return nil, err end
return uploaded
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

Ein bedingter Schreibvorgang mit nicht erfüllter Vorbedingung gibt einen `precondition_failed`-Fehler zurück.

## Objekte herunterladen

Objekt in einen Datei-Writer herunterladen:

```lua
local fs = require("fs")
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end
local vol, fs_err = fs.get("app:temp")
if fs_err then
    storage:release()
    return nil, fs_err
end

local file, open_err = vol:open("/downloaded.json", "w")
if open_err then
    storage:release()
    return nil, open_err
end
local ok, err = storage:download_object("reports/daily.json", file)
local _, close_err = file:close()
if err then
    if close_err then report_cleanup_error(close_err) end
    storage:release()
    return nil, err
end
if close_err then
    storage:release()
    return nil, close_err
end

-- Download partial content (first 1KB)
local partial, partial_open_err = vol:open("/partial.bin", "w")
if partial_open_err then
    storage:release()
    return nil, partial_open_err
end
local partial_ok, partial_err = storage:download_object("backups/large-file.bin", partial, {
    range = "bytes=0-1023"
})
local _, partial_close_err = partial:close()

storage:release()
if partial_err then
    if partial_close_err then report_cleanup_error(partial_close_err) end
    return nil, partial_err
end
if partial_close_err then return nil, partial_close_err end
return partial_ok
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
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})
if err then
    storage:release()
    return nil, err
end

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.etag)
end

-- Paginate through large results
local token = nil
repeat
    local page, page_err = storage:list_objects({
        prefix = "logs/",
        max_keys = 1000,
        continuation_token = token
    })
    if page_err then
        storage:release()
        return nil, page_err
    end
    for _, obj in ipairs(page.objects) do
        process(obj)
    end
    token = page.next_continuation_token
    if not page.is_truncated then break end
until false

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
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local meta, err = storage:head_object("reports/daily.json")
if err then
    storage:release()
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
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local deleted, err = storage:delete_objects({
    "temp/file1.txt",
    "temp/file2.txt",
    "temp/file3.txt"
})

storage:release()
if err then return nil, err end
return deleted
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `keys` | string[] | Array von zu löschenden Objektschlüsseln |

**Gibt zurück:** `boolean, error`

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

-- Return URL to client for direct download
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

-- Return URL to client for direct upload
return {upload_url = url}
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Objektschlüssel |
| `options.expiration` | integer | Sekunden bis URL abläuft (Standard: 3600) |
| `options.content_type` | string | Erforderlicher Content-Type für Upload |
| `options.content_length` | integer | Erwartete exakte Upload-Länge in Bytes |

**Gibt zurück:** `string, error`

## URLs für mehrteilige Uploads

Für große Client-Uploads erstellen Sie einen mehrteiligen Upload, erzeugen vorsignierte URLs für seine Teile und schließen ihn mit den von den Teilanforderungen zurückgegebenen ETags ab. Die umgebende Anwendung stellt `report_cleanup_error(err)` bereit, damit ein Fehler beim Abbruch sichtbar bleibt, ohne den ursprünglichen Upload-Fehler zu ersetzen:

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local key = "uploads/user-123/video.mp4"
local upload, err = storage:create_multipart_upload(key, {
    content_type = "video/mp4"
})
if err then
    storage:release()
    return nil, err
end

local urls, err = storage:presigned_part_urls(key, upload.upload_id, {
    count = 3,
    expiration = 900
})
if err then
    local _, abort_err = storage:abort_multipart_upload(key, upload.upload_id)
    storage:release()
    if abort_err then
        report_cleanup_error(abort_err)
    end
    return nil, err
end

-- Upload each part to its URL and retain the ETag response header.
local completed, err = storage:complete_multipart_upload(key, upload.upload_id, {
    {part_number = 1, etag = part_1_etag},
    {part_number = 2, etag = part_2_etag},
    {part_number = 3, etag = part_3_etag}
})
if err then
    local _, abort_err = storage:abort_multipart_upload(key, upload.upload_id)
    storage:release()
    if abort_err then
        report_cleanup_error(abort_err)
    end
    return nil, err
end

storage:release()
return completed
```

`presigned_part_urls` akzeptiert genau eine der Optionen `count` oder `parts`. Ein Aufruf kann höchstens 1.000 URLs zurückgeben; Teilenummern liegen zwischen 1 und 10.000. Der Standardwert für `expiration` beträgt 3.600 Sekunden, und optionale `headers` werden in die Signatur aufgenommen. `create_multipart_upload` akzeptiert `content_type`, `cache_control`, `content_disposition`, `content_encoding`, `metadata` und `headers`. Abschlussanforderungen dürfen die Teile in beliebiger Reihenfolge aufführen.

| Methode | Gibt zurück | Beschreibung |
|---------|--------------|--------------|
| `create_multipart_upload(key, opts?)` | `table, error` | Upload starten und `{upload_id}` zurückgeben |
| `presigned_part_urls(key, upload_id, opts)` | `table[], error` | Datensätze vom Typ `{part_number, url}` zurückgeben |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | Upload abschließen und sein ETag sowie optional Version und Speicherort zurückgeben |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | Unvollständigen Upload abbrechen |

Brechen Sie Uploads ab, die nicht abgeschlossen werden. Bucket-Lebenszyklusregeln sind ein Sicherheitsnetz für verwaiste Uploads, aber kein Ersatz für eine explizite Bereinigung. Mehrteilige Methoden geben `errors.UNAVAILABLE` zurück, wenn der konfigurierte Provider die erforderliche Fähigkeit nicht unterstützt.

## Reader mit wahlfreiem Zugriff

`open_reader` stellt ein positionierbares, schreibgeschütztes Objekt bereit, ohne es vollständig herunterzuladen. Bei Cache-Fehltreffern ruft der Reader Bereiche ab und sendet das beim Öffnen ermittelte ETag des Objekts als `If-Match`-Bedingung. Provider, die diese Bedingung durchsetzen, geben bei einer Änderung des Objekts `errors.CONFLICT` zurück, anstatt Versionen zu vermischen.

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local reader, err = storage:open_reader("archives/large.zip", {
    block_size = 8 * 1024 * 1024,
    cache_blocks = 4
})
if err then
    storage:release()
    return nil, err
end

print(reader:key(), reader:size())

local _, close_err = reader:close()
storage:release()
if close_err then return nil, close_err end
```

| Option | Standardwert | Gültiger Bereich |
|--------|--------------|------------------|
| `block_size` | 8 MiB | 64 KiB bis 128 MiB |
| `cache_blocks` | 4 | 1 bis 64 |

Der Cache (`block_size * cache_blocks`) darf 256 MiB nicht überschreiten. Cache-Fehltreffer führen blockierende Netzwerkzugriffe aus und werden serialisiert. Der Reader ist daher für sequenzielle Verbraucher mit wahlfreiem Zugriff gedacht, etwa Archiv-Reader. Der Provider muss ein ETag liefern; andernfalls gibt das Öffnen des Readers `errors.UNAVAILABLE` zurück. Ein Provider, der zwar ein ETag liefert, Vorbedingungen bei Bereichslesevorgängen aber ignoriert, kann die Erkennung von Überschreibungen nicht gewährleisten.

| Reader-Methode | Gibt zurück | Beschreibung |
|----------------|--------------|--------------|
| `size()` | `number` | Objektgröße in Bytes |
| `key()` | `string` | Objektschlüssel |
| `close()` | `boolean, error` | Reader schließen; idempotent |

Reader werden am Ende einer Task automatisch geschlossen. Schließen Sie sie dennoch ausdrücklich, sobald die Arbeit beendet ist.

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
| `create_multipart_upload(key, opts?)` | `table, error` | Mehrteiligen Upload starten |
| `presigned_part_urls(key, upload_id, opts)` | `table[], error` | URLs für mehrteiligen Upload erzeugen |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | Mehrteiligen Upload abschließen |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | Mehrteiligen Upload abbrechen |
| `open_reader(key, opts?)` | `Reader, error` | Positionierbaren Reader für Bereichszugriffe öffnen |
| `release()` | `boolean` | Speicherressource freigeben |

## Berechtigungen

Cloud-Speicheroperationen unterliegen der Auswertung der Sicherheitsrichtlinien.

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
| Bedingte Vorbedingung fehlgeschlagen | `errors.CONFLICT` | nein |
| Objekt wurde geändert, während ein Bereichs-Reader geöffnet war | `errors.CONFLICT` | nein |
| Mehrteiliger Upload nicht gefunden | `errors.NOT_FOUND` | nein |
| Provider unterstützt keine mehrteiligen Uploads oder Bereichs-Reader | `errors.UNAVAILABLE` | nein |
| Berechtigung durch `cloudstorage.get` verweigert | ausgelöster Lua-Fehler | nicht anwendbar |
| Provider-Operation fehlgeschlagen | soweit verfügbar vom Provider übernommen, andernfalls nicht angegeben | unterschiedlich |

Informationen zum Umgang mit Fehlern finden Sie unter [Fehlerbehandlung](../core/errors.md).
