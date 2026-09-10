---
title: "Keeper über MCP"
description: "Wippy Keeper ist die Steuerungsebene für eine laufende Wippy-App — eine Registry-Werkbank, Governance zwischen Dateisystem und Registry, Agenten-/Task-Orchestrierung, Hub…"
---

# Keeper über MCP

Wippy Keeper ist die Steuerungsebene für eine laufende Wippy-App — eine Registry-Werkbank,
Governance zwischen Dateisystem und Registry, Agenten-/Task-Orchestrierung, Hub-Installation, Wissensdatenbank,
Logs und Prozessinspektion sowie ein Git-Review-/Push-Ablauf, alles hinter einer eingebauten UI. Ihr
prägendes Merkmal ist, dass sie diese Operator-Capabilities KI-Clients (Claude,
Codex, …) über **MCP (Model Context Protocol)** bereitstellt. Diese Seite fügt Keeper zu einer App hinzu und
verbindet einen MCP-Client damit.

## Was Sie bauen

1. Keeper, hinzugefügt zu einer aus `app-template` gerüsteten App.
2. Die Keeper-UI unter `/app/keeper` und den MCP-Endpunkt unter `/keeper-mcp/`.
3. Ein begrenztes MCP-Token und einen MCP-Client, der die App über Keeper steuert.

## Voraussetzungen

- Eine App aus [app-template](https://github.com/wippyai/app-template). Sie liefert
  bereits alles, woran Keeper sich bindet: `app:gateway`, `app:api`, `app:db`,
  `app:processes`, `app.security:admin` und `app.env:store`.
- Das installierte Keeper-Modul:

  ```bash
  wippy add keeper/keeper
  wippy install
  ```

## Keeper hinzufügen

Deklarieren Sie die Abhängigkeit und binden Sie sie an die Ressourcen der App. Nur `admin_scope` ist
erforderlich (kein Standardwert); der Rest verwendet standardmäßig die Namen, die `app-template` ohnehin nutzt, hier
zur Klarheit explizit gezeigt:

```yaml
# src/app/deps/_index.yaml
- name: keeper
  kind: ns.dependency
  component: keeper/keeper
  version: '>=v0.5.18'
  parameters:
    - { name: app_db,         value: app:db }
    - { name: admin_scope,    value: app.security:admin }
    - { name: env_storage,    value: app.env:store }
    - { name: public_gateway, value: app:gateway }   # hostet /keeper-mcp/
    - { name: mcp_route,      value: /keeper-mcp/ }
    - { name: ui_server,      value: app:gateway }
    - { name: process_host,   value: app:processes }
```

Starten Sie die App:

```bash
wippy run
```

Keeper hängt automatisch drei Oberflächen ein:

- **UI** — `/app/keeper`
- **MCP-Transport** — `/keeper-mcp/` auf dem öffentlichen Gateway
- **Token-API** — auf `app:api` (`/keeper/mcp/tokens`, `/keeper/mcp/scopes`)

Der MCP-Transport wird durch die Umgebungsvariable `MCP_ENABLED` gesteuert (Standard `true`);
setzen Sie sie auf `false`, um den Endpunkt zu schließen.

## Ein MCP-Token erzeugen

Token werden von einem Admin-Benutzer ausgestellt, sind begrenzt und werden genau einmal angezeigt. Erstellen Sie eines über die
Token-API (oder die MCP-Seite in der Keeper-UI):

```bash
curl -X POST http://localhost:8080/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "claude-dev", "preset": "developer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`preset` bündelt eine Menge von Scopes. Verfügbare Presets: `root`, `developer`,
`wippy_operator`, `observer`, `knowledge_manager`, `explorer_tools_only`. Für
feinere Kontrolle übergeben Sie stattdessen ein explizites `scopes`-Array (z. B. `registry.read`,
`state.write`, `git.pr`, `tasks.run`, `knowledge.read`). Das rohe `wkmcp_...`-Token wird
einmalig zurückgegeben und nur als Hash gespeichert — kopieren Sie es sofort.

## Einen Client verbinden

Richten Sie einen MCP-Client mit dem Token als Bearer-Header auf den Endpunkt. Für Claude Code /
Codex eine `.mcp.json` im Projektstammverzeichnis:

```json
{
  "mcpServers": {
    "keeper": {
      "type": "http",
      "url": "http://localhost:8080/keeper-mcp/",
      "headers": { "Authorization": "Bearer wkmcp_<token>" }
    }
  }
}
```

Verwenden Sie in einer bereitgestellten Umgebung die öffentliche Basis-URL der App anstelle von
`http://localhost:8080`.

## Wie die MCP-Oberfläche funktioniert

Keeper stellt keine flache, feste Werkzeugliste bereit. Es präsentiert einige **Meta-Tools** plus
**Traits**, die konkrete Tools bei Bedarf aktivieren, sodass die Oberfläche klein bleibt, bis Sie sich
für eine Capability entscheiden:

- `session_info` — immer verfügbar; meldet die Scopes und aktiven Traits der Sitzung.
- `list_traits` / `describe_trait` — herausfinden, was verfügbar ist.
- `use_trait` / `drop_trait` (und `set_traits`) — einen Trait aktivieren oder entfernen; das sendet
  ein MCP-`notifications/tools/list_changed`, sodass sich die sichtbaren Tools live ändern.
- `list_tools` — die von einem Trait materialisierten Tools samt ihren Schemas auflisten.
- `call_tool` — jedes Registry-Tool über seine ID aufrufen; nur für ein Token sichtbar, das
  `mcp.root` besitzt.

Was ein Token aktivieren kann, wird durch seine **Scopes** begrenzt — grob `registry.*`,
`state.*`, `hub.*`, `knowledge.*`, `git.*`, `components.*`, `tasks.*`, `agents.*`,
`tests.run`, `logger.*`, `env.*`, `functions.call`, `app.ui` (plus `mcp.root` für vollständige
Admin-Umgehung). Der `access_mode` des Tokens (`any` / `traits` / `tools_only`) schränkt zusätzlich
ein, wie es Tools aufrufen darf.

## Hinweise

- **Governance-Scope** — setzen Sie `GOV_MANAGED_NAMESPACES=app`, damit Keepers
  Synchronisation zwischen Dateisystem und Registry nur den Namespace Ihrer App verwaltet. Fügen Sie `keeper`,
  `wippy` oder `userspace` nicht hinzu, sofern Sie nicht diese Module entwickeln.
- **Sicherheit** — Token sind an die ausstellende Admin-Identität und eine Scope-Menge gebunden, als
  SHA-256 gespeichert und über `POST /keeper/mcp/tokens/revoke` widerrufbar. Die Route `/keeper-mcp/`
  führt keine Auth-Middleware aus; der Handler erzwingt das Bearer-Token selbst.
- **Referenz-App** — `app-keeper` ist das ausgearbeitete Beispiel, das Keeper in eine App-Hülle
  einbindet; kopieren Sie dessen `src/app/deps/_index.yaml`-Block, wenn Sie ein erprobtes Setup wollen.

## Nächste Schritte

- [Hello World](tutorials/hello-world.md) — das minimale Projektlayout
- [Authentifizierung](tutorials/auth.md) — die Admin-Identität, die Token ausstellt
- [Agenten](framework/agents.md) — die Agenten und Tools, die Keeper-Traits bereitstellen
