---
title: "Wippy FE debuggen"
description: "Wenn etwas kaputt ist, beginnen Sie hier. Jeder Abschnitt listet die häufigsten Ursachen nach Wahrscheinlichkeit auf, jeweils mit der passenden DevTools-Prüfung."
---

# Wippy FE debuggen

Wenn etwas kaputt ist, beginnen Sie hier. Jeder Abschnitt listet die häufigsten Ursachen nach Wahrscheinlichkeit auf, jeweils mit der passenden DevTools-Prüfung.

## Leerer Bildschirm beim Laden

**1. Prüfen Sie zuerst die Konsole:**
- `Failed to resolve module specifier 'vue'` — die Seite hat einen Specifier externalisiert, den ihre aktive Import-Map nicht bereitstellt. Im gehosteten Modus prüfen Sie die Import-Map, die das Ziel-Web-Host-Release tatsächlich ausliefert; im Host-losen Modus prüfen Sie die Map in `app.html`. Vergleichen Sie jedes Rollup-External gegen genau diese Map, statt eine kanonische Paketliste oder eine Merge-Reihenfolge anzunehmen.
- `Proxy globals not found` (oder Ihre `@wippy-fe/proxy`-Imports kommen undefined zurück) — `proxy.js` / `dev-proxy.js` wurde nicht geladen, bevor Ihr App-Skript lief, sodass die Laufzeit ihre internen Globals nie installiert hat. Prüfen Sie, ob `dev-proxy.js` in `app.html` mit `data-role="@wippy/scripts"` referenziert wird.
- Stilles Hängen (keine Fehler, keine App) — die Konfiguration wird synchron als `window.__WIPPY_APP_CONFIG__` injiziert, bevor `proxy.js` läuft, sodass die Getter von `@wippy-fe/proxy` sofort auflösen (oder `Proxy globals not found` werfen); sie warten nicht auf `SetConfig`. Ein echtes Hängen bedeutet, dass die Laufzeit nie gemountet hat — entweder konnten `proxy.js` / `dev-proxy.js` nicht geladen werden und ihre Globals nicht installieren (siehe den Punkt `Proxy globals not found` oben), oder im Host-losen Modus wartet das Dev-Overlay im Zustand "waiting", weil Sie nicht auf **Accept** geklickt haben. Vergewissern Sie sich, dass der FAB des Dev-Overlays (schwebende Schaltfläche) erschienen ist; wenn nicht, wurde das Proxy-Skript nicht geladen. (Der `SetConfig`/`GetConfig`-Handshake gilt nur für die manuelle Einbettung auf Host-Ebene über `iframe.html?waitForCustomConfig`, nicht für ein gehostetes oder Host-loses Micro-Frontend.)

**2. Prüfen Sie den Network-Tab:**
- Bestätigen Sie, dass `dev-proxy.js` (Host-los) bzw. `proxy.js` (gehostet) mit Status 200 geladen wurde.
- Bei 404: Das `src` in Ihrem `<script data-role="@wippy/scripts">`-Tag zeigt auf die falsche URL.

**3. Prüfen Sie, ob die Laufzeit ihre Globals installiert hat (interne Diagnose):**
```javascript
// Interne Globals — App-Code liest diese nie; das ist nur ein Konsolen-Rauchtest,
// dass die Proxy-Laufzeit gemountet hat. App-/WC-Code nutzt `import { ... } from '@wippy-fe/proxy'`.
window.$W              // sollte ein Objekt sein, nicht undefined
window.__WIPPY_APP_API__ // die aufgelöste Proxy-Instanz — vorhanden, sobald die Laufzeit installiert hat
```
Die Getter von `@wippy-fe/proxy` lesen diese Globals (`window.__WIPPY_APP_API__` ist die aktive Host-Instanz); das ist unabhängig davon, wie die Modul-URL aufgelöst wird. Existieren die Globals, aber die Imports schlagen fehl, prüfen Sie die aktive Import-Map und die Netzwerkantwort für den exakten `@wippy-fe/proxy`-Specifier. Korrigieren Sie die Map oder die Externalisierungsentscheidung in der Umgebung, die die Seite ausliefert; schließen Sie nicht von einem erfolgreichen Host-losen Boot auf das gehostete Verhalten.

## Web Component erscheint nie

**1. Prüfen Sie die drei Tore:**

