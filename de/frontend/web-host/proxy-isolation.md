---
title: "Proxy und Isolation"
description: "Wie Seitenanwendungen und Web Components Konfiguration erhalten und über die Proxy-API mit dem Web Host kommunizieren."
---

# Proxy und Isolation

Diese Seite ist eine API- und interne Transportreferenz. Die Ausschnitte setzen
eine vorhandene gehostete Seite oder Komponente voraus und sind Teilintegrationen,
keine vollständige Anwendung.

Der Web Host verbindet Seitenanwendungen und Web Components über die
**Proxy-API** mit Hostdiensten. Eine paketierte Seite läuft abhängig von
`hostConfig.renderEngine` in einem sandboxed `srcdoc`-iframe oder einem
Web-Fragment-Realm. Eine Web Component läuft im DOM der Hostseite. Alle drei
Kontexte importieren die API aus **`@wippy-fe/proxy`**.

![Injektion und Verschachtelung der Proxy-API](../diagrams/proxy-layers.svg)

## Die Proxy-API

Die Proxy-API ist der Einstiegspunkt zum Host. Eine enginespezifische Runtime
legt API und aktuelle Kindkonfiguration in den Seitenkontext und macht sie über
**`@wippy-fe/proxy`** verfügbar.

- Bei einer `view.page` mit **iframe-Engine** injiziert der Host `proxy.js` in das `srcdoc` der Seite.
- Bei einer `view.page` mit **Web-Fragment-Engine** lädt das Fragment-Gateway `proxy-fragment.js` im reframed Realm.
- Bei einer **Web Component** (`view.component`) ist die Runtime bereits in der Hostseite vorhanden; die Komponente wird im Host-DOM und nicht in einem eigenen iframe gemountet.

Der Anwendungscode verwendet die synchronen Getter aus `@wippy-fe/proxy`:

```ts
import { host, api, on, config } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const data = await api.get('/api/v1/agents')   // api is an axios instance; the await is the HTTP call
on('@visibility', (visible) => { /* pause or resume work */ })
```

Portables Vue-Routing ist die Ausnahme: `@wippy-fe/router` verarbeitet
`@history` und meldet lokale Navigation selbst. Ergänzen Sie darum keine
manuellen Routing-Abonnements.

Sobald Anwendungscode läuft, sind diese Getter **synchron**: `host`, `api`,
`on`, `config` und die übrigen benötigen keinen anwendungsverwalteten Handshake.
Die iframe-Engine startet mit vorab injizierter Konfiguration; die Fragment-
Runtime löst ihre Konfiguration beim Host auf, bevor sie die API erzeugt.
Markieren Sie `@wippy-fe/proxy` im Vite-Build als `external`; der Host stellt es
über die Import Map bereit. Die vollständige Oberfläche steht unter
[Proxy-API](../micro-frontends/proxy-api.md).

## Wie die Konfiguration eine Seitenanwendung erreicht

### iframe-Engine

Beim Laden einer `view.page` erzeugt der Host ein `srcdoc` und injiziert **in
dieser Reihenfolge und vor dem Anwendungsskript**:

