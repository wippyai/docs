---
title: "Hash-Funktionen"
description: "Kryptografische Hashes, HMAC-Werte, PBKDF2-Schlüssel und FNV-1-Hashes berechnen."
---

# Hash-Funktionen
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Das Modul `hash` berechnet kryptografische Hashes, HMAC-Werte, mit PBKDF2 abgeleitete Schlüssel und nicht kryptografische FNV-1-Hashes. Diese Seite ist eine API-Referenz mit einzelnen Aufrufen. Literale Eingaben veranschaulichen erfolgreiche Verwendung; wenn Daten, Geheimnisse, Passwörter oder Salts aus der Anwendung stammen, behandeln Sie den dokumentierten zweiten Rückgabewert `error`, bevor Sie das Ergebnis verwenden.

Ein Hash ist keine Verschlüsselung und verbirgt keine Eingaben mit geringer Entropie. Protokollieren Sie keine Passwörter, HMAC-Schlüssel, abgeleiteten Schlüssel oder rohen, geheimnisabhängigen Digests. Verwenden Sie HMAC-SHA256 oder HMAC-SHA512 für neue Nachrichtenauthentifizierungsverfahren und PBKDF2 mit einem eindeutigen zufälligen Salt für Passwortprüfwerte.

## Laden

```lua
local hash = require("hash")
```

## Kryptografische Hashes

### MD5

MD5 ist nicht kollisionsresistent. Verwenden Sie es nur zur Kompatibilität mit Protokollen, die MD5 verlangen, und nicht für Sicherheitsentscheidungen.

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

SHA-1 ist nicht kollisionsresistent. Verwenden Sie es nur zur Kompatibilität mit Protokollen, die SHA-1 verlangen, und nicht für Sicherheitsentscheidungen.

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

## HMACs

### HMAC-MD5

Verwenden Sie HMAC-MD5 nur zur Kompatibilität mit einem Protokoll, das es verlangt; bevorzugen Sie für neue Verfahren HMAC-SHA256 oder HMAC-SHA512.

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

Verwenden Sie HMAC-SHA1 nur zur Kompatibilität mit einem Protokoll, das es verlangt; bevorzugen Sie für neue Verfahren HMAC-SHA256 oder HMAC-SHA512.

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

### FNV-1 32 Bit

Berechnen Sie einen Hash für Anwendungen wie Hash-Tabellen und Partitionierung.

```lua
local n = hash.fnv32("data")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu hashende Daten |

**Gibt zurück:** `number, error`

### FNV-1 64 Bit

Berechnen Sie einen breiteren Hash für Anwendungen wie Hash-Tabellen und Partitionierung, um die Kollisionswahrscheinlichkeit zu verringern.

```lua
local n = hash.fnv64("data")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu hashende Daten |

**Gibt zurück:** `number, error`

Lua-Zahlen können nicht jede vorzeichenlose 64-Bit-Ganzzahl exakt darstellen. Verwenden Sie `fnv64` nicht, wenn der exakte 64-Bit-Wert Lua unverändert durchlaufen muss; verwenden Sie stattdessen eine Byte- oder Zeichenkettendarstellung, die von einer geeigneten Protokollimplementierung bereitgestellt wird.

## Schlüsselableitung

### PBKDF2-HMAC

Leiten Sie mit PBKDF2-HMAC-SHA256 oder PBKDF2-HMAC-SHA512 rohe Schlüsselbytes ab:

```lua
local key, err = hash.pbkdf2(password, salt, 600000, 32)
if err then
    return nil, err
end
local key512, err = hash.pbkdf2(password, salt, 600000, 32, "sha512")
if err then
    return nil, err
end
```

Hier wird `password` über die Geheimnisgrenze der Anwendung bereitgestellt; `salt` besteht aus neuen zufälligen Bytes, die zusammen mit dem Prüfwert gespeichert werden. Die zurückgegebenen Werte sind rohe Schlüsselbytes und kein druckbarer Text.

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `password` | string | Nicht leeres Passwort oder geheime Eingabe |
| `salt` | string | Nicht leere Salt-Bytes |
| `iterations` | integer | Positive Iterationszahl, höchstens 10.000.000 |
| `key_length` | integer | Positive Ausgabelänge in Bytes |
| `algo` | string? | `sha256` (Standard) oder `sha512` |

**Gibt zurück:** `string, error` (rohe abgeleitete Schlüsselbytes)

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Eingabe ist kein String | `errors.INVALID` | nein |
| Secret ist kein String (HMAC) | `errors.INVALID` | nein |
| PBKDF2-Passwort oder -Salt leer, Grenzwerte ungültig oder Algorithmus nicht unterstützt | `errors.INVALID` | nein |

Informationen zum Umgang mit Fehlern finden Sie unter [Fehlerbehandlung](lua/core/errors.md).
