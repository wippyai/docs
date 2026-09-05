---
title: "Hash-Funktionen"
description: "Kryptografische Hash-Funktionen und HMAC-Nachrichtenauthentifizierung."
---

# Hash-Funktionen
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Kryptografische Hash-Funktionen und HMAC-Nachrichtenauthentifizierung.

## Laden

```lua
local hash = require("hash")
```

## Kryptografische Hashes

### MD5

```lua
local hex = hash.md5("data")
local raw = hash.md5("data", true)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu hashende Daten |
| `raw` | boolean? | Rohe Bytes statt Hex zurückgeben |

**Gibt zurück:** `string, error`

### SHA-1

```lua
local hex = hash.sha1("data")
local raw = hash.sha1("data", true)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu hashende Daten |
| `raw` | boolean? | Rohe Bytes statt Hex zurückgeben |

**Gibt zurück:** `string, error`

### SHA-256

```lua
local hex = hash.sha256("data")
local raw = hash.sha256("data", true)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu hashende Daten |
| `raw` | boolean? | Rohe Bytes statt Hex zurückgeben |

**Gibt zurück:** `string, error`

### SHA-512

```lua
local hex = hash.sha512("data")
local raw = hash.sha512("data", true)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu hashende Daten |
| `raw` | boolean? | Rohe Bytes statt Hex zurückgeben |

**Gibt zurück:** `string, error`

## HMAC-Authentifizierung

### HMAC-MD5

```lua
local hex = hash.hmac_md5("message", "secret")
local raw = hash.hmac_md5("message", "secret", true)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu authentifizierende Nachricht |
| `secret` | string | Geheimer Schlüssel |
| `raw` | boolean? | Rohe Bytes statt Hex zurückgeben |

**Gibt zurück:** `string, error`

### HMAC-SHA1

```lua
local hex = hash.hmac_sha1("message", "secret")
local raw = hash.hmac_sha1("message", "secret", true)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu authentifizierende Nachricht |
| `secret` | string | Geheimer Schlüssel |
| `raw` | boolean? | Rohe Bytes statt Hex zurückgeben |

**Gibt zurück:** `string, error`

### HMAC-SHA256

```lua
local hex = hash.hmac_sha256("message", "secret")
local raw = hash.hmac_sha256("message", "secret", true)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu authentifizierende Nachricht |
| `secret` | string | Geheimer Schlüssel |
| `raw` | boolean? | Rohe Bytes statt Hex zurückgeben |

**Gibt zurück:** `string, error`

### HMAC-SHA512

```lua
local hex = hash.hmac_sha512("message", "secret")
local raw = hash.hmac_sha512("message", "secret", true)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu authentifizierende Nachricht |
| `secret` | string | Geheimer Schlüssel |
| `raw` | boolean? | Rohe Bytes statt Hex zurückgeben |

**Gibt zurück:** `string, error`

## Nicht-kryptografische Hashes

### FNV-32

Schneller Hash für Hash-Tabellen und Partitionierung.

```lua
local n = hash.fnv32("data")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu hashende Daten |

**Gibt zurück:** `number, error`

### FNV-64

Schneller Hash mit größerer Ausgabe für reduzierte Kollisionen.

```lua
local n = hash.fnv64("data")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu hashende Daten |

**Gibt zurück:** `number, error`

## Schlüsselableitung

### PBKDF2

```lua
local key, err = hash.pbkdf2(password, salt, iterations, key_length)
local key, err = hash.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `password` | string | Passwort/Passphrase (nicht leer) |
| `salt` | string | Salt-Wert (nicht leer) |
| `iterations` | integer | Anzahl der Iterationen (1 bis 10.000.000) |
| `key_length` | integer | Gewünschte Schlüssellänge in Bytes |
| `hash` | string? | `sha256` oder `sha512` (Standard: `sha256`) |

**Gibt zurück:** `string, error` (rohe Schlüsselbytes)

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Eingabe ist kein String | `errors.INVALID` | nein |
| Secret ist kein String (HMAC) | `errors.INVALID` | nein |
| Leeres Passwort/Salt, nicht positive oder zu hohe Iterationszahl, nicht unterstützter Hash (PBKDF2) | `errors.INVALID` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
