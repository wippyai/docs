---
title: "Wippy FE debuggen"
description: "DevTools-Prüfungen für häufige Start-, Komponenten-, API-, Theme-, Routing- und Hosted-Runtime-Fehler."
---

# Wippy FE debuggen

Mit diesen Prüfungen lassen sich häufige Frontendfehler eingrenzen, bevor
Anwendungscode geändert wird.

## Leerer Bildschirm beim Laden

**1. Zuerst die Konsole prüfen:**

- `Failed to resolve module specifier 'vue'`: Ein externalisierter Specifier fehlt in der aktiven Import Map. Prüfen Sie hosted die tatsächlich vom Zielrelease gelieferte Map, Host-less die Map in `app.html`, und vergleichen Sie jeden Rollup-External exakt.
- `Proxy globals not found` oder undefinierte Proxy-Importe: `proxy.js` / `dev-proxy.js` lief nicht vor dem Appskript. Prüfen Sie in `app.html` den Marker `data-role="@wippy/scripts"`.
- Stiller Stillstand: Im Host-less-Modus wartet das Overlay möglicherweise auf **Accept**. Fehlt der FAB, konnte die Proxy-Runtime nicht geladen oder installiert werden.

Hosted-iframe und Host-less erhalten Konfiguration synchron vor dem Proxy.
Web Fragment verwendet den `GetConfig`/`SetConfig`-Handshake des Adapters,
ebenso die manuelle Host-Einbettung `iframe.html?waitForCustomConfig`.

**2. Network-Tab:**

- `dev-proxy.js` oder `proxy.js` muss Status 200 haben.
- Bei 404 zeigt `src` im Skriptmarker auf die falsche URL.

**3. Interne Globals als Diagnose prüfen:**

```javascript
// Internal globals — app code never reads these; this is only a console smoke test
// that the proxy runtime mounted. App/WC code uses `import { ... } from '@wippy-fe/proxy'`.
window.$W              // should be an object, not undefined
window.__WIPPY_APP_API__ // the resolved proxy instance — present once the runtime installed
```

Existieren die Globals, aber Importe scheitern, prüfen Sie aktive Import Map
und Netzwerkantwort des exakten `@wippy-fe/proxy`-Specifiers. Korrigieren Sie
Map oder Externalisierung in der ausliefernden Umgebung; ein Host-less-Erfolg
beweist kein Hosted-Verhalten.

## Web Component erscheint nicht

**1. Drei Gates prüfen.** Vom Backend aus:

```bash
curl /api/public/components/list?auto_register=true
```

`tag_name` muss in der Antwort stehen. Andernfalls fehlen `announced: true`,
`auto_register: true` oder die Registrierung über `wippy/views`.

**2. Konsole:**

```javascript
customElements.get('your-tag-name')  // undefined means the element was not registered
```

**3. Network-Tab:** Die URL von `index.js` muss
`?declare-tag=your-tag-name` enthalten. Fehlt die Query, wurde
`define(import.meta.url, MyElement)` nicht im Entry-Chunk bewahrt. Setzen Sie
`build.rollupOptions.preserveEntrySignatures` auf `'strict'`; siehe
[Build- und Abhängigkeitsvertrag](./build-system.md).

## API-Aufrufe schlagen fehl / 401

**Host-less:** Der Stub `dev-token` ist kein echtes Credential. Ersetzen Sie
`auth.token` im Overlay durch ein echtes Bearer-Token und prüfen Sie, dass
`APP_API_URL` auf das laufende Backend zeigt.

**Hosted:** Verwenden Sie den Proxy-Client `api`. Für geeignete Same-Origin-401
führt er Single-Flight aus und ruft automatisch
`host.handleError('auth-expired', error)` auf. Bei flächendeckenden 401 prüfen
Sie Hostkonfiguration und Session-Token-Injektion. Manueller Fehleraufruf ist
nur für bewusst am Standardclient vorbeigeführte Requests nötig.

## Theme sieht falsch aus

Im Host-less-Overlay sind `themeConfig`, `primevue`, `markdown` und `iframe`
anfangs deaktiviert; `customCss` und `customVariables` bleiben aktiv. Schalten
Sie benötigte Injektionen ein und aktivieren Sie „Auto-accept on reload“.

Vergleichen Sie die vollständige Kette mit deutlich unterschiedlichen Werten:

