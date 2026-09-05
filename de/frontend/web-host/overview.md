---
title: "Web-Host-Überblick"
description: "Der Wippy Web Host ist eine Vue-3-Single-Page-Anwendung, gebaut nach der Feature-Sliced-Design-Methodik und ausgeliefert von einem CDN unter…"
---

# Web-Host-Überblick

Der Wippy Web Host ist eine Vue-3-Single-Page-Anwendung, gebaut nach der Feature-Sliced-Design-Methodik und ausgeliefert von einem CDN unter `https://web-host.wippy.ai`. Er hostet alle benutzerseitigen Pages und UI-Komponenten einer Wippy-Anwendung. Sie bauen oder deployen ihn nicht — Sie konfigurieren ihn über das Backend-Modul `wippy/facade`, und er lädt automatisch.

![Wippy FE architecture](../diagrams/fe-arch-overview.svg)

## Drei-Schichten-Modell

Eine laufende Wippy-Anwendung besteht aus drei ineinandergeschachtelten Schichten:

**Schicht 1 — Seite, ausgeliefert von `wippy/facade`.** Das ist Ihre backend-gerenderte HTML-Seite. Das Modul `wippy/facade` registriert einen statischen Dateiserver und einen `/facade/config`-Endpoint an Ihrem Wippy-Gateway. Wenn ein Nutzer zu Ihrer Anwendung navigiert, liefert `wippy/facade` eine dünne HTML-Seite aus, die den Web-Host-JS-Modul-Einstieg vom CDN lädt (`module.js` für Compat, `managed-layout.js` für Managed) und ihn mit der Konfiguration von `/facade/config` initialisiert. Die Seite selbst enthält weder Vue noch React — sie ist absichtlich dünn.

**Schicht 2 — Web Host.** Das Web-Host-Bundle lädt als JS-Modul, das die gesamte Seite und ihre Browser-History übernimmt. Ihm gehört die Wippy-Chrome: Navigations-Seitenleiste, Chat-Panel, Session-Verwaltung und die Rendering-Fläche für Pages. Er erhält seine vollständige Konfiguration aus dem Init-Aufruf der Seite und enthält im Bundle selbst niemals deploymentspezifische URLs oder Tokens. Das macht das CDN-gehostete Bundle über Deployments hinweg portabel. (Für manuelle Einbettungen ohne Facade kann derselbe Host stattdessen über den `iframe.html`-Einstieg in einem iframe laufen — siehe die Einstiegspunkt-Tabelle unten.)

**Schicht 3 — Child-Micro-Frontends.** Der Web Host bettet seinerseits benutzerdefinierte Views entweder als verschachtelte iframes (`view.page`-Module) oder als Web Components (`view.component`-Module) ein. Jedes Child läuft isoliert. Der Web Host injiziert ein Proxy-Skript, das Children Zugriff auf die Wippy-API, den Authentifizierungskontext, Theme-CSS und Kommunikationskanäle gibt — ohne dass das Child wissen muss, wo es deployed ist.

```
Seite (wippy/facade-HTML — lädt module.js / managed-layout.js)
  └─ Web Host (übernimmt die Seite + Browser-History)
       ├─ Chat-UI, Navigation, Seitenleiste
       └─ Child-Micro-Frontends
            ├─ view.page  → srcdoc-iframe + proxy.js
            └─ view.component → Custom Element + @wippy-fe/proxy ESM
```

## Einstiegspunkte

Das Web-Host-CDN liefert mehrere Einstiegspunkte aus demselben versionierten Verzeichnis. Welcher der richtige ist, hängt von Ihrer Integration ab:

Jeder Einstieg wird vom CDN unter `<release-tag>/<entry>` ausgeliefert (z. B. `/<release-tag>/module.js`).

