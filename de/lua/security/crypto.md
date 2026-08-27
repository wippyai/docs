---
title: "Verschlüsselung & Signierung"
description: "Zufallswerte erzeugen, Daten authentifizieren und verschlüsseln, JWTs prüfen und Schlüssel ableiten."
---

# Verschlüsselung & Signierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

Das Modul `crypto` erzeugt Zufallswerte, berechnet HMACs, ver- und entschlüsselt Daten, kodiert und prüft JWTs und leitet Schlüssel ab. In deterministischen Workflows laufen Zufallserzeugung und Verschlüsselung, die eine zufällige Nonce erzeugt, als aufgezeichnete Seiteneffekte; beim Replay werden die aufgezeichneten Bytes zurückgegeben. Andere Operationen wie HMAC, Entschlüsselung, JWT-Verarbeitung, PBKDF2 und Vergleich laufen direkt.

Diese Seite ist eine API-Referenz. Jeder Codeblock ist ein einzelner Aufruf und kein vollständiges System für Schlüsselverwaltung oder Authentifizierung. Namen wie `data`, `key`, `aad`, `payload` und `token` stehen für von der Anwendung bereitgestellte Werte. Laden Sie Schlüssel und Passwörter über die Geheimnisverwaltungsgrenze der Anwendung; kodieren Sie sie nicht fest und geben Sie sie weder in Logs noch in Diagnosen aus. Behandeln Sie bei jedem hier gezeigten Ergebnis vom Typ `value, error` zuerst den Fehler, bevor Sie den Wert verwenden.

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
| `length` | integer | Ausgabelänge in Bytes (1 bis 1.048.576) |
| `charset` | string? | Zu verwendendes ASCII-Bytealphabet (Standard: alphanumerisch) |

**Gibt zurück:** `string, error`

Die Implementierung wählt Bytes aus dem angegebenen Alphabet. Ein Nicht-ASCII-Alphabet kann in ungültiges UTF-8 zerlegt werden; außerdem ist die Modulo-Auswahl nur dann exakt gleichverteilt, wenn die Bytelänge des Alphabets ein Teiler von 256 ist. Verwenden Sie für gleichverteiltes zufälliges Geheimmaterial `crypto.random.bytes` und kodieren Sie das Ergebnis für das erforderliche Transportformat.

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
| `aad` | string? | Zusätzliche authentifizierte Daten |

**Gibt zurück:** `string, error` (Nonce vorangestellt)

Beide Verschlüsselungsfunktionen erzeugen eine Nonce und stellen sie dem Ciphertext voran. Entfernen oder verwenden Sie die Nonce nicht erneut und verwenden Sie bei der Entschlüsselung dieselben AAD. Ciphertext ist kein geheimnisfreier Logwert: Er kann Längen- und Korrelationsinformationen preisgeben.

### ChaCha20-Poly1305 {id="encrypt-chacha20"}

```lua
local encrypted, err = crypto.encrypt.chacha20(data, key)
local encrypted, err = crypto.encrypt.chacha20(data, key, aad)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu verschlüsselnder Klartext |
| `key` | string | Muss 32 Bytes sein |
| `aad` | string? | Zusätzliche authentifizierte Daten |

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
| `aad` | string? | Muss mit AAD bei Verschlüsselung übereinstimmen |

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
| `aad` | string? | Muss mit AAD bei Verschlüsselung übereinstimmen |

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

Übergeben Sie nur einen der dokumentierten Algorithmusnamen. In dieser Runtime-Version fällt ein von `encode` nicht unterstützter Wert auf HS256 zurück, statt einen Fehler zurückzugeben. Validieren Sie konfigurierbare Algorithmen vor diesem Aufruf und übernehmen Sie keine nicht vertrauenswürdigen Felder in `_header`; insbesondere dürfen Eingaben reservierte JWT-Header wie `alg` nicht überschreiben.

### Verifizieren

```lua
local claims, err = crypto.jwt.verify(token, secret)
local claims, err = crypto.jwt.verify(token, secret, "HS256", false)
local claims, err = crypto.jwt.verify(token, public_key_pem, "RS256")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `token` | string | Zu verifizierender JWT-Token |
| `key` | string | Secret (HMAC) oder PEM-öffentlicher Schlüssel (RSA) |
| `alg` | string? | Erwarteter Algorithmus (Standard: HS256) |
| `require_exp` | boolean? | Vorhandensein eines `exp`-Claims verlangen (Standard: true) |

**Gibt zurück:** `table, error`

Wenn vorhanden, werden `exp` und `nbf` gegen die aktuelle Wanduhr der JWT-Bibliothek und nicht gegen die Workflow-Zeitreferenz geprüft. `require_exp = false` erlaubt ein fehlendes `exp`-Claim, deaktiviert aber nicht die Validierung eines vorhandenen Claims. Verwenden Sie keine der beiden zeitabhängigen Prüfungen für Replay-abhängige Workflow-Steuerung; führen Sie die Prüfung in einer Aktivität aus oder vergleichen Sie mit einem ausdrücklich Replay-sicheren Wert.

Übergeben Sie stets den vom Herausgeber erwarteten Algorithmus; die Prüfung beschränkt das Token auf genau diese Methode. Behandeln Sie zurückgegebene Claims als authentifizierte Daten, nicht automatisch als autorisierte Anwendungseingabe, und prüfen Sie weiterhin Herausgeber, Zielgruppe, Subjekt und anwendungsspezifische Bedingungen.

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
| `key_length` | integer | Gewünschte Schlüssellänge in Bytes |
| `hash` | string? | sha256 oder sha512 (Standard: sha256) |

**Gibt zurück:** `string, error`

Der abgeleitete Schlüssel besteht aus Rohbytes. Verwenden Sie für jeden gespeicherten Passwortprüfwert ein neues zufälliges Salt und speichern Sie Salt und Arbeitsfaktorparameter zusammen mit dem Prüfwert; das Salt muss nicht geheim sein. Verwenden Sie kein festes Beispiel-Salt für die produktive Passwortspeicherung.

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

Bei unterschiedlichen Längen ist das Ergebnis `false`. Die Garantie des zugrunde liegenden konstantzeitlichen Vergleichs gilt für gleich lange Eingaben. Vergleichen Sie daher Digests fester Länge oder andere gleich lange Geheimnisse.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ungültige Länge | `errors.INVALID` | nein |
| Leerer Schlüssel | `errors.INVALID` | nein |
| Ungültige Schlüsselgröße | `errors.INVALID` | nein |
| Entschlüsselung fehlgeschlagen | `errors.INTERNAL` | nein |
| Token abgelaufen | `errors.INTERNAL` | nein |

Informationen zum Umgang mit Fehlern finden Sie unter [Fehlerbehandlung](../core/errors.md).
