---
title: "Host-less-Modus"
description: "Maßgeblicher Leitfaden zum standalone-fähigen Design-Vertrag, dank dem jede Wippy-Micro-Frontend-App und Web Component bauen, laufen und testen kann, ohne…"
---

# Host-less-Modus

Maßgeblicher Leitfaden zum standalone-fähigen Design-Vertrag, dank dem jede Wippy-Micro-Frontend-App und Web Component bauen, laufen und testen kann, **ohne** dass der Wippy Web Host sie umschließt.

> **Standardzustand der Injections:** Das Dev-Overlay startet mit `themeConfig`, `primevue`, `markdown` und `iframe` **deaktiviert**, aber mit `customCss` und `customVariables` **aktiviert**. Eine App, die sich nur auf eigene Overrides stützt, scheint also zu funktionieren, während eine App, die die Plattform-Theme-Variablen oder PrimeVue-Styles erwartet, ungestylt rendert, bis Sie diese Injections aktivieren. Öffnen Sie den Overlay-FAB → aktivieren Sie die benötigten Injections → setzen Sie "Auto-accept on reload", damit die Auswahl Reloads überdauert.

---

## Inhaltsverzeichnis

- [Denkmodell — Apps und WCs sind absichtlich standalone-fähig](#mental-model--apps-and-wcs-are-intentionally-standalone-aware)
- [Der `@wippy/scripts`-Umschaltpunkt — ein Tag, zwei Boot-Pfade](#the-wippyscripts-switchpoint--one-tag-two-boot-paths)
- [Was `dev-proxy.js` tatsächlich tut](#what-dev-proxyjs-actually-does)
- [Das Dev-Overlay (Konfigurationsdialog)](#the-dev-overlay-config-modal)
- [Host-Stubs — die Standalone-`host`-API](#host-stubs--the-standalone-host-api)
- [Web Components — Host-less-Playground und Tests](#web-components--host-less-playground-and-tests)
- [Häufige Abweichungen und wie man sie erkennt](#common-deviations-and-how-to-spot-them)
- [Fehlersuche](#troubleshooting)
- [Verwandte Dokumente](#related-docs)

---

## Denkmodell — Apps und WCs sind absichtlich standalone-fähig

Jede Wippy-Micro-Frontend-App und jede Web Component ist um eine kleine, bewusste Einschränkung herum gebaut:

> **Der Laufzeitvertrag ist die Oberfläche der Proxy-API. Sonst nichts.**

Was das in der Praxis bedeutet:

- Das Einzige, was eine App oder WC zur Laufzeit berührt, ist die Oberfläche der Proxy-API: die synchronen Getter, die aus `@wippy-fe/proxy` importiert werden (`host`, `api`, `on`, `config`, `state`, `ws`, `logger`). Apps und WCs nutzen dieselben Imports; darunter lösen sie auf dieselbe `ProxyApiInstance` auf, die die Runtime als interne Globals installiert (`window.$W`, `window.__WIPPY_APP_API__` — lesen Sie diese niemals direkt).
- Apps und WCs importieren **keinen** Code aus benachbarten Apps, aus der
  Lua-Seite des übergeordneten Moduls, aus dem Wippy Web Host oder aus einem
  anderen Projektmodul. Sie leben in ihrem eigenen Ordner. Vite leitet jedes
  Rollup-External aus der gepinnten `import-map.json` des Ziel-Hosts ab;
  `package.json` deklariert nur die npm-Abhängigkeiten und Peer-Roots, die das
  Artefakt tatsächlich importiert.
- Dieselbe `app.ts` (bzw. `index.ts` einer WC) bootet in zwei Umgebungen korrekt:
  1. **Hosted** — innerhalb eines Wippy Web Hosts, der `proxy.js`, AppConfig, Importmap und CSS injiziert.
  2. **Host-less** — mit direkt ausgeführter `app.html` über den Vite-Dev-Server, file://, eine Unit-Test-Seite, einen Storybook-artigen Playground usw.

Sie können sich jede App/WC als "kleines Programm mit einer winzigen standardisierten I/O-Oberfläche" vorstellen. Der Host ist eine mögliche Laufzeitumgebung; Standalone eine andere. Der App-Code weiß nicht, in welcher er steckt.

Das ist kein Zufall und kein nachträglicher Einfall. Es ermöglicht:
- Lokale FE-Iteration ohne ein vollständiges Wippy-Backend.
- WCs, die isoliert unter vitest + jsdom unit-testbar sind.
- Apps, die zwischen Wippy-Modulen teilbar sind — jede Micro-Frontend-App und Web Component baut mit derselben Toolchain, unabhängig davon, welches Modul sie ausliefert.
- Kundenspezifische Overlays — Betreiber patchen Metadaten (Theming, Importmap, Env), ohne das FE-Bundle neu zu bauen.

---

## Der `@wippy/scripts`-Umschaltpunkt — ein Tag, zwei Boot-Pfade

Die `app.html` jeder kanonischen App liefert **ein** Script-Tag, das den Boot-Pfad zur Ladezeit entscheidet:

Dies ist ein gekürztes Body-/Boot-Beispiel. Fügen Sie die vollständige gültige
Import-Map-Antwort ein, die der [Algorithmus für den Import-Map-Snapshot](./build-system.md#import-map-snapshot-algorithm)
beschreibt, und aktualisieren Sie sie, wenn sich das gepinnte Web-Host-Tag
ändert.

```html
<!-- Die URL MUSS ein Release-Tag-Segment enthalten: https://web-host.wippy.ai/<release-tag>/dev-proxy.js -->
<script
    src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
    data-role="@wippy/scripts"
></script>
```

Vollständiges `app.html`-Scaffold in [Micro Frontend App](./micro-frontend-app.md).

Zwei Attribute auf diesem einen Tag tragen den gesamten Dual-Mode-Vertrag:

| Attribut | Rolle | Genutzt von |
|---|---|---|
| `data-role="@wippy/scripts"` | Marker für den Host. Wenn vorhanden, entfernt der Host dieses `<script>`-Element, bevor er den iframe ausliefert, und injiziert seine eigenen `loading.js` + `proxy.js` + Importmap + AppConfig **vor** dem Marker. Im Hosted-Modus verschwindet das Element. | Wippy Web Host |
| `src="…/dev-proxy.js"` | Fallback-URL. Wird verwendet, wenn kein Host vorhanden ist — der Browser lädt `dev-proxy.js` direkt, und dieses Skript bootet die Seite. Das Attribut `src=` ist im Hosted-Modus irrelevant (das `<script>`-Element existiert dann nicht mehr). | Standalone-Laden im Browser |

**Wählen Sie eine URL, die zu Ihrer Umgebung passt.** Beachten Sie: **Die Web-Host-URL verlangt immer ein Release-Tag-Segment** im Pfad — `/dev-proxy.js` direkt am Host-Root ist NICHT gültig; Sie müssen einen bestimmten Build adressieren (`/<release-tag>/dev-proxy.js`). Das garantiert, dass jeder Dev-Modus-Boot an ein bekanntes, reproduzierbares Bundle gepinnt ist, und vermeidet Überraschungen der Klasse "das Host-CDN wurde über Nacht aktualisiert, meine Vorschau ist kaputt".

| Umgebung | Beispielwert für `src=` |
|---|---|
| Öffentliches CDN (Standard) | `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` |
| Selbst gehostetes Wippy-Deployment | `https://<your-wippy-host>/<release-tag>/dev-proxy.js` |

Das Tag muss zur Release-Version passen, die `fe_facade_url` der Facade verwendet. Pinnen Sie es explizit — `/dev-proxy.js` ohne Tag-Segment ist nicht gültig. Dasselbe Bundle funktioniert für lokale Iteration, CI und teilbare Vorschau-Links.

So ist dieselbe HTML-Zeile zugleich der Anker "injiziere deine Skripte hier" für den Host *und* der Host-less-Fallback-Boot — ganz ohne bedingte Logik.

### Was gehört in die Importmap?

Holen Sie die vollständige Map einmal während der Entwicklung, mit demselben Tag wie `fe_facade_url` und `dev-proxy.js`:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<release-tag>/import-map.json" -o import-map.json
```

Setzen Sie den Text des `<script type="importmap">`-Elements in `app.html` auf
die geholte JSON-Antwort, wortgetreu. Setzen Sie keine Kommentare,
Auslassungsplatzhalter oder handgeschriebenen Ersetzungen in dieses JSON. Der
[Build- und Abhängigkeitsvertrag](./build-system.md#import-map-snapshot-algorithm)
definiert die Anforderungen an Snapshot und Herkunft; die geholte Release-Antwort
liefert das exakte `imports`-Objekt.

Konventionen:
- Setzen Sie **jeden geholten Key** in die Rollup-Externals, auch aktuell ungenutzte Keys.
- Behalten Sie dasselbe vollständige Key/Value-Objekt in `app.html`; rekonstruieren Sie es nicht mit `esm.sh`.
- Bundeln Sie einen importierten Specifier nur, wenn sein exakter Key fehlt.
- Holen Sie sie erneut, wenn sich das Web-Host-Tag ändert oder eine neue Abhängigkeit hinzukommt, um zu prüfen, ob genau dieser Specifier extern sein kann.

Die Standalone-`app.html` löst die vollständige kopierte Map auf. Der Hosted-Modus verwendet die Map, die dasselbe gepinnte Release ausliefert.

### `package.json` für dev-proxy verfügbar machen (kanonisches Scaffold)

Die `package.json` jeder Wippy-App trägt Metadaten, die Laufzeit-Defaults bestimmen — Proxy-Injections (`wippy.proxy.injections.css.*`), Theming-Overrides pro Page (`wippy.configOverrides.customization`), Iconify-Icon-Sammlungen usw. Im Hosted-Modus liest der Host diese aus der Registry. Im Host-less-Modus braucht dev-proxy dieselben Daten, um dieselben Defaults anzuwenden.

Das kanonische Muster ist `wippyPagePlugin()` aus der aktuellen kohärenten `@wippy-fe/vite-plugin`-Familie (`0.0.46` zum Publikationszeitpunkt), einmalig in Ihre `vite.config.ts` eingetragen. Das Plugin liest Ihre `package.json` zur Build-Zeit und tut **zwei** Dinge:

1. **Löst `file://`-Referenzen** im `wippy`-Block auf (jeder String-Wert der Form `"file://<relative>"` wird durch den UTF-8-Inhalt der referenzierten Datei ersetzt — siehe die Namenskonvention `*.do-not-link.<ext>` in [build-system.md](./build-system.md)).
2. **Erzeugt zwei Ausgaben** mit dem aufgelösten JSON:
   - In `<head>` injiziertes `<script type="application/json" data-role="@wippy/package">` für den Host-less-/dev-proxy-Boot.
   - `wippy-meta.json` im tatsächlichen Vite-Ausgabeverzeichnis für den Wippy-Hosted-Modus.

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

**Für Web Components** (`view.component`, nur ESM — kein HTML-Entry, in das injiziert werden könnte) verwenden Sie `wippyComponentPlugin()` aus demselben Package. Es erzeugt nur `wippy-meta.json` im tatsächlichen Ausgabeverzeichnis; kein `transformIndexHtml`-Schritt.

```ts
// vite.config.ts für eine Web Component
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
export default defineConfig({ plugins: [wippyComponentPlugin()] })
```

> `wippyPackagePlugin` bleibt ein veralteter Kompatibilitäts-Alias. Neuer Page-Code verwendet `wippyPagePlugin()`; reine Komponenten-Builds verwenden `wippyComponentPlugin()`.

Das Plugin erzeugt dies am Anfang von `<head>` in der gebauten `app.html`:

```html
<script type="application/json" data-role="@wippy/package">
{ "name": "@wippy/your-app", "version": "1.0.0", "wippy": { "proxy": {...}, "configOverrides": {...} } }
</script>
```

dev-proxy.js liest das beim Boot synchron über
`document.querySelector('script[data-role="@wippy/package"]')` und nutzt `wippy.proxy.injections`, um die Proxy-Konfigurations-Defaults zu setzen, sowie `wippy.configOverrides.customization`, um `appConfig.theming.global` zu setzen. Der data-role-String `@wippy/package` wird als `WIPPY_PACKAGE_DATA_ROLE` aus `@wippy-fe/shared` exportiert, damit beide Seiten der Grenze dieselbe Konstante teilen.

Warum diese Form:
- **Keine Duplikation.** `package.json` ist die einzige Wahrheitsquelle — das Plugin liest sie zur Build-Zeit, nichts in Ihrem `src/` referenziert sie.
- **Kein Fetch.** Inline im ausgelieferten HTML — synchron lesbar durch `dev-proxy.js`, bevor irgendein App-Code läuft.
- **Richtige Reihenfolge.** Am Anfang von `<head>` vor jedem Script-Tag injiziert, sodass es im DOM ist, wenn der dev-proxy ausgeführt wird (dev-proxy ist ein synchrones UMD-Skript; Modul-Skripte sind deferred und laufen später).
- **Kein Bearbeiten von `app.html`.** Das Template bleibt sauber; das Plugin besitzt die Injection.
- **Konstante aus dem Shared-Package.** Der String `'@wippy/package'` lebt an genau einer Stelle (`@wippy-fe/shared` → `WIPPY_PACKAGE_DATA_ROLE`); Apps referenzieren ihn nicht direkt, dev-proxy und das Plugin importieren ihn beide von dort.
- **Unter einem echten Host sauber ignoriert.** Das `processWebPage` des Hosts liest `package.json` serverseitig aus der Registry; das Inline-JSON-Tag ist harmlose Metadaten.

dev-proxy liest das JSON während `resolveDevConfig()` und nutzt es, um die Defaults des Dev-Overlays zu füllen. Fehlt das Script-Tag (ältere App, Plugin noch nicht ergänzt), fällt dev-proxy auf `getDefaultProxyConfig()` zurück. Das Hinzufügen des Plugins ist also rein additiv — Apps ohne es funktionieren mit den generischen Defaults weiter.

> **Warum ein Plugin und kein Laufzeit-`window`-Global?** dev-proxy.js ist ein synchrones Nicht-Modul-Skript, das früh beim Parsen von `<head>` läuft — bevor irgendein Modul-Skript (einschließlich Ihrer `app.ts`) geladen ist. `app.ts` kann ein Global also nicht setzen, *bevor* dev-proxy es liest. Eine HTML-Transformation zur Build-Zeit legt die Daten von vornherein ins DOM, verfügbar in dem Moment, in dem dev-proxy ausgeführt wird.

> **Warum ein Tag und nicht zwei?** Ein zweiter `<script>`-Block (z. B. ein `if (!window.__WIPPY__) load dev-proxy`) liefe erst, nachdem die Injection des Hosts abgeschlossen ist; ist der Marker weg, hat die Bedingung nichts, woran sie sich hängen könnte. Das Ein-Tag-Muster bedeutet, dass der Marker *immer* im Quell-HTML steht und die Aufgabe des Hosts genau lautet: "lösche diesen Marker und ersetze ihn". Der Standalone-Fall tritt genau dann ein, wenn ihn niemand gelöscht hat.

Der Host-Vertrag verlangt, dass die in `wippy.path` angegebene HTML-Datei ein Element `<script type="text/javascript" data-role="@wippy/scripts">` enthalten MUSS, in das zusätzliche Skripte automatisch injiziert werden.

Die kanonischen App-Template-Apps werden mit gesetztem `src="…/dev-proxy.js"` ausgeliefert. Das ist die empfohlene Form: **binden Sie immer den `src=`-Fallback ein**, es sei denn, Ihre App kann nicht host-less laufen (selten und begründungswürdig).

---

## Was `dev-proxy.js` tatsächlich tut

`dev-proxy.js` ist das Host-less-Boot-Bundle, ausgeliefert vom Wippy-Web-Host-CDN unter `https://web-host.wippy.ai/<release-tag>/dev-proxy.js`.

Seine Aufgabe ist es, die `@wippy-fe/proxy`-Getter ohne jeden Host korrekt auflösen zu lassen — indem es dieselben internen Globals installiert (`window.$W`, `window.__WIPPY_APP_API__`), die der echte Host installieren würde. App- und WC-Code berührt diese Globals nie; er importiert einfach aus `@wippy-fe/proxy`, und die Getter funktionieren. dev-proxy tut das in grob fünf Schritten:

1. **History-Guard installieren** (`installHistoryGuard()`) — stubt `pushState` / `replaceState`, damit vue-router nicht versucht, die Browser-History außerhalb eines iframe-srcdoc-Kontexts zu verändern.
2. **Eine Konfiguration auflösen** (`resolveDevConfig()` in `src/proxy/dev/resolve-dev.ts`):
   - Liest `localStorage['@wippy-dev/config']` und `localStorage['@wippy-dev/proxy-config']`.
   - Wenn `localStorage['@wippy-dev/auto-accept'] === 'true'` UND eine gespeicherte Konfiguration existiert → sofort verwenden, Overlay im Monitoring-Modus rendern.
   - Andernfalls → Overlay im *Warte*-Modus rendern (FAB pulsiert blau, Sprechblase "Accept config to continue loading") und den Boot blockieren, bis der Entwickler auf Accept klickt.
3. **Eine unechte `ProxyApiInstance` bauen**, verdrahtet mit:
   - Der akzeptierten `ChildAppConfig` (das, was `config` aus `@wippy-fe/proxy` zurückgibt).
   - Einem nanoevents-Emitter für `on(...)`-Subscriptions und `@history`-/`@visibility`-Simulationen.
   - `host`-Stubs, die jede Methode in die Konsole loggen (`createDevHostAPI()` in `src/proxy/dev/host-stubs.ts`).
   - Einer echten axios-Instanz hinter `api` aus `@wippy-fe/proxy`, konfiguriert gegen die vom Entwickler eingegebene URL (`env.APP_API_URL` hat den Default `${location.origin}/api`).
   - Einem Logger-/State-/ws-Stub, der die Form des Produktions-Proxys spiegelt.
4. **CSS-Injection anwenden**, basierend auf der vom Entwickler gewählten Proxy-Konfiguration:
   - `themeConfig: true` → injiziert `theme-config.css` aus `@wippy-fe/theme`.
   - `iframe`, `primevue`, `markdown` → ebenso, die Inline-CSS-Bundles aus `src/proxy/dev/css-inline.ts`.
   - `customCss` / `customVariables` → wendet `appConfig.theming.global.customCSS` / `cssVariables` an (einschließlich der `@dark`/`@light`-Blöcke, beschrieben in [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml)).
5. **Die internen Proxy-Globals installieren** mit derselben Form wie `entry.iframe.ts`, damit die `@wippy-fe/proxy`-Getter (`config`, `host`, `api`, `on`, `logger`, `state`, `ws`, `loadWebComponent`) auflösen. Jeder App- oder WC-Code, der aus `@wippy-fe/proxy` importiert, funktioniert unverändert. (Die Globals selbst — `window.$W` und Co. — sind intern; siehe [Proxy & Isolation § Internals](../web-host/proxy-isolation.md#internals--do-not-read-or-override).)

Standard-`ChildAppConfig` (aus `getDefaultConfig()` in `config-store.ts`):

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

Sie überschreiben all das im Dialog (oder indem Sie `localStorage['@wippy-dev/config']` bearbeiten).

---

## Das Dev-Overlay (Konfigurationsdialog)

Visuell ist das Dev-Overlay eine winzige Shadow-DOM-Web-Component (`<wippy-dev-overlay>`), die rendert:

- Einen FAB (Floating Action Button) in der unteren rechten Ecke — bis zum Klick die einzige sichtbare Affordanz.
- Eine **Sprechblase** im Wartemodus: "Accept config to continue loading."
- Ein **Panel**, das sich beim Klick auf den FAB öffnet. Das Panel hat drei Abschnitte:
  - **Monitor** — Live-Anzeige von aktuellem Pfad, Dokumenttitel und Viewport-Größe; Button "Trigger Refresh", der `@visibility(true)` auslöst, damit die App neu laden kann.
  - **Configuration (einklappbar)**:
    - `App Config (JSON)` — vollständige `ChildAppConfig` als bearbeitbares JSON. Wird bei Accept validiert.
    - `Proxy Injections` — Checkboxen für jedes Proxy-Injection-Flag (`themeConfig`, `iframe`, `primevue`, `markdown`, `customCss`, `customVariables`, `tailwindConfig`, `resizeObserver`, `preventLinkClicks`, `iconifyIcons`, `refreshWhenVisible`, `historyPolyfill`, `errorCapture`).
    - `Options` — Checkbox "Auto-accept on reload" (schreibt das Auto-Accept-Flag in den localStorage).
  - **Footer** — Reset (löscht alle `@wippy-dev/*`-localStorage-Keys), Accept (speichert die Konfiguration und löst das Boot-Promise auf).

Verwendete localStorage-Keys (definiert in `src/proxy/dev/config-store.ts`):

| Key | Was er speichert |
|---|---|
| `@wippy-dev/config` | Die akzeptierte `ChildAppConfig` als JSON |
| `@wippy-dev/proxy-config` | Die akzeptierte partielle `ProxyConfig` (Injection-Flags) |
| `@wippy-dev/auto-accept` | `'true'`, um den manuellen Accept-Schritt beim Reload zu überspringen |

Auto-Accept lässt "gegen einen Host-less-Build iterieren" nahezu nativ wirken: Aktualisieren, die App bootet sofort mit der zuletzt bekannten Konfiguration, der FAB bleibt sichtbar, sodass Sie beobachten oder nachjustieren können.

---

## Host-Stubs — die Standalone-`host`-API

Die `host`-API (`import { host } from '@wippy-fe/proxy'`) ist die Oberfläche, über die die App den Host um Dinge bittet — Toast, Navigation, eine Session öffnen, Kontext setzen, URLs formatieren usw. Ohne echten Host setzt dev-proxy eine Stub-Schicht in `src/proxy/dev/host-stubs.ts` ein:

| Methode | Standalone-Verhalten |
|---|---|
| `host.toast(message)` | Nur Konsolen-Log |
| `host.confirm({ message })` | Browser-`window.confirm()` |
| `host.startChat(token, options)` | Konsolen-Log |
| `host.openSession(uuid, options)` | Konsolen-Log |
| `host.openArtifact(uuid, options)` | Konsolen-Log |
| `host.navigate(url)` | Konsolen-Log + löst `@history` aus, damit der Child-Router es aufnimmt, + aktualisiert die Pfadanzeige im Overlay |
| `host.onRouteChanged(path)` | Konsolen-Log + aktualisiert die Pfadanzeige im Overlay |
| `host.handleError(code, error)` | `console.error` |
| `host.setContext(context, sessionUUID, source)` | Konsolen-Log |
| `host.formatUrl(rel)` | Gibt `${appConfig.routePrefix || ''}${rel}` zurück |
| `host.classifyLink(href)` | Echte Implementierung — nutzt `mountRoutes` / `routePrefix` aus der akzeptierten Konfiguration |
| `host.layout.*` | No-op-Stubs, die den Typvertrag erfüllen |

Die Stubs sind absichtlich gesprächig: Die Konsolenausgabe ersetzt die echten Seiteneffekte des Hosts, damit eine Entwicklerin sehen kann, *was passiert wäre*, ohne den Host tatsächlich zu verdrahten. Hängt die Korrektheit Ihrer App vom Seiteneffekt ab (z. B. dass `host.openSession` tatsächlich eine Session öffnet), testen Sie diesen Pfad unter einem Host; die Stubs leisten das nicht.

---

## Web Components — Host-less-Playground und Tests

Web Components teilen dasselbe Dual-Mode-Design, werden aber als ES-Module statt als iframes geladen. Der Proxy-Vertrag für WCs ist `import { api, host, on, ... } from '@wippy-fe/proxy'` — und dieser Import löst zur Laufzeit auf, indem er `window.__WIPPY_APP_API__` liest (gesetzt entweder vom echten Proxy oder von dev-proxy).

### Playground-/Demo-HTML-Seite

```html
<!-- demo.html in Ihrem WC-Projekt -->
<!DOCTYPE html>
<html>
<head>
    <!-- Das erforderliche vollständige importmap-Skript ist in diesem gekürzten Beispiel weggelassen. -->
    <script src="https://web-host.wippy.ai/webcomponents-1.0.44/dev-proxy.js" data-role="@wippy/scripts"></script>
</head>
<body>
    <my-component prop1="value"></my-component>
    <script type="module" src="./src/index.ts"></script>
</body>
</html>
```

Derselbe Umschaltpunkt, dasselbe Dev-Overlay. Die `index.ts` Ihrer WC ruft `define(import.meta.url, ...)` auf, und das Element registriert sich selbst; dev-proxy stellt die Host-Stubs bereit.

Wenn `dev-proxy.js` nicht lädt (oder Sie vergessen, es einzubinden), wirft `entry.web-component.ts` einen expliziten Fehler:

> `@wippy-fe/proxy: Proxy globals not found. For dev/testing without the Wippy host, add <script src="dev-proxy.js"></script> to your HTML.`

Dieser Fehler ist das kanonische Signal dafür, dass Ihnen das Host-less-Boot-Skript fehlt.

### Vitest-/jsdom-Tests

Für Unit-Tests ist das Dev-Overlay unnötig — Tests haben keine UI zum Interagieren. Das Muster ist, **den Host-Kontext direkt zu fälschen**, indem man das Wrapper-Objekt anhängt, das der Host anhängen würde:

```ts
import { describe, expect, it } from 'vitest'
import { WippyElement } from './base-element'

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

Die Eigenschaft `__wippyHost` ist der Vertrag, den der Managed-Layout-Host verwendet. Tests, die API- oder Proxy-Globals benötigen, können entweder dev-proxy über eine vitest-Setup-Datei einbinden oder `window.__WIPPY_APP_API__` selbst stubben:

```ts
// vitest.setup.ts
;(window as any).__WIPPY_APP_API__ = {
  api: mockApi,
  host: mockHost,
  on: mockOn,
  // ...weitere ProxyApiInstance-Felder
}
```

Beide Ansätze sind "host-less" im selben Sinne wie der Browser-dev-proxy: Der Proxy-Vertrag wird von Code erfüllt, den der Test besitzt, statt von einem echten Wippy-Server.

---

## Häufige Abweichungen und wie man sie erkennt

Wenn eine App oder WC vom standalone-fähigen Vertrag abgedriftet ist, sind die Symptome vorhersehbar:

| Symptom | Wahrscheinliche Ursache | Behebung |
|---|---|---|
| `app.html` hat `<script data-role="@wippy/scripts"></script>` ohne `src=` | Die Page kann nicht host-less booten. Das direkte Laden der Datei ergibt eine leere Seite — die Proxy-Runtime wird nie installiert, also lassen sich `@wippy-fe/proxy`-Imports nicht auflösen. | Fügen Sie dem Tag `src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"` hinzu — die URL verlangt immer ein Release-Tag-Segment. |
| `app.html` hat das dev-proxy-`<script src=…>`, aber **kein `<script type="importmap">`** darüber | Der Browser kann externe Bare Specifier nicht auflösen. Der erste Modul-Skript-Ladevorgang scheitert mit `Failed to resolve module specifier`. | Holen Sie `<release-tag>/import-map.json`, kopieren Sie dessen vollständiges `imports`-Objekt vor dev-proxy in `<head>` und verwenden Sie alle Keys als Rollup-Externals. |
| Der Body von `app.html` hat einen eigenen SVG-Spinner / `<div>Loading…</div>` statt `<wippy-loading title="…">` | Der Pre-Bootstrap-Loader entspricht nicht dem kanonischen Wippy-Idiom. Das eigene Markup bleibt sichtbar, während das WC-Ökosystem (das einen gestylten, theme-fähigen Loader rendern würde) vollständig hochfährt. | Ersetzen Sie es durch `<wippy-loading title="Loading..."></wippy-loading>`. Die Web Component `<wippy-loading>` wird von `dev-proxy.js` registriert (es importiert `@wippy-fe/loading` synchron), bevor der `<body>` geparst wird, sodass das Element auch sehr früh im Seitenaufbau korrekt auflöst. |
| `import` aus den Quelldateien einer Schwester-App | Gemeinsamer Code wird über Modulgrenzen hinweg kopiert. | Extrahieren Sie ihn in ein Workspace-Package oder duplizieren Sie bewusst; greifen Sie nie über App-Ordner hinweg. |
| Fest verdrahtete `fetch('/api/…')`-Aufrufe | Umgeht die axios-Instanz, die der Proxy bereitstellt; nimmt `env.APP_API_URL`-Overrides nicht auf. | Verwenden Sie `useApi()` (Apps) oder `import { api } from '@wippy-fe/proxy'` (WCs). |
| `new EventSource(...)` für Live-Daten | Umgeht die Auth-/Relay-Brücke des Hosts; im Standalone-Modus gibt es kein Äquivalent. | Verwenden Sie `on('your.topic', cb)` — funktioniert in beiden Modi (im Standalone-Modus feuert das Topic nur nicht, wenn Sie es nicht simulieren). |
| `document.documentElement.setAttribute('data-theme', ...)` zum Theme-Wechsel | `data-theme` ist nicht das Wippy-Theme-Protokoll. | Verwenden Sie den Auto-Modus oder die vom Host verwalteten Klassen `.w-theme-light` / `.w-theme-dark`. Konfigurierte `@light`-/`@dark`-Werte unterstützen beide Wege. Siehe [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml). |
| `import '@wippy-fe/theme/theme-config.css'` in `app.ts` | Redundant — der Host injiziert theme-config über die Proxy-Injection `themeConfig: true`. Im Host-less-Modus injiziert dev-proxy es ebenfalls. | Entfernen Sie den Import. |
| Fest verdrahtete API-Basis-URLs in api/-Modulen | Funktioniert im Host-less-Modus gegen eine andere Umgebung nicht. | Lesen Sie sie über `useApi()` aus `appConfig.env.APP_API_URL`. |

---

## Fehlersuche

**Fehler "Proxy globals not found".**
Das WC-Bundle lief, aber weder der echte Proxy noch dev-proxy hat `window.__WIPPY_APP_API__` initialisiert. Prüfen Sie, ob `<script src=".../dev-proxy.js" data-role="@wippy/scripts">` in der Seite steht und die URL erreichbar ist. Im Produktions-Host-Modus bedeutet dieser Fehler, dass der Host proxy.js nicht injizieren konnte — prüfen Sie die Host-Logs.

**Das Dev-Overlay erscheint nie.**
Das Overlay ist ein Shadow-DOM-Custom-Element, das nach `DOMContentLoaded` an `document.body` angehängt wird. Wenn Sie `dev-proxy.js` aus `<head>` laden und der Body fehlt oder `display: none` hat, kann das Overlay nicht rendern. Verschieben Sie das Skript ans Ende des Bodys oder blenden Sie den Body ein.

**Auto-Accept "hängt" mit schlechter Konfiguration.**
Ist die gespeicherte Konfiguration defekt und Auto-Accept aktiv, rendert das Overlay dennoch (im Monitoring-Modus); klicken Sie den FAB → Reset, um alle `@wippy-dev/*`-localStorage-Keys zu löschen, und laden Sie neu.

**Das Theme ist im Dev-Modus falsch.**
Standardmäßig aktiviert `getDefaultProxyConfig()` `customCss` und `customVariables`, deaktiviert aber `themeConfig`, `iframe`, `primevue`, `markdown`. Wenn Ihre App das theme-config-CSS von PrimeVue erwartet, schalten Sie diese Checkboxen im Panel ein. Auto-Accept merkt es sich.

**Importmap-Abweichung zwischen Hosted und Standalone.**
Holen Sie die `import-map.json` des gepinnten Releases erneut, ersetzen Sie das vollständige Host-less-`imports`-Objekt und generieren Sie die Rollup-External-Keys daraus neu. Patchen Sie keine Einzeleinträge und pflegen Sie keine kuratierte Teilmenge.

**WC-Test scheitert mit "host getter returned null".**
Tests müssen `el.__wippyHost = fakeWrapper` setzen, *bevor* `connectedCallback` feuert. Setzen Sie es entweder vor `document.body.appendChild(el)` oder fälschen Sie den Wrapper über das Resolver-Muster, das Ihre Suite verwendet.

---

## Verwandte Dokumente

- [proxy-api.md](./proxy-api.md) — vollständige `@wippy-fe/proxy`-Referenz (funktioniert im Hosted- und Host-less-Modus identisch)
- [micro-frontend-app.md](./micro-frontend-app.md) — Micro-Frontend-Apps bauen (der Boot-Pfad ist das Dual-Mode-`app.html`-Muster, das dieses Dokument beschreibt)
- [web-component.md](./web-component.md) — Web Components bauen (`WippyVueElement`, `define()`, Host-less-Playground/Tests)
- [theming.md](./theming.md) — Theme-Overrides pro Page über `config_overrides` (speisen auch dev-proxy über `theming.global.cssVariables` / `customCSS`)
- [compliance-checklist.md](./compliance-checklist.md) — §9 Host-less-Modus-Checkliste mit vollständigen REJECT-Regeln
