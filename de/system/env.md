---
title: "Umgebungssystem"
description: "Verwaltet Umgebungsvariablen durch konfigurierbare Speicher-Backends."
---

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
| `env.storage.static` | Schreibgeschützter statischer Key-Value-Speicher |
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

### Statischer Speicher

Schreibgeschützter Speicher mit direkt in der Konfiguration definierten Werten. Werte werden in den Eintrag eingebettet und können zur Laufzeit nicht geändert werden. Nützlich für öffentliche Konfigurationskonstanten, die mit einem Modul oder Paket ausgeliefert werden.

```yaml
- name: defaults
  kind: env.storage.static
  values:
    PUBLIC_API_HOST: "https://api.example.com"
    PUBLIC_WS_HOST: "wss://api.example.com/ws"
    APP_ENV: "production"
```

| Eigenschaft | Typ | Beschreibung |
|-------------|-----|--------------|
| `values` | map | Schlüssel-Wert-Paare (String zu String) |

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

## Konfigurationsreferenzen in Einträgen

Registrierte Variablen werden mit `${env:NAME}`-Platzhaltern in die Entry-Konfiguration gezogen; `NAME` ist der öffentliche Name einer Variable oder ihre Entry-ID.

Die Auflösung geschieht nur zur Dekodierzeit: Der gespeicherte Registry-Eintrag behält die rohen Platzhalter, sodass aufgelöste Secrets nie in `registry.get`-Ergebnissen oder persistiertem Zustand erscheinen. Einträge, die `${env:...}` referenzieren, ordnen sich beim Boot automatisch hinter den env-Speichern und -Variablen ein, von denen sie abhängen.

<note>
Ältere Konfigurationen verwenden eine benachbarte <code>&lt;field&gt;_env</code>-Direktive (zum Beispiel <code>cert_env: app.env:tls_cert</code>), die auf dieselbe Weise auflöst. Diese Form ist <b>veraltet</b> — migrieren Sie sie zum <code>${env:NAME}</code>-Platzhalter. Ein <code>&lt;field&gt;_env</code>-Schlüssel, der eine nicht registrierte Variable benennt, wird nicht als Direktive behandelt und bleibt unverändert; einer, der eine registrierte, aber leere Variable benennt, behält den Inline-<code>&lt;field&gt;</code>-Wert. Nur ein explizites <code>${env:NAME}</code> ohne Default schlägt bei einer fehlenden Variable hart fehl.
</note>

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
