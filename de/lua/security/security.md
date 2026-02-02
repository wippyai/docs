# Sicherheit & Zugriffskontrolle
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Verwalten Sie Authentifizierungs-Actors, Autorisierungs-Scopes und Zugriffsrichtlinien.

## Laden

```lua
local security = require("security")
```

## actor

Gibt den aktuellen Sicherheits-Actor aus dem Ausfuhrungskontext zurück.

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()

    logger:info("Request from", {
        user_id = id,
        role = meta.role
    })
end
```

**Gibt zurück:** `Actor|nil`

## scope

Gibt den aktuellen Sicherheits-Scope aus dem Ausfuhrungskontext zurück.

```lua
local scope = security.scope()
if scope then
    local policies = scope:policies()
    for _, policy in ipairs(policies) do
        print("Active policy:", policy:id())
    end
end
```

**Gibt zurück:** `Scope|nil`

## can

Pruft, ob der aktuelle Kontext eine Aktion auf einer Ressource erlaubt.

```lua
-- Leseberechtigung prufen
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new("PERMISSION_DENIED", "Cannot read user data")
end

-- Schreibberechtigung prufen
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new("PERMISSION_DENIED", "Cannot modify order")
end

-- Mit Metadaten prufen
local allowed = security.can("delete", "document:" .. doc_id, {
    owner_id = doc.owner_id,
    department = doc.department
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `action` | string | Zu prufende Aktion |
| `resource` | string | Ressourcenidentifikator |
| `meta` | table | Zusatzliche Metadaten (optional) |

**Gibt zurück:** `boolean`

## new_actor

Erstellt einen neuen Actor mit ID und Metadaten.

```lua
-- Benutzer-Actor erstellen
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- Service-Actor erstellen
local service_actor = security.new_actor("service:payment-processor", {
    type = "service",
    version = "1.0.0"
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Eindeutiger Actor-Identifikator |
| `meta` | table | Metadaten-Schlüssel-Wert-Paare |

**Gibt zurück:** `Actor`

## new_scope

Erstellt einen neuen benutzerdefinierten Scope.

```lua
-- Leerer Scope
local scope = security.new_scope()

-- Scope mit Richtlinien
local read_policy = security.policy("app:read-only")
local scope = security.new_scope({read_policy})

-- Scope inkrementell aufbauen
local scope = security.new_scope()
local policy1 = security.policy("app:read")
local policy2 = security.policy("app:write")
scope = scope:with(policy1):with(policy2)
```

**Gibt zurück:** `Scope`

## policy

Ruft eine Richtlinie aus der Registry ab.

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- Richtlinie auswerten
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- erlaubt
elseif result == "deny" then
    -- verboten
else
    -- undefiniert, andere Richtlinien prufen
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Richtlinien-ID "namespace:name" |

**Gibt zurück:** `Policy, error`

## named_scope

Ruft eine vordefinierte Richtliniengruppe ab.

```lua
-- Admin-Scope holen
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- Für erhohte Operationen verwenden
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Richtliniengruppen-ID |

**Gibt zurück:** `Scope, error`

## token_store

Beschafft einen Token-Store zur Verwaltung von Authentifizierungstokens.

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- Store verwenden...
store:close()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Token-Store-ID "namespace:name" |

**Gibt zurück:** `TokenStore, error`

## Actor-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `actor:id()` | string | Actor-Identifikator |
| `actor:meta()` | table | Actor-Metadaten |

## Scope-Methoden

### with / without

Richtlinien zum Scope hinzufügen oder entfernen.

```lua
local scope = security.new_scope()

-- Richtlinie hinzufügen
local write_policy = security.policy("app:write")
scope = scope:with(write_policy)

-- Richtlinie entfernen
scope = scope:without("app:read-only")
```

### evaluate

Alle Richtlinien im Scope auswerten.

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow", "deny" oder "undefined"

if result ~= "allow" then
    return nil, errors.new("PERMISSION_DENIED", "Access denied")
end
```

### contains

Prufen, ob Scope eine Richtlinie enthalt.

```lua
if scope:contains("app:admin") then
    show_admin_features()
end
```

### policies

Gibt alle Richtlinien im Scope zurück.

```lua
local policies = scope:policies()
for _, policy in ipairs(policies) do
    print(policy:id())
end
```

**Gibt zurück:** `Policy[]`

## Policy-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `policy:id()` | string | Richtlinien-Identifikator |
| `policy:evaluate(actor, action, resource, meta?)` | string | `"allow"`, `"deny"` oder `"undefined"` |

## TokenStore-Methoden

### create

Authentifizierungstoken erstellen.

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope = security.named_scope("app:default")

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- oder Millisekunden
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `actor` | Actor | Actor für den Token |
| `scope` | Scope | Berechtigungs-Scope |
| `options.expiration` | string/number | Dauer-String oder ms |
| `options.meta` | table | Token-Metadaten |

**Gibt zurück:** `string, error`

### validate

Token validieren und Actor/Scope holen.

```lua
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHENTICATED", "Invalid token")
end
```

**Gibt zurück:** `Actor, Scope, error`

### revoke

Token ungültig machen.

```lua
local ok, err = store:revoke(token)
```

**Gibt zurück:** `boolean, error`

### close

Token-Store-Ressource freigeben.

```lua
store:close()
```

**Gibt zurück:** `boolean`

## Berechtigungen

Sicherheitsoperationen unterliegen der Sicherheitsrichtlinienauswertung.

### Sicherheitsaktionen

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `security.policy.get` | Richtlinien-ID | Auf Richtliniendefinitionen zugreifen |
| `security.policy_group.get` | Gruppen-ID | Auf benannte Scopes zugreifen |
| `security.scope.create` | `custom` | Benutzerdefinierte Scopes erstellen |
| `security.actor.create` | Actor-ID | Actors erstellen |
| `security.token_store.get` | Store-ID | Auf Token-Stores zugreifen |
| `security.token.validate` | Store-ID | Tokens validieren |
| `security.token.create` | Store-ID | Tokens erstellen |
| `security.token.revoke` | Store-ID | Tokens widerrufen |

Siehe [Sicherheitsmodell](system-security.md) für Richtlinienkonfiguration.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Kein Kontext | `errors.INTERNAL` | nein |
| Leere Token-Store-ID | `errors.INVALID` | nein |
| Berechtigung verweigert | `errors.INVALID` | nein |
| Richtlinie nicht gefunden | `errors.INTERNAL` | nein |
| Token-Store nicht gefunden | `errors.INTERNAL` | nein |
| Token-Store geschlossen | `errors.INTERNAL` | nein |
| Ungultiges Ablaufformat | `errors.INVALID` | nein |
| Token-Validierung fehlgeschlagen | `errors.INTERNAL` | nein |

```lua
local store, err = security.token_store("app:tokens")
if err then
    if errors.is(err, errors.INVALID) then
        print("Invalid request:", err:message())
    end
    return nil, err
end
```

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.

## Siehe auch

- [Sicherheitsmodell](system-security.md) - Actors, Richtlinien, Scopes-Konfiguration
- [HTTP-Middleware](http-middleware.md) - Endpoint- und Ressourcen-Firewall
