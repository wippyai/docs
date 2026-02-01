# Sicherheitsmodell

Wippy implementiert attributbasierte Zugriffskontrolle. Jede Anfrage trägt einen Actor (wer) und einen Scope (welche Richtlinien gelten). Richtlinien evaluieren Zugriff basierend auf Aktion, Ressource und Metadaten von Actor und Ressource.

```
Actor + Scope ──► Richtlinien-Evaluierung ──► Erlauben/Verweigern
     │                   │
  Identität          Bedingungen
  Metadaten      (actor, resource, action)
```

## Entry-Typen

| Kind | Beschreibung |
|------|--------------|
| `security.policy` | Deklarative Richtlinie mit Bedingungen |
| `security.policy.expr` | Expression-basierte Richtlinie |
| `security.token_store` | Token-Speicherung und -Validierung |

## Actors

Ein Actor repräsentiert, wer eine Aktion ausführt.

```lua
local security = require("security")

-- Actor mit Metadaten erstellen
local actor = security.new_actor("user:123", {
    role = "admin",
    team = "backend",
    department = "engineering",
    clearance = 3
})

-- Actor-Eigenschaften abrufen
local id = actor:id()        -- "user:123"
local meta = actor:meta()    -- {role="admin", ...}
```

### Actor im Kontext

```lua
-- Aktuellen Actor aus Kontext abrufen
local actor = security.actor()
if not actor then
    return nil, errors.new("UNAUTHORIZED", "Kein Actor im Kontext")
end
```

## Richtlinien

Richtlinien definieren Zugriffsregeln mit Aktionen, Ressourcen, Bedingungen und Effekten.

### Deklarative Richtlinie

```yaml
# src/security/_index.yaml
version: "1.0"
namespace: app.security

entries:
  # Admin-Vollzugriff
  - name: admin_policy
    kind: security.policy
    policy:
      actions: "*"
      resources: "*"
      effect: allow
      conditions:
        - field: actor.meta.role
          operator: eq
          value: admin
    groups:
      - admin

  # Nur-Lese-Zugriff
  - name: readonly_policy
    kind: security.policy
    policy:
      actions:
        - "*.read"
        - "*.get"
        - "*.list"
      resources: "*"
      effect: allow
    groups:
      - default

  # Ressourcen-Eigentümer-Zugriff
  - name: owner_policy
    kind: security.policy
    policy:
      actions:
        - read
        - write
        - delete
      resources: "document:*"
      effect: allow
      conditions:
        - field: meta.owner
          operator: eq
          value_from: actor.id
    groups:
      - default

  # Vertraulich ohne Freigabe verweigern
  - name: deny_confidential
    kind: security.policy
    policy:
      actions: "*"
      resources: "document:*"
      effect: deny
      conditions:
        - field: meta.classification
          operator: eq
          value: confidential
        - field: actor.meta.clearance
          operator: lt
          value: 3
    groups:
      - security
```

### Richtlinienstruktur

```yaml
policy:
  actions: "*" | "action" | ["action1", "action2"]
  resources: "*" | "resource" | ["res1", "res2"]
  effect: allow | deny
  conditions:  # Optional
    - field: "field.path"
      operator: "eq"
      value: "static_value"
      # ODER
      value_from: "other.field.path"
```

### Expression-basierte Richtlinie

Für komplexe Logik verwenden Sie Expression-Richtlinien:

```yaml
- name: flexible_access
  kind: security.policy.expr
  policy:
    actions:
      - read
      - write
    resources: "file:*"
    effect: allow
    expression: |
      (actor.meta.role == "editor" && action == "write") ||
      (action == "read" && meta.public == true) ||
      actor.id == meta.owner
  groups:
    - editors
```

## Bedingungen

Bedingungen ermöglichen dynamische Richtlinien-Evaluierung basierend auf Actor, Aktion, Ressource und Metadaten.

### Feldpfade

