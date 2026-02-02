# Cloud-Speicher
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

Zugriff auf S3-kompatiblen Objektspeicher. Hochladen, Herunterladen, Auflisten und Verwalten von Dateien mit Unterstutzung für vorsignierte URLs.

Für Speicherkonfiguration siehe [Cloud-Speicher](system-cloudstorage.md).

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

**Gibt zurück:** `boolean, error`

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

**Gibt zurück:** `boolean, error`

## Objekte auflisten

Objekte mit optionaler Prafix-Filterung auflisten:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.content_type)
end

-- Durch größe Ergebnisse paginieren
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
| `options.prefix` | string | Nach Schlüssel-Prafix filtern |
| `options.max_keys` | integer | Maximale Anzahl zuruckzugebender Objekte |
| `options.continuation_token` | string | Paginierungs-Token |

**Gibt zurück:** `table, error`

Ergebnis enthalt `objects`, `is_truncated`, `next_continuation_token`.

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

Erstellen Sie eine temporare URL, die das Herunterladen eines Objekts ohne Anmeldeinformationen ermoglicht. Nutzlich zum Teilen von Dateien mit externen Benutzern oder zum Bereitstellen von Inhalten über Ihre Anwendung.

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

-- URL an Client für direkten Download zuruckgeben
return {download_url = url}
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Objektschlüssel |
| `options.expiration` | integer | Sekunden bis URL ablauft (Standard: 3600) |

**Gibt zurück:** `string, error`

## Upload-URLs

Erstellen Sie eine temporare URL, die das Hochladen eines Objekts ohne Anmeldeinformationen ermoglicht. Ermoglicht Clients, Dateien direkt in den Speicher hochzuladen, ohne über Ihren Server zu proxyen.

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

-- URL an Client für direkten Upload zuruckgeben
return {upload_url = url}
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Objektschlüssel |
| `options.expiration` | integer | Sekunden bis URL ablauft (Standard: 3600) |
| `options.content_type` | string | Erforderlicher Content-Type für Upload |
| `options.content_length` | integer | Maximale Upload-Größe in Bytes |

**Gibt zurück:** `string, error`

## Storage-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `upload_object(key, content)` | `boolean, error` | String- oder Dateiinhalt hochladen |
| `download_object(key, writer, opts?)` | `boolean, error` | In Datei-Writer herunterladen |
| `list_objects(opts?)` | `table, error` | Objekte mit Prafix-Filter auflisten |
| `delete_objects(keys)` | `boolean, error` | Mehrere Objekte löschen |
| `presigned_get_url(key, opts?)` | `string, error` | Temporare Download-URL generieren |
| `presigned_put_url(key, opts?)` | `string, error` | Temporare Upload-URL generieren |
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
| Writer nicht gultig | `errors.INVALID` | nein |
| Objekt nicht gefunden | `errors.NOT_FOUND` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |
| Operation fehlgeschlagen | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
