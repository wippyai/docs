# Render-Engines

Der Wippy Web Host rendert eine Micro-Frontend-App (`view.page`) über eine von **zwei Seiten-Render-Engines**. Die Engine ist ein Auslieferungsdetail, das ein Betreiberschalter wählt, mit einem optionalen Override pro Seite. Portable Apps verwenden die Proxy- und Router-APIs von Wippy, sodass ihr Verhalten nicht von einer bestimmten Engine abhängt.

| Engine | Wie eine Seite rendert | Isolation | Routing |
|--------|--------------------|-----------|---------|
| **Iframe** (Standard) | Ein srcdoc-`<iframe>` mit injiziertem `proxy.js` | Vollständige Dokumentisolation | Nur Memory-History (srcdoc hat keine echte URL) |
| **Web Fragment** | Ein [`reframed`](https://web-fragments.dev) Same-Origin-Realm, gespiegelt in einen `<web-fragment>`-Shadow-Root, mit `proxy-fragment.js` | Realm-Isolation, geteilter DOM-Baum | Echte `window.history` (URL-Router funktionieren) |

Beide Engines bieten dieselben Wippy-Anwendungsdienste: authentifizierte API, WebSocket, host-vermittelter State, Confirm-/Brücken-Dialoge, `@history`-/`@visibility`-Events, Titelweitergabe, globale Fehlererfassung, Host-CSS- + Theme-Injektion (einschließlich Dunkel im Shadow), Auto-Höhe im Content-Modus und verschachtelte `<w-artifact>`-Einbettungen. Ihre Fähigkeiten hinsichtlich der Browser-History unterscheiden sich bewusst, wie die Tabelle zeigt.

Verwenden Sie `createAppRouter()` aus `@wippy-fe/router` für eine App, die unter beiden Engines laufen kann. Die aktuelle Factory verwendet Memory-History, erhält ihre anfängliche Route aus `AppConfig.context.route` und synchronisiert sich über `@history` mit dem Host. Ein direkter `createWebHistory()`-Router ist nur für Fragments geeignet und nicht portabel zu iframe- oder `auto`-Deployments, die auf iframe zurückfallen können.

## Wie ein Fragment rendert

Eine `view.page`, die für die Fragment-Engine ausgewählt ist, wird als `<web-fragment src="/@fragment/{id}/">` gemountet. Das [`/@fragment`-Gateway](../../framework/views.md#web-fragments-gateway) in `wippy/views` liefert den Reframing-Vertrag; der `reframed`-Client erzeugt ein verstecktes Same-Origin-Realm-iframe (`wf:<id>`), streamt das vom Gateway transformierte HTML in den Shadow Root des Fragments und führt `proxy-fragment.js` (einen `@wippy-fe/proxy`-Adapter) innerhalb des Realms aus, um die `$W`-Proxy-API bereitzustellen. Weil der Realm dieselbe Origin wie der Host hat, spricht der Proxy direkt mit dem Host statt über `postMessage`.

Dieselbe Seite unter der iframe-Engine ist ein srcdoc-`<iframe>` mit injiziertem `proxy.js` — siehe [Proxy & Isolation](./proxy-isolation.md).

## Die Engine auswählen

### Globaler Schalter (Betreiber)

Die Engine für ein ganzes Deployment ist das Facade-Requirement `render_engine` → `hostConfig.renderEngine`. Der Standard ist `iframe`; nur die exakte Zeichenkette `fragment` schaltet ein Deployment auf die Fragment-Engine um (jeder andere Wert, auch ein Tippfehler, wird als `iframe` behandelt).

```bash
wippy run -c -o wippy.facade:render_engine:default=fragment
```

Siehe [Facade → Render-Engine](../../framework/facade.md#render-engine) für den Parameter.

### Override pro Seite (App-Autor)

Eine Seite entscheidet sich mit `wippy.renderEngine` im `wippy`-Block ihrer `package.json` dafür oder dagegen:

| Wert | Verhalten |
|-------|----------|
| `"auto"` (Standard) | Folgt dem globalen Schalter. |
| `"iframe"` | Rendert immer als srcdoc-iframe — Abwahl von Fragments unabhängig vom Schalter. |
| `"fragment"` | Bevorzugt die Fragment-Engine. Bei einem global auf `fragment` gestellten Deployment: immer. Bei einem global auf `iframe` gestellten Deployment: nur, wenn eine Laufzeitprüfung der Fähigkeiten (`GET /@fragment/{id}/`, pro Sitzung gecacht) bestätigt, dass Gateway und Proxy vorhanden sind; andernfalls Rückfall auf iframe (fail-safe). |

Siehe [Micro-Frontend-Apps → Render-Engine](../frontend-registry/view-page.md#render-engine).

## Beschränkungen von Fragments

Einige Browser-APIs verhalten sich **innerhalb eines reframed Realms falsch — und zwar stillschweigend**. Eine Seite, die von einer davon abhängt, sollte `wippy.renderEngine: "iframe"` pinnen.

| API / Funktion | Verhalten in einem Realm | Auswirkung |
|---------------|---------------------|--------|
| `document.elementFromPoint` | Liefert `null` — **unabhängig von der Panelgröße** | Bricht Pointer-Hit-Testing: Drag & Drop, sortierbare Listen, Popper/floating-ui, virtuelle Scroller |
| `matchMedia`, `vh`/`vw`-Einheiten, `position: fixed` | Werden gegen den **Host**-Viewport aufgelöst, nicht gegen das Fragment-Panel | In einem Panel voller Größe um ~1px daneben; in einem kleinen Panel (Sidebar/Modal) deutlich falsch |
| `window.scrollX/Y`, `scrollTo` | Zielen auf das versteckte Realm-Fenster (immer `0`) | Scroll-gesteuerte UI liest die falsche Geometrie |
| Web Workers, Canvas, WebGL, WASM | **Funktionieren normal** | — |

`vh`/`vw` und `matchMedia` erscheinen hier, weil sie nach dem **Fenster** fragen. Eine App, die sich stattdessen an ihrer zugewiesenen *Surface* bemisst — Container Queries auf `wippy-surface` und die `--wippy-surface-*`-Variablen —, löst unter beiden Engines identisch auf und braucht kein Pinnen. Siehe [Surface-Portabilität](../micro-frontends/surface-portability.md) und [Surface-Migration](../micro-frontends/surface-migration.md), um eine bestehende App umzustellen. `position: fixed` und `elementFromPoint` haben keine portable Form und bleiben echte Gründe zum Pinnen.

Zwei Detektoren machen das zur Autorenzeit sichtbar (sie erkennen *Inkompatibilität des App-Codes*, keine Deployment-Fehler):

- **Zur Build-Zeit** (`@wippy-fe/vite-plugin`): scannt den Seiten-Quellcode und gibt eine Build-**Warnung** aus, die die API benennt und `wippy.renderEngine: "iframe"` vorschlägt.
- **Zur Dev-Laufzeit** (Fragment-Proxy, nur DEV): patcht diese APIs so, dass sie bei einem tatsächlichen Aufruf einmal `console.warn` ausgeben.

## Fragments aktivieren — Zusammenfassung des Setups

Die Fragment-Engine in einer konsumierenden App zu aktivieren erfordert aktuelle Framework-Module plus den Betreiberschalter — keine Router- oder Parameterverdrahtung:

1. **Framework-Module** — verwenden Sie ein aktuelles kompatibles Paar aus `wippy/facade` und `wippy/views`, das den `render_engine`-Schalter und das selbstmountende Fragment-Gateway bereitstellt. Prüfen Sie das exakte Release in der aktuellen Dokumentation der Wippy-Module.
2. **Der Schalter** — setzen Sie das Facade-`render_engine` auf `fragment` (global) oder wählen Sie Seiten einzeln über `wippy.renderEngine` ein.

> Das `/@fragment`-Gateway wird vom aktuellen `wippy/views` selbst bereitgestellt: Das Modul deklariert seinen eigenen Router auf oberster Ebene und bindet ihn an ein `server`-Requirement mit dem Standardwert `app:gateway`. Ein Konsument braucht keine Fragment-Verdrahtung und bootet normal auf der iframe-Engine, ob Fragments aktiviert sind oder nicht; überschreiben Sie den `server`-Parameter nur, wenn Ihre `http.service`-ID von `app:gateway` abweicht. Wählt sich eine Seite in einem ansonsten iframe-basierten Deployment einzeln für Fragments ein, bestätigt eine Laufzeitprüfung der Fähigkeiten das Gateway und `proxy-fragment.js` vor dem Umschalten und bleibt andernfalls auf der iframe-Engine. Der globale Schalter `render_engine: fragment` vertraut dem Betreiber und prüft nicht. Siehe [Views → Web-Fragments-Gateway](../../framework/views.md#web-fragments-gateway).

Die Frontend-App selbst braucht keinen fragmentspezifischen Code; `proxy-fragment.js` ist ein Host-Artefakt, das vom CDN ausgeliefert wird, nichts, was die App bündelt.

## Siehe auch

- [Facade](../../framework/facade.md) — der Betreiberschalter `render_engine` und `hostConfig.renderEngine`
- [Views](../../framework/views.md) — das selbstmountende `/@fragment`-Gateway und seine `server`-Bindung
- [Micro-Frontend-Apps (view.page)](../frontend-registry/view-page.md) — das Feld `wippy.renderEngine` pro Seite
- [Proxy & Isolation](./proxy-isolation.md) — die geteilte Proxy-API (beide Engines) und die iframe-Engine
- [Web-Host-Überblick](./overview.md) — wie der Host Seiten lädt und rendert
