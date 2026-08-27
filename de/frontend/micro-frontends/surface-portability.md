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
> hostvermitteltes Scrollen und tiefes Hit-Testing sind **noch nicht verfügbar**;
> diese Seite dokumentiert ausschließlich den heutigen Stand.

## CSS-Vertrag

### Container Queries

Der Host nennt die Appbox `wippy-surface`:

```css
@container wippy-surface (min-width: 640px) {
  .sidebar { display: block; }
}
```

Verwenden Sie dies statt `@media (min-width: 640px)` für Reaktionen auf den tatsächlich
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

Die Werte werden vererbt, sodass jedes Element der App sie lesen kann. Sie
beschreiben die **Content Box** der Querybox, gegen die auch `100cqw` auflöst.

Apps dürfen diese vier Namen weder deklarieren noch zuweisen. Eine Deklaration
auf einem Nachfahren überschreibt den geerbten Wert und löst die App unbemerkt
von der Oberfläche.

Die Eigenschaften müssen außerdem **unregistriert** bleiben. Beschreiben Sie
sie weder mit `@property` noch mit `CSS.registerProperty()`. Der Host markiert
eine nicht verfügbare Blockachse mit einem garantiert ungültigen Wert, der nur
bei einer unregistrierten Eigenschaft zum leeren String wird. Ein
`initial-value` würde stattdessen berechnet: Eine Content-Sizing-App würde sich
damit ohne irgendeinen Fehler als Container-Sizing melden, und
`supports('block-size')` gäbe `true` zurück.

Beachten Sie zwei Einschränkungen, bevor Sie diese Werte pixelgenau mit
`100cqw` vergleichen. Der **erste Frame kann breiter sein**: Der Startwert wird
vom hostseitigen `<iframe>` übernommen, bevor das App-Dokument existiert und
eine mögliche Scrollbar bekannt ist. Dieser Wert ist in das CSS des Dokuments
eingebettet; das erste Layout verwendet ihn und wird einen Frame später
korrigiert. Außerdem sind die Werte auf 1/64 px quantisiert und müssen mit
Toleranz verglichen werden.

## Container- und Content-Sizing

| | Inline-Achse | Block-Achse |
|---|---|---|
| **Container-Sizing** — Host gibt beide Maße vor | verfügbar | verfügbar |
| **Content-Sizing** — Inhalt bestimmt Höhe | verfügbar | **nicht verfügbar** |

Bei Content-Sizing sind die Höheneigenschaften absichtlich ungültig;
`var(--wippy-surface-height, 400px)` verwendet deshalb den Fallback, und
`@container wippy-surface (min-height: …)` matcht nie.

**Der Autor wählt den Modus nicht**, und nichts in `package.json` ändert ihn.
Der Renderort im Web Host entscheidet:

| Darstellung | Sizing |
|---|---|
| Geroutete Seite, Layoutpanel, rechtes Panel, Registry-Tab | **container** |
| Eingebettetes/Inline-Artefakt, Navbar-Widget | **content** |

Dasselbe Paket kann also auf eigener Route Container- und eingebettet Content-
Sizing erhalten. Eine App, die die Blockachse benötigt, muss ihr Fehlen
tolerieren oder die Anforderung deklarieren (siehe unten), damit sie abgelehnt
wird, statt fehlerhaft zu rendern. Lesen Sie den aktuellen Modus mit
`host.surface.snapshot.sizing` und sichern Sie Verhalten über
`host.surface.supports('block-size')` ab — treffen Sie niemals Annahmen.

`cqh` verhält sich sogar schlechter als „nicht verfügbar“: Fehlt ein Container
mit der benötigten Achse, fallen Container-Einheiten auf den **Small Viewport**
zurück. `cqh` liefert dadurch unbemerkt einen plausiblen, aber von der
Oberfläche unabhängigen Wert. Verwenden Sie stattdessen
`var(--wippy-surface-height, <fallback>)`; der Wert ist am Root gebunden und
fällt sichtbar zurück. Dieselbe Falle entsteht, wenn eine App auf einem
Zwischenelement `container-type: inline-size` deklariert und darunter `cqh`
verwendet.

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

`host.surface.engine` ist `iframe`, `fragment` oder `host`. Der letzte Wert ist
keine Page-Engine, sondern bedeutet, dass keine Seitenoberfläche zugewiesen
wurde:

- eine Web Component, die direkt im Hostdokument statt in einer Seite gemountet ist;
- der eigenständige Dev-Proxy ohne Web Host.

