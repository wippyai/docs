---
title: "Proxy & Isolation"
description: "Der Web Host betreibt jedes Kind-Micro-Frontend in einem Sandbox-Kontext und verbindet es über die Proxy-API mit dem Host. Micro-Frontend-Apps und Web…"
---

# Proxy & Isolation

Der Web Host betreibt jedes Kind-Micro-Frontend in einem Sandbox-Kontext und verbindet es über die **Proxy-API** mit dem Host. Micro-Frontend-Apps und Web Components erreichen den Host beide über Importe aus **`@wippy-fe/proxy`**.

![Injektion und Verschachtelung der Proxy-API](../diagrams/proxy-layers.svg)

## Die Proxy-API

Die Proxy-API ist Ihr Einstiegspunkt zum Host. Eine Laufzeit — `proxy.js` — liefert sie aus: Sie legt die API und die aktuelle `AppConfig` auf die Seite und stellt sie über das Modul **`@wippy-fe/proxy`** bereit.

- Bei einer **Micro-Frontend-App** (`view.page`) injiziert der Host `proxy.js` in das `srcdoc` der Seite.
- Bei einer **Web Component** (`view.component`) ist die Laufzeit bereits in der Host-Seite vorhanden — die Komponente mountet in das Host-DOM, nicht in ein separates iframe.

Ihr Code konsumiert sie über die von `@wippy-fe/proxy` exportierten synchronen Getter:

```ts
import { host, api, on, config } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const data = await api.get('/api/v1/agents')   // api ist eine axios-Instanz; das await gilt dem HTTP-Aufruf
on('@visibility', (visible) => { /* Arbeit pausieren oder fortsetzen */ })
```

Portables Vue-Routing ist die Ausnahme: `@wippy-fe/router` konsumiert `@history` und meldet lokale Navigation für Sie. Fügen Sie darum herum keine manuellen Routing-Abonnements hinzu.

Diese Getter sind **synchron**: `host`, `api`, `on`, `config` und der Rest stehen in dem Moment bereit, in dem Ihr Code läuft — die Konfiguration liegt vor, bevor die Laufzeit initialisiert (siehe unten), es gibt also keinen Handshake, auf den zu warten wäre. Markieren Sie `@wippy-fe/proxy` in Ihrem Vite-Build als `external` — der Host stellt es über die Import-Map bereit. Die vollständige Oberfläche beschreibt [Proxy-API](../micro-frontends/proxy-api.md).

## Wie die Konfiguration ein App-iframe erreicht

Wenn der Host eine `view.page` lädt, baut er ein `srcdoc` und injiziert **in dieser Reihenfolge, vor dem Skript Ihrer App**:

