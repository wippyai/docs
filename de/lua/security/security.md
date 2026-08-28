---
title: "Sicherheit & Zugriffskontrolle"
description: "Aktuellen Actor und Scope untersuchen, Richtlinien auswerten und Authentifizierungstokens verwalten."
---

# Sicherheit & Zugriffskontrolle
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Das Modul `security` stellt Authentifizierungs-Actors, Autorisierungs-Scopes, Richtlinien und Token-Stores bereit. Diese Seite ist eine API-Referenz mit Teilrezepten zur Autorisierung. Registry-IDs, Actors, Anfragemetadaten, Token-Werte, Anwendungsobjekte wie `user` und `doc` sowie Callbacks wie `show_admin_features` stammen aus der umgebenden Anwendung; die Beispiele bilden keine vollständige Authentifizierungsbereitstellung.

Wippy verwendet standardmäßig den strikten Sicherheitsmodus. Der ausführbare Eintrag muss `security` aktivieren, einen Actor und Scope besitzen und genau die aufgerufenen Operationen autorisieren. Insbesondere erfordern Konstruktion und Scope-Änderungen `security.actor.create` oder `security.scope.create`; Registry-Abfragen benötigen `security.policy.get` oder `security.policy_group.get`; Token-Operationen erfordern `security.token_store.get` sowie die operationsspezifische Token-Berechtigung. `new_actor`, `new_scope`, `scope:with`, `scope:without` und das bei einer Berechtigungsverweigerung ausgeführte Abrufen eines `token_store` lösen einen Lua-Fehler aus, anstatt einen strukturierten `error` zurückzugeben. Gewähren Sie diese Voraussetzungen im Sicherheitskontext des Eintrags, statt nach einer Verweigerung eine Fehlerbehandlung zu versuchen. Informationen zur Konfiguration finden Sie unter [Sicherheitsmodell](system/security.md).

## Laden

```lua
local security = require("security")
```

## `actor`

Gibt den aktuellen Sicherheits-Actor aus dem Ausführungskontext zurück.

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()
    -- Use only the fields required for authorization or application logic.
    local role = meta.role
end
```

**Gibt zurück:** `Actor|nil`

Actor-Metadaten können Identifikatoren oder personenbezogene Daten enthalten. Protokollieren Sie nicht die vollständige Metadatentabelle und speichern Sie darin keine Geheimnisse.

## `scope`

Gibt den aktuellen Sicherheits-Scope aus dem Ausführungskontext zurück.

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

## `can`

Prüft, ob der aktuelle Kontext eine Aktion auf einer Ressource erlaubt.

```lua
-- Check read permission
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new({
        message = "Cannot read user data",
        kind = errors.PERMISSION_DENIED
    })
end

-- Check write permission
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new({
        message = "Cannot modify order",
        kind = errors.PERMISSION_DENIED
    })
end