| Einstieg | Anwendungsfall |
|-------|----------|
| `module.js` | Vollständige App im **Compat**-Modus — die Standard-Shell aus Navigations-Seitenleiste + Page-Bereich + rechtem Chat-Panel. Wird über `window.initWippyApp()` direkt in die Seite gemountet; übernimmt die gesamte Seite und ihre Browser-History. Diesen Einstieg liefert das aktuelle `wippy/facade` standardmäßig aus. |
| `managed-layout.js` | Vollständige App im **Managed**-Modus — das deklarative Multi-Panel-Layout. Von der Facade ausgeliefert, wenn `fe_mode = managed`. Early Access (siehe [Multi-Panel Layout](./multi-panel-layout.md)). |
| `iframe.html` | Vollständige App **innerhalb eines iframes** für Isolation oder teilweise Seiteneinbettung. Verwenden Sie sie für manuelle Einbettungen ohne Facade, bei denen Sie die Konfiguration über einen `SetConfig`-PostMessage-Handshake liefern. Die Facade selbst lädt die obigen JS-Modul-Einstiege, nicht diesen. |
| `chat-iframe.html` | Minimale Chat-Oberfläche ohne Seitenleiste oder Pages. Nützlich, um ein fokussiertes Chat-Widget einzubetten. |
| `chat.js` | Headless-ESM-Modul, das Chat-Stores und WebSocket-Client bereitstellt. Für vollständig eigene UIs. |
| `ws.js` | Eigenständiger WebSocket-Dienst ohne Vue- oder Pinia-Abhängigkeit. Für Low-Level-Echtzeit-Integrationen. |

Bei Standard-Deployments auf `wippy/facade`-Basis referenzieren Sie diese Pfade nie direkt. Die Facade liest `fe_facade_url` aus ihrer Konfiguration, wählt den JS-Modul-Einstieg, der zu `fe_mode` passt (`module.js` für Compat, `managed-layout.js` für Managed), und baut die korrekte URL automatisch.

## CDN-Versionierung

Der Web Host wird per Git-Tag versioniert. Das kanonische Produktions-URL-Muster lautet:

```
https://web-host.wippy.ai/<release-tag>/
```

Dabei ist `<release-tag>` das Git-Release-Tag des Web Hosts — entweder ein stabiles Release oder ein Vorschau-Deploy eines Feature-Branches. Das Staging-CDN liegt unter `https://web-host.staging.wippy.ai/<release-tag>/`.

Normalerweise setzen Sie die Version gar nicht. Das Modul `wippy/facade` wird mit einer Standard-`fe_facade_url` ausgeliefert, die auf einen passenden Web-Host-Build zeigt, sodass **die Web-Host-Version mit dem Facade-Modul wandert** — ein Update von `wippy/facade` ist der Weg zu einem neueren Web Host. Child-Apps, die Vendor-Bibliotheken über die Import Map teilen, erhalten genau die Versionen, die dieser Build liefert.

Um eine bestimmte Web-Host-Version zu pinnen — um auf einem als gut bekannten Build zu bleiben oder ein Feature-Branch-/Early-Access-Tag zu wählen —, überschreiben Sie den Parameter `fe_facade_url`:

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

Das pinnt das gesamte Deployment auf diesen Build. Siehe [CLI overrides](../../guides/cli.md) für die `-o`- / `--override`-Syntax, um ihn stattdessen zur Laufzeit zu setzen.

## Tech-Stack

Der Web Host ist mit Vue 3 (Composition API), PrimeVue + Tailwind CSS 3 für UI-Komponenten, Pinia für State Management, Vue Router für Navigation und Axios für HTTP gebaut. Holen Sie während der Entwicklung `<fe_facade_url>/import-map.json` und setzen Sie jeden Key aus dessen `imports`-Objekt in die Rollup-Externals, auch wenn das aktuelle Artefakt diesen Key nicht importiert. Bundeln Sie eine importierte Abhängigkeit nur, wenn ihr exakter Specifier fehlt. Holen Sie sie erneut, wenn sich das Web-Host-Tag ändert oder eine neue Abhängigkeit hinzukommt.

## Siehe auch

- [Facade Entry Point](./entry-point.md) — wie die Facade den Web Host an Nutzer ausliefert und wie der Konfigurationsfluss aussieht
- [Bootstrap Sequence](./bootstrap.md) — was im Web Host passiert, nachdem er die Konfiguration erhalten hat
- [Multi-Panel Layout](./multi-panel-layout.md) — Managed-Layout-Modus für eigene Multi-Panel-Shells
- [Packages](./packages.md) — die `@wippy-fe/*`-npm-Packages, die Entwicklern von Child-Apps zur Verfügung stehen
- [Facade module](../../framework/facade.md) — Backend-Einrichtung für `wippy/facade`
- [Render Engines](./render-engines.md) — die beiden Page-Render-Engines (srcdoc-iframe vs. Web Fragment)