Führen Sie aus Ihrem Backend aus:
```bash
curl /api/public/components/list?auto_register=true
```
Der `tag_name` Ihrer Komponente muss in der Antwort erscheinen. Wenn nicht:
- `announced: true` fehlt in `_index.yaml` → hinzufügen
- `auto_register: true` fehlt → hinzufügen
- Die Komponente ist nicht bei `wippy/views` registriert → prüfen Sie Ihre Modul-Abhängigkeiten

**2. Prüfen Sie die Konsole:**
```javascript
customElements.get('your-tag-name')  // undefined heißt, das Element wurde nicht registriert
```

**3. Prüfen Sie den Network-Tab:**
- Filtern Sie nach der `index.js`-URL Ihrer Komponente
- Die URL sollte `?declare-tag=your-tag-name` enthalten — so registriert sich das Element selbst
- Fehlt der Query `?declare-tag=` in der URL: `define(import.meta.url, MyElement)` lag nicht im Entry-Chunk. Das ist das `preserveEntrySignatures: false`-Problem — siehe [Build-System](./build-system.md)

## API-Aufrufe schlagen fehl / 401

**1. Im Host-losen Modus:**
- Der `dev-token`-Stub in der Proxy-Konfiguration ist keine echte Zugangsberechtigung — er erhält von einem echten Backend immer 401
- Öffnen Sie das Dev-Overlay → finden Sie das Feld `auth.token` in der JSON-Konfiguration → fügen Sie ein echtes Bearer-Token ein
- Bestätigen Sie, dass `APP_API_URL` in der Overlay-Konfiguration auf das laufende Backend zeigt (nicht auf localhost, wenn Ihr Backend anderswo läuft)

**2. Im gehosteten Modus:**
- Behandeln Sie 401, indem Sie `host.handleError('auth-expired', error)` aufrufen — das löst den Re-Authentifizierungsfluss des Hosts aus
- Wenn alle API-Aufrufe mit 401 antworten: Prüfen Sie, ob das Session-Token des Hosts korrekt injiziert wird (der Proxy erledigt das automatisch über `api.get(...)`)

## Theme sieht falsch aus

**1. Im Host-losen Modus:**
Das Dev-Overlay startet mit den Injektionen `themeConfig`, `primevue`, `markdown` und `iframe` **standardmäßig deaktiviert**. Ihre App rendert ohne jegliches Plattform-CSS, bis Sie sie aktivieren.

Öffnen Sie den FAB des Dev-Overlays → schalten Sie die benötigten CSS-Injektionen ein → aktivieren Sie "Auto-accept on reload".

**2. Vergleichen Sie die vollständige effektive Kette:**

Ein nicht leeres Token genügt nicht. Verwenden Sie unterscheidbare Werte, damit ein Zurücksetzen auf die Standardpalette oder ein versehentlicher Familien-Alias offensichtlich wird:

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

Vergleichen Sie dann in dieser Reihenfolge:

1. **Effektive konfigurierte Map:** Prüfen Sie `config.theming.global.cssVariables` und bestätigen Sie die Basis plus die aktiven `@light`/`@dark`-Ersetzungen.
2. **Seiten-Root:** Lesen Sie das exakte Token mit `getComputedStyle(document.documentElement).getPropertyValue(name).trim()`.
3. **WC-Host:** Lesen Sie dasselbe Token aus `getComputedStyle(customElement)`.
4. **Innerer WC-Root:** Lesen Sie es aus `getComputedStyle(customElement.shadowRoot.querySelector('[data-wippy-theme-root]'))`.
5. **Gerenderte semantische Farbe:** Setzen Sie `background-color: var(--p-<family>-color)` auf eine Sonde und vergleichen Sie deren berechnete `backgroundColor`; das löst `color-mix()` physisch auf.

Wiederholen Sie das in Auto-hell, Auto-dunkel, erzwungen Hell und erzwungen Dunkel. Prüfen Sie für jede konfigurierte Familie ihre Basis, alle Abstufungen 50–950, `color`, `contrast-color`, `hover-color` und `active-color`; prüfen Sie außerdem ein direktes Shade-/Alias-Override, ein Surface-Token und den Sentinel. Werte von Seite, Host und innerem Root müssen übereinstimmen.

