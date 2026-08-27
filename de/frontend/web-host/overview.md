---
title: "Web-Host-Übersicht"
description: "Wie der CDN-gehostete Web Host, die Facade-Seite und untergeordnete Micro Frontends in einer Wippy-Anwendung zusammenspielen."
---

# Web-Host-Übersicht

Diese Seite ist eine Architekturreferenz. Sie erklärt Deployment-Grenzen und Einstiegspunkte; die Einrichtung wird in den verlinkten Facade- und Micro-Frontend-Leitfäden beschrieben.

Der Wippy Web Host ist eine mit der Methodik Feature-Sliced Design erstellte Vue-3-Single-Page-Anwendung, die über `https://web-host.wippy.ai` ausgeliefert wird. Er hostet die benutzersichtbaren Seiten und UI-Komponenten einer Wippy-Anwendung. Konfigurieren Sie ihn über das Backend-Modul `wippy/facade`; Sie bauen oder deployen ihn nicht zusammen mit der Anwendung.

![Wippy FE architecture](../diagrams/fe-arch-overview.svg)

## Drei-Schichten-Modell

Eine laufende Wippy-Anwendung besteht aus drei verschachtelten Schichten:

**Schicht 1 — von `wippy/facade` ausgelieferte Seite.** Dies ist Ihre vom Backend gerenderte HTML-Seite. Das Modul `wippy/facade` registriert einen statischen Dateiserver und einen Endpunkt `/facade/config` an Ihrem Wippy-Gateway. Beim Aufruf der Anwendung liefert `wippy/facade` eine schlanke HTML-Seite aus, die den JS-Modul-Entry des Web Hosts vom CDN lädt (`module.js` für Compat, `managed-layout.js` für Managed) und ihn mit der Konfiguration aus `/facade/config` initialisiert. Die Seite selbst enthält weder Vue noch React und ist bewusst schlank.

**Schicht 2 — Web Host.** Das Web-Host-Bundle wird als JS-Modul geladen und übernimmt die gesamte Seite sowie ihren Browserverlauf. Es verwaltet Wippys Chrome: Navigation, Chat, Sitzungsverwaltung und die Renderoberfläche für Seiten. Seine vollständige Konfiguration erhält es vom Initialisierungsaufruf der Seite; es enthält keine Deployment-spezifischen URLs oder Tokens. Dasselbe CDN-Bundle kann dadurch verschiedene Deployments bedienen. Für manuelle Einbettungen ohne Facade kann der Host über den unten beschriebenen Entry `iframe.html` in einem iframe laufen.

**Schicht 3 — untergeordnete Micro Frontends.** Der Web Host rendert `view.page`-Module über die konfigurierte Page Engine: einen älteren srcdoc-iframe oder ein Web Fragment. `view.component`-Module mountet er als Custom Elements. Die iframe-Engine bietet einen getrennten Browsing Context. Ein Web Fragment verwendet einen Reframed-Realm, der in das Host-Dokument gespiegelt wird, und stellt keine Isolationsgrenze dar; der Shadow Root einer Komponente isoliert Selektoren, nicht Autorität. Jede Oberfläche erhält den passenden Proxy-Adapter für Wippy-API-Zugriff, Authentifizierungskontext, Theme-Auslieferung und Kommunikation, ohne Deployment-spezifische URLs zu benötigen.

```
Page (wippy/facade HTML — loads module.js / managed-layout.js)
  └─ Web Host (takes over the page + browser history)
       ├─ Chat UI, navigation, sidebar
       └─ Child micro-frontends
            ├─ view.page → srcdoc iframe or Web Fragment + proxy adapter
            └─ view.component → custom element + @wippy-fe/proxy ESM
```

## Einstiegspunkte

Das Web-Host-CDN liefert mehrere Entries aus demselben versionierten Verzeichnis. Wählen Sie den zur Integration passenden Entry. Jeder ist unter `<release-tag>/<entry>` verfügbar, etwa `/<release-tag>/module.js`.

