---
title: "Sicherheitsmodell"
description: "Wippy implementiert attributbasierte Zugriffskontrolle. Jede Anfrage trägt einen Actor (wer) und einen Scope (welche Richtlinien gelten). Richtlinien…"
---

# Sicherheitsmodell

Wippy implementiert attributbasierte Zugriffskontrolle. Jede Anfrage trägt einen Actor (wer) und einen Scope (welche Richtlinien gelten). Richtlinien evaluieren Zugriff basierend auf Aktion, Ressource und Metadaten von Actor und Ressource.

```mermaid
flowchart LR
    A[Actor + Scope] --> PE[Richtlinien-Evaluierung] --> AD[Erlauben/Verweigern]
    A -.->|Identität<br/>Metadaten| PE
    PE -.->|Bedingungen<br/>actor, resource, action| AD
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
    return nil, errors.new({ kind = errors.PERMISSION_DENIED, message = "Kein Actor im Kontext" })
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
1. Kein Actor oder kein Scope im Kontext → der strikte Modus entscheidet (standardmäßig verweigern)
2. Jede Richtlinie im Scope prüfen
3. Wenn IRGENDEINE Richtlinie Deny zurückgibt → Ergebnis ist Deny
4. Wenn mindestens ein Allow und kein Deny → Ergebnis ist Allow
5. Keine anwendbaren Richtlinien → Ergebnis ist Undefined
```

Eine Zugriffsprüfung besteht nur bei `Allow`. `Undefined` verweigert den Zugriff, genau wie `Deny` — der strikte Modus spielt keine Rolle mehr, sobald Actor und Scope beide vorhanden sind.

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
    return nil, errors.new({ kind = errors.PERMISSION_DENIED, message = "Zugriff verweigert" })
elseif result == "undefined" then
    -- Keine Richtlinie passte - Zugriffsprüfungen behandeln das als verweigert
end
```

### Schnelle Berechtigungsprüfung

```lua
-- Gegen Actor und Scope des aktuellen Kontexts prüfen
local allowed = security.can("read", "document:123", {
    owner = "user:456"
})

if not allowed then
    return nil, errors.new({ kind = errors.PERMISSION_DENIED, message = "Zugriff verweigert" })
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
    token_key: ${env:AUTH_SECRET_KEY}