```html
<!-- 1. Die Kind-AppConfig — synchron gesetzt, bevor die Laufzeit lädt -->
<script>window.__WIPPY_APP_CONFIG__ = { /* auth, env, theming, hostConfig, context */ }</script>
<!-- 2. Die CSS-Injektions-Flags für diese Seite -->
<script>window.__WIPPY_PROXY_CONFIG__ = { injections: { css: { themeConfig: true, primevue: true /* … */ } } }</script>
<!-- 3. Die Laufzeit (davor loading.js) -->
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

Weil das Konfigurations-Global gesetzt wird, **bevor** `proxy.js` läuft, initialisiert die Laufzeit synchron, und die `@wippy-fe/proxy`-Getter funktionieren sofort — ohne Handshake. Seiten referenzieren diese Skripte nicht direkt; der Platzhalter `<script data-role="@wippy/scripts">` wird vom Host durch die korrekt geordneten Tags ersetzt. Overrides pro Seite treffen als `window.__WIPPY_CONFIG_OVERRIDES__` ein (siehe [Proxy-API — Konfigurations-Overrides](../micro-frontends/proxy-api.md#config-overrides)).

Eine Web Component sieht dieselben Globals, weil sie in der Host-Seite läuft, wo die Laufzeit sie bereits gesetzt hat, bevor der `connectedCallback` der Komponente ausgelöst wird.

## Wie sich Apps und Web Components unterscheiden

Beide importieren dieselbe API aus `@wippy-fe/proxy`. Sie unterscheiden sich im Ausführungskontext und darin, wie Styles ausgeliefert werden:

| | Micro-Frontend-App (`view.page`) | Web Component (`view.component`) |
|---|---|---|
| Läuft in | ihrem eigenen `srcdoc`-iframe | dem DOM der Host-Seite (Shadow DOM) |
| Auslieferung der Laufzeit | `proxy.js`, in das iframe injiziert | Laufzeit bereits in der Host-Seite vorhanden |
| CSS | vollständige Injektions-Pipeline (`themeConfig`, `primevue`, …) — siehe [CSS-Injektion](./css-injection.md) | `hostCssKeys` in das Shadow DOM — siehe [Theming: Web Components](../micro-frontends/web-component-theming.md) |

## Komposition & Verschachtelung

Kinder lassen sich komponieren. Eine Micro-Frontend-App oder eine Web Component kann selbst Kinder hosten — wiederum Micro-Frontend-Apps oder Web Components —, die ihrerseits eigene hosten können, in beliebiger Tiefe. Jede Ebene verwendet dieselbe `@wippy-fe/proxy`-API.

Wie ein Knoten ein Kind hostet, hängt von dessen Art ab:

- **Ein iframe-Kind** — eine Micro-Frontend-App, ein Artefakt oder beliebiges Wippy-HTML — läuft über `<w-iframe>`, `<w-artifact>` oder `html.inject`. Diese injizieren die Laufzeit (Basis-URL, Import-Map, `loading.js`, `proxy.js` und Konfiguration) in das `srcdoc` des Kindes, sodass es die Proxy-API genau wie eine App auf oberster Ebene erhält. Sein Proxy überbrückt über den Parent hinauf zum Host.
- **Ein Web-Component-Kind** braucht nichts davon. Rendern Sie sein Tag — oder laden Sie es mit `loadWebComponent` / `loadByTagName` — und es läuft im selben DOM und importiert die Proxy-API direkt.

Der Code des Kindes ist identisch, ob es auf oberster Ebene oder mehrere Ebenen tief verschachtelt läuft: aus `@wippy-fe/proxy` importieren und verwenden. Es gibt keine besonderen Verschachtelungsregeln.

Die Mechanik beschreiben [`<w-iframe>`](#w-iframe-custom-element), [`<w-artifact>`](#w-artifact-custom-element) und [Fortgeschrittene HTML-Injektion](#advanced-html-injection) weiter unten.

## Interna — nicht lesen oder überschreiben

`proxy.js` installiert die folgenden Globals für den Eigenbedarf. **Anwendungs- und Komponentencode sollte sie niemals lesen oder zuweisen** — verwenden Sie stattdessen `@wippy-fe/proxy`. Sie sind nur dokumentiert, damit Sie sie nicht versehentlich überschreiben:

| Global | Was es ist |
|---|---|
| `window.$W` | Asynchrones Zugriffsobjekt (`$W.host()`, `$W.api()`, …). Intern; `@wippy-fe/proxy` ist die unterstützte Oberfläche. |
| `window.getWippyApi` / `window.initWippyApi` | Asynchrone Funktionen zum "Auflösen der Instanz". Intern (`initWippyApi` ist veraltet). |
| `window.__WIPPY_APP_API__` | Die aufgelöste Proxy-Instanz. |
| `window.__WIPPY_APP_CONFIG__` | Der Snapshot der Kind-`AppConfig`. |
| `window.__WIPPY_PROXY_CONFIG__` / `window.__WIPPY_CONFIG_OVERRIDES__` | CSS-Injektions-Flags und Overrides pro Seite. |
| `window.__WIPPY_WEB_COMPONENT_CACHE__` | Cache geladener Komponenten. |

Zwei Einstiegspunkte bilden die öffentliche JavaScript-API: `initWippyApp(config, rootContainer?)` mountet den gesamten Web Host (der Modul-Embed-Einstieg, den die Facade verwendet; siehe [Facade-Einstiegspunkt](./entry-point.md)), und **`@wippy-fe/proxy`** ist die synchrone API für Kind-Apps und -Komponenten. Alles in der obigen Tabelle ist intern.

## PostMessage-Protokoll (`IFrameMessageType`) — interner Transport

Das ist das Drahtprotokoll, das die Laufzeit intern verwendet; **Anwendungscode sendet oder empfängt diese Nachrichten nie** — `@wippy-fe/proxy` erledigt das für Sie.

Der Standardweg mit Host-Injektion braucht zum Start keinen Handshake — die Konfiguration liegt bereits synchron als `window.__WIPPY_APP_CONFIG__` vor, bevor `proxy.js` läuft, sodass die Laufzeit ihre Instanz sofort baut. Der `get-config`/`set-config`-Austausch findet auf diesem Weg trotzdem statt, aber nur als **nicht blockierender Kanal für Re-Sync und Live-Updates**: Nachdem die synchrone Instanz gebaut ist, sendet die iframe-Laufzeit immer `get-config`, der Host antwortet mit `set-config` und pusht `set-config` bei jeder späteren Konfigurationsänderung erneut. Verschachtelte `<w-iframe>`-Kinder verhalten sich genauso. Ihr Code wartet auf nichts davon — die synchronen Getter sind bereits aktiv.

Der Handshake ist **die alleinige, blockierende Konfigurationsquelle** in genau einem Szenario: der manuellen, facadelosen iframe-Einbettung (`iframe.html?waitForCustomConfig`), bei der es kein vorinjiziertes `window.__WIPPY_APP_CONFIG__` gibt, sodass die Initialisierung auf das erste `set-config` blockiert und der Parent die `get-config`-Anfrage beantworten muss (siehe [Facade-Einstiegspunkt § Manuelle iframe-Einbettung](./entry-point.md#manual-facade-less-iframe-embedding)).

Jede Nachricht ist ein JSON-Umschlag der Form `{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }`. Das Feld `type` ist über `APP_CONFIG_IFRAME_EVENT_TYPE` konfigurierbar, ist aber standardmäßig `'@gen2-chat'`.

Alle Nachrichtentypen sind im Enum `IFrameMessageType` definiert:

| Enum-Mitglied | Drahtwert | Richtung | Beschreibung |
|-------------|------------|-----------|-------------|
| `GetConfig` | `get-config` | Kind → Host | Anfänglicher Handshake: Kind fordert seine `AppConfig` an |
| `SetConfig` | `set-config` | Host → Kind | Host liefert die `AppConfig` als Antwort auf `GetConfig` |
| `UrlWasUpdatedInParent` | `url-was-updated-in-parent` | Host → Kind | Host-URL geändert; löst das `@history`-Event des Kindes aus |
| `VisibilityWasUpdatedInParent` | `visibility-was-updated-in-parent` | Host → Kind | iframe-Sichtbarkeit geändert; löst das `@visibility`-Event des Kindes aus |
| `TopicWasReceivedInParent` | `topic-was-received-in-parent` | Host → Kind | Liefert ein WebSocket-Topic-Event an abonnierte Kinder |
| `CmdRouteChanged` | `cmd-route-changed` | Kind → Host | Interne Route des Kindes geändert; Host aktualisiert die Browser-URL |
| `CmdTitleChanged` | `cmd-title-changed` | Kind → Host | `document.title` des Kindes geändert; Host aktualisiert den Seitentitel |
| `CmdStartChat` | `cmd-start-chat` | Kind → Host | Eine neue Chat-Sitzung öffnen |
| `CmdOpenSession` | `cmd-open-session` | Kind → Host | Zu einer bestehenden Chat-Sitzung navigieren |
| `CmdOpenArtifact` | `cmd-open-artifact` | Kind → Host | Ein Artefakt in Sidebar oder Modal öffnen |
| `CmdNavigate` | `cmd-navigate` | Kind → Host | Anfrage zur SPA-Navigation |
| `CmdShowToast` | `cmd-show-toast` | Kind → Host | Eine Toast-Benachrichtigung anzeigen |
| `CmdShowConfirm` | `cmd-show-confirm` | Kind → Host | Einen Bestätigungsdialog anzeigen |
| `OnConfirmResult` | `on-confirm-result` | Host → Kind | Liefert das Ergebnis des Bestätigungsdialogs |
| `CmdSetContext` | `cmd-set-context` | Kind → Host | Kontext an eine Chat-Sitzung senden |
| `CmdHandleError` | `cmd-handle-error` | Kind → Host | Einen Fehler an den Host melden |
| `CmdLogout` | `cmd-logout` | Kind → Host | Abmeldung auslösen |
| `CmdSubscribe` | `cmd-subscribe` | Kind → Host | Ein WebSocket-Topic abonnieren |
| `CmdUnSubscribe` | `cmd-unsubscribe` | Kind → Host | Ein Topic abbestellen |
| `OnSubscription` | `on-subscription` | Host → Kind | Daten eines Abonnement-Events liefern |
| `CmdStateGet` | `cmd-state-get` | Kind → Host | Einen persistierten State-Schlüssel lesen |
| `CmdStateSet` | `cmd-state-set` | Kind → Host | Einen persistierten State-Schlüssel schreiben |
| `CmdStateRemove` | `cmd-state-remove` | Kind → Host | Einen persistierten State-Schlüssel löschen |
| `CmdStateClear` | `cmd-state-clear` | Kind → Host | Den gesamten State dieser Seite leeren |
| `CmdStateGetAll` | `cmd-state-get-all` | Kind → Host | Den gesamten persistierten State lesen |
| `OnStateResult` | `on-state-result` | Host → Kind | Liefert das Ergebnis eines State-Lesevorgangs |
| `OnStateError` | `on-state-error` | Host → Kind | Meldet den Fehlschlag einer State-Operation |
| `CmdWsSend` | `cmd-ws-send` | Kind → Host | Ein WebSocket-Kommando über die Host-Verbindung weiterleiten |
| `CmdBodySize` | `cmd-body-size` | Kind → Host | Body-Größe für `auto-height` melden |
| `CmdBridgePost` | `cmd-bridge-post` | Kind ↔ Parent | Fire-and-forget-Kanalnachricht über `host.bridge` |
| `CmdBridgeRequest` | `cmd-bridge-request` | Kind ↔ Parent | Request/Response-Kanalnachricht über `host.bridge` |
| `CmdClaimNavOwner` | `cmd-claim-nav-owner` | Kind → Host | Navigationshoheit beanspruchen (nav-owner-Modus) |
| `CmdReleaseNavOwner` | `cmd-release-nav-owner` | Kind → Host | Navigationshoheit freigeben |
| `CmdLayoutSubscribe` | `cmd-layout-subscribe` | Kind → Host | Aktualisierungen des verwalteten Layouts abonnieren |
| `CmdLayoutUpdatePanel` | `cmd-layout-update-panel` | Kind → Host | Eine Panel-Definition patchen |
| `CmdLayoutBroadcast` | `cmd-layout-broadcast` | Kind ↔ Host | Nachricht auf dem Layout-Bus innerhalb des Tabs |
| `OnLayoutChange` | `on-layout-change` | Host → Kind | Vollständige Aktualisierung des Layout-Snapshots |
| `OnLayoutPanelChanged` | `on-layout-panel-changed` | Host → Kind | Live-Zustandsdelta pro Panel |
| `OnLayoutBroadcast` | `on-layout-broadcast` | Host → Kind | Zustellung eines Layout-Bus-Broadcasts |

Anwendungscode sendet oder empfängt diese Nachrichten nie direkt. Der Proxy behandelt das Protokoll transparent und stellt nur die API-Oberfläche von `@wippy-fe/proxy` bereit.

## Custom Element `<w-iframe>`

`<w-iframe>` ist das Low-Level-iframe-Primitiv, das in `proxy.js` eingebaut ist. Es nimmt rohes Quell-HTML entgegen, injiziert die vollständige Wippy-Laufzeit (Basis-URL, Import-Map, `loading.js`, `proxy.js`, Kind-Konfiguration) und rendert das Ergebnis als Sandbox-`srcdoc`-iframe.

Verwenden Sie `<w-iframe>`, wenn Sie Quell-HTML haben und dasselbe Laufzeitverhalten möchten, das Wippy-Micro-Frontend-Apps automatisch erhalten: authentifizierte API, State-Relais, WebSocket-Relais, nav-owner-Routing und Parent-Kind-Brückennachrichten.

### Attribute und Properties

| Attribut / Property | Erforderlich | Standard | Beschreibung |
|----------------------|----------|---------|-------------|
| `src` | Nein | — | URL, die als rohes Quell-HTML über das Proxy-`api` geholt wird. |
| `srcdoc` | Nein | — | Rohes Quell-HTML. Für große Strings auch als `element.srcdoc = html` setzbar. |
| `base-url` | Nein | Aus `src` oder `document.baseURI` abgeleitet | Injiziertes `<base href>` zur Auflösung relativer Assets. |
| `resource-id` | Nein | Element-`id`, dann `src` | Bezeichner des Kindkontexts; setzt den Standard-Scope für State und Logs. |
| `resource-type` | Nein | `page` | Typ des Kindkontexts: `page` oder `artifact`. |
| `sub-path` | Nein | Parent-Route | Anfängliche Kind-Route. Wird im `GetConfig`-Handshake als `config.context.route` weitergereicht. |
| `auto-height` | Nein | `false` | Passt die iframe-Höhe an die `CmdBodySize`-Meldungen des Kindes an. |
| `nav-owner` | Nein | `false` | Fängt `CmdRouteChanged` des Kindes ab und löst `nav-owner-route`-DOM-Events aus, statt die Host-URL zu ändern. |

Am Element akzeptierte JS-Properties:

```typescript
const frame = document.querySelector('w-iframe')
frame.proxyConfig = { injections: { css: { markdown: false } } }
frame.configOverrides = { customization: { customCSS: ':root { --brand: red }' } }
frame.srcdoc = sourceHtml
```

### Events und Methoden

| Event | Detail | Beschreibung |
|-------|--------|-------------|
| `loading` | — | Wird ausgelöst, bevor Fetch/Verarbeitung/Rendern beginnt. |
| `load` | — | Wird ausgelöst, nachdem das Sandbox-iframe geladen hat. |
| `error` | Ursprünglicher Fehler | Wird ausgelöst, wenn Fetch, Injektion oder Laden fehlschlägt. |
| `nav-owner-route` | `{ path: string, navId?: number }` | Routenwechsel des Kindes, wenn `nav-owner` gesetzt ist. Das Event bubbelt und ist `composed`. |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | Brückennachricht vom Kind. |

| Methode | Beschreibung |
|--------|-------------|
| `post(channel, payload?)` | Fire-and-forget-Brückennachricht an das Kind. |
| `request<T>(channel, payload?, { timeoutMs }?)` | Request/Response-Brückennachricht; löst mit dem Rückgabewert des Handlers auf. |

Shadow Parts: `loader`, `error`, `frame`.

Ist `nav-owner` gesetzt, wird der voreingestellte Routensynchronisations-Rundlauf vollständig unterdrückt: Der Host aktualisiert seine eigene URL-Leiste **nicht** und sendet **kein** `UrlWasUpdatedInParent` zurück an das Kind. Die Navigationshoheit wird vollständig an den Parent-Code delegiert, der auf `nav-owner-route` lauscht. Der `path` im Event-Detail ist die **rohe interne Route** des Kindes, genau so, wie das Kind sie an `host.onRouteChanged(internalRoute, navId?)` übergeben hat — sie trägt **kein** Mount-Präfix (anders als beim Standardpfad `CmdRouteChanged`, bei dem der Host das Mount-Präfix der Seite voranstellt). Der einbettende Parent ist für jedes Präfix und jede Router-Zuordnung verantwortlich:

```typescript
const frame = document.querySelector('w-iframe')
frame.addEventListener('nav-owner-route', (event) => {
  const { path, navId } = event.detail
  myRouter.push(path)
})
```

### Parent-Kind-Brücke

Die Brücke verwendet benannte Kanäle, sodass keine Seite rohe `postMessage`-Umschläge braucht.

Parent-Seite:
```typescript
const frame = document.querySelector('w-iframe')