Interpretieren Sie die erste Abweichung: eine falsche effektive Map bedeutet Konfiguration/Merge; ein falscher Seiten-Root bedeutet Variablenkompilierung/-injektion; korrekte Seite, aber falscher WC-Host bedeutet Host-Weitergabe; korrekter WC-Host, aber falscher innerer Root bedeutet die Brücke für das erzwungene Theme oder lokale Standardwerte; gleiche Tokens, aber falsche gerenderte Farbe bedeutet, dass der konsumierende Selektor oder der semantische Alias falsch ist.

**3. Spezifisch für Web Components:**
- Fehlen die Plattform-Standardwerte, prüfen Sie, ob `hostCssKeys` den Eintrag `'themeConfigUrl'` enthält.
- Ist der Host korrekt, aber der innere Root fällt auf Standardwerte zurück, stellen Sie ein aktuelles `@wippy-fe/webcomponent-core` sicher; kopieren Sie keine Palette in Komponenten-CSS.
- Rendern PrimeVue-Komponenten ohne Styling, fügen Sie `'primeVueCssUrl'` zu `hostCssKeys` hinzu.

Siehe [Theming: Micro-Frontend-Apps](./micro-frontend-app-theming.md) oder [Theming: Web Components](./web-component-theming.md) für die vollständige Injektions-Pipeline.

## Die URL-Leiste des Hosts aktualisiert sich nicht

Portable Micro-Frontend-Apps müssen die Factory `createAppRouter()` aus `@wippy-fe/router` verwenden. Das Paket besitzt beide Richtungen der Host-Synchronisation; Anwendungscode darf `router.afterEach` und die `@history`-Verdrahtung nicht nachbauen.

**Prüfen:**
```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
})
```

Aktualisiert sich die Host-URL weiterhin nicht, stellen Sie sicher, dass die aktuelle `@wippy-fe/router`-Familie stimmig installiert ist und kein lokaler Wrapper die Factory ersetzt. Im Host-losen Modus zeigt der Monitor-Tab des Dev-Overlays die Route, die das Paket meldet.

## Funktioniert lokal, bricht im gehosteten Betrieb

**1. Prüfen Sie `document.baseURI`:**
```javascript
document.baseURI  // sollte <url>/<base_path>/ aus Ihrem Registry-Eintrag sein
```
Wenn leer oder falsch: Das `<base>`-Tag wurde nicht injiziert. Prüfen Sie, ob `base_path` in `_index.yaml` zur tatsächlichen Verzeichnisstruktur Ihres Build-Ergebnisses passt.

**2. Prüfen Sie die Proxy-Globals (interne Diagnose):**
```javascript
window.__WIPPY_PROXY_CONFIG__  // intern — muss im iframe-gehosteten Modus existieren
```
Undefined bedeutet, dass der Proxy nicht injiziert wurde, bevor Ihre App lief. App-Code liest das nie direkt; siehe [Proxy & Isolation § Interna](../web-host/proxy-isolation.md#internals--do-not-read-or-override).

**3. Bestätigen Sie `base: ''` in vite.config.ts:**
Ohne `base: ''` gibt Vite absolute Asset-Pfade aus. Die App lädt auf Ihrem lokalen Dev-Server (der von `/` ausliefert) einwandfrei, liefert aber 404, wenn sie aus einem CDN-Unterverzeichnis ausgeliefert wird.

**4. Import-Map stimmt nicht überein:**
Holen Sie `<version-tag>/import-map.json` erneut vom Web-Host-Release, das durch
`fe_facade_url` gepinnt ist. Ersetzen Sie das vollständige `imports`-Objekt in der Host-losen
`app.html` und erzeugen Sie die Vite-Externals aus allen ihren Schlüsseln neu. Entfernen Sie die
Host-lose Map nicht und patchen Sie keine einzelnen Einträge. Bündeln Sie einen neu importierten
exakten Specifier nur dann, wenn er in der geholten Map fehlt.

## Den Logger als Debugging-Werkzeug nutzen

Die Ausgabe von `logger.debug()` und `logger.info()` erscheint während der Entwicklung in der Browser-Konsole — nicht nur in Produktions-Transports. Nutzen Sie sie, um die Boot-Sequenz nachzuverfolgen:

```typescript
import { logger, config, host, api } from '@wippy-fe/proxy'

export function createMainApp() {
  logger.debug('App bootstrap started')
  logger.debug('Host services resolved', { hasConfig: !!config })
  // ... config, host, api direkt verwenden
}
```

`logger.captureException(error)` loggt im Dev-Modus ebenfalls in die Konsole und wird in der Produktion vom Error-Capture-System des Hosts erfasst.