```

### Token-Store-Optionen

| Option | Standard | Beschreibung |
|--------|----------|--------------|
| `store` | erforderlich | Backing-Key-Value-Store-Referenz |
| `token_length` | 32 | Token-Größe in Bytes (256 Bits) |
| `default_expiration` | 24h | Standard-Token-TTL |
| `token_key` | keiner | HMAC-SHA256-Signaturschlüssel (direkter Wert oder `${env:NAME}`, um ihn aus der [env-Registry](system/env.md) zu holen) |

Verwende `token_key: ${env:NAME}` in Produktion, um Geheimnisse nicht in Einträgen einzubetten. Die alte `token_key_env`-Direktive löst auf dieselbe Weise auf, ist aber veraltet; bevorzuge `${env:NAME}`.

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
    return nil, errors.new({ kind = errors.PERMISSION_DENIED, message = "Ungültiges Token" })
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

Funktionen und gestartete Prozesse erben beide den Sicherheitskontext des Aufrufers. Ein gestarteter Prozess beginnt auf einem Frame, der vom Frame des Starters abgezweigt ist und dessen Actor und Scope trägt, und der `security:`-Block seines eigenen Entries modifiziert diesen geerbten Kontext. Deklariert der Entry keinen Block, behält der Prozess Actor und Scope des Starters unverändert; ein Starter, der keines von beiden hat, erzeugt ein Kind ohne beides, was der strikte Modus verweigert. Ein deklarierter Block, der einen `actor` benennt, ersetzt den geerbten Actor, und seine `policies` und `groups` werden in den geerbten Scope gemergt; ein Block, der `actor` weglässt, behält den Actor des Starters, und einer, der sowohl `policies` als auch `groups` weglässt, behält dessen Scope.

## Sicherheit an Entries deklarieren

Ein Sicherheitsblock hat überall dieselbe Form:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `actor.id` | string | Actor-Identität; ersetzt den geerbten Actor |
| `actor.meta` | map | Actor-Attribute, die Richtlinien auswerten |
| `policies` | list | Registry-IDs von Richtlinien, die in den Scope gemischt werden |
| `groups` | list | Registry-IDs von Richtliniengruppen, deren Richtlinien in den Scope gemischt werden |

`policies` und `groups` sind **Registry-IDs in der Form `namespace:name`**. Ein bloßer Name löst nicht auf — anders als das `groups:`-Feld an einem Richtlinien-Entry, das auf den Namespace der Richtlinie selbst zurückfällt, tragen diese Referenzen keinen Standard-Namespace.

Die Auflösung ist atomar und fail-closed. Jede aufgeführte Richtlinie und Gruppe wird aufgelöst, bevor irgendetwas installiert wird; fehlt eine davon, ist sie leer oder enthält keine Richtlinien, scheitert die gesamte Konfiguration, und weder ein Actor noch ein unvollständiger Scope wird angewendet. Ein Aufrufer überschreitet daher nie eine Grenze mit einem halben Kontext.

### Prozess-Entries

`process.lua`-, `process.lua.bc`-, `function.lua`- und `function.lua.bc`-Entries nehmen einen `security:`-Block auf oberster Ebene, der für jede Ausführung dieses Entries gilt:

```yaml
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main
  security:
    actor:
      id: "service:worker"
      meta:
        role: worker
        service: true
    policies:
      - app.security:worker_policy
    groups:
      - app.security:workers
```

Der Block wird beim Start des Prozesses angewendet, sowohl auf `process.host` als auch auf `terminal.host`. Ein Auflösungsfehler bricht den Start ab, statt den Prozess mit einem schwächeren Kontext zu starten.

### Dienst-Lebenszyklus

Überwachte Dienste nehmen denselben Block unter `lifecycle` auf, einmal aufgelöst beim Erstellen des Dienst-Controllers und für die Lebensdauer des Dienstes versiegelt:

```yaml
- name: worker
  kind: process.service
  process: app:worker_process
  host: app:processes
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "service:worker"
      groups:
        - app.security:workers
```

### CLI-Befehle

Ein Befehls-Entry deklariert `meta.command.security`, angewendet nur, wenn der Entry als CLI-Befehl gestartet wird — der Operator, der `wippy run <name>` ausführt, ist der Vertrauensanker für diesen Kontext. Auf einen gewöhnlichen Start desselben Entries wirkt es nie. Der Block wird strikt validiert: Unbekannte Felder werden abgelehnt, ein leerer Block wird abgelehnt, und `security` ohne Befehls-`name` wird abgelehnt. Siehe [Befehlssicherheit](guides/cli.md#command-security).

## Strikter Modus

Der strikte Modus entscheidet, was passiert, wenn eine Anfrage weder Actor noch Scope trägt. Er ist **standardmäßig an**, ein unvollständiger Kontext wird also verweigert. Ihn abzuschalten ist eine explizite Entscheidung, getroffen in der Runtime-Konfigurationsdatei (`.wippy.yaml`), nicht im Modul-Manifest `wippy.yaml`:

```yaml
# .wippy.yaml
security:
  strict_mode: false
