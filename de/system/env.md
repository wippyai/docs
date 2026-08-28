---
title: "Umgebungssystem"
description: "Definieren Sie Umgebungsvariablen auf Basis von Speicher, Dateien, dem Betriebssystem, statischen Werten oder Speicher-Routern."
---

# Umgebungssystem

Umgebungseinträge ermöglichen es Laufzeitcode, Konfiguration über einen öffentlichen Variablennamen oder eine Registry-Entry-ID zu referenzieren.

Diese Seite ist eine Konfigurationsreferenz. Ihre YAML-Blöcke sind Entry-Fragmente, sofern sie kein umschließendes Dokument zeigen.

## Speicherung und Zugriff

Das Umgebungssystem trennt Speicherung von Zugriff:

- **Speicher** - Wo Werte gespeichert werden (OS, Dateien, Speicher)
- **Variablen** - Benannte Referenzen zu Werten in Speichern

Variablen können referenziert werden durch:
- **Öffentlichen Namen** - Der Wert des Feldes `variable`
- **Entry-ID** - Vollständige `namespace:name`-Referenz

Lassen Sie das Feld `variable` weg, wenn eine Variable nur über ihre Entry-ID zugänglich sein soll. Die erste Variable, die einen öffentlichen Namen beansprucht, behält diese Kurzform. Eine spätere Variable mit demselben öffentlichen Namen wird weiterhin registriert und bleibt über ihre Entry-ID erreichbar, ersetzt die bestehende Kurzform jedoch nicht.

## Entry-Typen

| Art | Beschreibung |
|------|--------------|
| `env.storage.memory` | In-Memory-Key-Value-Speicher |
| `env.storage.file` | Dateibasierter Speicher (.env-Format) |
| `env.storage.os` | Schreibgeschützter OS-Umgebungszugriff |
| `env.storage.static` | Schreibgeschützter statischer Key-Value-Speicher |
| `env.storage.router` | Verkettet mehrere Speicher |
| `env.variable` | Benannte Variable, die auf einen Speicher referenziert |

## Speicher-Backends

### Memory-Speicher

Flüchtiger In-Memory-Speicher.

```yaml
- name: runtime_env
  kind: env.storage.memory
```

### Datei-Speicher

Persistenter Speicher in einem einfachen `KEY=VALUE`-Format. Leerzeilen und Zeilen, die mit `#` beginnen, werden ignoriert; Text nach `#` in einer Wertzeile wird als Kommentar behandelt. Werte in Anführungszeichen und Escape-Sequenzen werden nicht speziell geparst.

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

Ein Router verkettet mehrere Speicher. Bei einem Cache-Miss durchsuchen Lesevorgänge sie der Reihe nach, bis ein Wert gefunden wird; ein erfolgreicher Wert wird vom Router zwischengespeichert, sodass direkte Änderungen an einem dahinterliegenden Speicher anschließend nicht über diesen Router sichtbar sind. Ein anderer Fehler als `NOT_FOUND` beendet die Fallback-Suche. Schreibvorgänge gehen ausschließlich an den ersten Speicher.

```yaml
- name: config
  kind: env.storage.router
  storages:
    - app.config:memory    # Primary (writes here)
    - app.config:file      # Fallback
    - app.config:os        # Fallback
```

| Eigenschaft | Typ | Beschreibung |
|-------------|-----|--------------|
| `storages` | array | Erforderliche, nicht leere, geordnete Liste von Speicherreferenzen |

## Variablen

Variablen ordnen öffentliche Namen oder Entry-IDs Werten in einem Speicher-Backend zu.

```yaml
- name: DATABASE_URL
  kind: env.variable
  variable: DATABASE_URL
  storage: app.config:file
  default: postgres://localhost/app
  readonly: false
```

| Eigenschaft | Typ | Beschreibung |
|-------------|-----|--------------|
| `variable` | string | Optionaler öffentlicher Variablenname |
| `storage` | string | Erforderliche Speicherreferenz (`namespace:name`) |
| `default` | string | Standardwert wenn nicht gefunden |
| `readonly` | boolean | Änderungen verhindern |

### Variablenbenennung

Variablennamen dürfen nur enthalten: `a-z`, `A-Z`, `0-9`, `_`

### Zugriffsmuster

```yaml
# Public variable - accessible by name "PORT"
- name: port_var
  kind: env.variable
  variable: PORT
  storage: app.config:os
  default: "8080"

# Private variable - accessible only by ID "app.config:internal_key"
- name: internal_key
  kind: env.variable
  storage: app.config:secrets
```

## Platzhalterinterpolation

Registrierte Variablen werden mit `${env:NAME}`-Platzhaltern in die Entry-Konfiguration übernommen und beim Dekodieren zentral gegen diese Registry aufgelöst. Strings in Entry-Konfigurationen werden aufgelöst, sofern der jeweilige Entry-Typ ein Feld nicht als undurchsichtig markiert. Quellfelder wie `template.jet.source` sind undurchsichtig, damit Template- oder Programmtext nicht umgeschrieben wird.

| Syntax | Bedeutung |
|--------|-----------|
| `${env:NAME}` | `NAME` über die Env-Registry auflösen; Fehler, wenn der Wert nicht gesetzt ist und kein Standardwert existiert |
| `${env:NAME\|default}` | `NAME` auflösen und bei einem nicht gesetzten Wert auf `default` zurückfallen |
| `${NAME\|default}` | Kurzform; `NAME` muss Upper-Snake-Case (`A-Z0-9_`) verwenden und `\|default` ist erforderlich — ein bloßes `${VAR}` bleibt unverändert, damit eingebettete Shell- oder Template-Ausdrücke nicht irrtümlich als Referenzen behandelt werden |
| `$${` | Literales `${` (Escape-Sequenz) |

`NAME` ist der öffentliche Name einer registrierten Variable oder ihre Entry-ID (Registry-ID-Form mit Punkten und Doppelpunkten, zum Beispiel `app.env:tls_cert`). Es ist **keine** rohe Betriebssystem-Umgebungsvariable: Ein OS-Wert ist nur erreichbar, wenn eine mit `env.storage.os` hinterlegte Variable unter diesem Namen registriert ist.

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: ${env:app.env:tls_cert}
    key:  ${env:app.env:tls_key}
```

Wenn der gesamte Wert eines Feldes aus einem einzelnen Platzhalter besteht, übernimmt er den Typ seines Inline-Standardwerts. `${env:PORT|8080}` erzeugt beispielsweise einen Integer und konvertiert einen gespeicherten Wert in einen Integer, während `${env:PORT|"8080"}` ein String bleibt. Ein mit umgebendem Text kombinierter Platzhalter erzeugt immer einen String. Der eigene `default` einer Variable hat Vorrang vor dem Inline-Standard `|default` des Platzhalters. Eine Referenz, die keinen Wert ergibt und keinen Standardwert besitzt, lässt die Dekodierung fehlschlagen.

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