```html
<!-- 1. The child AppConfig — set synchronously, before the runtime loads -->
<script>window.__WIPPY_APP_CONFIG__ = { /* auth, env, theming, context */ }</script>
<!-- 2. The CSS-injection flags for this page -->
<script>window.__WIPPY_PROXY_CONFIG__ = { injections: { css: { themeConfig: true, primevue: true /* … */ } } }</script>
<!-- 3. The runtime (preceded by loading.js) -->
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

Weil das Konfigurationsglobal vor `proxy.js` gesetzt wird, initialisiert sich
die Runtime synchron und die Getter funktionieren sofort. Seiten referenzieren
diese Skripte nicht direkt: Der Platzhalter `<script data-role="@wippy/scripts">`
wird vom Host durch die korrekt geordneten Tags ersetzt. Seitenspezifische
Überschreibungen kommen als `window.__WIPPY_CONFIG_OVERRIDES__`; siehe
[Proxy-API — Konfigurationsüberschreibungen](../micro-frontends/proxy-api.md#config-overrides).

### Web-Fragment-Engine

Das Fragment-Gateway liefert einen reframed Realm-Stub mit Web-Host-Import-Map,
`loading.js` und `proxy-fragment.js`. Da der Server das clientseitige Auth-Token
nicht injizieren kann, holt die Fragment-Runtime die Kindkonfiguration über den
`GetConfig`/`SetConfig`-Handshake ihres Same-Origin-Kanals zum Host. Danach
erzeugt sie dieselbe authentifizierte API und dieselben Konfigurationsglobals,
die `@wippy-fe/proxy` verwendet.

Eine Web Component sieht die vorhandene API und die Konfigurationsglobals der
Hostseite, weil sie in dieser Seite und nicht in einem separaten Realm läuft.

## Unterschiede zwischen Apps und Web Components

Alle importieren dieselbe API aus `@wippy-fe/proxy`; Ausführungskontext und
Stilbereitstellung unterscheiden sich:

| | Seite: iframe-Engine | Seite: Web-Fragment-Engine | Web Component |
|---|---|---|---|
| Läuft in | sandboxed `srcdoc`-iframe | reframed Same-Origin-Realm, in einen Shadow Root gespiegelt | Hostseiten-DOM (Shadow DOM) |
| Runtime | `proxy.js` im `srcdoc` | Fragment-Gateway lädt `proxy-fragment.js` | bereits in der Hostseite vorhanden |
| Konfiguration | synchrones Global, danach nicht blockierende Handshake-Aktualisierungen | blockierender, von der Fragment-Runtime verwalteter Host-Handshake | Hostseiten-Globals |
| CSS | Client-Injektionspipeline; siehe [CSS-Injektion](./css-injection.md) | Gateway- und Fragment-Realm-Injektion; siehe [CSS-Injektion](./css-injection.md) | `hostCssKeys` im Shadow DOM; siehe [Theming: Web Components](../micro-frontends/web-component-theming.md) |

## Komposition und Verschachtelung

Kinder lassen sich beliebig tief zusammensetzen. Eine Micro-Frontend-App oder
Web Component kann wiederum Apps oder Web Components hosten. Jede Ebene nutzt
dieselbe API `@wippy-fe/proxy`.

- **Seiten- oder HTML-Kinder** laufen über `<w-iframe>`, `<w-artifact>` oder
  `html.inject`. Im iframe-Modus erzeugen sie ein `srcdoc` mit Base-URL, Import
  Map, Runtime und Konfiguration. Im Fragmentmodus wird eine verschachtelte,
  registrierte `view.page` als Web Fragment gerendert; Inline-HTML und andere
  Nicht-Seiten-Inhalte bleiben `srcdoc`. Der Proxy überbrückt in beiden Fällen
  über das Elternobjekt zum Host.
- **Web-Component-Kinder** benötigen dies nicht. Rendern Sie ihren Tag oder
  laden Sie sie mit `loadWebComponent` / `loadByTagName`; sie laufen im selben
  DOM und importieren die Proxy-API direkt.

Der Code eines Kindes bleibt unabhängig von seiner Verschachtelung gleich.
Weitere Mechanik erklären [`<w-iframe>`](#w-iframe-custom-element),
[`<w-artifact>`](#w-artifact-custom-element) und
[Erweiterte HTML-Injektion](#erweiterte-html-injektion).

## Interna — nicht lesen oder überschreiben

`proxy.js` oder `proxy-fragment.js` installiert folgende Globals ausschließlich
für den Eigengebrauch. **Anwendungs- und Komponentencode darf sie weder lesen
noch setzen**; verwenden Sie `@wippy-fe/proxy`. Die Namen dienen hier nur der
Kollisionsvermeidung:

| Global | Bedeutung |
|---|---|
| `window.$W` | Asynchrones Accessor-Objekt (`$W.host()`, `$W.api()`, …); intern. |
| `window.getWippyApi` / `window.initWippyApi` | Asynchrone Funktionen zum Auflösen der Instanz; intern (`initWippyApi` ist veraltet). |
| `window.__WIPPY_APP_API__` | Aufgelöste Proxy-Instanz. |
| `window.__WIPPY_APP_CONFIG__` | Snapshot der Kind-`AppConfig`. |
| `window.__WIPPY_PROXY_CONFIG__` / `window.__WIPPY_CONFIG_OVERRIDES__` | CSS-Injektionsflags und seitenspezifische Überschreibungen. |
| `window.__WIPPY_WEB_COMPONENT_CACHE__` | Cache geladener Komponenten. |

Zwei Einstiegspunkte bilden die öffentliche JavaScript-API:
`initWippyApp(config, rootContainer?)` mountet den gesamten Web Host (der von
der Facade verwendete Module-Embed-Einstieg; siehe [Facade-Einstiegspunkt](./entry-point.md)),
und **`@wippy-fe/proxy`** ist die synchrone Kind-API. Alle Globals in der Tabelle
sind intern.

## PostMessage-Protokoll (`IFrameMessageType`) — interner Transport

Dieses Wire-Protokoll ist intern. **Anwendungscode sendet oder empfängt diese
Nachrichten nie**; `@wippy-fe/proxy` übernimmt das.

Bei einer hostinjizierten `srcdoc`-Seite ist `window.__WIPPY_APP_CONFIG__`
bereits vor `proxy.js` vorhanden. Die iframe-Runtime sendet trotzdem
`get-config`, jedoch nur als nicht blockierenden Resync- und Live-Update-Kanal.

Bei Web Fragment liefert der Handshake die initiale Konfiguration einschließlich
clientseitiger Auth-Daten, bevor die Proxy-Instanz entsteht. Er blockiert auch
beim manuellen Whole-Host-iframe (`iframe.html?waitForCustomConfig`), dessen
Elternfenster die erste `get-config`-Anfrage beantworten muss; siehe
[Facade-Einstiegspunkt § Manuelle Einbettung ohne Facade](./entry-point.md#manuelle-iframe-einbettung-ohne-facade).

Jede Nachricht ist ein JSON-Envelope der Form
`{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }`. Das Feld
`type` lässt sich über `APP_CONFIG_IFRAME_EVENT_TYPE` konfigurieren und ist
standardmäßig `'@gen2-chat'`.

Die Tabelle enthält nur die für diese Seite nötigen Transportelemente, nicht
das vollständige interne Enum. Weitere Elemente für Host-Lebenszyklus, Chat,
Download, Logging, Bridge-Antworten, Nav-Owner, Layoutmutationen, Breakpoints,
Drawer/Modal und Theme-Modus können sich ändern, ohne Anwendungs-API zu werden.

| Enum-Element | Wire-Wert | Richtung | Beschreibung |
|---|---|---|---|
| `GetConfig` | `get-config` | Kind → Host | Kind fordert seine `AppConfig` an |
| `SetConfig` | `set-config` | Host → Kind | Host liefert `AppConfig` |
| `UrlWasUpdatedInParent` | `url-was-updated-in-parent` | Host → Kind | Host-URL änderte sich; löst `@history` aus |
| `VisibilityWasUpdatedInParent` | `visibility-was-updated-in-parent` | Host → Kind | iframe-Sichtbarkeit änderte sich; löst `@visibility` aus |
| `TopicWasReceivedInParent` | `topic-was-received-in-parent` | Host → Kind | Liefert ein WebSocket-Themenereignis |
| `CmdRouteChanged` | `cmd-route-changed` | Kind → Host | Interne Route änderte sich; Host aktualisiert Browser-URL |
| `CmdTitleChanged` | `cmd-title-changed` | Kind → Host | `document.title` änderte sich |
| `CmdStartChat` | `cmd-start-chat` | Kind → Host | Neue Chat-Session öffnen |
| `CmdOpenSession` | `cmd-open-session` | Kind → Host | Vorhandene Chat-Session öffnen |
| `CmdOpenArtifact` | `cmd-open-artifact` | Kind → Host | Artefakt in Sidebar oder Modal öffnen |
| `CmdNavigate` | `cmd-navigate` | Kind → Host | SPA-Navigationsanfrage |
| `CmdShowToast` | `cmd-show-toast` | Kind → Host | Toast anzeigen |
| `CmdShowConfirm` | `cmd-show-confirm` | Kind → Host | Bestätigungsdialog anzeigen |
| `OnConfirmResult` | `on-confirm-result` | Host → Kind | Ergebnis des Dialogs |
| `CmdSetContext` | `cmd-set-context` | Kind → Host | Kontext an Chat-Session senden |
| `CmdHandleError` | `cmd-handle-error` | Kind → Host | Fehler an Host melden |
| `CmdLogout` | `cmd-logout` | Kind → Host | Abmeldung auslösen |
| `CmdSubscribe` | `cmd-subscribe` | Kind → Host | WebSocket-Thema abonnieren |
| `CmdUnSubscribe` | `cmd-unsubscribe` | Kind → Host | Abonnement beenden |
| `OnSubscription` | `on-subscription` | Host → Kind | Abonnementdaten liefern |
| `CmdStateGet` | `cmd-state-get` | Kind → Host | Persistenten Zustandswert lesen |
| `CmdStateSet` | `cmd-state-set` | Kind → Host | Persistenten Zustandswert schreiben |
| `CmdStateRemove` | `cmd-state-remove` | Kind → Host | Persistenten Zustandswert löschen |
| `CmdStateClear` | `cmd-state-clear` | Kind → Host | Seitenzustand leeren |
| `CmdStateGetAll` | `cmd-state-get-all` | Kind → Host | Gesamten persistierten Zustand lesen |
| `OnStateResult` | `on-state-result` | Host → Kind | Ergebnis einer Zustandsleseoperation |
| `OnStateError` | `on-state-error` | Host → Kind | Fehler einer Zustandsoperation |
| `CmdWsSend` | `cmd-ws-send` | Kind → Host | WebSocket-Befehl über Hostverbindung senden |
| `CmdBodySize` | `cmd-body-size` | Kind → Host | Körpergröße für `auto-height` melden |
| `CmdBridgePost` | `cmd-bridge-post` | Kind ↔ Elternobjekt | Fire-and-forget-Kanalnachricht über `host.bridge` |
| `CmdBridgeRequest` | `cmd-bridge-request` | Kind ↔ Elternobjekt | Request/Response-Kanalnachricht über `host.bridge` |
| `CmdClaimNavOwner` | `cmd-claim-nav-owner` | Kind → Host | Navigationszuständigkeit beanspruchen |
| `CmdReleaseNavOwner` | `cmd-release-nav-owner` | Kind → Host | Navigationszuständigkeit freigeben |
| `CmdLayoutSubscribe` | `cmd-layout-subscribe` | Kind → Host | Managed-Layout-Aktualisierungen abonnieren |
| `CmdLayoutUpdatePanel` | `cmd-layout-update-panel` | Kind → Host | Paneldefinition patchen |
| `CmdLayoutBroadcast` | `cmd-layout-broadcast` | Kind ↔ Host | Layout-Busnachricht innerhalb des Tabs |
| `OnLayoutChange` | `on-layout-change` | Host → Kind | Vollständige Snapshot-Aktualisierung |
| `OnLayoutPanelChanged` | `on-layout-panel-changed` | Host → Kind | Live-Delta eines Panels |
| `OnLayoutBroadcast` | `on-layout-broadcast` | Host → Kind | Layout-Broadcast zustellen |

## Custom Element `<w-iframe>` :id=w-iframe-custom-element

`<w-iframe>` ist das Low-Level-Primitiv für Kindseiten in der Proxy-Runtime. Es
nimmt rohes HTML entgegen und injiziert im normalen iframe-Pfad die vollständige
Wippy-Runtime (Base-URL, Import Map, `loading.js`, `proxy.js` und
Kindkonfiguration) in ein sandboxed `srcdoc`-iframe. In einer als Fragment
gerenderten Seite wird eine verschachtelte registrierte `view.page` stattdessen
als Web Fragment dargestellt; Inline-HTML und andere Inhalte bleiben `srcdoc`.

Verwenden Sie `<w-iframe>` für Quell-HTML, das dasselbe Runtime-Verhalten wie
Wippy-Micro-Frontend-Apps benötigt: authentifizierte API, State- und WebSocket-
Relay, Nav-Owner-Routing und Eltern-Kind-Bridge.

### Attribute und Eigenschaften

| Attribut/Eigenschaft | Erforderlich | Standard | Beschreibung |
|---|---|---|---|
| `src` | Nein | — | URL, die über die Proxy-`api` als Quell-HTML abgerufen wird. |
| `srcdoc` | Nein | — | Rohes Quell-HTML; für große Strings auch als `element.srcdoc = html`. |
| `base-url` | Nein | Aus `src` oder `document.baseURI` | Injiziertes `<base href>` für relative Assets. |
| `resource-id` | Nein | Element-`id`, dann `src` | Kindkontext-ID; bestimmt Standard-State- und Log-Scope. |
| `resource-type` | Nein | `page` | `page` oder `artifact`. |
| `sub-path` | Nein | Elternroute | Initiale Kindroute; als `config.context.route` im `GetConfig`-Handshake. |
| `auto-height` | Nein | `false` | Passt iframe-Höhe an `CmdBodySize` an. |
| `nav-owner` | Nein | `false` | Sendet bei Kindroutenänderung `nav-owner-route`, statt die Host-URL zu ändern. |

Akzeptierte JavaScript-Eigenschaften:

```typescript
const frame = document.querySelector('w-iframe')
frame.proxyConfig = { injections: { css: { markdown: false } } }
frame.configOverrides = { customization: { customCSS: ':root { --brand: red }' } }
frame.srcdoc = sourceHtml
```

### Ereignisse und Methoden

| Ereignis | Detail | Beschreibung |
|---|---|---|
| `loading` | — | Vor Abruf, Verarbeitung und Rendering. |
| `load` | — | Nach Laden des Sandbox-iframe. |
| `error` | Ursprünglicher Fehler | Bei Fehler in Abruf, Injektion oder Laden. |
| `nav-owner-route` | `{ path: string, navId?: number }` | Kindroutenänderung mit `nav-owner`; bubbling und `composed`. |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | Bridge-Nachricht des Kindes. |

| Methode | Beschreibung |
|---|---|
| `post(channel, payload?)` | Fire-and-forget-Bridge-Nachricht an das Kind. |
| `request<T>(channel, payload?, { timeoutMs }?)` | Request/Response; wird mit dem Handlerwert erfüllt. |

Shadow Parts: `loader`, `error`, `frame`.

Mit `nav-owner` wird die normale Routensynchronisierung vollständig unterdrückt:
Der Host ändert weder seine URL noch sendet er `UrlWasUpdatedInParent` zurück.
Der `path` im Eventdetail ist die **rohe interne Route** aus
`host.onRouteChanged(internalRoute, navId?)`, ohne Mountpräfix. Das Elternobjekt
ist für Präfix oder Routerabbildung verantwortlich:

```typescript
const frame = document.querySelector('w-iframe')
frame.addEventListener('nav-owner-route', (event) => {
  const { path, navId } = event.detail
  myRouter.push(path)
})
```

### Eltern-Kind-Bridge :id=parent-child-bridge

Benannte Kanäle vermeiden rohe `postMessage`-Envelopes.

Elternseite:

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

Kindseite:

```typescript
import { host } from '@wippy-fe/proxy'