Der Snapshot meldet dann `width: 0`, `height: null`, `sizing: 'content'`, und
`supports()` ist für alles `false`. Das ist beabsichtigt: Das Browserfenster
einzusetzen wäre genau die falsche Gleichsetzung, die der Vertrag verhindern
soll. Ein direkt gemountetes Element misst stattdessen seinen eigenen Root.

## Nicht abgedeckte Mechanismen

| Mechanismus | Grund | Alternative |
|---|---|---|
| `<picture>` / `<source media>` | HTML-Ressourcenauswahl kennt keine Container Query | `host.surface.onChange` oder CSS-`background-image` unter `@container` |
| `srcset` + `sizes` | Auflösung gegen Viewport | `sizes` aus Oberfläche ableiten oder Quelle per JS setzen |
| `matchMedia()` | fragt definitionsgemäß das Fenster | Für Geometrie `host.surface.onChange`, für Präferenzen weiter `matchMedia` |

## Overlays

Der Vertrag bindet `position: fixed` nicht. `container-type` erzeugt einen
unabhängigen Formatierungskontext ohne Layout-Containment; eine Querybox
berechnet daher `contain: none` und verankert nichts. PrimeVue-Overlays und
selbst implementierte Fixed-Overlays funktionieren unverändert weiter.

Das Engine-Verhalten ist eine getrennte Frage: Im Web Fragment bezieht sich
`position: fixed` auf das **Hostfenster** statt auf das Panel der App. Siehe
[Render-Engines](../web-host/render-engines.md). Pinnen Sie die App bei nötiger
exakter Viewport-Verankerung mit `wippy.renderEngine: "iframe"`.

Die Größe eines Overlays ist eine andere Frage als seine Verankerung. Für eine
Fläche, die exakt die Oberfläche abdecken soll, ersetzen Sie Viewport-Einheiten
durch `inset: 0` und kombinieren dies mit dem Positionierungsschema, das zur
benötigten Portabilität passt:

```css
/* Portable across BOTH engines: resolves against the app's own root rather
   than against whatever `fixed` happens to be relative to.
   `min-block-size: 100%` is load-bearing — see below. */
.app-root { position: relative; min-block-size: 100%; }
.backdrop { position: absolute; inset: 0; }
```

Der Containing Block ist der **App-Root**, nicht die Oberfläche. Bei
Content-Sizing deckt er sie automatisch ab, weil der Inhalt die Höhe bestimmt.
Bei Container-Sizing gibt der Host der Querybox eine Höhe vor, die der App-Root
nicht erbt. Ohne `min-block-size: 100%` endet das Backdrop daher zu früh, obwohl
die `fixed`-Variante die Oberfläche abdecken würde. `absolute` scrollt mit dem
Inhalt, `fixed` bleibt verankert.

Setzen Sie `min-block-size: 100%` auf das **äußerste** Element innerhalb der
Oberfläche. Eine Prozenthöhe braucht eine lückenlose Kette bestimmter Höhen;
auf einem Komponenten-Root innerhalb eines automatisch hohen `#app` löst sie
zu null auf und erzeugt dieselbe Lücke erneut. Dies ist in Chromium, Firefox
und WebKit verifiziert, jeweils mit dem Fall ohne `min` als Kontrolle.

```css
/* Iframe engine only. `fixed` resolves against the child viewport, which IS
   the surface there — but against the HOST WINDOW in the fragment engine,
   where this covers the whole application instead of the panel. */
.backdrop { position: fixed; inset: 0; }
```

Verwenden Sie dafür nicht `var(--wippy-surface-height)`: Der Wert ist bei
Content-Sizing nicht verfügbar, sodass ein so geschriebenes Backdrop dort
zusammenfällt.

## App-Root (`#app`)

**Web Fragment verlangt exakt `id="app"`.** Nicht `#root`, nicht `#main`, nicht
`<main>` — die ID wird wörtlich abgeglichen.

Die Engine bindet die Höhenkette der Seite an diesen Selektor und misst darüber
die Inhaltshöhe. Der reflektierte Baum nutzt `wf-html`/`wf-body` statt
`html`/`body`; die Kette kann daher nicht wie in einem iframe am Dokument-Root
aufgebaut werden.

**Symptom bei einem falschen Root:** Eine Content-Sizing-Fragmentseite mit
`#root` oder einem anderen Root rendert mit **null Höhe** — ein leeres Panel,
ohne Fehler im eigenen Code. Der Host protokolliert einen Fehler, der die
Anforderung benennt. Die iframe-Engine ist nicht betroffen, weil sie die Höhe
aus `CmdBodySize` übernimmt. Dasselbe Paket kann deshalb im iframe korrekt und
als Fragment leer erscheinen.

