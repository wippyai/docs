---
title: "Host-less-Modus"
description: "Wippy-Micro-Frontend-Apps und Web Components ohne den Web Host ausführen und testen."
---

# Host-less-Modus

Im Host-less-Modus lassen sich Wippy-Micro-Frontend-Apps und Web Components **ohne** einen umgebenden Wippy Web Host bauen, ausführen und testen.

> **Standardzustand der Injektionen:** Das Entwicklungs-Overlay startet mit deaktivierten Optionen `themeConfig`, `primevue`, `markdown` und `iframe`; `customCss` und `customVariables` sind dagegen aktiviert. Eine App, die nur eigene Overrides nutzt, kann daher korrekt aussehen, während eine App mit Plattform-Theme-Variablen oder PrimeVue-Stilen zunächst ungestylt erscheint. Öffnen Sie den FAB des Overlays, aktivieren Sie die benötigten Injektionen und wählen Sie „Auto-accept on reload“, um die Auswahl über Neuladevorgänge hinweg beizubehalten.

---

## Inhaltsverzeichnis

- [Denkmodell: Apps und WCs sind eigenständig lauffähig](#denkmodell-apps-und-wcs-sind-eigenständig-lauffähig)
- [Der Umschaltpunkt `@wippy/scripts`: ein Tag, zwei Startpfade](#der-umschaltpunkt-wippyscripts-ein-tag-zwei-startpfade)
- [Was `dev-proxy.js` tatsächlich tut](#was-dev-proxyjs-tatsächlich-tut)
- [Das Entwicklungs-Overlay](#das-entwicklungs-overlay)
- [Host-Stubs: die eigenständige `host`-API](#host-stubs-die-eigenständige-host-api)
- [Web Components: Playground und Tests ohne Host](#web-components-playground-und-tests-ohne-host)
- [Typische Abweichungen und ihre Erkennung](#typische-abweichungen-und-ihre-erkennung)
- [Fehlerbehebung](#fehlerbehebung)
- [Verwandte Dokumentation](#verwandte-dokumentation)

---

## Denkmodell: Apps und WCs sind eigenständig lauffähig

Für jede Wippy-Micro-Frontend-App und jedes Web Component gilt dieselbe Laufzeitbedingung:

> **Der Laufzeitvertrag ist die Oberfläche der Proxy-API.**

In der Praxis bedeutet das:

- Zur Laufzeit greifen Apps und WCs ausschließlich auf die synchronen Getter aus `@wippy-fe/proxy` zu: `host`, `api`, `on`, `config`, `state`, `ws` und `logger`. Beide Oberflächen verwenden dieselben Imports. Intern werden sie auf dieselbe `ProxyApiInstance` aufgelöst, die die Laufzeit über interne Globals installiert (`window.$W`, `window.__WIPPY_APP_API__`); lesen Sie diese Globals nie direkt.
- Apps und WCs importieren weder Quellcode benachbarter Apps noch die Lua-Seite des übergeordneten Moduls, den Wippy Web Host oder ein anderes Projektmodul. Sie liegen in einem eigenen Ordner. Vite leitet sämtliche Rollup-Externals aus der `import-map.json` des festgelegten Ziel-Hosts ab; `package.json` nennt nur die npm-Abhängigkeiten und Peer-Wurzeln, die das Artefakt tatsächlich importiert.
- Dieselbe `app.ts` beziehungsweise `index.ts` eines WC startet in zwei Umgebungen:
  1. **Mit Host:** in einem Wippy Web Host, der `proxy.js`, AppConfig, Importmap und CSS injiziert.
  2. **Ohne Host:** über `app.html` in einem Vite-Entwicklungsserver, einer Unit-Test-Seite, einem Storybook-ähnlichen Playground oder einem anderen HTTP-Entwicklungshost.

Jede App und jedes WC ist damit ein kleines Programm mit einer standardisierten Ein-/Ausgabeoberfläche. Der Host ist eine mögliche Laufzeit, die eigenständige Ausführung eine andere. Anwendungscode muss nicht zwischen beiden unterscheiden.

Das ermöglicht lokale Frontend-Iteration ohne vollständiges Wippy-Backend, isolierte WC-Unit-Tests mit Vitest und jsdom, die gemeinsame Nutzung von Apps zwischen Wippy-Modulen sowie kundenspezifische Overlays, die Metadaten wie Theming, Importmap und Umgebung ohne Neubau des Frontend-Bundles anpassen.

---

## Der Umschaltpunkt `@wippy/scripts`: ein Tag, zwei Startpfade

Die `app.html` jeder kanonischen App enthält **genau ein** Script-Tag, das beim Laden den Startpfad bestimmt.

Das folgende Beispiel zeigt nur Body und Startlogik. Fügen Sie die vollständige, gültige Importmap aus dem [Importmap-Snapshot-Algorithmus](./build-system.md#importmap-snapshot-algorithmus) ein und aktualisieren Sie sie bei einem Wechsel des festgelegten Web-Host-Tags.

```html
<!-- URL MUST include a release-tag segment: https://web-host.wippy.ai/<release-tag>/dev-proxy.js -->
<script
    src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
    data-role="@wippy/scripts"
></script>
```

Das vollständige `app.html`-Gerüst steht unter [Micro-Frontend-App](./micro-frontend-app.md).

Zwei Attribute dieses einen Tags bilden den gesamten Dual-Mode-Vertrag:

| Attribut | Aufgabe | Verwendet von |
|---|---|---|
| `data-role="@wippy/scripts"` | Marker für den Host. Der Host entfernt dieses Element vor der Auslieferung des Iframes und injiziert eigenes `loading.js`, `proxy.js`, Importmap und AppConfig **vor** dem Marker. Im Host-Modus verschwindet das Element. | Wippy Web Host |
| `src="…/dev-proxy.js"` | Fallback-URL ohne Host. Der Browser lädt `dev-proxy.js` direkt, und das Script startet die Seite. Im Host-Modus ist `src` bedeutungslos, weil das Element bereits entfernt wurde. | Eigenständiger Browser-Aufruf |

**Wählen Sie eine URL passend zur Umgebung.** Die Web-Host-URL benötigt ein Release-Tag-Segment und muss zur Version in `fe_facade_url` passen. `/dev-proxy.js` direkt unter der Host-Wurzel ist ungültig; verwenden Sie `/<release-tag>/dev-proxy.js`. Dasselbe Bundle eignet sich für lokale Entwicklung, CI und teilbare Vorschau-Links.

| Umgebung | Beispiel für `src=` |
|---|---|
| Öffentliche CDN | `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` |
| Selbst gehostete Wippy-Bereitstellung | `https://<your-wippy-host>/<release-tag>/dev-proxy.js` |

Dasselbe HTML-Element ist somit Injektionsanker des Hosts und Start-Fallback ohne Host.

### Inhalt der Importmap

Rufen Sie die vollständige Map während der Entwicklung einmal mit demselben Tag ab, das auch `fe_facade_url` und `dev-proxy.js` verwenden:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<release-tag>/import-map.json" -o import-map.json
```

Übernehmen Sie die Antwort unverändert als Inhalt des Elements `<script type="importmap">` in `app.html`. Kommentare, Auslassungszeichen oder handgeschriebene Ersetzungen machen das JSON ungültig. Der [Build- und Abhängigkeitsvertrag](./build-system.md#importmap-snapshot-algorithmus) beschreibt Snapshot und Herkunft; die Antwort des Releases liefert das genaue `imports`-Objekt.

Konventionen:

- Verwenden Sie **jeden abgerufenen Schlüssel** als Rollup-External, auch derzeit ungenutzte.
- Behalten Sie dasselbe vollständige Schlüssel/Wert-Objekt in `app.html`; bauen Sie es nicht mit `esm.sh` nach.
- Bündeln Sie einen importierten Specifier nur, wenn dessen exakter Schlüssel fehlt.
- Rufen Sie die Map erneut ab, wenn sich das Web-Host-Tag ändert oder eine neue Abhängigkeit hinzukommt.

Die eigenständige `app.html` löst die kopierte Map auf; im Host-Modus liefert dasselbe festgelegte Release die Map.

### `package.json` für dev-proxy bereitstellen

Die `package.json` jeder Wippy-App enthält Metadaten für Laufzeitstandards, darunter Proxy-Injektionen (`wippy.proxy.injections.css.*`), Seiten-Theming-Overrides (`wippy.configOverrides.customization`) und Iconify-Sammlungen. Im Host-Modus liest der Host sie aus der Registry. Ohne Host benötigt dev-proxy dieselben Daten.

Der kanonische Weg ist `wippyPagePlugin()` aus der zusammengehörigen aktuellen `@wippy-fe/vite-plugin`-Familie (bei Veröffentlichung `0.0.56`), einmal in `vite.config.ts`. Das Plugin liest `package.json` beim Build und:

1. löst `file://`-Verweise im `wippy`-Block auf, indem es Werte der Form `"file://<relative>"` durch den UTF-8-Inhalt der referenzierten Datei ersetzt; siehe die Benennung `*.do-not-link.<ext>` unter [Build-System](./build-system.md),
2. erzeugt zwei Ausgaben mit dem aufgelösten JSON: ein in `<head>` injiziertes `<script type="application/json" data-role="@wippy/package">` für dev-proxy sowie `wippy-meta.json` im tatsächlichen Vite-Ausgabeordner für den Host-Modus.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default defineConfig({
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
  // …
})
```

Für Web Components (`view.component`, nur ESM, ohne HTML-Einstieg für die Injektion) dient `wippyComponentPlugin()` aus demselben Paket. Es erzeugt ausschließlich `wippy-meta.json` im tatsächlichen Ausgabeordner.

```ts
// vite.config.ts for a web component
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
export default defineConfig({ plugins: [wippyComponentPlugin()] })
```

> `wippyPackagePlugin` bleibt ein veralteter Kompatibilitätsalias. Neue Seiten verwenden `wippyPagePlugin()`, reine Komponenten-Builds `wippyComponentPlugin()`.

Das Plugin setzt folgenden Block an den Anfang von `<head>`:

```html
<script type="application/json" data-role="@wippy/package">
{ "name": "@wippy/your-app", "version": "1.0.0", "wippy": { "proxy": {...}, "configOverrides": {...} } }
</script>
```

`dev-proxy.js` liest ihn beim Start synchron mit `document.querySelector('script[data-role="@wippy/package"]')`. Aus `wippy.proxy.injections` entstehen die Standards der Proxy-Konfiguration, aus `wippy.configOverrides.customization` die Werte unter `appConfig.theming.global`. Der String `@wippy/package` wird als `WIPPY_PACKAGE_DATA_ROLE` aus `@wippy-fe/shared` exportiert.

Der Aufbau gewährleistet eine einzige Quelle in `package.json`, synchronen Zugriff vor Anwendungscode, eine definierte Reihenfolge vor allen Scripts, eine vom Plugin gepflegte HTML-Vorlage, eine gemeinsame Konstante und Kompatibilität mit dem Host. Im Host-Modus wird das Inline-JSON nur vom eigenständigen Entwicklungspfad ausgewertet und bleibt sonst wirkungslos.

Fehlt der Tag, fällt dev-proxy in `resolveDevConfig()` auf `getDefaultProxyConfig()` zurück; ältere Apps verwenden damit die allgemeinen Standards.

> **Warum ein Plugin statt eines Laufzeit-Globals?** `dev-proxy.js` ist ein frühes, synchrones Nicht-Modul-Script und läuft beim Parsen von `<head>`, bevor `app.ts` geladen ist. Ein HTML-Transform stellt die Daten deshalb rechtzeitig im DOM bereit.

> **Warum genau ein Tag?** Ein zweiter Script-Block würde erst nach der Host-Injektion laufen. Das Ein-Tag-Muster hält den Marker immer im Quell-HTML; der Host ersetzt ihn, während sein unverändertes Vorhandensein den Host-less-Pfad auslöst.

Die HTML-Datei aus `wippy.path` muss ein Element `<script data-role="@wippy/scripts">` als Injektionsstelle enthalten. `data-role` ist der Selektor; `type="text/javascript"` ist optional, da klassische Scripts der HTML-Standard sind.

Kanonische Vorlagen enthalten den `src="…/dev-proxy.js"`-Fallback. Lassen Sie ihn nur weg, wenn die App ausdrücklich nicht ohne Host lauffähig ist und diese Einschränkung dokumentiert.

---

## Was `dev-proxy.js` tatsächlich tut

`dev-proxy.js` ist das Host-less-Startbundle unter `https://web-host.wippy.ai/<release-tag>/dev-proxy.js`. Es installiert intern dieselben Globals wie der reale Host, damit die Getter aus `@wippy-fe/proxy` ohne Host funktionieren. Anwendungscode greift weiterhin nur auf die öffentlichen Imports zu.

Der Start umfasst fünf Schritte:

1. `installHistoryGuard()` ersetzt `pushState` und `replaceState`, damit vue-router außerhalb eines iframe-srcdoc-Kontexts nicht den Browserverlauf verändert.
2. `resolveDevConfig()` liest `localStorage['@wippy-dev/config']` und `localStorage['@wippy-dev/proxy-config']`. Ist `@wippy-dev/auto-accept` gleich `'true'` und eine gespeicherte Konfiguration vorhanden, wird sie sofort verwendet; sonst blockiert das Overlay bis zur Bestätigung.
3. Eine nachgebildete `ProxyApiInstance` verbindet akzeptierte `ChildAppConfig`, nanoevents für `on(...)`, protokollierende `host`-Stubs, eine echte Axios-Instanz gegen `env.APP_API_URL` sowie produktionsförmige Logger-, State- und WebSocket-Bridges. Ohne echten Host-Responder können auf Antwort angewiesene Aufrufe nicht abgeschlossen werden; nur `host` erhält die unten beschriebenen Stubs.
4. CSS-Injektionen folgen der gewählten Proxy-Konfiguration: `themeConfig`, `iframe`, `primevue` und `markdown` laden ihre Bundles; `customCss` und `customVariables` wenden `appConfig.theming.global.customCSS` beziehungsweise `cssVariables` einschließlich der unter [App-Theming](./micro-frontend-app-theming.md#l3-seitenspezifische-config_overrides-im-registry-yaml) beschriebenen Blöcke `@dark` und `@light` an.
5. Die internen Proxy-Globals werden in derselben Form wie in `entry.iframe.ts` installiert. Alle Getter einschließlich `config`, `host`, `api`, `on`, `logger`, `state`, `ws` und `loadWebComponent` funktionieren unverändert. Die Globals selbst sind intern; siehe [Proxy und Isolation § Interna](../web-host/proxy-isolation.md#interna-nicht-lesen-oder-überschreiben).

Die Standard-`ChildAppConfig` aus `getDefaultConfig()` lautet:

```ts
{
  $schema: '<built schema URL>',
  auth: { token: 'dev-token', expiresAt: '' },
  env: {
    APP_API_URL: `${location.origin}/api`,
    APP_AUTH_API_URL: `${location.origin}/api`,
    APP_WEBSOCKET_URL: `${location.origin.replace(/^http/, 'ws')}/ws`,
  },
  theming: { global: {} },
  context: { resourceId: '', resourceType: 'page' },
}
```

Alle Werte lassen sich im Modal oder über `localStorage['@wippy-dev/config']` überschreiben.

---

## Das Entwicklungs-Overlay

Das Shadow-DOM-Web-Component `<wippy-dev-overlay>` zeigt:

- einen FAB unten rechts,
- im Wartezustand die Meldung „Accept config to continue loading“,
- ein Panel mit Monitor für Pfad, Titel und Viewport sowie „Trigger Refresh“, das `@visibility(true)` auslöst,
- eine aufklappbare Konfiguration für die vollständige `ChildAppConfig`, alle Injektionsflags (`themeConfig`, `iframe`, `primevue`, `markdown`, `customCss`, `customVariables`, `tailwindConfig`, `resizeObserver`, `preventLinkClicks`, `iconifyIcons`, `refreshWhenVisible`, `historyPolyfill`, `errorCapture`) und „Auto-accept on reload“,
- „Reset“ zum Löschen aller `@wippy-dev/*`-Schlüssel sowie „Accept“ zum Speichern und Fortsetzen des Starts.

Verwendete LocalStorage-Schlüssel:

| Schlüssel | Inhalt |
|---|---|
| `@wippy-dev/config` | akzeptiertes JSON der `ChildAppConfig` |
| `@wippy-dev/proxy-config` | akzeptierte partielle `ProxyConfig` mit Injektionsflags |
| `@wippy-dev/auto-accept` | `'true'`, um die manuelle Bestätigung beim Neuladen zu überspringen |

Bei aktiviertem Auto-Accept startet die App mit der zuletzt akzeptierten Konfiguration; der FAB bleibt für Überwachung und Änderungen verfügbar.

---

## Host-Stubs: die eigenständige `host`-API

Ohne echten Host ersetzt `src/proxy/dev/host-stubs.ts` die `host`-API:

| Methode | Verhalten ohne Host |
|---|---|
| `host.toast(message)` | nur Konsolenprotokoll |
| `host.confirm({ message })` | `window.confirm()` des Browsers |
| `host.startChat(token, options)` | Konsolenprotokoll |
| `host.openSession(uuid, options)` | Konsolenprotokoll |
| `host.openArtifact(uuid, options)` | Konsolenprotokoll |
| `host.navigate(url)` | Konsolenprotokoll, emittiert `@history` und aktualisiert den Pfad im Overlay |
| `host.onRouteChanged(path)` | Konsolenprotokoll und Pfadaktualisierung im Overlay |
| `host.handleError(code, error)` | `console.error` |
| `host.setContext(context, sessionUUID, source)` | Konsolenprotokoll |
| `host.formatUrl(rel)` | liefert `${appConfig.routePrefix || ''}${rel}` |
| `host.classifyLink(href)` | reale Implementierung anhand von `mountRoutes` und `routePrefix` |
| `host.layout.*` | wirkungslose Stubs gemäß Typvertrag |
| `host.surface` | eigenständiger `host`-Deskriptor mit Breite null, Content-Sizing und ohne optionale Fähigkeiten |
| `host.bridge.post/on/request` | `post` protokolliert, `on` liefert eine wirkungslose Subscription, `request` wird wegen fehlender Bridge abgelehnt |
| `host.setThemeMode(mode)` / `host.getThemeMode()` | speichert und meldet den Modus lokal und emittiert das Theme-Ereignis |
| `host.logout()` | nur Konsolenprotokoll |

Die Stubs protokollieren angeforderte Host-Seiteneffekte. Hängt die Korrektheit einer Anwendung von einem solchen Effekt ab, testen Sie diesen Pfad unter einem echten Host.

---

## Webkomponenten: Testumgebung und Tests ohne Host :id=web-components-playground-and-testing-without-the-host

Web Components verwenden dieselben Imports aus `@wippy-fe/proxy`, werden aber als ES-Module statt in Iframes geladen.

### Test- oder Demoseite :id=playground-or-demo-page

```html
<!-- demo.html in your WC project -->
<!DOCTYPE html>
<html>
<head>
    <!-- Required complete import-map script omitted from this abbreviated example. -->
    <script src="https://web-host.wippy.ai/webcomponents-1.0.56/dev-proxy.js" data-role="@wippy/scripts"></script>
</head>
<body>
    <my-component prop1="value"></my-component>
    <script type="module" src="./src/index.ts"></script>
</body>
</html>
```

`index.ts` ruft `define(import.meta.url, ...)` auf; dev-proxy stellt die Host-Stubs bereit. Fehlt `dev-proxy.js`, wirft `entry.web-component.ts` ausdrücklich:

> `@wippy-fe/proxy: Proxy globals not found. For dev/testing without the Wippy host, add <script src="dev-proxy.js"></script> to your HTML.`

Dieser Fehler bezeichnet ein fehlendes Host-less-Startscript.

### Partieller Vitest-/jsdom-Testauszug

Unit-Tests benötigen kein Overlay. Sie hängen stattdessen den Wrapper an, den auch der Host bereitstellen würde. Der folgende Auszug setzt eine `jsdom`-Umgebung und eine vor dem Testmodul geladene Setup-Datei voraus. Das Setup muss `window.__WIPPY_APP_API__` und `window.__WIPPY_APP_CONFIG__` nachbilden; bei jsdom-Versionen ohne `ElementInternals.states` auch die `CustomStateSet`-Oberfläche. Es handelt sich um eine Komponentenprüfung, nicht um ein vollständiges Vitest-Projekt.

```ts
import { describe, expect, it } from 'vitest'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class TestEl extends WippyElement {
  static get wippyConfig() {
    return { propsSchema: { properties: {} }, hostCssKeys: [] }
  }
  protected onMount(): void {}
  protected onUnmount(): void {}
}

const TAG = 'wippy-test-el'
customElements.define(TAG, TestEl)

it('reads host wrapper attached by resolver as __wippyHost', () => {
  const el = document.createElement(TAG) as TestEl
  const fakeHost = { layout: { broadcast: () => {} } }
  ;(el as any).__wippyHost = fakeHost
  expect(el.host).toBe(fakeHost)
})
```

`__wippyHost` ist der Vertrag des Hosts im Managed-Layout. Tests für API- oder Proxy-Globals können dev-proxy über eine Vitest-Setup-Datei laden oder `window.__WIPPY_APP_API__` selbst nachbilden:

```ts
// vitest.setup.ts
;(window as any).__WIPPY_APP_API__ = {
  api: mockApi,
  host: mockHost,
  on: mockOn,
  // ...other ProxyApiInstance fields
}
```

In beiden Varianten erfüllt testeigener Code den Proxy-Vertrag anstelle eines Wippy-Servers.

---

## Typische Abweichungen und ihre Erkennung

| Symptom | Wahrscheinliche Ursache | Korrektur |
|---|---|---|
| `app.html` enthält `<script data-role="@wippy/scripts"></script>` ohne `src=` | Die Seite kann auf einem HTTP-Entwicklungshost nicht starten; die Proxy-Laufzeit wird nie initialisiert. | Ergänzen Sie `src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"`; die URL benötigt ein Release-Tag-Segment. |
| Das dev-proxy-Script ist vorhanden, darüber jedoch kein `<script type="importmap">` | Bare Specifier können nicht aufgelöst werden. | Rufen Sie `<release-tag>/import-map.json` ab, übernehmen Sie das vollständige `imports`-Objekt vor dev-proxy und verwenden Sie alle Schlüssel als Rollup-Externals. |
| Der Body enthält einen eigenen Spinner statt `<wippy-loading title="…">` | Der Loader vor dem Start entspricht nicht dem Wippy-Muster. | Verwenden Sie `<wippy-loading title="Loading..."></wippy-loading>`; dev-proxy registriert es synchron vor dem Parsen von `<body>`. |
| Import aus den Quelldateien einer benachbarten App | Modulgrenzen werden umgangen. | Extrahieren Sie ein Workspace-Paket oder duplizieren Sie bewusst; importieren Sie nie über App-Ordner hinweg. |
| Fest codiertes `fetch('/api/…')` | Die Proxy-Axios-Instanz und `APP_API_URL`-Overrides werden umgangen. | Verwenden Sie `useApi()` in Apps beziehungsweise `api` aus `@wippy-fe/proxy` in WCs. |
| `new EventSource(...)` für Live-Daten | Authentifizierung und Relay-Bridge des Hosts werden umgangen. | Verwenden Sie `on('your.topic', cb)`; ohne Host emittiert das Topic nur bei eigener Simulation. |
| `data-theme` für den Theme-Wechsel | `data-theme` ist nicht das Wippy-Theme-Protokoll. | Verwenden Sie Auto-Modus oder die Host-Klassen `.w-theme-light` und `.w-theme-dark`; siehe [App-Theming](./micro-frontend-app-theming.md#l3-seitenspezifische-config_overrides-im-registry-yaml). |
| Import von `@wippy-fe/theme/theme-config.css` in `app.ts` | Die Injektion `themeConfig: true` übernimmt dies mit und ohne Host. | Entfernen Sie den redundanten Import. |
| Fest codierte API-Basis-URLs | Sie funktionieren in einer anderen Host-less-Umgebung nicht. | Lesen Sie `appConfig.env.APP_API_URL` über `useApi()`. |

---

## Fehlerbehebung

**Fehler „Proxy globals not found“.** Prüfen Sie, ob `<script src=".../dev-proxy.js" data-role="@wippy/scripts">` vorhanden und erreichbar ist. Im Produktions-Host bedeutet der Fehler, dass `proxy.js` nicht injiziert wurde; prüfen Sie die Host-Protokolle.

**Das Entwicklungs-Overlay erscheint nicht.** Es wird nach `DOMContentLoaded` an `document.body` angehängt. Bei fehlendem oder ausgeblendetem Body kann es nicht erscheinen. Verschieben Sie das Script an das Ende des Body oder blenden Sie den Body ein.

**Auto-Accept hängt mit fehlerhafter Konfiguration.** Das Overlay bleibt im Überwachungsmodus verfügbar. Öffnen Sie den FAB, wählen Sie „Reset“, um alle `@wippy-dev/*`-Schlüssel zu löschen, und laden Sie neu.

**Das Theme ist im Entwicklungsmodus falsch.** `getDefaultProxyConfig()` aktiviert `customCss` und `customVariables`, aber nicht `themeConfig`, `iframe`, `primevue` oder `markdown`. Aktivieren Sie die benötigten Optionen; Auto-Accept merkt sie sich.

**Importmap unterscheidet sich zwischen Host- und Host-less-Modus.** Rufen Sie `import-map.json` des festgelegten Releases neu ab, ersetzen Sie das vollständige `imports`-Objekt und erzeugen Sie die Rollup-Externals aus allen Schlüsseln. Pflegen Sie keine Teilmenge.

**WC-Test meldet „host getter returned null“.** Setzen Sie `el.__wippyHost = fakeWrapper`, bevor `connectedCallback` läuft, also vor `document.body.appendChild(el)`, oder bilden Sie den Wrapper über den Resolver Ihres Testaufbaus nach.

---

## Verwandte Dokumentation

- [Proxy-API](./proxy-api.md) – vollständige Referenz für `@wippy-fe/proxy`
- [Micro-Frontend-App](./micro-frontend-app.md) – Aufbau von Apps mit Dual-Mode-`app.html`
- [Web Component](./web-component.md) – `WippyVueElement`, `define()` sowie Playground und Tests ohne Host
- [Theming](./theming.md) – seitenspezifische Overrides über `config_overrides`
- [Compliance-Checkliste](./compliance-checklist.md) – Host-less-Gates und Ablehnungsregeln
