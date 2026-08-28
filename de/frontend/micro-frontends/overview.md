---
title: "Wippy Micro Frontends"
description: "Zwischen Micro-Frontend-App und Web Component wählen und den passenden Build-, Routing-, Proxy- und Theming-Anleitungen folgen."
---

# Wippy Micro Frontends

**Klassifizierung: konzeptionelle Entscheidungshilfe.** Diese Seite vergleicht
die beiden Artefakttypen und verweist auf Build- und API-Referenzen; sie ist
kein eigenständiges Projekttutorial.

Wippy-Frontend-Code läuft innerhalb der Isolationsgrenze des Web Hosts. Es gibt
zwei Artefakttypen: **Micro-Frontend-Apps** und **Web Components**. Beide sind
eigenständige Vite-Projekte, kommunizieren über `@wippy-fe/proxy` mit der
Plattform und werden dem Backend in einem `_index.yaml`-Registry-Eintrag
bekannt gemacht. Rendering und Einsatzort unterscheiden sich.

## Micro-Frontend-App oder Web Component

| | Micro-Frontend-App (`view.page`) | Web Component (`view.component`) |
|---|---|---|
| **Darstellung** | Seitenoberfläche: srcdoc-iframe oder Web Fragment | Custom Element im Shadow DOM innerhalb einer Seite |
| **Eigene URL / Navigation** | Ja — beansprucht eine Backend-`mountRoute` | Nein — in eine andere Seite oder ein Chat-Artefakt eingebettet |
| **Internes Routing** | Ja — `vue-router` mit Memory History | Nein — einzelne Komponente ohne Router |
| **Kontrolle über die zugewiesene Oberfläche** | Ja — die Oberfläche kann ein Panel statt des Browser-Viewports sein | Nein — Größe durch umgebendes Layout |
| **Seitenübergreifend wiederverwendbar** | Nein — eine URL, ein Ort | Ja — jede Seite kann den Tag einbetten |
| **Typisierte Props** | Nein — liest `AppConfig` | Ja — als HTML-Attribute im Schema deklariert |
| **Typisierte Ereignisse** | Nein — Kommunikation über Proxy-API | Ja — schema-deklarierte `CustomEvent`s |
| **CSS-Isolation** | Engineabhängig: iframe-Grenze; ein Web Fragment teilt das Hostdokument | Shadow-DOM-Selektorgrenze |

**Faustregel:** Verwenden Sie eine Micro-Frontend-App für `vue-router`, eine
eigene URL oder die Zuständigkeit für eine geroutete Seitenoberfläche. Eine Web
Component eignet sich für einbettbare, wiederverwendbare und abgeschlossene UI.

## Nächste Schritte

Der [Schnellstart](./quickstart.md) zeigt minimale End-to-End-Beispiele für
eine Vue-Micro-Frontend-App und eine Vue-Web-Component und verweist auf das
öffentliche Repository [`app`](https://github.com/wippyai/app).

Micro-Frontend-App:

1. [Seitenrezept](./micro-frontend-app.md) — Scaffold, `wippy`-Block, Vite, Bootstrap und Routersynchronisierung
2. [Build- und Abhängigkeitsvertrag](./build-system.md) — `@wippy-fe/vite-plugin`, `wippy-meta.json`, Externals
3. [Proxy-API](./proxy-api.md) — Hostkommunikation über `@wippy-fe/proxy`
4. [Theming](./theming.md) → [Theming für Micro-Frontend-Apps](./micro-frontend-app-theming.md)

Web Component:

1. [Web Component](./web-component.md) — Scaffold, `WippyVueElement`, Props, Ereignisse und Shadow-DOM-CSS
2. [Build- und Abhängigkeitsvertrag](./build-system.md) — gleiche Toolchain, anderes Plugin und Ausgabeformat
3. [Proxy-API](./proxy-api.md) — dieselbe direkt importierte API
4. [Theming](./theming.md) → [Theming für Web Components](./web-component-theming.md)

Für beide:

- [Host-less-Modus](./host-less-mode.md) — Entwicklung und Tests ohne vollständigen Web Host
- [Index der Compliance-Regeln](./compliance-checklist.md) — kanonische Regelzuständigkeit und deterministische Gates
- [Debugging](./debugging.md) — symptombasierte Hilfe für häufige Fehler

## Voraussetzungen

- Wippy-Backendmodul mit Abhängigkeit `wippy/views`; siehe [Views](../../framework/views.md)
- `wippy/facade` als Web-Host-Einstieg; siehe [Facade-Einstiegspunkt](../web-host/entry-point.md)
- Node.js 22.12 oder neuer und Vite 7 für diesen Dokumentationsstand. Das Host-
  Quellpaket verlangt Node 22+ und verwendet Vite 7; Vite 7 selbst benötigt
  Node 20.19+ oder 22.12+. `@wippy-fe/vite-plugin` 0.0.56 akzeptiert auch Vite 5
  und 6, deren Anwender die jeweiligen Node-Anforderungen beachten müssen.