frame.addEventListener('wippy-message', async (event) => {
  const { channel, payload, respond, reject } = event.detail

  if (channel === 'pick-file') {
    try {
      respond({ id: 'file-1', name: 'data.csv' })
    } catch (error) {
      reject(error)
    }
  }
})

frame.post('refresh', { reason: 'parent-click' })
const result = await frame.request('get-selection', undefined, { timeoutMs: 5000 })
```

Kind-Seite:
```typescript
import { host } from '@wippy-fe/proxy'

host.bridge.post('ready', { value: 1 })
const file = await host.bridge.request('pick-file', { accept: '.csv' })

const off = host.bridge.on('refresh', async (payload) => {
  console.log('refresh requested', payload)
  return { ok: true }
})
```

`host.bridge.on()` liefert eine Abmeldefunktion (`() => void`). **Ein Kanal = ein aktiver Handler.** Sind für denselben Kanal mehrere Handler registriert, gewinnt der zuletzt registrierte und behandelt **alle** eingehenden Nachrichten auf diesem Kanal — sowohl Fire-and-forget-`post()` als auch `request()`. `on()` ist nicht additiv: Frühere Handler werden verdeckt (nicht entfernt) und laufen nicht, solange ein neuerer Handler existiert; der Proxy gibt bei doppelter Registrierung ein `console.warn` aus. Meldet sich der neueste Handler ab, wird der vorherige Handler für diesen Kanal wieder aktiv. Verwenden Sie unterschiedliche Kanalnamen, wenn Sie mehrere unabhängige Listener benötigen.

Lassen Sie `options.timeoutMs` weg, verwenden `host.bridge.request()` (und das parent-seitige `frame.request()`) standardmäßig eine Frist von 10 Sekunden (`10000` ms). Bei Zeitüberschreitung wird das zurückgegebene Promise mit einem `Error` abgelehnt, dessen Nachricht `Bridge request <id> timed out after <ms>ms` lautet. Eine Anfrage an einen Kanal, für den die Gegenseite keinen Handler hat, wird sofort mit `No handler registered for channel "<channel>"` abgelehnt, statt die Frist auszusitzen.

## Custom Element `<w-artifact>`

`<w-artifact>` löst Metadaten und Inhalt eines Artefakts oder einer Seite auf und delegiert iframe-gestützte Typen intern an `<w-iframe>`. Es übernimmt die Erkennung des Inhaltstyps (HTML, Markdown, Webseiten-Pakete, ESM-Pakete, Komponenten mit direktem Tag) und bietet eine abstraktere API als das rohe `<w-iframe>`.

### Attribute

| Attribut | Erforderlich | Werte | Standard | Beschreibung |
|-----------|----------|--------|---------|-------------|
| `id` | Ja | Artefakt- / Seiten-UUID | — | Bezeichner des Inhalts. |
| `type` | Nein | `artifact` \| `page` | `artifact` | Bestimmt den aufgerufenen REST-Endpunkt: `/api/v1/artifact/<id>/content` oder `/api/public/pages/content/<id>`. |
| `auto-height` | Nein | Boolean-Flag | `false` | Wird an das innere `<w-iframe>` für die Höhensynchronisation per `CmdBodySize` weitergereicht. |
| `url` | Nein | Beliebige URL | — | Holt den Inhalt direkt von dieser URL; ignoriert `id`/`type`. |
| `sub-path` | Nein | Pfad-String | — | Wird an das innere `<w-iframe>` als anfängliche Kind-Route weitergereicht. |
| `nav-owner` | Nein | Boolean-Flag | `false` | Wird an das innere `<w-iframe>` weitergereicht; Routenwechsel des Kindes lösen `nav-owner-route` aus. |

### Events

| Event | Wann | Detail |
|-------|------|--------|
| `loading` | Bevor der Fetch beginnt | — |
| `load` | Nachdem das iframe geladen hat | — |
| `error` | Fetch oder Rendern schlägt fehl | Ursprünglicher Fehler |
| `nav-owner-route` | Routenwechsel eines nav-owner-Kindes | `{ path: string, navId?: number }` |
| `wippy-message` | Brückennachricht aus dem verschachtelten iframe | `{ channel, payload, requestId?, respond?, reject? }` |

### CSS-Status und Parts

Das Element setzt ein `status`-Attribut (`loading`, `ready`, `error`) und stellt Shadow Parts bereit:

```css
w-artifact[status="loading"] { opacity: 0.5; }
w-artifact[status="error"]   { border: 1px solid var(--p-danger-color); }

