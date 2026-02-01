# UUID-Generierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Generieren Sie universell eindeutige Identifikatoren. Angepasst fur Workflows - zufallige UUIDs geben bei Replay konsistente Werte zuruck.

## Laden

```lua
local uuid = require("uuid")
```

## Zufallige UUIDs

### Version 1

Zeitbasierte UUID mit Zeitstempel und Knoten-ID.

```lua
local id, err = uuid.v1()
```

**Gibt zuruck:** `string, error`

### Version 4

Zufallige UUID.

```lua
local id, err = uuid.v4()
```

**Gibt zuruck:** `string, error`

### Version 7

Zeitgeordnete UUID. Nach Erstellungszeit sortierbar.

```lua
local id, err = uuid.v7()
```

**Gibt zuruck:** `string, error`

## Deterministische UUIDs

### Version 3

Deterministische UUID aus Namespace und Name mit MD5.

```lua
local id, err = uuid.v3(namespace, name)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `namespace` | string | Gultiger UUID-String |
| `name` | string | Zu hashender Wert |

**Gibt zuruck:** `string, error`

### Version 5

Deterministische UUID aus Namespace und Name mit SHA-1.

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `namespace` | string | Gultiger UUID-String |
| `name` | string | Zu hashender Wert |

**Gibt zuruck:** `string, error`

## Inspektion

### Validieren

```lua
local valid = uuid.validate(input)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `input` | any | Zu prufender Wert |

**Gibt zuruck:** `boolean`

### Version abrufen

```lua
local ver, err = uuid.version(id)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `uuid` | string | Gultiger UUID-String |

**Gibt zuruck:** `integer, error`

### Variante abrufen

```lua
local var, err = uuid.variant(id)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `uuid` | string | Gultiger UUID-String |

**Gibt zuruck:** `string, error` (RFC4122, Microsoft, NCS oder Invalid)

### Parsen

```lua
local info, err = uuid.parse(id)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `uuid` | string | Gultiger UUID-String |

**Gibt zuruck:** `table, error`

Zuruckgegebene Tabellenfelder:
- `version` (integer): UUID-Version (1, 3, 4, 5 oder 7)
- `variant` (string): RFC4122, Microsoft, NCS oder Invalid
- `timestamp` (integer): Unix-Zeitstempel (nur v1 und v7)
- `node` (string): Knoten-ID (nur v1)

### Formatieren

```lua
local formatted, err = uuid.format(id, "standard")
local formatted, err = uuid.format(id, "simple")
local formatted, err = uuid.format(id, "urn")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `uuid` | string | Gultiger UUID-String |
| `format` | string? | standard (Standard), simple oder urn |

**Gibt zuruck:** `string, error`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ungultiger Eingabetyp | `errors.INVALID` | nein |
| Ungultiges UUID-Format | `errors.INVALID` | nein |
| Nicht unterstutzter Formattyp | `errors.INVALID` | nein |
| Generierung fehlgeschlagen | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) fur die Arbeit mit Fehlern.
