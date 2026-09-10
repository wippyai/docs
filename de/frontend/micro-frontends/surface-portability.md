# Surface-Portabilität

Einer Micro-Frontend-App wird eine **Surface** zugewiesen — der rechteckige Bereich, den der Web Host ihr zuteilt. Dieser Bereich ist meist **nicht** das Browserfenster: Die App kann eines von mehreren Panels in einem [Multi-Panel-Layout](../web-host/multi-panel-layout.md) sein, und dieselbe App kann von jeder der beiden [Render-Engines](../web-host/render-engines.md) in unterschiedlichen Größen auf demselben Bildschirm gerendert werden.

Ein Layout am Fenster auszurichten ist daher in beiden Engines falsch. Der Surface-Vertrag gibt Ihnen eine portable Alternative in CSS und in JavaScript.

> **Status:** Vertrag 1, ausgeliefert. Tailwind-`surface-*`-Varianten, host-vermitteltes Scrollen und tiefes Hit-Testing sind **noch nicht ausgeliefert**; diese Seite dokumentiert nur, was heute existiert.

## Der CSS-Vertrag

### Container Queries

Der Host benennt die Box der App `wippy-surface`, sodass sie wie jeder CSS-Container abgefragt werden kann:

```css
@container wippy-surface (min-width: 640px) {
  .sidebar { display: block; }
}
```

Verwenden Sie das statt `@media (min-width: 640px)` für alles, was auf den Platz reagiert, den die App einnimmt. Native Container-Einheiten lösen gegen dieselbe Box auf:

```css
.hero { inline-size: 50cqw; }
```

### Surface-Variablen

Vier Custom Properties tragen die Geometrie als schlichte Pixel-Längen:

| Property | Bedeutung |
|----------|---------|
| `--wippy-surface-width` | volle Surface-Breite |
| `--wippy-surface-width-unit` | 1 % der Surface-Breite |
| `--wippy-surface-height` | volle Surface-Höhe (nur bei Container-Sizing) |
| `--wippy-surface-height-unit` | 1 % der Surface-Höhe (nur bei Container-Sizing) |

Sie sind der portable Ersatz für `vw` / `vh`:

```css
/* war: inline-size: 50vw */
.panel { inline-size: calc(var(--wippy-surface-width-unit) * 50); }
```

Die Werte werden vererbt, jedes Element in der App kann sie also lesen. Sie melden die **Content Box** der Query-Box, dieselbe Box, gegen die `100cqw` auflöst.

Anwendungen dürfen diese vier Namen **nicht** deklarieren oder zuweisen. Eine Deklaration in einem Nachfahren überdeckt den geerbten Wert und löst die App stillschweigend von der Surface.

Sie müssen außerdem **unregistriert** bleiben. Beschreiben Sie sie nicht mit `@property` oder `CSS.registerProperty()`. Der Host markiert die Blockachse als nicht verfügbar, indem er einen garantiert ungültigen Wert zuweist, der nur solange zum leeren String berechnet wird, wie die Property unregistriert ist. Geben Sie einer ein `initial-value`, berechnet sie stattdessen dieses, sodass eine content-sized App sich als container-sized meldet und `supports('block-size')` beginnt, `true` zu liefern — ganz ohne Fehler.

Zwei Vorbehalte, bevor Sie diese Werte pixelgenau mit `100cqw` vergleichen. Der **erste Frame kann breiter sein**: Der Boot-Wert wird aus dem host-seitigen `<iframe>`-Element gesetzt, bevor das Dokument der App existiert, er kann also nicht wissen, ob der Inhalt eine Scrollbar hervorruft. Dieser Wert ist im CSS des Dokuments verankert, das erste Layout verwendet ihn also und wird einen Frame später korrigiert. Und die Werte sind auf 1/64 px **quantisiert**, vergleichen Sie also mit einer Toleranz.

## Container-Sizing und Content-Sizing

| | Inline-Achse | Blockachse |
|---|---|---|
| **Container-Sizing** — der Host gibt beide Dimensionen vor | verfügbar | verfügbar |
| **Content-Sizing** — der Inhalt der App bestimmt die Höhe | verfügbar | **nicht verfügbar** |

Beim Content-Sizing sind die Höhen-Properties absichtlich ungültig, sodass `var(--wippy-surface-height, 400px)` zurückfällt, statt eine Zahl zu melden, und `@container wippy-surface (min-height: …)` nie greift.

**Welches eine App bekommt, ist nicht die Wahl des Autors**, und nichts in `package.json` ändert das. Das Sizing bestimmt sich daraus, *wo der Web Host die App rendert*:

