---
title: "Render Engines"
description: "Wie view.page-Anwendungen in srcdoc-iframes oder Web Fragments laufen, einschließlich Auswahlregeln und Kompatibilitätsgrenzen."
---

# Render Engines

Diese Seite ist eine Referenz zur Auswahl und Kompatibilität von Render Engines. Sie erklärt Betreiber- und Paketeinstellungen und ist kein eigenständiges Deployment-Rezept.

Der Wippy Web Host rendert eine Micro-Frontend-Anwendung (`view.page`) über eine von **zwei Page Render Engines**. Die Engine ist ein Auslieferungsaspekt, der durch einen Betreiberschalter mit optionaler Überschreibung pro Seite gewählt wird. Portable Anwendungen verwenden Wippys Proxy- und Router-APIs, sodass ihr Verhalten nicht von einer bestimmten Engine abhängt.

| Engine | Rendering einer Seite | Isolation | Routing |
|--------|-----------------------|-----------|---------|
| **Iframe** (Standard) | Ein srcdoc-`<iframe>` mit injiziertem `proxy.js` | Vollständige Dokumentisolation | Nur Memory History; srcdoc besitzt keine echte URL |
| **Web Fragment** | Ein Same-Origin-Realm von [`reframed`](https://web-fragments.dev), der mit `proxy-fragment.js` in einen `<web-fragment>`-Shadow-Root gespiegelt wird | Realm-Isolation, gemeinsamer DOM-Baum | Echte `window.history`; URL-Router funktionieren |

Beide Engines unterstützen die von portablen Anwendungen verwendeten Wippy-Anwendungsdienste: authentifizierte API, WebSocket, Host-vermittelter Zustand, Confirm-/Bridge-Dialoge, Ereignisse `@history`/`@visibility`, Titelweitergabe, Error Capture, Plattform-CSS und Theme-Auslieferung, Auto-Height im Content-Modus sowie verschachtelte `<w-artifact>`-Einbettungen. Auslieferung und Steuerung sind Engine-spezifisch: iframe-CSS und Error Capture beachten Proxy-Injektionsflags, während das Fragment-Gateway Plattform-CSS und Error Capture immer installiert. Siehe [CSS-Injektion](./css-injection.md). Auch Browser-History-Fähigkeiten unterscheiden sich wie in der Tabelle dargestellt.

Verwenden Sie `createAppRouter()` aus `@wippy-fe/router` für Anwendungen, die unter beiden Engines laufen können. Die aktuelle Factory verwendet Memory History, erhält ihre erste Route aus `AppConfig.context.route` und synchronisiert über `@history` mit dem Host. Ein direkter Router mit `createWebHistory()` ist auf Fragment beschränkt und nicht portabel zu iframe- oder `auto`-Deployments, die auf iframe zurückfallen können.

## Rendering eines Fragments

Eine für die Fragment-Engine ausgewählte `view.page` wird als `<web-fragment src="/@fragment/{id}/">` gemountet. Das [`/@fragment`-Gateway](../../framework/views.md#web-fragments-gateway) in `wippy/views` liefert den Reframing-Vertrag. Der `reframed`-Client erzeugt einen verborgenen Same-Origin-Realm-iframe (`wf:<id>`), streamt das transformierte HTML des Gateways in den Shadow Root des Fragments und führt `proxy-fragment.js`, einen Adapter für `@wippy-fe/proxy`, im Realm aus, um die Proxy-API `$W` bereitzustellen. Der Adapter leitet das gemeinsame `postMessage`-Protokoll an das erfasste Same-Origin-Hostfenster, statt sich auf das gepatchte `window.parent` des Realms zu verlassen.

Dieselbe Seite ist unter der iframe-Engine ein srcdoc-`<iframe>` mit injiziertem `proxy.js`; siehe [Proxy und Isolation](./proxy-isolation.md).

## Engine auswählen

### Globaler Schalter (Betreiber)

Die Engine für ein vollständiges Deployment ist die Facade-Anforderung `render_engine` → `hostConfig.renderEngine`. Standardwert ist `iframe`; nur die genaue Zeichenfolge `fragment` aktiviert die Fragment-Engine. Jeder andere Wert, auch ein Tippfehler, wird als `iframe` behandelt.

```bash
wippy run -c -o wippy.facade:render_engine:default=fragment
```

Siehe [Facade → Render Engine](../../framework/facade.md#render-engine).

### Überschreibung pro Seite (Anwendungsautor)

Eine Seite aktiviert oder deaktiviert die Engine über `wippy.renderEngine` im Block `wippy` ihrer `package.json`:

| Wert | Verhalten |
|------|-----------|
| `"auto"` (Standard) | Folgt dem globalen Schalter. |
| `"iframe"` | Rendert immer als srcdoc-iframe und steigt unabhängig vom Schalter aus Fragments aus. |
| `"fragment"` | Bevorzugt die Fragment-Engine. Bei globalem `fragment`: immer. Bei globalem `iframe`: nur wenn ein Laufzeit-**Capability-Probe** (`GET /@fragment/{id}/`, pro Sitzung gecacht) bestätigt, dass Gateway und Proxy vorhanden sind; andernfalls sicherer Fallback auf iframe. |

Siehe [Micro-Frontend-Anwendungen → Render Engine](../frontend-registry/view-page.md#render-engine).

## Einschränkungen von Fragments

Einige Browser-APIs verhalten sich in einem Reframed-Realm **falsch und ohne Fehler**. Eine davon abhängige Seite sollte `wippy.renderEngine: "iframe"` festlegen.

| API / Fähigkeit | Verhalten im Realm | Auswirkung |
|-----------------|--------------------|------------|
| `document.elementFromPoint` | Gibt unabhängig von der Panelgröße `null` zurück | Bricht Pointer-Hit-Testing: Drag-and-drop, sortierbare Listen, Popper/floating-ui, virtuelle Scroller |
| `matchMedia`, Einheiten `vh`/`vw`, `position: fixed` | Beziehen sich auf den **Host**-Viewport, nicht auf das Fragmentpanel | In einem vollflächigen Panel etwa 1 px abweichend, in kleinem Panel wie Seitenleiste/Modal deutlich falsch |
| `window.scrollX/Y`, `scrollTo` | Zielen auf das verborgene Realm-Fenster, stets `0` | Scrollabhängige Oberfläche liest falsche Geometrie |
| Web Workers, Canvas, WebGL, WASM | **Funktionieren normal** | — |

`vh`/`vw` und `matchMedia` stehen hier, weil sie das **Fenster** abfragen. Eine Anwendung, die sich stattdessen an ihrer zugewiesenen *Oberfläche* ausrichtet — Container Queries auf `wippy-surface` und Variablen `--wippy-surface-*` — wird unter beiden Engines gleich aufgelöst und benötigt keine Festlegung. Siehe [Oberflächenportabilität](../micro-frontends/surface-portability.md) und [Oberflächenmigration](../micro-frontends/surface-migration.md). Für `position: fixed` und `elementFromPoint` gibt es keine portable Form; sie bleiben echte Gründe für eine Festlegung.

Zwei Detektoren melden solche Probleme während der Entwicklung; sie erkennen Inkompatibilität des Anwendungscodes, keine Deploymentfehler:

- **Buildzeit** (`@wippy-fe/vite-plugin`): scannt Page-Quellcode und gibt eine Build-**Warnung** mit API-Name und Vorschlag `wippy.renderEngine: "iframe"` aus.
- **Dev-Laufzeit** (Fragment-Proxy, nur DEV): patcht diese APIs und führt beim tatsächlichen Aufruf einmal `console.warn` aus.

## Fragments aktivieren — Zusammenfassung

Die Fragment-Engine in einer konsumierenden Anwendung benötigt kompatible Framework-Module und den Betreiberschalter; zusätzliche Router- oder Parameterverdrahtung ist nicht erforderlich:

1. **Framework-Module** — Verwenden Sie ein aktuelles kompatibles Paar aus `wippy/facade` und `wippy/views`, das den Schalter `render_engine` und das selbst mountende Fragment-Gateway bereitstellt. Prüfen Sie das genaue Release in der aktuellen Wippy-Moduldokumentation.
2. **Schalter** — Setzen Sie `render_engine` der Facade global auf `fragment` oder aktivieren Sie Seiten einzeln mit `wippy.renderEngine`.

> Das Gateway `/@fragment` wird von aktuellem `wippy/views` selbst bereitgestellt: Das Modul deklariert seinen eigenen Top-Level-Router und bindet ihn an eine Anforderung `server` mit Standardwert `app:gateway`. Ein Konsument benötigt keine Fragmentverdrahtung und startet unabhängig von aktivierten Fragments normal mit der iframe-Engine. Überschreiben Sie `server` nur, wenn die ID Ihres `http.service` nicht `app:gateway` lautet. Aktiviert eine einzelne Seite Fragments in einem ansonsten auf iframe eingestellten Deployment, bestätigt ein Laufzeit-Capability-Probe Gateway und `proxy-fragment.js`, bevor gewechselt wird; andernfalls bleibt die Engine iframe. Der globale Schalter `render_engine: fragment` vertraut dem Betreiber und prüft nicht. Siehe [Views → Web-Fragments-Gateway](../../framework/views.md#web-fragments-gateway).

Die Frontend-Anwendung benötigt keinen Fragment-spezifischen Code; `proxy-fragment.js` ist ein vom CDN ausgeliefertes Host-Artefakt und wird nicht von der Anwendung gebündelt.

## Siehe auch

- [Facade](../../framework/facade.md) — Betreiberschalter `render_engine` und `hostConfig.renderEngine`
- [Views](../../framework/views.md) — selbst mountendes Gateway `/@fragment` und seine `server`-Bindung
- [Micro-Frontend-Anwendungen (view.page)](../frontend-registry/view-page.md) — Feld `wippy.renderEngine` pro Seite
- [Proxy und Isolation](./proxy-isolation.md) — gemeinsame Proxy-API beider Engines und iframe-Engine
- [Web-Host-Übersicht](./overview.md) — Laden und Rendern von Seiten durch den Host
