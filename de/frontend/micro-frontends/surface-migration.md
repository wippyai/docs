# Surface-Migration

Rezepte, um eine bestehende Micro-Frontend-App von viewport-basierter
Responsivität auf den [Surface-Vertrag](./surface-portability.md) umzustellen.

Jedes Rezept ist gekennzeichnet:

| Kennzeichnung | Bedeutung |
| --- | --- |
| **automatisch** | Mechanisch. Die konvertierte Regel bedeutet dasselbe. |
| **bedingt** | Nur sicher, wenn eine genannte Vorbedingung gilt. Prüfen Sie sie. |
| **manuell** | Braucht eine menschliche Entscheidung; es gibt keine einzig richtige Umschreibung. |
| **nicht konvertierbar** | Es existiert keine Container-Query-Form. Verwenden Sie `host.surface` oder behalten Sie das Viewport-Verhalten bewusst bei. |

Jedes Rezept unten ist eine Technik für sich. Das Web-Host-Repository pflegt
eine lauffähige Seite, die alle kombiniert und von seiner Testsuite ausgeführt
wird, damit die Rezepte nicht zu falschen Anweisungen verrotten.

> Rezepte, die von nicht ausgeliefertem Stand abhängen — Tailwind-`surface-*`-Varianten,
> Build-Zeit-Diagnosen, host-vermitteltes Scrollen, Hit-Testing — sind als **noch nicht
> ausgeliefert** markiert und beschreiben nur, was heute existiert.

---

## Entscheidungsbaum: worum geht es in dieser Regel?

Klassifizieren Sie die Absicht, bevor Sie etwas konvertieren. Die meisten
schlechten Migrationen sind korrekt ausgeführte Konvertierungen von Regeln, die
gar nicht hätten konvertiert werden dürfen.

```text
Reagiert die Regel darauf, wie viel Platz DIESE PAGE hat?
├── ja → in @container wippy-surface konvertieren       (Rezepte 1-8)
├── nein, sie reagiert auf die Breite EINER KOMPONENTE
│        → dieser Komponente einen eigenen Container geben (Rezept 22)
├── nein, sie reagiert auf eine Benutzer-/Geräte-PRÄFERENZ
│        → als @media belassen                          (Rezept 13)
└── nein, sie verfolgt absichtlich das BROWSERFENSTER
         (ein echtes Vollfenster-Overlay)
         → belassen und begründen
```

Wenn Sie es nicht entscheiden können, lassen Sie es und kommen Sie darauf
zurück. Eine nicht konvertierte Media Query ist lediglich nicht portabel; eine
falsch konvertierte ist stillschweigend kaputt.

---

## 1. `max-width` → `inline-size <=` — **automatisch**

```css
/* vorher */ @media (max-width: 640px)                      { .nav { display: none } }
/* nachher */ @container wippy-surface (max-width: 640px)    { .nav { display: none } }
```

## 2. `min-width` → `inline-size >=` — **automatisch**

```css
/* vorher */ @media (min-width: 640px)                      { .sidebar { display: block } }
/* nachher */ @container wippy-surface (min-width: 640px)    { .sidebar { display: block } }
```

## 3. Ein begrenzter Breitenbereich — **automatisch**

```css
/* vorher */ @media (min-width: 640px) and (max-width: 1024px) { … }
/* nachher */ @container wippy-surface (640px <= width <= 1024px) { … }
```

Die Bereichssyntax wird von allen Engines unterstützt, auf die der
Surface-Vertrag zielt. Die `and`-Form funktioniert ebenfalls, wenn Sie sie
bevorzugen.

## 4. Mehrere Breakpoints, Kaskadenreihenfolge erhalten — **automatisch**

Container Queries ändern weder Spezifität noch Reihenfolge. Konvertieren Sie
jeden Block und behalten Sie dieselbe Quellreihenfolge bei:

```css
@container wippy-surface (min-width: 480px)  { .grid { grid-template-columns: repeat(2, 1fr) } }
@container wippy-surface (min-width: 900px)  { .grid { grid-template-columns: repeat(4, 1fr) } }
```

## 5. Höhen-Queries — **bedingt** (nur bei Container-Sizing)

```css
/* nachher */ @container wippy-surface (min-height: 500px) { .tall-only { display: block } }
```