| Gerendert als | Sizing |
|---|---|
| geroutete Page, Layout-Panel, rechtes Panel, Registry-Tab | **Container** |
| eingebettetes Artefakt, Inline-Artefakt-Block, Navbar-Widget | **Content** |

Dasselbe Package ist also container-sized auf seiner eigenen Route und content-sized, wenn jemand es einbettet. Eine App, die die Blockachse braucht, muss es daher tolerieren, sie nicht zu haben, oder die Anforderung deklarieren (siehe unten), damit sie abgelehnt statt kaputt gerendert wird. Lesen Sie den aktuellen Modus mit `host.surface.snapshot.sizing` und koppeln Sie Verhalten an `host.surface.supports('block-size')` — nehmen Sie nie etwas an.

`cqh` verhält sich schlechter als "nicht verfügbar": Container-Einheiten fallen auf den **kleinen Viewport** zurück, wenn kein Container die benötigte Achse liefert, `cqh` produziert also stillschweigend eine plausible Zahl ohne Bezug zur Surface. Bevorzugen Sie `var(--wippy-surface-height, <fallback>)`, das am Root verankert ist und sichtbar zurückfällt. Dieselbe Falle taucht innerhalb einer App auf, die `container-type: inline-size` auf einem Zwischenelement deklariert und darunter `cqh` verwendet.

## Anforderungen deklarieren

Optional, in der `package.json` der App:

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

Akzeptierte Tokens sind `block-size` und `surface-scroll`; beide setzen Container-Sizing voraus und werden abgelehnt, wenn die Instanz content-sized ist. `registered-hit-testing`, `native-document-hit-testing` und `owner-visibility` sind reserviertes Vokabular und werden als nicht implementiert abgelehnt, statt stillschweigend ignoriert zu werden.

Die Validierung läuft vor dem Start, eine unerfüllbare Deklaration schlägt also sichtbar fehl, statt eine App zu rendern, deren Blockachsen-Queries nie greifen. Eine App ohne `surface`-Block rendert weiterhin und erhält weiterhin Query-Box und Variablen; sie sagt lediglich keine Portabilität zu.

`surface-scroll` wird akzeptiert und von `supports()` gemeldet, aber dieses Release liefert **keine** host-vermittelte Scroll-API — die Deklaration bekundet eine Absicht, sie schaltet keine Methode frei.

## Die Surface aus JavaScript lesen