| Entry | Anwendungsfall |
|-------|----------------|
| `module.js` | Vollständige Anwendung im **Compat**-Modus — die Standard-Shell aus Navigationsseitenleiste, Seitenbereich und rechtem Chatpanel. Wird über `window.initWippyApp()` direkt in die Seite gemountet und übernimmt gesamte Seite sowie Browserverlauf. Diesen Entry liefert die aktuelle `wippy/facade` standardmäßig aus. |
| `managed-layout.js` | Vollständige Anwendung im **Managed**-Modus — das deklarative Multi-Panel-Layout. Wird von der Facade bei `fe_mode = managed` ausgeliefert. Early Access; siehe [Multi-Panel-Layout](./multi-panel-layout.md). |
| `iframe.html` | Vollständige Anwendung **innerhalb eines iframe** zur Isolation oder Einbettung in einen Teil der Seite. Für manuelle Einbettungen ohne Facade, bei denen Sie die Konfiguration per `SetConfig`-PostMessage-Handshake bereitstellen. Die Facade selbst lädt die obigen JS-Modul-Entries, nicht diesen. |
| `chat-iframe.html` | Minimale Chatoberfläche ohne Seitenleiste oder Seiten. Für einen fokussierten eingebetteten Chat-Widget. |
| `chat.js` | Headless-ESM-Modul mit Chat-Stores und WebSocket-Client. Für vollständig benutzerdefinierte Oberflächen. |
| `ws.js` | Eigenständiger WebSocket-Dienst ohne Vue- oder Pinia-Abhängigkeit. Für Low-Level-Echtzeitintegrationen. |

Bei normalen Deployments mit `wippy/facade` referenzieren Sie diese Pfade nie direkt. Die Facade liest `fe_facade_url` aus ihrer Konfiguration, wählt den zu `fe_mode` passenden JS-Modul-Entry (`module.js` für Compat, `managed-layout.js` für Managed) und konstruiert automatisch die richtige URL.

## CDN-Versionierung

Der Web Host wird nach Git-Tag versioniert. Das kanonische Muster der Produktions-URL lautet:

```
https://web-host.wippy.ai/<release-tag>/
```

`<release-tag>` ist der Git-Release-Tag des Web Hosts — entweder ein stabiles Release oder ein Preview-Deployment eines Feature-Branches. Das Staging-CDN liegt unter `https://web-host.staging.wippy.ai/<release-tag>/`.

Normalerweise wählt `wippy/facade` die Version über seinen Standardwert `fe_facade_url`, der auf einen passenden Web-Host-Build zeigt. Eine Aktualisierung von `wippy/facade` verschiebt das Deployment daher auf die entsprechende Web-Host-Version. Kindanwendungen, die Bibliotheken über die Import Map teilen, erhalten die von diesem Build bereitgestellten Versionen.

Um eine bestimmte Web-Host-Version festzulegen — für einen bekanntermaßen funktionierenden Build oder einen Feature-Branch-/Early-Access-Tag — überschreiben Sie `fe_facade_url`:

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

Dies fixiert das gesamte Deployment auf diesen Build. Die Syntax `-o` / `--override` zur Laufzeit beschreibt [CLI-Überschreibungen](../../guides/cli.md).

## Technologie-Stack

Der Web Host verwendet Vue 3 mit Composition API, PrimeVue + Tailwind CSS 3 für UI-Komponenten, Pinia für Zustandsverwaltung, Vue Router für Navigation und Axios für HTTP.

### Externalisierung von Kindabhängigkeiten

Rufen Sie während der Entwicklung `<fe_facade_url>/import-map.json` ab und nehmen Sie jeden Schlüssel aus dessen Objekt `imports` in die Rollup-Externals auf, auch wenn das aktuelle Artefakt ihn nicht importiert. Bündeln Sie eine importierte Abhängigkeit nur, wenn ihr genauer Specifier fehlt. Rufen Sie die Datei erneut ab, wenn sich der Web-Host-Tag ändert oder eine neue Abhängigkeit hinzukommt.

## Siehe auch

- [Facade-Einstiegspunkt](./entry-point.md) — Auslieferung des Web Hosts durch die Facade und Konfigurationsfluss
- [Bootstrap-Ablauf](./bootstrap.md) — Vorgänge im Web Host nach Empfang der Konfiguration
- [Multi-Panel-Layout](./multi-panel-layout.md) — Managed-Layout-Modus für benutzerdefinierte Multi-Panel-Shells
- [Pakete](./packages.md) — für Kindanwendungen verfügbare npm-Pakete `@wippy-fe/*`
- [Facade-Modul](../../framework/facade.md) — Backend-Einrichtung für `wippy/facade`
- [Render Engines](./render-engines.md) — srcdoc-iframe und Web Fragment
