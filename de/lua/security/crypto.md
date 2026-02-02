# Verschlüsselung & Signierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

Kryptografische Operationen einschliesslich Verschlüsselung, HMAC, JWT und Schlüsselableitung. Angepasst für Workflows.

## Laden

```lua
local crypto = require("crypto")
```

## Zufallsgenerierung

### Zufallsbytes

```lua
local bytes, err = crypto.random.bytes(32)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `length` | integer | Anzahl Bytes (1 bis 1.048.576) |

**Gibt zurück:** `string, error`

### Zufallsstring

```lua
local str, err = crypto.random.string(32)
local str, err = crypto.random.string(32, "0123456789abcdef")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `length` | integer | String-Lange (1 bis 1.048.576) |
| `charset` | string? | Zu verwendende Zeichen (Standard: alphanumerisch) |

**Gibt zurück:** `string, error`

### Zufalls-UUID

```lua
local id, err = crypto.random.uuid()
```

**Gibt zurück:** `string, error`

## HMAC

### HMAC-SHA256

```lua
local hex, err = crypto.hmac.sha256(key, data)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | HMAC-Schlüssel |
| `data` | string | Zu authentifizierende Daten |

**Gibt zurück:** `string, error`

### HMAC-SHA512

```lua
local hex, err = crypto.hmac.sha512(key, data)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | HMAC-Schlüssel |
| `data` | string | Zu authentifizierende Daten |

**Gibt zurück:** `string, error`

## Verschlüsselung

### AES-GCM {id="encrypt-aes-gcm"}

```lua
local encrypted, err = crypto.encrypt.aes(data, key)
local encrypted, err = crypto.encrypt.aes(data, key, aad)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu verschlüsselnder Klartext |
| `key` | string | 16, 24 oder 32 Bytes (AES-128/192/256) |
| `aad` | string? | Zusatzliche authentifizierte Daten |

**Gibt zurück:** `string, error` (Nonce vorangestellt)

### ChaCha20-Poly1305 {id="encrypt-chacha20"}

```lua
local encrypted, err = crypto.encrypt.chacha20(data, key)
local encrypted, err = crypto.encrypt.chacha20(data, key, aad)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu verschlüsselnder Klartext |
| `key` | string | Muss 32 Bytes sein |
| `aad` | string? | Zusatzliche authentifizierte Daten |

**Gibt zurück:** `string, error`

## Entschlüsselung

### AES-GCM {id="decrypt-aes-gcm"}

```lua
local plaintext, err = crypto.decrypt.aes(encrypted, key)
local plaintext, err = crypto.decrypt.aes(encrypted, key, aad)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Verschlüsselte Daten von encrypt.aes |
| `key` | string | Gleicher Schlüssel wie bei Verschlüsselung |
| `aad` | string? | Muss mit AAD bei Verschlüsselung ubereinstimmen |

**Gibt zurück:** `string, error`

### ChaCha20-Poly1305 {id="decrypt-chacha20"}

```lua
local plaintext, err = crypto.decrypt.chacha20(encrypted, key)
local plaintext, err = crypto.decrypt.chacha20(encrypted, key, aad)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Verschlüsselte Daten von encrypt.chacha20 |
| `key` | string | Gleicher Schlüssel wie bei Verschlüsselung |
| `aad` | string? | Muss mit AAD bei Verschlüsselung ubereinstimmen |

**Gibt zurück:** `string, error`

## JWT

### Kodieren

```lua
local token, err = crypto.jwt.encode(payload, secret)
local token, err = crypto.jwt.encode(payload, secret, "HS256")
local token, err = crypto.jwt.encode(payload, private_key_pem, "RS256")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `payload` | table | JWT-Claims (`_header` für benutzerdefinierten Header) |
| `key` | string | Secret (HMAC) oder PEM-privater Schlüssel (RSA) |
| `alg` | string? | HS256, HS384, HS512, RS256 (Standard: HS256) |

**Gibt zurück:** `string, error`

### Verifizieren

```lua
local claims, err = crypto.jwt.verify(token, secret)
local claims, err = crypto.jwt.verify(token, secret, "HS256", false)
local claims, err = crypto.jwt.verify(token, public_key_pem, "RS256")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `token` | string | Zu verifizierender JWT-Token |
| `key` | string | Secret (HMAC) oder PEM-offentlicher Schlüssel (RSA) |
| `alg` | string? | Erwarteter Algorithmus (Standard: HS256) |
| `require_exp` | boolean? | Ablauf validieren (Standard: true) |

**Gibt zurück:** `table, error`

## Schlüsselableitung

### PBKDF2

```lua
local key, err = crypto.pbkdf2(password, salt, iterations, key_length)
local key, err = crypto.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `password` | string | Passwort/Passphrase |
| `salt` | string | Salt-Wert |
| `iterations` | integer | Iterationsanzahl (max. 10.000.000) |
| `key_length` | integer | Gewunschte Schlüssellange in Bytes |
| `hash` | string? | sha256 oder sha512 (Standard: sha256) |

**Gibt zurück:** `string, error`

## Hilfsfunktionen

### Konstantzeit-Vergleich

```lua
local equal = crypto.constant_time_compare(a, b)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `a` | string | Erster String |
| `b` | string | Zweiter String |

**Gibt zurück:** `boolean`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ungultige Lange | `errors.INVALID` | nein |
| Leerer Schlüssel | `errors.INVALID` | nein |
| Ungultige Schlüsselgröße | `errors.INVALID` | nein |
| Entschlüsselung fehlgeschlagen | `errors.INTERNAL` | nein |
| Token abgelaufen | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