Siehe [Proxy API → Surface](./proxy-api.md#surface) für die vollständige Signatur.

```js
const { width, widthUnit, height, sizing } = host.surface.snapshot

if (host.surface.supports('block-size')) {
  // Verlass auf die Blockachse ist sicher
}

const off = host.surface.onChange((s) => reposition(s.width, s.height))
// off() beim Abbau aufrufen
```

Der Snapshot wird aus denselben berechneten Custom Properties zurückgelesen, die das CSS auflöst, er kann also nicht von dem abweichen, was `@container` und `cqw` sehen.

Bevorzugen Sie CSS für Layout. Greifen Sie zur JavaScript-API dort, wo CSS nicht hinkommt: Canvas-Größen, Virtualisierungsberechnungen, Ressourcenauswahl und zur Laufzeit erzeugte Styles.

### `engine: 'host'`

`host.surface.engine` meldet `iframe`, `fragment` oder `host`. Letzteres ist keine Page-Engine — es bedeutet, dass der Code dort läuft, wo keine Surface zugewiesen wurde:

- eine Web Component, die direkt ins Host-Dokument statt in eine Page gemountet wurde;
- der eigenständige Dev-Proxy, ganz ohne Web Host.

Dort meldet der Snapshot `width: 0`, `height: null`, `sizing: 'content'`, und `supports()` ist für alles `false`. Das ist Absicht: Das Browserfenster einzusetzen wäre genau die falsche Gleichsetzung, die der Vertrag vermeiden soll. Eine direkt gemountete Komponente sollte stattdessen ihr eigenes Root messen.

## Was der Vertrag nicht abdeckt

Container Queries ersetzen Media Queries in **CSS**. Diese Mechanismen liegen außerhalb von CSS und folgen weiterhin dem Browserfenster:

| Mechanismus | Warum | Was zu tun ist |
|---|---|---|
| `<picture>` / `<source media>` | HTML-Ressourcenauswahl; keine Container-Query-Form | Aus `host.surface.onChange` steuern oder die Art Direction in ein CSS-`background-image` unter `@container` verlagern |
| `srcset` + `sizes` | lösen gegen den Viewport auf | `sizes` aus der Surface ableiten oder die Quelle aus JS setzen |
| `matchMedia()` | fragt definitionsgemäß das Fenster | `host.surface.onChange` für Geometrie verwenden; `matchMedia` für Präferenzen behalten |

## Overlays

Der Surface-Vertrag erfasst `position: fixed` **nicht**. `container-type` etabliert einen unabhängigen Formatierungskontext ohne Layout-Containment, ein Query-Container berechnet also `contain: none` und verankert nichts. PrimeVue-Overlays und handgebaute Fixed-Overlays funktionieren beide unverändert weiter.

Das Verhalten der Engine ist eine eigene Sache: In der Web-Fragment-Engine löst `position: fixed` gegen das **Host-Fenster** auf statt gegen das Panel der App. Siehe [Render Engines](../web-host/render-engines.md) und pinnen Sie die App mit `wippy.renderEngine: "iframe"`, wenn exakte Viewport-Verankerung wichtig ist.

Ein Overlay zu dimensionieren ist eine andere Frage als es zu verankern. Für ein Backdrop oder eine Drawer, die genau die Surface abdecken soll, lassen Sie Viewport-Einheiten weg und verwenden `inset: 0` — kombinieren Sie es aber mit dem Positionierungsschema, das dazu passt, wie portabel die App sein muss:

```css
/* Portabel über BEIDE Engines: löst gegen das eigene Root der App auf statt
   gegen das, worauf sich `fixed` gerade bezieht.
   `min-block-size: 100%` ist tragend — siehe unten. */
.app-root { position: relative; min-block-size: 100%; }
.backdrop { position: absolute; inset: 0; }
```

Der enthaltende Block ist das **Root der App**, nicht die Surface, das Overlay deckt die Surface also nur ab, wenn dieses Root es tut. Beim Content-Sizing geschieht das automatisch (der Inhalt *ist* die Höhe). Beim Container-Sizing gibt der Host der Query-Box eine Höhe vor, die das Root der App nicht erbt, ohne `min-block-size: 100%` bleibt das Backdrop also still zu kurz — und versagt genau in dem Modus, in dem die `fixed`-Variante korrekt ausgesehen hätte. Die beiden unterscheiden sich auch im Verhalten: `absolute` scrollt mit dem Inhalt, `fixed` bleibt verankert.

Setzen Sie `min-block-size: 100%` auf das **äußerste** Element innerhalb der Surface. Eine prozentuale Höhe braucht eine ununterbrochene Kette definiter Höhen darüber; auf ein Komponenten-Root angewendet, das in einem `#app` mit automatischer Höhe verschachtelt ist, löst sie zu null auf und bringt dieselbe Lücke zurück. Verifiziert über Chromium, Firefox und WebKit hinweg, mit dem Fall ohne `min` als Kontrolle.

```css
/* Nur iframe-Engine. `fixed` löst gegen den Child-Viewport auf, der dort DIE
   Surface IST — aber in der Fragment-Engine gegen das HOST-FENSTER, wo das
   die ganze Anwendung statt des Panels abdeckt. */
.backdrop { position: fixed; inset: 0; }
```

Vermeiden Sie hierfür `var(--wippy-surface-height)`: Es ist beim Content-Sizing nicht verfügbar, ein so geschriebenes Backdrop kollabiert also genau auf den Pages, wo es am schwersten auffällt.

## Das App-Root-Element (`#app`)

**Die Web-Fragment-Engine verlangt, dass Ihr Root-Element `id="app"` hat.** Nicht
`#root`, nicht `#main`, nicht `<main>` — die ID wird wörtlich abgeglichen.

Die Engine bindet die Seitenhöhen-Kette an diesen Selektor und misst darüber die
Höhe Ihres Inhalts. Das gespiegelte Dokument stellt `wf-html`/`wf-body` statt
`html`/`body` bereit, Sie können die Kette also nicht wie in einem iframe vom
Dokument-Root aus aufbauen.

**Symptom, wenn es falsch ist:** Eine content-sized Fragment-Page, deren Root
`#root` (oder etwas anderes) ist, rendert mit **Höhe null** — leeres Panel, kein
Fehler in Ihrem eigenen Code. Der Host protokolliert einen Fehler, der die
Anforderung benennt. Die iframe-Engine ist nicht betroffen, weil sie die Höhe aus
`CmdBodySize` bezieht; dasselbe Package kann dort also gut aussehen und als
Fragment leer sein.

```html
<!-- korrekt -->
<body><div id="app"></div></body>
```

```js
createApp(App).mount('#app')
```

**Versuchen Sie nicht, ein Fragment mit Höhe null zu reparieren, indem Sie
`#root` eine Höhe geben.** `height: 100%`, `min-height: 100dvh` oder `100vh` auf
einem anders benannten Root bringt die Engine nicht dazu, es zu messen, und
Viewport-Einheiten sind hier aus genau dem Grund falsch, aus dem es diese ganze
Seite gibt — sie beschreiben das Browserfenster, nicht Ihre Surface. Benennen Sie
das Element stattdessen in `app` um.

## Einschränkungen

- **Body-Box.** In der iframe-Engine setzt der Host `margin`, `padding` und `border` am `body` der App auf null, damit die zugewiesene Surface wohldefiniert ist. Legen Sie das Seiten-Padding auf Ihr eigenes Root-Element. Die Fragment-Engine tut das nicht, eine App, die sich auf Body-Padding stützt, rendert also zwischen den Engines leicht unterschiedlich. Eine Build-Zeit-Diagnose dafür gibt es noch nicht.
- **`body > *`-Selektoren und Regeln, die auf `html`/`body` zielen.** In der **iframe**-Engine verpackt der Host den Body-Inhalt in die Surface-Box, sodass an `body` verwurzelte Direct-Child-Selektoren keine App-Elemente mehr treffen und `body`/`html` zu *Vorfahren* der Query-Box werden — eine `@container`-Regel, die auf sie zielt, greift nie. Die **Fragment**-Engine hat die umgekehrte Topologie (die Query-Box sitzt über dem gespiegelten Baum), aber ein wörtlicher `body`-Selektor scheitert auch dort, weil das gespiegelte Dokument in `wf-html`/`wf-body` umbenannt wird. Setzen Sie solche Regeln auf Ihr eigenes Root-Element innerhalb der Surface; das ist in beiden Engines korrekt.
- **Alles, was über `<w-iframe>` / `<w-artifact>` gerendert wird, bekommt keine Surface — auch ein Top-Level-Managed-Panel nicht.** Diese Elemente bauen ihr Child-Dokument immer mit deaktiviertem Surface-Bootstrap, und nichts misst sie, `host.surface` meldet also `width: 0` und `sizing: 'content'` — aber mit `engine: 'iframe'`, nicht `engine: 'host'`. Prüfen Sie `snapshot.width` statt `engine`, wenn Ihre Komponente so eingebettet werden kann. Für ein *verschachteltes* Embed ist das zu erwarten; leicht zu übersehen ist es bei einem Managed-Layout-Panel, das als `{ kind: 'component', tagName: 'w-artifact' }` deklariert ist, ein vollflächiger Top-Level-Slot, der dennoch keinen Vertrag bekommt. Verwenden Sie `kind: 'page'` für Inhalte, die einen brauchen.
- **Keine Blockachse beim Content-Sizing.**
- **Die Fragment-Engine verlangt, dass das Root-Element der App `#app` ist.** Sie bindet die Seitenhöhen-Kette an diesen Selektor und misst darüber die Höhe des Inhalts, weil das gespiegelte Dokument `wf-html`/`wf-body` statt `html`/`body` bereitstellt und eine App ihre Kette daher nicht wie in einem iframe vom Root aus aufbauen kann. Eine content-sized Fragment-App mit einem anderen Root (`#root`, `<main>`) kann nicht gemessen werden: Der Host protokolliert einen Fehler, der die Anforderung benennt, und das Panel rendert mit Höhe null. Die iframe-Engine ist nicht betroffen — sie bezieht die Höhe aus `CmdBodySize`.
- **Die veraltete Route `/page/:id` bekommt keine Surface.** Sie rendert in einen nackten iframe, der nie etwas misst, und steigt damit vollständig aus — keine Query-Box, kein Wrapper, keine Änderung am DOM der App. Eine App verhält sich dort genau wie vor der Existenz dieses Vertrags. Verwenden Sie `/c/:id`, um eine Surface zu bekommen. Wie verschachtelte Embeds meldet sie weiterhin `engine: 'iframe'`, testen Sie also `snapshot.width` statt des Engine-Namens.
- **Die beiden Engines können sich um eine Scrollbar unterscheiden.** Die iframe-Engine misst die Inline-Achse an der Query-Box *innerhalb* des Dokuments der App, eine Dokument-Scrollbar verschmälert sie also. Die Fragment-Engine misst einen Wrapper im Host-Dokument, den das Scrollen des gespiegelten Inhalts nicht verschmälert. Gleiches zugewiesenes Panel und gleicher scrollender Inhalt: Die Fragment-Engine meldet die etwas größere Zahl.
- **Keine Isolationsgrenze.** Der Vertrag regelt Layout. Er gibt einem Fragment kein eigenes Dokument, keinen eigenen Viewport, keine eigene Selektion, keinen eigenen Top Layer und keinen eigenen Origin.

## Migration

[Surface Migration](./surface-migration.md) enthält Rezept für Rezept die Konvertierungen für bestehende Apps, jeweils als automatisch, bedingt, manuell oder nicht konvertierbar gekennzeichnet.