host.bridge.post('ready', { value: 1 })
const file = await host.bridge.request('pick-file', { accept: '.csv' })

const off = host.bridge.on('refresh', async (payload) => {
  console.log('refresh requested', payload)
  return { ok: true }
})

// Later, dispose this listener when the owning component or page scope is torn down:
// off()
```

`host.bridge.on()` gibt eine Abmeldefunktion zurück. **Ein Kanal besitzt genau
einen aktiven Handler.** Der zuletzt registrierte Handler gewinnt für `post()`
und `request()`. Frühere Handler werden überdeckt, nicht entfernt; der Proxy
protokolliert eine `console.warn` bei doppelter Registrierung. Meldet sich der
neueste ab, wird der vorherige wieder aktiv. Für unabhängige Listener sind
unterschiedliche Kanäle nötig.

Ohne `options.timeoutMs` gilt für `host.bridge.request()` und `frame.request()`
eine Frist von zehn Sekunden (`10000` ms). Bei Ablauf wird das Promise mit
`Bridge request <id> timed out after <ms>ms` abgelehnt. Fehlt auf der Gegenseite
ein Handler, erfolgt sofort die Ablehnung
`No handler registered for channel "<channel>"`.

## Custom Element `<w-artifact>` :id=w-artifact-custom-element

`<w-artifact>` löst Artefakt- oder Seitenmetadaten und -inhalte auf und delegiert
iframe-basierte Typen intern an `<w-iframe>`. Es erkennt HTML, Markdown,
Webseitenpakete, ESM-Pakete und Direct-Tag-Komponenten.

### Attribute

| Attribut | Erforderlich | Werte | Standard | Beschreibung |
|---|---|---|---|---|
| `id` | Ja | Artefakt-/Seiten-UUID | — | Inhalts-ID. |
| `type` | Nein | `artifact` \| `page` | `artifact` | REST-Endpunkt: `/api/v1/artifact/<id>/content` oder `/api/public/pages/content/<id>`. |
| `auto-height` | Nein | Boolean-Flag | `false` | An inneres `<w-iframe>` für `CmdBodySize` weitergegeben. |
| `url` | Nein | Beliebige URL | — | Inhalt direkt abrufen; ignoriert `id`/`type`. |
| `sub-path` | Nein | Pfad | — | Initiale Kindroute des inneren `<w-iframe>`. |
| `nav-owner` | Nein | Boolean-Flag | `false` | Kindroutenänderungen senden `nav-owner-route`. |

### Ereignisse

| Ereignis | Zeitpunkt | Detail |
|---|---|---|
| `loading` | Vor dem Abruf | — |
| `load` | Nach Laden des iframe | — |
| `error` | Abruf oder Rendering fehlgeschlagen | Ursprünglicher Fehler |
| `nav-owner-route` | Nav-Owner-Kindroute geändert | `{ path: string, navId?: number }` |
| `wippy-message` | Bridge-Nachricht aus verschachteltem iframe | `{ channel, payload, requestId?, respond?, reject? }` |

### CSS-Status und Parts

Das Element setzt `status` auf `loading`, `ready` oder `error` und stellt Shadow Parts bereit:

```css
w-artifact[status="loading"] { opacity: 0.5; }
w-artifact[status="error"]   { border: 1px solid var(--p-danger-color); }