```yaml
css_variables:
  "--p-primary": "#dc2626"
  "--p-secondary": "#7c3aed"
  "--p-accent": "#0d9488"
  "--p-danger": "#be123c"
  "--p-success": "#15803d"
  "--p-warn": "#c2410c"
  "--p-info": "#0369a1"
  "--p-help": "#9333ea"
  "--theme-diagnostic-sentinel": "#123456"
```

1. Effektive Map `config.theming.global.cssVariables` samt aktiver `@light`-/`@dark`-Ersetzungen.
2. Seiten-Root über `getComputedStyle(document.documentElement)`.
3. WC-Host über `getComputedStyle(customElement)`.
4. WC-Inner-Root über `[data-wippy-theme-root]`.
5. Gerenderte semantische Farbe eines Probes mit `var(--p-<family>-color)`.

Wiederholen Sie dies für Auto-Hell/Dunkel und erzwungen Hell/Dunkel. Prüfen Sie
je Familie Basis, Abstufungen 50–950, `color`, `contrast-color`, `hover-color`,
`active-color`, außerdem direkte Shade-/Alias-Überschreibung, Surface und Sentinel.
Die erste Abweichung lokalisiert Map-Merge, Seiteninjektion, WC-Weitergabe,
Inner-Root-Bridge oder konsumierenden Selektor.

Für Web Components: `themeConfigUrl` liefert Plattformstandards,
`primeVueCssUrl` PrimeVue-Styles. Ein aktuelles `@wippy-fe/webcomponent-core`
muss konfigurierte Werte in den Inner Root überbrücken; kopieren Sie keine Palette.

Die vollständige Injektionspipeline beschreiben [Theming für Micro-Frontend-Anwendungen](./micro-frontend-app-theming.md) und [Theming für Web Components](./web-component-theming.md).

## Host-Adresszeile aktualisiert sich nicht

Portable Apps verwenden `createAppRouter()` aus `@wippy-fe/router`; das Paket
besitzt beide Synchronisierungsrichtungen. Anwendungscode darf
`router.afterEach` und `@history` nicht nachbauen.

```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
})
```

Prüfen Sie bei weiterhin fehlender Aktualisierung eine zusammengehörige
Paketfamilie und dass kein lokaler Wrapper die Factory ersetzt. Host-less zeigt
der Monitor-Tab die gemeldete Route.

## Lokal erfolgreich, hosted defekt

**Relative Assets:** Bei iframe muss `document.baseURI` auf
`<url>/<base_path>/` zeigen:

```javascript
document.baseURI  // should be <url>/<base_path>/ from your registry entry
```

Bei Fehler muss `base_path` zur Buildstruktur passen. Web Fragment injiziert
kein `<base>`; relative `href="./…"` und `src="./…"` müssen auf Gateway-URLs
umgeschrieben sein.

**Proxy-Diagnose:**

```javascript
window.__WIPPY_PROXY_CONFIG__  // internal — must exist in iframe-hosted mode
```

Undefiniert bedeutet, dass der Proxy nicht rechtzeitig injiziert wurde.
Anwendungscode liest das Global nie; siehe
[Proxy und Isolation § Interna](../web-host/proxy-isolation.md#interna-nicht-lesen-oder-überschreiben).

**Vite:** Ohne `base: ''` erzeugt Vite absolute Assetpfade, die lokal
funktionieren, aber im CDN-Unterverzeichnis 404 liefern.

**Import Map:** Rufen Sie `<version-tag>/import-map.json` des durch
`fe_facade_url` fixierten Hosts erneut ab, ersetzen Sie das vollständige
`imports`-Objekt in `app.html` und erzeugen Sie Externals aus allen Schlüsseln.
Patchen Sie keine Einzeleinträge.

## Logger zur Diagnose

`logger.debug()` und `logger.info()` erscheinen während der Entwicklung in der
Browserkonsole:

```typescript
import { logger, config, host, api } from '@wippy-fe/proxy'

export function createMainApp() {
  logger.debug('App bootstrap started')
  logger.debug('Host services resolved', { hasConfig: !!config })
  // ... use config, host, api directly
}
```

`logger.captureException(error)` schreibt im Dev-Modus ebenfalls in die Konsole
und wird in Produktion vom Fehlererfassungssystem des Hosts aufgenommen.