Vorbedingung: Die Page ist **container-sized**. Beim Content-Sizing ist die Höhe
der Page ihr eigener Inhalt, Höhen-Queries greifen also nie. Deklarieren Sie die
Abhängigkeit, damit es laut statt still fehlschlägt:

```json
{ "wippy": { "surface": { "contract": 1, "requirements": ["block-size"] } } }
```

## 6. Aspect-Ratio-Queries — **bedingt** (nur bei Container-Sizing)

```css
/* vorher */ @media (min-aspect-ratio: 16/9)                     { … }
/* nachher */ @container wippy-surface (min-aspect-ratio: 16/9)   { … }
```

Dieselbe Vorbedingung wie in Rezept 5: Das Seitenverhältnis braucht beide Achsen.

## 7. Orientation-Queries — **bedingt** (nur bei Container-Sizing)

`@container wippy-surface (orientation: landscape)` beschreibt die Form *Ihres
Panels*, was meist gemeint war. Wenn Sie wirklich das Gerät meinten, ist das
eine Media Query — behalten Sie sie (Rezept 13).

## 8. Höhe / Aspect Ratio / Orientation beim Content-Sizing — **nicht konvertierbar**

Es gibt keine Blockachse, die abgefragt werden könnte. Bauen Sie so um, dass das
Layout von der Inline-Achse abhängt. Täuschen Sie es nicht mit `cqh` vor — siehe
Rezept 22.

Sie können die App nicht selbst auf Container-Sizing umstellen: Das Sizing wird
davon bestimmt, wo der Web Host die App rendert, nicht von irgendetwas in ihrem
Package. Wenn das Layout ohne die Blockachse wirklich nicht funktionieren kann,
deklarieren Sie `requirements: ["block-size"]`, damit eine content-sized
Platzierung rundweg abgelehnt wird, statt falsch zu rendern, und sorgen Sie
dafür, dass die App in einem container-sized Kontext gerendert wird (eigene Route
oder ein Layout-Panel). Siehe "Container sizing and content sizing" in
[Surface Portability](./surface-portability.md).

## 9. Geometrie, verschachtelt in einer Umgebungs-Media-Query — **manuell**

```css
/* vorher */
@media (prefers-color-scheme: dark) and (min-width: 640px) { .panel { … } }

/* nachher — aufteilen: die Präferenz bleibt, die Geometrie wandert */
@media (prefers-color-scheme: dark) {
  @container wippy-surface (min-width: 640px) { .panel { … } }
}
```

Manuell, weil die Verschachtelungsreihenfolge ändern kann, welche Deklarationen
gewinnen, wenn die beiden Bedingungen zuvor in einer Prelude kombiniert waren.
Prüfen Sie das Ergebnis nach.

## 10. Komma-ODER-Zweige — **manuell**

```css
/* vorher */ @media (max-width: 480px), (min-width: 1200px) { … }
```

Ein Komma ist ODER. Die Aufteilung in zwei `@container`-Blöcke erhält das ODER
**nur, wenn die beiden Blöcke ansonsten identisch und benachbart sind**;
verschachteln Sie sie versehentlich, haben Sie aus ODER ein UND gemacht, das auf
nichts passt. Duplizieren Sie die Deklarationen in zwei benachbarte Blöcke:

```css
@container wippy-surface (max-width: 480px)  { … }
@container wippy-surface (min-width: 1200px) { … }
```

## 11. `not`, `only`, komplexe Boolesche Ausdrücke — **manuell**

`only` ist ein Artefakt der Medientypen und hat kein Container-Äquivalent —
lassen Sie es weg. `not` invertiert in beiden Syntaxen die gesamte Bedingung,
aber die Präzedenz unterscheidet sich, sobald Sie `and`/`or` mischen; klammern
Sie explizit, statt der ursprünglichen Gruppierung zu vertrauen.

## 12. `screen` / `print` kombiniert mit Geometrie — **manuell**

Medien*typen* haben keine Container-Form. Behalten Sie den Typ als Media Query
und verschachteln Sie die Geometrie darin (wie in Rezept 9). Insbesondere das
Drucklayout sollte in der Regel vollständig viewport-/seitenbasiert bleiben.

## 13. Präferenzen bleiben Media Queries — **nicht konvertierbar** (und so korrekt)

`prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion`,
`forced-colors`, `hover`, `pointer`, `any-pointer`. `@container` unterstützt nur
Size-Features. Eine Konvertierung erzeugt eine Regel, die nie greift.

