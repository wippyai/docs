---
title: "Keeper über MCP"
description: "Wippy Keeper zu einer Anwendung hinzufügen, ein begrenztes Token ausstellen und einen MCP-Client mit seinen Operator-Tools verbinden."
---

# Keeper über MCP

Wippy Keeper stellt eine Benutzeroberfläche für Registry-Operationen, Dateisystem-zu-Registry-Governance, Task- und Agentenorchestrierung, Hub-Installation, Wissensdatenbankverwaltung, Laufzeitinspektion und Git-Workflows bereit. Außerdem stellt Keeper Operatorfunktionen kompatiblen Clients über das Model Context Protocol (MCP) zur Verfügung. Diese Seite fügt Keeper zu einer Anwendung hinzu und konfiguriert eine MCP-Verbindung.

**Klassifizierung: ausführbares Integrationstutorial.** Anwendung und Keeper-Transport laufen lokal. Für den letzten Schritt ist ein MCP-Client erforderlich, der entfernte HTTP-Server und Bearer-Header unterstützt.

## Ergebnis

1. Keeper ist zu einer aus dem Wippy-Anwendungstemplate erstellten Anwendung hinzugefügt.
2. Die Keeper-Oberfläche ist unter `/c/keeper:main` und der MCP-Endpunkt unter `/keeper-mcp/` erreichbar.
3. Ein begrenztes MCP-Token ist ausgestellt und ein MCP-Client für die Steuerung der Anwendung über Keeper konfiguriert.

## Voraussetzungen