```

| Modus | Fehlender Kontext | Verhalten |
|-------|-------------------|-----------|
| Strikt (Standard) | Kein Actor/Scope | Verweigern |
| Permissiv (`strict_mode: false`) | Kein Actor/Scope | Erlauben |

Der strikte Modus ändert nichts, sobald Actor und Scope vorhanden sind: Die Evaluierung verweigert ohnehin im Zweifel. Er regelt nur den unvollständigen Fall, weshalb ein Prozess, der ohne deklarierten Sicherheitskontext läuft, unter der Voreinstellung jede Prüfung nicht besteht. Gib einem solchen Prozess einen `security:`-Block oder starte ihn über einen Pfad, der einen liefert.

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

## Vertrauensgrenzen der Runtime

Die Richtlinien-Evaluierung regelt, was Code tun darf. Drei separate Mechanismen regeln, welcher Code zugelassen wird und wohin ein Kontext reisen darf.

### Modul-Integrität

Jedes Modul in `wippy.lock` trägt einen Artefakt-Digest. Beim Boot wird ein Download gegen den im Lock fixierten Digest und den vom Hub ausgelieferten Digest verifiziert, und bereits vendorierte Packs werden gegen den Lock erneut verifiziert, bevor sie geladen werden; eine Abweichung ist ein nicht wiederholbarer Integritätsfehler, der nicht umgangen wird — das Modul wird nicht geladen. `wippy install` verifiziert einen frischen Download nur gegen den Digest und die Größe, die der Hub ausgeliefert hat, löscht die Datei und scheitert bei Abweichung und schreibt anschließend den ausgelieferten Digest in den Lock zurück; ein fixierter Digest wird von install also neu etabliert, nicht durchgesetzt. Nur Packs, die bereits im Vendor-Verzeichnis liegen, werden gegen den Digest des Locks geprüft. Entpackte Modulverzeichnisse tragen ihren eigenen aufgezeichneten Digest und Baum-Digest und werden auf dieselbe Weise geprüft, sodass ein veränderter vendorierter Baum erkannt statt vertraut wird. Siehe [Abhängigkeitsverwaltung](guides/dependency-management.md#integrity-verification).

### Internode-Identität im Cluster

Knoten in einem Cluster authentifizieren einander. Jeder Knoten hält einen ed25519-Identitätsschlüssel und die Map der öffentlichen Schlüssel der Peers, denen er vertraut; der Mesh-Handshake ist gegenseitig und bindet ein HMAC über das gemeinsame Gossip-Secret an eine ed25519-Signatur über ein Transcript, das beide Knoten-IDs und beide Nonces umfasst. Ein Peer, der nicht in der vertrauten Map steht oder dessen per Gossip angekündigter Schlüssel dem vertrauten Eintrag widerspricht, wird abgelehnt. Es gibt keinen unauthentifizierten Modus: Ein Knoten ohne Identität kann dem Mesh nicht beitreten. Siehe [Internode-Identität](guides/cluster.md#internode-identity).

### Temporal-Propagierung

Ein Sicherheitskontext, der nach Temporal übergeht, wird als signierter Header getragen, nicht als einfache Workflow-Eingabe. Der Actor, seine Metadaten und die Richtlinien-IDs werden in einen `wippy-security`-Umschlag serialisiert und mit dem HMAC-Schlüssel des Clients signiert, adressiert an die konkrete Workflow- oder Activity-ID. Der empfangende Worker prüft Signatur und Adressat und löst jede benannte Richtlinie lokal auf, bevor der Workflow oder die Activity läuft; jeder Fehlschlag lässt die Ausführung scheitern. Ein Workflow, der unter einem Sicherheitskontext läuft, weist zudem unsignierte Signale ab, sodass ein externer Temporal-Client ihn nicht steuern kann. Siehe [Workflows](temporal/workflows.md#security-context) und [Temporal-Überblick](temporal/overview.md#security-context-propagation).

## Best Practices

1. **Minimale Privilegien** - Nur minimal erforderliche Berechtigungen gewähren
2. **Standardmäßig verweigern** - Explizite Allow-Richtlinien verwenden, strikten Modus aktivieren
3. **Richtliniengruppen verwenden** - Richtlinien nach Rolle/Funktion organisieren
4. **Tokens signieren** - `token_key` in Produktion immer aus einer `${env:NAME}`-Referenz setzen
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