## 14. `em`-Breakpoints — **manuell**

`@media (min-width: 40em)` löst `em` gegen die initiale Schriftgröße auf.
`@container wippy-surface (min-width: 40em)` löst es gegen die Schriftgröße des
**Containers** auf. Unterscheiden sich diese, verschiebt sich Ihr Breakpoint
stillschweigend. Konvertieren Sie nach `px` oder prüfen Sie zuerst die berechnete
`font-size` des Containers.

## 15. `rem`-Breakpoints — **manuell**

`rem` ist innerhalb von `@media` **nicht** root-relativ. Media-Query-Bedingungen
lösen sowohl `em` als auch `rem` gegen die *initiale* Schriftgröße auf — den
Browser-Standard, unabhängig von jedem Autoren-CSS — während `@container` sie auf
gewöhnlichem Weg gegen die tatsächlich berechnete Root-/Container-Schriftgröße
auflöst.

Die beiden sind also bereits ungleich, sobald Ihre Root-Schriftgröße vom
Browser-Standard abweicht, ganz ohne Änderung zur Laufzeit. Der verbreitete
Reset `html { font-size: 62.5% }` genügt, um einen konvertierten Breakpoint von
640px auf 400px zu verschieben.

"Nichts ändert die Root-Schriftgröße" ist daher **keine** hinreichende
Vorbedingung. Konvertieren Sie nach `px`, genau wie bei `em` (Rezept 14), außer
die berechnete Schriftgröße des Roots entspricht nachweislich dem
Browser-Standard.

## 16. Viewport vs. Content-Box-Scrollbar-Grenze — **bedingt**

`100vw` schließt die klassische Scrollbar-Rinne ein. In der **iframe-Engine** ist
die Surface-Breite die **Content Box** der Query-Box innerhalb des Dokuments der
App, also nicht: Auf einer Page mit Dokument-Scrollbar ist der konvertierte Wert
um die Scrollbar-Breite schmaler, was meist genau die gewünschte Korrektur ist
(`100vw` als Ursache von horizontalem Overflow ist ein klassischer Bug).

Die **Fragment-Engine** misst einen Wrapper im Host-Dokument, den das Scrollen
des Inhalts nicht verschmälert, und wendet diese Korrektur daher nicht an.
Gleiches Panel, gleicher scrollender Inhalt, Breiten, die sich um eine Scrollbar
unterscheiden. Die Bedingung dieses Rezepts ist folglich, *in welcher Engine die
App läuft*, nicht bloß, ob die Ausrichtung pixelgenau ist.

## 17. Regeln, die auf `html` / `body` zielen — **manuell**

Eine Container Query stylt nie ihren eigenen Container, und eine Regel, die auf
`html` oder `body` zielt, schlägt in beiden Engines fehl — aus verschiedenen
Gründen:

- **Iframe-Engine:** Der Host verpackt Ihren Body-Inhalt in die Surface-Box,
  also sind `html` und `body` *Vorfahren* des Query-Containers. Eine
  `@container`-Regel kann keinen Vorfahren erreichen.
- **Fragment-Engine:** die umgekehrte Topologie — die Query-Box ist ein
  Wrapper im Host-Dokument *über* Ihrem Inhalt —, aber ein wörtlicher
  `body`-Selektor scheitert dennoch, weil das gespiegelte Dokument in
  `wf-html` / `wf-body` umbenannt wird.

So oder so ist die Lösung dieselbe und engine-sicher:

```css
/* ✗ greift stillschweigend nie */
@container wippy-surface (min-width: 640px) { body { display: flex } }

/* ✓ auf Ihr eigenes Root innerhalb der Surface verschieben */
@container wippy-surface (min-width: 640px) { #app { display: flex } }
```

## 18. `<picture><source media>` und `<link media>` — **nicht konvertierbar**

Ressourcenauswahl auf HTML-Ebene hat keine Container-Query-Form. Steuern Sie sie
entweder aus JS mit `host.surface.onChange` oder verlagern Sie die Art Direction
ins CSS (`background-image` unter einer `@container`-Regel), wo der Vertrag gilt.

## 19. Geometrie-`matchMedia()` → `host.surface` — **automatisch**

```js
// vorher
const mq = matchMedia('(min-width: 640px)')
mq.addEventListener('change', render)

// nachher
const off = host.surface.onChange(s => render(s.width >= 640))
render(host.surface.snapshot.width >= 640)
// off() beim Abbau aufrufen
```

