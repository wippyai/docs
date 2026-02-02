# Umgebungssystem

Verwaltet Umgebungsvariablen durch konfigurierbare Speicher-Backends.

## Übersicht

Das Umgebungssystem trennt Speicherung von Zugriff:

- **Speicher** - Wo Werte gespeichert werden (OS, Dateien, Speicher)
- **Variablen** - Benannte Referenzen zu Werten in Speichern

Variablen können referenziert werden durch:
- **Öffentlichen Namen** - Der `variable`-Feldwert (muss systemweit eindeutig sein)
- **Entry-ID** - Vollständige `namespace:name`-Referenz

Wenn Sie nicht möchten, dass eine Variable öffentlich über den Namen zugänglich ist, lassen Sie das `variable`-Feld weg.

## Entry-Typen

| Kind | Beschreibung |
|------|--------------|
| `env.storage.memory` | In-Memory-Key-Value-Speicher |
| `env.storage.file` | Dateibasierter Speicher (.env-Format) |
| `env.storage.os` | Schreibgeschützter OS-Umgebungszugriff |
| `env.storage.router` | Verkettet mehrere Speicher |
| `env.variable` | Benannte Variable die auf einen Speicher referenziert |

## Speicher-Backends

### Memory-Speicher

Flüchtiger In-Memory-Speicher.

```yaml
- name: runtime_env
  kind: env.storage.memory
```

### Datei-Speicher

Persistenter Speicher im `.env`-Dateiformat (`KEY=VALUE` mit `#`-Kommentaren).

```yaml
- name: app_config
  kind: env.storage.file
  file_path: /etc/app/config.env
  auto_create: true
  file_mode: 0600
  dir_mode: 0700
```

| Eigenschaft | Typ | Standard | Beschreibung |
|-------------|-----|----------|--------------|
| `file_path` | string | erforderlich | Pfad zur .env-Datei |
| `auto_create` | boolean | false | Datei erstellen wenn nicht vorhanden |
| `file_mode` | integer | 0644 | Dateiberechtigungen |
| `dir_mode` | integer | 0755 | Verzeichnisberechtigungen |

### OS-Speicher

Schreibgeschützter Zugriff auf Betriebssystem-Umgebungsvariablen.

```yaml
- name: os_env
  kind: env.storage.os
```

Immer schreibgeschützt. Set-Operationen geben `PERMISSION_DENIED` zurück.

### Router-Speicher

Verkettet mehrere Speicher. Lesevorgänge durchsuchen diese der Reihe nach, bis ein Wert gefunden wird. Schreibvorgänge gehen nur an den ersten Speicher.

```yaml
- name: config
  kind: env.storage.router
  storages:
    - app.config:memory    # Primär (Schreibvorgänge hierhin)
    - app.config:file      # Fallback
    - app.config:os        # Fallback
```

| Eigenschaft | Typ | Beschreibung |
|-------------|-----|--------------|
| `storages` | array | Geordnete Liste von Speicherreferenzen |

## Variablen

Variablen bieten benannten Zugriff auf Speicherwerte.

```yaml
- name: DATABASE_URL
  kind: env.variable
  variable: DATABASE_URL
  storage: app.config:file
  default: postgres://localhost/app
  read_only: false
```

| Eigenschaft | Typ | Beschreibung |
|-------------|-----|--------------|
| `variable` | string | Öffentlicher Variablenname (optional, muss eindeutig sein) |
| `storage` | string | Speicherreferenz (`namespace:name`) |
| `default` | string | Standardwert wenn nicht gefunden |
| `read_only` | boolean | Änderungen verhindern |

### Variablenbenennung

Variablennamen dürfen nur enthalten: `a-z`, `A-Z`, `0-9`, `_`

### Zugriffsmuster

```yaml
# Öffentliche Variable - zugänglich über Namen "PORT"
- name: port_var
  kind: env.variable
  variable: PORT
  storage: app.config:os
  default: "8080"

# Private Variable - nur über ID "app.config:internal_key" zugänglich
- name: internal_key
  kind: env.variable
  storage: app.config:secrets
```

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|-----|--------------|
| Variable nicht gefunden | `errors.NOT_FOUND` | nein |
| Speicher nicht gefunden | `errors.NOT_FOUND` | nein |
| Variable ist schreibgeschützt | `errors.PERMISSION_DENIED` | nein |
| Speicher ist schreibgeschützt | `errors.PERMISSION_DENIED` | nein |
| Ungültiger Variablenname | `errors.INVALID` | nein |

## Laufzeitzugriff

- [env-Modul](lua/system/env.md) - Lua-Laufzeitzugriff

## Siehe auch

- [Sicherheitsmodell](system/security.md) - Zugriffskontrolle für Umgebungsvariablen
- [Konfigurationsanleitung](guides/configuration.md) - Anwendungskonfigurationsmuster