```html
<!-- correct -->
<body><div id="app"></div></body>
```

```js
createApp(App).mount('#app')
```

Versuchen Sie nicht, ein Fragment mit null Höhe durch eine Höhe auf `#root` zu
reparieren. `height: 100%`, `min-height: 100dvh` oder `100vh` auf einem anders
benannten Root führen nicht dazu, dass die Engine ihn misst. Viewport-Einheiten
beschreiben das Browserfenster, nicht die zugewiesene Oberfläche. Benennen Sie
das Element stattdessen in `app` um.

## Einschränkungen

- **Body-Box.** In der iframe-Engine setzt der Host `margin`, `padding` und `border` des App-`body` auf null, damit die zugewiesene Oberfläche eindeutig definiert ist. Padding gehört auf den eigenen App-Root. Fragment tut dies nicht; eine App, die Body-Padding voraussetzt, rendert daher leicht unterschiedlich. Eine Builddiagnostik dafür gibt es noch nicht.
- **`body > *`-Selektoren und Regeln für `html`/`body`.** In der **iframe**-Engine legt der Host die Surface-Box um den Body-Inhalt. Direkte Kindselektoren ab `body` treffen deshalb keine App-Elemente mehr, und `body`/`html` sind Vorfahren der Querybox, die eine `@container`-Regel nicht erreichen kann. Die **Fragment**-Engine hat die umgekehrte Topologie: Die Querybox liegt über dem reflektierten Baum. Ein wörtlicher `body`-Selektor scheitert dennoch, weil das Dokument in `wf-html`/`wf-body` umbenannt wird. Solche Regeln gehören auf den eigenen Root innerhalb der Oberfläche; das funktioniert in beiden Engines.
- **Über `<w-iframe>` / `<w-artifact>` gerenderter Inhalt erhält keine Oberfläche — auch nicht als verwaltetes Top-Level-Panel.** Diese Elemente erzeugen ihr Kinddokument immer mit deaktiviertem Surface-Bootstrap; nichts misst sie. `host.surface` meldet deshalb `width: 0` und `sizing: 'content'`, aber `engine: 'iframe'`, nicht `engine: 'host'`. Prüfen Sie `snapshot.width` statt `engine`, wenn Ihre Komponente so eingebettet werden kann. Bei einem verschachtelten Embed ist das erwartbar; leicht übersehen wird es bei einem verwalteten Layoutpanel als `{ kind: 'component', tagName: 'w-artifact' }`: Es belegt einen vollständigen Top-Level-Slot und erhält dennoch keinen Vertrag. Verwenden Sie `kind: 'page'` für Inhalte, die ihn benötigen.
- Bei Content-Sizing gibt es keine Blockachse.
- Fragment-Apps müssen an `#app` mounten; siehe [App-Root (`#app`)](#app-root-app) zur erforderlichen Höhenkette und zum Nullhöhen-Symptom.
- **Die veraltete Route `/page/:id` erhält keine Oberfläche.** Sie rendert in ein bloßes iframe, das nichts misst, und verzichtet vollständig auf den Vertrag: keine Querybox, kein Wrapper, keine Änderung am App-DOM. Die App verhält sich dort wie vor Einführung des Vertrags. Verwenden Sie `/c/:id`, um eine Oberfläche zu erhalten. Wie verschachtelte Embeds meldet die alte Route weiterhin `engine: 'iframe'`; prüfen Sie deshalb `snapshot.width` statt des Engine-Namens.
- **Die Engines können sich um eine Scrollbarbreite unterscheiden.** Die iframe-Engine misst die Inline-Achse an der Querybox innerhalb des App-Dokuments, sodass eine Dokument-Scrollbar sie verengt. Fragment misst einen Hostdokument-Wrapper, den das Scrollen des reflektierten Inhalts nicht verengt. Bei demselben Panel und scrollenden Inhalt meldet Fragment deshalb einen etwas größeren Wert.
- **Keine Isolationsgrenze.** Der Vertrag regelt das Layout. Er gibt einem Fragment kein eigenes Dokument, keinen Viewport, keine Selection, keinen Top Layer und keine Origin.

## Migration

[Migration von Oberflächen](./surface-migration.md) enthält Umstellungen mit
den Labels automatisch, bedingt, manuell oder nicht konvertierbar.