w-artifact::part(loader) { font-size: 1rem; }
w-artifact::part(frame)  { border: 0; }
```

## `<w-iframe>` gegenüber `<w-artifact>` und rohem `<iframe>`

| Funktion | `<w-iframe>` | `<w-artifact>` | Rohes `<iframe>` |
|---|---|---|---|
| Injiziert Wippy-Runtime | Ja | Ja (über `<w-iframe>`) | Nein |
| Löst Artefakt-/Seitenmetadaten auf | Nein | Ja | Nein |
| Authentifizierter Inhaltsabruf | Ja (Roh-HTML) | Ja (vollständiger Resolver) | Nein |
| State-Relay | Ja | Ja | Nein |
| WebSocket-Relay | Ja | Ja | Nein |
| Eltern-Kind-Bridge | Ja | Ja (weitergeleitet) | Nein |
| Nav-Owner | Ja | Ja | Nein |
| Inhaltstyperkennung | Nein | Ja | Nein |
| CSS Shadow Parts | `loader`, `error`, `frame` | `loader`, `error`, `frame` | — |
| `status`-Attribut | Ja | Ja | Nein |

Verwenden Sie `<w-artifact>` mit einer Wippy-Artefakt-UUID oder Seiten-ID, wenn
die Plattform die Auflösung übernehmen soll. Verwenden Sie `<w-iframe>` für
vorhandenes Quell-HTML mit Runtime-Injektion. Ein rohes `<iframe>` eignet sich
nur für vollständig externe Inhalte ohne Wippy-API.

## Erweiterte HTML-Injektion

Für die Quell-HTML-zu-srcdoc-Transformation ohne Element stellt der Proxy `html.inject(...)` bereit:

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

Dieselbe Funktion ist als `instance.html.inject`, `$W.html` und
`import { html } from '@wippy-fe/proxy'` erreichbar. Für normales Mounting ist
`<w-iframe>` vorzuziehen; `html.inject(...)` ist eigener Hosting-Infrastruktur
vorbehalten.