-- Check with metadata
local allowed = security.can("delete", "document:" .. doc_id, {
    owner_id = doc.owner_id,
    department = doc.department
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `action` | string | Zu prüfende Aktion |
| `resource` | string | Ressourcenidentifikator |
| `meta` | table | Zusätzliche Metadaten (optional) |

**Gibt zurück:** `boolean`

## `new_actor`

Erstellt einen neuen Actor mit ID und Metadaten.

```lua
-- Create user actor
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- Create service actor
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

## `new_scope`

Erstellt einen neuen benutzerdefinierten Scope.

```lua
-- Empty scope
local scope = security.new_scope()

-- Scope with policies
local read_policy, read_err = security.policy("app:read-only")
if read_err then
    return nil, read_err
end
local scope = security.new_scope({read_policy})

-- Build scope incrementally
local scope = security.new_scope()
local policy1, policy1_err = security.policy("app:read")
if policy1_err then
    return nil, policy1_err
end
local policy2, policy2_err = security.policy("app:write")
if policy2_err then
    return nil, policy2_err
end
scope = scope:with(policy1):with(policy2)
```

**Gibt zurück:** `Scope`

Die Alternativen oben sind voneinander unabhängige Konstruktionsmuster. `new_scope` und `scope:with` können bei fehlendem Kontext oder einer Berechtigungsverweigerung einen Fehler auslösen; für diese Prüfungen geben sie nicht `nil, error` zurück.

## `policy`

Ruft eine Richtlinie aus der Registry ab.

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- Evaluate policy
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- permitted
elseif result == "deny" then
    -- forbidden
else
    -- undefined, check other policies
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Richtlinien-ID "namespace:name" |

**Gibt zurück:** `Policy, error`

## `named_scope`

Ruft eine vordefinierte Richtliniengruppe ab.

```lua
-- Get admin scope
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- Use for elevated operations
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Richtliniengruppen-ID |

**Gibt zurück:** `Scope, error`

Das Laden eines Scopes erhöht nicht die Berechtigungen des aktuellen Ausführungskontexts. Es erzeugt einen Wert für eine explizite Auswertung oder für eine API, die einen Scope akzeptiert; der Aufrufer benötigt weiterhin die Berechtigung für die geschützte Operation.

## `token_store`

Beschafft einen Token-Store zur Verwaltung von Authentifizierungstokens.

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- Use store...
return store:close()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Token-Store-ID "namespace:name" |

**Gibt zurück:** `TokenStore, error`

Der Aufrufer ist für einen abgerufenen Token-Store verantwortlich, bis `close()` aufgerufen wurde. Schließen Sie ihn nach der letzten Operation auf jedem geprüften Erfolgs- und Fehlerpfad; wiederholtes Schließen ist sicher. Eine Berechtigungsverweigerung beim Abrufen löst einen Lua-Fehler aus, während Abfrage- und Ressourcenfehler `nil, error` zurückgeben.

## `Actor` Methods

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `actor:id()` | string | Actor-Identifikator |
| `actor:meta()` | table | Actor-Metadaten |

## `Scope` Methods

### `with` / `without`

Richtlinien zum Scope hinzufügen oder entfernen.

```lua
local scope = security.new_scope()

-- Add policy
local write_policy, err = security.policy("app:write")
if err then
    return nil, err
end
scope = scope:with(write_policy)

-- Remove policy
scope = scope:without("app:read-only")
```

`with` und `without` geben neue unveränderliche Scope-Werte zurück und lösen einen Fehler aus, wenn `security.scope.create` für die Ressource `with` beziehungsweise `without` nicht erlaubt ist.

### `evaluate`

Alle Richtlinien im Scope auswerten.

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow", "deny", or "undefined"

if result ~= "allow" then
    return nil, errors.new({
        message = "Access denied",
        kind = errors.PERMISSION_DENIED
    })
end
```

### `contains`

Prüfen, ob Scope eine Richtlinie enthält.

```lua
if scope:contains("app:admin") then
    show_admin_features()
end
```

### `policies`

Gibt alle Richtlinien im Scope zurück.

```lua
local policies = scope:policies()
for _, policy in ipairs(policies) do
    print(policy:id())
end
```

**Gibt zurück:** `Policy[]`

## `Policy` Methods

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `policy:id()` | string | Richtlinien-Identifikator |
| `policy:evaluate(actor, action, resource, meta?)` | string | `"allow"`, `"deny"` oder `"undefined"` |

## `TokenStore` Methods

### `create`

Authentifizierungstoken erstellen.

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope, scope_err = security.named_scope("app:default")
if scope_err then
    return nil, scope_err
end
local store, store_err = security.token_store("app:tokens")
if store_err then
    return nil, store_err
end

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- or milliseconds
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
store:close()
if err then
    return nil, err
end
return token
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `actor` | Actor | Actor für den Token |
| `scope` | Scope | Berechtigungs-Scope |
| `options.expiration` | string/number | Dauer-String oder ms |
| `options.meta` | table | Token-Metadaten |

**Gibt zurück:** `string, error`

`request_ip` und `user_agent` sind von der Anwendung bereitgestellte Anforderungswerte. Speichern Sie nur Metadaten, die für Sicherheitsentscheidungen benötigt werden, wenden Sie Aufbewahrungsgrenzen an und protokollieren oder persistieren Sie das zurückgegebene Bearer-Token niemals außerhalb des vorgesehenen Anmeldedatenspeichers.

### `validate`

Token validieren und Actor/Scope holen.

```lua
local actor, scope, err = store:validate(token)
store:close()
if err then
    return nil, err
end
```

Hier und in den folgenden Abschnitten ist `store` ein aktives Handle im Besitz des Aufrufers und `token` ein nicht vertrauenswürdiger Bearer-Anmeldedatensatz. Protokollieren Sie das Token auch bei Validierungs- oder Widerrufsfehlern nicht.

**Gibt zurück:** `Actor, Scope, error`

### `revoke`

Token ungültig machen.

```lua
local ok, err = store:revoke(token)
store:close()
if err then
    return nil, err
end
```

**Gibt zurück:** `boolean, error`

### `close`

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
| `security.scope.create` | `with` | Mit `scope:with` eine Richtlinie hinzufügen |
| `security.scope.create` | `without` | Mit `scope:without` eine Richtlinie entfernen |
| `security.actor.create` | Actor-ID | Actors erstellen |
| `security.token_store.get` | Store-ID | Auf Token-Stores zugreifen |
| `security.token.validate` | Store-ID | Tokens validieren |
| `security.token.create` | Store-ID | Tokens erstellen |
| `security.token.revoke` | Store-ID | Tokens widerrufen |

Informationen zur Richtlinienkonfiguration finden Sie unter [Sicherheitsmodell](system/security.md).

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Kein Kontext | `errors.INTERNAL` | nein |
| Leere Token-Store-ID | `errors.INVALID` | nein |
| Berechtigung für Richtlinie, benannten Scope oder Token-Operation verweigert | `errors.INVALID` | nein |
| Konstruktion von Actor oder Scope, Scope-Änderung oder Abruf des Token-Stores verweigert | ausgelöster Lua-Fehler | nein |
| Richtlinie nicht gefunden | `errors.INTERNAL` | nein |
| Token-Store nicht gefunden | `errors.INTERNAL` | nein |
| Token-Store geschlossen | `errors.INTERNAL` | nein |
| Ungültiges Ablaufformat | `errors.INVALID` | nein |
| Token-Validierung fehlgeschlagen | `errors.INTERNAL` | nein |

```lua
local store, err = security.token_store("app:tokens")
if err then
    if errors.is(err, errors.INVALID) then
        print("Invalid request:", err:message())
    end
    return nil, err
end
store:close()
```

Informationen zum Umgang mit Fehlern finden Sie unter [Fehlerbehandlung](lua/core/errors.md).

## Siehe auch

- [Sicherheitsmodell](../../system/security.md) – Konfiguration von Actors, Richtlinien und Scopes
- [HTTP-Middleware](http/middleware.md) – Firewall für Endpoints und Ressourcen