| Pfad | Beschreibung |
|------|--------------|
| `actor.id` | Eindeutiger Bezeichner des Actors |
| `actor.meta.*` | Actor-Metadaten (unterstützt Verschachtelung) |
| `action` | Die ausgeführte Aktion |
| `resource` | Der Ressourcen-Bezeichner |
| `meta.*` | Ressourcen-Metadaten |

### Operatoren

| Operator | Beschreibung | Beispiel |
|----------|--------------|----------|
| `eq` | Gleich | `actor.meta.role eq "admin"` |
| `ne` | Ungleich | `meta.status ne "deleted"` |
| `lt` | Kleiner als | `meta.priority lt 5` |
| `gt` | Größer als | `actor.meta.clearance gt 2` |
| `lte` | Kleiner oder gleich | `meta.size lte 1000` |
| `gte` | Größer oder gleich | `actor.meta.level gte 3` |
| `in` | Wert in Array | `action in ["read", "write"]` |
| `nin` | Wert nicht in Array | `meta.status nin ["deleted", "archived"]` |
| `exists` | Feld existiert | `meta.owner exists true` |
| `nexists` | Feld existiert nicht | `meta.deleted nexists true` |
| `contains` | String enthält | `resource contains "sensitive"` |
| `ncontains` | String enthält nicht | `resource ncontains "public"` |
| `matches` | Regex-Match | `resource matches "^doc:.*"` |
| `nmatches` | Regex-Match nicht | `actor.id nmatches "^system:.*"` |

### Bedingungsbeispiele

```yaml
# Actor-Rolle matchen
conditions:
  - field: actor.meta.role
    operator: eq
    value: admin

# Felder vergleichen
conditions:
  - field: meta.owner
    operator: eq
    value_from: actor.id

# Numerischer Vergleich
conditions:
  - field: actor.meta.clearance
    operator: gte
    value: 3

# Array-Mitgliedschaft
conditions:
  - field: actor.meta.role
    operator: in
    value:
      - admin
      - moderator

# Muster-Matching
conditions:
  - field: resource
    operator: matches
    value: "^api:/v[0-9]+/admin/.*"

# Mehrere Bedingungen (UND)
conditions:
  - field: actor.meta.department
    operator: eq
    value: engineering
  - field: meta.environment
    operator: eq
    value: production
```

## Scopes

Scopes kombinieren mehrere Richtlinien zu einem Sicherheitskontext.

```lua
local security = require("security")

-- Richtlinien abrufen
local admin_policy = security.policy("app.security:admin_policy")
local readonly_policy = security.policy("app.security:readonly_policy")

-- Scope mit Richtlinien erstellen
local scope = security.new_scope()
scope = scope:with(admin_policy)
scope = scope:with(readonly_policy)

-- Scopes sind unveränderlich - :with() gibt neuen Scope zurück
```

### Benannte Scopes (Richtliniengruppen)

Alle Richtlinien aus einer Gruppe laden:

```lua
-- Scope mit allen Richtlinien in Gruppe laden
local scope, err = security.named_scope("app.security:admin")
```

Richtlinien werden Gruppen über das `groups`-Feld zugewiesen:

```yaml
- name: admin_policy
  kind: security.policy
  policy:
    # ...
  groups:
    - admin      # Diese Richtlinie ist in "admin"-Gruppe
    - default    # Kann in mehreren Gruppen sein
```

### Scope-Operationen

```lua
-- Richtlinie hinzufügen
local new_scope = scope:with(policy)

-- Richtlinie entfernen
local new_scope = scope:without("app.security:temp_policy")

-- Prüfen ob Richtlinie im Scope ist
local has = scope:contains("app.security:admin_policy")

-- Alle Richtlinien abrufen
local policies = scope:policies()
```

## Richtlinien-Evaluierung

### Evaluierungsablauf

```
1. Jede Richtlinie im Scope prüfen
2. Wenn IRGENDEINE Richtlinie Deny zurückgibt → Ergebnis ist Deny
3. Wenn mindestens ein Allow und kein Deny → Ergebnis ist Allow
4. Keine anwendbaren Richtlinien → Ergebnis ist Undefined
```