w-artifact::part(loader) { font-size: 1rem; }
w-artifact::part(frame)  { border: 0; }
```

## `<w-iframe>` vs. `<w-artifact>` vs. rohes `<iframe>`

| Merkmal | `<w-iframe>` | `<w-artifact>` | Rohes `<iframe>` |
|---------|-------------|----------------|----------------|
| Injiziert die Wippy-Laufzeit | Ja | Ja (über `<w-iframe>`) | Nein |
| Löst Artefakt-/Seiten-Metadaten auf | Nein | Ja | Nein |
| Authentifizierter Inhalts-Fetch | Ja (rohes HTML) | Ja (vollständiger Resolver) | Nein |
| State-Relais | Ja | Ja | Nein |
| WebSocket-Relais | Ja | Ja | Nein |
| Parent-Kind-Brücke | Ja | Ja (weitergereicht) | Nein |
| Unterstützung für nav-owner | Ja | Ja | Nein |
| Erkennung des Inhaltstyps | Nein | Ja | Nein |
| CSS-Shadow-Parts | `loader`, `error`, `frame` | `loader`, `error`, `frame` | — |
| `status`-Attribut | Ja | Ja | Nein |

Verwenden Sie `<w-artifact>`, wenn Sie eine Wippy-Artefakt-UUID oder eine Seiten-ID haben und die Plattform die gesamte Auflösung übernehmen soll. Verwenden Sie `<w-iframe>`, wenn Sie bereits Quell-HTML haben und die Laufzeit direkt injizieren möchten. Verwenden Sie ein rohes `<iframe>` nur für vollständig externe Inhalte, die die Wippy-API nicht benötigen.

## Fortgeschrittene HTML-Injektion

Für Fälle, in denen Sie die Transformation von Quell-HTML zu srcdoc ohne das Mounten eines Elements brauchen, stellt der Proxy `html.inject(...)` bereit:

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

Dieselbe Funktion ist als `instance.html.inject`, `$W.html` und `import { html } from '@wippy-fe/proxy'` erreichbar. Bevorzugen Sie beim normalen Mounten `<w-iframe>`; verwenden Sie `html.inject(...)` nur, wenn Sie eigene Hosting-Infrastruktur bauen.