- Eine Anwendung aus dem [Wippy-Anwendungstemplate](https://github.com/wippyai/app). Es stellt bereits alle Ressourcen bereit, an die Keeper gebunden wird: `app:gateway`, `app:api`, `app:db`, `app:processes`, `app.security:admin` und `app.env:store`.
- Ein aktives Administratorkonto in dieser Anwendung. Keeper bindet die Token-Ausstellung an die angemeldete Administratoridentität; ein allgemeiner API-Schlüssel kann kein MCP-Token ausstellen.

## Keeper hinzufügen

Deklarieren Sie die Abhängigkeit und binden Sie sie an die Ressourcen der Anwendung. `admin_scope` ist erforderlich und besitzt keinen Standardwert. Die anderen Parameter verwenden standardmäßig die Eintragsnamen des Anwendungstemplates; im Beispiel werden sie ausdrücklich angegeben:

```yaml
# src/app/deps/_index.yaml
- name: keeper
  kind: ns.dependency
  component: keeper/keeper
  version: "*"
  parameters:
    - { name: app_db,         value: app:db }
    - { name: admin_scope,    value: app.security:admin }
    - { name: env_storage,    value: app.env:store }
    - { name: public_gateway, value: app:gateway }   # hosts /keeper-mcp/
    - { name: mcp_route,      value: /keeper-mcp/ }
    - { name: ui_server,      value: app:gateway }
    - { name: process_host,   value: app:processes }
```

Lösen Sie die Quellabhängigkeit und ihren transitiven Graphen auf und starten Sie anschließend die Anwendung:

```bash
wippy update
wippy run -c
```

`wippy update` durchsucht die Quelleinträge, aktualisiert den Lock, löst transitive Abhängigkeiten auf und installiert sie. `wippy add keeper/keeper` allein aktualisiert nur das benannte Lock-Modul; der in der Quelle deklarierte Abhängigkeitsgraph wird dadurch nicht aufgelöst.

Keeper bindet drei Oberflächen ein:

- **UI** — `/c/keeper:main`
- **MCP-Transport** — `/keeper-mcp/` am öffentlichen Gateway
- **Token-API** — auf `app:api` (`/keeper/mcp/tokens`, `/keeper/mcp/scopes`)

Der MCP-Transport wird durch die Umgebungsvariable `MCP_ENABLED` gesteuert (Standardwert `true`). Setzen Sie sie auf `false`, um den Endpunkt zu schließen.

## MCP-Token ausstellen

Tokens werden von einem aktiven Administrator ausgestellt, sind begrenzt und werden genau einmal angezeigt.

1. Melden Sie sich als Administrator bei der Anwendung an.
2. Öffnen Sie `/c/keeper:main`, wählen Sie **MCP** und anschließend **Create Scoped Token**.
3. Geben Sie eine Bezeichnung ein und wählen Sie ein Preset. `observer` ist für die erste Verbindung am sichersten. Verwenden Sie `developer` oder `wippy_operator` nur, wenn der Client Schreiboperationen benötigt.
4. Erstellen Sie das Token und kopieren Sie den angezeigten Wert `wkmcp_...` sofort. Die Oberfläche kann den Rohwert später nicht erneut anzeigen.

Die Oberfläche zeigt außerdem die effektive MCP-URL und kopierbare Clientausschnitte. Dieser Ablauf wird empfohlen, weil er die aktuelle angemeldete Administratorsitzung wiederverwendet.

Für Automatisierung rufen Sie die API mit dem **Bearer der Administratorsitzung** derselben Anwendung auf:

```bash
curl -X POST http://localhost:8080/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "local-observer", "preset": "observer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`<admin-session-token>` ist der Bearer, den der normale Anmeldeablauf der Anwendung ausstellt, nicht das neue Keeper-MCP-Token. Der Endpunkt lehnt nicht authentifizierte, inaktive oder nicht administrative Benutzer ab. `GET /api/v1/keeper/mcp/scopes` gibt vor der Ausstellung den aktuellen Preset- und Geltungsbereichskatalog zurück.

`preset` bündelt mehrere Geltungsbereiche. Verfügbare Presets: `root`, `developer`, `wippy_operator`, `observer`, `knowledge_manager`, `explorer_tools_only`. Für eine feinere Steuerung übergeben Sie stattdessen ein ausdrückliches Array `scopes` (zum Beispiel `registry.read`, `state.write`, `git.pr`, `tasks.run`, `knowledge.read`). Das rohe Token `wkmcp_...` wird einmal zurückgegeben und nur als Hash gespeichert — kopieren Sie es sofort.

## Client verbinden

Richten Sie einen MCP-Client mit dem Token als Bearer-Header auf den Endpunkt. Exportieren Sie das Token zunächst, damit es nicht in eingecheckter Konfiguration landet:

```bash
export KEEPER_MCP_TOKEN='wkmcp_<token>'
```

Verwenden Sie für Claude Code eine projektbezogene `.mcp.json`:

```json
{
  "mcpServers": {
    "keeper": {
      "type": "http",
      "url": "http://localhost:8080/keeper-mcp/",
      "headers": { "Authorization": "Bearer ${KEEPER_MCP_TOKEN}" }
    }
  }
}
```

Claude Code erweitert `${KEEPER_MCP_TOKEN}` beim Laden der Projektkonfiguration aus der Umgebung. Starten oder verbinden Sie den MCP-Server nach einer Änderung der Umgebungsvariable neu.

Verwenden Sie für Codex die benutzerweite `~/.codex/config.toml` oder in einem vertrauenswürdigen Projekt eine projektbezogene `.codex/config.toml`:

```toml
[mcp_servers.keeper]
url = "http://localhost:8080/keeper-mcp/"
bearer_token_env_var = "KEEPER_MCP_TOKEN"
```

Ersetzen Sie in einer bereitgestellten Umgebung `http://localhost:8080` durch die öffentliche Basis-URL der Anwendung.

Verbinden Sie sich mit dem konfigurierten Client und prüfen Sie, ob er den MCP-Lifecycle abschließt:

1. Der Client sendet `initialize` und empfängt die Serverfähigkeiten.
2. Er sendet `notifications/initialized`.
3. Er fordert `tools/list` an; ein `observer`-Token sollte die von diesem Preset erlaubten Discovery- und Sitzungstools anzeigen.
4. Rufen Sie `session_info` auf und bestätigen Sie, dass die zurückgegebenen Geltungsbereiche dem Token entsprechen.

Ein benutzerdefinierter Streamable-HTTP-Client muss bei diesen Anfragen `Accept: application/json, text/event-stream` senden und eine während der Initialisierung zurückgegebene Sitzungs-ID beibehalten. `tools/list` als erste Anfrage zu senden, ist keine gültige MCP-Lifecycle-Prüfung. Ein fehlender oder ungültiger Bearer wird abgewiesen, bevor Keeper den begrenzten Toolkatalog bereitstellt.

## Funktionsweise der MCP-Oberfläche

Keeper stellt eine kleine Menge von **Meta-Tools** bereit und aktiviert mit **Traits** bei Bedarf fähigkeitsspezifische Tools:

- `session_info` — immer verfügbar; meldet die Geltungsbereiche und aktiven Traits der Sitzung.
- `list_traits` / `describe_trait` — zeigen die verfügbaren Traits.
- `use_trait` / `drop_trait` (sowie `set_traits`) — aktivieren oder entfernen einen Trait. Dabei wird eine MCP-Benachrichtigung `notifications/tools/list_changed` ausgegeben, sodass sich die sichtbaren Tools sofort ändern.
- `list_tools` / `call_tool` — listen die von einem Trait materialisierten Tools auf und rufen sie auf.

Welche Fähigkeiten ein Token aktivieren kann, wird durch seine **Geltungsbereiche** begrenzt — grob `registry.*`, `state.*`, `hub.*`, `knowledge.*`, `git.*`, `components.*`, `tasks.*`, `agents.*`, `tests.run`, `logger.*`, `env.*`, `functions.call`, `app.ui` sowie `mcp.root` für eine vollständige Administratorumgehung. Der `access_mode` des Tokens (`any` / `traits` / `tools_only`) begrenzt zusätzlich, wie Tools aufgerufen werden dürfen.

## Betriebs- und Sicherheitshinweise

- **Governance-Geltungsbereich** — Setzen Sie `GOV_MANAGED_NAMESPACES=app`, damit Keepers Synchronisierung zwischen Dateisystem und Registry nur den Namespace Ihrer Anwendung verwaltet. Fügen Sie `keeper`, `wippy` oder `userspace` nur hinzu, wenn Sie diese Module entwickeln.
- **Sicherheit** — Tokens sind an die ausstellende Administratoridentität und eine Menge von Geltungsbereichen gebunden, werden als SHA-256 gespeichert und können auf der Keeper-MCP-Seite widerrufen werden. Die Widerrufs-API akzeptiert in `POST /api/v1/keeper/mcp/tokens/revoke` die von der Tokenlisten-API zurückgegebene Hash-ID, nicht den einmal angezeigten rohen Bearer. Für die Route `/keeper-mcp/` läuft keine Auth-Middleware; der Handler erzwingt das Bearer-Token.
- **Referenzanwendung** — Das Wippy-Anwendungstemplate ist das ausgearbeitete Beispiel, das Keeper in eine Anwendungsshell einbindet. Seine Datei `src/app/deps/_index.yaml` enthält eine bekanntermaßen funktionierende Bindung.

## Nächste Schritte

- [Hello World](./hello-world.md) — Minimales Projektlayout
- [Authentifizierung](./auth.md) — Administratoridentität und Tokenkonzepte
- [Agenten](../framework/agents.md) — Von Keeper-Traits bereitgestellte Agenten und Tools