### Evaluierungsergebnisse

| Ergebnis | Bedeutung |
|----------|-----------|
| `allow` | Zugriff gewährt |
| `deny` | Zugriff explizit verweigert |
| `undefined` | Keine Richtlinie passte |

```lua
-- Direkt evaluieren
local result = scope:evaluate(actor, "read", "document:123", {
    owner = "user:456",
    classification = "internal"
})

if result == "deny" then
    return nil, errors.new("FORBIDDEN", "Zugriff verweigert")
elseif result == "undefined" then
    -- Keine Richtlinie passte - hängt vom strikten Modus ab
end
```

### Schnelle Berechtigungsprüfung

```lua
-- Gegen Actor und Scope des aktuellen Kontexts prüfen
local allowed = security.can("read", "document:123", {
    owner = "user:456"
})

if not allowed then
    return nil, errors.new("FORBIDDEN", "Zugriff verweigert")
end
```

## Token-Stores

Token-Stores bieten sichere Token-Erstellung, -Validierung und -Widerruf.

### Konfiguration

```yaml
# src/auth/_index.yaml
version: "1.0"
namespace: app.auth

entries:
  # Umgebungsvariable registrieren
  - name: os_env
    kind: env.storage.os

  - name: AUTH_SECRET_KEY
    kind: env.variable
    variable: AUTH_SECRET_KEY
    storage: app.auth:os_env

  # Backing-Store für Tokens
  - name: token_data
    kind: store.memory
    lifecycle:
      auto_start: true

  # Token-Store
  - name: tokens
    kind: security.token_store
    store: app.auth:token_data
    token_length: 32
    default_expiration: "24h"
    token_key_env: "AUTH_SECRET_KEY"
```

### Token-Store-Optionen

| Option | Standard | Beschreibung |
|--------|----------|--------------|
| `store` | erforderlich | Backing-Key-Value-Store-Referenz |
| `token_length` | 32 | Token-Größe in Bytes (256 Bits) |
| `default_expiration` | 24h | Standard-Token-TTL |
| `token_key` | keiner | HMAC-SHA256-Signaturschlüssel (direkter Wert) |
| `token_key_env` | keiner | Umgebungsvariablenname für Signaturschlüssel |

Verwenden Sie `token_key_env` in Produktion um Geheimnisse nicht in Einträgen einzubetten. Siehe [Umgebungssystem](system-env.md) für das Registrieren von Umgebungsvariablen.

### Tokens erstellen

```lua
local security = require("security")

-- Token-Store abrufen
local store, err = security.token_store("app.auth:tokens")
if err then
    return nil, err
end

-- Actor und Scope erstellen
local actor = security.new_actor("user:123", {
    role = "user",
    email = "user@example.com"
})

local scope, _ = security.named_scope("app.security:default")

-- Token erstellen
local token, err = store:create(actor, scope, {
    expiration = "7d",  -- Standard-Ablauf überschreiben
    meta = {
        device = "mobile",
        ip = "192.168.1.1"
    }
})

if err then
    return nil, err
end

-- Token-Format: base64_token.hmac_signature (wenn token_key gesetzt)
-- Beispiel: "dGVzdHRva2VuMTIz.a1b2c3d4e5f6"
```

### Tokens validieren

```lua
-- Token validieren
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHORIZED", "Ungültiges Token")
end

-- Actor und Scope werden aus gespeicherten Daten rekonstruiert
print(actor:id())  -- "user:123"
```

### Tokens widerrufen

```lua
-- Einzelnes Token widerrufen
local ok, err = store:revoke(token)

-- Store schließen wenn fertig
store:close()
```

## Kontextfluss

Sicherheitskontext propagiert durch Funktionsaufrufe.

### Kontext setzen