Behalten Sie `matchMedia` für Präferenz-Queries — nur die Geometrie ist falsch.

## 20. Laufzeit-CSS, adopted Stylesheets, CSS-in-JS — **manuell**

Bevorzugen Sie es, `@container wippy-surface (...)`-Regeln auszugeben und CSS
reagieren zu lassen. Wenn Sie Pixel in JS berechnen, erzeugen Sie sie aus
`onChange` neu — ein einmalig aus `snapshot` gelesener Wert ist eingefroren und
desynchronisiert beim nächsten Resize. Geben Sie die vier reservierten
`--wippy-surface-*`-Namen niemals selbst aus und registrieren Sie sie niemals mit
`@property` / `CSS.registerProperty()` — die Registrierung hebelt das Signal
"Blockachse nicht verfügbar" des Hosts aus, sodass sich eine content-sized App
stillschweigend als container-sized meldet; eine Deklaration in einem Nachfahren
überdeckt den geerbten Wert und löst Ihre Page von der Surface.

## 21. Gebündeltes Drittanbieter-CSS — **manuell**

Meist können Sie es nicht bearbeiten. In dieser Reihenfolge: Konfigurieren Sie
die Bibliothek so, dass sie einen Breakpoint bzw. eine Breite akzeptiert, die Sie
aus `host.surface` liefern; umschließen Sie sie mit einem eigenen Container und
übersetzen Sie; oder pinnen Sie die Page auf die iframe-Engine
(`wippy.renderEngine: "iframe"`) und akzeptieren Sie fensterbasiertes Verhalten.
Build-Zeit-Scanning, um diese Fälle automatisch zu finden, ist **noch nicht
ausgeliefert**.

## 22. Verschachtelte Container und die `cq*`-Fallback-Falle — **manuell**

Container-Einheiten lösen gegen den *nächstgelegenen* Container auf, der die
benötigte Achse hat. Zwei Konsequenzen:

```css
.card { container-type: inline-size; }   /* hat KEINE Blockachse */
.card .thing { block-size: 25cqh; }      /* ✗ verwendet still den kleinen Viewport */
```

`cqh`/`cqb` erzeugen keinen Fehler, wenn kein Container mit Blockachse gefunden
wird — sie fallen auf den kleinen Viewport zurück und rendern eine plausible
falsche Zahl. Verwenden Sie `var(--wippy-surface-height, <fallback>)`, wenn Sie
die Blockachse der Surface wollen: Sie ist am Root verankert, ein näherer
Container kann sie also nicht abfangen, und sie fällt sichtbar zurück, wenn sie
nicht verfügbar ist.

Komponenten-Queries sind additiv, kein Ersatz: `wippy-surface` bezieht sich auch
aus einem verschachtelten Container heraus weiterhin auf die Fläche der Page.

---

## Viewport-Einheiten

| War | Verwenden Sie | Hinweise |
| --- | --- | --- |
| `100vw` | `var(--wippy-surface-width)` | Content Box; siehe Rezept 16 |
| `1vw` / `37vw` | `calc(var(--wippy-surface-width-unit) * 37)` oder `37cqw` | die Einheit ist 1 % |
| `100vh` | `var(--wippy-surface-height)` | nur bei Container-Sizing |
| `1vh` / `37vh` | `calc(var(--wippy-surface-height-unit) * 37)` | nur bei Container-Sizing |
| `vmin` | `min(var(--wippy-surface-width), var(--wippy-surface-height))` | nur bei Container-Sizing — braucht beide Achsen |
| `vmax` | `max(var(--wippy-surface-width), var(--wippy-surface-height))` | nur bei Container-Sizing |
| `vi` / `vb` | `cqi` / `cqb` oder die physischen Variablen | logisch; die Surface-Variablen sind physisch |
| `sv*` / `lv*` / `dv*` | `var(--wippy-surface-*)` | **keine separaten Äquivalente.** Sie beschreiben Zustände der Browser-Chrome, die ein Panel nicht hat; die Surface hat eine Größe |

`sv*`/`lv*` sind echte CSS-Einheiten — sie bedeuten **nicht** "Surface".

### Berechnungen

```css
/* vorher */ block-size: calc(100vh - 4rem);
/* nachher */ block-size: calc(var(--wippy-surface-height, 400px) - 4rem);
```

