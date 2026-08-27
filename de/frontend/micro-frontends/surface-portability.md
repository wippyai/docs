---
title: "Portabilität von Oberflächen"
description: "view.page-Anwendungen mit Container Queries, Oberflächenvariablen und host.surface unabhängig vom Browser-Viewport skalieren."
---

# Portabilität von Oberflächen

**Klassifizierung: Rendering-Vertragsreferenz mit gezielten Beispielen.** CSS-,
JavaScript- und Paketblöcke zeigen einzelne Regeln, kein vollständiges Fixture.

Eine Micro-Frontend-App erhält eine **Oberfläche**, also den rechteckigen Bereich,
den der Web Host ihr zuweist. Dieser ist meist nicht das Browserfenster. Die App
kann ein Panel eines [Multi-Panel-Layouts](../web-host/multi-panel-layout.md)
sein und durch beide [Render Engines](../web-host/render-engines.md) in
unterschiedlichen Größen erscheinen. Fensterbasierte Größen sind daher in
beiden Engines falsch; der Oberflächenvertrag bietet portable CSS- und JS-Alternativen.

> **Status:** Vertrag 1 ist ausgeliefert. Tailwind-Varianten `surface-*`,
> hostvermitteltes Scrollen und tiefes Hit-Testing sind noch nicht verfügbar.

## CSS-Vertrag

### Container Queries

Der Host nennt die Appbox `wippy-surface`:

```css
@container wippy-surface (min-width: 640px) {
  .sidebar { display: block; }
}
```

Verwenden Sie dies statt `@media` für Reaktionen auf den tatsächlich
zugewiesenen Platz. Native Container-Einheiten beziehen sich auf dieselbe Box:

```css
.hero { inline-size: 50cqw; }
```

### Oberflächenvariablen

| Eigenschaft | Bedeutung |
|---|---|
| `--wippy-surface-width` | gesamte Breite |
| `--wippy-surface-width-unit` | 1 % der Breite |
| `--wippy-surface-height` | gesamte Höhe, nur Container-Sizing |
| `--wippy-surface-height-unit` | 1 % der Höhe, nur Container-Sizing |

Portabler Ersatz für `vw` / `vh`:

```css
/* was: inline-size: 50vw */
.panel { inline-size: calc(var(--wippy-surface-width-unit) * 50); }
```

Die geerbten Werte beschreiben die Content Box, gegen die auch `100cqw`
auflöst. Apps dürfen die vier Namen weder deklarieren noch zuweisen und sie
auch nicht über `@property` oder `CSS.registerProperty()` registrieren. Der Host
markiert eine nicht verfügbare Blockachse mit garantiert ungültigem Wert, der
nur unregistriert zum leeren String wird. Ein `initial-value` würde fälschlich
Container-Sizing und `supports('block-size') === true` melden.

Der erste Frame kann breiter sein, weil der Startwert vom Host-iframe stammt,
bevor ein Scrollbar bekannt ist; ein Frame später wird korrigiert. Werte sind
außerdem auf 1/64 px quantisiert und müssen mit Toleranz verglichen werden.

## Container- und Content-Sizing

| | Inline-Achse | Block-Achse |
|---|---|---|
| **Container-Sizing** — Host gibt beide Maße vor | verfügbar | verfügbar |
| **Content-Sizing** — Inhalt bestimmt Höhe | verfügbar | **nicht verfügbar** |

Bei Content-Sizing sind Höhenvariablen absichtlich ungültig; `var(..., 400px)`
verwendet den Fallback und Höhen-Container-Queries matchen nie.

**Der Autor wählt den Modus nicht.** Der Renderort entscheidet:

| Darstellung | Sizing |
|---|---|
| Geroutete Seite, Layoutpanel, rechtes Panel, Registry-Tab | **container** |
| Eingebettetes/Inline-Artefakt, Navbar-Widget | **content** |

Dasselbe Paket kann also auf eigener Route Container- und eingebettet Content-
Sizing erhalten. Lesen Sie `host.surface.snapshot.sizing` und prüfen Sie
`host.surface.supports('block-size')`. `cqh` fällt ohne passende Achse auf den
Small Viewport zurück und liefert irreführende Werte. Verwenden Sie stattdessen
`var(--wippy-surface-height, <fallback>)`. Dasselbe Problem entsteht unter
einem Zwischencontainer mit `container-type: inline-size`.

## Anforderungen deklarieren

Optional in `package.json`:

```json
{
  "wippy": {
    "path": "index.html",
    "surface": {
      "contract": 1,
      "requirements": ["block-size"]
    }
  }
}
```

Zulässig sind `block-size` und `surface-scroll`; beide verlangen Container-
Sizing. `registered-hit-testing`, `native-document-hit-testing` und
`owner-visibility` sind reserviert und werden als nicht implementiert abgelehnt.
Validierung erfolgt vor Start. Ohne `surface`-Block erhält die App Box und
Variablen, wirbt aber nicht mit Portabilität. `surface-scroll` wird akzeptiert
und von `supports()` gemeldet, schaltet in diesem Release jedoch keine
hostvermittelte Scroll-API frei.

## Oberfläche aus JavaScript lesen

