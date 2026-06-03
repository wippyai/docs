# Cloud-Speicher
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

Zugriff auf S3-kompatiblen Objektspeicher. Hochladen, Herunterladen, Auflisten und Verwalten von Dateien mit Unterstützung für vorsignierte URLs.

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
| Bedingte Vorbedingung fehlgeschlagen | `errors.CONFLICT` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |
| Operation fehlgeschlagen | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