Der Fallback ist bewusst fest und offensichtlich falsch statt `100vh` — siehe "Verstecken Sie einen fehlenden Vertrag nicht hinter einem Fallback" weiter unten. Das zählt auf der Blockachse mehr als auf der Inline-Achse: Die Höhe ist bei **jeder** content-sized Platzierung ungültig, nicht nur dort, wo der Vertrag fehlt, sodass ein `100vh`-Fallback beim ersten Einbetten der App stillschweigend die Fensterhöhe rendert.

`min()`/`max()`/`clamp()` konvertieren unverändert; ersetzen Sie darin die
Einheiten.

### Wann `100%` besser ist als ein Surface-Wert

Soll ein Element sein **Elternelement** füllen, verwenden Sie `100%` oder
`w-full`. Greifen Sie nur dann zu `--wippy-surface-width`, wenn Sie
ausdrücklich die Fläche der *Page* brauchen — typischerweise, weil ein Vorfahre
schmaler ist und Sie ihm entkommen wollen. Etwas am Root zu verankern, das
elternrelativ sein sollte, ist der Weg zu einem Layout, das in einer
Verschachtelungstiefe korrekt und in einer anderen falsch ist.

### Verstecken Sie einen fehlenden Vertrag nicht hinter einem Fallback

```css
/* ✗ */ inline-size: var(--wippy-surface-width, 100vw);
```

Das rendert die Fensterbreite, wenn der Vertrag fehlt — genau der Bug, den der
Vertrag verhindern soll, nur unsichtbar gemacht. Lassen Sie es sichtbar
fehlschlagen oder wählen Sie einen festen Fallback, der offensichtlich falsch ist
(`400px`), damit es auffällt.

---

## Overlays

Der Surface-Vertrag erfasst `position: fixed` **nicht** — `container-type`
etabliert einen unabhängigen Formatierungskontext ohne Layout-Containment, ein
Query-Container berechnet also `contain: none` und verankert nichts. Das ist über
Chromium, Firefox und WebKit hinweg verifiziert. PrimeVue-Overlays und
handgebaute Fixed-Overlays funktionieren weiterhin, die **Positionierung braucht
also keine Migration**.

Ihre *Größenbestimmung* schon. Ein Overlay, das die Surface abdecken soll, sollte
`inset: 0` verwenden — nicht `100vw`/`100vh`, die das Browserfenster messen und
in einem Multi-Panel-Host darüber hinausschießen, und nicht
`var(--wippy-surface-height)`, das beim Content-Sizing nicht verfügbar ist.
Kombinieren Sie `inset: 0` mit `position: absolute` innerhalb eines eigenen
Roots der App mit `position: relative`, wenn es in beiden Engines funktionieren
muss; `position: fixed` ist nur in der iframe-Engine korrekt, aus dem direkt
folgenden Grund.

Aufmerksamkeit braucht die Engine, nicht der Vertrag: In der
Web-Fragment-Engine löst `position: fixed` gegen das **Host-Fenster** auf, nicht
gegen Ihr Panel. Siehe [Render Engines](../web-host/render-engines.md) und pinnen
Sie die App mit `wippy.renderEngine: "iframe"`, falls das wichtig ist.

Host-vermittelte Overlay-Platzierung und `host.surface`-Scroll-Helfer sind
**noch nicht ausgeliefert**.

---

## Checkliste

1. Klassifizieren Sie jede Regel (Page / Komponente / Präferenz / bewusst Fenster).
2. Konvertieren Sie Geometrie mit Page-Absicht zu `@container wippy-surface`.
3. Ersetzen Sie Viewport-Einheiten durch die Surface-Variablen.
4. Verschieben Sie jede Regel, die auf `html`/`body` zielte, auf Ihr eigenes Root-Element.
5. Prüfen Sie `em`-Breakpoints erneut.
6. Deklarieren Sie `requirements`, wenn Sie von der Blockachse abhängen.
7. Führen Sie die Page in beiden Engines **und in beiden Sizings** aus —
   Container und Content sind das, was diese Migration tatsächlich betrifft, und
   eine App ist content-sized, sobald sie eingebettet statt geroutet wird. Prüfen
   Sie mit `host.surface.snapshot.sizing`, in welchem Sizing Sie sind, und
   koppeln Sie Blockachsen-Verhalten an
   `host.surface.supports('block-size')`.
