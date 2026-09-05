---
title: "Wippy Micro Frontends"
description: "Wippy-Frontend-Code läuft innerhalb der Isolationsgrenze des Web Hosts. Es gibt zwei Arten von Artefakten, die Sie bauen können: Micro-Frontend-Apps und Web…"
---

# Wippy Micro Frontends

Wippy-Frontend-Code läuft innerhalb der Isolationsgrenze des Web Hosts. Es gibt zwei Arten von Artefakten, die Sie bauen können: **Micro-Frontend-Apps** und **Web Components**. Beide sind eigenständige Vite-Projekte, beide kommunizieren über `@wippy-fe/proxy` mit der Plattform, und beide werden dem Backend über einen `_index.yaml`-Registry-Eintrag deklariert. Der Unterschied liegt darin, wie sie gerendert werden und wofür sie geeignet sind.

## Micro-Frontend-App vs. Web Component

| | Micro-Frontend-App (`view.page`) | Web Component (`view.component`) |
|---|---|---|
| **Gerendert als** | Vollständiger iframe, isolierter Browsing-Kontext | Custom Element im Shadow DOM, innerhalb einer Page |
| **Hat eigene URL / Navigationseintrag** | Ja — beansprucht eine Backend-`mountRoute` | Nein — eingebettet in eine andere Page oder ein Chat-Artefakt |
| **Internes Routing** | Ja — `vue-router` mit Memory History | Nein — einzelne Komponente, kein Router |
| **Kontrolliert den Viewport** | Ja | Nein — Größe vom umgebenden Layout bestimmt |
| **Über Pages hinweg wiederverwendbar** | Nein — eine URL, ein Ort | Ja — jede Page kann das Tag einbetten |
| **Empfängt typisierte Props** | Nein — liest `AppConfig` | Ja — schemadeklarierte HTML-Attribute |
| **Löst typisierte Events aus** | Nein — kommuniziert über die Proxy-API | Ja — schemadeklarierte `CustomEvent`s |
| **CSS-Isolation** | iframe-Grenze | Shadow DOM (vollständige Kapselung) |

**Kurzregel:** Wenn es `vue-router`, eine eigene URL oder den vollen Viewport braucht — es ist eine Micro-Frontend-App. Wenn es einbettbar, wiederverwendbar und in sich geschlossen ist — es ist eine Web Component.

Im Zweifel beginnen Sie mit einer Web Component. Sie später zu einer Micro-Frontend-App zu befördern ist einfacher als umgekehrt.

## Was Sie als Nächstes lesen sollten

Wenig Zeit? [Quickstart](./quickstart.md) enthält minimale End-to-End-Beispiele sowohl für eine Vue-Micro-Frontend-App als auch für eine Vue-Web-Component, mit Links zum öffentlichen Repo [`app`](https://github.com/wippyai/app).

Eine Micro-Frontend-App bauen:
1. [Micro Frontend App](./micro-frontend-app.md) — Scaffold, wippy-Block in `package.json`, Vite-Konfiguration, Bootstrap-Sequenz, Router-Sync
2. [Build System](./build-system.md) — `@wippy-fe/vite-plugin`, `wippy-meta.json`, Externals
3. [Proxy API](./proxy-api.md) — `@wippy-fe/proxy`-Referenz für die Kommunikation mit dem Host
4. [Theming](./theming.md) → [Theming: Micro Frontend Apps](./micro-frontend-app-theming.md) — CSS-Variablen-Katalog, dann der Empfang über Proxy-Injections

Eine Web Component bauen:
1. [Web Component](./web-component.md) — Scaffold, `WippyVueElement`, Props, Events, Shadow-DOM-CSS
2. [Build System](./build-system.md) — dieselbe Vite-Toolchain, anderes Plugin und Ausgabeformat
3. [Proxy API](./proxy-api.md) — dieselbe API, direkt aus `@wippy-fe/proxy` importiert
4. [Theming](./theming.md) → [Theming: Web Components](./web-component-theming.md) — CSS-Variablen-Katalog, dann der Empfang über die Shadow-DOM-Grenze hinweg

Beides:
- [Host-less Mode](./host-less-mode.md) — entwickeln und testen, ohne den vollen Web Host zu betreiben
- [Compliance Rule Index](./compliance-checklist.md) — kanonische Regeleigentümer und deterministische Tore
- [Debugging](./debugging.md) — symptomorientierter Leitfaden für die häufigsten Fehlerszenarien

## Voraussetzungen

- Wippy-Backend-Modul mit `wippy/views` als deklarierter Abhängigkeit (siehe [Views](../../framework/views.md))
- `wippy/facade` für den Einstiegspunkt des Web Hosts (siehe [Facade Entry Point](../web-host/entry-point.md))
- Node.js 22 oder neuer und Vite 7, wie von den gewählten Web-Host-Quellen
  deklariert; prüfen Sie deren Package erneut, wenn sich das Ziel-Release ändert