```lua
local funcs = require("funcs")

-- Funktion mit Sicherheitskontext aufrufen
local result, err = funcs.new()
    :with_actor(actor)
    :with_scope(scope)
    :call("app.api:protected_endpoint", data)
```

### Kontextvererbung

| Komponente | Vererbt |
|------------|---------|
| Actor | Ja - wird an Kindaufrufe weitergegeben |
| Scope | Ja - wird an Kindaufrufe weitergegeben |
| Strikter Modus | Nein - anwendungsweit |

Funktionen erben den Sicherheitskontext des Aufrufers. Gestartete Prozesse beginnen neu.

## Dienst-Level-Sicherheit

Standard-Sicherheit für Dienste konfigurieren:

```yaml
- name: worker_service
  kind: process.lua
  source: file://worker.lua
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "service:worker"
        meta:
          role: worker
          service: true
      policies:
        - app.security:worker_policy
      groups:
        - workers
```

## Strikter Modus

Strikten Modus aktivieren um Zugriff zu verweigern wenn Sicherheitskontext fehlt:

```yaml
# wippy.yaml
security:
  strict_mode: true
```

| Modus | Fehlender Kontext | Verhalten |
|-------|-------------------|-----------|
| Normal | Kein Actor/Scope | Erlauben (permissiv) |
| Strikt | Kein Actor/Scope | Verweigern (sichere Voreinstellung) |

## Authentifizierungsablauf

Token-Validierung in einem HTTP-Handler:

```lua
local http = require("http")
local security = require("security")

local function protected_handler()
    local req = http.request()
    local res = http.response()

    -- Token extrahieren und validieren
    local auth = req:header("Authorization")
    if not auth then
        return res:set_status(401):write_json({error = "Autorisierung fehlt"})
    end

    local token = auth:gsub("^Bearer%s+", "")
    local store, _ = security.token_store("app.auth:tokens")
    local actor, scope, err = store:validate(token)
    if err then
        return res:set_status(401):write_json({error = "Ungültiges Token"})
    end

    -- Berechtigung prüfen
    if not security.can("api.users.read", "users") then
        return res:set_status(403):write_json({error = "Verboten"})
    end

    res:write_json({user = actor:id()})
end

return { handler = protected_handler }
```

Token-Erstellung beim Login:

```lua
local actor = security.new_actor("user:" .. user.id, {role = user.role})
local scope, _ = security.named_scope("app.security:" .. user.role)

local store, _ = security.token_store("app.auth:tokens")
local token, err = store:create(actor, scope, {expiration = "24h"})
```

## Best Practices

1. **Minimale Privilegien** - Nur minimal erforderliche Berechtigungen gewähren
2. **Standardmäßig verweigern** - Explizite Allow-Richtlinien verwenden, strikten Modus aktivieren
3. **Richtliniengruppen verwenden** - Richtlinien nach Rolle/Funktion organisieren
4. **Tokens signieren** - Immer `token_key_env` in Produktion setzen
5. **Kurzer Ablauf** - Kürzere Token-Lebensdauern für sensible Operationen verwenden
6. **Kontext-Bedingungen** - Dynamische Bedingungen statt statischer Richtlinien verwenden
7. **Sensible Aktionen protokollieren** - Sicherheitsrelevante Operationen loggen

## Sicherheitsmodul-Referenz

| Funktion | Beschreibung |
|----------|--------------|
| `security.actor()` | Aktuellen Actor aus Kontext abrufen |
| `security.scope()` | Aktuellen Scope aus Kontext abrufen |
| `security.can(action, resource, meta?)` | Berechtigung prüfen |
| `security.new_actor(id, meta?)` | Neuen Actor erstellen |
| `security.new_scope(policies?)` | Leeren oder initialisierten Scope erstellen |
| `security.policy(id)` | Richtlinie nach ID abrufen |
| `security.named_scope(group_id)` | Scope mit allen Gruppenrichtlinien abrufen |
| `security.token_store(id)` | Token-Store abrufen |