Siehe [Proxy-API → Surface](./proxy-api.md#surface).

```js
const { width, widthUnit, height, sizing } = host.surface.snapshot

if (host.surface.supports('block-size')) {
  // safe to rely on the block axis
}

const off = host.surface.onChange((s) => reposition(s.width, s.height))
// call off() on teardown
```

Der Snapshot wird aus denselben berechneten Variablen gelesen wie CSS und kann
nicht von `@container`/`cqw` abweichen. Verwenden Sie CSS für Layout und JS für
Canvas, Virtualisierung, Ressourcenauswahl und runtimegenerierte Styles.

### `engine: 'host'`

`host.surface.engine` ist `iframe`, `fragment` oder `host`. `host` bedeutet,
dass keine Seitenoberfläche zugewiesen wurde: direkte Web Component im
Hostdokument oder Standalone-Dev-Proxy. Der Snapshot meldet dann `width: 0`,
`height: null`, `sizing: 'content'` und überall `supports() === false`. Ein
direkt gemountetes Element misst seinen eigenen Root statt das Browserfenster.

## Nicht abgedeckte Mechanismen

| Mechanismus | Grund | Alternative |
|---|---|---|
| `<picture>` / `<source media>` | HTML-Ressourcenauswahl kennt keine Container Query | `host.surface.onChange` oder CSS-`background-image` unter `@container` |
| `srcset` + `sizes` | Auflösung gegen Viewport | `sizes` aus Oberfläche ableiten oder Quelle per JS setzen |
| `matchMedia()` | fragt definitionsgemäß das Fenster | Für Geometrie `host.surface.onChange`, für Präferenzen weiter `matchMedia` |

## Overlays

Der Vertrag bindet `position: fixed` nicht. `container-type` erzeugt keinen
Containing Block. Im Web Fragment bezieht sich `fixed` auf das **Hostfenster**,
statt auf das Panel. Siehe [Render-Engines](../web-host/render-engines.md). Fixieren Sie eine App bei nötiger Viewport-Verankerung mit
`wippy.renderEngine: "iframe"`.

Für eine paneldeckende portable Fläche verwenden Sie `inset: 0` und einen
appbezogenen Positionierungskontext:

```css
/* Portable across BOTH engines: resolves against the app's own root rather
   than against whatever `fixed` happens to be relative to.
   `min-block-size: 100%` is load-bearing — see below. */
.app-root { position: relative; min-block-size: 100%; }
.backdrop { position: absolute; inset: 0; }
```

Der Containing Block ist der App-Root. Bei Container-Sizing erbt dieser die
Hosthöhe nicht, daher ist `min-block-size: 100%` am **äußersten** Element nötig.
Eine Prozenthöhe braucht eine durchgehende Kette bestimmter Höhen; an einem
tieferen Komponenten-Root kann sie zu null werden. `absolute` scrollt mit,
`fixed` bleibt stehen.

```css
/* Iframe engine only. `fixed` resolves against the child viewport, which IS
   the surface there — but against the HOST WINDOW in the fragment engine,
   where this covers the whole application instead of the panel. */
.backdrop { position: fixed; inset: 0; }
```

Verwenden Sie dafür nicht `--wippy-surface-height`, da es bei Content-Sizing fehlt.

## App-Root (`#app`)

**Web Fragment verlangt exakt `id="app"`.** Die Engine bindet die Höhenkette
an diesen Selektor. Der reflektierte Baum nutzt `wf-html`/`wf-body` statt
`html`/`body`. Ein anderer Root erzeugt bei Content-Sizing eine leere, null
Pixel hohe Seite; iframe kann trotzdem funktionieren.

```html
<!-- correct -->
<body><div id="app"></div></body>
```

```js
createApp(App).mount('#app')
```

Korrigieren Sie dies nicht mit `height: 100%`, `100dvh` oder `100vh`, sondern
benennen Sie den Root in `app` um.

## Einschränkungen

- iframe setzt `margin`, `padding` und `border` des `body` auf null; Padding gehört auf den App-Root. Fragment tut dies nicht.
- `body > *` sowie `html`/`body`-Regeln sind zwischen Engines nicht portabel. iframe legt die Surface-Box zwischen Body und Inhalt; Fragment nennt Dokumentelemente um. Regeln gehören auf den eigenen Root innerhalb der Oberfläche.
- Über `<w-iframe>` / `<w-artifact>` gerenderter Inhalt erhält keine Oberfläche, auch als Top-Level-Managed-Panel. `host.surface` meldet `width: 0`, `sizing: 'content'`, aber `engine: 'iframe'`. Prüfen Sie `snapshot.width`; nutzen Sie `kind: 'page'` für Inhalte mit Vertrag.
- Bei Content-Sizing gibt es keine Blockachse.
- Fragment-Apps müssen an `#app` mounten; siehe [App-Root (`#app`)](#app-root-app) zur erforderlichen Höhenkette und zum Nullhöhen-Symptom.
- Die veraltete Route `/page/:id` erhält keine Oberfläche; `/c/:id` verwenden. Auch hier `snapshot.width` statt Engine prüfen.
- Die Engines können sich um eine Scrollbarbreite unterscheiden: iframe misst innerhalb des Dokuments, Fragment am Hostwrapper.
- Dies ist keine Isolationsgrenze. Ein Fragment erhält kein eigenes Dokument, keinen Viewport, keine Selection, Top Layer oder Origin.

## Migration

[Migration von Oberflächen](./surface-migration.md) enthält Umstellungen mit
den Labels automatisch, bedingt, manuell oder nicht konvertierbar.
