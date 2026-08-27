---
title: "UUID-Generierung"
description: "UUIDs erzeugen, validieren, untersuchen, parsen und formatieren."
---

# UUID-Generierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Das Modul `uuid` erzeugt, validiert, untersucht, parst und formatiert UUIDs. In deterministischen Workflows läuft die Erzeugung von v1, v4 und v7 als aufgezeichneter Seiteneffekt; beim Replay wird der aufgezeichnete Wert zurückgegeben. Die Namespace-basierten Versionen v3 und v5 sind deterministisch und laufen direkt.

Diese Seite ist eine API-Referenz mit einzelnen Aufrufen. Werte wie `namespace`, `name`, `input` und `id` stammen aus der umgebenden Anwendung. Behandeln Sie den zweiten Rückgabewert `error`, bevor Sie erzeugte, geparste, untersuchte oder formatierte Ergebnisse verwenden. UUIDs sind Identifikatoren und keine Bearer-Anmeldedaten; verwenden Sie keine UUID-Version als Authentifizierungstoken oder Geheimnis.

## Laden

```lua
local uuid = require("uuid")
```

## Nichtdeterministische UUIDs

### Version 1

Zeitbasierte UUID mit Zeitstempel und Knoten-ID.

Version 1 legt Erzeugungszeit und Knotenkennung offen. Vermeiden Sie sie, wenn diese Angaben sensibel sind; bevorzugen Sie v4, wenn nur ein undurchsichtiger Identifikator benötigt wird.

```lua
local id, err = uuid.v1()
```

**Gibt zurück:** `string, error`

### Version 4

Zufällige UUID.

```lua
local id, err = uuid.v4()
```

**Gibt zurück:** `string, error`

### Version 7

Eine zeitgeordnete UUID, die ihre Erzeugungszeit für chronologische Indizierung kodiert. Verlassen Sie sich nicht auf eine streng monotone Reihenfolge, insbesondere bei Werten, die im selben Zeitintervall erzeugt werden.

```lua
local id, err = uuid.v7()
```

**Gibt zurück:** `string, error`

## Deterministische UUIDs

### Version 3

Deterministische UUID aus Namespace und Name mit MD5.

```lua
local id, err = uuid.v3(namespace, name)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `namespace` | string | Gültiger UUID-String |
| `name` | string | Zu hashender Wert |

**Gibt zurück:** `string, error`

### Version 5

Deterministische UUID aus Namespace und Name mit SHA-1.

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
if err then
    return nil, err
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `namespace` | string | Gültiger UUID-String |
| `name` | string | Zu hashender Wert |

**Gibt zurück:** `string, error`

## Inspektion

### Validieren

```lua
local valid = uuid.validate(input)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `input` | any | Zu prüfender Wert |

**Gibt zurück:** `boolean, nil`. Nicht als Zeichenkette vorliegende und fehlerhafte Eingaben geben `false` zurück; die Validierung löst keinen strukturierten Fehler aus.

### Version abrufen

```lua
local ver, err = uuid.version(id)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `uuid` | string | Gültiger UUID-String |

**Gibt zurück:** `integer, error`

### Variante abrufen

```lua
local var, err = uuid.variant(id)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `uuid` | string | Gültiger UUID-String |

**Gibt zurück:** `string, error` (RFC4122, Reserved, Microsoft, Future, NCS oder Invalid)

### Parsen

```lua
local info, err = uuid.parse(id)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `uuid` | string | Gültiger UUID-String |

**Gibt zurück:** `table, error`

Zurückgegebene Tabellenfelder:
- `version` (integer): UUID-Version (1, 3, 4, 5 oder 7)
- `variant` (string): RFC4122, Reserved, Microsoft, Future, NCS oder Invalid
- `timestamp` (integer): Unix-Zeitstempel (nur v1 und v7)
- `node` (string): rohe sechs Byte lange Knotenkennung (nur v1); vor Anzeige oder Textspeicherung kodieren

### Formatieren

```lua
local formatted, err = uuid.format(id, "standard")
local formatted, err = uuid.format(id, "simple")
local formatted, err = uuid.format(id, "urn")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `uuid` | string | Gültiger UUID-String |
| `format` | string? | standard (Standard), simple oder urn |

**Gibt zurück:** `string, error`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ungültiger Eingabetyp | `errors.INVALID` | nein |
| Ungültiges UUID-Format | `errors.INVALID` | nein |
| Nicht unterstützter Formattyp | `errors.INVALID` | nein |
| Generierung fehlgeschlagen | `errors.INTERNAL` | nein |

Informationen zum Umgang mit Fehlern finden Sie unter [Fehlerbehandlung](../core/errors.md).
